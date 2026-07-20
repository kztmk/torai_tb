// src/store/reducers/auth/authThunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, // Firebase Authのユーザー削除関数をインポート
  EmailAuthProvider, // updateUserEmailで使用
  getAdditionalUserInfo,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  Unsubscribe,
  updateEmail, // Firebase Authのメール更新関数をインポート
  updateProfile as updateFirebaseProfile,
  updatePassword,
} from 'firebase/auth';
import { ref as dbRef, get, set as setRTDB } from 'firebase/database'; // Timestamp is not from firebase/database for Firestore
import {
  doc,
  Timestamp as FirestoreTimestamp,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
// Import Timestamp as FirestoreTimestamp
import { auth, database, db } from '@/firebase';
import {
  DeleteUserThunkError, // ★ 追加
  DeleteUserThunkPayload, // ★ 追加
  SendVerificationEmailThunkArg,
  SendVerificationEmailThunkPayload,
  UserFirestoreData,
} from '@/types/auth';
import { translateFirebaseAuthError } from '@/utils/firebaseUtils';
import {
  FIRST_MONTH_DISCOUNT_CURRENCY,
  FIRST_MONTH_DISCOUNT_VALID_DAYS,
} from '@/utils/firstMonthDiscount';
import { getMailchimpTag } from '@/utils/mailchimpTag';
import { AppLanguage, getAppLanguage } from '@/i18n';
import type { AppDispatch, RootState } from '../../index';
import { setUser } from './authSlice';
import { DEFAULT_AVATAR_URL, DEFAULT_BACKGROUND_IMAGE_URL, SLICE_NAME } from './constants';
import {
  AppUser,
  FirebaseAuthUser,
  SerializableUserFirestoreData,
  SetUserPayload,
  SignUpWithEmailPasswordData,
  UserProfileInfo,
} from './types';

const PENDING_REFERRAL_CODE_STORAGE_KEY = 'torai_pending_referral_code';

export const updatePreferredLanguage = createAsyncThunk<
  AppLanguage,
  AppLanguage,
  { rejectValue: string }
>(`${SLICE_NAME}/updatePreferredLanguage`, async (language, thunkApi) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return thunkApi.rejectWithValue('AUTH_REQUIRED');
  }
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      preferredLanguage: language,
      updatedAt: serverTimestamp(),
    });
    return language;
  } catch (error) {
    console.error('Failed to update preferred language.', error);
    return thunkApi.rejectWithValue('LANGUAGE_UPDATE_FAILED');
  }
});

const getPendingReferralCode = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
};

const clearPendingReferralCode = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
  }
};

const registerPendingReferralCode = async (allowRegistration = true) => {
  const referralCode = getPendingReferralCode();
  if (!referralCode) {
    return;
  }
  if (!allowRegistration) {
    clearPendingReferralCode();
    return;
  }

  try {
    const functions = getFunctions(getApp(), 'asia-northeast1');
    const registerReferral = httpsCallable(functions, 'registerReferralForCurrentUser');
    await registerReferral({ referralCode });
    clearPendingReferralCode();
  } catch (error) {
    console.warn('Failed to register pending referral code.', error);
  }
};

/*
 * UserFirestoreDataをSerializableUserFirestoreDataへ変換
 */
export const serializeUserFirestoreData = (
  data: UserFirestoreData
): SerializableUserFirestoreData => {
  const {
    isSendingVerificationEmail: _legacyIsSendingVerificationEmail,
    verificationEmailError: _legacyVerificationEmailError,
    ...serializableData
  } = data as UserFirestoreData & {
    isSendingVerificationEmail?: boolean;
    verificationEmailError?: string | null;
  };

  return {
    ...serializableData,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    emailVerifiedAt: data.emailVerifiedAt?.toDate().toISOString(),
    welcomeEmailSentAt: data.welcomeEmailSentAt?.toDate().toISOString(),
    // サブスクリプションサービス
    currentPeriodStart: data.currentPeriodStart
      ? data.currentPeriodStart.toDate().toISOString()
      : null,
    currentPeriodEnd: data.currentPeriodEnd ? data.currentPeriodEnd.toDate().toISOString() : null,
    canceledAt: data.canceledAt ? data.canceledAt.toDate().toISOString() : null,
    endedAt: data.endedAt ? data.endedAt.toDate().toISOString() : null,
    bankPaymentInfo: {
      amount: data.bankPaymentInfo?.amount ?? undefined,
      baseAmount: data.bankPaymentInfo?.baseAmount ?? undefined,
      feeAmount: data.bankPaymentInfo?.feeAmount ?? undefined,
      discountAmount: data.bankPaymentInfo?.discountAmount ?? undefined,
      referralCreditAppliedAmount: data.bankPaymentInfo?.referralCreditAppliedAmount ?? undefined,
      totalAmount: data.bankPaymentInfo?.totalAmount ?? undefined,
      firstMonthDiscountApplied: data.bankPaymentInfo?.firstMonthDiscountApplied ?? undefined,
      currency: data.bankPaymentInfo?.currency ?? undefined,
      paymentDeadline: data.bankPaymentInfo?.paymentDeadline
        ? data.bankPaymentInfo.paymentDeadline.toDate().toISOString()
        : undefined,
      planId: data.bankPaymentInfo?.planId ?? undefined,
      planName: data.bankPaymentInfo?.planName ?? undefined,
      requestedAt: data.bankPaymentInfo?.requestedAt
        ? data.bankPaymentInfo.requestedAt.toDate().toISOString()
        : undefined,
      confirmationRequestedAt: data.bankPaymentInfo?.confirmationRequestedAt
        ? data.bankPaymentInfo.confirmationRequestedAt.toDate().toISOString()
        : undefined,
      rejectionReason: data.bankPaymentInfo?.rejectionReason ?? undefined,
      rejectedAt: data.bankPaymentInfo?.rejectedAt
        ? data.bankPaymentInfo.rejectedAt.toDate().toISOString()
        : undefined,
      rejectedRequestId: data.bankPaymentInfo?.rejectedRequestId ?? undefined,
      status: data.bankPaymentInfo?.status ?? undefined,
    },
    firstMonthDiscount: data.firstMonthDiscount
      ? {
          ...data.firstMonthDiscount,
          eligibleAt: data.firstMonthDiscount.eligibleAt
            ? data.firstMonthDiscount.eligibleAt.toDate().toISOString()
            : null,
          expiresAt: data.firstMonthDiscount.expiresAt
            ? data.firstMonthDiscount.expiresAt.toDate().toISOString()
            : null,
          redeemedAt: data.firstMonthDiscount.redeemedAt
            ? data.firstMonthDiscount.redeemedAt.toDate().toISOString()
            : null,
        }
      : null,
  };
};

