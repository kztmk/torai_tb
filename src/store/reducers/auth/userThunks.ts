// src/store/reducers/auth/userThunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getApp } from 'firebase/app';
import { updateProfile } from 'firebase/auth';
import { ref as dbRef, get, set as setRTDB } from 'firebase/database';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'; // FieldValue と serverTimestamp をインポート
import { getFunctions, httpsCallable } from 'firebase/functions'; // Firebase Functions v9
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { auth, database, db, storage } from '@/firebase';
import { RootState } from '../../index';
import { DEFAULT_AVATAR_URL, DEFAULT_BACKGROUND_IMAGE_URL, SLICE_NAME } from './constants';
import { uploadImage } from './helpers';
import {
  BankTransferConfirmationResponse, // ★ 追加
  BankTransferResponse,
  CancelBankTransferResponse,
  ProfileData,
  ProfileUpdateData,
  ProfileUpdateResult,
  RequestBankTransferConfirmationData, // ★ 追加
  RequestBankTransferData,
} from './types';

/**
 * ユーザープロフィールを取得する
 */
export const getUserProfile = createAsyncThunk<ProfileData, void, { state: RootState }>(
  `${SLICE_NAME}/getUserProfile`,
  async (_, thunkApi) => {
    const user = thunkApi.getState().auth.user;
    if (!user) {
      throw new Error('User is not authenticated');
    }
    try {
      const userRef = dbRef(database, `user-data/${user.uid}/profile`);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        return {
          role: '',
          avatarUrl: DEFAULT_AVATAR_URL,
          backgroundImageUrl: DEFAULT_BACKGROUND_IMAGE_URL,
        };
      }
      const data = snapshot.val();
      return {
        role: data.role ?? '',
        avatarUrl: data.avatarUrl ?? DEFAULT_AVATAR_URL,
        backgroundImageUrl: data.backgroundImageUrl ?? DEFAULT_BACKGROUND_IMAGE_URL,
      };
    } catch (error: any) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

/**
 * ユーザープロフィール画像を取得する
 */
export const getProfileImages = createAsyncThunk<
  { avatarUrl: string; backgroundImageUrl: string },
  void,
  { state: RootState }
>(`${SLICE_NAME}/getProfileImages`, async (_, thunkApi) => {
  const user = thunkApi.getState().auth.user;
  // Ensure user is not null before accessing its properties
  if (!user) {
    // Handle the case where user is null, e.g., by throwing an error or returning default values
    return {
      avatarUrl: DEFAULT_AVATAR_URL,
      backgroundImageUrl: DEFAULT_BACKGROUND_IMAGE_URL,
    };
  }
  const { uid } = user; // Now safe to destructure uid
  const avatarFileRef = storageRef(storage, `user-data/${uid}/images/avatar.jpg`);
  const backgroundImageFileRef = storageRef(storage, `user-data/${uid}/images/background.jpg`);
  try {
    const avatarUrl = await getDownloadURL(avatarFileRef);
    const backgroundImageUrl = await getDownloadURL(backgroundImageFileRef);
    return { avatarUrl, backgroundImageUrl };
  } catch (error) {
    return {
      avatarUrl: DEFAULT_AVATAR_URL,
      backgroundImageUrl: DEFAULT_BACKGROUND_IMAGE_URL,
    };
  }
});

/**
 * プロフィールを更新する
 */
export const setProfile = createAsyncThunk<
  ProfileUpdateResult,
  ProfileUpdateData,
  { state: RootState }
>(`${SLICE_NAME}/setProfile`, async (args, thunkApi) => {
  const appUser = thunkApi.getState().auth.user;
  const currentUser = auth.currentUser;

  if (!appUser?.uid || !currentUser) {
    console.log('Set profile failed: User not authenticated.');
    return thunkApi.rejectWithValue('User is not authenticated');
  }
  const { uid } = appUser;

  try {
    let avatarUrl = appUser.avatarUrl ?? DEFAULT_AVATAR_URL;
    let backgroundImageUrl = appUser.backgroundImageUrl ?? DEFAULT_BACKGROUND_IMAGE_URL;
    const updatedAuthProfileData: { displayName?: string; photoURL?: string } = {};

    // アバター画像のアップロード
    if (args.avatar) {
      console.log(`Uploading new avatar for user ${uid}`);
      avatarUrl = await uploadImage(args.avatar, uid, 'avatar');
      updatedAuthProfileData.photoURL = avatarUrl;
    }

    // 背景画像のアップロード
    if (args.backgroundImage) {
      console.log(`Uploading new background image for user ${uid}`);
      backgroundImageUrl = await uploadImage(args.backgroundImage, uid, 'background');
    }

    // 表示名の更新
    if (args.displayName !== appUser.displayName) {
      console.log(`Updating display name for user ${uid} to "${args.displayName}"`);
      updatedAuthProfileData.displayName = args.displayName;
    }

    // Auth プロファイルの更新（表示名とプロフィール画像）
    if (Object.keys(updatedAuthProfileData).length > 0) {
      await updateProfile(currentUser, updatedAuthProfileData);
      console.log(`Firebase Auth profile updated for user ${uid}`, updatedAuthProfileData);
    }

    // Firestore users ドキュメントの displayName と updatedAt を更新
    if (args.displayName !== appUser.displayName) {
      const userDocRefFirestore = doc(db, 'users', uid);
      await updateDoc(userDocRefFirestore, {
        displayName: args.displayName,
        updatedAt: serverTimestamp(), // Firestoreのサーバータイムスタンプ
      });
      console.log(`Firestore users/${uid} displayName updated to "${args.displayName}"`);
    }

    // RTDB プロファイルの更新
    const userRefRTDB = dbRef(database, `user-data/${uid}/profile`);
    const profileUpdateRTDB = {
      role: args.role,
      avatarUrl,
      backgroundImageUrl,
    };
    console.log(`Updating RTDB profile for user ${uid}`, profileUpdateRTDB);
    await setRTDB(userRefRTDB, profileUpdateRTDB);

    return {
      displayName: args.displayName,
      role: args.role,
      avatarUrl,
      backgroundImageUrl,
    };
  } catch (error: any) {
    console.log('Error updating profile:', error);
    return thunkApi.rejectWithValue(error.message || 'Failed to update profile');
  }
});

/**
 * 利用規約に同意する
 * 拡張機能「Manage Marketing with Mailchimp」を使用してMailchimpのタグをユーザードキュメントに追加するロジックも含む
 *
 */
export const acceptTerms = createAsyncThunk<
  { termsAccepted: boolean; isAdmin: boolean }, // 成功時に返す型
  void, // 引数の型
  { state: RootState; rejectValue: string } // thunkApiの型
>(`${SLICE_NAME}/acceptTerms`, async (_, thunkApi) => {
  const uid = thunkApi.getState().auth.user?.uid;
  if (!uid) {
    console.error('Accept terms failed: User not authenticated.');
    return thunkApi.rejectWithValue('User not authenticated.');
  }
  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1');
    const callAcceptTerms = httpsCallable<undefined, { termsAccepted: boolean; isAdmin: boolean }>(
      functions,
      'acceptTerms'
    );
    const result = await callAcceptTerms(undefined);
    console.log(`Terms accepted for user ${uid}.`);
    return result.data;
  } catch (error: any) {
    console.error('Error accepting terms:', error);
    return thunkApi.rejectWithValue(error.message || 'Failed to accept terms.');
  }
});

