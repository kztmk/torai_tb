/**
 * firebase Realtime databaseに対してCRUDを行うためのslice
 * Xアカウント（旧Twitter API用アカウント）の管理機能
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { gasProxyPost } from '@/utils/gasProxyClient';
import type { XAccount, XAccountListFetchStatus } from '../../types/xAccounts';
import type { RootState } from '../index';

/**
 * Xアカウントリストの初期値
 */
const initialXAccountList: XAccount[] = [];

/**
 * 単一Xアカウントの初期値
 */
const initialXAccount: XAccount = {
  id: '',
  name: '',
  apiKey: '',
  apiSecret: '',
  accessToken: '',
  accessTokenSecret: '',
  note: '',
};

/**
 * XAccountのステート初期値
 * process: 処理状態を表す文字列
 * isLoading: データ取得中かどうか
 * isError: エラーが発生したかどうか
 * errorMessage: エラーメッセージ
 */
const initialState: XAccountListFetchStatus = {
  xAccountList: initialXAccountList,
  xAccount: initialXAccount,
  process: 'idle',
  isLoading: false,
  isError: false,
  errorMessage: '',
};

/**
 * XAccountsのReduxスライス
 * REST APIとのCRUD操作を管理
 */
const xAccountsSlice = createSlice({
  name: 'xAccounts',
  initialState,
  reducers: {
    // プロセス状態をリセットする同期アクション
    resetProcess: (state) => {
      state.process = 'idle';
    },
    // シートURL変更時など、保持中のXアカウントデータを完全にクリアする
    resetXAccountsState: (state) => {
      state.xAccountList = initialXAccountList;
      state.xAccount = initialXAccount;
      state.process = 'idle';
      state.isLoading = false;
      state.isError = false;
      state.errorMessage = '';
    },
  },
  extraReducers: (builder) => {
    // データ取得処理のライフサイクル
    builder.addCase(fetchXAccounts.pending, (state) => {
      state.process = 'idle';
      state.isLoading = true;
      state.isError = false;
      state.errorMessage = '';
    });
    builder.addCase(fetchXAccounts.fulfilled, (state, action) => {
      state.xAccountList = action.payload;
      state.isLoading = false;
      state.process = 'fetch';
    });
    builder.addCase(fetchXAccounts.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'fetch';
      state.errorMessage =
        action.payload === undefined ? 'Failed to fetch xAccounts' : action.payload.message;
    });
    // create data
    builder.addCase(createXAccount.pending, (state) => {
      state.isLoading = true;
      state.isError = false;
      state.process = 'idle';
      state.errorMessage = '';
    });
    builder.addCase(createXAccount.fulfilled, (state, action) => {
      state.xAccount = action.payload;
      state.xAccountList.push(action.payload);
      state.isLoading = false;
      state.process = 'addNew';
    });
    builder.addCase(createXAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'addNew';
      state.errorMessage =
        action.payload === undefined ? 'Failed to create xAccount' : action.payload.message;
    });
    // update data
    builder.addCase(updateXAccount.pending, (state) => {
      state.isLoading = true;
      state.isError = false;
      state.process = 'idle';
      state.errorMessage = '';
    });
    builder.addCase(updateXAccount.fulfilled, (state, action) => {
      state.xAccount = action.payload;
      const index = state.xAccountList.findIndex((xAccount) => xAccount.id === action.payload.id);
      if (index >= 0) {
        state.xAccountList[index] = action.payload;
      }
      state.isLoading = false;
      state.process = 'update';
    });
    builder.addCase(updateXAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'update';
      state.errorMessage =
        action.payload === undefined ? 'Failed to update xAccount' : action.payload.message;
    });
    // delete data
    builder.addCase(deleteXAccount.pending, (state) => {
      state.isLoading = true;
      state.isError = false;
      state.errorMessage = '';
      state.process = 'idle';
    });
    builder.addCase(deleteXAccount.fulfilled, (state, action) => {
      state.isLoading = false;
      if (action.payload === 'all') {
        state.xAccountList = [];
      } else {
        const index = state.xAccountList.findIndex((xAccount) => xAccount.id === action.payload);
        state.xAccountList.splice(index, 1);
      }
      state.process = 'delete';
    });
    builder.addCase(deleteXAccount.rejected, (state, action) => {
      state.isLoading = false;
      state.isError = true;
      state.process = 'delete';
      state.errorMessage =
        action.payload === undefined ? 'Failed to delete xAccount' : action.payload.message;
    });
  },
});

