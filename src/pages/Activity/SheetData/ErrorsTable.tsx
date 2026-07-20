import { useMemo, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconArchive, // IconArchive をインポート
  IconCalendar,
  IconCheck,
  IconClipboard,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { MantineReactTable, MRT_ColumnDef } from 'mantine-react-table';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { useTranslation } from 'react-i18next';
import {
  ActionIcon,
  Badge,
  Box,
  Button, // Button をインポート
  Code,
  Group,
  Modal,
  Text,
  TypographyStylesProvider,
  UnstyledButton,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks'; // useAppDispatch, useAppSelector をインポート
import { archiveSheet, selectApiStatus } from '@/store/reducers/apiControllerSlice'; // archiveSheet, selectApiStatus をインポート
import { PostError } from '@/types/xAccounts';

interface ErrorTableProps {
  data: PostError[];
  isLoading: boolean;
}

/**
 * エラーデータテーブルコンポーネント
 */
const ErrorTable = ({ data, isLoading }: ErrorTableProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const [selectedError, setSelectedError] = useState<PostError | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const clipboard = useClipboard();
  const errorStackRef = useRef<HTMLDivElement>(null);
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
    const filename = `Errors_Archive_${timestamp}`;
    dispatch(archiveSheet({ target: 'errors', filename }))
      .unwrap() // Promise を取得
      .then((result) => {
        // 成功した場合の通知
        notifications.show({
          title: t('activity.sheet.archiveSuccess'),
          message: t('activity.sheet.archiveSuccessMessage', { sheet: 'Errors', name: result.newName }),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      })
      .catch((error) => {
        // 失敗した場合の通知
        notifications.show({
          title: t('activity.sheet.archiveFailed'),
          message: t('activity.sheet.archiveFailedMessage', { sheet: 'Errors', error: String(error) }),
          color: 'red',
          icon: <IconX size={16} />,
        });
      });
  };

  const copyErrorToClipboard = () => {
    if (selectedError) {
      const errorText = `
Timestamp: ${selectedError.timestamp}
Message: ${selectedError.message}
Stack: ${selectedError.stack || 'N/A'}
Context: ${selectedError.context || 'N/A'}
      `.trim();

      clipboard.copy(errorText);
      notifications.show({
        title: t('activity.sheet.copyComplete'),
        message: t('activity.sheet.errorCopied'),
        color: 'blue',
      });
    }
  };

  // テーブルのカラム定義
  const columns = useMemo<MRT_ColumnDef<PostError>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: t('activity.sheet.occurredAt'),
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
        accessorKey: 'postContent',
        header: t('activity.sheet.postContent'),
        size: 200,
        enableSorting: true,
        Cell: ({ cell }) => (
          <Box style={{ maxWidth: '300px', overflowWrap: 'break-word' }}>
            {cell.getValue<string>()}
          </Box>
        ),
      },
      {
        accessorKey: 'message',
        header: t('activity.sheet.errorMessage'),
        size: 300,
        enableSorting: true,
        Cell: ({ cell, row }) => (
          <UnstyledButton
            style={{
              maxWidth: '300px',
              overflowWrap: 'break-word',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#FA5252',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4px',
            }}
            onClick={() => {
              setSelectedError(row.original);
              setModalOpened(true);
            }}
          >
            <IconAlertTriangle size={16} style={{ marginTop: '3px', flexShrink: 0 }} />
            <Text fw={500}>
              {cell.getValue<string | undefined | null>() // 型を修正
                ? cell.getValue<string>().length > 100 // 存在チェックを追加
                  ? `${cell.getValue<string>().substring(0, 100)}...`
                  : cell.getValue<string>()
                : '-'}{' '}
              {/* 値がない場合の表示 */}
            </Text>
          </UnstyledButton>
        ),
      },
      {
        accessorKey: 'context',
        header: t('activity.sheet.context'),
        size: 180,
        enableSorting: true,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          try {
            // コンテキストがJSON形式であれば解析して表示
            if (value && value.startsWith('{') && value.endsWith('}')) {
              const contextObj = JSON.parse(value);

              // ここで特定のプロパティがあればバッジとして表示
              return (
                <Group gap="xs">
                  {contextObj.accountId && (
                    <Badge leftSection={<IconUser size={14} />} color="blue" variant="light">
                      {contextObj.accountId}
                    </Badge>
                  )}
                  {contextObj.postId && (
                    <Badge color="violet" variant="dot">
                      ID: {contextObj.postId.substring(0, 8)}...
                    </Badge>
                  )}
                  {contextObj.action && (
                    <Badge color="yellow" variant="light">
                      {contextObj.action}
                    </Badge>
                  )}
                </Group>
              );
            }
          } catch (e) {
            // JSON解析に失敗した場合
          }

          // それ以外の場合はシンプルに表示
          return value ? (
            <Text size="sm" c="dimmed" lineClamp={1}>
              {value.length > 30 ? `${value.substring(0, 30)}...` : value}
            </Text>
          ) : (
            '-'
          );
        },
      },
      {
        accessorKey: 'stack',
        header: t('activity.sheet.stackTrace'),
        size: 120,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value ? (
            <Badge color="gray" variant="outline">
              {t('activity.sheet.available')}
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
    <>
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
          sorting: [{ id: 'timestamp', desc: true }],
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
            color="red" // エラーテーブルなので赤色に
          >
            {t('activity.sheet.archiveSheet', { sheet: 'Errors' })}
          </Button>
        )}
      />

      {/* エラー詳細モーダル */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={t('activity.sheet.errorDetails')}
        size="lg"
        styles={{
          title: {
            color: '#FA5252',
            fontWeight: 'bold',
          },
        }}
      >
        {selectedError !== null && (
          <>
            <Group mb="xs">
              <Text fw={500}>{t('activity.sheet.occurredAt')}</Text>
              <ActionIcon
                title={t('activity.sheet.copyToClipboard')}
                onClick={copyErrorToClipboard}
                variant="light"
                color="blue"
              >
                <IconClipboard size={16} />
              </ActionIcon>
            </Group>
            <Text mb="md">{new Date(selectedError.timestamp).toLocaleString(locale)}</Text>

            <Text fw={500} mb="xs">
              {t('activity.sheet.relatedInformation')}
            </Text>

            <Text fw={500} mb="xs" color="red">
              {t('activity.sheet.errorMessage')}
            </Text>
            <Code block mb="md">
              {selectedError.message}
            </Code>

            {selectedError.stack && (
              <>
                <Text fw={500} mb="xs">
                  {t('activity.sheet.stackTrace')}
                </Text>
                <div ref={errorStackRef} style={{ maxHeight: '200px', overflow: 'auto' }}>
                  <Code block style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedError.stack}
                  </Code>
                </div>
              </>
            )}

            {selectedError.context && (
              <>
                <Text fw={500} mt="md" mb="xs">
                  {t('activity.sheet.context')}
                </Text>
                <TypographyStylesProvider>
                  <Box
                    style={{
                      backgroundColor: '#f8f9fa',
                      padding: '10px',
                      borderRadius: '4px',
                      maxHeight: '100px',
                      overflow: 'auto',
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selectedError.context}</pre>
                  </Box>
                </TypographyStylesProvider>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
};

export default ErrorTable;