/**
 * 銀行振込による支払いリクエストを行う (Cloud Function呼び出し)
 */
export const requestBankTransfer = createAsyncThunk<
  BankTransferResponse, // 成功時に返す型
  { planId: string }, // 引数の型 (planId を含むオブジェクト)
  { state: RootState; rejectValue: string } // thunkApiの型
>(`${SLICE_NAME}/requestBankTransfer`, async (args, thunkApi) => {
  const { planId } = args;
  const user = thunkApi.getState().auth.user;

  if (!user?.uid) {
    console.error('Request bank transfer failed: User not authenticated.');
    return thunkApi.rejectWithValue('この操作を行うには認証が必要です。');
  }

  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1'); // Firebase Functionsインスタンスを取得
    const callRequestBankTransfer = httpsCallable<RequestBankTransferData, BankTransferResponse>(
      functions,
      'requestBankTransferPayment'
    );

    const result = await callRequestBankTransfer({ planId });

    // Cloud Function側でエラーは HttpsError としてスローされる想定
    // ここでは result.data が BankTransferResponse であることを期待
    return result.data;
  } catch (error: any) {
    console.error('Error requesting bank transfer payment via thunk:', error);
    return thunkApi.rejectWithValue(
      error.message || '銀行振込の申込処理中にエラーが発生しました。'
    );
  }
});

/**
 * 銀行振込完了確認リクエストを行う (Cloud Function呼び出し)
 */
export const requestBankTransferConfirmationThunk = createAsyncThunk<
  BankTransferConfirmationResponse, // 成功時に返す型
  { transferName: string }, // 引数の型
  { state: RootState; rejectValue: string } // thunkApiの型
>(`${SLICE_NAME}/requestBankTransferConfirmation`, async (args, thunkApi) => {
  const { transferName } = args;
  const user = thunkApi.getState().auth.user;

  if (!user?.uid) {
    console.error('Request bank transfer confirmation failed: User not authenticated.');
    return thunkApi.rejectWithValue('この操作を行うには認証が必要です。');
  }
  if (!transferName || transferName.trim() === '') {
    return thunkApi.rejectWithValue('振込名義を入力してください。');
  }

  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1');
    const callRequestConfirmation = httpsCallable<
      RequestBankTransferConfirmationData,
      BankTransferConfirmationResponse
    >(functions, 'requestBankTransferConfirmation');

    const result = await callRequestConfirmation({ transferName });
    return result.data;
  } catch (error: any) {
    console.error('Error requesting bank transfer confirmation via thunk:', error);
    return thunkApi.rejectWithValue(
      error.message || '振込完了確認リクエストの処理中にエラーが発生しました。'
    );
  }
});

/**
 * 銀行振込申込みをキャンセルする (Cloud Function呼び出し)
 */
export const cancelBankTransferThunk = createAsyncThunk<
  CancelBankTransferResponse,
  void,
  { state: RootState; rejectValue: string }
>(`${SLICE_NAME}/cancelBankTransfer`, async (_, thunkApi) => {
  const user = thunkApi.getState().auth.user;

  if (!user?.uid) {
    console.error('Cancel bank transfer failed: User not authenticated.');
    return thunkApi.rejectWithValue('この操作を行うには認証が必要です。');
  }

  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1');
    const callCancelBankTransfer = httpsCallable<void, CancelBankTransferResponse>(
      functions,
      'cancelBankTransferPayment'
    );

    const result = await callCancelBankTransfer();
    return result.data;
  } catch (error: any) {
    console.error('Error canceling bank transfer via thunk:', error);
    return thunkApi.rejectWithValue(
      error.message || '銀行振込のお申込みキャンセル中にエラーが発生しました。'
    );
  }
});