/**

/**
 * メールとパスワードでサインイン
 */
export const signIn = createAsyncThunk<
  AppUser,
  { email: string; password: string },
  { rejectValue: string }
>(`${SLICE_NAME}/signIn`, async (args, thunkApi) => {
  // const appMode = import.meta.env.VITE_APP_MODE;
  const { email, password } = args;
  try {
    const response = await signInWithEmailAndPassword(auth, email, password);
    const user = response.user;
    if (!user) {
      return thunkApi.rejectWithValue('User not found');
    }

    // check isAdmin
    if (user) {
      user
        .getIdTokenResult(true) // trueで強制リフレッシュ
        .then((idTokenResult) => {
          console.log('User claims:', idTokenResult.claims);
          if (idTokenResult.claims.isAdmin) {
            console.log('User is an admin!');
          } else {
            console.log('User is NOT an admin.');
          }
        })
        .catch((error) => {
          console.error('Error getting ID token result:', error);
        });
    }

    // 1. Firebase Authentication
    const firebaseUser: FirebaseAuthUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };

    // 2. Firestore user info
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    let userFirestoreData: UserFirestoreData;

    if (userDocSnap.exists()) {
      userFirestoreData = userDocSnap.data() as UserFirestoreData;
      let needsUpdate = false;
      const updatePayload: Partial<UserFirestoreData> = {
        updatedAt: serverTimestamp() as FirestoreTimestamp,
      };

      if (!userFirestoreData.createdAt) {
        updatePayload.createdAt = serverTimestamp() as FirestoreTimestamp;
        needsUpdate = true;
      }

      // termsAcceptedデータがない場合にはfalseとして更新が必要
      if (typeof userFirestoreData.termsAccepted !== 'boolean') {
        console.warn(`Firestore doc for ${user.uid} has invalid termsAccepted. Correcting.`);
        updatePayload.termsAccepted = false;
        needsUpdate = true;
      }
      if (!userFirestoreData.subscriptionStatus) {
        console.warn(
          `Firestore doc for ${user.uid} missing subscriptionStatus. Treating as inactive without client-side correction.`
        );
      }
      // Firestoreの更新
      if (needsUpdate) {
        await updateDoc(userDocRef, updatePayload);
        // After update, re-fetch or merge carefully if serverTimestamp was used
        const updatedDocSnap = await getDoc(userDocRef); // Re-fetch to get actual server timestamps
        userFirestoreData = updatedDocSnap.exists()
          ? (updatedDocSnap.data() as UserFirestoreData)
          : userFirestoreData; // Fallback to previous if somehow not found
      }
    } else {
      // Firestoreにuidのデータがない場合作成
      console.log(`Firestore document for user ${user.uid} not found. Creating with defaults.`);
      userFirestoreData = {
        email: user.email, // ★ Emailをコピー
        displayName: user.displayName || null, // ★ displayNameをコピー (存在すれば)
        termsAccepted: false,
        createdAt: serverTimestamp() as FirestoreTimestamp, // Will be FieldValue, resolved on read
        updatedAt: serverTimestamp() as FirestoreTimestamp, // Will be FieldValue, resolved on read
        subscriptionStatus: 'inactive',
        bankPaymentInfo: null,
        applyMailchimpTag: getMailchimpTag('registered'),
        preferredLanguage: getAppLanguage(),
      };
      await setDoc(userDocRef, userFirestoreData);
      // serverTimestamp() を解決するために、ドキュメントを再取得する
      const newDocSnap = await getDoc(userDocRef);
      if (newDocSnap.exists()) {
        userFirestoreData = newDocSnap.data() as UserFirestoreData;
      } else {
        // 通常ここには来ないはずだが、念のためエラーログ
        console.error(`Failed to re-fetch user document for ${user.uid} after creation.`);
      }
    }

    // 3. RTDBからProfile,Settingsを取得
    //let userProfileInfo: UserProfileInfo;

    const profileRef = dbRef(database, `user-data/${user.uid}/profile`);
    const settingsRef = dbRef(database, `user-data/${user.uid}/settings`);

    const [profileSnapshot, settingsSnapshot] = await Promise.all([
      get(profileRef),
      get(settingsRef),
    ]);

    const profileData = profileSnapshot.exists() ? profileSnapshot.val() : {};
    const settingsData = settingsSnapshot.exists() ? settingsSnapshot.val() : {};

    // RTDB profileがなければデフォルト値を設定
    if (!profileSnapshot.exists()) {
      console.log(`RTDB profile for user ${user.uid} not found. Creating with default values`);
      // プロファイルのデフォルト値は別のファンクションで設定する予定
    }

    const userProfileInfo = {
      role: profileData.role ?? '',
      avatarUrl: profileData.avatarUrl ?? DEFAULT_AVATAR_URL,
      backgroundImageUrl: profileData.backgroundImageUrl ?? DEFAULT_BACKGROUND_IMAGE_URL,
      chatGptApiKey: settingsData.chatGptApiKey ?? '',
      geminiApiKey: settingsData.geminiApiKey ?? '',
      anthropicApiKey: settingsData.anthropicApiKey ?? '',
      rakutenAppId: settingsData.rakutenAppId ?? '',
      amazonAccessKey: settingsData.amazonAccessKey ?? '',
      amazonSecretKey: settingsData.amazonSecretKey ?? '',
      dmmAffiliateId: settingsData.dmmAffiliateId ?? '',
      dmmApiId: settingsData.dmmApiId ?? '',
      googleSheetUrl: settingsData.googleSheetUrl ?? '',
      gasProxyInitializedAt: settingsData.gasProxyInitializedAt ?? '',
      discordPostResultNotificationEnabled:
        settingsData.discordPostResultNotificationEnabled ?? false,
      discordWebhookUrlSaved:
        settingsData.discordWebhookUrlSaved ??
        settingsData.discordPostResultNotificationEnabled ??
        false,
    };

    console.log(`createdAt: ${userFirestoreData.createdAt.toDate().toISOString()}`);
    const serializedFirestoreUserData = serializeUserFirestoreData(userFirestoreData);
    const appUser: AppUser = {
      ...firebaseUser,
      ...userProfileInfo,
      ...serializedFirestoreUserData,
    };
    console.log(
      `Sign in successful for user ${user.uid}, Terms: ${appUser.termsAccepted}, Sub: ${appUser.subscriptionStatus}`
    );
    return appUser;
  } catch (error: any) {
    console.log('Sign in error:', error);
    const errorMessage = translateFirebaseAuthError(error);
    return thunkApi.rejectWithValue(errorMessage);
  }
});

