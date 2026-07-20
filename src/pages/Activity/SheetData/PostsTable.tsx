import { useMemo } from 'react';
import { IconCalendar, IconId, IconUser } from '@tabler/icons-react';
import { MantineReactTable, MRT_ColumnDef } from 'mantine-react-table';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { useTranslation } from 'react-i18next';
import { Badge, Box, Tooltip } from '@mantine/core';
import { XPostDataType } from '@/types/xAccounts';

interface PostsTableProps {
  data: XPostDataType[];
  isLoading: boolean;
}

/**
 * 投稿予定データテーブルコンポーネント
 */
const PostsTable = ({ data, isLoading }: PostsTableProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  // テーブルのカラム定義
  const columns = useMemo<MRT_ColumnDef<XPostDataType>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        enableSorting: true,
        enableColumnFilter: false,
        Cell: ({ cell }) => (
          <Tooltip label={`ID: ${cell.getValue<string>()}`}>
            <Badge leftSection={<IconId size={14} />} color="gray" variant="outline">
              {cell.getValue<string>().substring(0, 8)}...
            </Badge>
          </Tooltip>
        ),
      },
      {
        accessorKey: 'postTo',
        header: t('activity.sheet.account'),
        size: 150,
        enableSorting: true,
        Cell: ({ cell }) => (
          <Badge leftSection={<IconUser size={14} />} color="blue" variant="light">
            {cell.getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: 'contents',
        header: t('activity.sheet.postContent'),
        size: 300,
        enableSorting: true,
        Cell: ({ cell }) => (
          <Box style={{ maxWidth: '300px', overflowWrap: 'break-word' }}>
            {cell.getValue<string>()}
          </Box>
        ),
      },
      {
        accessorKey: 'postSchedule',
        header: t('activity.sheet.scheduledAt'),
        size: 180,
        enableSorting: true,
        sortingFn: 'datetime',
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value ? (
            <Badge leftSection={<IconCalendar size={14} />} color="green">
              {new Date(value).toLocaleString(locale)}
            </Badge>
          ) : (
            <Badge color="gray">{t('common.notConfigured')}</Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('activity.sheet.createdAt'),
        size: 180,
        enableSorting: true,
        sortingFn: 'datetime',
        Cell: ({ cell }) => (
          <Box>
            {cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString(locale) : '-'}
          </Box>
        ),
      },
      {
        accessorKey: 'inReplyToInternal',
        header: t('activity.sheet.replyTo'),
        size: 150,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value ? (
            <Badge color="blue" variant="dot">
              {value.substring(0, 8)}...
            </Badge>
          ) : (
            '-'
          );
        },
      },
    ],
    [locale, t]
  );

  return (
    <MantineReactTable
      columns={columns}
      data={data}
      enableColumnFilterModes
      enableColumnOrdering
      enableGlobalFilter
      enablePagination
      enableSorting
      enableBottomToolbar
      enableTopToolbar
      localization={i18n.resolvedLanguage === 'ja' ? MRT_Localization_JA : MRT_Localization_EN}
      initialState={{
        density: 'xs',
        showColumnFilters: false,
        sorting: [{ id: 'postSchedule', desc: false }],
        pagination: { pageSize: 10, pageIndex: 0 },
        columnVisibility: { id: false },
      }}
      mantineTableProps={{
        withTableBorder: true,
        withColumnBorders: true,
        highlightOnHover: true,
        striped: true,
      }}
      state={{
        isLoading,
      }}
    />
  );
};

export default PostsTable;
