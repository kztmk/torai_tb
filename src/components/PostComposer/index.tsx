/**
 * 共通投稿コンポーザー（Phase 9 成果物2）。
 * Bluesky / Threads を横断して複数アカウントを選択し、同一内容をクロスポストする。
 * スレッド連投にも対応（「スレッドを追加」で各投稿=セグメントを追加。各セグメントは本文＋画像を持つ）。
 * - アカウント別画面: presetPlatform / presetAccountId でそのアカウントを常に含める
 * - 一括投稿ページ: preset なしで自由に複数選択
 * 送信: createMultiple（アカウント×セグメント）→ セグメントが複数なら updateInReplyTo で連鎖。
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { IconAlertCircle, IconEye, IconPlus, IconSend } from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Image,
  Modal,
  MultiSelect,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { selectAccounts } from '@/store/reducers/accountsSlice';
import { createPosts, selectPosts, updatePostsInReplyTo } from '@/store/reducers/postsSlice';
import type { Platform } from '@/types/accounts';
import type { PostInput } from '@/types/posts';
import { isSegmentOverLimit } from '@/utils/textLimits';
import { type UploadedMedia } from './media';
import SegmentEditor from './SegmentEditor';

interface PostComposerProps {
  presetPlatform?: Platform;
  presetAccountId?: string;
  /** 投稿作成成功時に呼ばれる（モーダルを閉じる・一覧を再取得する等） */
  onPosted?: () => void;
}

interface AccountOption {
  key: string; // `${platform}:${accountId}`
  platform: Platform;
  accountId: string;
  label: string;
}

interface Segment {
  id: string;
  text: string;
  media: UploadedMedia[];
}

const toKey = (platform: Platform, accountId: string) => `${platform}:${accountId}`;
const newSegment = (): Segment => ({ id: crypto.randomUUID(), text: '', media: [] });

// ---- 下書き（localStorage 自動保存）----
const draftKeyFor = (presetKey: string | null) => `tb-torai:composer-draft:${presetKey || 'bulk'}`;

interface DraftShape {
  segments: { id: string; text: string; media: { fileId: string; url: string; name: string }[] }[];
  schedule: string | null;
}

const loadDraft = (key: string): { segments: Segment[]; schedule: Date | null } | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as DraftShape;
    if (!d?.segments?.length) return null;
    return {
      segments: d.segments.map((s) => ({
        id: s.id || crypto.randomUUID(),
        text: s.text || '',
        // 復元時は Drive 公開 URL をプレビューにも使う（objectURL はリロードで無効なため）
        media: (s.media || []).map((m) => ({
          fileId: m.fileId,
          url: m.url,
          preview: m.url,
          name: m.name,
        })),
      })),
      schedule: d.schedule ? new Date(d.schedule) : null,
    };
  } catch {
    return null;
  }
};

