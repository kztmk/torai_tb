// functions/src/config.ts
import { defineSecret, defineString } from 'firebase-functions/params';

export const DAYS_BEFORE_EXPIRATION_FOR_RENEWAL_NOTICE = 10;
export const RENEWAL_PLAN_ID_BANK = 'half_yearly_bank';

export const BANK_TRANSFER_PLANS: {
  [key: string]: { name: string; amount: number; currency?: string; durationMonths?: number };
} = {
  half_yearly_bank: {
    name: '6ヶ月プラン (銀行振込)',
    amount: 6800,
    currency: '円',
    durationMonths: 6,
  },
};

export const BANK_ACCOUNT_DETAILS = {
  bankName: '広島銀行',
  branchName: '三原支店',
  accountType: '普通',
  accountNumber: '3544378',
  accountHolder: 'イナバ カズヤ',
  serviceName: 'Xへの自動投稿ツール 虎威',
  transferReferenceNote: '振込み名義をプロファイルページからお知らせください。',
};

export const PAYMENT_DEADLINE_DAYS = 7;

export const allowedOrigins: string[] = [
  'http://localhost:5173',
  // preview: tb-torai-preview
  'https://tb-torai-preview.web.app',
  'https://tb-torai-preview.firebaseapp.com',
  'https://tb-torai-preview.try-try.com', // preview カスタムドメイン
  // production: tb-torai-prod
  'https://tb-torai-prod.web.app',
  'https://tb-torai-prod.firebaseapp.com',
  'https://tb-torai.try-try.com', // production カスタムドメイン
];

export const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
export const appBaseUrlConfig = defineString('APP_URL');
export const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
export const adminNotificationEmailConfig = defineString('ADMIN_NOTIFICATION_EMAIL', {
  default: '',
});
export const mailchimpApiKey = defineSecret('MAILCHIMP_API_KEY');
export const mailchimpAudienceId = defineString('MAILCHIMP_AUDIENCE_ID');

export const getAdminNotificationBcc = (): string[] => {
  const email = adminNotificationEmailConfig.value().trim();
  return email ? [email] : [];
};

// 管理者通知メールの宛先（To）。未設定なら空文字を返す。
export const getAdminNotificationEmail = (): string => adminNotificationEmailConfig.value().trim();

export const STRIPE_PRICE_ID_TO_APP_PLAN_ID: { [key: string]: string } = {
  // dev / torai-preview 環境
  price_1RNOaQPhCspTvNYmYKvvlH1i: 'basic_monthly',
  price_1RNObnPhCspTvNYmyNQ8bgJB: 'tri_monthly',
  price_1RNOcePhCspTvNYmkB0I0lZC: 'half_yearly',
  price_1RNOdiPhCspTvNYmzXxXWtlK: 'yearly',
  price_1RNOeWPhCspTvNYmAqdkXpdr: 'double_yearly',
  // torai-e0d8e 本番環境
  price_1RUvBTBBNZ7o008Z4Vbo2auH: 'basic_monthly',
  price_1RUvAABBNZ7o008ZJO8mlNFw: 'half_yearly',
  price_1RUv8gBBNZ7o008ZKxL3IwDb: 'yearly',
};

export const STRIPE_PRICE_ID_BASIC_MONTHLY = defineString('STRIPE_PRICE_ID_BASIC_MONTHLY');
export const STRIPE_PRICE_ID_HALF_YEARLY = defineString('STRIPE_PRICE_ID_HALF_YEARLY');
export const STRIPE_PRICE_ID_YEARLY = defineString('STRIPE_PRICE_ID_YEARLY');
export const STRIPE_PRICE_ID_BASIC_MONTHLY_USD = defineString(
  'STRIPE_PRICE_ID_BASIC_MONTHLY_USD',
  { default: '' }
);

export const getAppPlanIdForStripePriceId = (priceId: string): string | null => {
  const usdMonthlyPriceId = STRIPE_PRICE_ID_BASIC_MONTHLY_USD.value().trim();
  if (usdMonthlyPriceId !== '' && priceId === usdMonthlyPriceId) {
    return 'basic_monthly';
  }
  return STRIPE_PRICE_ID_TO_APP_PLAN_ID[priceId] ?? null;
};
