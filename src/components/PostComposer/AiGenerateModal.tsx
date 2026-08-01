/**
 * AI ポスト一括作成モーダル（Phase 9）。虎威の生成機能を流用。
 * キーワードから Gemini でポスト候補を生成し、複数選択して「投稿として作成」する。
 * ※ ユーザーのプロフィールに Gemini API キーが設定されている必要がある。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconSparkles } from '@tabler/icons-react';
import { Button, Card, Checkbox, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  generatePostsThunk,
  resetPostsState,
  selectAllPosts,
  selectPostsLoadingStatus,
  updatePostText,
} from '@/store/reducers/generatedPostsSlice';

interface Props {
  opened: boolean;
  onClose: () => void;
  /** 選択した候補テキストを投稿として作成する */
  onAdopt: (texts: string[]) => void | Promise<void>;
}

const AiGenerateModal = ({ opened, onClose, onAdopt }: Props) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const posts = useAppSelector(selectAllPosts);
  const loading = useAppSelector(selectPostsLoadingStatus);
  const [keyword, setKeyword] = useState('');
  const [adopted, setAdopted] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const adoptedTexts = posts.filter((p) => adopted[p.id]).map((p) => p.text);

  const generate = async () => {
    if (!keyword.trim()) return;
    setAdopted({});
    try {
      await dispatch(generatePostsThunk(keyword)).unwrap();
    } catch (e: any) {
      notifications.show({
        color: 'red',
        message: typeof e === 'string' ? e : e?.message || t('compose.ai.failed'),
      });
    }
  };

  const close = () => {
    dispatch(resetPostsState());
    setKeyword('');
    setAdopted({});
    onClose();
  };

  const adopt = async () => {
    if (adoptedTexts.length === 0) return;
    setSubmitting(true);
    try {
      await onAdopt(adoptedTexts);
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={t('compose.ai.title')} size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          {t('compose.ai.hint')}
        </Text>
        <Group>
          <TextInput
            style={{ flex: 1 }}
            placeholder={t('compose.ai.keywordPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.currentTarget.value)}
            onKeyDown={(e) => {
              // IME 変換確定の Enter（composing 中）では生成しない
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) generate();
            }}
          />
          <Button
            leftSection={<IconSparkles size={16} />}
            loading={loading === 'pending'}
            disabled={!keyword.trim()}
            onClick={generate}
          >
            {t('compose.ai.generate')}
          </Button>
        </Group>

        {posts.map((p) => (
          <Card key={p.id} withBorder padding="sm" radius="sm">
            <Group align="flex-start" wrap="nowrap">
              <Checkbox
                checked={Boolean(adopted[p.id])}
                onChange={(e) => {
                  // updater 内で e.currentTarget を参照すると null になるため同期的に取得
                  const checked = e.currentTarget.checked;
                  setAdopted((a) => ({ ...a, [p.id]: checked }));
                }}
                mt={8}
              />
              <Textarea
                style={{ flex: 1 }}
                autosize
                minRows={2}
                maxRows={10}
                value={p.text}
                onChange={(e) =>
                  dispatch(updatePostText({ id: p.id, newText: e.currentTarget.value }))
                }
              />
            </Group>
          </Card>
        ))}

        {posts.length > 0 && (
          <Group justify="flex-end">
            <Button loading={submitting} disabled={adoptedTexts.length === 0} onClick={adopt}>
              {t('compose.ai.createSelected', { count: adoptedTexts.length })}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
};

export default AiGenerateModal;