/**
 * XアカウントのリストをREST APIから取得する非同期アクション
 *
 * @returns {Promise<XAccount[]>} 取得したXアカウントの配列
 */
export const fetchXAccounts = createAsyncThunk<
  XAccount[],
  void,
  {
    rejectValue: { message: string };
    state: RootState;
  }
>('xAccounts/fetchXAccounts', async (_, thunkApi) => {
  try {
    // REST APIのURLを取得
    const { googleSheetUrl } = thunkApi.getState().auth.user;

    if (!googleSheetUrl) {
      return thunkApi.rejectWithValue({ message: 'Google Sheet URL is not set in user profile' });
    }

    // GASを直接GETするとCORSに引っかかるため、Firebase Functions proxy経由で取得する
    const response = await gasProxyPost(
      {},
      {
        action: 'fetch',
        target: 'xauth',
      }
    );

    // レスポンスの検証
    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Failed to fetch X accounts');
    }

    // APIレスポンスからXアカウントリストを取得
    const xAccountList = response.data.data || [];

    // データ構造をアプリケーションで使用する形式に変換
    return xAccountList.map((account: any) => ({
      id: account.accountId,
      name: `@${account.accountId}`, // nameがない場合はaccountIdを使用
      apiKey: account.apiKey || '',
      apiSecret: account.apiKeySecret || '',
      accessToken: account.accessToken || '',
      accessTokenSecret: account.accessTokenSecret || '',
      note: account.note || '',
    }));
  } catch (error: any) {
    console.error('Failed to fetch X accounts:', error);
    return thunkApi.rejectWithValue({
      message: error.response?.data?.message || error.message || 'Failed to fetch X accounts',
    });
  }
});

/**
 * 新しいXアカウントをREST APIに作成する非同期アクション
 *
 * @param {XAccount} xAccount - 作成するXアカウント情報
 * @returns {Promise<XAccount>} 作成されたXアカウント情報（IDを含む）
 */
export const createXAccount = createAsyncThunk<
  XAccount,
  XAccount,
  {
    rejectValue: { message: string };
    state: RootState;
  }
>('xAccounts/createXAccount', async (xAccount, thunkAPI) => {
  try {
    // REST APIのURLを取得
    const { googleSheetUrl } = thunkAPI.getState().auth.user;

    if (!googleSheetUrl) {
      return thunkAPI.rejectWithValue({ message: 'Google Sheet URL is not set in user profile' });
    }

    // APIリクエスト用にデータ構造を変換
    const requestData = {
      accountId: xAccount.name.startsWith('@') ? xAccount.name.slice(1) : xAccount.name, // nameフィールドをaccountIdとして使用。@が先頭にある場合は削除
      apiKey: xAccount.apiKey,
      apiKeySecret: xAccount.apiSecret,
      accessToken: xAccount.accessToken,
      accessTokenSecret: xAccount.accessTokenSecret,
      note: xAccount.note,
    };

    // POSTリクエストでデータを作成 (action=create, target=xauth)
    const response = await gasProxyPost(requestData, {
      action: 'create',
      target: 'xauth',
    });

    // レスポンスの検証
    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Failed to create X account');
    }

    // 返却されたデータまたは元のデータからXアカウント情報を構築
    const createdAccount: XAccount = {
      id: response.data.data.accountId,
      name: `@${response.data.data.accountId}`,
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessTokenSecret: '',
      note: xAccount.note || '',
    };

    return createdAccount;
  } catch (error: any) {
    console.error('Failed to create X account:', error);
    return thunkAPI.rejectWithValue({
      message: error.response?.data?.message || error.message || 'Failed to create X account',
    });
  }
});

