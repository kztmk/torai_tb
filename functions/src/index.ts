// functions/src/index.ts
import admin from 'firebase-admin';

// Firebase Admin SDKの初期化 (アプリケーション全体で一度だけ行う)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// 各ハンドラファイルから関数をインポートしてエクスポート
export * from './handlers/stripe';
export * from './handlers/bankTransfer';
export * from './handlers/scheduled';
export * from './handlers/proxy';
export * from './handlers/auth';
export * from './handlers/migration';
export * from './handlers/mailchimp';
export * from './handlers/mokumokurenCoupon';
export * from './handlers/messages';
export * from './handlers/adminSubscriptions';
export * from './handlers/referrals';
export * from './handlers/freeTool';
export * from './handlers/xTrends';
// もし utils や config から直接エクスポートしたいものがあればここに追加
// export * from './utils';
// export * from './config';
