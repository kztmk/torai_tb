import { useEffect, useState } from 'react';
import { IconAlertCircle, IconCheck, IconRefresh } from '@tabler/icons-react';
import { Alert, Button, Group, LoadingOverlay, Paper, Tabs, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { setInitialized } from '@/store/reducers/apiControllerSlice';
import { fetchXErrors } from '@/store/reducers/xErrorsSlice';
import { fetchXPosted } from '@/store/reducers/xPostedSlice';
import { fetchXPosts } from '@/store/reducers/xPostsSlice';
import ErrorsTable from './ErrorsTable';
import PostedTable from './PostedTable';
import PostsTable from './PostsTable';

/**
 * シートデータ表示コンポーネント
 * 投稿予定データ、投稿済みデータ、エラーデータをタブで切り替えて表示する
 */
const SheetData = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { initialized } = useAppSelector((state) => state.apiController);
  const { user } = useAppSelector((state) => state.auth);
  const { xPostList, isLoading: isPostsLoading } = useAppSelector((state) => state.xPosts);
  const { xPostedList, isLoading: isPostedLoading } = useAppSelector((state) => state.xPosted);
  const { xErrorsList, isLoading: isErrorsLoading } = useAppSelector((state) => state.xErrors);

  const [activeTab, setActiveTab] = useState<string | null>('posts');
  const [error, setError] = useState<string | null>(null);

  // 通知ID管理用
  const [loadingNotificationId, setLoadingNotificationId] = useState<string | null>(null);

  // 全体のローディング状態
  const isLoading = isPostsLoading || isPostedLoading || isErrorsLoading;

  // 全データをフェッチ
  const fetchAllData = async () => {
    if (!user.googleSheetUrl) {
      return;
    }

    setError(null);

    // 進行中の通知があれば閉じる
    if (loadingNotificationId) {
      notifications.hide(loadingNotificationId);
    }

    // 読み込み開始の通知
    const notificationId = notifications.show({
      loading: true,
      title: t('activity.sheet.loading'),
      message: t('activity.sheet.loadingScheduled'),
      autoClose: false,
      withCloseButton: false,
    });

    setLoadingNotificationId(notificationId);

    try {
      // 未投稿データを取得
      try {
        const postsAction = await dispatch(fetchXPosts());

        // 通知を更新
        notifications.update({
          id: notificationId,
          loading: true,
          title: t('activity.sheet.loading'),
          message: t('activity.sheet.loadingPosted'),
        });

        if (fetchXPosts.rejected.match(postsAction)) {
          console.error('未投稿データ取得エラー:', postsAction.payload);
          notifications.show({
            title: t('activity.sheet.scheduledError'),
            message:
              typeof postsAction.payload === 'string'
                ? postsAction.payload
                : t('activity.sheet.scheduledFailed'),
            color: 'red',
            icon: <IconAlertCircle size={16} />,
          });
        }
      } catch (error) {
        console.error('未投稿データ取得エラー:', error);
        notifications.show({
          title: t('activity.sheet.scheduledError'),
          message: t('activity.sheet.scheduledFailed'),
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      }

      // 投稿済みデータを取得
      try {
        const postedAction = await dispatch(fetchXPosted());

        // 通知を更新
        notifications.update({
          id: notificationId,
          loading: true,
          title: t('activity.sheet.loading'),
          message: t('activity.sheet.loadingErrors'),
        });

        if (fetchXPosted.rejected.match(postedAction)) {
          console.error('投稿済みデータ取得エラー:', postedAction.payload);
          notifications.show({
            title: t('activity.sheet.postedError'),
            message:
              typeof postedAction.payload === 'string'
                ? postedAction.payload
                : t('activity.sheet.postedFailed'),
            color: 'red',
            icon: <IconAlertCircle size={16} />,
          });
        }
      } catch (error) {
        console.error('投稿済みデータ取得エラー:', error);
        notifications.show({
          title: t('activity.sheet.postedError'),
          message: t('activity.sheet.postedFailed'),
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      }

      // エラーデータを取得
      try {
        const errorAction = await dispatch(fetchXErrors());

        if (fetchXErrors.rejected.match(errorAction)) {
          console.error('エラーデータ取得エラー:', errorAction.payload);
          notifications.show({
            title: t('activity.sheet.errorsError'),
            message:
              typeof errorAction.payload === 'string'
                ? errorAction.payload
                : t('activity.sheet.errorsFailed'),
            color: 'red',
            icon: <IconAlertCircle size={16} />,
          });
        }
      } catch (error) {
        console.error('エラーデータ取得エラー:', error);
        notifications.show({
          title: t('activity.sheet.errorsError'),
          message: t('activity.sheet.errorsFailed'),
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      }
      dispatch(setInitialized());
      // 全てのデータ取得が完了したら成功通知
      notifications.update({
        id: notificationId,
        loading: false,
        title: t('activity.sheet.complete'),
        message: t('activity.sheet.completeMessage', { scheduled: xPostList.length, posted: xPostedList.length, errors: xErrorsList.length }),
        icon: <IconCheck size={16} />,
        color: 'green',
        autoClose: 3000,
      });

      setLoadingNotificationId(null);
    } catch (error) {
      console.error('データ取得エラー:', error);
      setError(t('activity.sheet.loadFailed'));

      // エラー通知
      notifications.update({
        id: notificationId,
        loading: false,
        title: t('activity.sheet.loadError'),
        message: t('activity.sheet.loadFailed'),
        color: 'red',
        icon: <IconAlertCircle size={16} />,
        autoClose: 3000,
      });

      setLoadingNotificationId(null);
    }
  };

  // コンポーネントマウント時にデータを取得、但し毎回ではなく、URLが変更されたときのみ
  useEffect(() => {
    if (user.googleSheetUrl) {
      if (!initialized) {
        fetchAllData();
      }
    }

    // コンポーネントのアンマウント時に進行中の通知をクリーンアップ
    return () => {
      if (loadingNotificationId) {
        notifications.hide(loadingNotificationId);
      }
    };
  }, [user.googleSheetUrl]);

  return (
    <Paper p="md" withBorder pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Group mb="md">
        <Title order={3}>{t('activity.sheet.title')}</Title>
        <Button
          leftSection={<IconRefresh size={18} />}
          onClick={fetchAllData}
          disabled={isLoading}
          variant="light"
        >
          {t('activity.trigger.refresh')}
        </Button>
      </Group>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title={t('common.error')}
          color="red"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="posts">{t('activity.sheet.scheduledCount', { count: xPostList.length })}</Tabs.Tab>
          <Tabs.Tab value="posted">{t('activity.sheet.postedCount', { count: xPostedList.length })}</Tabs.Tab>
          <Tabs.Tab value="errors">{t('activity.sheet.errorCount', { count: xErrorsList.length })}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="posts" pt="md">
          <PostsTable data={xPostList} isLoading={isPostsLoading} />
        </Tabs.Panel>

        <Tabs.Panel value="posted" pt="md">
          <PostedTable data={xPostedList} isLoading={isPostedLoading} />
        </Tabs.Panel>

        <Tabs.Panel value="errors" pt="md">
          <ErrorsTable data={xErrorsList} isLoading={isErrorsLoading} />
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
};

export default SheetData;
