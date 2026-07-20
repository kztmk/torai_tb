// src/pages/Profile/SubscriptionManagement.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js'; // Stripe.jsをインポート
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useLocation, useNavigate, useRouteLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Paper, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals'; // modals をインポート
import { notifications } from '@mantine/notifications';
import planDataJSON from '@/data/subscriptionPlan.json';
import { db } from '@/firebase';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks'; // useAppSelector をインポート
import {
  formatPublicSubscriptionAmount,
  useUsdMonthlyPrice,
} from '@/hooks/usePublicSubscriptionPricing';

import {
  resetTask,
  SerializedBankPaymentInfo,
  SerializedFirstMonthDiscount,
} from '@/store/reducers/auth';
// clearAuthError をインポート (必要に応じて)
import {
  requestBankTransfer,
  requestBankTransferConfirmationThunk,
} from '@/store/reducers/auth/userThunks';
import {
  clearCheckoutError,
  createCheckoutSessionThunk, // ローディング状態セレクタをインポート
} from '@/store/reducers/subscriptionSlice';
import {
  DEFAULT_BANK_TRANSFER_FEE_AMOUNT,
  DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID,
  fetchFirstMonthDiscountConfig,
  formatBankTransferFeeDiscountAmount,
  formatFirstMonthDiscountRemaining,
} from '@/utils/firstMonthDiscount';
// clearCheckoutError をインポート
import BankTransferRequestInfo from './BankTransferRequestInfo';
import CurrentSubscriptionDetails from './CurrentSubscriptionDetails';
import MokumokurenCouponCard from './MokumokurenCouponCard';
import PlanSelection from './PlanSelection';

interface SubscriptionManagementProps {
  onOpenReferralProgram?: () => void;
}

// LoaderDataの型定義 (ProfilePageから移動してきたもの、または共通化)
interface LoaderData {
  user: any; // Firebase User型など、適切な型に
  termsAccepted: boolean | null;
  subscriptionStatus:
    | 'active'
    | 'trialing'
    | 'inactive'
    | 'canceled'
    | 'past_due'
    | 'incomplete'
    | 'incomplete_expired'
    | null;
  planId: string | null;
  currentPeriodEnd: string | null;
  canceledAtPeriodEnd: boolean;
  canceledAt: string | null;
  pendingPlanChange?: {
    fromPlanId: string | null;
    toPlanId: string | null;
    effectiveDate: string | null;
  } | null;
  endedAt: string | null;
  stripeCustomerId?: string;
  bankPaymentInfo?: UserSubscription['bankPaymentInfo'];
  firstMonthDiscount?: SerializedFirstMonthDiscount | null;
}

export interface Plan {
  id: string;
  name: string;
  priceDisplay: string;
  amount?: number;
  description?: string;
  features: string[];
  image?: string;
  isCurrent?: boolean;
  isRecommended?: boolean;
  payment_method: string;
  display: boolean;
}

export interface UserSubscription {
  status:
    | 'active'
    | 'trialing'
    | 'inactive'
    | 'canceled'
    | 'past_due'
    | 'incomplete'
    | 'incomplete_expired'
    | null;
  planId: string | null;
  planName?: string;
  currentPeriodEnd?: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  endedAt?: string | null;
  pendingPlanChange?: {
    fromPlanId: string | null;
    fromPlanName?: string;
    toPlanId: string | null;
    toPlanName?: string;
    effectiveDate: string | null;
  } | null;
  bankPaymentInfo?: SerializedBankPaymentInfo | null;
  firstMonthDiscount?: SerializedFirstMonthDiscount | null;
}

// 利用可能なプランの型を合わせる
const baseAvailablePlans: Plan[] = planDataJSON.map((p) => ({
  id: p.id,
  name: p.name,
  priceDisplay: p.priceDisplay,
  amount: p.amount,
  description: p.description,
  features: p.features,
  isRecommended: p.isRecommended,
  payment_method: p.payment_method,
  display: p.display,
}));