/**
 * Googleでサインイン
 */
export const signInWithGoogle = createAsyncThunk<AppUser, void, { rejectValue: string }>(
  `${SLICE_NAME}/signInWithGoogle`,
  async (_, thunkApi) => {
    //const appMode = import.meta.env.VITE_APP_MODE;
    const googleProvider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const additionalUserInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalUserInfo?.isNewUser ?? false;
      console.log(`Google sign in: ${user.uid}, New user: ${isNewUser}`);

      // 1. Firebase Authentication
      const firebaseUser: FirebaseAuthUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };

      const userDocRef = doc(db, 'users', user.uid);
      let userFirestoreData: UserFirestoreData;

      const userDocSnap = await getDoc(userDocRef);

      if (isNewUser || !userDocSnap.exists()) {
        console.log(
          `New Google user or Firestore doc missing for ${user.uid}. Creating/Overwriting with defaults.`
        );
        userFirestoreData = {
          email: firebaseUser.email, // ★ Emailをコピー
          displayName: firebaseUser.displayName, // ★ displayNameをコピー
          termsAccepted: false,
          createdAt: serverTimestamp() as FirestoreTimestamp, // Will be FieldValue
          updatedAt: serverTimestamp() as FirestoreTimestamp, // Will be FieldValue
          subscriptionStatus: 'inactive',
          bankPaymentInfo: null,
          applyMailchimpTag: getMailchimpTag('registered'),
          preferredLanguage: getAppLanguage(),
          ...(getAppLanguage() === 'ja'
            ? {
                firstMonthDiscount: {
                  status: 'pending_terms' as const,
                  currency: FIRST_MONTH_DISCOUNT_CURRENCY,
                  validDays: FIRST_MONTH_DISCOUNT_VALID_DAYS,
                  source: 'google_new_user' as const,
                },
              }
            : {}),
        };
        await setDoc(userDocRef, userFirestoreData, { merge: true });

        // Re-fetch the document to get the server-resolved timestamps
        const newDocSnap = await getDoc(userDocRef);
        if (newDocSnap.exists()) {
          userFirestoreData = newDocSnap.data() as UserFirestoreData;
        } else {
          // Log an error if the document somehow doesn't exist after creation
          console.error(`Failed to re-fetch user document for ${user.uid} after creation.`);
        }
      } else {
        // isNewUser=false かつ doc が存在するケース。
        // ただし Firebase Auth 削除後の再サインインでは isNewUser が false になる場合があるため、
        // welcomeEmailSentAt が未設定なら新規扱いとして後続の送信処理に委ねる。
        userFirestoreData = userDocSnap.data() as UserFirestoreData;
        let needsFirestoreUpdate = false;
        const updatePayload: Partial<UserFirestoreData> = {
          updatedAt: serverTimestamp() as FirestoreTimestamp,
        };

        // displayName や email が Firestore になければ Auth からコピー
        if (!userFirestoreData.displayName && firebaseUser.displayName) {
          updatePayload.displayName = firebaseUser.displayName;
          needsFirestoreUpdate = true;
        }
        if (!userFirestoreData.email && firebaseUser.email) {
          updatePayload.email = firebaseUser.email;
          needsFirestoreUpdate = true;
        }

        if (typeof userFirestoreData.termsAccepted !== 'boolean') {
          updatePayload.termsAccepted = false;
          needsFirestoreUpdate = true;
        }
        if (!userFirestoreData.subscriptionStatus) {
          console.warn(
            `Firestore doc for ${user.uid} missing subscriptionStatus. Treating as inactive without client-side correction.`
          );
        }
        if (needsFirestoreUpdate) {
          console.log(`Updating existing Firestore doc for ${user.uid} with defaults/corrections.`);
          await updateDoc(userDocRef, updatePayload);
          const updatedDocSnap = await getDoc(userDocRef); // Re-fetch
          userFirestoreData = updatedDocSnap.exists()
            ? (updatedDocSnap.data() as UserFirestoreData)
            : userFirestoreData;
        }
      }

      // welcomeEmailSentAt が未設定であればウェルカムメールを送信する。
      // isNewUser や doc 存在チェックは競合条件・Firebase Auth 削除後の再サインイン等で
      // 信頼できないため、Cloud Function 側の冪等チェック（welcomeEmailSentAt）に委ねる。
      if (!userFirestoreData?.welcomeEmailSentAt) {
        console.log(
          `[signInWithGoogle] welcomeEmailSentAt not set for ${user.uid}. Sending welcome email.`
        );
        try {
          const functions = getFunctions(getApp(), 'asia-northeast1');
          await httpsCallable(functions, 'sendWelcomeEmailForNewUser')();
        } catch (welcomeEmailError) {
          console.error('[signInWithGoogle] Failed to send welcome email:', welcomeEmailError);
        }
      }

      // RTDBからProfileとSettingsを取得 & 新規ユーザーなら作成
      const profileRef = dbRef(database, `user-data/${user.uid}/profile`);
      const settingsRef = dbRef(database, `user-data/${user.uid}/settings`);

      const [profileSnapshot, settingsSnapshot] = await Promise.all([
        get(profileRef),
        get(settingsRef),
      ]);

      const profileData = profileSnapshot.exists() ? profileSnapshot.val() : {};
      const settingsData = settingsSnapshot.exists() ? settingsSnapshot.val() : {};

      const userProfileInfo = {
        role: profileData.role ?? '',
        avatarUrl: profileData.avatarUrl ?? DEFAULT_AVATAR_URL,
        backgroundImageUrl: profileData.backgroundImageUrl ?? DEFAULT_BACKGROUND_IMAGE_URL,
        chatGptApiKey: settingsData.chatGptApiKey ?? '',
        geminiApiKey: settingsData.geminiApiKey ?? '',
        anthropicApiKey: settingsData.anthropicApiKey ?? '',
        rakutenAppId: settingsData.rakutenAppId ?? '',
        amazonAccessKey: settingsData.amazonAccessKey ?? '',
        amazonSecretKey: settingsData.amazonSecretKey ?? '',
        dmmAffiliateId: settingsData.dmmAffiliateId ?? '',
        dmmApiId: settingsData.dmmApiId ?? '',
        googleSheetUrl: settingsData.googleSheetUrl ?? '',
        gasProxyInitializedAt: settingsData.gasProxyInitializedAt ?? '',
        discordPostResultNotificationEnabled:
          settingsData.discordPostResultNotificationEnabled ?? false,
        discordWebhookUrlSaved:
          settingsData.discordWebhookUrlSaved ??
          settingsData.discordPostResultNotificationEnabled ??
          false,
      };

      const serializedFirestoreUserData = serializeUserFirestoreData(userFirestoreData);
      await registerPendingReferralCode(isNewUser && getAppLanguage() === 'ja');
      const appUser: AppUser = {
        ...firebaseUser,
        ...userProfileInfo,
        ...serializedFirestoreUserData,
      };

      console.log(
        `Google Sign in for ${user.uid}, Terms: ${appUser.termsAccepted}, Sub: ${appUser.subscriptionStatus}, New: ${isNewUser}`
      );
      return appUser;
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked') {
        console.warn('Google sign-in popup was blocked. Falling back to redirect sign-in.');
        try {
          await signInWithRedirect(auth, googleProvider);
          return thunkApi.rejectWithValue('Googleログインページへ移動しています。');
        } catch (redirectError: any) {
          console.error('Google redirect sign-in fallback failed:', redirectError);
          const redirectErrorMessage = translateFirebaseAuthError(redirectError);
          return thunkApi.rejectWithValue(redirectErrorMessage);
        }
      }

      // ユーザーがポップアップを閉じた、または前のリクエストがキャンセルされた場合は
      // エラーとして扱わず静かに終了する（再クリックで正常にサインインできる）
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request'
      ) {
        console.info('Google sign-in popup was closed or cancelled. No action needed.');
        return thunkApi.rejectWithValue('');
      }

      console.error('Google sign-in error:', error);
      const errorMessage = translateFirebaseAuthError(error);
      return thunkApi.rejectWithValue(errorMessage);
    }
  }
);

