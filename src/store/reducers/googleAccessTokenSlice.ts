import { RootState } from '..'; // あなたのRootStateをインポート
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';

// Stateの型を修正: accessTokenを文字列で保持
export interface GoogleAccessTokenState {
  googleAccessToken: string | null;
  isAuthLoading: boolean;
  error: string | null;
}

const initialState: GoogleAccessTokenState = {
  googleAccessToken: null,
  isAuthLoading: false,
  error: null,
};

// 成功時の型定義 (必要に応じて調整)
interface LinkTokenResult {
  accessToken: string;
}

// エラー時の型定義 (より詳細にする場合)
interface LinkTokenError {
  message: string;
  code?: string; // エラーコードを含めると便利
}

export const linkAndGetGoogleToken = createAsyncThunk<
  LinkTokenResult,
  void,
  { rejectValue: LinkTokenError; state: RootState } // rejectValue の型を更新
>(
  'googleAccessToken/linkAndGetToken', // アクション名を変更
  async (_, { rejectWithValue }) => {
    // thunkApi を展開
    // const state = getState();
    // state.auth.user からではなく、直接 auth.currentUser を使うのが確実
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // ユーザーがログインしていない場合は、まずログインを促す
      return rejectWithValue({
        message: 'ユーザーがログインしていません。ログインしてから再度お試しください。',
      });
    }

    const provider = new GoogleAuthProvider();
    // ★★★ Drive スコープは必須 ★★★
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    // 必要に応じて他のスコープも追加できます
    // provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    // provider.addScope('https://www.googleapis.com/auth/userinfo.email');

    let isLinked = false; // isLinkedをtryブロックの外で宣言
    try {
      isLinked = currentUser.providerData.some(
        (pd) => pd.providerId === GoogleAuthProvider.PROVIDER_ID
      );

      let credentialResult: UserCredential | null = null;
      credentialResult = isLinked
        ? await signInWithPopup(auth, provider)
        : await linkWithPopup(currentUser, provider);

      // 3. 成功した場合、アクセストークンを取得
      if (credentialResult) {
        // credentialFromResult はどちらのメソッドの結果にも使える
        const credential = GoogleAuthProvider.credentialFromResult(credentialResult);
        if (credential?.accessToken) {
          const accessToken = credential.accessToken;
          console.log('Successfully obtained/refreshed Google Access Token.');
          return { accessToken }; // 成功: トークンを返す
        }
      }

      // ここに来る場合は、認証は成功したがトークンが取得できなかったケース (通常は稀)
      console.error('Authentication successful, but failed to get access token from credential.');
      return rejectWithValue({
        message: 'Googleのアクセストークンを取得できませんでした。再度お試しください。',
      });
    } catch (error: any) {
      console.error('Google Link/Auth Error in Thunk:', error);

      // 4. エラーハンドリング
      let errorMessage = `Google連携/認証エラー: ${error.message || error.code || '不明なエラー'}`;
      const errorCode = error.code;

      switch (errorCode) {
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
          errorMessage =
            'Google認証ポップアップがユーザーによって閉じられました。操作を続けるには再度お試しください。';
          break;
        case 'auth/account-exists-with-different-credential':
          // 主に signInWithPopup で、ユーザーが選択したGoogleアカウントのメールアドレスが、
          // 既にFirebaseに別の認証方法（例: メール/パスワード）で登録されている場合に発生。
          // (Firebaseコンソールの「1メールアドレスにつき1アカウント」設定が有効な場合)
          errorMessage =
            'このメールアドレスは、既に別の認証方法（例: メールアドレスとパスワード）で登録されています。該当の方法でログイン後、アカウント設定ページからGoogleアカウントの連携を行ってください。';
          break;
        case 'auth/credential-already-in-use':
          // linkWithPopup で、リンクしようとしたGoogleアカウントが「別のFirebaseアカウント」に既にリンクされている場合。
          // または signInWithPopup で、(既にリンク済みのはずの)ユーザーが選択したGoogleアカウントが「別のFirebaseアカウント」に紐づいていると判断された場合。
          if (isLinked) {
            // signInWithPopup (reauth) context
            errorMessage =
              '選択されたGoogleアカウントは、他のアカウントに既に使用されています。別のアカウントでログインするか、異なるGoogleアカウントを選択してください。';
          } else {
            // linkWithPopup context
            errorMessage =
              'このGoogleアカウントは既に別のアカウントで使用されています。他のGoogleアカウントを選択するか、そのアカウントでログインしてください。';
          }
          break;
        case 'auth/email-already-in-use':
          // 通常、これは新規登録時やメールアドレス変更時に発生。Google連携の文脈では稀。
          errorMessage = 'このメールアドレスは既に使用されています。';
          break;
        case 'auth/requires-recent-login':
          errorMessage =
            'セキュリティ上の理由から、再ログインが必要です。一度ログアウトしてから再度ログインし、操作をお試しください。';
          break;
        case 'auth/network-request-failed':
          errorMessage =
            'ネットワークエラーが発生しました。インターネット接続を確認して再度お試しください。';
          break;
        case 'auth/user-disabled':
          errorMessage =
            'このユーザーアカウントは無効化されています。管理者にお問い合わせください。';
          break;
        // 他の Firebase Authentication のエラーコードに応じて詳細化可能
        default:
          errorMessage = `Google連携/認証中に予期せぬエラーが発生しました。(コード: ${errorCode || 'N/A'})`;
      }
      return rejectWithValue({ message: errorMessage, code: errorCode });
    }
  }
);

// --- Slice の修正 ---
const googleAccessTokenSlice = createSlice({
  name: 'googleAccessToken', // Slice名を修正
  initialState,
  reducers: {
    // ★ 明示的にトークンをクリアするReducerを追加 (任意) ★
    clearGoogleAccessToken: (state) => {
      state.googleAccessToken = null;
      // state.googleAccessTokenExpiry = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(linkAndGetGoogleToken.pending, (state) => {
        state.isAuthLoading = true;
        state.error = null; // 開始時にエラーをクリア
      })
      .addCase(linkAndGetGoogleToken.fulfilled, (state, action: PayloadAction<LinkTokenResult>) => {
        state.isAuthLoading = false;
        state.googleAccessToken = action.payload.accessToken; // ★ accessToken を保存
        state.error = null;
        // オプション: 有効期限を設定 (固定値で設定する例 - 実際はより正確な値が必要)
        // const buffer = 60 * 1000;
        // state.googleAccessTokenExpiry = Date.now() + (3600 * 1000) - buffer; // 約1時間後 - バッファ
      })
      .addCase(linkAndGetGoogleToken.rejected, (state, action) => {
        state.isAuthLoading = false;
        state.googleAccessToken = null; // ★ エラー時はクリア
        // state.googleAccessTokenExpiry = null;
        state.error = action.payload?.message ?? '不明なエラーが発生しました';
      });
  },
});

// --- エクスポート ---
// 他のスライスと区別するため、アクション名を変更推奨
export const { clearGoogleAccessToken } = googleAccessTokenSlice.actions; // clear アクションを追加

// Async Thunk をそのままエクスポート
// (別ファイルで定義している場合はそちらからインポート)
// export { linkAndGetGoogleToken };

export default googleAccessTokenSlice.reducer;
