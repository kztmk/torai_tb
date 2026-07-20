import { FirebaseError } from 'firebase/app'; // FirebaseErrorの型をインポートするとより安全です
import i18n from '@/i18n';

/**
 * Firebase Authenticationのエラーコードに基づいて、
 * ユーザーフレンドリーな日本語のエラーメッセージを返します。
 *
 * @param error - Firebase Authenticationからスローされたエラーオブジェクト
 * @returns 日本語のエラーメッセージ文字列
 */
const translateFirebaseAuthError = (error: unknown): string => {
  // FirebaseErrorインスタンスかどうかをチェック
  if (error instanceof FirebaseError) {
    const errorCode = error.code;
    console.error('Firebase Auth Error Code:', errorCode, 'Message:', error.message); // デバッグ用に元のエラー情報をログ出力

    switch (errorCode) {
      // signInWithEmailAndPassword でよく発生するエラー
      case 'auth/invalid-email':
        return i18n.t('auth.firebaseErrors.invalidEmail');
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': // v9以降、user-not-foundやwrong-passwordの代わりにこれが返ることが多い
        return i18n.t('auth.firebaseErrors.invalidCredential');
      case 'auth/user-disabled':
        return i18n.t('auth.firebaseErrors.userDisabled');
      case 'auth/too-many-requests':
        return i18n.t('auth.firebaseErrors.tooManyRequests');
      case 'auth/network-request-failed':
        return i18n.t('auth.firebaseErrors.network');
      case 'auth/popup-blocked':
        return i18n.t('auth.firebaseErrors.popupBlocked');
      case 'auth/popup-closed-by-user':
        return i18n.t('auth.firebaseErrors.popupClosed');
      case 'auth/cancelled-popup-request':
        return i18n.t('auth.firebaseErrors.popupCanceled');

      // createUserWithEmailAndPassword でよく発生するエラー (参考)
      case 'auth/email-already-in-use':
        return i18n.t('auth.firebaseErrors.emailInUse');
      case 'auth/weak-password':
        return i18n.t('auth.firebaseErrors.weakPassword');

      // その他の一般的なエラー
      case 'auth/requires-recent-login':
        return i18n.t('auth.firebaseErrors.recentLogin');
      case 'auth/operation-not-allowed':
        return i18n.t('auth.firebaseErrors.operationNotAllowed'); // Firebaseコンソールで設定が無効の場合

      // 他にハンドリングしたいエラーコードがあればここに追加

      default:
        // どのコードにも一致しない場合
        return i18n.t('auth.firebaseErrors.unexpectedAuth');
      // デバッグ中は errorCode を含めると原因究明に役立ちます
      // return `不明なエラーが発生しました。(コード: ${errorCode})`;
    }
  } else {
    // FirebaseError以外の予期せぬエラーの場合
    console.error('An unexpected error occurred:', error);
    return i18n.t('auth.firebaseErrors.unexpected');
  }
};

export { translateFirebaseAuthError };

// --- 関数の使用例 ---
/*
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './your-firebase-config-file'; // あなたのFirebase設定ファイルをインポート
import translateFirebaseAuthError from './translateFirebaseAuthError';
import { notifications } from '@mantine/notifications'; // MantineのNotificationsを使用する場合

const handleLogin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('ログイン成功:', userCredential.user);
    // ログイン成功後の処理（例: ダッシュボードへリダイレクト）
    notifications.show({
        title: 'ログイン成功',
        message: 'ようこそ！',
        color: 'green',
    });

  } catch (error) {
    // translateFirebaseAuthError 関数を使ってエラーメッセージを日本語化
    const friendlyErrorMessage = translateFirebaseAuthError(error);

    console.error('ログインエラー:', friendlyErrorMessage);

    // 日本語化されたメッセージをユーザーに表示 (Mantineの例)
    notifications.show({
      title: 'ログインエラー',
      message: friendlyErrorMessage,
      color: 'red',
    });
  }
};

// ログインフォームの送信時などに handleLogin を呼び出す
// handleLogin('test@example.com', 'wrongpassword');
*/

/*
 * Cloud functionから返されるTimestamp型はJSONのためシリアライズされている
 * Timestamp型に再構築する関数
 */
export interface TimestampRaw {
  _seconds: number;
  _nanoseconds: number;
}

export function isTimestampRaw(value: any): value is TimestampRaw {
  return (
    typeof value === 'object' && // まずオブジェクトであるか
    value !== null && // nullではないか
    typeof value._seconds === 'number' && // _seconds プロパティがあり、かつ number 型か
    typeof value._nanoseconds === 'number' // _nanoseconds プロパティがあり、かつ number 型か
  );
}
