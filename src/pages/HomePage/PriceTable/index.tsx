import React from 'react';
import { IconCheck, IconMessageCircleCheck } from '@tabler/icons-react';
import {
  Badge,
  Card,
  Center,
  Grid,
  Group,
  Image, // Image をインポート
  List,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useHover } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import image_half_yearly from '@/assets/images/half_yearly.png';
import image_monthly from '@/assets/images/monthly.png';
import image_yearly from '@/assets/images/yearly.png';
import {
  formatPublicSubscriptionAmount,
  useUsdMonthlyPrice,
} from '@/hooks/usePublicSubscriptionPricing';

// このファイル専用のプランの型定義
interface PricePlan {
  id: string;
  name: string;
  description?: string;
  priceDisplay: string;
  image: string; // インポートされた画像モジュール (ビルド時に文字列パスになる)
  features?: string[];
  isRecommended?: boolean;
  payment_method: 'stripe' | 'bank' | ('stripe' | 'bank')[]; // 単一または複数の支払い方法
  display: boolean;
}

const tablePlansData: PricePlan[] = [
  {
    id: 'basic_monthly',
    name: '1ヶ月プラン',
    description: '1ヶ月間のご利用プランです。気軽にお試しいただけます。',
    priceDisplay: '¥1280/月(通常1,480円)',
    image: image_monthly,
    features: ['全ての機能へのアクセス', 'メールサポート'],
    isRecommended: false,
    payment_method: 'stripe',
    display: true,
  },
  {
    id: 'half_yearly',
    name: '6ヶ月プラン',
    description:
      '半年間のご利用プランです。25％お得になります。銀行振込のご利用も可能です。',
    priceDisplay: '¥6,800/6ヶ月',
    image: image_half_yearly,
    features: ['全ての機能へのアクセス', 'メールサポート', '月額換算 約¥1133'],
    isRecommended: false,
    payment_method: ['stripe', 'bank'], // クレジットカードと銀行振込に対応
    display: true,
  },
  {
    id: 'yearly',
    name: '1年プラン',
    description: '1年間のご利用プランです。もっとお得なプランです。',
    priceDisplay: '¥12,000/年',
    image: image_yearly,
    features: ['全ての機能へのアクセス', 'メールサポート', '月額換算 ¥1000', '年間最大の割引'],
    isRecommended: true,
    payment_method: 'stripe',
    display: true,
  },
];

const PriceTable: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';
  const locale = i18n.resolvedLanguage || 'en';
  const { price: usdMonthlyPrice, loading: usdPricingLoading } =
    useUsdMonthlyPrice(!isJapanese);
  const plansToDisplay = tablePlansData
    .filter((plan) => plan.display && (isJapanese || plan.id === 'basic_monthly'))
    .map((plan) =>
      !isJapanese && plan.id === 'basic_monthly'
        ? {
            ...plan,
            priceDisplay:
              usdMonthlyPrice !== null
                ? `${formatPublicSubscriptionAmount(usdMonthlyPrice, locale)}${t('subscription.perMonth')}`
                : usdPricingLoading
                  ? t('subscription.priceLoading')
                  : t('subscription.priceUnavailable'),
            isRecommended: false,
          }
        : plan
    );

  const RenderPlanCard: React.FC<{ plan: PricePlan }> = ({ plan }) => {
    const { hovered, ref } = useHover(); // 各カードインスタンスごとにuseHoverを呼び出す

    return (
      // Grid.Col の key は map 側で設定されるため、ここでは不要 (あっても害はない)
      // しかし、コンポーネントのトップレベル要素にkeyがある方がReactの作法に沿うため、map側で設定するのが一般的
      <Grid.Col span={{ base: 12, sm: 4, md: 4, lg: 4 }}>
        <Card
          ref={ref}
          padding="lg"
          radius="md"
          withBorder
          shadow={hovered ? 'lg' : 'sm'}
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
            cursor: 'pointer',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <Card.Section inheritPadding py="xs">
            <Image
              src={plan.image}
              alt={t('subscription.planImage', {
                name: t(`subscription.plans.${plan.id}.name`, plan.name),
              })}
              height={180} // 高さは適宜調整してください
              fit="contain" // または "cover" など、画像の表示方法に合わせて調整
              mb="md"
            />
            <Group justify="space-between">
              <Title order={3}>{t(`subscription.plans.${plan.id}.name`, plan.name)}</Title>
              {plan.isRecommended && <Badge color="pink">{t('subscription.recommended')}</Badge>}
            </Group>
            <Text size="sm" c="dimmed" mt="xs">
              {t(`subscription.plans.${plan.id}.description`, plan.description || '')}
            </Text>
          </Card.Section>

          <Text c="blue" size="xl" fw={700} mt="md">
            {plan.priceDisplay}
          </Text>

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
            style={{ flexGrow: 1 }}
          >
            {/* plan.features が undefined の場合にエラーにならないように || [] を追加 */}
            {(plan.features || []).map(
              (feature, index) =>
                feature && (
                  <List.Item key={index}>
                    {t(`subscription.plans.${plan.id}.features.${index}`, feature)}
                  </List.Item>
                )
            )}
          </List>
        </Card>
      </Grid.Col>
    );
  };

  return (
    <>
      {plansToDisplay.length > 0 && (
        <Stack mt="lg">
          <Title order={2} ta="center" mb="xl">
            {' '}
            {/* タイトルのレベルと文言を調整 */}
            {t('subscription.pricingPlans')}
          </Title>
          <Text fs="lg" c="dimmed" ta="center">
            {t('subscription.sameFeatures')}
          </Text>
          <Center>
            <List
              withPadding
              spacing="sm"
              center
              icon={
                <ThemeIcon color="blue" size={24} radius="xl">
                  <IconMessageCircleCheck size="1rem" />
                </ThemeIcon>
              }
            >
              {i18n.resolvedLanguage === 'ja' && (
                <List.Item key="bank">{t('subscription.bankOnlySixMonths')}</List.Item>
              )}
              <List.Item key="renew">{t('subscription.cardAutoRenew')}</List.Item>
              <List.Item key="cancel">{t('subscription.accessUntilEnd')}</List.Item>
            </List>
          </Center>
          <Grid justify="center">
            {plansToDisplay.map((plan) => (
              <RenderPlanCard key={plan.id} plan={plan} />
            ))}
          </Grid>
        </Stack>
      )}
      {plansToDisplay.length === 0 && (
        <Text c="dimmed" ta="center" mt="md">
          {t('subscription.noPlans')}
        </Text>
      )}
    </>
  );
};

export default PriceTable; // エクスポート名を PriceTable に修正
