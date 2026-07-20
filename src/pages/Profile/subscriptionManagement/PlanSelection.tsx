import React from 'react';
import type { Plan, UserSubscription } from '.'; // 親コンポーネントから型をインポート
import { IconCheck } from '@tabler/icons-react';
import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  List,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useHover } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import half_yearly from '@/assets/images/half_yearly.png';
import manthly from '@/assets/images/monthly.png';
import yearly from '@/assets/images/yearly.png';
import {
  DEFAULT_BANK_TRANSFER_FEE_AMOUNT,
  DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID,
  formatBankTransferFeeDiscountAmount,
  formatFirstMonthDiscountAmount,
  getFirstMonthDiscountAmountOff,
} from '@/utils/firstMonthDiscount';

interface PlanSelectionProps {
  availablePlans: Plan[];
  currentUserSubscription: UserSubscription | null;
  onSelectBankTransfer: (planId: string) => void;
  onSelectStripe: (planId: string) => void;
  isBankTransferLoading: boolean;
  isStripeLoading?: boolean; // Stripe用のローディング状態を追加 (オプショナル)
  isFirstMonthDiscountAvailable?: boolean;
  firstMonthDiscountAmountByPlanId?: Record<string, number>;
  bankTransferFeeAmount?: number;
  isStripeCheckoutAvailable?: boolean;
}

interface PlanCardProps {
  plan: Plan;
  onSelectBankTransfer: (planId: string) => void;
  onSelectStripe: (planId: string) => void;
  isBankTransferLoading: boolean;
  isStripeLoading?: boolean;
  isFirstMonthDiscountAvailable: boolean;
  firstMonthDiscountAmountByPlanId: Record<string, number>;
  bankTransferFeeAmount: number;
  isStripeCheckoutAvailable: boolean;
}

