import React from 'react';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Alert, Button, Paper, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { deleteCurrentUserAccountThunk, selectUser } from '@/store/reducers/auth';

const DeleteUserAccount: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectUser);
  const { loading: authLoading, task: authTask } = useAppSelector((state) => state.auth);
  const [isManagingSubscription, setIsManagingSubscription] = React.useState(false);

  // Stripeサブスクリプションがアクティブで、かつ期間末キャンセルが設定されていないかを確認
  const hasActiveStripeSubscriptionNotScheduledForCancellation =
    !!currentUser.stripeCustomerId && // Stripeの顧客IDがある
    (currentUser.subscriptionStatus === 'active' ||
      currentUser.subscriptionStatus === 'trialing' ||
      currentUser.subscriptionStatus === 'past_due') && // アクティブ系のステータス
    currentUser.cancelAtPeriodEnd === false; // 期間末キャンセルがfalse

  const isLoading = authLoading && authTask === 'delete_user_account';

  const handleGoToStripePortal = async () => {
    setIsManagingSubscription(true);
    notifications.show({
      id: 'manage-subscription-loading-from-delete',
      title: t('auth.processing'),
      message: t('profile.delete.openingPortal'),
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      const app = getApp();
      const functions = getFunctions(app, 'asia-northeast1');
      const createPortalLinkCallable = httpsCallable(functions, 'createStripePortalLink');
      const result = (await createPortalLinkCallable()) as { data: { url: string } };

      notifications.hide('manage-subscription-loading-from-delete');
      if (result.data.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Portal URL not found in response.');
      }
    } catch (error) {
      console.error('Error creating Stripe portal link from DeleteUserAccount:', error);
      notifications.update({
        id: 'manage-subscription-loading-from-delete',
        title: t('common.error'),
        message: t('profile.delete.portalFailed'),
        color: 'red',
        loading: false,
        autoClose: 7000,
      });
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleDeleteAccount = () => {
    if (hasActiveStripeSubscriptionNotScheduledForCancellation) {
      notifications.show({
        title: t('profile.delete.cancelRequired'),
        message: t('profile.delete.cancelRequiredMessage'),
        color: 'orange',
        icon: <IconAlertTriangle size="1rem" />,
        autoClose: 10000, // 10秒表示
      });
      return;
    }

    modals.openConfirmModal({
      title: t('profile.delete.confirmTitle'),
      centered: true,
      children: (
        <Text size="sm">
          {t('profile.delete.confirmMessage')}
        </Text>
      ),
      labels: { confirm: t('profile.delete.action'), cancel: t('common.cancel') },
      confirmProps: { color: 'red' },

      onConfirm: async () => {
        try {
          const resultAction = await dispatch(deleteCurrentUserAccountThunk());
          if (deleteCurrentUserAccountThunk.fulfilled.match(resultAction)) {
            // 成功した場合、通常は自動的にリダイレクトされるか、
            // authSliceの変更によってUIが更新される。
            // 必要であればここで成功通知を表示しても良い。
            notifications.show({
              title: t('profile.delete.complete'),
              message: t('profile.delete.completeMessage'),
              color: 'green',
            });
            // navigate('/');
          } else if (deleteCurrentUserAccountThunk.rejected.match(resultAction)) {
            notifications.show({
              title: t('profile.delete.error'),
              message:
                resultAction.payload?.message || t('profile.delete.errorMessage'),
              color: 'red',
            });
          }
        } catch (error) {
          notifications.show({
            title: t('profile.delete.unexpectedError'),
            message: t('profile.delete.unexpectedErrorMessage'),
            color: 'red',
          });
        }
      },
    });
  };

  return (
    <Paper withBorder shadow="md" p="lg" mt="lg">
      <Title order={3} mb="md">
        {t('profile.delete.title')}
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        {t('profile.delete.description')}
      </Text>

      {hasActiveStripeSubscriptionNotScheduledForCancellation && (
        <Alert
          icon={<IconAlertTriangle size="1rem" />}
          title={t('profile.delete.activeSubscription')}
          color="orange"
          mb="lg"
        >
          <Text mb="xs">
            {t('profile.delete.activeSubscriptionMessage')}
          </Text>
          <Button
            variant="outline"
            color="dark"
            onClick={handleGoToStripePortal}
            loading={isManagingSubscription}
          >
            {t('profile.delete.openPortal')}
          </Button>
        </Alert>
      )}

      <Button
        color="red"
        leftSection={<IconTrash size="1rem" />}
        onClick={handleDeleteAccount}
        disabled={isLoading} // 処理中なら無効
        loading={isLoading}
      >
        {t('profile.delete.action')}
      </Button>
    </Paper>
  );
};
export default DeleteUserAccount;
