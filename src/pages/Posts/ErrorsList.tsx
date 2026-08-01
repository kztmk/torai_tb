/**
 * エラー一覧（Phase 9 成果物3a-2）。
 * Errors シート（fetchPostLists で取得）を Mantine React Table で表示。アプリ全体のエラーログ。
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { IconAlertTriangle } from '@tabler/icons-react';
import {
  MantineReactTable,
  type MRT_ColumnDef,
  useMantineReactTable,
} from 'mantine-react-table';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { Badge, Text, Tooltip } from '@mantine/core';
import type { ErrorRow } from '@/types/posts';

const ErrorsList = ({ errors }: { errors: ErrorRow[] }) => {
  const { t, i18n } = useTranslation();

  const columns = useMemo<MRT_ColumnDef<ErrorRow>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: t('errors.col.timestamp'),
        size: 180,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          return v ? (
            <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={12} />}>
              {dayjs(v).format('YYYY/MM/DD HH:mm')}
            </Badge>
          ) : (
            <Text size="xs" c="dimmed">
              -
            </Text>
          );
        },
      },
      {
        accessorKey: 'context',
        header: t('errors.col.context'),
        size: 160,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || '-'}</Text>
        ),
      },
      {
        accessorKey: 'message',
        header: t('errors.col.message'),
        size: 360,
        Cell: ({ cell }) => (
          <Text size="sm" c="red" style={{ whiteSpace: 'pre-wrap' }}>
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'detail',
        header: t('errors.col.detail'),
        size: 220,
        Cell: ({ cell }) => {
          const v = cell.getValue<string>();
          if (!v) return null;
          return (
            <Tooltip label={v} multiline w={360}>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {v}
              </Text>
            </Tooltip>
          );
        },
      },
    ],
    [t]
  );

  const table = useMantineReactTable({
    columns,
    data: errors,
    enableColumnActions: false,
    enableFullScreenToggle: false,
    enableGlobalFilter: true,
    initialState: { density: 'xs', showGlobalFilter: true },
    localization: i18n.resolvedLanguage === 'ja' ? MRT_Localization_JA : MRT_Localization_EN,
    mantineTableProps: { striped: true },
  });

  return <MantineReactTable table={table} />;
};

export default ErrorsList;
