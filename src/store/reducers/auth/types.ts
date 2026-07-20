// src/store/reducers/auth/types.ts
import { BankPaymentInfo, UserFirestoreData } from '@/types/auth';

/**
 * アプリケーション内ユーザー情報の型定義
 * Firebaseから取得した情報とカスタム情報を含む
 */

export interface AppUser extends FirebaseAuthUser, UserProfileInfo, SerializableUserFirestoreData {}

export interface FirebaseAuthUser {
  // firebase auth userInfo
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isNewUser?: boolean;
  // realtime database userInfo
}

/*
 * Realtime database にuidで保存されているデータ
 */
export interface UserProfileInfo extends ProfileData, ApiKeyData, AffiliateKeyData {}

/**
 * 認証ステートの型定義
 */
export interface AppAuth {
  user: AppUser;
  loading: boolean;
  error: string | null;
  task: string | null;
}

/**
 * setUserアクション用のペイロード型定義
 */
// export interface SetUserPayload {
//   user: {
//     uid: string;
//     email: string | null;
//     displayName: string | null;
//     photoURL: string | null;
//   } | null; // Firebase Auth User
//   userData?: UserFirestoreData | null; // Firestore データ
//   profileData?: any | null; // RTDB Profile データ
//   settingsData?: any | null; // RTDB Settings データ
// }

/**
 * プロフィール情報の型定義
 */
export interface ProfileData {
  role: string;
  avatarUrl: string;
  backgroundImageUrl: string;
}

/**
 * API Key情報の型定義
 */
export interface ApiKeyData {
  chatGptApiKey: string;
  geminiApiKey: string;
  anthropicApiKey: string;
  googleSheetUrl: string;
  gasProxyInitializedAt?: string;
  discordPostResultNotificationEnabled?: boolean;
  discordWebhookUrlSaved?: boolean;
}

/**
 * アフィリエイト情報の型定義
 */
export interface AffiliateKeyData {
  rakutenAppId: string;
  amazonAccessKey: string;
  amazonSecretKey: string;
  dmmAffiliateId: string;
  dmmApiId: string;
}

/**
 * プロフィール更新用のデータ型定義
 */
export interface ProfileUpdateData {
  displayName: string;
  role: string;
  avatar: File | null;
  backgroundImage: File | null;
}

/**
 * プロフィール更新結果の型定義
 */
export interface ProfileUpdateResult {
  displayName: string;
  role: string;
  avatarUrl: string;
  backgroundImageUrl: string;
}

export interface SerializedBankPaymentInfo {
  amount?: number;
  baseAmount?: number;
  feeAmount?: number;
  discountAmount?: number;
  referralCreditAppliedAmount?: number;
  totalAmount?: number;
  firstMonthDiscountApplied?: boolean;
  currency?: string;
  paymentDeadline?: string;
  planId?: string;
  planName?: string;
  requestedAt?: string;
  confirmationRequestedAt?: string; // ★ 追加: 振込完了確認リクエスト日時
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedRequestId?: string;
  status?:
    | 'payment_requested'
    | 'payment_confirmed'
    | 'payment_expired'
    | 'payment_rejected'
    | 'payment_failed'
    | 'payment_canceled'
    | 'pending_confirmation'
    | 'renewal_requested'
    | 'renewal_pending_confirmation'
    | undefined;
}

export interface SerializedFirstMonthDiscount {
  status: 'pending_terms' | 'eligible' | 'redeemed' | 'expired';
  amountOff?: number;
  currency: string;
  validDays: number;
  source: 'google_new_user';
  eligibleAt?: string | null;
  expiresAt?: string | null;
  couponId?: string;
  appliedPlanId?: string;
  promotionCodeId?: string;
  promotionCode?: string;
  checkoutSessionId?: string;
  redeemedAt?: string | null;
}

/**
 * Firestoreのユーザーデータ型 (Timestampを文字列にシリアライズしたもの)
 * setUserペイロードで使用
 */
export interface SerializableUserFirestoreData
  extends Omit<
    UserFirestoreData,
    | 'createdAt'
    | 'updatedAt'
    | 'emailVerifiedAt'
    | 'welcomeEmailSentAt'
    | 'currentPeriodStart'
    | 'currentPeriodEnd'
    | 'trialEnd'
    | 'canceledAt'
    | 'endedAt'
    | 'bankPaymentInfo'
    | 'firstMonthDiscount'
  > {
  createdAt?: string; // ISO文字列
  updatedAt?: string; // ISO文字列
  emailVerifiedAt?: string; // ISO文字列
  welcomeEmailSentAt?: string; // ISO文字列
  // サブスクリプション関連のタイムスタンプも文字列に
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  endedAt?: string | null;
  bankPaymentInfo?: SerializedBankPaymentInfo | null;
  firstMonthDiscount?: SerializedFirstMonthDiscount | null;
}

/**
 * setUserアクション用のペイロード型定義
 */
export interface SetUserPayload {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  } | null;
  userData?: SerializableUserFirestoreData | null; // ★ 変更
  userProfile?: UserProfileInfo | null;
}

/**
 * 銀行振込リクエスト時のCloud Functionへのデータ型
 */
export interface RequestBankTransferData {
  planId: string;
}

/**
 * 銀行振込リクエスト時のCloud Functionからのレスポンス型
 */
export interface BankTransferResponse {
  success: boolean;
  bankPaymentInfo?: BankPaymentInfo;
  message: string;
}

/**
 * 銀行振込完了確認リクエスト時のCloud Functionへのデータ型
 */
export interface RequestBankTransferConfirmationData {
  transferName: string;
}

/**
 * 銀行振込完了確認リクエスト時のCloud Functionからのレスポンス型
 */
export interface BankTransferConfirmationResponse {
  success: boolean;
  message: string;
  bankPaymentInfo?: BankPaymentInfo;
}

/**
 * 銀行振込キャンセル時のCloud Functionからのレスポンス型
 */
export interface CancelBankTransferResponse {
  success: boolean;
  message: string;
  bankPaymentInfo?: BankPaymentInfo;
}

/**
 * メール・パスワードでの新規登録時のThunkへの入力データ型
 */
export interface SignUpWithEmailPasswordData {
  email: string;
  password: string;
  displayName?: string; // オプションで表示名も受け付ける
}