// Stripe公開キーを環境変数から取得
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({
  onOpenReferralProgram,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';
  const locale = isJapanese ? 'ja-JP' : 'en-US';
  const {
    price: usdMonthlyPrice,
    loading: usdPricingLoading,
    error: usdPricingError,
  } = useUsdMonthlyPrice(!isJapanese);
  const availablePlans = useMemo<Plan[]>(() => {
    if (isJapanese) {
      return baseAvailablePlans;
    }
    const monthlyPlan = baseAvailablePlans.find(
      (plan) => plan.id === 'basic_monthly' && plan.payment_method === 'stripe'
    );
    if (monthlyPlan === undefined) {
      return [];
    }
    const priceDisplay =
      usdMonthlyPrice !== null
        ? `${formatPublicSubscriptionAmount(usdMonthlyPrice, locale)}${t('subscription.perMonth')}`
        : usdPricingLoading
          ? t('subscription.priceLoading')
          : t('subscription.priceUnavailable');
    return [
      {
        ...monthlyPlan,
        amount:
          usdMonthlyPrice !== null ? usdMonthlyPrice.unitAmount / 100 : undefined,
        priceDisplay,
        isRecommended: false,
      },
    ];
  }, [isJapanese, locale, t, usdMonthlyPrice, usdPricingLoading]);
  const isStripeCheckoutAvailable = isJapanese || usdMonthlyPrice !== null;
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  const checkoutError = useAppSelector((state) => state.subscription.checkoutError);
  const checkoutLoading = useAppSelector((state) => state.subscription.checkoutLoading);
  const sessionId = useAppSelector((state) => state.subscription.sessionId); // ストアからsessionIdを取得
  const sessionUrl = useAppSelector((state) => state.subscription.sessionUrl);
  const loaderData = useRouteLoaderData('mainLayout') as LoaderData | null;
  console.log('[SubscriptionManagement] loaderData:', loaderData);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reason') === 'inactive_subscription') {
      notifications.show({
        title: t('subscription.notice'),
        message: t('subscription.selectPlan'),
        color: 'blue',
        autoClose: 5000,
      });
    }
    if (params.get('payment_success') === 'true') {
      notifications.show({
        title: t('subscription.paymentComplete'),
        message: t('subscription.paymentCompleteMessage'),
        color: 'green',
        autoClose: 7000,
      });
    } else if (params.get('payment_canceled') === 'true') {
      notifications.show({
        title: t('subscription.paymentCanceled'),
        message: t('subscription.paymentCanceledMessage'),
        color: 'orange',
        autoClose: 7000,
      });
    }

    if (params.has('payment_success') || params.has('payment_canceled') || params.has('reason')) {
      // navigate('/profile', { replace: true }); // ProfilePage側でクリアするのでここでは不要かも
      // dispatch(clearCheckoutError()); // ProfilePage側でクリア
    }
  }, [location.search, navigate, dispatch, t]);

  // Checkout URLがセットされたらStripe Checkoutに直接リダイレクト
  useEffect(() => {
    if (sessionUrl && !checkoutError) {
      console.info('[StripeCheckout] redirect to Checkout URL', {
        sessionId,
        hasCheckoutUrl: Boolean(sessionUrl),
      });
      const checkoutUrl = sessionUrl;
      dispatch(clearCheckoutError());
      window.location.assign(checkoutUrl);
    }
  }, [sessionUrl, checkoutError, sessionId, dispatch]);

  // 古いFunctionsレスポンス互換: sessionIdのみ返る場合はStripe.jsでリダイレクト
  useEffect(() => {
    if (sessionId && !sessionUrl && !checkoutError) {
      console.info('[StripeCheckout] redirectToCheckout start', {
        sessionId,
        hasCheckoutError: Boolean(checkoutError),
        hasPublishableKey: Boolean(STRIPE_PUBLISHABLE_KEY),
      });
      stripePromise
        .then((stripe) => {
          if (stripe) {
            stripe.redirectToCheckout({ sessionId }).then((result) => {
              if (result.error) {
                console.error('Stripe redirectToCheckout error:', {
                  sessionId,
                  message: result.error.message,
                  type: result.error.type,
                  code: result.error.code,
                });
                dispatch(clearCheckoutError()); // エラーをクリアする
                notifications.show({
                  title: t('subscription.redirectError'),
                  message: `${t('subscription.stripeRedirectFailed')} ${result.error.message}`,
                  color: 'red',
                });
              }
            });
          } else {
            console.error('Stripe.js has not loaded correctly.', {
              hasPublishableKey: Boolean(STRIPE_PUBLISHABLE_KEY),
              sessionId,
            });
          }
        })
        .catch((error) =>
          console.error('Error in stripePromise chain:', {
            sessionId,
            message: error?.message,
            rawError: error,
          })
        );
    }
  }, [sessionId, sessionUrl, checkoutError, dispatch, t]);

  if (!loaderData) {
    return <Text c="red">{t('subscription.loadFailed')}</Text>;
  }

  const {
    subscriptionStatus,
    planId: loaderPlanId,
    currentPeriodEnd,
    canceledAtPeriodEnd,
    canceledAt,
    pendingPlanChange: loaderPendingPlanChange,
    endedAt,
    bankPaymentInfo: loaderBankPaymentInfo,
    stripeCustomerId,
    firstMonthDiscount: loaderFirstMonthDiscount,
  } = loaderData;

  const currentUserSubscription: UserSubscription | null = {
    status: subscriptionStatus,
    planId: loaderPlanId,
    planName: availablePlans.find((p) => p.id === loaderPlanId)?.name,
    stripeCustomerId,
    currentPeriodEnd: currentPeriodEnd || null,
    canceledAt,
    endedAt,
    cancelAtPeriodEnd: canceledAtPeriodEnd,
    pendingPlanChange: loaderPendingPlanChange
      ? {
          fromPlanId: loaderPendingPlanChange.fromPlanId,
          fromPlanName:
            availablePlans.find((p) => p.id === loaderPendingPlanChange.fromPlanId)?.name ||
            t('subscription.current.previousPlan'),
          toPlanId: loaderPendingPlanChange.toPlanId,
          toPlanName:
            availablePlans.find((p) => p.id === loaderPendingPlanChange.toPlanId)?.name ||
            t('subscription.current.newPlan'),
          effectiveDate: loaderPendingPlanChange.effectiveDate,
        }
      : null,
    bankPaymentInfo: loaderBankPaymentInfo || null,
    firstMonthDiscount: loaderFirstMonthDiscount || null,
  };

  // authスライスから銀行振込処理に関連する状態を取得
  const {
    user: authUser,
    loading: authLoading,
    error: authError,
    task: authTask,
    // user: authUser, // authUser は直接使わないのでコメントアウトまたは削除
  } = useAppSelector((state) => state.auth);
  const [discountNow, setDiscountNow] = useState(() => Date.now());
  const [firstMonthDiscountAmountByPlanId, setFirstMonthDiscountAmountByPlanId] = useState(
    DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID
  );
  const [bankTransferFeeAmount, setBankTransferFeeAmount] = useState(
    DEFAULT_BANK_TRANSFER_FEE_AMOUNT
  );
  const bankPaymentInfo = authUser.bankPaymentInfo; // currentUserSubscriptionから取得
  const firstMonthDiscount =
    currentUserSubscription.firstMonthDiscount || authUser.firstMonthDiscount || null;
  const firstMonthDiscountRemaining = formatFirstMonthDiscountRemaining(
    firstMonthDiscount?.expiresAt,
    discountNow
  );
  const isFirstMonthDiscountAvailable =
    isJapanese &&
    firstMonthDiscount?.status === 'eligible' &&
    Boolean(firstMonthDiscountRemaining);
  const bankPaymentWaiting =
    bankPaymentInfo?.status === 'payment_requested' ||
    bankPaymentInfo?.status === 'pending_confirmation';
  const [bankTransferName, setBankTransferName] = useState(''); // ★ 振込名義入力用のstate

  useEffect(() => {
    if (!firstMonthDiscount?.expiresAt) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setDiscountNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [firstMonthDiscount?.expiresAt]);

  useEffect(() => {
    if (!isJapanese) {
      return undefined;
    }
    let cancelled = false;

    fetchFirstMonthDiscountConfig(db)
      .then((config) => {
        if (!cancelled) {
          setFirstMonthDiscountAmountByPlanId(config.amountByPlanId);
          setBankTransferFeeAmount(config.bankTransferFeeAmount);
        }
      })
      .catch((error) => {
        console.warn('Failed to load first month discount config. Using defaults.', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isJapanese]);

  const isActiveOrTrialing =
    currentUserSubscription?.status === 'active' ||
    currentUserSubscription?.status === 'trialing' ||
    currentUserSubscription?.status === 'past_due'; // past_due もアクティブ系として扱う
  const currentPlanDetails = isActiveOrTrialing
    ? availablePlans.find((p) => p.id === currentUserSubscription?.planId) ||
      baseAvailablePlans.find((p) => p.id === currentUserSubscription?.planId)
    : null;
  const handleStripePayment = async (planId: string) => {
    console.info('[StripeCheckout] plan selected', {
      planId,
      firstMonthDiscountStatus: firstMonthDiscount?.status ?? null,
      firstMonthDiscountExpiresAt: firstMonthDiscount?.expiresAt ?? null,
      isFirstMonthDiscountAvailable,
    });
    // Stripe決済に関するエラーがあればクリア
    if (checkoutError) {
      dispatch(clearCheckoutError());
    }
    try {
      await dispatch(createCheckoutSessionThunk({ planId })).unwrap();
    } catch (error: any) {
      console.error('[StripeCheckout] checkout session creation failed', {
        planId,
        message: typeof error === 'string' ? error : error?.message,
        rawError: error,
      });
      notifications.show({
        title: t('subscription.redirectError'),
        message:
          typeof error === 'string'
            ? error
            : error?.message || t('subscription.stripeRedirectFailed'),
        color: 'red',
      });
    }
  };

  // 銀行振込処理のローディング状態を判定
  const isBankTransferLoading = authLoading && authTask === 'requesting_bank_transfer';

  // 銀行振込処理の結果を監視して通知を表示
  useEffect(() => {
    // authTask が 'bank_transfer_success' または 'bank_transfer_error' の場合に通知を表示し、タスクをリセット
    if (
      authTask === 'request_bank_transfer_success' ||
      authTask === 'request_bank_transfer_error'
    ) {
      if (authTask === 'request_bank_transfer_success') {
        notifications.show({
          title: 'お申込み受付完了',
          message: '銀行振込でのお申込み情報を含むメールを送信しました。ご確認ください。',
          color: 'green',
          icon: <IconCheck size="1rem" />,
        });
      } else if (authTask === 'request_bank_transfer_error' && authError) {
        notifications.show({
          title: 'お申込みエラー',
          message: authError || '銀行振込のお申込み処理中にエラーが発生しました。',
          color: 'red',
          icon: <IconAlertCircle size="1rem" />,
        });
      }
      dispatch(resetTask()); // 成功・失敗どちらの場合もタスク状態をリセット
    }
  }, [authTask, authError, dispatch]);

  const handleRequestBankTransfer = (planId: string) => {
    // 既に処理中の場合は何もしない
    if (isBankTransferLoading) {
      return;
    }
    console.log(`銀行振込ボタンをクリック`);
    modals.openConfirmModal({
      title: '銀行振込お申込み確認',
      centered: true,
      children: (
        <Text size="sm">
          {isFirstMonthDiscountAvailable
            ? `初回限定割引により、銀行振込の事務手数料${formatBankTransferFeeDiscountAmount(bankTransferFeeAmount)}は免除されます。`
            : `銀行振込の場合には事務手数料${formatBankTransferFeeDiscountAmount(bankTransferFeeAmount)}(税込)が別途必要です。`}
          <br />
          お申込みを続けますか？
        </Text>
      ),
      labels: { confirm: '申込みを続ける', cancel: 'キャンセル' },
      confirmProps: { color: 'blue' },
      onConfirm: () => {
        notifications.show({
          id: 'bank-transfer-processing',
          title: '処理中',
          message: '銀行振込のお申込み処理を行っています...',
          loading: true,
          autoClose: false,
          withCloseButton: false,
        });
        dispatch(requestBankTransfer({ planId }))
          .unwrap()
          .then((response) => {
            console.log('銀行振込申込 成功:', response.message);
            notifications.hide('bank-transfer-processing'); // ローディング通知を隠す (成功通知はuseEffectで表示)
          })
          .catch((err) => {
            console.error('銀行振込申込 失敗:', err);
            notifications.hide('bank-transfer-processing'); // ローディング通知を隠す (エラー通知はuseEffectで表示)
          });
      },
      onCancel: () => {
        console.log('銀行振込の申込みをキャンセルしました。');
      },
    });
  };

  const handleBankTransferConfirmationRequest = (transferName: string) => {
    if (!transferName.trim()) {
      notifications.show({
        title: '入力エラー',
        message: '振込名義を入力してください。',
        color: 'red',
      });
      return;
    }
    // 管理者への確認依頼を送信する
    dispatch(requestBankTransferConfirmationThunk({ transferName }));
    console.log(`「振込完了確認リクエスト」ボタンがクリックされました。振込名義: ${transferName}`);
    notifications.show({
      title: 'リクエスト送信',
      message: '振込完了確認リクエストを送信しました。管理者からの連絡をお待ちください。',
      color: 'blue',
    });
  };

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    notifications.show({
      id: 'manage-subscription-loading',
      title: t('subscription.processing'),
      message: t('subscription.openingPortal'),
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      const app = getApp();
      const functions = getFunctions(app, 'asia-northeast1');
      const createPortalLinkCallable = httpsCallable(functions, 'createStripePortalLink');
      const result = (await createPortalLinkCallable()) as { data: { url: string } };

      notifications.hide('manage-subscription-loading');
      if (result.data.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Portal URL not found in response.');
      }
    } catch (error) {
      console.error('Error creating Stripe portal link:', error);
      notifications.update({
        id: 'manage-subscription-loading',
        title: t('common.error'),
        message: t('subscription.portalFailed'),
        color: 'red',
        loading: false,
        autoClose: 7000,
      });
      setIsManagingSubscription(false);
    }
  };

  return (
    <Paper withBorder shadow="md" p="xl" radius="md">
      <Stack>
        <Title order={2} ta="center" mb="lg">
          {t('subscription.management')}
        </Title>

        {checkoutError !== null && checkoutError !== '' && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title={t('common.error')}
            color="red"
            mb="md"
            withCloseButton
            onClose={() => {
              dispatch(clearCheckoutError()); // エラーをクリアする Redux Action を dispatch
            }}
          >
            {checkoutError}
          </Alert>
        )}

        {isActiveOrTrialing && currentUserSubscription ? (
          <CurrentSubscriptionDetails
            currentUserSubscription={currentUserSubscription}
            currentPlanDetails={currentPlanDetails}
            onManageSubscription={handleManageSubscription}
            onOpenReferralProgram={onOpenReferralProgram}
          />
        ) : (
          // プランがアクティブでない場合の表示 (プラン選択など)
          <Stack>
            {/* Canceled Status Information */}
            {currentUserSubscription?.status === 'canceled' && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title={t('subscription.current.subscriptionInformation')}
                color="gray"
                mb="lg"
              >
                <Text>
                  {t('subscription.current.canceledPlan', {
                    plan:
                      currentUserSubscription.planName ||
                      availablePlans.find((p) => p.id === currentUserSubscription?.planId)?.name ||
                      t('subscription.current.unknownPlan'),
                  })}
                </Text>
                {currentUserSubscription.endedAt && (
                  <Text size="sm" c="dimmed">
                    {t('subscription.current.endedAt')}: {new Date(currentUserSubscription.endedAt).toLocaleDateString(locale)}
                  </Text>
                )}
                {currentUserSubscription.canceledAt && !currentUserSubscription.endedAt && (
                  <Text size="sm" c="dimmed">
                    {t('subscription.current.cancelRequested')}: {new Date(currentUserSubscription.canceledAt).toLocaleDateString(locale)}
                  </Text>
                )}
                {currentUserSubscription.stripeCustomerId && (
                  <Button
                    onClick={handleManageSubscription}
                    mt="md"
                    variant="outline"
                    size="xs"
                    loading={isManagingSubscription}
                  >
                    {t('subscription.current.viewPastSubscription')}
                  </Button>
                )}
                <Text mt="sm">{t('subscription.current.chooseNewPlan')}</Text>
              </Alert>
            )}

            {/* Other Inactive Statuses */}
            {currentUserSubscription?.status !== 'canceled' && (
              <Text ta="center" c="dimmed" mb="md">
                {currentUserSubscription?.status === 'past_due' &&
                  t('subscription.current.pastDueAction')}
                {currentUserSubscription?.status === 'incomplete' &&
                  t('subscription.current.incompleteAction')}
                {currentUserSubscription?.status === 'incomplete_expired' &&
                  t('subscription.current.expiredAction')}
                {(!currentUserSubscription?.status ||
                  currentUserSubscription?.status === 'inactive') &&
                  (!isJapanese || !bankPaymentWaiting) &&
                  t('subscription.noActivePlan')}
              </Text>
            )}

            {/* Plan Selection Grid */}
            {(!isJapanese || !bankPaymentWaiting) && (
              <>
                {!isJapanese && usdPricingError !== null && (
                  <Alert
                    icon={<IconAlertCircle size="1rem" />}
                    title={t('subscription.priceUnavailable')}
                    color="red"
                    mb="md"
                  >
                    {t('subscription.priceUnavailableMessage')}
                  </Alert>
                )}
                {isFirstMonthDiscountAvailable && (
                  <Paper
                    role="status"
                    aria-live="polite"
                    mb="md"
                    px={{ base: 'md', sm: 'xl' }}
                    py={{ base: 'md', sm: 'lg' }}
                    radius={0}
                    style={{
                      background: '#ffd900',
                      border: '2px solid #111',
                      boxShadow: '0 8px 0 #111',
                    }}
                  >
                    <Text
                      ta="center"
                      fw={900}
                      c="black"
                      style={{
                        fontSize: 'clamp(1.05rem, 2.8vw, 1.75rem)',
                        lineHeight: 1.25,
                      }}
                    >
                      {t('subscription.discountRemaining', { time: firstMonthDiscountRemaining })}
                    </Text>
                    <Text ta="center" fw={700} c="black" mt={6} size="sm">
                      {t('subscription.discountCardNotice')}
                      {isJapanese && (
                        <>
                          {' '}
                          {t('subscription.discountBankNotice', {
                            amount: formatBankTransferFeeDiscountAmount(bankTransferFeeAmount),
                          })}
                        </>
                      )}
                    </Text>
                  </Paper>
                )}
                <PlanSelection
                  availablePlans={availablePlans}
                  currentUserSubscription={currentUserSubscription}
                  onSelectBankTransfer={handleRequestBankTransfer}
                  onSelectStripe={handleStripePayment}
                  isBankTransferLoading={isBankTransferLoading}
                  isStripeLoading={checkoutLoading === 'pending'}
                  isFirstMonthDiscountAvailable={isFirstMonthDiscountAvailable}
                  firstMonthDiscountAmountByPlanId={firstMonthDiscountAmountByPlanId}
                  bankTransferFeeAmount={bankTransferFeeAmount}
                  isStripeCheckoutAvailable={isStripeCheckoutAvailable}
                />
              </>
            )}
          </Stack>
        )}

        {/* 特典クーポンは発行済みであれば契約状態に関わらず表示（未発行時はカード側で非表示） */}
        <MokumokurenCouponCard />

        {/* 銀行振込の確認リクエストフォーム (サブスクリプションの状態とは独立して表示) */}
        {isJapanese &&
          bankPaymentInfo &&
          (bankPaymentInfo.status === 'payment_requested' ||
            bankPaymentInfo.status === 'pending_confirmation' ||
            bankPaymentInfo.status === 'renewal_requested') && (
            <BankTransferRequestInfo
              bankPaymentInfo={bankPaymentInfo}
              bankTransferName={bankTransferName}
              setBankTransferName={setBankTransferName}
              onConfirmTransfer={handleBankTransferConfirmationRequest}
            />
          )}
      </Stack>
    </Paper>
  );
};

export default SubscriptionManagement;
