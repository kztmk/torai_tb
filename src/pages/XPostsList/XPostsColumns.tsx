import dayjs from 'dayjs';
import { IconCalendar } from '@tabler/icons-react';
import { MRT_ColumnDef } from 'mantine-react-table';
import { Badge, Group, Stack, Text } from '@mantine/core';
import type { TFunction } from 'i18next';
import type { ThreadedXPostDataType } from './index';

const getPostLabel = (contents: string | undefined, t: TFunction): string => {
  const text = contents?.trim();
  if (!text) {
    return t('xPosts.noContent');
  }
  return text.length > 28 ? `${text.slice(0, 28)}...` : text;
};

export const getColumns = (t: TFunction): MRT_ColumnDef<ThreadedXPostDataType>[] => [
  {
    accessorKey: 'id',
    header: 'ID',
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
  },
  {
    accessorKey: 'postTo',
    header: t('xPosts.destination'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableHiding: true,
  },

  {
    accessorKey: 'contents',
    header: t('xPosts.post'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableHiding: true,
    Cell: ({ row }) => {
      const post = row.original;
      const hasChildren = Boolean(post.subRows && post.subRows.length > 0);
      const isThreadReply = Boolean(post.inReplyToInternal && !post.threadOrphan);
      const isExternalReply = Boolean(post.inReplyToOnX);
      const isQuote = Boolean(post.quoteId);
      const isOrphan = Boolean(post.threadOrphan);

      return (
        <Stack gap={4}>
          <Group gap="xs" wrap="nowrap">
            {hasChildren && (
              <Badge color="violet" variant="light">
                {t('xPosts.threadCount', { count: post.threadSize ?? 1 })}
              </Badge>
            )}
            {isThreadReply && (
              <Badge color="blue" variant="light">
                {t('xPosts.replyNumber', { count: post.threadIndex ?? row.index + 1 })}
              </Badge>
            )}
            {isExternalReply && (
              <Badge color="cyan" variant="light">
                {t('xPosts.reply')}
              </Badge>
            )}
            {isQuote && (
              <Badge color="teal" variant="light">
                {t('xPosts.quote')}
              </Badge>
            )}
            {isOrphan && (
              <Badge color="red" variant="light">
                {t('xPosts.parentUnknown')}
              </Badge>
            )}
            {!hasChildren && !isThreadReply && !isExternalReply && !isQuote && !isOrphan && (
              <Badge color="gray" variant="light">
                {t('xPosts.standalone')}
              </Badge>
            )}
          </Group>
          <Text size="sm" fw={isThreadReply || isExternalReply || isQuote ? 500 : 600}>
            {post.contents || t('xPosts.noContent')}
          </Text>
        </Stack>
      );
    },
  },
  {
    accessorKey: 'mediaUrls',
    header: t('xPosts.media'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableHiding: true,
    Cell: ({ row }) => {
      if (!row.original.mediaUrls) {
        return <Badge color="green">{t('xPosts.noMedia')}</Badge>;
      }

      try {
        const mediaStr = row.original.mediaUrls;
        if (typeof mediaStr !== 'string' || mediaStr === '') {
          return <Badge color="green">{t('xPosts.noMedia')}</Badge>;
        }

        const images = JSON.parse(mediaStr);
        if (!Array.isArray(images) || images.length === 0) {
          return <Badge color="green">{t('xPosts.noMedia')}</Badge>;
        }

        return (
          <div style={{ display: 'flex', gap: '4px' }}>
            {images.map((image, index) => (
              <span key={index} title={image.fileName || t('xPosts.imageNumber', { count: index + 1 })}>
                🌟
              </span>
            ))}
          </div>
        );
      } catch (error) {
        console.error('Media parse error:', error);
        return <Badge color="red">{t('xPosts.invalidMedia')}</Badge>;
      }
    },
  },
  {
    accessorKey: 'postSchedule',
    header: t('xPosts.scheduledAt'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableHiding: true,

    Cell: ({ row }) => {
      const postTime = row.original.postSchedule;
      if (postTime && postTime.length > 0) {
        let formattedTime = '';
        try {
          formattedTime = dayjs(row.original.postSchedule).format('YYYY/MM/DD HH:mm');
          return (
            <Badge leftSection={<IconCalendar size={14} />} color="green">
              {formattedTime}
            </Badge>
          );
        } catch (error) {
          console.error('Error formatting date:', error);
          return 'Invalid Date';
        }
      } else {
        return <Badge color="gray">{t('xPosts.notScheduled')}</Badge>;
      }
    },
  },
  {
    accessorKey: 'inReplyToInternal',
    header: t('xPosts.replyTo'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableHiding: true,
    Cell: ({ row }) => {
      const post = row.original;
      if (post.threadOrphan) {
        return <Badge color="red">{t('xPosts.parentUnknown')}</Badge>;
      }
      if (!post.inReplyToInternal) {
        return <Badge color="gray">-</Badge>;
      }
      return (
        <Stack gap={2}>
          <Badge color="blue" variant="light">
            {t('xPosts.replyToParent')}
          </Badge>
          <Text size="xs" c="dimmed">
            {getPostLabel(post.threadParentLabel, t)}
          </Text>
        </Stack>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: t('xPosts.createdAt'),
    mantineTableHeadCellProps: {
      align: 'center',
    },
    mantineTableBodyCellProps: {
      align: 'left',
    },
    enableHiding: true,
    Cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      if (createdAt && createdAt.length > 0) {
        let formattedTime = '';
        try {
          formattedTime = dayjs(row.original.createdAt).format('YYYY/MM/DD HH:mm');
          return (
            <Badge color="blue" variant="dot">
              {formattedTime}
            </Badge>
          );
        } catch (error) {
          console.error('Error formatting date:', error);
          return <Badge color="red">{t('xPosts.invalidDate')}</Badge>;
        }
      } else {
        return <Badge color="gray">{t('xPosts.none')}</Badge>;
      }
    },
  },
];