const getImage = (planName: string) => {
  switch (planName) {
    case 'basic_monthly':
      return manthly;
    case 'half_yearly':
    case 'half_yearly_bank':
      return half_yearly;
    case 'yearly':
      return yearly;
    default:
      return '';
  }
};

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  onSelectBankTransfer,
  onSelectStripe,
  isBankTransferLoading,
  isStripeLoading,
  isFirstMonthDiscountAvailable,
  firstMonthDiscountAmountByPlanId,
  bankTransferFeeAmount,
  isStripeCheckoutAvailable,
}) => {
  const { hovered, ref } = useHover();
  const { t } = useTranslation();
  const monthlyDiscountAmount = getFirstMonthDiscountAmountOff(
    plan.id,
    firstMonthDiscountAmountByPlanId
  );
  const discountedMonthlyAmount =
    plan.id === 'basic_monthly' &&
    typeof plan.amount === 'number' &&
    typeof monthlyDiscountAmount === 'number'
      ? Math.max(0, plan.amount - monthlyDiscountAmount)
      : null;
  const bankTransferPriceDisplay =
    plan.payment_method === 'bank' && typeof plan.amount === 'number'
      ? `￥${plan.amount.toLocaleString()} + ￥${bankTransferFeeAmount.toLocaleString()}`
      : plan.priceDisplay;

  return (
    <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
      <Card
        ref={ref}
        padding="lg"
        radius="md"
        withBorder
        shadow={hovered ? 'lg' : 'sm'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          cursor: 'pointer',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <Card.Section inheritPadding py="xs">
          <Group justify="space-between">
            <Title order={3}>{t(`subscription.plans.${plan.id}.name`, plan.name)}</Title>
            {plan.isRecommended && <Badge color="pink">{t('subscription.recommended')}</Badge>}
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            {plan.payment_method === 'bank'
              ? t('subscription.bankPlanDescription', {
                  amount: bankTransferFeeAmount.toLocaleString(),
                })
              : t(`subscription.plans.${plan.id}.description`, plan.description || '')}
          </Text>
        </Card.Section>

        {plan.payment_method === 'bank' && isFirstMonthDiscountAvailable ? (
          <Stack gap={2} mt="md">
            <Group gap="xs">
              <Text c="blue" size="xl" fw={700}>
                {typeof plan.amount === 'number'
                  ? `￥${plan.amount.toLocaleString()}`
                  : plan.priceDisplay}
              </Text>
              <Badge color="green" variant="light">
                {t('subscription.feeWaived', {
                  amount: formatBankTransferFeeDiscountAmount(bankTransferFeeAmount),
                })}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" td="line-through">
              {t('subscription.regularPrice')} {bankTransferPriceDisplay}
            </Text>
          </Stack>
        ) : (
          <Text c="blue" size="xl" fw={700} mt="md">
            {bankTransferPriceDisplay}
          </Text>
        )}
        {isFirstMonthDiscountAvailable &&
          plan.payment_method === 'stripe' &&
          plan.id === 'basic_monthly' &&
          discountedMonthlyAmount !== null && (
            <Box
              mt="sm"
              p="sm"
              style={{
                border: '1px solid var(--mantine-color-green-3)',
                borderRadius: 8,
                background: 'var(--mantine-color-green-0)',
              }}
            >
              <Text c="green.8" fw={800} fz="lg" ta="center">
                {t('subscription.firstMonthDiscount', {
                  amount: monthlyDiscountAmount?.toLocaleString(),
                })}
              </Text>
              <Text c="green.9" fw={900} fz="xl" ta="center">
                {discountedMonthlyAmount === 500
                  ? t('subscription.oneCoin')
                  : t('subscription.specialPrice')}{' '}
                {t('subscription.tryFor', { amount: discountedMonthlyAmount.toLocaleString() })}
              </Text>
            </Box>
          )}
        <img
          src={getImage(plan.id)}
          alt={t('subscription.planImage', {
            name: t(`subscription.plans.${plan.id}.name`, plan.name),
          })}
          style={{
            display: 'block',
            width: '100%',
            height: 180,
            objectFit: 'contain',
            marginBottom: 'var(--mantine-spacing-md)',
          }}
        />
        <List
          spacing="xs"
          size="sm"
          center
          mt="md"
          icon={
            <ThemeIcon color="teal" size={24} radius="xl">
              <IconCheck size="1rem" />
            </ThemeIcon>
          }
        >
          {(plan.features || []).map(
            (feature, index) =>
              feature && (
                <List.Item key={index}>
                  {t(`subscription.plans.${plan.id}.features.${index}`, feature)}
                </List.Item>
              )
          )}
        </List>
        {plan.payment_method === 'bank' && (
          <Button
            variant="light"
            color="blue"
            fullWidth
            mt="xs"
            radius="md"
            onClick={() => onSelectBankTransfer(plan.id)}
            loading={isBankTransferLoading}
          >
            {isFirstMonthDiscountAvailable
              ? t('subscription.applyBankNoFee')
              : t('subscription.applyBank')}
          </Button>
        )}
        {plan.payment_method === 'stripe' && (
          <Button
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
            fullWidth
            mt="xs"
            radius="md"
            onClick={() => onSelectStripe(plan.id)}
            loading={isStripeLoading}
            disabled={!isStripeCheckoutAvailable}
          >
            {isFirstMonthDiscountAvailable
              ? t('subscription.applyWithDiscount', {
                  amount: formatFirstMonthDiscountAmount(
                    plan.id,
                    firstMonthDiscountAmountByPlanId
                  ),
                })
              : t('subscription.applyCard')}
          </Button>
        )}
      </Card>
    </Grid.Col>
  );
};

const PlanSelection: React.FC<PlanSelectionProps> = ({
  availablePlans,
  onSelectBankTransfer,
  onSelectStripe,
  isBankTransferLoading,
  isStripeLoading, // propsから受け取る
  isFirstMonthDiscountAvailable = false,
  firstMonthDiscountAmountByPlanId = DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID,
  bankTransferFeeAmount = DEFAULT_BANK_TRANSFER_FEE_AMOUNT,
  isStripeCheckoutAvailable = true,
}) => {
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';
  const bankTransferPlans =
    isJapanese
      ? availablePlans.filter((plan) => plan.payment_method === 'bank' && plan.display)
      : [];
  const stripePlans = availablePlans.filter(
    (plan) =>
      plan.payment_method === 'stripe' &&
      plan.display &&
      (isJapanese || plan.id === 'basic_monthly')
  );

  return (
    <>
      {bankTransferPlans.length > 0 && (
        <Stack mt="lg">
          <Title order={4} ta="center" c="dimmed">
            {t('subscription.bankPayment')}
          </Title>
          <Grid>
            {bankTransferPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelectBankTransfer={onSelectBankTransfer}
                onSelectStripe={onSelectStripe}
                isBankTransferLoading={isBankTransferLoading}
                isStripeLoading={isStripeLoading}
                isFirstMonthDiscountAvailable={isFirstMonthDiscountAvailable}
                firstMonthDiscountAmountByPlanId={firstMonthDiscountAmountByPlanId}
                bankTransferFeeAmount={bankTransferFeeAmount}
                isStripeCheckoutAvailable={isStripeCheckoutAvailable}
              />
            ))}
          </Grid>
        </Stack>
      )}

      {stripePlans.length > 0 && (
        <Stack mt="lg">
          <Title order={4} ta="center" c="dimmed">
            {t('subscription.cardPayment')}
          </Title>
          <Grid>
            {stripePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelectBankTransfer={onSelectBankTransfer}
                onSelectStripe={onSelectStripe}
                isBankTransferLoading={isBankTransferLoading}
                isStripeLoading={isStripeLoading}
                isFirstMonthDiscountAvailable={isJapanese && isFirstMonthDiscountAvailable}
                firstMonthDiscountAmountByPlanId={firstMonthDiscountAmountByPlanId}
                bankTransferFeeAmount={bankTransferFeeAmount}
                isStripeCheckoutAvailable={isStripeCheckoutAvailable}
              />
            ))}
          </Grid>
        </Stack>
      )}

      {bankTransferPlans.length === 0 && stripePlans.length === 0 && (
        <Text c="dimmed" ta="center" mt="md">
          {t('subscription.noPlans')}
        </Text>
      )}
    </>
  );
};

export default PlanSelection;
