import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/firebase';

export interface MessageAttachment {
  name: string;
  url: string;
  contentType: string;
  size: number;
  storagePath: string;
}

export interface DirectMessage {
  id: string;
  body: string;
  senderUid: string;
  senderRole: 'user' | 'admin';
  recipientUid: string;
  recipientRole: 'user' | 'admin';
  createdAt: string | null;
  readAt: string | null;
  readByUid?: string | null;
  isImportant: boolean;
  attachments: MessageAttachment[];
}

export interface MessageThread {
  id: string;
  userUid: string;
  userEmail: string;
  userDisplayName: string;
  latestMessageText: string;
  latestMessageAt: string | null;
  latestSenderRole: 'user' | 'admin' | '';
  userUnreadCount: number;
  adminUnreadCount: number;
  hasImportant: boolean;
  updatedAt: string | null;
}

export interface BroadcastMessage {
  id: string;
  subject: string;
  body: string;
  senderUid: string;
  createdAt: string | null;
  readAt: string | null;
}

interface UserMessagesPayload {
  thread: MessageThread | null;
  directMessages: DirectMessage[];
  broadcastMessages: BroadcastMessage[];
}

interface AdminThreadPayload {
  thread: MessageThread | null;
  messages: DirectMessage[];
}

interface MessagesState {
  unreadDirectCount: number;
  unreadBroadcastCount: number;
  unreadCount: number;
  latestThread: MessageThread | null;
  userThread: MessageThread | null;
  directMessages: DirectMessage[];
  broadcastMessages: BroadcastMessage[];
  adminThreads: MessageThread[];
  selectedAdminThread: MessageThread | null;
  selectedAdminMessages: DirectMessage[];
  includePastUserMessages: boolean;
  includePastAdminMessages: boolean;
  loading: 'idle' | 'pending' | 'failed';
  sending: boolean;
  error: string | null;
}

const functions = () => getFunctions(getApp(), 'asia-northeast1');

const MAX_ATTACHMENTS = 3;

const createUniqueId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 15);

