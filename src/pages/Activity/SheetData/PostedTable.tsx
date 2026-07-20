import { useMemo } from 'react';
import {
  IconArchive,
  IconBrandX, // IconBrandX をインポート
  IconCalendar,
  IconCheck,
  IconExternalLink,
  IconX,
} from '@tabler/icons-react';
import { MantineReactTable, MRT_ColumnDef } from 'mantine-react-table';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Box, // Box をインポート
  Button,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { archiveSheet, selectApiStatus } from '@/store/reducers/apiControllerSlice';
import { XPostedDataType } from '@/types/xAccounts'; // PostData -> XPostedDataType に変更

interface PostedTableProps {
  data: XPostedDataType[]; // PostData -> XPostedDataType に変更
  isLoading: boolean;
}

/**
 * 投稿済みデータテーブルコンポーネント
 */
const PostedTable = ({ data, isLoading }: PostedTableProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const dispatch = useAppDispatch(); // dispatch を取得
  const apiStatus = useAppSelector(selectApiStatus); // APIステータスを取得

  // アーカイブ処理を実行する関数
  const handleArchive = () => {
    const now = new Date();
    // ISO文字列をベースにファイル名に適した形式に変換
    const timestamp = now
      .toISOString()
      .replace('T', '_') // Tを_に
      .replace(/:/g, '-') // コロンをハイフンに
      .replace(/\.\d+Z$/, ''); // ミリ秒とZを削除
    const filename = `Posted_Archive_${timestamp}`;
    dispatch(archiveSheet({ target: 'posted', filename }))
      .unwrap() // Promise を取得
      .then((result) => {
        // 成功した場合の通知
        notifications.show({
          title: t('activity.sheet.archiveSuccess'),
          message: t('activity.sheet.archiveSuccessMessage', { sheet: 'Posted', name: result.newName }),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      })
      .catch((error) => {
        // 失敗した場合の通知
        notifications.show({
          title: t('activity.sheet.archiveFailed'),
          message: t('activity.sheet.archiveFailedMessage', { sheet: 'Posted', error: String(error) }),
          color: 'red',
          icon: <IconX size={16} />,
        });
      });
  };

  // テーブルのカラム定義
  const columns = useMemo<MRT_ColumnDef<XPostedDataType>[]>( // PostData -> XPostedDataType に変更
    () => [
      {
        accessorKey: 'postedAt', // timestamp -> postedAt に変更 (XPostedDataType に合わせる)
        header: t('activity.sheet.postedAt'),
        size: 180,
        enableSorting: true,
        sortingFn: 'datetime',
        Cell: ({ cell }) => (
          <Badge leftSection={<IconCalendar size={14} />} color="lightcoral" variant="light">
            {cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString(locale) : '-'}
          </Badge>
        ),
      },
      {
        accessorKey: 'postTo', // accountId -> postTo に変更 (XPostedDataType に合わせる)
        header: t('activity.sheet.accountId'),
        size: 150,
        enableSorting: true,
        Cell: ({ cell }) => (
          <Badge leftSection={<IconBrandX size={14} />} color="blue" variant="light">
            {cell.getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: 'postId', // postId -> postedId に変更 (XPostedDataType に合わせる)
        header: t('activity.sheet.postId'),
        size: 150,
        enableSorting: true,
        Cell: ({ cell }) => (
          <Tooltip label={`ID: ${cell.getValue<string>()}`}>
            <Badge>{cell.getValue<string>()?.substring(0, 8)}...</Badge>
          </Tooltip>
        ),
      },
      {
        accessorKey: 'postUrl', // XPostedDataType に postUrl がないため、postedId から生成する例
        header: t('activity.sheet.postUrl'),
        size: 100,
        enableSorting: false,
        Cell: ({ row }) => {
          const postedId = row.original.postId;
          const accountId = row.original.postTo;
          console.log(`Row Data: postedId='${postedId}', accountId(postTo)='${accountId}'`);
          const url =
            postedId && accountId ? `https://x.com/${accountId}/status/${postedId}` : null;
          return url ? (
            <Button
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              size="xs"
              leftSection={<IconExternalLink size={14} />}
            >
              {t('common.open')}
            </Button>
          ) : (
            '-'
          );
        },
      },
      {
        accessorKey: 'postSchedule', // scheduledAt -> postSchedule に変更 (XPostedDataType に合わせる)
        header: t('activity.sheet.scheduledAt'),
        size: 180,
        enableSorting: true,
        sortingFn: 'datetime',
        Cell: ({ cell }) => {
          const dateStr = cell.getValue<string>();
          return dateStr ? (
            <Badge leftSection={<IconCalendar size={14} />} color="teal" variant="light">
              {new Date(dateStr).toLocaleString(locale)}
            </Badge>
          ) : (
            '-'
          );
        },
      },
      {
        accessorKey: 'contents', // status -> contents に変更 (XPostedDataType に合わせる)
        header: t('activity.sheet.content'), // ヘッダー名を変更
        size: 250, // サイズ調整
        enableSorting: false,
        Cell: ({ cell }) => (
          <Box style={{ maxWidth: '250px', overflowWrap: 'break-word' }}>
            <Text lineClamp={2}>{cell.getValue<string>()}</Text>
          </Box>
        ),
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
        sorting: [{ id: 'postedAt', desc: true }],
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
      // ★★★ カスタムツールバーアクションを追加 ★★★
      renderTopToolbarCustomActions={() => (
        <Button
          leftSection={<IconArchive size={16} />}
          onClick={handleArchive}
          loading={apiStatus === 'loading'} // ローディング状態を反映
          variant="light"
          color="blue"
        >
          {t('activity.sheet.archiveSheet', { sheet: 'Posted' })}
        </Button>
      )}
    />
  );
};

export default PostedTable;