/**
 * メールとパスワードで新規登録
 */
export const signUpWithEmailAndPassword = createAsyncThunk<
  AppUser,
  SignUpWithEmailPasswordData,
  { rejectValue: string }
>(`${SLICE_NAME}/signUpWithEmailAndPassword`, async (args, thunkApi) => {
  const { email, password, displayName } = args;
  try {
    // 1. Firebase Authentication でユーザーを作成
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user) {
      return thunkApi.rejectWithValue('Failed to create user account.');
    }

    // 2. (オプション) Firebase Auth プロファイルに表示名を更新
    if (displayName) {
      await updateFirebaseProfile(user, { displayName });
    }

    const firebaseUser: FirebaseAuthUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || displayName || null, // AuthのdisplayNameを優先
      photoURL: user.photoURL,
    };

    // 3. Firestore にユーザードキュメントを作成
    const userDocRef = doc(db, 'users', user.uid);
    const userFirestoreData: UserFirestoreData = {
      email: firebaseUser.email, // ★ Emailをコピー
      displayName: firebaseUser.displayName, // ★ displayNameをコピー
      termsAccepted: false,
      createdAt: serverTimestamp() as FirestoreTimestamp,
      updatedAt: serverTimestamp() as FirestoreTimestamp,
      subscriptionStatus: 'inactive',
      // 他のサブスクリプションフィールドはデフォルトで undefined/null
      // bankPaymentInfo も初期状態では null
      bankPaymentInfo: null,
      applyMailchimpTag: getMailchimpTag('registered'),
      preferredLanguage: getAppLanguage(),
    };
    await setDoc(userDocRef, userFirestoreData);
    // serverTimestamp() を解決するために再度取得 (今回はシリアライズ時に toDate() するので必須ではないが、一貫性のため)
    const newUserDocSnap = await getDoc(userDocRef);
    const finalUserFirestoreData = newUserDocSnap.exists()
      ? (newUserDocSnap.data() as UserFirestoreData)
      : userFirestoreData;

    // 4. RTDB にプロファイルと設定の初期データを作成
    const profileRefRTDB = dbRef(database, `user-data/${user.uid}/profile`);
    const settingsRefRTDB = dbRef(database, `user-data/${user.uid}/settings`);

    const defaultProfileData: Partial<UserProfileInfo> = {
      role: '',
      avatarUrl: user.photoURL || DEFAULT_AVATAR_URL, // Googleサインイン時などphotoURLがあれば使う
      backgroundImageUrl: DEFAULT_BACKGROUND_IMAGE_URL,
    };
    const defaultSettingsData: Partial<UserProfileInfo> = {
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
    };

    await Promise.all([
      setRTDB(profileRefRTDB, defaultProfileData),
      setRTDB(settingsRefRTDB, defaultSettingsData),
    ]);

    const userProfileInfo: UserProfileInfo = {
      ...defaultProfileData,
      ...defaultSettingsData,
    } as UserProfileInfo; // 型アサーション

    // 5. すべての情報をマージして AppUser を作成
    const serializedFirestoreUserData = serializeUserFirestoreData(finalUserFirestoreData);
    await registerPendingReferralCode(getAppLanguage() === 'ja');
    const appUser: AppUser = {
      ...firebaseUser,
      ...userProfileInfo,
      ...serializedFirestoreUserData,
      isNewUser: true, // 新規登録なので true
    };

    console.log(`Sign up successful for new user ${user.uid}, DisplayName: ${appUser.displayName}`);
    return appUser;
  } catch (error: any) {
    console.error('Sign up error:', error);
    const errorMessage = translateFirebaseAuthError(error);
    return thunkApi.rejectWithValue(errorMessage);
  }
});

