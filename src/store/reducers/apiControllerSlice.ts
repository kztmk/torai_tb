// createTrigger
// https://script.google.com/macros/s/AKfycbxi3bvcZ5_vCq6Wp2i4zg8C5DDRkZQTJ1x7y1ChWFaXj8t994G6frS5BZ-DAAv5Sbne/exec?functionName=createTrigger&interval=5
// https://script.google.com/macros/s/AKfycbzp2GIS-N8bBn7USjP7By75FNN95oN5fPITvJHHlUAnCA_5UJGCeQfVRhceXzvnO4yyBA/exec?action=create&target=postdata
// https://script.google.com/macros/s/AKfycbzp2GIS-N8bBn7USjP7By75FNN95oN5fPITvJHHlUAnCA_5UJGCeQfVRhceXzvnO4yyBA/exec
// POST Endpoints
// The system provides several POST endpoints accessible via doPost():

// Target	Action	Description
// xauth	create	Create new X API authentication
//        update	Update existing authentication
//        delete	Delete authentication
// postData	create	Create new post
//          update	Update existing post
//          delete	Delete post
// trigger	create	Create time-based trigger
//          delete	Delete all triggers
// media	upload	Upload media file
// archive	-	Archive "Posted" or "Errors" sheets
//
// GET Endpoints
// The system provides several GET endpoints accessible via doGet():

// Target	Action	Description
// xauth	fetch	Fetch all X account IDs
// postData	fetch	Fetch all post data
// postedData	fetch	Fetch all posted data
// errorData	fetch	Fetch all error data
import { RootState } from '..';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { gasProxyPost } from '@/utils/gasProxyClient';

// APIコントローラーの状態の型定義
interface ApiControllerState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  triggerStatus: {
    functionName: string;
    isTriggerConfigured: boolean;
    interval: number;
    version: string;
  };
  uploadedMedia: {
    filename: string;
    fileId: string;
    webViewLink: string;
    webContentLink: string;
  } | null;
  archivedSheet: {
    originalName: string;
    newName: string;
    archiveFileId: string;
    archiveFileUrl: string;
    message: string;
  } | null;
  initialized: boolean;
}

// トリガー作成のためのパラメータ型
interface CreateTriggerParams {
  intervalMinutes: number;
  functionName: string;
}

// // メディアアップロードのためのパラメータ型
// interface UploadMediaParams {
//   file: File;
//   filename: string;
//   mimeType: string;
//   description?: string;
// }

// // 複数メディアアップロードのためのパラメータ型
// interface UploadMultipleMediaParams {
//   files: Array<{
//     file: File;
//     filename: string;
//     mimeType: string;
//   }>;
//   description?: string;
// }

// シートアーカイブのためのパラメータ型
interface ArchiveSheetParams {
  target: 'posted' | 'errors';
  filename: string;
}

// 初期状態
const initialState: ApiControllerState = {
  status: 'idle',
  error: null,
  triggerStatus: {
    functionName: '',
    isTriggerConfigured: false,
    interval: -1,
    version: '',
  },
  uploadedMedia: {
    filename: '',
    fileId: '',
    webViewLink: '',
    webContentLink: '',
  },
  archivedSheet: {
    originalName: '',
    newName: '',
    archiveFileId: '',
    archiveFileUrl: '',
    message: '',
  },
  initialized: false,
};

// トリガー作成のための非同期アクション
export const createTrigger = createAsyncThunk<
  {
    status: string;
    message: string;
    intervalMinutes: number;
    handlerFunction: string;
    triggerId: string;
    deletedExistingCount: number;
  },
  CreateTriggerParams,
  {
    state: RootState;
    rejectValue: string;
  }
>('api/createTrigger', async (params: CreateTriggerParams, { getState, rejectWithValue }) => {
  try {
    const state = getState() as RootState;
    const targetGasUrl = state.auth.user?.googleSheetUrl;

    if (!targetGasUrl) {
      return rejectWithValue('GoogleSheet URL が設定されていません');
    }

    const response = await gasProxyPost(
      {
        intervalMinutes: params.intervalMinutes,
      },
      {
        action: 'create',
        target: 'trigger',
        functionName: params.functionName,
      }
    );

    // レスポンスのステータスをチェック
    if (response.data.status === 'error') {
      return rejectWithValue(response.data.message || 'トリガーの作成に失敗しました');
    }

    return response.data.data.data;
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.message || error.message || 'トリガーの作成中にエラーが発生しました'
    );
  }
});

// トリガー削除のための非同期アクション
export const deleteTrigger = createAsyncThunk<
  {
    status: string;
    message: string;
    deletedCount: number;
  },
  void,
  {
    state: RootState;
    rejectValue: string;
  }
>('api/deleteTrigger', async (_, { getState, rejectWithValue }) => {
  try {
    const state = getState() as RootState;
    const targetGasUrl = state.auth.user?.googleSheetUrl;

    if (!targetGasUrl) {
      return rejectWithValue('GoogleSheet URL が設定されていません');
    }

    const response = await gasProxyPost(
      {},
      {
        action: 'delete',
        target: 'trigger',
      }
    );

    // レスポンスのステータスをチェック
    if (response.data.status === 'error') {
      return rejectWithValue(response.data.message || 'トリガーの削除に失敗しました');
    }

    return response.data.data.data;
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.message || error.message || 'トリガーの削除中にエラーが発生しました'
    );
  }
});

