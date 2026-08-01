/**
 * Bluesky / Threads アカウント（PlatformAccount）の CRUD スライス（Phase 9）。
 * GAS の blueskyAuth / threadsAuth ターゲットへ Firebase Functions proxy 経由でアクセスする。
 * 応答は { status:'success', data } 形式（旧 xauth 系と同じ）。
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import i18n from '@/i18n';
import { gasProxyPost } from '@/utils/gasProxyClient';
import type {
  BlueskyAccountView,
  BlueskyCreateInput,
  BlueskyUpdateInput,
  ThreadsAccountView,
  ThreadsAuthorizeUrlResult,
  ThreadsCreateInput,
  ThreadsUpdateInput,
} from '../../types/accounts';
import type { RootState } from '../index';

export type AccountsProcess =
  | 'idle'
  | 'fetch'
  | 'create'
  | 'update'
  | 'delete'
  | 'authorize';

export interface AccountsState {
  bluesky: BlueskyAccountView[];
  threads: ThreadsAccountView[];
  /** 直近で取得した Threads 認可 URL（モーダル表示用） */
  authorize: ThreadsAuthorizeUrlResult | null;
  process: AccountsProcess;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}

const initialState: AccountsState = {
  bluesky: [],
  threads: [],
  authorize: null,
  process: 'idle',
  isLoading: false,
  isError: false,
  errorMessage: '',
};

type RejectValue = { message: string };
type ThunkConfig = { rejectValue: RejectValue; state: RootState };

/** proxy 応答の共通検証。success 以外は例外を投げる */
const unwrap = (data: any, fallback: string) => {
  if (data?.status !== 'success') {
    throw new Error(data?.message || fallback);
  }
  return data.data;
};

const toMessage = (error: any, fallback: string): string =>
  error?.response?.data?.message || error?.message || fallback;

// ---- Fetch（Bluesky / Threads を並列取得）----
export const fetchAccounts = createAsyncThunk<
  { bluesky: BlueskyAccountView[]; threads: ThreadsAccountView[] },
  void,
  ThunkConfig
>('accounts/fetchAccounts', async (_, thunkApi) => {
  try {
    const { googleSheetUrl } = thunkApi.getState().auth.user;
    if (!googleSheetUrl) {
      return thunkApi.rejectWithValue({ message: 'GAS URL is not set in user profile' });
    }

    const [blueskyRes, threadsRes] = await Promise.all([
      gasProxyPost({}, { action: 'fetch', target: 'blueskyAuth' }),
      gasProxyPost({}, { action: 'fetch', target: 'threadsAuth' }),
    ]);

    const bluesky = (unwrap(blueskyRes.data, 'Failed to fetch Bluesky accounts') ||
      []) as BlueskyAccountView[];
    const threads = (unwrap(threadsRes.data, 'Failed to fetch Threads accounts') ||
      []) as ThreadsAccountView[];

    return { bluesky, threads };
  } catch (error: any) {
    return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to fetch accounts') });
  }
});

// ---- Bluesky ----
export const createBlueskyAccount = createAsyncThunk<
  BlueskyAccountView,
  BlueskyCreateInput,
  ThunkConfig
>('accounts/createBluesky', async (input, thunkApi) => {
  try {
    const response = await gasProxyPost(input, { action: 'create', target: 'blueskyAuth' });
    return unwrap(response.data, 'Failed to add Bluesky account') as BlueskyAccountView;
  } catch (error: any) {
    return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to add Bluesky account') });
  }
});

export const updateBlueskyAccount = createAsyncThunk<
  BlueskyAccountView,
  BlueskyUpdateInput,
  ThunkConfig
>('accounts/updateBluesky', async (input, thunkApi) => {
  try {
    const response = await gasProxyPost(input, { action: 'update', target: 'blueskyAuth' });
    return unwrap(response.data, 'Failed to update Bluesky account') as BlueskyAccountView;
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      message: toMessage(error, 'Failed to update Bluesky account'),
    });
  }
});