/**
 * Firebase Authentication のメールアドレスを更新する
 * 成功すると、Firebase Auth から新しいメールアドレスに確認メールが送信される。
 * Firestore の email フィールドの同期は listenAuthState で行われる。
 */
export const updateUserEmail = createAsyncThunk<
  void, // 成功時は何も返さない
  { newEmail: string; currentPassword: string }, // 引数の型
  { state: RootState; rejectValue: string } // thunkApiの型
>(`${SLICE_NAME}/updateUserEmail`, async (args, thunkApi) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return thunkApi.rejectWithValue('ユーザーが認証されていません。');
  }
  console.log(
    'updateUserEmail Thunk - Start - currentUser.emailVerified:',
    currentUser.emailVerified
  ); // ★ログ追加

  const { newEmail, currentPassword } = args;

  try {
    // Step 1: もし currentPassword が提供されていれば、再認証を試みる
    if (currentPassword && currentUser.email) {
      console.log(
        'updateUserEmail Thunk - Before reauth - currentUser.emailVerified:',
        currentUser.emailVerified
      ); // ★ログ追加
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      try {
        await reauthenticateWithCredential(currentUser, credential);
        console.log('User re-authenticated successfully before email update.');
        console.log(
          'updateUserEmail Thunk - After reauth - currentUser.emailVerified:',
          auth.currentUser?.emailVerified
        ); // ★ログ追加 (auth.currentUserを再参照)
      } catch (reauthError: any) {
        console.error('Re-authentication failed:', reauthError);
        // 再認証失敗の具体的なエラーメッセージを返す
        const translatedError = translateFirebaseAuthError(reauthError);
        return thunkApi.rejectWithValue(`再認証に失敗しました: ${translatedError}`);
      }
    }
    // Step 2: メールアドレスの更新を試みる
    await updateEmail(currentUser, newEmail);
    console.log(`Verification email sent to ${newEmail} for user ${currentUser.uid}.`);
  } catch (error: any) {
    console.error('Error updating Firebase Auth email:', error.code, error.message);
    // Handle specific Firebase error codes
    if (error.code === 'auth/requires-recent-login') {
      return thunkApi.rejectWithValue(
        'この操作はセキュリティ上の理由から、最近ログインしたユーザーのみに許可されています。お手数ですが、一度サインアウトしてから再度ログインし、もう一度お試しください。'
      );
    }
    if (error.code === 'auth/operation-not-allowed') {
      if (!currentUser.emailVerified) {
        return thunkApi.rejectWithValue(
          '現在のメールアドレスが確認されていません。メールアドレスを変更する前に、まず現在のメールアドレスの確認を完了してください。プロフィールページから確認メールを再送信できます。'
        );
      }
      // If current email is verified, 'auth/operation-not-allowed' might imply a need for re-authentication or other restrictions.
      return thunkApi.rejectWithValue(
        'メールアドレスの変更が許可されていません。セキュリティ上の理由から、最近の再ログインが必要な場合があります。お手数ですが、一度サインアウトして再度ログイン後にお試しいただくか、サポートにお問い合わせください。'
      );
    }
    // Fallback to a generic translated error message
    const translatedErrorMessage = translateFirebaseAuthError(error);
    return thunkApi.rejectWithValue(translatedErrorMessage);
  }
});

