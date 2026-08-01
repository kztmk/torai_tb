import { useEffect, useRef, useState } from 'react';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { fetchAccounts } from '@/store/reducers/accountsSlice';
import {
  getGasVersion,
  getTriggerStatus,
  setInitialized,
} from '@/store/reducers/apiControllerSlice';
import { fetchPostLists } from '@/store/reducers/postsSlice';

const getSyncErrorMessage = (payload: unknown, fallbackMessage: string) => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallbackMessage;
};

const MAX_SYNC_ATTEMPTS = 2;

/**
 * データ同期コンポーネント
 * サインイン後にGoogle SheetデータとXAccountListを含めて同期させる
 * 条件：
 * 1. ユーザーがサインイン済み
 * 2. Google Sheet URLが設定されている
 * 3. まだ初期化されていない（apiController.initialized === false）
 */
const DataSynchronizer = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { initialized } = useAppSelector((state) => state.apiController);
  const [, setSyncError] = useState<string | null>(null);
  const syncAttemptsRef = useRef(0);
  const isSyncingRef = useRef(false);
  const syncKeyRef = useRef('');
  const gasAuthNoticeShownKeyRef = useRef('');

  useEffect(() => {
    const syncData = async () => {
      const syncKey = `${user.uid || ''}:${user.googleSheetUrl || ''}:${
        user.gasProxyInitializedAt || ''
      }`;
      if (syncKeyRef.current !== syncKey) {
        syncKeyRef.current = syncKey;
        syncAttemptsRef.current = 0;
        gasAuthNoticeShownKeyRef.current = '';
      }

      // 条件チェック
      if (!user.uid || !user.googleSheetUrl || initialized || isSyncingRef.current) {
        return;
      }

      if (syncAttemptsRef.current >= MAX_SYNC_ATTEMPTS) {
        return;
      }

      if (!user.gasProxyInitializedAt) {
        const noticeKey = syncKey;
        if (gasAuthNoticeShownKeyRef.current !== noticeKey) {
          notifications.show({
            title: t('sync.gasVerificationRequired'),
            message: t('sync.saveGasVerification'),
            color: 'yellow',
            icon: <IconAlertCircle size={16} />,
            autoClose: 6000,
          });
          gasAuthNoticeShownKeyRef.current = noticeKey;
        }
        return;
      }

      syncAttemptsRef.current += 1;
      isSyncingRef.current = true;
      setSyncError(null);

      // 同期開始の通知
      const notificationId = notifications.show({
        id: 'data-sync',
        loading: true,
        title: t('sync.syncing'),
        message: t('sync.syncingMessage'),
        autoClose: false,
        withCloseButton: false,
      });

      try {
        // Bluesky / Threads アカウントを取得
        const accountsAction = await dispatch(fetchAccounts());
        if (fetchAccounts.rejected.match(accountsAction)) {
          console.error('アカウントデータ同期エラー:', accountsAction.payload);
          throw new Error(
            getSyncErrorMessage(accountsAction.payload, t('sync.accountsFailed'))
          );
        }

        // 投稿一覧（Posts / Posted / Errors）を取得
        const listsAction = await dispatch(fetchPostLists());
        if (fetchPostLists.rejected.match(listsAction)) {
          console.error('投稿データ同期エラー:', listsAction.payload);
          throw new Error(getSyncErrorMessage(listsAction.payload, t('sync.postsFailed')));
        }

        // トリガーの状態を取得（自動投稿のトリガー）
        const triggerAction = await dispatch(getTriggerStatus({ functionName: 'autoPost' }));
        if (getTriggerStatus.rejected.match(triggerAction)) {
          console.error('トリガーステータス取得エラー:', triggerAction.payload);
          // トリガー取得は失敗しても同期処理は続行（重要度を下げる）
          notifications.show({
            title: t('sync.triggerFailedTitle'),
            message:
              typeof triggerAction.payload === 'string'
                ? triggerAction.payload
                : t('sync.triggerFailed'),
            color: 'yellow',
            icon: <IconAlertCircle size={16} />,
            autoClose: 5000,
          });
        }

        // デプロイ済み GAS バージョンを取得（フッターの更新チェック用）。
        // 失敗しても同期は続行する（バージョン表示が出ないだけ）。
        dispatch(getGasVersion());

        // 同期完了をマーク
        dispatch(setInitialized());

        // 成功通知
        notifications.update({
          id: notificationId,
          color: 'green',
          title: t('sync.complete'),
          message: t('sync.completeMessage'),
          icon: <IconCheck size={16} />,
          loading: false,
          autoClose: 3000,
        });
      } catch (error: any) {
        console.error('データ同期エラー:', error);
        setSyncError(error.message || t('sync.failed'));

        // エラー通知
        notifications.update({
          id: notificationId,
          color: 'red',
          title: t('sync.failedTitle'),
          message: error.message || t('sync.failed'),
          icon: <IconAlertCircle size={16} />,
          loading: false,
          autoClose: 5000,
        });
      } finally {
        isSyncingRef.current = false;
      }
    };

    syncData();
  }, [user.uid, user.googleSheetUrl, user.gasProxyInitializedAt, initialized, dispatch, t]);

  // このコンポーネントは何もレンダリングしない
  return null;
};

export default DataSynchronizer;
