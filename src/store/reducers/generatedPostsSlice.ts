import { RootState } from '..'; // storeのパスに合わせて調整
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { fetchGeneratedPostsAPI } from '@/utils/AI/postApi'; // 先ほど作成したAPI関数
import { normalizeGeminiApiKey } from '@/utils/geminiApiKey';

// ポストデータの型定義
export interface PostData {
  id: string;
  text: string;
  adopted: boolean;
}

// Sliceの状態の型定義
interface GeneratedPostsState {
  posts: PostData[];
  loading: 'idle' | 'pending' | 'succeeded' | 'failed';
  error: string | null;
  currentKeyword: string | null; // 最後に生成を試みたキーワード
}

// 初期状態
const initialState: GeneratedPostsState = {
  posts: [],
  loading: 'idle',
  error: null,
  currentKeyword: null,
};

// --- 非同期Thunk: Gemini APIを呼び出してポストを生成 ---
export const generatePostsThunk = createAsyncThunk<
  PostData[], // fulfilled時の返り値の型
  string, // Thunkに渡す引数(keyword)の型
  { rejectValue: string } // rejected時のpayloadの型
>(
  'generatedPosts/fetchPosts', // アクションタイプ名
  async (keyword, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const apiKey = normalizeGeminiApiKey(state.auth.user?.geminiApiKey ?? '');
    if (!apiKey) {
      return rejectWithValue('Gemini APIキーが設定されていません。');
    }

    if (!keyword || keyword.trim() === '') {
      return rejectWithValue('キーワードが入力されていません。');
    }
    try {
      const posts = await fetchGeneratedPostsAPI(apiKey, keyword); // API呼び出し
      return posts; // 成功時はポスト配列を返す -> fulfilledのpayloadへ
    } catch (error) {
      let errorMessage = 'ポスト生成中にエラーが発生しました。';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      // エラーメッセージを返す -> rejectedのpayloadへ
      return rejectWithValue(errorMessage);
    }
  }
);

// --- Slice定義 ---
export const generatedPostsSlice = createSlice({
  name: 'generatedPosts',
  initialState,
  // 同期アクション (UIからの直接的な状態変更)
  reducers: {
    updatePostText: (state, action: PayloadAction<{ id: string; newText: string }>) => {
      const post = state.posts.find((p) => p.id === action.payload.id);
      if (post) {
        post.text = action.payload.newText;
      }
    },
    setPostAdoption: (state, action: PayloadAction<{ id: string; adopted: boolean }>) => {
      const post = state.posts.find((p) => p.id === action.payload.id);
      if (post) {
        post.adopted = action.payload.adopted;
      }
    },
    // エラーメッセージを手動でクリアするアクション
    clearError: (state) => {
      state.error = null;
    },
    // ポストリストや状態をリセットするアクション
    resetPostsState: (state) => {
      state.posts = [];
      state.loading = 'idle';
      state.error = null;
      state.currentKeyword = null;
    },
  },
  // 非同期アクション(Thunk)の結果に対する状態変更
  extraReducers: (builder) => {
    builder
      .addCase(generatePostsThunk.pending, (state, action) => {
        state.loading = 'pending';
        state.error = null; // 新しいリクエスト開始時にエラーをクリア
        state.posts = []; // リクエスト開始時に既存のポストをクリア
        state.currentKeyword = action.meta.arg; // 実行中のキーワードを保持
      })
      .addCase(generatePostsThunk.fulfilled, (state, action: PayloadAction<PostData[]>) => {
        state.loading = 'succeeded';
        state.posts = action.payload; // 取得したポストで状態を更新
      })
      .addCase(generatePostsThunk.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload ?? '不明なエラーが発生しました。'; // rejectWithValueの値 or デフォルトメッセージ
        state.posts = []; // エラー時はポストを空にする
      });
  },
});

// --- Action Creatorsのエクスポート ---
export const { updatePostText, setPostAdoption, clearError, resetPostsState } =
  generatedPostsSlice.actions;

// --- Selectorsのエクスポート (コンポーネントで状態を購読するため) ---
export const selectAllPosts = (state: RootState) => state.generatedPosts.posts;
export const selectPostsLoadingStatus = (state: RootState) => state.generatedPosts.loading;
export const selectPostsError = (state: RootState) => state.generatedPosts.error;
export const selectCurrentKeyword = (state: RootState) => state.generatedPosts.currentKeyword;
export const selectAdoptedPosts = (state: RootState) =>
  state.generatedPosts.posts.filter((p) => p.adopted);
export const selectAdoptedPostCount = (state: RootState) => selectAdoptedPosts(state).length; // 派生セレクター

// --- Reducerのエクスポート (Storeで登録するため) ---
export default generatedPostsSlice.reducer;