/**
 * ユーザーパスワードの更新
 */
export const updateUserPassword = createAsyncThunk<
  void,
  { newPassword: string },
  { state: RootState }
>(`${SLICE_NAME}/updatePassword`, async (args, thunkApi) => {
  try {
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, args.newPassword);
      return;
    }
    throw new Error('User is not authenticated');
  } catch (error: any) {
    return thunkApi.rejectWithValue(error.message);
  }
});

/**
 * サインアウト
 */
export const signOut = createAsyncThunk<void, void, { state: RootState }>(
  `${SLICE_NAME}/signOut`,
  async (_, thunkApi) => {
    try {
      await auth.signOut();
    } catch (error: any) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

/**
 * 認証状態の監視
 * Redux環境外からも使えるよう、関数を返すパターンに変更
 */
export const listenAuthState = () => {
  return (dispatch: AppDispatch): Unsubscribe => {
    console.log('Starting auth state listener...');
    dispatch({ type: `${SLICE_NAME}/setLoading`, payload: true }); // 初期読み込み開始

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('Auth state changed. User:', user?.uid ?? 'null');
      if (user) {
        try {
          // 認証ユーザーがいる場合、FirestoreとRTDBからデータを並列取得
          const userDocRef = doc(db, 'users', user.uid);
          const profileRef = dbRef(database, `user-data/${user.uid}/profile`);
          const settingsRef = dbRef(database, `user-data/${user.uid}/settings`);

          const [userDocSnap, profileSnapshot, settingsSnapshot] = await Promise.all([
            getDoc(userDocRef),
            get(profileRef),
            get(settingsRef),
          ]);

          let userData: UserFirestoreData | null = null;
          // let termsAccepted: boolean = false; // デフォルトを false に // userDataから直接取得するため不要

          if (userDocSnap.exists()) {
            userData = userDocSnap.data() as UserFirestoreData;
            let needsFirestoreUpdate = false;
            const firestoreUpdatePayload: Partial<UserFirestoreData> = {};

            // AuthのemailとFirestoreのemailを比較し、異なればAuthを正とする
            if (user.email && userData.email !== user.email) {
              console.warn(
                `[listenAuthState] Firestore email for ${user.uid} (${userData.email}) differs from Auth email (${user.email}). Updating Firestore.`
              );
              firestoreUpdatePayload.email = user.email;
              needsFirestoreUpdate = true;
            }

            if (user.emailVerified && userData.emailVerified !== true) {
              firestoreUpdatePayload.emailVerified = true;
              firestoreUpdatePayload.emailVerifiedAt = serverTimestamp() as FirestoreTimestamp;
              needsFirestoreUpdate = true;
            }

            // AuthのdisplayNameとFirestoreのdisplayNameを比較し、異なればAuthを正とする
            // (AuthのdisplayNameがnullでない場合)
            if (user.displayName && userData.displayName !== user.displayName) {
              console.warn(
                `[listenAuthState] Firestore displayName for ${user.uid} (${userData.displayName}) differs from Auth displayName (${user.displayName}). Updating Firestore.`
              );
              firestoreUpdatePayload.displayName = user.displayName;
              needsFirestoreUpdate = true;
            } else if (!userData.displayName && user.displayName) {
              // FirestoreにdisplayNameがなく、Authに存在する場合も更新
              console.warn(
                `[listenAuthState] Firestore displayName for ${user.uid} is null, but Auth displayName is (${user.displayName}). Updating Firestore.`
              );
              firestoreUpdatePayload.displayName = user.displayName;
              needsFirestoreUpdate = true;
            }

            // termsAccepted が boolean でない場合、false に修正
            if (typeof userData.termsAccepted !== 'boolean') {
              firestoreUpdatePayload.termsAccepted = false;
              needsFirestoreUpdate = true;
            }
            if (!userData.subscriptionStatus) {
              console.warn(
                `[listenAuthState] User ${user.uid} missing subscriptionStatus. Treating as inactive without client-side correction.`
              );
            }

            if (needsFirestoreUpdate) {
              console.warn(
                `[listenAuthState] User ${user.uid} Firestore data needs correction. Updating.`
              );
              firestoreUpdatePayload.updatedAt = serverTimestamp() as FirestoreTimestamp;
              await updateDoc(userDocRef, firestoreUpdatePayload);
              // To ensure userData passed to setUser is the most current:
              const updatedSnap = await getDoc(userDocRef); // Re-fetch
              userData = updatedSnap.exists() ? (updatedSnap.data() as UserFirestoreData) : null;
            }
          } else {
            console.warn(
              `[listenAuthState] User ${user.uid} Firestore document not found. Creating with Auth info.`
            );
            // Firestoreにドキュメントがない場合は、Authの情報で新規作成
            const isGoogleUser = user.providerData.some((p) => p.providerId === 'google.com');
            userData = {
              email: user.email, // Authのemail
              emailVerified: user.emailVerified,
              ...(user.emailVerified
                ? { emailVerifiedAt: serverTimestamp() as FirestoreTimestamp }
                : {}),
              displayName: user.displayName, // AuthのdisplayName
              termsAccepted: false, // デフォルト
              createdAt: serverTimestamp() as FirestoreTimestamp,
              updatedAt: serverTimestamp() as FirestoreTimestamp,
              subscriptionStatus: 'inactive', // デフォルト
              bankPaymentInfo: null, // 初期状態
              isAdmin: false, // デフォルト
              applyMailchimpTag: getMailchimpTag('registered'),
              preferredLanguage: getAppLanguage(),
              // Googleユーザーは acceptTerms で firstMonthDiscount を有効化するため
              // pending_terms 状態で初期化する
              ...(isGoogleUser && getAppLanguage() === 'ja'
                ? {
                    firstMonthDiscount: {
                      status: 'pending_terms',
                      currency: FIRST_MONTH_DISCOUNT_CURRENCY,
                      validDays: FIRST_MONTH_DISCOUNT_VALID_DAYS,
                      source: 'google_new_user',
                    },
                  }
                : {}),
            };
            // merge: true で書き込み、signInWithGoogle thunk との競合時に
            // 先に書かれた firstMonthDiscount 等を上書きしないようにする
            await setDoc(userDocRef, userData, { merge: true });
            // serverTimestampを解決するために再取得
            const newDocSnap = await getDoc(userDocRef);
            userData = newDocSnap.exists() ? (newDocSnap.data() as UserFirestoreData) : null;

            // 新規ユーザーのウェルカムメールを送信（リダイレクトフロー含む）
            try {
              const functions = getFunctions(getApp(), 'asia-northeast1');
              await httpsCallable(functions, 'sendWelcomeEmailForNewUser')();
            } catch (welcomeEmailError) {
              console.error('[listenAuthState] Failed to send welcome email:', welcomeEmailError);
            }
          }

          const profileData = profileSnapshot.exists() ? profileSnapshot.val() : {};
          const settingsData = settingsSnapshot.exists() ? settingsSnapshot.val() : {};
          const userProfile: UserProfileInfo = {
            role: profileData.role ?? '',
            avatarUrl: profileData.avatarUrl ?? DEFAULT_AVATAR_URL,
            backgroundImageUrl: profileData.backgroundImageUrl ?? DEFAULT_BACKGROUND_IMAGE_URL,
            chatGptApiKey: settingsData.chatGptApiKey ?? '',
            geminiApiKey: settingsData.geminiApiKey ?? '',
            anthropicApiKey: settingsData.anthropicApiKey ?? '',
            rakutenAppId: settingsData.rakutenAppId ?? '',
            amazonAccessKey: settingsData.amazonAccessKey ?? '',
            amazonSecretKey: settingsData.amazonSecretKey ?? '',
            dmmAffiliateId: settingsData.dmmAffiliateId ?? '',
            dmmApiId: settingsData.dmmApiId ?? '',
            googleSheetUrl: settingsData.googleSheetUrl ?? '',
            gasProxyInitializedAt: settingsData.gasProxyInitializedAt ?? '',
            discordPostResultNotificationEnabled:
              settingsData.discordPostResultNotificationEnabled ?? false,
            discordWebhookUrlSaved:
              settingsData.discordWebhookUrlSaved ??
              settingsData.discordPostResultNotificationEnabled ??
              false,
          };

          if (!profileSnapshot.exists()) {
            // RTDBプロファイルが存在しない場合の処理 (必要であれば)
          }

          const serializableUser = user
            ? {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                // AppUser に含まれる他の Auth 由来のフィールドもここに追加
              }
            : null;
          // storeにユーザーデータを保存
          const serializableUserData = userData ? serializeUserFirestoreData(userData) : null;

          const payload: SetUserPayload = {
            user: serializableUser,
            userData: serializableUserData,
            userProfile,
          };
          dispatch(setUser(payload));
        } catch (error: any) {
          console.error('[listenAuthState] Error fetching user data:', error);
          // エラーが発生しても基本的なAuth情報はセットする (ユーザーは認証されているため)
          const serializableUserOnError = user
            ? {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
              }
            : null;
          dispatch(
            setUser({
              user: serializableUserOnError,
              userData: null,
              userProfile: null,
            })
          );
          dispatch({ type: `${SLICE_NAME}/setError`, payload: 'Failed to load user data.' }); // エラー状態をセット
        } finally {
          dispatch({ type: `${SLICE_NAME}/setLoading`, payload: false }); // データ取得試行完了
        }
      } else {
        // 認証ユーザーがいない場合、初期状態に戻す
        dispatch(
          setUser({
            user: null,
            userData: null,
            userProfile: null,
          })
        );
        dispatch({ type: `${SLICE_NAME}/setLoading`, payload: false }); // 認証状態の変更を通知
      }
    });

    // リスナーのクリーンアップ関数を返す
    return unsubscribe;
  };
};

