// src/store/reducers/auth/index.ts

// API Key関連のThunks
import { affiliateKeySave, saveApiKeys } from './apiThunks';
import authReducer, {
  initialize,
  resetTask,
  selectAuth,
  selectAuthError,
  selectAuthLoading,
  selectAuthTask,
  selectIsAuthenticated,
  selectTermsAccepted,
  selectUser,
  setError,
  setLoading,
  setUser,
} from './authSlice';
// 認証関連のThunks
import {
  deleteCurrentUserAccountThunk,
  listenAuthState,
  sendPasswordResetEmail,
  signIn,
  signInWithGoogle,
  signOut,
  updateUserEmail,
  updateUserPassword,
  updatePreferredLanguage,
} from './authThunks';
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

// 型定義をエクスポート
export * from './types';

// Reducerをデフォルトエクスポート
export default authReducer;

// アクションをエクスポート
export {
  // アクションクリエイター
  initialize,
  resetTask,
  setLoading,
  setError,
  setUser,

  // 認証関連Thunk
  signIn,
  signInWithGoogle,
  signOut,
  sendPasswordResetEmail,
  updateUserPassword,
  updateUserEmail,
  updatePreferredLanguage,
  deleteCurrentUserAccountThunk,
  listenAuthState,

  // ユーザープロファイル関連Thunk
  getUserProfile,
  getProfileImages,
  setProfile,
  cancelBankTransferThunk,
  requestBankTransferConfirmationThunk, // ★ 追加
  requestBankTransfer, // ★ 追加
  acceptTerms,

  // API Key関連Thunk
  saveApiKeys,
  affiliateKeySave,

  // セレクター
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectTermsAccepted,
  selectAuthError,
  selectAuthTask,
};
