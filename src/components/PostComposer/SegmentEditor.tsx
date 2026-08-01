/**
 * 投稿セグメント1件のエディタ（Phase 9）。虎威 UI を流用:
 *  - EmojiPicker（カーソル位置に絵文字挿入）
 *  - ImageListHorizontalScrolable（横スクロールの画像サムネイル表示・削除）
 *  - 画像追加ボタン（Google ドライブへアップロード）
 *  - AI 作成ボタン（キーワードからポスト生成）
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmojiClickData } from 'emoji-picker-react';
import { IconBrandGoogleDrive, IconPhoto, IconTrash } from '@tabler/icons-react';
import { ActionIcon, Box, Group, Text, Textarea, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import EmojiPicker from '@/components/EmojiPicker';
import ImageListHorizontalScrolable from '@/components/ImageListHorizontalScrolable';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { linkAndGetGoogleToken } from '@/store/reducers/googleAccessTokenSlice';
import { isPickerReady, openDrivePicker } from '@/utils/googleDrive/drivePicker';
import {
  BLUESKY_GRAPHEME_LIMIT,
  characterCount,
  graphemeCount,
  THREADS_CHAR_LIMIT,
} from '@/utils/textLimits';
import { driveImageUrl, makeDrivePublic, MAX_IMAGES, uploadImageToDrive, type UploadedMedia } from './media';

interface Props {
  index: number;
  isThread: boolean;
  text: string;
  media: UploadedMedia[];
  hasBluesky: boolean;
  hasThreads: boolean;
  onTextChange: (text: string) => void;
  onMediaChange: (media: UploadedMedia[]) => void;
  onRemoveSegment?: () => void;
}

const SegmentEditor = ({
  index,
  isThread,
  text,
  media,
  hasBluesky,
  hasThreads,
  onTextChange,
  onMediaChange,
  onRemoveSegment,
}: Props) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.googleAccessTokenState.googleAccessToken);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const graphemes = graphemeCount(text);
  const chars = characterCount(text);
  const blueskyOver = hasBluesky && graphemes > BLUESKY_GRAPHEME_LIMIT;
  const threadsOver = hasThreads && chars > THREADS_CHAR_LIMIT;
  const over = blueskyOver || threadsOver;
  // 未選択時は両方の目安を表示
  const showBluesky = hasBluesky || (!hasBluesky && !hasThreads);
  const showThreads = hasThreads || (!hasBluesky && !hasThreads);

  const insertEmoji = (emojiData: EmojiClickData) => {
    const ta = textareaRef.current;
    if (!ta) {
      onTextChange(text + emojiData.emoji);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    onTextChange(text.substring(0, start) + emojiData.emoji + text.substring(end));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - media.length;
    if (remaining <= 0) {
      notifications.show({ color: 'yellow', message: t('compose.image.maxReached', { max: MAX_IMAGES }) });
      return;
    }

    // ここに来る時点で token は接続済み（handleAddImageClick で確保済み）。
    // 万一未接続なら、ここで popup を開くと change イベント経由で auth/popup-blocked に
    // なるため、接続を促すだけにする。
    const currentToken = token || '';
    if (!currentToken) {
      notifications.show({ color: 'yellow', message: t('compose.image.connectFirst') });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    const added: UploadedMedia[] = [];
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        try {
          added.push(await uploadImageToDrive(file, currentToken, dispatch));
        } catch (e: any) {
          notifications.show({ color: 'red', message: e?.message || t('compose.image.uploadFailed') });
        }
      }
      if (added.length > 0) onMediaChange([...media, ...added]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = (fileId: string) => {
    const item = media.find((m) => m.fileId === fileId);
    if (item && item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
    onMediaChange(media.filter((m) => m.fileId !== fileId));
  };

  const moveImage = (fileId: string, dir: -1 | 1) => {
    const idx = media.findIndex((m) => m.fileId === fileId);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= media.length) return;
    const next = [...media];
    const [item] = next.splice(idx, 1);
    next.splice(to, 0, item);
    onMediaChange(next);
  };

  // 📷 ボタン: 未接続なら「このクリック（直接のユーザー操作）」で Google 認証ポップアップを開く。
  // change イベント経由だと Chrome が popup をブロックするため、必ずボタン click で取得する。
  // 接続済みならファイル選択ダイアログを開く。
  const handleAddImageClick = async () => {
    if (media.length >= MAX_IMAGES) return;
    if (!token) {
      const res = await dispatch(linkAndGetGoogleToken());
      if (linkAndGetGoogleToken.fulfilled.match(res)) {
        notifications.show({ color: 'green', message: t('compose.image.driveConnected') });
      } else {
        const payload = res.payload as { message?: string } | undefined;
        notifications.show({
          color: 'red',
          message: payload?.message || t('compose.image.uploadFailed'),
        });
      }
      return; // 接続のみ。もう一度クリックで画像選択
    }
    fileRef.current?.click();
  };

  // Google ドライブから既存画像を選択（Google Picker）
  const pickFromDrive = async () => {
    const appId = import.meta.env.VITE_G_OAUTH_CLIENT_ID;
    const developerKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!appId || !developerKey) {
      notifications.show({ color: 'yellow', message: t('compose.image.driveNotConfigured') });
      return;
    }
    if (!isPickerReady()) {
      notifications.show({ color: 'blue', message: t('compose.image.pickerLoading') });
      return;
    }
    const remaining = MAX_IMAGES - media.length;
    if (remaining <= 0) {
      notifications.show({ color: 'yellow', message: t('compose.image.maxReached', { max: MAX_IMAGES }) });
      return;
    }

    let currentToken = token || '';
    if (!currentToken) {
      const res = await dispatch(linkAndGetGoogleToken());
      if (linkAndGetGoogleToken.fulfilled.match(res)) {
        currentToken = res.payload.accessToken;
      } else {
        notifications.show({ color: 'red', message: t('compose.image.uploadFailed') });
        return;
      }
    }

    try {
      openDrivePicker({
        token: currentToken,
        appId,
        developerKey,
        onPicked: async (files) => {
          setUploading(true);
          const added: UploadedMedia[] = [];
          try {
            for (const f of files.slice(0, remaining)) {
              await makeDrivePublic(f.id, currentToken);
              added.push({
                fileId: f.id,
                url: driveImageUrl(f.id),
                preview: driveImageUrl(f.id),
                name: f.name,
              });
            }
            if (added.length > 0) onMediaChange([...media, ...added]);
          } finally {
            setUploading(false);
          }
        },
      });
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message || t('compose.image.pickerLoading') });
    }
  };

  const pics = media.map((m) => ({
    file: null,
    fileName: m.fileId,
    fileId: m.fileId,
    imgUrl: m.preview,
    mimeType: '',
  }));

  return (
    <div>
      {isThread && (
        <Group justify="space-between" mb={4}>
          <Text size="sm" fw={500} c="dimmed">
            {t('compose.threadPart', { index: index + 1 })}
          </Text>
          {onRemoveSegment && (
            <ActionIcon variant="subtle" color="red" onClick={onRemoveSegment} aria-label="remove segment">
              <IconTrash size={16} />
            </ActionIcon>
          )}
        </Group>
      )}

      <Textarea
        ref={textareaRef}
        label={!isThread ? t('compose.body') : undefined}
        placeholder={t('compose.bodyPlaceholder')}
        autosize
        minRows={index === 0 ? 4 : 3}
        maxRows={12}
        value={text}
        onChange={(e) => onTextChange(e.currentTarget.value)}
        error={over ? t('compose.overLimit') : undefined}
      />

      <Group justify="space-between" mt={4}>
        <Group gap="xs">
          <EmojiPicker onSelectedEmoji={insertEmoji} />
          <Tooltip
            label={
              media.length >= MAX_IMAGES
                ? t('compose.image.maxReached', { max: MAX_IMAGES })
                : token
                  ? t('compose.image.addLocal')
                  : t('compose.image.connectDrive')
            }
          >
            <ActionIcon
              variant="subtle"
              onClick={handleAddImageClick}
              disabled={media.length >= MAX_IMAGES}
              loading={uploading}
              aria-label="add image from local"
            >
              <IconPhoto />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={media.length >= MAX_IMAGES ? t('compose.image.maxReached', { max: MAX_IMAGES }) : t('compose.image.addDrive')}>
            <ActionIcon
              variant="subtle"
              color="teal"
              onClick={pickFromDrive}
              disabled={media.length >= MAX_IMAGES}
              aria-label="add image from drive"
            >
              <IconBrandGoogleDrive />
            </ActionIcon>
          </Tooltip>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </Group>
        <Group gap="md">
          {showBluesky && (
            <Text size="xs" c={blueskyOver ? 'red' : 'dimmed'} fw={blueskyOver ? 700 : 400}>
              Bluesky {graphemes} / {BLUESKY_GRAPHEME_LIMIT}
            </Text>
          )}
          {showThreads && (
            <Text size="xs" c={threadsOver ? 'red' : 'dimmed'} fw={threadsOver ? 700 : 400}>
              Threads {chars} / {THREADS_CHAR_LIMIT}
            </Text>
          )}
        </Group>
      </Group>

      {media.length > 0 && (
        <Box style={{ height: 210, marginTop: 8 }}>
          <ImageListHorizontalScrolable pics={pics} removeImage={removeImage} moveImage={moveImage} />
        </Box>
      )}
    </div>
  );
};

export default SegmentEditor;
