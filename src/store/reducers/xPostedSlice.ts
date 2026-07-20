import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { XPostedDataType } from '@/types/xAccounts';
import { gasProxyPost } from '@/utils/gasProxyClient';
import type { RootState } from '../index';

interface XPostedState {
  xPostedList: XPostedDataType[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}

const initialState: XPostedState = {
  xPostedList: [],
  isLoading: false,
  isError: false,
  errorMessage: '',
};

/**
 * X投稿済みデータを取得する
 */
export const fetchXPosted = createAsyncThunk<
  XPostedDataType[],
  void,
  { state: RootState; rejectValue: string }
>('xPosted/fetch', async (_, thunkApi) => {
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
        target: 'postedData',
      }
    );

    // APIからのレスポンス構造に基づいて適切にデータを処理
    if (response.data.status === 'success') {
      return response.data.data;
    }

    return thunkApi.rejectWithValue(
      response.data.message || '投稿済みデータの取得に失敗しました。'
    );
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      '投稿済みデータの取得中にエラーが発生しました。';
    return thunkApi.rejectWithValue(errorMsg);
  }
});

const xPostedSlice = createSlice({
  name: 'xPosted',
  initialState,
  reducers: {
    resetXPostedState: (state) => {
      state.xPostedList = [];
      state.isLoading = false;
      state.isError = false;
      state.errorMessage = '';
    },
    resetXPostedError: (state) => {
      state.isError = false;
      state.errorMessage = '';
    },
  },
  extraReducers: (builder) => {
    // Fetch Posted Data
    builder.addCase(fetchXPosted.pending, (state) => {
      state.isLoading = true;
      state.isError = false;
      state.errorMessage = '';
    });
    builder.addCase(fetchXPosted.fulfilled, (state, action) => {
      state.isLoading = false;
      state.xPostedList = action.payload;
    });
    builder.addCase(fetchXPosted.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.errorMessage = action.payload || '投稿済みデータの取得に失敗しました';
    });
  },
});

export const { resetXPostedState, resetXPostedError } = xPostedSlice.actions;
export const selectXPosted = (state: RootState) => state.xPosted;
export default xPostedSlice.reducer;
