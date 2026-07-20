import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { PostError } from '@/types/xAccounts';
import { gasProxyPost } from '@/utils/gasProxyClient';
import type { RootState } from '../index';

interface XErrorsState {
  xErrorsList: PostError[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}

const initialState: XErrorsState = {
  xErrorsList: [],
  isLoading: false,
  isError: false,
  errorMessage: '',
};

/**
 * エラーデータを取得する
 */
export const fetchXErrors = createAsyncThunk<
  PostError[],
  void,
  { state: RootState; rejectValue: string }
>('xErrors/fetch', async (_, thunkApi) => {
  try {
    const state = thunkApi.getState();
    const apiUrl = state.auth.user.googleSheetUrl;

    if (!apiUrl) {
      return thunkApi.rejectWithValue('GoogleシートURLが設定されていません。');
    }

    const response = await gasProxyPost(
      {},
      {
        action: 'fetch',
        target: 'errorData',
      }
    );

    // APIからのレスポンス構造に基づいて適切にデータを処理
    if (response.data.status === 'success') {
      // APIレスポンスの型を定義 (必要に応じてより厳密に)
      // type ApiErrorResponse = {
      //   Timestamp: string;
      //   Context: string;
      //   'Error Message': string;
      //   'Stack Trace': string;
      // };

      const rawData: PostError[] = response.data.data;

      // PostError型にマッピング
      const formattedData: PostError[] = rawData.map((item) => ({
        timestamp: item.timestamp,
        context: item.context,
        message: item.message,
        stack: item.stack,
        postContent: item.postContent,
      }));
      return formattedData;
    }

    return thunkApi.rejectWithValue(response.data.message || 'エラーデータの取得に失敗しました。');
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      'エラーデータの取得中に問題が発生しました。';
    return thunkApi.rejectWithValue(errorMsg);
  }
});

// ...existing code...

const xErrorsSlice = createSlice({
  name: 'xErrors',
  initialState,
  reducers: {
    resetXErrorsState: (state) => {
      state.xErrorsList = [];
      state.isLoading = false;
      state.isError = false;
      state.errorMessage = '';
    },
    resetXErrorsError: (state) => {
      state.isError = false;
      state.errorMessage = '';
    },
  },
  extraReducers: (builder) => {
    // Fetch Errors Data
    builder.addCase(fetchXErrors.pending, (state) => {
      state.isLoading = true;
      state.isError = false;
      state.errorMessage = '';
    });
    builder.addCase(fetchXErrors.fulfilled, (state, action) => {
      state.isLoading = false;
      state.xErrorsList = action.payload;
    });
    builder.addCase(fetchXErrors.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.errorMessage = action.payload || 'エラーデータの取得に失敗しました';
    });
  },
});

export const { resetXErrorsState, resetXErrorsError } = xErrorsSlice.actions;
export const selectXErrors = (state: RootState) => state.xErrors;
export default xErrorsSlice.reducer;
