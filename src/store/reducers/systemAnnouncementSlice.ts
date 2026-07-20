import dayjs from 'dayjs';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { get, getDatabase, push, ref, set } from 'firebase/database';
import { RootState } from '../index';

export interface SystemAnnouncement {
  id: string;
  date: string;
  status: 'info' | 'bugs' | 'fixed' | 'update' | 'important' | 'feature';
  title: string;
  description: string;
}

export interface SystemAnnouncements {
  isLoading: boolean;
  error: string | null;
  sysAnnouncements: SystemAnnouncement[];
}

const sortAnnouncementsByDate = (a: SystemAnnouncement, b: SystemAnnouncement) => {
  if (a.date && b.date) {
    return dayjs(a.date).isAfter(dayjs(b.date)) ? 1 : -1;
  }
  return 0;
};

/**
 * 1. 一覧取得
 */
export const fetchSystemAnnouncement = createAsyncThunk<
  SystemAnnouncement[],
  void,
  { rejectValue: string }
>('systemAnnouncement/fetchSystemAnnouncement', async (_, thunkAPI) => {
  try {
    const db = getDatabase();
    const snapshot = await get(ref(db, '/public/info'));
    console.log('snapshot', snapshot.exists());
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data) {
        const sysAnnouces: SystemAnnouncement[] = Object.keys(data).map((key) => ({
          ...data[key],
          id: key,
        }));
        return sysAnnouces;
      }
      return [];
    }
    return [];
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

/**
 * 2. 新規追加
 * push でキーを自動生成しつつ書き込む
 */
export const addSystemAnnouncement = createAsyncThunk<
  SystemAnnouncement,
  SystemAnnouncement,
  { rejectValue: string }
>('systemAnnouncement/addSystemAnnouncement', async (newInfo, thunkAPI) => {
  try {
    const db = getDatabase();

    const infoRef = ref(db, '/public/info');
    const newRef = await push(infoRef);
    if (!newRef.key) {
      throw new Error('Failed to generate key for new SystemAnnouncement');
    }
    await set(newRef, { ...newInfo });
    return {
      ...newInfo,
      id: newRef.key,
    };
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

/**
 * 3. 既存データ更新
 *
 *   SystemAnnouncementWithId: { id, status, title, description }
 */
export const updateSystemAnnouncement = createAsyncThunk<
  SystemAnnouncement,
  SystemAnnouncement,
  { rejectValue: string }
>('systemAnnouncement/updateSystemAnnouncement', async (updatedInfo, thunkAPI) => {
  try {
    const { id, ...rest } = updatedInfo;
    const db = getDatabase();

    await set(ref(db, `/public/info/${id}`), { ...rest });
    return updatedInfo;
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

/**
 * 4. 削除
 */
export const deleteSystemAnnouncement = createAsyncThunk<string, string, { rejectValue: string }>(
  'systemAnnouncement/deleteSystemAnnouncement',
  async (id, thunkAPI) => {
    try {
      const db = getDatabase();
      await set(ref(db, `/public/info/${id}`), null);
      return id;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

const initialState: SystemAnnouncements = {
  sysAnnouncements: [],
  isLoading: false,
  error: null,
};

export const systemAnnouncementsSlice = createSlice({
  name: 'systemAnnouncements',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // fetchsystemAnnouncement
    builder.addCase(fetchSystemAnnouncement.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchSystemAnnouncement.fulfilled, (state, action) => {
      state.isLoading = false;
      state.sysAnnouncements = action.payload;
      state.sysAnnouncements.sort(sortAnnouncementsByDate);
    });
    builder.addCase(fetchSystemAnnouncement.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to fetch public infos';
    });

    // addSystemAnnouncement
    builder.addCase(addSystemAnnouncement.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(addSystemAnnouncement.fulfilled, (state, action) => {
      state.isLoading = false;
      state.sysAnnouncements.push(action.payload);
      state.sysAnnouncements.sort(sortAnnouncementsByDate);
    });
    builder.addCase(addSystemAnnouncement.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to add public info';
    });

    // updateSystemAnnouncement
    builder.addCase(updateSystemAnnouncement.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(updateSystemAnnouncement.fulfilled, (state, action) => {
      state.isLoading = false;
      const index = state.sysAnnouncements.findIndex((info) => info.id === action.payload.id);
      if (index !== -1) {
        state.sysAnnouncements[index] = action.payload;
      }
      state.sysAnnouncements.sort(sortAnnouncementsByDate);
    });
    builder.addCase(updateSystemAnnouncement.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to update public info';
    });

    // deleteSystemAnnouncement
    builder.addCase(deleteSystemAnnouncement.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(deleteSystemAnnouncement.fulfilled, (state, action) => {
      state.isLoading = false;
      state.sysAnnouncements = state.sysAnnouncements.filter((info) => info.id !== action.payload);
      state.sysAnnouncements.sort(sortAnnouncementsByDate);
    });
    builder.addCase(deleteSystemAnnouncement.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to delete public info';
    });
  },
});

export const selectSystemAnnouncements = (state: RootState) => state.systemAnnouncements;
export default systemAnnouncementsSlice.reducer;
