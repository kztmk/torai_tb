import React from 'react';
import { Plan, UserSubscription } from '.'; // 親コンポーネントから型をインポート
import { IconAlertCircle, IconCheck, IconGift } from '@tabler/icons-react';
import { Alert, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface CurrentSubscriptionDetailsProps {
  currentUserSubscription: UserSubscription;
  currentPlanDetails: Plan | null | undefined;
  onManageSubscription: () => void;
  onOpenReferralProgram?: () => void;
}

const CurrentSubscriptionDetails: React.FC<CurrentSubscriptionDetailsProps> = ({
  currentUserSubscription,
  currentPlanDetails,
  onManageSubscription,
  onOpenReferralProgram,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const pendingChange = currentUserSubscription.pendingPlanChange;
  const isBankTransferSubscription =
    currentPlanDetails?.payment_method === 'bank' ||
    currentUserSubscription.planId?.endsWith('_bank') ||
    currentUserSubscription.bankPaymentInfo?.status === 'payment_confirmed';
  const canManageStripeSubscription =
    Boolean(currentUserSubscription.stripeCustomerId) && !isBankTransferSubscription;

  return (
    <>
      {pendingChange && pendingChange.fromPlanId && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title={t('subscription.current.planChangeNotice')}
          color="blue"
          mb="md"
          mt="sm"
        >
          {t('subscription.current.planWillChange', {
            from: pendingChange.fromPlanName || t('subscription.current.currentPlan'),
            to: pendingChange.toPlanName || t('subscription.current.newPlan'),
            date: pendingChange.effectiveDate
              ? new Date(pendingChange.effectiveDate).toLocaleDateString(locale)
              : '',
          })}
        </Alert>
      )}
      <Card withBorder radius="md" p="xl" style={{ backgroundColor: 'var(--mantine-color-body)' }}>
        <Stack>
          <Group justify="space-between">
            <Title order={3}>
              {t('subscription.current.planLabel')}:{' '}
              {currentPlanDetails
                ? t(
                    `subscription.plans.${currentPlanDetails.id}.name`,
                    currentPlanDetails.name
                  )
                : currentUserSubscription.planName || t('subscription.current.unknownPlan')}
            </Title>
            <Badge
              color={
                currentUserSubscription.status === 'trialing'
                  ? 'lime'
                  : currentUserSubscription.status === 'past_due'
                    ? 'orange'
                    : 'teal'
              }
              size="lg"
              radius="sm"
            >
              {currentUserSubscription.status === 'trialing'
                ? t('subscription.current.trialing')
                : currentUserSubscription.status === 'past_due'
                  ? t('subscription.current.pastDue')
                  : t('subscription.current.active')}
            </Badge>
          </Group>
          {currentPlanDetails && <Text>{t('subscription.current.price')}: {currentPlanDetails.priceDisplay}</Text>}
          {currentUserSubscription?.currentPeriodEnd && (
            <Text>
              {currentUserSubscription.status === 'trialing' ? t('subscription.current.trialEnds') : t('subscription.current.renews')}:{' '}
              {new Date(currentUserSubscription.currentPeriodEnd).toLocaleDateString(locale)}
            </Text>
          )}
          {currentUserSubscription.cancelAtPeriodEnd &&
            currentUserSubscription.currentPeriodEnd && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title={t('subscription.current.cancellationScheduled')}
                color="orange"
                mt="sm"
              >
                {t('subscription.current.cancelsOn', {
                  date: new Date(currentUserSubscription.currentPeriodEnd).toLocaleDateString(locale),
                })}
                {currentUserSubscription.canceledAt && (
                  <Text size="xs" c="dimmed" mt="xs">
                    {t('subscription.current.cancelRequested')}:{' '}
                    {new Date(currentUserSubscription.canceledAt).toLocaleDateString(locale)}
                  </Text>
                )}
              </Alert>
            )}
          {currentUserSubscription.status === 'past_due' && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              title={t('subscription.current.paymentNotice')}
              color="red"
              mt="sm"
            >
              {t('subscription.current.paymentProblem')}
            </Alert>
          )}
          <Text fw={500} mt="sm">
            {t('subscription.current.features')}:
          </Text>
          <Stack gap="xs" pl="sm">
            {currentPlanDetails?.features.map((feature, index) => (
              <Group key={feature} gap="xs">
                <IconCheck size={18} color="var(--mantine-color-teal-6)" />
                <Text size="sm">
                  {t(`subscription.plans.${currentPlanDetails.id}.features.${index}`, feature)}
                </Text>
              </Group>
            ))}
          </Stack>
          {canManageStripeSubscription && (
            <Button onClick={onManageSubscription} mt="md" variant="outline" fullWidth>
              {t('subscription.current.manage')}
            </Button>
          )}
          {i18n.resolvedLanguage === 'ja' && isBankTransferSubscription && (
            <Alert
              icon={<IconGift size="1rem" />}
              title="銀行振込プランの報酬管理"
              color="blue"
              mt="md"
            >
              <Text size="sm">
                銀行振込プランではStripeポータルで契約情報を変更しません。紹介プログラムで獲得した銀行振込クレジットは、紹介プログラム画面で確認できます。
              </Text>
              {onOpenReferralProgram && (
                <Button
                  type="button"
                  variant="light"
                  size="xs"
                  mt="sm"
                  onClick={onOpenReferralProgram}
                >
                  紹介プログラムの報酬管理を表示
                </Button>
              )}
            </Alert>
          )}
        </Stack>
      </Card>
    </>
  );
};

export default CurrentSubscriptionDetails;
