/**
 * Reduxストアの設定ファイル
 * アプリケーション全体の状態管理を行う
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import admin from './reducers/admin/adminSlice';
import adminSubscriptions from './reducers/adminSubscriptionsSlice';
import apiController from './reducers/apiControllerSlice';
import auth from './reducers/auth';
import generatedPosts from './reducers/generatedPostsSlice';
import googleAccessTokenState from './reducers/googleAccessTokenSlice';
import messages from './reducers/messagesSlice';
import referrals from './reducers/referralsSlice';
import subscriptionReducer from './reducers/subscriptionSlice';
import systemAnnouncements from './reducers/systemAnnouncementSlice';
import xAccounts from './reducers/xAccountsSlice';
import xErrors from './reducers/xErrorsSlice';
import xPosted from './reducers/xPostedSlice';
import xPosts from './reducers/xPostsSlice';
import xTrend from './reducers/xTrendSlice';
import xMarketing from './reducers/xMarketingSlice';

/**
 * 全てのリデューサーを統合したルートリデューサー
 * - auth: 認証情報の管理
 * - xAccounts: Xアカウント情報のCRUD管理
 * - xPosts: X投稿データのCRUD管理
 * - xPosted: X投稿済みデータの取得管理
 */
const rootReducer = combineReducers({
  auth,
  xAccounts,
  xPosts,
  xPosted,
  xErrors,
  apiController,
  googleAccessTokenState,
  systemAnnouncements,
  xTrend,
  xMarketing,
  generatedPosts,
  messages,
  referrals,
  subscription: subscriptionReducer,
  admin,
  adminSubscriptions,
});
export type RootState = ReturnType<typeof rootReducer>;

/**
 * Redux Toolkit設定ストア
 * ミドルウェアの追加やDevToolsの設定はconfigureStoreが自動的に行う
 */
const store = configureStore({
  reducer: rootReducer,
  // 必要に応じてミドルウェアやdevToolsの設定を追加可能
});

export type AppDispatch = typeof store.dispatch;
export default store;