export const deleteBlueskyAccount = createAsyncThunk<string, string, ThunkConfig>(
  'accounts/deleteBluesky',
  async (accountId, thunkApi) => {
    try {
      const response = await gasProxyPost({ accountId }, { action: 'delete', target: 'blueskyAuth' });
      unwrap(response.data, 'Failed to delete Bluesky account');
      return accountId;
    } catch (error: any) {
      return thunkApi.rejectWithValue({
        message: toMessage(error, 'Failed to delete Bluesky account'),
      });
    }
  }
);

// ---- Threads ----
export const createThreadsAccount = createAsyncThunk<
  ThreadsAccountView,
  ThreadsCreateInput,
  ThunkConfig
>('accounts/createThreads', async (input, thunkApi) => {
  try {
    const response = await gasProxyPost(input, { action: 'create', target: 'threadsAuth' });
    return unwrap(response.data, 'Failed to add Threads account') as ThreadsAccountView;
  } catch (error: any) {
    return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to add Threads account') });
  }
});

export const updateThreadsAccount = createAsyncThunk<
  ThreadsAccountView,
  ThreadsUpdateInput,
  ThunkConfig
>('accounts/updateThreads', async (input, thunkApi) => {
  try {
    const response = await gasProxyPost(input, { action: 'update', target: 'threadsAuth' });
    return unwrap(response.data, 'Failed to update Threads account') as ThreadsAccountView;
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      message: toMessage(error, 'Failed to update Threads account'),
    });
  }
});

export const deleteThreadsAccount = createAsyncThunk<string, string, ThunkConfig>(
  'accounts/deleteThreads',
  async (accountId, thunkApi) => {
    try {
      const response = await gasProxyPost({ accountId }, { action: 'delete', target: 'threadsAuth' });
      unwrap(response.data, 'Failed to delete Threads account');
      return accountId;
    } catch (error: any) {
      return thunkApi.rejectWithValue({
        message: toMessage(error, 'Failed to delete Threads account'),
      });
    }
  }
);

/** Threads 投稿の Web パーマリンクを取得（postId=Media ID から） */
export const getThreadsPermalink = createAsyncThunk<
  string,
  { accountId: string; postId: string },
  ThunkConfig
>('accounts/getThreadsPermalink', async ({ accountId, postId }, thunkApi) => {
  try {
    const response = await gasProxyPost(
      { accountId, postId },
      { action: 'permalink', target: 'threadsAuth' }
    );
    const data = unwrap(response.data, 'Failed to get Threads permalink') as { permalink?: string };
    return String(data?.permalink || '');
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      message: toMessage(error, 'Failed to get Threads permalink'),
    });
  }
});

/** Threads OAuth 認可 URL を取得（ユーザーに開かせて Meta で認可 → GAS コールバックで保存）*/
export const requestThreadsAuthorizeUrl = createAsyncThunk<
  ThreadsAuthorizeUrlResult,
  string,
  ThunkConfig
