import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { useLocation, useNavigate, useRouteLoaderData } from 'react-router-dom'; // Changed to react-router-dom for useRouteLoaderData
import { Container, Stack, Tabs, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/rtkhooks'; // Reduxフック

import { SerializedBankPaymentInfo } from '@/store/reducers/auth/types';
import ApiKeySettings from './ApiKeys'; // ApiKeySettings のインポート
import BasicInfo from './basicInfo/BasicInfo';
import DeleteUserAccount from './basicInfo/DeleteUserAccount';
import ReferralProgram from './ReferralProgram';
import SubscriptionManagement from './subscriptionManagement/';

interface LoaderData {
  user: User | null;
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
  currentPeriodEnd: { seconds: number; nanoseconds: number } | null; // Firestore Timestamp
  canceledAtPeriodEnd: boolean;
  canceledAt: Date | null;
  pendingPlanChange?: {
    fromPlanId: string;
    toPlanId: string;
    effectiveDate: { seconds: number; nanoseconds: number }; // Firestore Timestamp
  } | null;
  endedAt: Date | null;
  bankPaymentInfo?: SerializedBankPaymentInfo | null;
  stripeCustomerId?: string | null; // ★ stripeCustomerId を追加
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch(); // clearCheckoutError を dispatch するために追加
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    // このログは ProfilePage がマウントされる（または再マウントされる）たびに表示されるはず
    console.log(
      `ProfilePage: useState initializer for activeTab called. Setting to 'subscription'. Instance: ${Math.random()}`
    );
    return 'subscription';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search); // location.search が変更されたときにエフェクトを実行
    // このuseEffectは決済関連のクエリパラメータをクリアするためだけに残すか、
    // SubscriptionManagement側で通知表示後にクリアする形でも良い
    if (params.has('payment_success') || params.has('payment_canceled') || params.has('reason')) {
      // navigate('/profile', { replace: true }); // コメントアウト継続
      // dispatch(clearCheckoutError()); // コメントアウト継続
    }
  }, [location.search, navigate, dispatch]); // location.search が変更されたときにエフェクトを実行
  // React Router v7では親ルートからデータを取得する場合は useRouteLoaderData を使用
  // mainLayout は親ルートに定義されたIDに合わせる必要があります
  const loaderData = useRouteLoaderData('mainLayout') as LoaderData | null;
  // Debugging logs from previous step - keep them to observe
  console.log(`ProfilePage rendering. Current activeTab state from useState: ${activeTab}`);
  // useEffect を使って、activeTab の値が実際に変更されたときだけログを出す
  useEffect(() => {
    console.log(`ProfilePage: activeTab value changed to: ${activeTab}`);
  }, [activeTab]);
  useEffect(() => {
    if (!isJapanese && activeTab === 'referral') {
      setActiveTab('subscription');
    }
  }, [activeTab, isJapanese]);
  console.log(
    'Received loaderData (from useRouteLoaderData):',
    loaderData ? JSON.stringify(loaderData, null, 2) : 'null'
  );
  if (loaderData) {
    console.log(
      'loaderData.user (from useRouteLoaderData):',
      loaderData.user ? `UID: ${loaderData.user.uid}` : 'null'
    );
  } else {
    console.log('loaderData is null or undefined');
  }

  if (!loaderData || !loaderData.user) {
    console.error('ProfilePage: loaderData or loaderData.user is null/undefined. Showing error.');
    return (
      <Container size="lg" py="xl">
        <Text c="red">{t('profile.loadFailed')}</Text>
      </Container>
    );
  }
  console.log('ProfilePage: loaderData.user is valid. Proceeding to render profile.');
  const { user } = loaderData;

  return (
    <Container size="lg" py="xl">
      <Title order={1} ta="center" mb="xl">
        {t('profile.title')}
      </Title>
      <Tabs
        // defaultValue="subscription" // defaultValue を削除
        value={activeTab} // value プロパティで状態をバインド
        keepMounted={false}
        // key={location.key} // コメントアウト継続
        onChange={(value) => {
          console.log('Tab explicitly changed by user or programmatically to:', value);
          setActiveTab(value);
        }}
      >
        {' '}
        {/* location.keyを追加してタブの再レンダリングを促す */}
        <Tabs.List grow>
          <Tabs.Tab value="subscription">{t('subscription.title')}</Tabs.Tab>
          {isJapanese && (
            <Tabs.Tab value="referral">{t('profile.tabs.referral')}</Tabs.Tab>
          )}
          <Tabs.Tab value="account">{t('profile.tabs.account')}</Tabs.Tab>
          <Tabs.Tab value="apiKeys">{t('profile.tabs.apiKeys')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="subscription" pt="lg">
          <SubscriptionManagement
            onOpenReferralProgram={
              isJapanese ? () => setActiveTab('referral') : undefined
            }
          />
        </Tabs.Panel>
        {isJapanese && (
          <Tabs.Panel value="referral" pt="lg">
            <ReferralProgram />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="account" pt="lg">
          <Stack gap="xl">
            <BasicInfo authUser={user} />
            <DeleteUserAccount />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="apiKeys" pt="lg">
          <ApiKeySettings />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
