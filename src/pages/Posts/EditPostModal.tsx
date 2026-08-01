/**
 * 既存投稿の編集モーダル（Phase 9・虎威相当）。
 * 内容（本文）・画像・予約時刻を編集して GAS の postData update で保存する。queued のみ編集可。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Group, Modal, Stack } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { type UploadedMedia } from '@/components/PostComposer/media';
import SegmentEditor from '@/components/PostComposer/SegmentEditor';
import { useAppDispatch } from '@/hooks/rtkhooks';
import { fetchPostLists, updatePost } from '@/store/reducers/postsSlice';
import type { PostRow } from '@/types/posts';

const parseMedia = (mediaUrls: string): UploadedMedia[] => {
  try {
    const arr = JSON.parse(mediaUrls || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.map((url: string) => {
      const fileId = String(url).split('/d/')[1]?.split(/[/?]/)[0] || String(url);
      return { fileId, url: String(url), preview: String(url), name: fileId };
    });
  } catch {
    return [];
  }
};

interface Props {
  post: PostRow | null;
  onClose: () => void;
}

const EditPostModal = ({ post, onClose }: Props) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [schedule, setSchedule] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setText(post.contents);
      setMedia(parseMedia(post.mediaUrls));
      setSchedule(post.postSchedule ? new Date(post.postSchedule) : null);
    }
  }, [post]);

  const save = async () => {
    if (!post) return;
    if (!text.trim()) {
      notifications.show({ color: 'red', message: t('editPost.needText') });
      return;
    }
    setSaving(true);
    try {
      await dispatch(
        updatePost({
          id: post.id,
          contents: text,
          mediaUrls: media.map((m) => m.url),
          postSchedule: schedule ? schedule.toISOString() : '',
        })
      ).unwrap();
      notifications.show({ color: 'green', message: t('editPost.saved') });
      dispatch(fetchPostLists());
      onClose();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('editPost.failed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={Boolean(post)} onClose={onClose} title={t('editPost.title')} size="lg">
      {post && (
        <Stack>
          <SegmentEditor
            index={0}
            isThread={false}
            text={text}
            media={media}
            hasBluesky={post.platform === 'bluesky'}
            hasThreads={post.platform === 'threads'}
            onTextChange={setText}
            onMediaChange={setMedia}
          />
          <DateTimePicker
            label={t('editPost.schedule')}
            description={t('editPost.scheduleHint')}
            placeholder={t('editPost.noSchedule')}
            clearable
            value={schedule}
            onChange={(v) => setSchedule(v ? new Date(v) : null)}
            minDate={new Date()}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button loading={saving} onClick={save}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
};

export default EditPostModal;
