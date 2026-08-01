/**
 * 投稿済み一覧＋エンゲージメント（Phase 9 成果物3a-2）。
 * Posted シート（fetchPostLists で取得）を Mantine React Table で表示。
 * views/likes/replies/reposts/quotes/shares を虎威風のバッジ/アイコンで表示する。
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  IconCalendar,
  IconExternalLink,
  IconEye,
  IconHeart,
  IconMessageCircle,
  IconQuote,
  IconRepeat,
  IconShare3,
} from '@tabler/icons-react';
import {
  MantineReactTable,
  type MRT_ColumnDef,
  useMantineReactTable,
} from 'mantine-react-table';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAppDispatch } from '@/hooks/rtkhooks';
import { getThreadsPermalink } from '@/store/reducers/accountsSlice';
import type { Platform } from '@/types/accounts';
import type { PostedRow } from '@/types/posts';

interface Props {
  platform: Platform;
  accountId: string;
  posted: PostedRow[];
}

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: unknown; label: string }) => (
  <Tooltip label={label}>
    <Group gap={2} wrap="nowrap">
      {icon}
      <Text size="xs">{Number(value) || 0}</Text>
    </Group>
  </Tooltip>
);

/** postId（Bluesky=AT URI）から Web 投稿 URL を構築。Threads は permalink 未保存のため null */
const buildPostUrl = (platform: Platform, postId: string): string | null => {
  if (!postId) return null;
  if (platform === 'bluesky') {
    const m = /^at:\/\/([^/]+)\/[^/]+\/([^/]+)$/.exec(postId);
    return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : null;
  }
  return null;
};

const PostedList = ({ platform, accountId, posted }: Props) => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();

  // Threads は permalink を都度取得して開く。popup-block 回避のため先に空タブを同期で開く。
  const openThreadsPost = async (postId: string) => {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const permalink = await dispatch(getThreadsPermalink({ accountId, postId })).unwrap();
      if (!win) return;
      if (permalink) win.location.href = permalink;
      else {
        win.close();
        notifications.show({ color: 'yellow', message: t('posted.permalinkEmpty') });
      }
    } catch (error: any) {
      win?.close();
      notifications.show({ color: 'red', message: error?.message || t('posted.permalinkFailed') });
    }
  };

  const data = useMemo(
    () => posted.filter((p) => p.platform === platform && p.accountId === accountId),
    [posted, platform, accountId]
  );

  const columns = useMemo<MRT_ColumnDef<PostedRow>[]>(
    () => [
      {
        accessorKey: 'contents',
        header: t('postList.col.contents'),
        size: 300,
        Cell: ({ cell }) => (
          <Text size="sm" lineClamp={2} style={{ whiteSpace: 'pre-wrap' }}>
            {cell.getValue<string>() || t('postList.noContent')}
          </Text>
        ),
      },
      {
        accessorKey: 'postedAt',
        header: t('posted.col.postedAt'),
        size: 180,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          return v ? (
            <Badge color="green" leftSection={<IconCalendar size={12} />}>
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
        id: 'engagement',
        header: t('posted.col.engagement'),
        size: 280,
        Cell: ({ row }) => {
          const p = row.original;
          return (
            <Group gap="md" wrap="nowrap">
              <Stat icon={<IconHeart size={14} />} value={p.likes} label={t('posted.likes')} />
              <Stat
                icon={<IconMessageCircle size={14} />}
                value={p.replies}
                label={t('posted.replies')}
              />
              <Stat icon={<IconRepeat size={14} />} value={p.reposts} label={t('posted.reposts')} />
              <Stat icon={<IconQuote size={14} />} value={p.quotes} label={t('posted.quotes')} />
              {platform === 'threads' && (
                <>
                  <Stat icon={<IconEye size={14} />} value={p.views} label={t('posted.views')} />
                  <Stat
                    icon={<IconShare3 size={14} />}
                    value={p.shares}
                    label={t('posted.shares')}
                  />
                </>
              )}
            </Group>
          );
        },
      },
      {
        accessorKey: 'insightsUpdatedAt',
        header: t('posted.col.insightsUpdatedAt'),
        size: 170,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          return (
            <Text size="xs" c="dimmed">
              {v ? dayjs(v).format('YYYY/MM/DD HH:mm') : '-'}
            </Text>
          );
        },
      },
      {
        accessorKey: 'postId',
        header: t('posted.col.postId'),
        size: 160,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          return v ? (
            <Tooltip label={v}>
              <Badge variant="light" color="gray">
                {v.length > 12 ? `${v.slice(0, 12)}…` : v}
              </Badge>
            </Tooltip>
          ) : null;
        },
      },
      {
        id: 'link',
        header: t('posted.col.link'),
        size: 80,
        Cell: ({ row }) => {
          const { postId } = row.original;
          if (!postId) {
            return (
              <Text size="xs" c="dimmed">
                -
              </Text>
            );
          }
          if (platform === 'threads') {
            return (
              <Tooltip label={t('posted.openPost')}>
                <ActionIcon variant="subtle" onClick={() => openThreadsPost(postId)} aria-label="open post">
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Tooltip>
            );
          }
          const url = buildPostUrl(platform, postId);
          return url ? (
            <Tooltip label={t('posted.openPost')}>
              <ActionIcon
                component="a"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                variant="subtle"
                aria-label="open post"
              >
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Text size="xs" c="dimmed">
              -
            </Text>
          );
        },
      },
    ],
    [t, platform]
  );

  const table = useMantineReactTable({
    columns,
    data,
    enableColumnActions: false,
    enableFullScreenToggle: false,
    enableGlobalFilter: true,
    initialState: { density: 'xs', showGlobalFilter: true },
    localization: i18n.resolvedLanguage === 'ja' ? MRT_Localization_JA : MRT_Localization_EN,
    mantineTableProps: { striped: true },
  });

  return <MantineReactTable table={table} />;
};

export default PostedList;
