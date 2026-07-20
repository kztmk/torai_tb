import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { redirect } from 'react-router-dom';
import { APP_DEFAULT_PATH } from '@/config'; // デフォルトリダイレクト先

// --- Firebase & Redux関連 (loaderで使用) ---
// 注意: loader内ではReact Hooks (useSelectorなど) は使えません。
// 代わりに直接 Firebase Auth の状態を確認するか、
// アプリ初期化時に取得した情報を別
import { auth, db } from '@/firebase'; // Firebase Auth と Firestore をインポート

// project-imports
import { UserFirestoreData } from '@/types/auth'; // Firestoreの型定義

// --- Helper Function for Loader ---
// loader内で認証状態と規約同意状態をチェックする非同期関数
// (authSlice.ts の listenAuthState 内のロジックと似ているが、loader用に独立させる)
const checkAuthStatusForGuest = async (): Promise<{
  isAuthenticated: boolean;
  termsAccepted: boolean | null; // null: 未取得/エラー
}> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // 最初の状態変更のみ取得
      if (user) {
        // 認証済みの場合、Firestoreから規約同意状態を取得
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserFirestoreData;
            // termsAccepted が boolean ならその値、そうでなければ false (未同意扱い)
            const accepted =
              typeof userData.termsAccepted === 'boolean' ? userData.termsAccepted : false;
            resolve({ isAuthenticated: true, termsAccepted: accepted });
          } else {
            // Firestoreにデータがない = 新規ユーザーまたは異常系？ -> 未同意扱い
            console.warn(`Firestore document not found for user ${user.uid} in guest loader.`);
            resolve({ isAuthenticated: true, termsAccepted: false });
          }
        } catch (error) {
          console.error('Error fetching Firestore data in guest loader:', error);
          // エラー時は規約状態不明として null を返す
          resolve({ isAuthenticated: true, termsAccepted: null });
        }
      } else {
        // 未認証
        resolve({ isAuthenticated: false, termsAccepted: null });
      }
    });
  });
};

// --- Loader Function ---
// ゲスト向けページ（ログイン、パスワードリセット等）用のloader
export const guestLoader = async () => {
  console.log('Running guestLoader...');
  const { isAuthenticated, termsAccepted } = await checkAuthStatusForGuest();
  console.log(`guestLoader - isAuthenticated: ${isAuthenticated}, termsAccepted: ${termsAccepted}`);

  if (isAuthenticated) {
    // 認証済みの場合
    if (termsAccepted === false) {
      // 規約未同意なら規約ページへリダイレクト
      console.log('guestLoader: Authenticated but terms not accepted. Redirecting to /terms');
      return redirect('/terms');
    } else if (termsAccepted === true) {
      // 規約同意済みならデフォルトパス（ダッシュボードなど）へリダイレクト
      console.log(
        `guestLoader: Authenticated and terms accepted. Redirecting to ${APP_DEFAULT_PATH}`
      );
      return redirect(APP_DEFAULT_PATH);
    }
    // termsAccepted が null (エラーなど) の場合、安全のためログインページに留まるか、
    // エラーページに飛ばす、またはデフォルトパスへ飛ばすなどポリシーを決める
    console.warn(
      'guestLoader: Authenticated but terms status is null. Staying on guest page or redirecting to default.'
    );
    // return redirect(APP_DEFAULT_PATH); // 例: エラーでもとりあえずダッシュボードへ
    return null; // null を返して現在のゲストページ表示を維持する方が安全かも
  }
  // 未認証の場合は null を返し、ページコンポーネントを描画させる
  console.log('guestLoader: Not authenticated. Allowing access to guest page.');
  return null;
};
