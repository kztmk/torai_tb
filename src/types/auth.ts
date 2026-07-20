import { Timestamp } from 'firebase/firestore'; // Firebase Timestamp型をインポート

export type GuardProps = {
  children: React.ReactElement | null;
};
export interface BankPaymentInfo {
  amount?: number;
  baseAmount?: number;
  feeAmount?: number;
  discountAmount?: number;
  referralCreditAppliedAmount?: number;
  totalAmount?: number;
  firstMonthDiscountApplied?: boolean;
  currency?: string;
  paymentDeadline: Timestamp;
  planId?: string;
  planName?: string;
  requestedAt?: Timestamp; //振込申込み日時
  confirmationRequestedAt?: Timestamp;
  rejectionReason?: string;
  rejectedAt?: Timestamp;
  rejectedRequestId?: string;
  status?:
    | 'payment_requested'
    | 'payment_confirmed'
    | 'payment_expired'
    | 'payment_rejected'
    | 'payment_failed'
    | 'payment_canceled'
    | 'renewal_requested'
    | 'pending_confirmation'
    | 'renewal_pending_confirmation';
}

export interface SendVerificationEmailThunkArg {
  lang: string;
}

export interface SendVerificationEmailThunkPayload {
  success: boolean;
  message: string;
}

export interface SendVerificationEmailThunkError {
  message: string;
  // 必要に応じて code などのエラー情報も追加
}

export interface DeleteUserThunkPayload {
  success: boolean;
  message?: string; // オプションで成功メッセージ
}

export interface DeleteUserThunkError {
  message: string;
}

export interface FirstMonthDiscount {
  status: 'pending_terms' | 'eligible' | 'redeemed' | 'expired';
  amountOff?: number;
  currency: string;
  validDays: number;
  source: 'google_new_user';
  eligibleAt?: Timestamp;
  expiresAt?: Timestamp;
  couponId?: string;
  appliedPlanId?: string;
  promotionCodeId?: string;
  promotionCode?: string;
  checkoutSessionId?: string;
  redeemedAt?: Timestamp;
}

export interface ReferralInfo {
  referralCode?: string;
  referredByUid?: string;
  referralCodeUsed?: string;
  registeredAt?: Timestamp;
  termsAcceptedAt?: Timestamp;
  subscribedAt?: Timestamp;
  rewardQualified?: boolean;
  lifetimeDiscountPercent?: number;
  lifetimeDiscountStatus?: 'pending_stripe_subscription' | 'applied';
  lifetimeDiscountAppliedAt?: Timestamp;
  lifetimeFreeStripeSubscriptionCanceledAt?: Timestamp;
}

export interface ReferralCredit {
  totalGrantedAmount?: number;
  stripeGrantedAmount?: number;
  bankAvailableAmount?: number;
  consumedAmount?: number;
  updatedAt?: Timestamp;
}

/* Firestoreのユーザーデータ型
 * Firebaseのドキュメントフィールドと一致
 */
export interface UserFirestoreData {
  // user属性
  isAdmin?: boolean;
  displayName: string | null;
  email: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: Timestamp;
  welcomeEmailSentAt?: Timestamp;
  welcomeEmailError?: string | null;
  updatedAt?: Timestamp;
  createdAt: Timestamp;
  termsAccepted: boolean;
  preferredLanguage?: 'ja' | 'en';
  /** Server-managed tags that must never be removed by lifecycle tag updates. */
  mailchimpPersistentTags?: string[];
  // 銀行振込関連
  bankPaymentInfo?: BankPaymentInfo | null;
  // サブスクリプション関連
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: StripeSubscriptionStatus;
  appPlanId?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Timestamp;
  endedAt?: Timestamp;
  stripePriceId?: string;
  pendingPlanChange?: {
    fromPlanId: string;
    toPlanId: string;
    effectiveDate: Timestamp; // Firestore Timestamp型を使用
  };
  isSendingEmailVerification?: boolean;
  emailVerificationError?: string | null;
  applyMailchimpTag: string[];
  firstMonthDiscount?: FirstMonthDiscount | null;
  referral?: ReferralInfo | null;
  referralCredit?: ReferralCredit | null;
}

// Example in src/types/auth.ts or src/types/User.ts
export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'inactive'
  | 'lifetime'
  | null;