const PostComposer = ({ presetPlatform, presetAccountId, onPosted }: PostComposerProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { bluesky, threads } = useAppSelector(selectAccounts);
  const { creating } = useAppSelector(selectPosts);

  const blueskyOptions: AccountOption[] = useMemo(
    () =>
      bluesky.map((a) => ({
        key: toKey('bluesky', a.accountId),
        platform: 'bluesky',
        accountId: a.accountId,
        label: a.displayName || `@${a.accountId}`,
      })),
    [bluesky]
  );
  const threadsOptions: AccountOption[] = useMemo(
    () =>
      threads.map((a) => ({
        key: toKey('threads', a.accountId),
        platform: 'threads',
        accountId: a.accountId,
        label: a.displayName || `@${a.accountId}`,
      })),
    [threads]
  );

  const accountData = useMemo(() => {
    const groups: { group: string; items: { value: string; label: string }[] }[] = [];
    if (blueskyOptions.length > 0) {
      groups.push({
        group: 'Bluesky',
        items: blueskyOptions.map((o) => ({ value: o.key, label: o.label })),
      });
    }
    if (threadsOptions.length > 0) {
      groups.push({
        group: 'Threads',
        items: threadsOptions.map((o) => ({ value: o.key, label: o.label })),
      });
    }
    return groups;
  }, [blueskyOptions, threadsOptions]);

  // アカウント別画面の場合、この投稿先は常に選択に含める（解除・全クリア不可）
  const presetKey = presetPlatform && presetAccountId ? toKey(presetPlatform, presetAccountId) : null;
  const draftKey = draftKeyFor(presetKey);

  const [selected, setSelected] = useState<string[]>(presetKey ? [presetKey] : []);
  const [segments, setSegments] = useState<Segment[]>(() => loadDraft(draftKey)?.segments ?? [newSegment()]);
  const [schedule, setSchedule] = useState<Date | null>(() => loadDraft(draftKey)?.schedule ?? null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (presetKey) {
      setSelected([presetKey]);
    }
  }, [presetKey]);

  // 下書きの自動保存
  useEffect(() => {
    const isEmpty = segments.every((s) => !s.text.trim() && s.media.length === 0) && !schedule;
    if (isEmpty) {
      localStorage.removeItem(draftKey);
      return;
    }
    const draft: DraftShape = {
      segments: segments.map((s) => ({
        id: s.id,
        text: s.text,
        media: s.media.map((m) => ({ fileId: m.fileId, url: m.url, name: m.name })),
      })),
      schedule: schedule ? schedule.toISOString() : null,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [segments, schedule, draftKey]);

  const hasDraftContent = segments.some((s) => s.text.trim() || s.media.length > 0) || Boolean(schedule);

  const discardDraft = () => {
    segments.forEach((s) =>
      s.media.forEach((m) => m.preview.startsWith('blob:') && URL.revokeObjectURL(m.preview))
    );
    setSegments([newSegment()]);
    setSchedule(null);
    localStorage.removeItem(draftKey);
  };

  const handleSelectChange = (values: string[]) => {
    if (presetKey && !values.includes(presetKey)) {
      setSelected([presetKey, ...values]);
    } else {
      setSelected(values);
    }
  };

  const hasBluesky = selected.some((k) => k.startsWith('bluesky:'));
  const hasThreads = selected.some((k) => k.startsWith('threads:'));
  const isThread = segments.length > 1;

  const selectedLabels = useMemo(() => {
    const options = [...blueskyOptions, ...threadsOptions];
    return selected
      .map((key) => options.find((o) => o.key === key))
      .filter((o): o is AccountOption => Boolean(o))
      .map((o) => ({ key: o.key, platform: o.platform, label: o.label }));
  }, [selected, blueskyOptions, threadsOptions]);

  const updateSegment = (id: string, patch: Partial<Segment>) =>
    setSegments((segs) => segs.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addSegment = () => setSegments((segs) => [...segs, newSegment()]);

  const removeSegment = (id: string) =>
    setSegments((segs) => {
      const target = segs.find((s) => s.id === id);
      target?.media.forEach((m) => URL.revokeObjectURL(m.preview));
      return segs.filter((s) => s.id !== id);
    });

  const revokeAllPreviews = () =>
    segments.forEach((s) => s.media.forEach((m) => URL.revokeObjectURL(m.preview)));

  const segmentsValid = segments.every(
    (s) => s.text.trim() !== '' && !isSegmentOverLimit(s.text, hasBluesky, hasThreads)
  );
  const canSubmit = selected.length > 0 && segmentsValid && !creating;

  const handleSubmit = async () => {
    const options = [...blueskyOptions, ...threadsOptions];
    const accounts = selected
      .map((key) => options.find((o) => o.key === key))
      .filter((o): o is AccountOption => Boolean(o));

    if (accounts.length === 0) return;

    // アカウントごとにセグメント順で並べる（返り値の順序と一致させる）
    const inputs: PostInput[] = [];
    accounts.forEach((acct) => {
      segments.forEach((seg) => {
        inputs.push({
          platform: acct.platform,
          accountId: acct.accountId,
          contents: seg.text,
          postSchedule: schedule ? schedule.toISOString() : '',
          ...(seg.media.length > 0 ? { mediaUrls: seg.media.map((m) => m.url) } : {}),
        });
      });
    });

    try {
      const rows = await dispatch(createPosts(inputs)).unwrap();

      // スレッド連投: 各アカウント内で k 番目 → k-1 番目に返信
      if (isThread) {
        const s = segments.length;
        const updates: { id: string; inReplyTo: string }[] = [];
        accounts.forEach((_, ai) => {
          for (let k = 1; k < s; k += 1) {
            const child = rows[ai * s + k];
            const parent = rows[ai * s + k - 1];
            if (child && parent) updates.push({ id: child.id, inReplyTo: parent.id });
          }
        });
        if (updates.length > 0) {
          await dispatch(updatePostsInReplyTo(updates)).unwrap();
        }
      }

      notifications.show({
        color: 'green',
        message: t('compose.success', { count: inputs.length }),
      });
      revokeAllPreviews();
      setSegments([newSegment()]);
      setSchedule(null);
      setSelected(presetKey ? [presetKey] : []);
      onPosted?.();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('compose.failed') });
    }
  };

  const hasAnyAccount = blueskyOptions.length + threadsOptions.length > 0;

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Title order={3}>{t('compose.title')}</Title>

        {/* 投稿先アカウント選択（チェックボックス付きマルチセレクト） */}
        {!hasAnyAccount ? (
          <div>
            <Text fw={500} size="sm" mb="xs">
              {t('compose.selectAccounts')}
            </Text>
            <Text c="dimmed" size="sm">
              {t('compose.noAccounts')}
            </Text>
          </div>
        ) : (
          <MultiSelect
            label={t('compose.selectAccounts')}
            placeholder={selected.length === 0 ? t('compose.selectAccountsPlaceholder') : undefined}
            data={accountData}
            value={selected}
            onChange={handleSelectChange}
            searchable
            clearable
            hidePickedOptions={false}
            maxDropdownHeight={300}
            nothingFoundMessage={t('compose.noMatch')}
            renderOption={({ option, checked }) => (
              <Group gap="sm" wrap="nowrap">
                <Checkbox checked={Boolean(checked)} readOnly tabIndex={-1} aria-hidden />
                <span>{option.label}</span>
              </Group>
            )}
          />
        )}

        {/* セグメント（スレッド連投は複数） */}
        {segments.map((seg, index) => (
          <div key={seg.id}>
            <SegmentEditor
              index={index}
              isThread={isThread}
              text={seg.text}
              media={seg.media}
              hasBluesky={hasBluesky}
              hasThreads={hasThreads}
              onTextChange={(text) => updateSegment(seg.id, { text })}
              onMediaChange={(media) => updateSegment(seg.id, { media })}
              onRemoveSegment={isThread ? () => removeSegment(seg.id) : undefined}
            />
            {isThread && index < segments.length - 1 && <Divider my="md" variant="dashed" />}
          </div>
        ))}

        <Group justify="space-between">
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={addSegment}
            size="xs"
          >
            {t('compose.addThread')}
          </Button>
          {hasDraftContent && (
            <Button variant="subtle" color="gray" size="xs" onClick={discardDraft}>
              {t('compose.draft.discard')}
            </Button>
          )}
        </Group>

        {/* 予約日時 */}
        <DateTimePicker
          label={t('compose.schedule')}
          description={t('compose.scheduleHint')}
          placeholder={t('compose.immediate')}
          clearable
          value={schedule}
          onChange={(value) => setSchedule(value ? new Date(value) : null)}
          minDate={new Date()}
        />

        {!segmentsValid && selected.length > 0 && (
          <Alert color="gray" variant="light" icon={<IconAlertCircle />}>
            {t('compose.needAllSegments')}
          </Alert>
        )}

        <Group justify="space-between">
          <Button
            variant="default"
            leftSection={<IconEye size={16} />}
            onClick={() => setPreviewOpen(true)}
            disabled={selected.length === 0}
          >
            {t('compose.preview.button')}
          </Button>
          <Button
            leftSection={<IconSend size={16} />}
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={creating}
          >
            {schedule ? t('compose.submitScheduled') : isThread ? t('compose.submitThread') : t('compose.submit')}
          </Button>
        </Group>
      </Stack>

      <Modal
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t('compose.preview.title')}
        size="lg"
      >
        <Stack>
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              {t('compose.preview.targets')}
            </Text>
            <Group gap="xs">
              {selectedLabels.map((l) => (
                <Badge key={l.key} color={l.platform === 'threads' ? 'grape' : 'blue'} variant="light">
                  {l.label}
                </Badge>
              ))}
            </Group>
          </div>
          {segments.map((seg, i) => (
            <Card key={seg.id} withBorder radius="sm" padding="sm">
              {isThread && (
                <Text size="xs" c="dimmed" mb={4}>
                  {t('compose.threadPart', { index: i + 1 })}
                </Text>
              )}
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {seg.text || t('compose.preview.empty')}
              </Text>
              {seg.media.length > 0 && (
                <Group gap="xs" mt="xs">
                  {seg.media.map((m) => (
                    <Image key={m.fileId} src={m.preview} w={80} h={80} fit="cover" radius="sm" />
                  ))}
                </Group>
              )}
            </Card>
          ))}
          <Text size="xs" c="dimmed">
            {schedule
              ? t('compose.preview.scheduled', { time: dayjs(schedule).format('YYYY-MM-DD HH:mm') })
              : t('compose.immediate')}
          </Text>
        </Stack>
      </Modal>
    </Card>
  );
};

export default PostComposer;