/**
 * 既存のXアカウント情報をREST APIで更新する非同期アクション
 *
 * @param {XAccount} xAccount - 更新するXアカウント情報（IDを含む）
 * @returns {Promise<XAccount>} 更新されたXアカウント情報
 */
export const updateXAccount = createAsyncThunk<
  XAccount,
  XAccount,
  {
    rejectValue: { message: string };
    state: RootState;
  }
>('xAccounts/updateXAccount', async (xAccount, thunkAPI) => {
  try {
    // REST APIのURLを取得
    const { googleSheetUrl } = thunkAPI.getState().auth.user;

    if (!googleSheetUrl) {
      return thunkAPI.rejectWithValue({ message: 'Google Sheet URL is not set in user profile' });
    }

    const shouldResetCredentials =
      xAccount.apiKey && xAccount.apiSecret && xAccount.accessToken && xAccount.accessTokenSecret;

    // APIリクエスト用にデータ構造を変換
    const requestData = {
      accountId:
        xAccount.id || (xAccount.name.startsWith('@') ? xAccount.name.slice(1) : xAccount.name),
      note: xAccount.note,
      ...(shouldResetCredentials
        ? {
            apiKey: xAccount.apiKey,
            apiKeySecret: xAccount.apiSecret,
            accessToken: xAccount.accessToken,
            accessTokenSecret: xAccount.accessTokenSecret,
          }
        : {}),
    };

    // POSTリクエストでデータを更新 (action=update, target=xauth)
    const response = await gasProxyPost(requestData, {
      action: 'update',
      target: 'xauth',
    });

    // レスポンスの検証
    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Failed to update X account');
    }

    // GASは保存済み認証情報を返さないため、画面状態にも保持しない
    return {
      ...xAccount,
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessTokenSecret: '',
    };
  } catch (error: any) {
    console.error('Failed to update X account:', error);
    return thunkAPI.rejectWithValue({
      message: error.response?.data?.message || error.message || 'Failed to update X account',
    });
  }
});

/**
 * Xアカウントを削除する非同期アクション
 *
 * @param {string} xAccountId - 削除するXアカウントのID
 * @returns {Promise<string>} 削除したXアカウントのID
 */
export const deleteXAccount = createAsyncThunk<
  string,
  string,
  {
    rejectValue: { message: string };
    state: RootState;
  }
>('xAccounts/deleteXAccount', async (xAccountId, thunkAPI) => {
  try {
    // REST APIのURLを取得
    const { googleSheetUrl } = thunkAPI.getState().auth.user;

    if (!googleSheetUrl) {
      return thunkAPI.rejectWithValue({ message: 'Google Sheet URL is not set in user profile' });
    }

    // 削除リクエスト用のデータ構造
    const requestData = {
      accountId: xAccountId,
    };

    // POSTリクエストでデータを削除 (action=delete, target=xauth)
    const response = await gasProxyPost(requestData, {
      action: 'delete',
      target: 'xauth',
    });

    // レスポンスの検証
    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Failed to delete X account');
    }

    // 削除成功後、IDを返す
    return xAccountId;
  } catch (error: any) {
    console.error('Failed to delete X account:', error);
    return thunkAPI.rejectWithValue({
      message: error.response?.data?.message || error.message || 'Failed to delete X account',
    });
  }
});

export const selectXAccounts = (state: RootState) => state.xAccounts;

export const { resetProcess, resetXAccountsState } = xAccountsSlice.actions;

export default xAccountsSlice.reducer;
