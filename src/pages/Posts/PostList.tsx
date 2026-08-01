/**
 * 予約・キュー投稿の一覧（Phase 9 成果物3a/3b）。
 * Mantine React Table で、スレッド（inReplyTo）を subRows のツリーとしてインデント展開表示。
 * ツールバー:
 *  - 新規投稿作成（コンポーザーをモーダル表示）
 *  - 選択行に対する一括削除 / 一括投稿日時設定 / 一括投稿日時削除 / スレッド作成
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  IconArrowDown,
  IconArrowsSplit2,
  IconArrowUp,
  IconCalendar,
  IconCalendarClock,
  IconCalendarX,
  IconDots,
  IconEdit,
  IconMessages,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconUnlink,
} from '@tabler/icons-react';
import {
  MantineReactTable,
  type MRT_ColumnDef,
  type MRT_RowSelectionState,
  useMantineReactTable,
} from 'mantine-react-table';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  Modal,
  NumberInput,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import AiGenerateModal from '@/components/PostComposer/AiGenerateModal';
import PostComposer from '@/components/PostComposer';
import EditPostModal from './EditPostModal';
import { useAppDispatch } from '@/hooks/rtkhooks';
import {
  createPosts,
  deletePost,
  fetchPostLists,
  updatePostSchedule,
  updatePostsInReplyTo,
} from '@/store/reducers/postsSlice';
import type { Platform } from '@/types/accounts';
import type { PostRow } from '@/types/posts';

interface PostNode extends PostRow {
  subRows?: PostNode[];
}

const buildTree = (posts: PostRow[]): PostNode[] => {
  const byId = new Map<string, PostNode>();
  posts.forEach((p) => byId.set(p.id, { ...p, subRows: [] }));
  const roots: PostNode[] = [];
  byId.forEach((node) => {
    const parent = node.inReplyTo ? byId.get(node.inReplyTo) : undefined;
    if (parent) parent.subRows!.push(node);
    else roots.push(node);
  });
  byId.forEach((n) => {
    if (n.subRows && n.subRows.length === 0) n.subRows = undefined;
  });
  return roots;
};

const imageCount = (mediaUrls: string): number => {
  try {
    const arr = JSON.parse(mediaUrls || '[]');
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
};

interface Props {
  platform: Platform;
  accountId: string;
  posts: PostRow[];
}

const PostList = ({ platform, accountId, posts }: Props) => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [composerOpen, composer] = useDisclosure(false);
  const [scheduleOpen, scheduleModal] = useDisclosure(false);
  const [threadOpen, threadModal] = useDisclosure(false);
  const [aiOpen, aiModal] = useDisclosure(false);
  const [threadItems, setThreadItems] = useState<PostRow[]>([]);
  const [editingPost, setEditingPost] = useState<PostRow | null>(null);
  const [busy, setBusy] = useState(false);
  // 配分スケジュール
  const [distStart, setDistStart] = useState<Date | null>(null);
  const [distEnd, setDistEnd] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('21:00');
  const [distInterval, setDistInterval] = useState<number | string>(60);

  const flat = useMemo(
    () => posts.filter((p) => p.platform === platform && p.accountId === accountId),
    [posts, platform, accountId]
  );
  const data = useMemo(() => buildTree(flat), [flat]);

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const selectedPosts = flat.filter((p) => selectedIds.includes(p.id));
  const selectedCount = selectedPosts.length;

  const refresh = () => {
    setRowSelection({});
    dispatch(fetchPostLists());
  };

  const confirmDelete = (post: PostRow) =>
    modals.openConfirmModal({
      title: t('postList.deleteTitle'),
      children: <Text size="sm">{t('postList.deleteConfirm')}</Text>,
      labels: { confirm: t('accounts.delete'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await dispatch(deletePost(post.id)).unwrap();
          notifications.show({ color: 'green', message: t('postList.deleted') });
        } catch (error: any) {
          notifications.show({ color: 'red', message: error?.message || t('postList.deleteFailed') });
        }
      },
    });

  const bulkDelete = () =>
    modals.openConfirmModal({
      title: t('postList.bulkDeleteTitle'),
      children: <Text size="sm">{t('postList.bulkDeleteConfirm', { count: selectedCount })}</Text>,
      labels: { confirm: t('accounts.delete'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setBusy(true);
        try {
          await Promise.all(selectedIds.map((id) => dispatch(deletePost(id)).unwrap()));
          notifications.show({ color: 'green', message: t('postList.deleted') });
          refresh();
        } catch (error: any) {
          notifications.show({ color: 'red', message: error?.message || t('postList.deleteFailed') });
        } finally {
          setBusy(false);
        }
      },
    });

  const applySchedule = async (updates: { id: string; postSchedule: string }[]) => {
    setBusy(true);
    try {
      await dispatch(updatePostSchedule(updates)).unwrap();
      notifications.show({ color: 'green', message: t('postList.scheduleUpdated') });
      scheduleModal.close();
      refresh();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('postList.scheduleFailed') });
    } finally {
      setBusy(false);
    }
  };

  // 選択投稿を「期間・時間帯・間隔」で時系列スロットに順に割り当てる
  const distribute = async () => {
    if (!distStart) return;
    const step = Number(distInterval);
    if (!step || step <= 0) {
      notifications.show({ color: 'red', message: t('postList.dist.invalidInterval') });
      return;
    }
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const endDay = distEnd || distStart;
    const slots: Date[] = [];
    const day = new Date(distStart);
    day.setHours(0, 0, 0, 0);
    const last = new Date(endDay);
    last.setHours(0, 0, 0, 0);
    let guard = 0;
    while (day <= last && slots.length < selectedCount && guard < 3660) {
      const dayStart = new Date(day);
      dayStart.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(eh, em, 0, 0);
      for (
        let ms = dayStart.getTime();
        ms <= dayEnd.getTime() && slots.length < selectedCount;
        ms += step * 60000
      ) {
        slots.push(new Date(ms));
      }
      day.setDate(day.getDate() + 1);
      guard += 1;
    }
    if (slots.length === 0) {
      notifications.show({ color: 'red', message: t('postList.dist.noSlots') });
      return;
    }
    // 表示順の選択投稿に、時系列スロットを順に割り当て
    const updates = selectedPosts
      .slice(0, slots.length)
      .map((p, i) => ({ id: p.id, postSchedule: slots[i].toISOString() }));
    if (slots.length < selectedCount) {
      notifications.show({
        color: 'yellow',
        message: t('postList.dist.partial', { assigned: slots.length, total: selectedCount }),
      });
    }
    await applySchedule(updates);
  };

  // AI 生成した複数候補を、このアカウントの投稿として一括作成
  const aiCreate = async (texts: string[]) => {
    const inputs = texts.map((text) => ({
      platform,
      accountId,
      contents: text,
      postSchedule: '',
    }));
    try {
      await dispatch(createPosts(inputs)).unwrap();
      notifications.show({ color: 'green', message: t('postList.aiCreated', { count: inputs.length }) });
      refresh();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('compose.ai.failed') });
    }
  };

  const clearSchedule = () =>
    modals.openConfirmModal({
      title: t('postList.clearScheduleTitle'),
      children: <Text size="sm">{t('postList.clearScheduleConfirm', { count: selectedCount })}</Text>,
      labels: { confirm: t('common.save'), cancel: t('common.cancel') },
      onConfirm: () => applySchedule(selectedIds.map((id) => ({ id, postSchedule: '' }))),
    });

  const openThread = () => {
    setThreadItems(selectedPosts);
    threadModal.open();
  };

  // このアカウントの投稿の中で post がスレッドの一部か（親を持つ or 子を持つ）
  const isInThread = (post: PostRow) =>
    Boolean(post.inReplyTo) || flat.some((p) => p.inReplyTo === post.id);

  // 連結成分（同一スレッド）の全 id を集める
  const collectThreadIds = (startId: string): string[] => {
    const byId = new Map(flat.map((p) => [p.id, p] as const));
    const ids = new Set<string>([startId]);
    // 親をたどってルートへ
    let root = byId.get(startId);
    let guard = 0;
    while (root && root.inReplyTo && byId.has(root.inReplyTo) && guard < 200) {
      root = byId.get(root.inReplyTo);
      if (root) ids.add(root.id);
      guard += 1;
    }
    // ルート配下の子孫を全収集
    const stack = root ? [root.id] : [startId];
    while (stack.length) {
      const id = stack.pop()!;
      flat
        .filter((p) => p.inReplyTo === id)
        .forEach((c) => {
          if (!ids.has(c.id)) {
            ids.add(c.id);
            stack.push(c.id);
          }
        });
    }
    return [...ids];
  };

  // 1件だけスレッドから外す（子は元の親へ繋ぎ直してスレッドを維持）
  const detachFromThread = async (post: PostRow) => {
    const children = flat.filter((p) => p.inReplyTo === post.id);
    const updates = [
      { id: post.id, inReplyTo: '' },
      ...children.map((c) => ({ id: c.id, inReplyTo: post.inReplyTo || '' })),
    ];
    try {
      await dispatch(updatePostsInReplyTo(updates)).unwrap();
      notifications.show({ color: 'green', message: t('postList.detached') });
      refresh();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('postList.threadFailed') });
    }
  };

  // スレッド全体を解除（全メンバーを単独投稿にする）
  const releaseThread = (post: PostRow) => {
    const ids = collectThreadIds(post.id);
    modals.openConfirmModal({
      title: t('postList.releaseTitle'),
      children: <Text size="sm">{t('postList.releaseConfirm', { count: ids.length })}</Text>,
      labels: { confirm: t('postList.release'), cancel: t('common.cancel') },
      onConfirm: async () => {
        try {
          await dispatch(updatePostsInReplyTo(ids.map((id) => ({ id, inReplyTo: '' })))).unwrap();
          notifications.show({ color: 'green', message: t('postList.released', { count: ids.length }) });
          refresh();
        } catch (error: any) {
          notifications.show({ color: 'red', message: error?.message || t('postList.threadFailed') });
        }
      },
    });
  };

  const moveThreadItem = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= threadItems.length) return;
    setThreadItems((items) => {
      const next = [...items];
      const [it] = next.splice(index, 1);
      next.splice(to, 0, it);
      return next;
    });
  };

  const createThread = async () => {
    if (threadItems.length < 2) return;
    setBusy(true);
    try {
      const updates = threadItems.map((item, i) => ({
        id: item.id,
        inReplyTo: i === 0 ? '' : threadItems[i - 1].id,
      }));
      await dispatch(updatePostsInReplyTo(updates)).unwrap();
      notifications.show({ color: 'green', message: t('postList.threadCreated') });
      threadModal.close();
      refresh();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error?.message || t('postList.threadFailed') });
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<PostNode>[]>(
    () => [
      {
        accessorKey: 'contents',
        header: t('postList.col.contents'),
        size: 340,
        Cell: ({ row }) => {
          const post = row.original;
          const hasChildren = Boolean(post.subRows && post.subRows.length > 0);
          const isReply = Boolean(post.inReplyTo);
          return (
            <Stack gap={4}>
              <Group gap="xs" wrap="nowrap">
                {hasChildren && (
                  <Badge color="violet" variant="light">
                    {t('postList.badge.thread', { count: (post.subRows?.length ?? 0) + 1 })}
                  </Badge>
                )}
                {isReply && (
                  <Badge color="blue" variant="light">
                    {t('postList.badge.reply')}
                  </Badge>
                )}
                {!hasChildren && !isReply && (
                  <Badge color="gray" variant="light">
                    {t('postList.badge.standalone')}
                  </Badge>
                )}
              </Group>
              <Text size="sm" lineClamp={2} style={{ whiteSpace: 'pre-wrap' }}>
                {post.contents || t('postList.noContent')}
              </Text>
            </Stack>
          );
        },
      },
      {
        accessorKey: 'mediaUrls',
        header: t('postList.col.images'),
        size: 110,
        Cell: ({ row }) => {
          const n = imageCount(row.original.mediaUrls);
          return n > 0 ? (
            <Badge color="teal" variant="light">
              {t('postList.badge.images', { count: n })}
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              {t('postList.badge.noImage')}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'postSchedule',
        header: t('postList.col.schedule'),
        size: 190,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          return v ? (
            <Badge color="green" leftSection={<IconCalendar size={12} />}>
              {dayjs(v).format('YYYY/MM/DD HH:mm')}
            </Badge>
          ) : (
            <Badge color="gray">{t('postList.badge.notScheduled')}</Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('postList.col.createdAt'),
        size: 170,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          return v ? (
            <Badge color="blue" variant="dot">
              {dayjs(v).format('YYYY/MM/DD HH:mm')}
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              -
            </Badge>
          );
        },
      },
      {
        accessorKey: 'errorMessage',
        header: t('postList.col.error'),
        size: 200,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          return v ? (
            <Text size="xs" c="red" lineClamp={2}>
              {v}
            </Text>
          ) : null;
        },
      },
    ],
    [t]
  );

  const table = useMantineReactTable({
    columns,
    data,
    enableExpanding: true,
    enableRowSelection: true,
    enableFullScreenToggle: false,
    enableColumnActions: false,
    enableGlobalFilter: true,
    getRowId: (row) => row.id,
    getSubRows: (row) => (row.subRows && row.subRows.length > 0 ? row.subRows : undefined),
    initialState: { expanded: true, density: 'xs', showGlobalFilter: true },
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowActions: true,
    positionActionsColumn: 'first',
    // 先頭の表示列（アクション/展開/選択）を最小幅に
    displayColumnDefOptions: {
      'mrt-row-actions': { header: '', size: 88, minSize: 88, grow: false },
      'mrt-row-expand': { size: 40, minSize: 40, maxSize: 40, grow: false },
      'mrt-row-select': { size: 40, minSize: 40, maxSize: 40, grow: false },
    },
    // 行選択時に上部ツールバーがバナーに置き換わってカスタムボタンが隠れるのを防ぐ
    positionToolbarAlertBanner: 'bottom',
    renderRowActions: ({ row }) => (
      <Group gap={2} wrap="nowrap">
        <Tooltip label={t('postList.edit')}>
          <ActionIcon size="sm" variant="subtle" onClick={() => setEditingPost(row.original)} aria-label="edit">
            <IconEdit size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('accounts.delete')}>
          <ActionIcon size="sm" color="red" variant="subtle" onClick={() => confirmDelete(row.original)} aria-label="delete">
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
        {isInThread(row.original) && (
          <Menu withinPortal position="bottom-end">
            <Menu.Target>
              <ActionIcon size="sm" variant="subtle" aria-label="thread actions">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconUnlink size={16} />}
                onClick={() => detachFromThread(row.original)}
              >
                {t('postList.detach')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowsSplit2 size={16} />}
                onClick={() => releaseThread(row.original)}
              >
                {t('postList.release')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    ),
    renderTopToolbarCustomActions: () => (
      <Group gap="xs">
        <Tooltip label={t('postList.newPost')}>
          <ActionIcon size="lg" variant="filled" onClick={composer.open} aria-label="new post">
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('postList.aiCreate')}>
          <ActionIcon size="lg" variant="light" color="grape" onClick={aiModal.open} aria-label="ai create">
            <IconSparkles size={18} />
          </ActionIcon>
        </Tooltip>
        {selectedCount > 0 && (
          <>
            <Divider orientation="vertical" />
            <Badge variant="light">{t('postList.selected', { count: selectedCount })}</Badge>
            <Tooltip label={t('postList.bulkDelete')}>
              <ActionIcon size="lg" color="red" variant="light" onClick={bulkDelete} loading={busy} aria-label="bulk delete">
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('postList.setSchedule')}>
              <ActionIcon size="lg" variant="light" onClick={scheduleModal.open} aria-label="distribute schedule">
                <IconCalendarClock size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('postList.clearSchedule')}>
              <ActionIcon size="lg" variant="light" onClick={clearSchedule} aria-label="clear schedule">
                <IconCalendarX size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={selectedCount < 2 ? t('postList.threadNeedTwo') : t('postList.createThread')}>
              <ActionIcon
                size="lg"
                variant="light"
                onClick={openThread}
                disabled={selectedCount < 2}
                aria-label="create thread"
              >
                <IconMessages size={18} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      </Group>
    ),
    localization: i18n.resolvedLanguage === 'ja' ? MRT_Localization_JA : MRT_Localization_EN,
    mantineTableProps: { striped: true },
  });

  return (
    <>
      <MantineReactTable table={table} />

      {/* 新規投稿作成モーダル */}
      <Modal opened={composerOpen} onClose={composer.close} title={t('postList.newPost')} size="lg">
        <PostComposer
          presetPlatform={platform}
          presetAccountId={accountId}
          onPosted={() => {
            composer.close();
            dispatch(fetchPostLists());
          }}
        />
      </Modal>

      {/* 投稿日時の配分モーダル（期間・時間帯・間隔で選択投稿に順に割当）*/}
      <Modal opened={scheduleOpen} onClose={scheduleModal.close} title={t('postList.dist.title')}>
        <Stack>
          <Text size="sm">{t('postList.dist.hint', { count: selectedCount })}</Text>
          <Group grow>
            <DatePickerInput
              label={t('postList.dist.startDate')}
              value={distStart}
              onChange={(v) => setDistStart(v ? new Date(v) : null)}
              minDate={new Date()}
            />
            <DatePickerInput
              label={t('postList.dist.endDate')}
              value={distEnd}
              onChange={(v) => setDistEnd(v ? new Date(v) : null)}
              minDate={distStart || new Date()}
            />
          </Group>
          <Group grow>
            <TimeInput
              label={t('postList.dist.startTime')}
              value={startTime}
              onChange={(e) => setStartTime(e.currentTarget.value)}
            />
            <TimeInput
              label={t('postList.dist.endTime')}
              value={endTime}
              onChange={(e) => setEndTime(e.currentTarget.value)}
            />
          </Group>
          <NumberInput
            label={t('postList.dist.interval')}
            value={distInterval}
            onChange={setDistInterval}
            min={1}
            step={5}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={scheduleModal.close}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!distStart} loading={busy} onClick={distribute}>
              {t('postList.dist.apply')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* AI 一括作成モーダル */}
      <AiGenerateModal opened={aiOpen} onClose={aiModal.close} onAdopt={aiCreate} />

      {/* 投稿編集モーダル */}
      <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} />

      {/* スレッド作成モーダル（選択投稿を表示順に連鎖） */}
      <Modal opened={threadOpen} onClose={threadModal.close} title={t('postList.createThread')} size="lg">
        <Stack>
          <Text size="sm">{t('postList.threadHint')}</Text>
          {threadItems.map((item, i) => (
            <Group key={item.id} justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <Badge variant="light">{i + 1}</Badge>
                <Text size="sm" lineClamp={1}>
                  {item.contents}
                </Text>
              </Group>
              <Group gap={4} wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  disabled={i === 0}
                  onClick={() => moveThreadItem(i, -1)}
                  aria-label="move up"
                >
                  <IconArrowUp size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  disabled={i === threadItems.length - 1}
                  onClick={() => moveThreadItem(i, 1)}
                  aria-label="move down"
                >
                  <IconArrowDown size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => setThreadItems((items) => items.filter((it) => it.id !== item.id))}
                  aria-label="remove"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
          {threadItems.length < 2 && (
            <Text size="xs" c="red">
              {t('postList.threadNeedTwo')}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={threadModal.close}>
              {t('common.cancel')}
            </Button>
            <Button disabled={threadItems.length < 2} loading={busy} onClick={createThread}>
              {t('postList.createThread')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default PostList;