/**
 * カスタムメール検証メールを送信するThunk
 */
export const sendVerificationEmailThunk = createAsyncThunk<
  SendVerificationEmailThunkPayload, // 成功時の返り値の型
  SendVerificationEmailThunkArg, // 引数の型
  { rejectValue: { message: string } } // エラー時のrejectValueの型
>(`${SLICE_NAME}/sendVerificationEmail`, async ({ lang }, { rejectWithValue }) => {
  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1'); // リージョン指定が必要な場合は第2引数で
    const callSendCustomVerificationEmail = httpsCallable<
      { lang: string }, // Cloud Functionの引数の型
      SendVerificationEmailThunkPayload // Cloud Functionの返り値の型
    >(functions, 'sendCustomVerificationEmail');

    const result = await callSendCustomVerificationEmail({ lang });

    if (result.data.success) {
      return result.data;
    }
    // Cloud Function側で success: false だがエラーではない場合
    return rejectWithValue({ message: result.data.message || 'メール送信に失敗しました。' });
  } catch (error: any) {
    console.error('Error sending custom verification email via thunk:', error);
    const errorMessage =
      error.message || error.details?.message || 'メール送信中に予期せぬエラーが発生しました。';
    return rejectWithValue({ message: errorMessage });
  }
});

/**
 * 現在認証されているFirebase Authenticationユーザーアカウントを削除するThunk
 */
