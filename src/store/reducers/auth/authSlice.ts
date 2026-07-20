// src/store/reducers/auth/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Timestamp } from 'firebase/firestore';
import { isTimestampRaw } from '@/utils/firebaseUtils';
import { RootState } from '../../index';
// API Key関連のThunks
import { affiliateKeySave, saveApiKeys } from './apiThunks';
// 認証関連のThunks
import {
  deleteCurrentUserAccountThunk, // ★ 追加
  sendPasswordResetEmail,
  sendVerificationEmailThunk,
  signIn,
  signInWithGoogle,
  signOut,
  signUpWithEmailAndPassword, // ★ 追加
  updateUserEmail, // ★ updateUserEmail をインポート
  updateUserPassword,
  updatePreferredLanguage,
} from './authThunks';
import { DEFAULT_AVATAR_URL, DEFAULT_BACKGROUND_IMAGE_URL, SLICE_NAME } from './constants';
import { AppAuth, SerializableUserFirestoreData, SetUserPayload } from './types';
// ユーザープロファイル・銀行振込関連のThunks
import {
  acceptTerms,
  cancelBankTransferThunk,
  getProfileImages,
  getUserProfile,
  requestBankTransfer,
  requestBankTransferConfirmationThunk, // ★ 追加
  setProfile,
} from './userThunks';

/**
 * 初期状態
 */
const initialState: AppAuth = {
  user: {
    uid: null,
    email: null,
    displayName: null,
    role: '',
    photoURL: null,
    avatarUrl: DEFAULT_AVATAR_URL,
    backgroundImageUrl: DEFAULT_BACKGROUND_IMAGE_URL,
    chatGptApiKey: '',
    geminiApiKey: '',
    anthropicApiKey: '',
    rakutenAppId: '',
    amazonAccessKey: '',
    amazonSecretKey: '',
    dmmAffiliateId: '',
    dmmApiId: '',
    googleSheetUrl: '',
    gasProxyInitializedAt: '',
    discordPostResultNotificationEnabled: false,
    discordWebhookUrlSaved: false,
    termsAccepted: false,
    isNewUser: true,
    isAdmin: false,
    createdAt: '', // ISO文字列として保持
    updatedAt: '', // ISO文字列として保持
    // サブスクリプション関連フィールド
    subscriptionStatus: 'inactive', // StripeSubscriptionStatus型を使用
    appPlanId: '', // 例: "basic_monthly", "premium_yearly"
    currentPeriodStart: undefined,
    currentPeriodEnd: undefined,
    cancelAtPeriodEnd: undefined,
    canceledAt: null,
    endedAt: null,
    stripePriceId: undefined, // Stripeの価格ID
    stripeCustomerId: undefined, // Stripeの顧客ID
    stripeSubscriptionId: undefined, // StripeのサブスクリプションID
    pendingPlanChange: undefined,
    bankPaymentInfo: null,
    isSendingEmailVerification: false,
    emailVerificationError: null,
    applyMailchimpTag: [],
    preferredLanguage: undefined,
    mailchimpPersistentTags: [],
    firstMonthDiscount: null,
  },
  loading: true,
  error: null,
  task: null,
};

/**
 * Authスライス
 */
const authSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    // stateを初期化
    initialize: (state) => {
      console.log('Initializing auth state...');
      state.loading = false;
      Object.assign(state, initialState);
    },
    // reset task & error
    resetTask: (state) => {
      state.task = null;
      state.error = null;
    },
    // setLoading
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    // set error message
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    // onAuthStateChangedやログイン成功時にユーザー情報を設定
    setUser: (state, action: PayloadAction<SetUserPayload>) => {
      const { user, userProfile } = action.payload;
      // userData は SerializableUserFirestoreData 型として扱う
      const userData = action.payload.userData as SerializableUserFirestoreData | null;

      if (user) {
        console.log(`Setting user in Redux state: ${user.uid}`);
        state.user = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: userProfile?.role ?? state.user.role ?? '', // 既存stateもフォールバック
          avatarUrl:
            userProfile?.avatarUrl ?? user.photoURL ?? state.user.avatarUrl ?? DEFAULT_AVATAR_URL,
          backgroundImageUrl:
            userProfile?.backgroundImageUrl ??
            state.user.backgroundImageUrl ??
            DEFAULT_BACKGROUND_IMAGE_URL,
          chatGptApiKey: userProfile?.chatGptApiKey ?? state.user.chatGptApiKey ?? '',
          geminiApiKey: userProfile?.geminiApiKey ?? state.user.geminiApiKey ?? '',
          anthropicApiKey: userProfile?.anthropicApiKey ?? state.user.anthropicApiKey ?? '',
          rakutenAppId: userProfile?.rakutenAppId ?? state.user.rakutenAppId ?? '',
          amazonAccessKey: userProfile?.amazonAccessKey ?? state.user.amazonAccessKey ?? '',
          amazonSecretKey: userProfile?.amazonSecretKey ?? state.user.amazonSecretKey ?? '',
          dmmAffiliateId: userProfile?.dmmAffiliateId ?? state.user.dmmAffiliateId ?? '',
          dmmApiId: userProfile?.dmmApiId ?? state.user.dmmApiId ?? '',
          googleSheetUrl: userProfile?.googleSheetUrl ?? state.user.googleSheetUrl ?? '',
          gasProxyInitializedAt:
            userProfile?.gasProxyInitializedAt ?? state.user.gasProxyInitializedAt ?? '',
          discordPostResultNotificationEnabled:
            userProfile?.discordPostResultNotificationEnabled ??
            state.user.discordPostResultNotificationEnabled ?? false,
          discordWebhookUrlSaved:
            userProfile?.discordWebhookUrlSaved ?? state.user.discordWebhookUrlSaved ?? false,
          // termsAccepted は userData から、なければ null
          termsAccepted: userData?.termsAccepted ?? false,
          isAdmin: userData?.isAdmin ?? false,
          createdAt: userData?.createdAt ?? '',
          updatedAt: userData?.updatedAt ?? '',

          // Subscription fields from userData
          subscriptionStatus: userData?.subscriptionStatus ?? state.user.subscriptionStatus,
          appPlanId: userData?.appPlanId ?? state.user.appPlanId,
          currentPeriodStart: userData?.currentPeriodStart ?? state.user.currentPeriodStart,
          currentPeriodEnd: userData?.currentPeriodEnd ?? state.user.currentPeriodEnd,
          cancelAtPeriodEnd: userData?.cancelAtPeriodEnd ?? state.user.cancelAtPeriodEnd,
          canceledAt: userData?.canceledAt ?? state.user.canceledAt,
          endedAt: userData?.endedAt ?? state.user.endedAt,
          bankPaymentInfo: userData?.bankPaymentInfo ?? state.user.bankPaymentInfo,

          isNewUser: undefined, // isNewUser はThunkから直接渡さない
          isSendingEmailVerification: state.user.isSendingEmailVerification ?? false,
          emailVerificationError: state.user.emailVerificationError ?? null,
          applyMailchimpTag: userData?.applyMailchimpTag ?? state.user.applyMailchimpTag ?? [],
          preferredLanguage: userData?.preferredLanguage,
          mailchimpPersistentTags:
            userData?.mailchimpPersistentTags ?? state.user.mailchimpPersistentTags ?? [],
          firstMonthDiscount: userData?.firstMonthDiscount ?? state.user.firstMonthDiscount ?? null,
        };
        state.error = null; // ユーザーが設定されたらエラーはクリア
      } else {
        // ユーザーが null の場合、state を初期化
        console.log('Setting user to null (logged out), initializing state.');
        Object.assign(state, initialState);
        state.loading = false; // 初期化完了
      }
    },
  },
  extraReducers: (builder) => {
    // 共通のPending処理
    const handlePending = (state: AppAuth) => {
      state.loading = true;
      state.error = null;
      state.task = state.task ? `${state.task}_pending` : 'pending';
    };

    // 共通のRejected処理
    const handleRejected = (state: AppAuth, action: PayloadAction<any>) => {
      state.loading = false;
      // action.payloadが存在し、文字列であれば其れをエラーメッセージとして使用
      state.error = typeof action.payload === 'string' ? action.payload : 'An error occurred';
      state.task = state.task ? `${state.task}_error` : 'error';
      console.log(`Auth operation failed: ${state.task}`, state.error);
    };

    // signIn(Email/Password)
    builder.addCase(signIn.pending, (state) => {
      handlePending(state);
      state.task = 'signin';
    });
    builder.addCase(signIn.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload;
      state.task = 'signin_success';
      state.error = null;
    });
    builder.addCase(signIn.rejected, (state, action) => {
      handleRejected(state, action);
      state.user = initialState.user; // ログイン失敗時はユーザー情報を初期化
    });

    // signInWithGoogle
    builder.addCase(signInWithGoogle.pending, (state) => {
      handlePending(state);
      state.task = 'google_signin';
    });
    builder.addCase(signInWithGoogle.fulfilled, (state, action) => {
      // isNewUser は payload に含まれるが、state.user には isNewUser フィールドはないので、他を設定
      state.user = { ...action.payload, isNewUser: undefined };
      state.loading = false;
      state.error = null;
      state.task = 'google_signin_success';
    });
    builder.addCase(signInWithGoogle.rejected, (state, action) => {
      handleRejected(state, action);
      state.user = initialState.user; // 失敗時は初期化
    });

    // signUpWithEmailAndPassword
    builder.addCase(signUpWithEmailAndPassword.pending, (state) => {
      handlePending(state);
      state.task = 'signup';
    });
    builder.addCase(signUpWithEmailAndPassword.fulfilled, (state, action) => {
      state.loading = false;
      // action.payload は AppUser 型。isNewUser は AppUser に含まれるが、state.user には直接 isNewUser フィールドはない。
      // AppUser の isNewUser は主にThunkから返される一時的な情報として扱う。
      state.user = { ...action.payload, isNewUser: undefined };
      state.task = 'signup_success';
      state.error = null;
    });
    builder.addCase(signUpWithEmailAndPassword.rejected, (state, action) => {
      handleRejected(state, action);
      state.user = initialState.user; // 失敗時はユーザー情報を初期化
    });
    // --- acceptTerms ---
    builder.addCase(acceptTerms.pending, (state) => {
      handlePending(state);
      state.task = 'accept_terms';
    });
    builder.addCase(acceptTerms.fulfilled, (state, action) => {
      if (state.user) {
        state.user.termsAccepted = action.payload.termsAccepted;
        state.user.isAdmin = action.payload.isAdmin;
      }
      state.loading = false;
      state.task = 'accept_terms_success';
    });
    builder.addCase(acceptTerms.rejected, handleRejected);

    // getUserProfile
    builder.addCase(getUserProfile.pending, (state) => {
      handlePending(state);
      state.task = 'get_user_profile';
    });
    builder.addCase(getUserProfile.fulfilled, (state, action) => {
      state.loading = false;
      state.user = {
        ...state.user,
        role: action.payload.role,
        avatarUrl: action.payload.avatarUrl,
        backgroundImageUrl: action.payload.backgroundImageUrl,
      };
      state.task = 'get_user_profile_success';
    });
    builder.addCase(getUserProfile.rejected, handleRejected);

    // getProfileImages
    builder.addCase(getProfileImages.pending, (state) => {
      handlePending(state);
      state.task = 'get_profile_images';
    });
    builder.addCase(getProfileImages.fulfilled, (state, action) => {
      if (state.user) {
        state.user.avatarUrl = action.payload.avatarUrl;
        state.user.backgroundImageUrl = action.payload.backgroundImageUrl;
      }
      state.loading = false;
      state.task = 'get_profile_images_success';
    });
    builder.addCase(getProfileImages.rejected, handleRejected);

    // setProfile
    builder.addCase(setProfile.pending, (state) => {
      handlePending(state);
      state.task = 'set_profile';
    });
    builder.addCase(setProfile.fulfilled, (state, action) => {
      state.loading = false;
      state.user = {
        ...state.user,
        displayName: action.payload.displayName,
        role: action.payload.role,
        avatarUrl: action.payload.avatarUrl,
        backgroundImageUrl: action.payload.backgroundImageUrl,
        photoURL: action.payload.avatarUrl,
      };
      state.task = 'set_profile_success';
    });
    builder.addCase(setProfile.rejected, handleRejected);

    // updateUserPassword
    builder.addCase(updateUserPassword.pending, (state) => {
      handlePending(state);
      state.task = 'update_password';
    });
    builder.addCase(updateUserPassword.fulfilled, (state) => {
      state.loading = false;
      state.task = 'update_password_success';
    });
    builder.addCase(updateUserPassword.rejected, handleRejected);

    // signout
    builder.addCase(signOut.pending, (state) => {
      handlePending(state);
      state.task = 'signout';
    });
    builder.addCase(signOut.fulfilled, (state) => {
      // initialize
      Object.assign(state, initialState);
      state.loading = false;
      state.task = 'signout_success';
    });
    builder.addCase(signOut.rejected, (state, action) => {
      handleRejected(state, action);
      Object.assign(state, initialState);
      state.loading = false;
    });

    builder.addCase(updatePreferredLanguage.fulfilled, (state, action) => {
      state.user.preferredLanguage = action.payload;
    });

    // saveApiKeys
    builder.addCase(saveApiKeys.pending, (state) => {
      handlePending(state);
      state.task = 'save_api_keys';
    });
    builder.addCase(saveApiKeys.fulfilled, (state, action) => {
      state.loading = false;
      state.task = 'save_api_keys_success';
      state.user = {
        ...state.user,
        chatGptApiKey: action.payload.chatGptApiKey,
        geminiApiKey: action.payload.geminiApiKey,
        anthropicApiKey: action.payload.anthropicApiKey,
        googleSheetUrl: action.payload.googleSheetUrl,
        gasProxyInitializedAt:
          action.payload.gasProxyInitializedAt ?? state.user.gasProxyInitializedAt ?? '',
        discordPostResultNotificationEnabled:
          action.payload.discordPostResultNotificationEnabled ??
          state.user.discordPostResultNotificationEnabled ??
          false,
        discordWebhookUrlSaved:
          action.payload.discordWebhookUrlSaved ?? state.user.discordWebhookUrlSaved ?? false,
      };
    });
    builder.addCase(saveApiKeys.rejected, handleRejected);

    // affiliateKeySave
    builder.addCase(affiliateKeySave.pending, (state) => {
      handlePending(state);
      state.task = 'save_affiliate_keys';
    });
    builder.addCase(affiliateKeySave.fulfilled, (state, action) => {
      state.loading = false;
      state.task = 'save_affiliate_keys_success';
      state.user = {
        ...state.user,
        rakutenAppId: action.payload.rakutenAppId,
        amazonAccessKey: action.payload.amazonAccessKey,
        amazonSecretKey: action.payload.amazonSecretKey,
        dmmAffiliateId: action.payload.dmmAffiliateId,
        dmmApiId: action.payload.dmmApiId,
      };
    });
    builder.addCase(affiliateKeySave.rejected, handleRejected);

    // requestBankTransfer (銀行振込リクエスト)
    builder.addCase(requestBankTransfer.pending, (state) => {
      handlePending(state);
      state.task = 'request_bank_transfer';
    });
    builder.addCase(requestBankTransfer.fulfilled, (state, action) => {
      state.loading = false;
      state.task = 'request_bank_transfer_success';
      if (state.user && action.payload.bankPaymentInfo) {
        const cloudFnBankInfo: any = action.payload.bankPaymentInfo; // Timestamps are JS Date objects here
        console.log('cloudFnBankInfo:', cloudFnBankInfo);

        let paymentDeadlineStr: string | undefined;
        if (isTimestampRaw(cloudFnBankInfo.paymentDeadline)) {
          const deadlineDate = new Timestamp(
            cloudFnBankInfo.paymentDeadline._seconds,
            cloudFnBankInfo.paymentDeadline._nanoseconds
          ).toDate();
          paymentDeadlineStr = deadlineDate.toISOString();
        }

        let requestedAtStr: string | undefined;
        if (isTimestampRaw(cloudFnBankInfo.requestedAt)) {
          const requestedDate = new Timestamp(
            cloudFnBankInfo.requestedAt._seconds,
            cloudFnBankInfo.requestedAt._nanoseconds
          ).toDate();
          requestedAtStr = requestedDate.toISOString();
        }

        // Construct the object for state.user.bankPaymentInfo,
        // ensuring timestamps are converted to ISO strings for consistency.
        const newBankPaymentInfoForState: SerializableUserFirestoreData['bankPaymentInfo'] = {
          amount: cloudFnBankInfo.amount,
          baseAmount: cloudFnBankInfo.baseAmount,
          feeAmount: cloudFnBankInfo.feeAmount,
          discountAmount: cloudFnBankInfo.discountAmount,
          referralCreditAppliedAmount: cloudFnBankInfo.referralCreditAppliedAmount,
          totalAmount: cloudFnBankInfo.totalAmount,
          firstMonthDiscountApplied: cloudFnBankInfo.firstMonthDiscountApplied,
          currency: cloudFnBankInfo.currency,
          paymentDeadline: paymentDeadlineStr,
          planId: cloudFnBankInfo.planId,
          planName: cloudFnBankInfo.planName,
          requestedAt: requestedAtStr,
          status: cloudFnBankInfo.status,
          // confirmationRequestedAt is not part of the payload from requestBankTransferPayment
          // Cloud Function. If it exists in state.user.bankPaymentInfo from other sources,
          // it will be effectively cleared for the bankPaymentInfo object by this assignment.
        };
        state.user.bankPaymentInfo = newBankPaymentInfoForState;
      }
      console.log('Bank transfer request successful:', action.payload.message);
    });
    builder.addCase(requestBankTransfer.rejected, (state, action) => {
      handleRejected(state, action);
      state.task = 'request_bank_transfer_error';
      // エラーメッセージは action.payload (rejectValue) に格納されている
      console.error('Bank transfer request failed:', action.payload);
    });

    // requestBankTransferConfirmationThunk (銀行振込完了確認リクエスト)
    builder.addCase(requestBankTransferConfirmationThunk.pending, (state) => {
      handlePending(state);
      state.task = 'request_bank_confirmation';
    });
    builder.addCase(requestBankTransferConfirmationThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.task = 'request_bank_confirmation_success';
      // Firestoreのユーザーデータ (bankPaymentInfo) はCloud Function側で更新され、
      // listenAuthStateなどを通じてReduxストアに反映される想定
      state.user.bankPaymentInfo = {
        ...state.user.bankPaymentInfo,
        status: 'pending_confirmation',
        rejectionReason: undefined,
        rejectedAt: undefined,
        rejectedRequestId: undefined,
      };
      console.log('Bank transfer confirmation request successful:', action.payload.message);
    });
    builder.addCase(requestBankTransferConfirmationThunk.rejected, (state, action) => {
      handleRejected(state, action);
      state.task = 'request_bank_confirmation_error';
      console.error('Bank transfer confirmation request failed:', action.payload);
    });

    // cancelBankTransferThunk (銀行振込申込みキャンセル)
    builder.addCase(cancelBankTransferThunk.pending, (state) => {
      handlePending(state);
      state.task = 'cancel_bank_transfer';
    });
    builder.addCase(cancelBankTransferThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.task = 'cancel_bank_transfer_success';
      state.user.bankPaymentInfo = {
        ...state.user.bankPaymentInfo,
        status: 'payment_canceled',
      };
      console.log('Bank transfer cancellation successful:', action.payload.message);
    });
    builder.addCase(cancelBankTransferThunk.rejected, (state, action) => {
      handleRejected(state, action);
      state.task = 'cancel_bank_transfer_error';
      console.error('Bank transfer cancellation failed:', action.payload);
    });

    // updateUserEmail
    builder.addCase(updateUserEmail.pending, (state) => {
      handlePending(state);
      state.task = 'update_user_email';
    });
    builder.addCase(updateUserEmail.fulfilled, (state) => {
      state.loading = false;
      state.task = 'update_user_email_verification_sent'; // 確認メール送信済みを示すタスク名
      // メールアドレス自体は listenAuthState を通じて更新されるため、ここでは直接 state.user.email を更新しない
    });
    builder.addCase(updateUserEmail.rejected, (state, action) => {
      state.loading = false;
      // action.payload に Thunk の rejectWithValue から渡されたエラーメッセージが格納されている
      state.error =
        typeof action.payload === 'string'
          ? action.payload
          : 'メールアドレスの更新に失敗しました。';
      state.task = 'update_user_email_error';
      console.error('Update user email failed in slice:', state.error);
    });
    builder
      .addCase(sendVerificationEmailThunk.pending, (state) => {
        state.user.isSendingEmailVerification = true;
        state.user.emailVerificationError = null;
      })
      .addCase(sendVerificationEmailThunk.fulfilled, (state) => {
        state.user.isSendingEmailVerification = false;
        // action.payload.message を使って成功通知を出すことも可能
      })
      .addCase(sendVerificationEmailThunk.rejected, (state, action) => {
        state.user.isSendingEmailVerification = false;
        if (action.payload) {
          state.user.emailVerificationError = action.payload.message;
        } else {
          state.user.emailVerificationError = action.error.message || 'メール送信に失敗しました。';
        }
      });

    // deleteCurrentUserAccountThunk
    builder
      .addCase(deleteCurrentUserAccountThunk.pending, (state) => {
        handlePending(state);
        state.task = 'delete_user_account';
      })
      .addCase(deleteCurrentUserAccountThunk.fulfilled, (state, action) => {
        // アカウント削除成功時はサインアウトと同様にstateを初期化
        Object.assign(state, initialState);
        state.loading = false;
        state.task = 'delete_user_account_success';
        console.log(action.payload.message); // 成功メッセージをログに出力
      })
      .addCase(deleteCurrentUserAccountThunk.rejected, (state, action) => {
        handleRejected(state, action); // エラーメッセージはaction.payload.messageに格納
        state.task = 'delete_user_account_error';
      });
    builder
      // ... (既存のaddCase)
      .addCase(sendPasswordResetEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.task = 'password_reset_request'; // タスク状態を識別する文字列
      })
      .addCase(sendPasswordResetEmail.fulfilled, (state) => {
        state.loading = false;
        state.task = 'password_reset_success';
      })
      .addCase(sendPasswordResetEmail.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as { message: string })?.message ||
          'パスワードリセットメールの送信に失敗しました。';
        state.task = 'password_reset_error';
      });
  },
});

// --- Selectors ---
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.user?.uid;
export const selectAuthLoading = (state: RootState) => state.auth.loading;
// termsAccepted は null もありうるので boolean だけでなく null も考慮
export const selectTermsAccepted = (state: RootState): boolean | null =>
  state.auth.user?.termsAccepted ?? null;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectAuthTask = (state: RootState) => state.auth.task;

// --- Actions ---
export const { initialize, resetTask, setLoading, setError, setUser } = authSlice.actions;

export default authSlice.reducer;
