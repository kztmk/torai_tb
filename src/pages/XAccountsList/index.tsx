import { useEffect, useState } from 'react';
import {
  MantineReactTable,
  MRT_ShowHideColumnsButton,
  MRT_ToggleDensePaddingButton,
  MRT_ToggleFiltersButton,
  MRT_ToggleGlobalFilterButton,
  MRT_Updater,
  MRT_VisibilityState,
  useMantineReactTable,
  type MRT_Row,
  type MRT_TableInstance,
} from 'mantine-react-table';
// 修正: v2.0 ベータ版での正しいロケールのインポート
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';

import 'mantine-react-table/styles.css';

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconEdit,
  IconFileArrowRight,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { download, generateCsv, mkConfig } from 'export-to-csv';
import { ActionIcon, Alert, Box, Button, Group, Modal, Paper, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { deleteXAccount, fetchXAccounts } from '@/store/reducers/xAccountsSlice';
import { deleteMultiple, fetchXPosts } from '@/store/reducers/xPostsSlice';
import type { XAccount } from '@/types/xAccounts';
import { getColumns } from './XAccountColumn';
import XAccountForm from './XAccountForm';

const XAccountsListTable = () => {
  const { t, i18n } = useTranslation();
  const columns = getColumns(t);
  const { googleSheetUrl } = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();

  const { isLoading, xAccountList } = useAppSelector((state) => state.xAccounts);
  const { xPostList } = useAppSelector((state) => state.xPosts);
  const [columnVisibility, setColumnVisibility] = useState<MRT_VisibilityState>({
    id: false,
    name: true,
    note: true,
  });

  // モーダル制御用のフック
  const [isDeleteModalOpen, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // 現在操作中の行と編集・削除対象のアカウント
  const [currentAccount, setCurrentAccount] = useState<XAccount | null>(null);

  // ページ読み込み時にXアカウントデータを取得
  useEffect(() => {
    dispatch(fetchXAccounts());
    dispatch(fetchXPosts());
  }, [dispatch]);

  const scheduledPostsForCurrentAccount = currentAccount
    ? xPostList.filter(
        (post) => post.postTo === currentAccount.id && (post.postSchedule?.trim() ?? '') !== ''
      )
    : [];
  const postsForCurrentAccount = currentAccount
    ? xPostList.filter((post) => post.postTo === currentAccount.id)
    : [];

  const csvConfig = mkConfig({
    fieldSeparator: ',',
    decimalSeparator: '.',
    useKeysAsHeaders: true,
  });

  const handleExportData = (rows: MRT_Row<XAccount>[]) => {
    const rowData = rows.map((row) => {
      const { original } = row;
      return {
        id: original.id,
        name: original.name,
        note: original.note,
      };
    });
    const csv = generateCsv(csvConfig)(rowData);
    download(csvConfig)(csv);
  };

  // モーダル操作後のフィードバック処理
  const handleFeedback = ({
    operation,
    accountName,
  }: {
    operation: string;
    accountName: string;
  }) => {
    if (operation === 'created') {
      notifications.show({
        title: t('xAccounts.created'),
        message: t('xAccounts.createdMessage', { name: accountName }),
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } else if (operation === 'updated') {
      console.log('アカウント更新成功');
      notifications.show({
        title: t('xAccounts.updated'),
        message: t('xAccounts.updatedMessage', { name: accountName }),
        color: 'green',
        icon: <IconCheck size={16} />,
        position: 'top-center',
      });
    }
  };

  // アカウント削除処理
  const handleDeleteAccount = async () => {
    if (!currentAccount) {
      return;
    }

    const accountToDelete = currentAccount;
    const idsToDelete = postsForCurrentAccount
      .filter((post) => Boolean(post.id))
      .map((post) => ({ id: post.id as string }));

    setIsDeletingAccount(true);

    try {
      if (idsToDelete.length !== postsForCurrentAccount.length) {
        throw new Error(t('xAccounts.deleteMissingPostId'));
      }

      if (idsToDelete.length > 0) {
        const deletePostsResult = await dispatch(
          deleteMultiple({
            xAccountId: accountToDelete.id,
            idsToDelete,
          })
        ).unwrap();
        const failedPostDeletions =
          deletePostsResult.results?.filter((result) => result.status === 'error') ?? [];

        if (failedPostDeletions.length > 0) {
          throw new Error(
            t('xAccounts.deletePostsFailed', { count: failedPostDeletions.length })
          );
        }
      }

      await dispatch(deleteXAccount(accountToDelete.id)).unwrap();
      closeDeleteModal();
      notifications.show({
        title: t('xAccounts.deleted'),
        message: t('xAccounts.deletedMessage', { name: accountToDelete.name, count: idsToDelete.length }),
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: t('common.error'),
        message: t('xAccounts.deleteFailed', { error: error.message || error }),
        color: 'red',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // 行アクション（編集・削除ボタン）の定義
  const renderRowActions = ({
    row,
    table,
  }: {
    row: MRT_Row<XAccount>;
    table: MRT_TableInstance<XAccount>;
  }) => {
    return (
      <Box style={{ display: 'flex', gap: '8px' }}>
        <Tooltip label={t('common.edit')}>
          <ActionIcon
            onClick={() => {
              setCurrentAccount(row.original);
              table.setEditingRow(row);
            }}
          >
            <IconEdit size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('common.delete')}>
          <ActionIcon
            color="red"
            onClick={() => {
              setCurrentAccount(row.original);
              openDeleteModal();
            }}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('xAccounts.details')}>
          <ActionIcon
            onClick={() => {
              notifications.show({
                title: t('xAccounts.accountDetails'),
                message: t('xAccounts.accountNameValue', { name: row.original.name }),
                color: 'gray',
                position: 'top-center',
                icon: <IconCheck size={16} />,
              });
            }}
          >
            <IconCheck size={18} />
          </ActionIcon>
        </Tooltip>
      </Box>
    );
  };

  // テーブル設定
  const table = useMantineReactTable({
    columns,
    data: xAccountList,
    state: {
      columnVisibility,
      isLoading,
    },
    enableRowActions: true,
    renderRowActions,
    positionActionsColumn: 'first',
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 120,
        minSize: 100,
      },
    },
    enableEditing: true,
    enableRowSelection: true,
    enableColumnResizing: true,
    enableColumnActions: false,
    enableSorting: true,
    enableGlobalFilter: true,
    enablePagination: true,
    enableFullScreenToggle: false,
    localization: i18n.resolvedLanguage === 'ja' ? MRT_Localization_JA : MRT_Localization_EN,
    onColumnVisibilityChange: (
      updaterOrValue: MRT_Updater<MRT_VisibilityState> | MRT_VisibilityState
    ) => {
      if (typeof updaterOrValue === 'function') {
        setColumnVisibility((prev) => updaterOrValue(prev));
      } else {
        setColumnVisibility(updaterOrValue);
      }
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        leftSection={<IconPlus size={18} />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        {t('xAccounts.add')}
      </Button>
    ),
    renderCreateRowModalContent: ({ table }) => (
      <Modal
        opened
        onClose={() => table.setCreatingRow(null)}
        closeOnClickOutside={false}
        title={t('xAccounts.createTitle')}
      >
        <Paper shadow="xs">
          <XAccountForm
            row={null as any}
            table={table}
            accountData={emptyAccount}
            feedBack={handleFeedback}
          />
        </Paper>
      </Modal>
    ),
    renderEditRowModalContent: ({ table, row }) => (
      <Modal
        opened
        onClose={() => table.setEditingRow(null)}
        closeOnClickOutside={false}
        title={t('xAccounts.editTitle')}
      >
        <Paper shadow="xs">
          <XAccountForm
            row={row}
            table={table}
            accountData={currentAccount as XAccount}
            feedBack={handleFeedback}
          />
        </Paper>
      </Modal>
    ),
    renderToolbarInternalActions: ({ table }) => (
      <Box style={{ display: 'flex', gap: '8px' }}>
        <MRT_ToggleGlobalFilterButton table={table} />
        <Tooltip label={t('xAccounts.exportCsv')}>
          <Box style={{ p: 0, m: 0 }}>
            <ActionIcon
              disabled={table.getPrePaginationRowModel().rows.length === 0}
              onClick={() => handleExportData(table.getPrePaginationRowModel().rows)}
            >
              <IconFileArrowRight />
            </ActionIcon>
          </Box>
        </Tooltip>
        <MRT_ToggleFiltersButton table={table} />
        <MRT_ShowHideColumnsButton table={table} />
        <MRT_ToggleDensePaddingButton table={table} />
      </Box>
    ),
  });

  // 新規アカウント用の空のデータ
  const emptyAccount: XAccount = {
    id: '',
    name: '',
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    accessTokenSecret: '',
    note: '',
  };

  // Google Sheet URLが設定されているかチェック
  if (!googleSheetUrl) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title={t('xAccounts.settingsError')} color="red" variant="filled">
        {t('xAccounts.googleSheetRequired')}
      </Alert>
    );
  }

  return (
    <>
      <MantineReactTable table={table} />
      {/* 削除確認モーダル */}
      <Modal
        opened={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title={t('xAccounts.deleteConfirmTitle')}
        size="md"
        styles={{
          content: {
            borderLeft: '4px solid red',
          },
        }}
      >
        <Text>{t('xAccounts.deleteConfirmMessage', { name: currentAccount?.name })}</Text>
        {scheduledPostsForCurrentAccount.length > 0 && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title={t('xAccounts.scheduledPostsRemain')}
            color="yellow"
            mt="md"
          >
            {t('xAccounts.scheduledPostsRemainMessage', {
              count: scheduledPostsForCurrentAccount.length,
            })}
          </Alert>
        )}
        <Group justify="end" mt="md">
          <Button variant="outline" onClick={closeDeleteModal}>
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            onClick={handleDeleteAccount}
            loading={isLoading || isDeletingAccount}
          >
            {t('common.delete')}
          </Button>
        </Group>
      </Modal>
    </>
  );
};

export default XAccountsListTable;
