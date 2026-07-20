import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Database, getDatabase } from 'firebase/database';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

// --- デフォルト Firebase アプリの初期化 ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_DATABASE_URL,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

// Initialize Firebase only if it hasn't been initialized yet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth: Auth = getAuth(app);
const database: Database = getDatabase(app);
const storage: FirebaseStorage = getStorage(app);
const db: Firestore = getFirestore(app);

export { auth, db, database, storage, app as firebaseApp };
export default app;

// --- セカンダリ Firebase アプリの設定 ---
const secondaryFirebaseConfig = {
  apiKey: import.meta.env.VITE_SECONDARY_API_KEY,
  authDomain: import.meta.env.VITE_SECONDARY_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_SECONDARY_PROJECT_ID,
  storageBucket: import.meta.env.VITE_SECONDARY_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_SECONDARY_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_SECONDARY_APP_ID,
  // measurementId: import.meta.env.VITE_SECONDARY_MEASUREMENT_ID, // 必要なら
};

const SECONDARY_APP_NAME = 'secondary'; // セカンダリアプリの一意な名前

/**
 * セカンダリ Firebase アプリを初期化または取得する
 * @returns {FirebaseApp} セカンダリ Firebase アプリインスタンス
 */
const initializeSecondaryApp = (): FirebaseApp => {
  const existingApp = getApps().find((app) => app.name === SECONDARY_APP_NAME);
  if (existingApp) {
    return existingApp;
  }
  // 設定情報が不足している場合のチェック (任意)
  if (!secondaryFirebaseConfig.projectId) {
    throw new Error('Secondary Firebase configuration is missing Project ID.');
  }
  // セカンダリアプリを名前付きで初期化
  return initializeApp(secondaryFirebaseConfig, SECONDARY_APP_NAME);
};

/**
 * セカンダリプロジェクトの Firestore インスタンスを取得する
 * @returns {Firestore} セカンダリ Firestore インスタンス
 */
export const getSecondaryFirestore = (): Firestore => {
  const secondaryApp = initializeSecondaryApp();
  return getFirestore(secondaryApp);
};

// 必要であれば、セカンダリプロジェクトの他のサービス (Auth, Storage など) を
// 取得する関数も同様に作成できます。
// export const getSecondaryAuth = () => getAuth(initializeSecondaryApp());
// export const getSecondaryStorage = () => getStorage(initializeSecondaryApp());