// トリガーステータス取得のための非同期アクション
export const getTriggerStatus = createAsyncThunk<
  {
    status: string;
    functionName: string;
    triggerFound: boolean;
    message: string;
    intervalMinutes: number;
    version: string;
  },
  {
    functionName: string;
  },
  {
    state: RootState;
    rejectValue: string;
  }
>('api/getTriggerStatus', async (args, { getState, rejectWithValue }) => {
  try {
    const state = getState() as RootState;
    const targetGasUrl = state.auth.user?.googleSheetUrl;

    if (!targetGasUrl) {
      return rejectWithValue('GoogleSheet URL が設定されていません');
    }

    const response = await gasProxyPost(
      {},
      {
        action: 'getStatus',
        target: 'trigger',
        functionName: args.functionName,
      }
    );
    // GAS の doPost は常に外側を status:'success' で返し、実際の成否は
    // 内側 (response.data.data) の status に入る。両方をチェックして、
    // 内側のエラー（権限不足など）も取りこぼさずに reject する。
    const triggerResult = response.data?.data;
    if (response.data?.status === 'error' || triggerResult?.status === 'error') {
      return rejectWithValue(
        triggerResult?.message || response.data?.message || 'トリガー情報の取得に失敗しました'
      );
    }
    return triggerResult?.data;
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.message || error.message || 'トリガー情報の取得中にエラーが発生しました'
    );
  }
});

// シートアーカイブのための非同期アクション
export const archiveSheet = createAsyncThunk(
  'api/archiveSheet',
  async (params: ArchiveSheetParams, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const restUrl = state.auth.user?.googleSheetUrl;

      if (!restUrl) {
        return rejectWithValue('GoogleSheet URL が設定されていません');
      }

      // const requestData = {
      //   filename: params.filename,
      // };

      const response = await gasProxyPost(
        { filename: params.filename },
        {
          action: 'archive',
          target: params.target,
        }
      );

      // レスポンスのステータスをチェック
      if (response.data.status === 'error') {
        return rejectWithValue(response.data.message || 'シートのアーカイブに失敗しました');
      }

      return {
        originalName: params.target === 'posted' ? 'Posted' : 'Errors',
        newName: params.filename,
        ...response.data.data,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          'シートのアーカイブ中にエラーが発生しました'
      );
    }
  }
);

// apiControllerスライス
const apiControllerSlice = createSlice({
  name: 'apiController',
  initialState,
  reducers: {
    clearApiErrors: (state) => {
      state.error = null;
      state.status = 'idle';
    },
    clearUploadedMedia: (state) => {
      state.uploadedMedia = null;
    },
    clearArchivedSheet: (state) => {
      state.archivedSheet = null;
    },
    setInitialized: (state) => {
      state.initialized = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // createTrigger
      .addCase(createTrigger.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createTrigger.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.triggerStatus.functionName = action.payload.handlerFunction;
        state.triggerStatus.isTriggerConfigured = true;
        state.triggerStatus.interval = action.payload.intervalMinutes;
        state.error = null;
      })
      .addCase(createTrigger.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // deleteTrigger
      .addCase(deleteTrigger.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(deleteTrigger.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
        state.triggerStatus.functionName = '';
        state.triggerStatus.interval = -1;
        state.triggerStatus.isTriggerConfigured = false; // トリガーを削除したので、ステータスもnullにする
      })
      .addCase(deleteTrigger.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // getTriggerStatus
      .addCase(getTriggerStatus.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(getTriggerStatus.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;
        // GAS のレスポンス形状が想定外（payload が undefined）の場合でも
        // クラッシュさせず、トリガーステータスは更新しない。
        if (!action.payload) {
          return;
        }
        state.triggerStatus.functionName = action.payload.functionName;
        state.triggerStatus.isTriggerConfigured = action.payload.triggerFound;
        state.triggerStatus.interval = action.payload.intervalMinutes;
        state.triggerStatus.version = action.payload.version;
      })
      .addCase(getTriggerStatus.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // archiveSheet
      .addCase(archiveSheet.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        state.archivedSheet = null;
      })
      .addCase(archiveSheet.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;
        state.archivedSheet = action.payload;
      })
      .addCase(archiveSheet.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
        state.archivedSheet = null;
      });
  },
});

export const { clearApiErrors, clearUploadedMedia, clearArchivedSheet, setInitialized } =
  apiControllerSlice.actions;

// セレクター
export const selectApiStatus = (state: RootState) => state.apiController.status;
export const selectApiError = (state: RootState) => state.apiController.error;
export const selectTriggerStatus = (state: RootState) => state.apiController.triggerStatus;
export const selectArchivedSheet = (state: RootState) => state.apiController.archivedSheet;

export default apiControllerSlice.reducer;