const uploadMessageAttachments = async (
  files: File[] | undefined,
  userUid: string
): Promise<MessageAttachment[]> => {
  if (!files || files.length === 0) {
    return [];
  }
  if (files.length > MAX_ATTACHMENTS) {
    throw new Error(`添付ファイルは${MAX_ATTACHMENTS}件までです。`);
  }

  return Promise.all(
    files.map(async (file) => {
      if (!file.type.startsWith('image/')) {
        throw new Error('添付できるファイルは画像のみです。');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('添付画像は10MB以内にしてください。');
      }
      const uniqueId = createUniqueId();
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `message-attachments/${userUid}/${Date.now()}-${uniqueId}-${safeName}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      return {
        name: file.name,
        url,
        contentType: file.type,
        size: file.size,
        storagePath: path,
      };
    })
  );
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
};

export const fetchUserMessageOverview = createAsyncThunk<
  { unreadDirectCount: number; unreadBroadcastCount: number; unreadCount: number; latestThread: MessageThread | null },
  void,
  { rejectValue: string }
>('messages/fetchUserMessageOverview', async (_, { rejectWithValue }) => {
  try {
    const fn = httpsCallable(functions(), 'getUserMessageOverview');
    const result = await fn();
    return result.data as {
      unreadDirectCount: number;
      unreadBroadcastCount: number;
      unreadCount: number;
      latestThread: MessageThread | null;
    };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'メッセージ未読数の取得に失敗しました。'));
  }
});

export const fetchUserMessages = createAsyncThunk<
  UserMessagesPayload,
  { includePast?: boolean } | undefined,
  { rejectValue: string }
>(
  'messages/fetchUserMessages',
  async (payload, { rejectWithValue }) => {
    try {
      const fn = httpsCallable(functions(), 'getUserMessages');
      const result = await fn({ includePast: Boolean(payload?.includePast) });
      return result.data as UserMessagesPayload;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'メッセージの取得に失敗しました。'));
    }
  }
);

export const sendUserMessage = createAsyncThunk<
  void,
  { body: string; files?: File[]; isImportant?: boolean },
  { rejectValue: string }
>(
  'messages/sendUserMessage',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const uid = getAuth().currentUser?.uid;
      if (!uid) {
        throw new Error('ユーザーが認証されていません。');
      }
      const attachments = await uploadMessageAttachments(payload.files, uid);
      const fn = httpsCallable(functions(), 'sendUserMessageToAdmin');
      await fn({ body: payload.body, attachments, isImportant: Boolean(payload.isImportant) });
      await dispatch(fetchUserMessages());
      await dispatch(fetchUserMessageOverview());
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'メッセージの送信に失敗しました。'));
    }
  }
);

export const markDirectMessagesRead = createAsyncThunk<void, { includePast?: boolean } | undefined, { rejectValue: string }>(
  'messages/markDirectMessagesRead',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const fn = httpsCallable(functions(), 'markUserDirectMessagesRead');
      await fn();
      await dispatch(fetchUserMessages({ includePast: Boolean(payload?.includePast) }));
      await dispatch(fetchUserMessageOverview());
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, '既読処理に失敗しました。'));
    }
  }
);

export const markBroadcastRead = createAsyncThunk<void, { broadcastId: string }, { rejectValue: string }>(
  'messages/markBroadcastRead',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const fn = httpsCallable(functions(), 'markBroadcastMessageRead');
      await fn(payload);
      await dispatch(fetchUserMessages());
      await dispatch(fetchUserMessageOverview());
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, '既読処理に失敗しました。'));
    }
  }
);

export const fetchAdminMessageThreads = createAsyncThunk<
  MessageThread[],
  void,
  { rejectValue: string }
>('messages/fetchAdminMessageThreads', async (_, { rejectWithValue }) => {
  try {
    const fn = httpsCallable(functions(), 'getAdminMessageThreads');
    const result = await fn();
    return (result.data as { threads: MessageThread[] }).threads;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'メッセージ一覧の取得に失敗しました。'));
  }
});

export const fetchAdminMessageThread = createAsyncThunk<
  AdminThreadPayload,
  { userUid: string; includePast?: boolean },
  { rejectValue: string }
>('messages/fetchAdminMessageThread', async (payload, { rejectWithValue }) => {
  try {
    const fn = httpsCallable(functions(), 'getAdminMessageThread');
    const result = await fn(payload);
    return result.data as AdminThreadPayload;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'メッセージ履歴の取得に失敗しました。'));
  }
});

export const sendAdminMessage = createAsyncThunk<
  void,
  { userUid: string; body: string; files?: File[]; isImportant?: boolean },
  { rejectValue: string }
>('messages/sendAdminMessage', async (payload, { dispatch, rejectWithValue }) => {
  try {
    const attachments = await uploadMessageAttachments(payload.files, payload.userUid);
    const fn = httpsCallable(functions(), 'sendAdminMessageToUser');
    await fn({
      userUid: payload.userUid,
      body: payload.body,
      attachments,
      isImportant: Boolean(payload.isImportant),
    });
    await dispatch(fetchAdminMessageThreads());
    await dispatch(fetchAdminMessageThread({ userUid: payload.userUid }));
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'メッセージの送信に失敗しました。'));
  }
});

export const sendAdminBroadcast = createAsyncThunk<
  void,
  { subject: string; body: string },
  { rejectValue: string }
>('messages/sendAdminBroadcast', async (payload, { rejectWithValue }) => {
  try {
    const fn = httpsCallable(functions(), 'sendAdminBroadcastMessage');
    await fn(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, '一斉メッセージの作成に失敗しました。'));
  }
});

export const markAdminThreadRead = createAsyncThunk<void, { userUid: string }, { rejectValue: string }>(
  'messages/markAdminThreadRead',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const fn = httpsCallable(functions(), 'markAdminThreadRead');
      await fn(payload);
      await dispatch(fetchAdminMessageThreads());
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, '既読処理に失敗しました。'));
    }
  }
);

export const setMessageImportant = createAsyncThunk<
  void,
  { userUid: string; messageId: string; isImportant: boolean; includePast?: boolean },
  { rejectValue: string }
>('messages/setMessageImportant', async (payload, { dispatch, rejectWithValue }) => {
  try {
    const fn = httpsCallable(functions(), 'setMessageImportant');
    await fn(payload);
    await dispatch(
      fetchAdminMessageThread({ userUid: payload.userUid, includePast: Boolean(payload.includePast) })
    );
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, '重要フラグの更新に失敗しました。'));
  }
});

const initialState: MessagesState = {
  unreadDirectCount: 0,
  unreadBroadcastCount: 0,
  unreadCount: 0,
  latestThread: null,
  userThread: null,
  directMessages: [],
  broadcastMessages: [],
  adminThreads: [],
  selectedAdminThread: null,
  selectedAdminMessages: [],
  includePastUserMessages: false,
  includePastAdminMessages: false,
  loading: 'idle',
  sending: false,
  error: null,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    clearMessagesError(state) {
      state.error = null;
    },
    selectAdminThreadLocally(state, action: PayloadAction<MessageThread | null>) {
      state.selectedAdminThread = action.payload;
      state.selectedAdminMessages = [];
    },
    setIncludePastUserMessages(state, action: PayloadAction<boolean>) {
      state.includePastUserMessages = action.payload;
    },
    setIncludePastAdminMessages(state, action: PayloadAction<boolean>) {
      state.includePastAdminMessages = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserMessageOverview.fulfilled, (state, action) => {
        state.unreadDirectCount = action.payload.unreadDirectCount;
        state.unreadBroadcastCount = action.payload.unreadBroadcastCount;
        state.unreadCount = action.payload.unreadCount;
        state.latestThread = action.payload.latestThread;
      })
      .addCase(fetchUserMessages.pending, (state) => {
        state.loading = 'pending';
        state.error = null;
      })
      .addCase(fetchUserMessages.fulfilled, (state, action) => {
        state.loading = 'idle';
        state.userThread = action.payload.thread;
        state.directMessages = action.payload.directMessages;
        state.broadcastMessages = action.payload.broadcastMessages;
      })
      .addCase(fetchUserMessages.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload ?? 'メッセージの取得に失敗しました。';
      })
      .addCase(fetchAdminMessageThreads.fulfilled, (state, action) => {
        state.adminThreads = action.payload;
      })
      .addCase(fetchAdminMessageThread.fulfilled, (state, action) => {
        if (action.payload.thread) {
          state.selectedAdminThread = action.payload.thread;
        }
        state.selectedAdminMessages = action.payload.messages;
      })
      .addMatcher(
        (action) =>
          [
            sendUserMessage.pending.type,
            sendAdminMessage.pending.type,
            sendAdminBroadcast.pending.type,
          ].includes(action.type),
        (state) => {
          state.sending = true;
          state.error = null;
        }
      )
      .addMatcher(
        (action) =>
          [
            sendUserMessage.fulfilled.type,
            sendAdminMessage.fulfilled.type,
            sendAdminBroadcast.fulfilled.type,
          ].includes(action.type),
        (state) => {
          state.sending = false;
        }
      )
      .addMatcher(
        (action) =>
          [
            sendUserMessage.rejected.type,
            sendAdminMessage.rejected.type,
            sendAdminBroadcast.rejected.type,
          ].includes(action.type),
        (state, action: PayloadAction<string | undefined>) => {
          state.sending = false;
          state.error = action.payload ?? 'メッセージ送信に失敗しました。';
        }
      );
  },
});

export const {
  clearMessagesError,
  selectAdminThreadLocally,
  setIncludePastUserMessages,
  setIncludePastAdminMessages,
} = messagesSlice.actions;
export default messagesSlice.reducer;