>('accounts/requestThreadsAuthorizeUrl', async (accountId, thunkApi) => {
  try {
    // 無認証の OAuth コールバック画面を、フロントと同じ言語で表示するため lang を渡す。
    const response = await gasProxyPost(
      { accountId, lang: i18n.language },
      { action: 'authorizeUrl', target: 'threadsAuth' }
    );
    return unwrap(response.data, 'Failed to get Threads authorize URL') as ThreadsAuthorizeUrlResult;
  } catch (error: any) {
    return thunkApi.rejectWithValue({
      message: toMessage(error, 'Failed to get Threads authorize URL'),
    });
  }
});

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    resetProcess: (state) => {
      state.process = 'idle';
      state.isError = false;
      state.errorMessage = '';
    },
    clearAuthorizeUrl: (state) => {
      state.authorize = null;
    },
    resetAccountsState: () => initialState,
  },
  extraReducers: (builder) => {
    const pending = (state: AccountsState) => {
      state.isLoading = true;
      state.isError = false;
      state.errorMessage = '';
      state.process = 'idle';
    };

    // fetch
    builder.addCase(fetchAccounts.pending, pending);
    builder.addCase(fetchAccounts.fulfilled, (state, action) => {
      state.bluesky = action.payload.bluesky;
      state.threads = action.payload.threads;
      state.isLoading = false;
      state.process = 'fetch';
    });
    builder.addCase(fetchAccounts.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'fetch';
      state.errorMessage = action.payload?.message ?? 'Failed to fetch accounts';
    });

    // bluesky create/update
    builder.addCase(createBlueskyAccount.pending, pending);
    builder.addCase(createBlueskyAccount.fulfilled, (state, action) => {
      state.bluesky.push(action.payload);
      state.isLoading = false;
      state.process = 'create';
    });
    builder.addCase(createBlueskyAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'create';
      state.errorMessage = action.payload?.message ?? 'Failed to add Bluesky account';
    });
    builder.addCase(updateBlueskyAccount.pending, pending);
    builder.addCase(updateBlueskyAccount.fulfilled, (state, action) => {
      const i = state.bluesky.findIndex((a) => a.accountId === action.payload.accountId);
      if (i >= 0) state.bluesky[i] = action.payload;
      state.isLoading = false;
      state.process = 'update';
    });
    builder.addCase(updateBlueskyAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'update';
      state.errorMessage = action.payload?.message ?? 'Failed to update Bluesky account';
    });
    builder.addCase(deleteBlueskyAccount.pending, pending);
    builder.addCase(deleteBlueskyAccount.fulfilled, (state, action) => {
      state.bluesky = state.bluesky.filter((a) => a.accountId !== action.payload);
      state.isLoading = false;
      state.process = 'delete';
    });
    builder.addCase(deleteBlueskyAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'delete';
      state.errorMessage = action.payload?.message ?? 'Failed to delete Bluesky account';
    });

    // threads create/update/delete
    builder.addCase(createThreadsAccount.pending, pending);
    builder.addCase(createThreadsAccount.fulfilled, (state, action) => {
      state.threads.push(action.payload);
      state.isLoading = false;
      state.process = 'create';
    });
    builder.addCase(createThreadsAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'create';
      state.errorMessage = action.payload?.message ?? 'Failed to add Threads account';
    });
    builder.addCase(updateThreadsAccount.pending, pending);
    builder.addCase(updateThreadsAccount.fulfilled, (state, action) => {
      const i = state.threads.findIndex((a) => a.accountId === action.payload.accountId);
      if (i >= 0) state.threads[i] = action.payload;
      state.isLoading = false;
      state.process = 'update';
    });
    builder.addCase(updateThreadsAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'update';
      state.errorMessage = action.payload?.message ?? 'Failed to update Threads account';
    });
    builder.addCase(deleteThreadsAccount.pending, pending);
    builder.addCase(deleteThreadsAccount.fulfilled, (state, action) => {
      state.threads = state.threads.filter((a) => a.accountId !== action.payload);
      state.isLoading = false;
      state.process = 'delete';
    });
    builder.addCase(deleteThreadsAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'delete';
      state.errorMessage = action.payload?.message ?? 'Failed to delete Threads account';
    });

    // threads authorize url
    builder.addCase(requestThreadsAuthorizeUrl.pending, pending);
    builder.addCase(requestThreadsAuthorizeUrl.fulfilled, (state, action) => {
      state.authorize = action.payload;
      state.isLoading = false;
      state.process = 'authorize';
    });
    builder.addCase(requestThreadsAuthorizeUrl.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'authorize';
      state.errorMessage = action.payload?.message ?? 'Failed to get Threads authorize URL';
    });
  },
});

export const selectAccounts = (state: RootState) => state.accounts;

export const { resetProcess, clearAuthorizeUrl, resetAccountsState } = accountsSlice.actions;

export default accountsSlice.reducer;
