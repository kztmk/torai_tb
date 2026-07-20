import dayjs, { Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { useEffect, useMemo, useState } from 'react';
import {
  IconAi,
  IconCheck,
  IconClockPlus,
  IconClockX,
  IconDownload,
  IconPencil,
  IconTransitionBottom,
  IconTrash,
  IconTrashX,
} from '@tabler/icons-react';
import { download, generateCsv, mkConfig } from 'export-to-csv';
import {
  MantineReactTable,
  MRT_Row,
  MRT_RowSelectionState,
  MRT_ShowHideColumnsButton,
  MRT_ToggleDensePaddingButton,
  MRT_ToggleFiltersButton,
  MRT_ToggleGlobalFilterButton,
  MRT_Updater,
  MRT_VisibilityState,
  useMantineReactTable,
} from 'mantine-react-table';
import { MRT_Localization_JA } from 'mantine-react-table/locales/ja/index.cjs';
import { MRT_Localization_EN } from 'mantine-react-table/locales/en/index.cjs';
import { useParams } from 'react-router-dom';
import { ActionIcon, Box, Button, Group, Modal, Paper, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  createThreadPosts,
  deleteMultiple,
  deleteXPost,
  getXPostsByXAccountId,
  updateSchedules,
} from '@/store/reducers/xPostsSlice';
import { PostDeletion, PostScheduleUpdate, XPostDataType } from '@/types/xAccounts';
import DeletionConfirmationAlert, { DeletionConfirmationAlertProps } from './Alert';
import PostGenerator from './PostGenerator';
import ThreadPosts from './ThreadPosts';
import XPostForm, { xPostFormDefaultValue } from './XPostForm';
import XPostScheduleForm, { ScheduleData } from './XPostScheduleForm';
import { getColumns } from './XPostsColumns';

export type ThreadedXPostDataType = XPostDataType & {
  subRows?: ThreadedXPostDataType[];
  threadDepth?: number;
  threadIndex?: number;
  threadSize?: number;
  threadParentLabel?: string;
  threadOrphan?: boolean;
};

const combineDateTime = (date: Dayjs, time: Dayjs): Dayjs => {
  // ローカルタイムゾーンの情報を保持して日時を組み合わせる
  const combinedDateTime = dayjs(date)
    .year(date.year())
    .month(date.month())
    .date(date.date())
    .hour(time.hour())
    .minute(time.minute())
    .second(time.second());

  return combinedDateTime;
};

const setTimeOnly = (time: Dayjs) =>
  dayjs().hour(time.hour()).minute(time.minute()).second(time.second());

const isOverStopTime = (scheduleDateTime: Dayjs, stopTime: Dayjs): boolean => {
  const timeOfScheduleDateTime = setTimeOnly(scheduleDateTime);
  const timeOfStopTime = setTimeOnly(stopTime);

  return timeOfScheduleDateTime.isAfter(timeOfStopTime);
};

const getPostLabel = (post: XPostDataType): string => {
  const contents = post.contents?.trim();
  if (!contents) {
    return post.id ? `ID: ${post.id}` : '本文なし';
  }
  return contents.length > 24 ? `${contents.slice(0, 24)}...` : contents;
};

const buildThreadRows = (posts: XPostDataType[]): ThreadedXPostDataType[] => {
  const postMap = new Map<string, ThreadedXPostDataType>();
  const childMap = new Map<string, ThreadedXPostDataType[]>();

  posts.forEach((post) => {
    if (!post.id) {
      return;
    }
    postMap.set(post.id, {
      ...post,
      threadDepth: 0,
      threadIndex: 1,
      threadSize: 1,
    });
  });

  posts.forEach((post) => {
    if (!post.id || !post.inReplyToInternal) {
      return;
    }
    const child = postMap.get(post.id);
    const parent = postMap.get(post.inReplyToInternal);
    if (!child || !parent) {
      if (child) {
        child.threadOrphan = true;
      }
      return;
    }
    const children = childMap.get(post.inReplyToInternal) ?? [];
    children.push(child);
    childMap.set(post.inReplyToInternal, children);
    child.threadParentLabel = getPostLabel(parent);
  });

  const consumed = new Set<string>();
  const attachThreadGroup = (root: ThreadedXPostDataType): void => {
    if (!root.id || consumed.has(root.id)) {
      return;
    }

    const descendants: ThreadedXPostDataType[] = [];
    const collectDescendants = (parent: ThreadedXPostDataType, seen: Set<string>) => {
      if (!parent.id) {
        return;
      }

      const children = childMap.get(parent.id) ?? [];
      children.forEach((child) => {
        if (!child.id || seen.has(child.id)) {
          return;
        }
        seen.add(child.id);
        descendants.push(child);
        collectDescendants(child, seen);
      });
    };

    consumed.add(root.id);
    root.threadDepth = 0;
    collectDescendants(root, new Set([root.id]));

    const rootLabel = getPostLabel(root);
    descendants.forEach((child, index) => {
      if (child.id) {
        consumed.add(child.id);
      }
      child.subRows = undefined;
      child.threadDepth = 1;
      child.threadIndex = index + 1;
      child.threadSize = 1;
      child.threadParentLabel = rootLabel;
    });

    root.subRows = descendants.length > 0 ? descendants : undefined;
    root.threadSize = descendants.length + 1;
  };

  const roots = posts
    .map((post) => (post.id ? postMap.get(post.id) : undefined))
    .filter((post): post is ThreadedXPostDataType => {
      if (!post) {
        return false;
      }
      return (
        !post.inReplyToInternal ||
        !postMap.has(post.inReplyToInternal) ||
        Boolean(post.threadOrphan)
      );
    });

  roots.forEach((root) => attachThreadGroup(root));

  postMap.forEach((post) => {
    if (post.id && !consumed.has(post.id)) {
      post.threadOrphan = true;
      roots.push(post);
      attachThreadGroup(post);
    }
  });

  return roots;
};

const XPostTable = () => {
  const { t, i18n } = useTranslation();
  const columns = getColumns(t);
  // dayjsプラグインの初期化
  dayjs.extend(utc);
  dayjs.extend(timezone);

  const { xAccountId } = useParams<{ xAccountId: string }>();
  // xAccountIdが存在しない場合は早期リターン
  if (!xAccountId) {
    return <div>{t('xPosts.accountIdMissing')}</div>;
  }
  const [columnVisibility, setColumnVisibility] = useState({
    id: false,
    postTo: false,
    inReplyToInternal: false,
    contents: true,
    mediaUrls: true,
    postSchedule: true,
    createdAt: true,
  });
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
  const [alertProps, setAlertProps] = useState<DeletionConfirmationAlertProps>({
    open: false,
    onClose: () => setAlertProps({ ...alertProps, open: false }),
    title: t('xPosts.deleteConfirmTitle'),
    message: '',
    onConfirm: () => {},
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel'),
  });
  const [openThreadPostsDialog, setOpenThreadPostsDialog] = useState(false);
  const [selectedPostsForThread, setSelectedPostsForThread] = useState<XPostDataType[]>([]);

  const [openPostGenerator, setOpenPostGenerator] = useState(false);
  // xPosts.xPostListは全アカウントのPOSTデータを持っているので、xAccountIdでフィルタリングして表示する
  const xPostList = useAppSelector((state) => state.xPosts.xPostListByXAccountId);
  const threadedXPostList = useMemo(() => buildThreadRows(xPostList), [xPostList]);

  const dispatch = useAppDispatch();
  const { isLoading, isError, errorMessage, warningMessage, process } = useAppSelector(
    (state) => state.xPosts
  );

  useEffect(() => {
    dispatch(getXPostsByXAccountId(xAccountId));
    setSelectedPostsForThread([]);
    setRowSelection({}); // 選択状態をクリアs
  }, [xAccountId]);

  // 非同期アクションの状態に応じた通知を表示
  useEffect(() => {
    // ローディング通知
    if (isLoading) {
      const loadingMessages: Record<string, string> = {
        updateSchedules: t('xPosts.progress.updateSchedules'),
        deleteMultiple: t('xPosts.progress.deleteMultiple'),
        createMultiple: t('xPosts.progress.createMultiple'),
        delete: t('xPosts.progress.delete'),
        createThreadPosts: t('xPosts.progress.createThread'),
      };

      if (process && loadingMessages[process]) {
        notifications.show({
          id: `loading-${process}`,
          title: t('auth.processing'),
          message: loadingMessages[process],
          color: 'blue',
          loading: true,
          autoClose: false,
        });
      }
    } else if (process) {
      // isLoading が false で process が存在する場合 (完了通知)
      notifications.hide(`loading-${process}`);

      if (isError) {
        notifications.show({
          title: t('common.error'),
          message: errorMessage || t('xPosts.processingError'),
          color: 'red',
        });
      } else if (warningMessage) {
        notifications.show({
          title: t('xPosts.resyncRequired'),
          message: warningMessage,
          color: 'orange',
        });
        setRowSelection({});
      } else {
        const successMessages: Record<string, string> = {
          updateSchedules: t('xPosts.success.updateSchedules'),
          deleteMultiple: t('xPosts.success.deleteMultiple'),
          createMultiple: t('xPosts.success.createMultiple'),
          delete: t('xPosts.success.delete'),
          createThreadPosts: t('xPosts.success.createThread'),
        };

        if (successMessages[process]) {
          notifications.show({
            title: t('common.success'),
            message: successMessages[process],
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        }
        setRowSelection({}); // 選択状態をクリア
      }
    }
  }, [isLoading, isError, process, errorMessage, warningMessage, dispatch, t]);

  // モーダル操作後のフィードバック処理
  const handleFeedback = ({ operation, text }: { operation: string; text: string }) => {
    if (operation === 'addNew') {
      notifications.show({
        title: t('xPosts.created'),
        message: t('xPosts.createdMessage', { text }),
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } else if (operation === 'update') {
      notifications.show({
        title: t('xPosts.updated'),
        message: t('xPosts.updatedMessage', { text }),
        color: 'green',
        icon: <IconCheck size={16} />,
        position: 'top-center',
      });
    }
  };

  // Row action button delete
  const handleDeletePost = (row: MRT_Row<XPostDataType>) => {
    if (!row.original) {
      return;
    }
    const currentPostToDelete = row.original;

    setAlertProps({
      open: true,
      onClose: () => setAlertProps({ ...alertProps, open: false }),
      title: t('xPosts.deleteConfirmTitle'),
      message: t('xPosts.deleteConfirmMessage', { text: currentPostToDelete.contents?.slice(0, 30) }),
      onConfirm: async () => {
        try {
          if (!xAccountId) {
            throw new Error(t('xPosts.accountNotFound'));
          }
          await dispatch(deleteXPost({ xAccountId, postId: currentPostToDelete.id ?? '' }));
        } catch (error) {
          console.error('Failed to delete post:', error);
        } finally {
          setAlertProps({ ...alertProps, open: false });
        }
      },
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
    });
  };

  // csv config for import and export
  const csvConfig = mkConfig({
    fieldSeparator: ',',
    decimalSeparator: '.',
    useKeysAsHeaders: true,
  });

  const handleExportData = (rows: MRT_Row<XPostDataType>[]) => {
    console.log('Exporting data for rows:', rows.length);
    const rowData = rows.map((row) => ({
      ...row.original,
    }));
    const csv = generateCsv(csvConfig)(rowData);
    download(csvConfig)(csv);
  };

  // 投稿スケジュール一括設定フォーム開く
  const handleOpenScheduleDialog = () => {
    setOpenScheduleDialog(true);
  };

  // 投稿スケジュール一括設定
  const handleSetSchedules = async (data: ScheduleData | null) => {
    setOpenScheduleDialog(false);
    if (data !== null) {
      console.log('handleSetSchedules', data);
      const updatedXPosts: PostScheduleUpdate[] = [];
      let durationCount = 0;
      let postDate = data.startDate;
      for (let i = 0; i < table.getSelectedRowModel().flatRows.length; i++) {
        let updatedPost: PostScheduleUpdate;
        const row = table.getSelectedRowModel().flatRows[i];
        // culculate post time
        const caliculatedDurationMin = data.unit
          ? data.duration * durationCount * 60
          : data.duration * durationCount;
        const scheduleDateTime = combineDateTime(dayjs(postDate), dayjs(data.startTime)).add(
          caliculatedDurationMin,
          'minute'
        );
        // compare culculated post time and end time
        if (isOverStopTime(scheduleDateTime, dayjs(data.endTime))) {
          // over end time then set next day
          durationCount = 0;
          postDate = postDate.add(1, 'day');
          // check end date
          if (postDate.isAfter(data.endDate)) {
            break;
          }
          // set next day post time
          const newScheduleDateTime = combineDateTime(dayjs(postDate), dayjs(data.startTime));
          console.log('newScheduleDateTime', newScheduleDateTime);
          // ローカルタイムゾーン情報を保持したまま保存する形式に変換
          updatedPost = {
            id: row.original.id || '',
            postSchedule: newScheduleDateTime.format('YYYY-MM-DDTHH:mm:ssZ'),
          };
        } else {
          // set post time same day
          console.log('scheduleDateTime else', scheduleDateTime);
          // ローカルタイムゾーン情報を保持したまま保存する形式に変換
          updatedPost = {
            id: row.original.id || '',
            postSchedule: scheduleDateTime.format('YYYY-MM-DDTHH:mm:ssZ'),
          };
        }
        updatedXPosts.push(updatedPost);
        durationCount++;
      }
      table.setRowSelection({});
      dispatch(updateSchedules({ xAccountId, scheduleUpdates: updatedXPosts }));
    }
  };

  const handleThredPostsDialog = () => {
    const selectedRows = table.getSelectedRowModel().flatRows;
    const selectedPosts = selectedRows.map((row) => row.original);
    setSelectedPostsForThread(selectedPosts);
    setOpenThreadPostsDialog(true);
  };

  // TheadPosts
  const handleThreadPosts = (threadPosts: XPostDataType[]) => {
    const threads: { id: string; inReplyToInternal: string }[] = [];
    const includedPostIds = new Set(threadPosts.map((post) => post.id).filter(Boolean));
    for (let i = 0; i < threadPosts.length; i++) {
      const threadPostsId = threadPosts[i].id;
      let threadPostsInReplyToInternal;
      if (i === 0) {
        threadPostsInReplyToInternal = '';
      } else {
        threadPostsInReplyToInternal = threadPosts[i - 1].id;
      }
      threads.push({
        id: threadPostsId || '',
        inReplyToInternal: threadPostsInReplyToInternal || '',
      });
    }
    selectedPostsForThread.forEach((post) => {
      if (post.id && !includedPostIds.has(post.id)) {
        threads.push({
          id: post.id,
          inReplyToInternal: '',
        });
      }
    });
    console.log('handleThreadPosts', threads);
    dispatch(createThreadPosts({ xAccountId, threads }));
  };

  // 投稿スケジュール一括削除
  const handleClearSchedule = () => {
    // alert
    setAlertProps({
      open: true,
      onClose: () => setAlertProps({ ...alertProps, open: false }),
      title: t('xPosts.clearScheduleTitle'),
      message: t('xPosts.clearScheduleMessage'),
      onConfirm: () => {
        const selectedRows = table.getSelectedRowModel().flatRows;
        const updatedXPosts: PostScheduleUpdate[] = selectedRows.map((row) => ({
          id: row.original.id || '',
          postSchedule: '',
        }));
        dispatch(updateSchedules({ xAccountId, scheduleUpdates: updatedXPosts }));
        setAlertProps({ ...alertProps, open: false });
      },
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
    });
  };

  const handleDeleteSelected = () => {
    console.log('handleDeleteSelected');
    setAlertProps({
      open: true,
      onClose: () => setAlertProps({ ...alertProps, open: false }),
      title: t('xPosts.deleteConfirmTitle'),
      message: t('xPosts.deleteSelectedMessage'),
      onConfirm: () => {
        const selectedRows = table.getSelectedRowModel().flatRows;
        const deleteXPosts: PostDeletion[] = selectedRows.map((row) => ({
          id: row.original.id || '',
        }));
        dispatch(deleteMultiple({ xAccountId, idsToDelete: deleteXPosts }));
        setAlertProps({ ...alertProps, open: false });
      },
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
    });
  };

  const table = useMantineReactTable({
    columns,
    data: threadedXPostList,
    // editing feature
    editDisplayMode: 'modal',
    enableEditing: true,
    // create row
    createDisplayMode: 'modal',
    enableFullScreenToggle: false,
    enableExpanding: true,
    enableRowActions: true,
    enableRowNumbers: true,
    enableRowSelection: true,
    getSubRows: (row) => (row.subRows && row.subRows.length > 0 ? row.subRows : undefined),
    initialState: {
      expanded: true,
    },
    positionToolbarAlertBanner: 'bottom',
    onRowSelectionChange: setRowSelection,
    state: {
      columnVisibility,
      rowSelection,
    },
    localization: i18n.resolvedLanguage === 'ja' ? MRT_Localization_JA : MRT_Localization_EN,
    onColumnVisibilityChange: (
      updaterOrValue: MRT_Updater<MRT_VisibilityState> | MRT_VisibilityState
    ) => {
      if (typeof updaterOrValue === 'function') {
        // @ts-ignore
        setColumnVisibility((prevState) => updaterOrValue(prevState));
      } else {
        // @ts-ignore
        setColumnVisibility(updaterOrValue);
      }
    },
    renderCreateRowModalContent: ({ table, row }) => (
      <Modal
        opened
        onClose={() => table.setCreatingRow(null)}
        closeOnClickOutside={false}
        title={t('xPosts.createTitle')}
      >
        <XPostForm
          xAccountId={xAccountId}
          row={row}
          xPostData={xPostFormDefaultValue as XPostDataType}
          table={table}
          feedBack={handleFeedback}
        />
      </Modal>
    ),
    renderEditRowModalContent: ({ table, row }) => (
      <Modal
        opened
        onClose={() => table.setEditingRow(null)}
        closeOnClickOutside={false}
        title={t('xPosts.editTitle')}
      >
        <XPostForm
          xAccountId={xAccountId}
          row={row}
          xPostData={row.original}
          table={table}
          feedBack={handleFeedback}
        />
      </Modal>
    ),
    renderRowActions: ({ row, table }) => (
      <Box style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
        <Tooltip label={t('common.edit')}>
          <ActionIcon onClick={() => table.setEditingRow(row)}>
            <IconPencil />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('common.delete')}>
          <ActionIcon color="red" onClick={() => handleDeletePost(row)}>
            <IconTrash />
          </ActionIcon>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Box style={{ gap: '16px', padding: '8px' }}>
        <Group>
          <Button variant="outline" onClick={() => table.setCreatingRow(true)}>
            {t('xPosts.createTitle')}
          </Button>
          <Tooltip label={t('xPosts.createThread')}>
            <Box>
              <ActionIcon
                onClick={handleThredPostsDialog}
                disabled={
                  !table.getIsSomeRowsSelected() &&
                  !table.getIsAllPageRowsSelected() &&
                  !table.getIsAllRowsSelected()
                }
              >
                <IconTransitionBottom />
              </ActionIcon>
            </Box>
          </Tooltip>
          <Tooltip label={t('xPosts.setScheduleBulk')}>
            <Box>
              <ActionIcon
                onClick={handleOpenScheduleDialog}
                disabled={
                  !table.getIsSomeRowsSelected() &&
                  !table.getIsAllPageRowsSelected() &&
                  !table.getIsAllRowsSelected()
                }
              >
                <IconClockPlus />
              </ActionIcon>
            </Box>
          </Tooltip>
          <Tooltip label={t('xPosts.clearScheduleBulk')}>
            <Box>
              <ActionIcon
                onClick={handleClearSchedule}
                disabled={
                  !table.getIsSomeRowsSelected() &&
                  !table.getIsAllPageRowsSelected() &&
                  !table.getIsAllRowsSelected()
                }
              >
                <IconClockX />
              </ActionIcon>
            </Box>
          </Tooltip>
          <Tooltip label={t('xPosts.deleteSelected')}>
            <Box>
              <ActionIcon
                onClick={handleDeleteSelected}
                disabled={
                  !table.getIsSomeRowsSelected() &&
                  !table.getIsAllPageRowsSelected() &&
                  !table.getIsAllRowsSelected()
                }
              >
                <IconTrashX />
              </ActionIcon>
            </Box>
          </Tooltip>
          <Tooltip label={t('xPosts.generateWithAi')}>
            <Box>
              <ActionIcon onClick={() => setOpenPostGenerator(true)}>
                <IconAi />
              </ActionIcon>
            </Box>
          </Tooltip>
        </Group>
      </Box>
    ),
    renderToolbarInternalActions: ({ table }) => (
      <Box style={{ display: 'flex', flexDirection: 'row' }}>
        <MRT_ToggleGlobalFilterButton table={table} />
        <Tooltip label={t('xAccounts.exportCsv')}>
          <Box style={{ p: 0, m: 0 }}>
            <ActionIcon
              variant="transparent"
              disabled={table.getPrePaginationRowModel().rows.length === 0}
              onClick={() => handleExportData(table.getPrePaginationRowModel().rows)}
            >
              <IconDownload />
            </ActionIcon>
          </Box>
        </Tooltip>
        <MRT_ToggleFiltersButton table={table} />
        <MRT_ShowHideColumnsButton table={table} />
        <MRT_ToggleDensePaddingButton table={table} />
      </Box>
    ),
  });

  return (
    <Paper p="md" style={{ width: '100%', height: '100%' }}>
      <Text mb="md">{t('xAccounts.accountNameValue', { name: `@${xAccountId}` })}</Text>
      <MantineReactTable table={table} />
      <XPostScheduleForm
        dialogOpen={openScheduleDialog}
        setSchedule={handleSetSchedules}
        onClose={() => setOpenScheduleDialog(false)}
      />
      <ThreadPosts
        open={openThreadPostsDialog}
        onClose={() => setOpenThreadPostsDialog(false)}
        posts={selectedPostsForThread}
        onConfirm={handleThreadPosts}
      />
      <DeletionConfirmationAlert
        open={alertProps.open}
        onClose={alertProps.onClose}
        title={alertProps.title}
        message={alertProps.message}
        onConfirm={alertProps.onConfirm}
        confirmButtonText={alertProps.confirmButtonText}
        cancelButtonText={alertProps.cancelButtonText}
      />
      <PostGenerator
        opened={openPostGenerator}
        onClose={() => setOpenPostGenerator(false)}
        xAccountId={xAccountId}
      />
    </Paper>
  );
};

export default XPostTable;