export const deleteCurrentUserAccountThunk = createAsyncThunk<
  DeleteUserThunkPayload, // 成功時の返り値の型
  void, // 引数なし
  { rejectValue: DeleteUserThunkError } // エラー時のrejectValueの型
>(`${SLICE_NAME}/deleteCurrentUserAccount`, async (_, { rejectWithValue }) => {
  // currentUserのチェックはCloud Function側で行われるため、ここでは不要
  // ただし、UI側でログイン状態を確認してからこのThunkを呼ぶのが一般的
  if (!auth.currentUser) {
    //念のためフロントエンドでもチェック
    return rejectWithValue({
      message: 'ユーザーが認証されていません。アカウントを削除できません。',
    });
  }

  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1'); // リージョン指定が必要な場合は適宜追加
    const callDeleteUserAccount = httpsCallable<
      null, // Cloud Functionへの引数なし
      DeleteUserThunkPayload // Cloud Functionからの返り値の型
    >(functions, 'deleteUserAccount');

    const result = await callDeleteUserAccount(null); // 引数なしで呼び出し

    if (result.data.success) {
      // アカウント削除成功。Cloud Functionがデータ削除、Authからの削除、メール送信を実行済み。
      // Reduxストアのユーザー情報は、authSlice側でクリアする（サインアウトと同様の処理）。
      return result.data;
    }
    // Reduxストアのユーザー情報は、authSlice側でクリアする（サインアウトと同様の処理）。
    return rejectWithValue({ message: result.data.message || 'アカウントの削除に失敗しました。' });
  } catch (error: any) {
    console.error('Error deleting user account via thunk:', error);
    const errorMessage =
      error.message || error.details?.message || 'アカウントの削除中にエラーが発生しました。';
    return rejectWithValue({ message: errorMessage });
  }
});

// Cloud Function 'sendPasswordResetLink' を呼び出すThunk
export const sendPasswordResetEmail = createAsyncThunk<
  SendVerificationEmailThunkPayload, // 成功時の型を SendVerificationEmailThunkPayload に合わせる
  { email: string; lang: string }, // 引数の型をオブジェクトに変更
  { rejectValue: { message: string } } // エラー時の型を合わせる
>('auth/sendPasswordResetEmail', async ({ email, lang }, { rejectWithValue }) => {
  // 引数から email と lang を直接受け取る
  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1'); // functions インスタンスを取得
    const callSendPasswordReset = httpsCallable<
      { email: string; lang: string },
      SendVerificationEmailThunkPayload // Cloud Functionからの期待される戻り値型
    >(functions, 'sendPasswordResetLink');
    const result = await callSendPasswordReset({ email, lang });
    return result.data; // Cloud Functionからのレスポンスをそのまま返す
  } catch (error: any) {
    console.error('Error calling sendPasswordResetLink Cloud Function:', error);
    // Firebase Functionsからのエラーは code と message を持つことが多い
    const message = error.message || 'パスワードリセットメールの送信に失敗しました。';
    return rejectWithValue({ message }); // エラーメッセージをオブジェクトでラップ
  }
});
