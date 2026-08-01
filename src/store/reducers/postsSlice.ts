/**
 * Bluesky / Threads の投稿作成スライス（Phase 9 成果物2）。
 * GAS の postData ターゲット（createMultiple 等）へ Functions proxy 経由でアクセスする。
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { gasProxyPost } from '@/utils/gasProxyClient';
import type { ErrorRow, PostInput, PostedRow, PostRow } from '../../types/posts';
import type { RootState } from '../index';

export interface PostsState {
  creating: boolean;
  isError: boolean;
  errorMessage: string;
  lastCreated: PostRow[];
  /** Posts シート（queued/processing/failed） */
  queued: PostRow[];
  /** Posted シート（投稿済み＋エンゲージメント） */
  posted: PostedRow[];
  /** Errors シート */
  errors: ErrorRow[];
  listLoading: boolean;
  listError: string;
}

const initialState: PostsState = {
  creating: false,
  isError: false,
  errorMessage: '',
  lastCreated: [],
  queued: [],
  posted: [],
  errors: [],
  listLoading: false,
  listError: '',
};

type ThunkConfig = { rejectValue: { message: string }; state: RootState };

const toMessage = (error: any, fallback: string): string =>
  error?.response?.data?.message || error?.message || fallback;

/**
 * 複数の Post をまとめて作成（クロスポスト・スレッド共通）。
 * GAS 側で crossPostGroupId は自動採番される。
 */
export const createPosts = createAsyncThunk<PostRow[], PostInput[], ThunkConfig>(
  'posts/createPosts',
  async (inputs, thunkApi) => {
    try {
      const { googleSheetUrl } = thunkApi.getState().auth.user;
      if (!googleSheetUrl) {
        return thunkApi.rejectWithValue({ message: 'GAS URL is not set in user profile' });
      }
      const response = await gasProxyPost(
        { posts: inputs },
        { action: 'createMultiple', target: 'postData' }
      );
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Failed to create posts');
      }
      return (response.data.data || []) as PostRow[];
    } catch (error: any) {
      return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to create posts') });
    }
  }
);

/**
 * スレッド連投の親子関係を設定（createMultiple で作成後に呼ぶ）。
 * updates: [{ id: 子のid, inReplyTo: 親のid }]
 */
export const updatePostsInReplyTo = createAsyncThunk<
  { updated: number },
  { id: string; inReplyTo: string }[],
  ThunkConfig
>('posts/updateInReplyTo', async (updates, thunkApi) => {
  try {
    const response = await gasProxyPost(
      { updates },
      { action: 'updateInReplyTo', target: 'postData' }
    );
    if (response.data?.status !== 'success') {
      throw new Error(response.data?.message || 'Failed to link thread posts');
    }
    return (response.data.data || { updated: 0 }) as { updated: number };
  } catch (error: any) {
    return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to link thread posts') });
  }
});

/** Posts / Posted / Errors をまとめて取得 */
export const fetchPostLists = createAsyncThunk<
  { queued: PostRow[]; posted: PostedRow[]; errors: ErrorRow[] },
  void,
  ThunkConfig
>('posts/fetchPostLists', async (_, thunkApi) => {
  try {
    const { googleSheetUrl } = thunkApi.getState().auth.user;
    if (!googleSheetUrl) {
      return thunkApi.rejectWithValue({ message: 'GAS URL is not set in user profile' });
    }
    const [queuedRes, postedRes, errorsRes] = await Promise.all([
      gasProxyPost({}, { action: 'fetch', target: 'postData' }),
      gasProxyPost({}, { action: 'fetch', target: 'postedData' }),
      gasProxyPost({}, { action: 'fetch', target: 'errorData' }),
    ]);
    const check = (data: any, fallback: string) => {
      if (data?.status !== 'success') throw new Error(data?.message || fallback);
      return data.data || [];
    };
    return {
      queued: check(queuedRes.data, 'Failed to fetch posts') as PostRow[],
      posted: check(postedRes.data, 'Failed to fetch posted') as PostedRow[],
      errors: check(errorsRes.data, 'Failed to fetch errors') as ErrorRow[],
    };
  } catch (error: any) {
    return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to fetch post lists') });
  }
});

/** 予約日時（postSchedule）を一括更新（設定/削除）。postSchedule 空文字 = 即時 */
export const updatePostSchedule = createAsyncThunk<
  { updated: number },
  { id: string; postSchedule: string }[],
  ThunkConfig
>('posts/updateSchedule', async (updates, thunkApi) => {
  try {
    const response = await gasProxyPost(
      { updates },
      { action: 'updateSchedule', target: 'postData' }
    );
    if (response.data?.status !== 'success') {
      throw new Error(response.data?.message || 'Failed to update schedule');
    }
    return (response.data.data || { updated: 0 }) as { updated: number };
  } catch (error: any) {
    return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to update schedule') });
  }
});

/** 既存 Post の内容編集（contents / mediaUrls / postSchedule）。queued のみ */
export const updatePost = createAsyncThunk<
  PostRow,
  { id: string; contents?: string; mediaUrls?: string[]; postSchedule?: string },
  ThunkConfig
>('posts/updatePost', async (input, thunkApi) => {
  try {
    const response = await gasProxyPost(input, { action: 'update', target: 'postData' });
    if (response.data?.status !== 'success') {
      throw new Error(response.data?.message || 'Failed to update post');
    }
    return response.data.data as PostRow;
  } catch (error: any) {
    return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to update post') });
  }
});

/** 予約・キューの Post を削除（postData delete） */
export const deletePost = createAsyncThunk<string, string, ThunkConfig>(
  'posts/deletePost',
  async (id, thunkApi) => {
    try {
      const response = await gasProxyPost({ id }, { action: 'delete', target: 'postData' });
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Failed to delete post');
      }
      return id;
    } catch (error: any) {
      return thunkApi.rejectWithValue({ message: toMessage(error, 'Failed to delete post') });
    }
  }
);

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    resetPostsError: (state) => {
      state.isError = false;
      state.errorMessage = '';
    },
    resetPostsState: (state) => {
      state.queued = [];
      state.posted = [];
      state.errors = [];
      state.lastCreated = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(createPosts.pending, (state) => {
      state.creating = true;
      state.isError = false;
      state.errorMessage = '';
    });
    builder.addCase(createPosts.fulfilled, (state, action) => {
      state.creating = false;
      state.lastCreated = action.payload;
    });
    builder.addCase(createPosts.rejected, (state, action) => {
      state.creating = false;
      state.isError = true;
      state.errorMessage = action.payload?.message ?? 'Failed to create posts';
    });

    builder.addCase(fetchPostLists.pending, (state) => {
      state.listLoading = true;
      state.listError = '';
    });
    builder.addCase(fetchPostLists.fulfilled, (state, action) => {
      state.listLoading = false;
      state.queued = action.payload.queued;
      state.posted = action.payload.posted;
      state.errors = action.payload.errors;
    });
    builder.addCase(fetchPostLists.rejected, (state, action) => {
      state.listLoading = false;
      state.listError = action.payload?.message ?? 'Failed to fetch post lists';
    });

    builder.addCase(deletePost.fulfilled, (state, action) => {
      state.queued = state.queued.filter((p) => p.id !== action.payload);
    });
  },
});

export const selectPosts = (state: RootState) => state.posts;
export const { resetPostsError, resetPostsState } = postsSlice.actions;
export default postsSlice.reducer;
