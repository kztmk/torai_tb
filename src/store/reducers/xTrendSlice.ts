import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { collection, DocumentData, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/firebase';
import { RootState } from '@/store';
import { parseXTrends, parseXTrendTimestamp, XTrend } from '@/utils/xTrends';

// データ型定義
export type XTrendType = XTrend;
export type XTrendData = {
  timestamp: string; // Firestore に保存されているタイムスタンプ文字列
  xtrends: XTrendType[];
};

interface XTrendState {
  fetchedAt: string | null; // 追加: 最終取得日時ISO文字列
  trends: XTrendData[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
const initialState: XTrendState = {
  fetchedAt: null, // 初期値
  trends: [],
  status: 'idle',
  error: null,
};

export const fetchXTrends = createAsyncThunk<XTrendData[], void, { rejectValue: string }>(
  'xTrend/fetchTrends',
  async (_, { rejectWithValue }) => {
    try {
      const colRef = collection(db, 'XTrends');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(6));
      const snap = await getDocs(q);
      const data: XTrendData[] = snap.docs.map((doc) => {
        const d = doc.data() as DocumentData;
        return {
          timestamp: parseXTrendTimestamp(d.timestamp),
          xtrends: parseXTrends(d.xtrends),
        };
      });
      return data;
    } catch (err: any) {
      console.error('Error fetching Xtrends:', err);
      return rejectWithValue(err.message || 'Failed to fetch X trends');
    }
  }
);

const xTrendSlice = createSlice({
  name: 'xTrend',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchXTrends.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchXTrends.fulfilled, (state, action: PayloadAction<XTrendData[]>) => {
        state.status = 'succeeded';
        state.trends = action.payload;
        state.fetchedAt = new Date().toISOString(); // 取得日時を記録
      })
      .addCase(fetchXTrends.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Unknown error';
      });
  },
});

// … selectors で selectXTrends は state.xTrend
export const selectXTrends = (state: RootState) => state.xTrend;

export default xTrendSlice.reducer;
