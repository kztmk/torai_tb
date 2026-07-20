import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

export type AdminSubscriptionSource = 'stripe' | 'bank' | 'mixed' | 'none';
export type AdminSubscriptionAttention = 'ok' | 'warning' | 'danger';
export type AdminSubscriptionFunnelStage = 'regist' | 'termaccepted' | 'subscribed';

export interface AdminSubscriptionSummary {
  totalUsers: number;
  termsAcceptedCount: number;
  registCount: number;
  termacceptedCount: number;
  preSubscriptionCount: number;
  subscribedCount: number;
  firestoreActiveCount: number;
  stripeActiveCount: number;
  bankCount: number;
  inactiveCount: number;
  pastDueCount: number;
  canceledCount: number;
  mismatchCount: number;
  expiringWithin14DaysCount: number;
}

export interface AdminSubscriptionRow {
  uid: string;
  email: string;
  displayName: string;
  source: AdminSubscriptionSource;
  funnelStage: AdminSubscriptionFunnelStage;
  attentionLevel: AdminSubscriptionAttention;
  mismatchReasons: string[];
  firestore: {
    status: string;
    termsAccepted: boolean;
    appPlanId: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    updatedAt: string | null;
  };
  stripe: {
    status: string | null;
    customerId: string | null;
    subscriptionId: string | null;
    priceId: string | null;
    appPlanId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    error: string | null;
  };
  bank: {
    status: string | null;
    planId: string | null;
    planName: string | null;
    amount: number | null;
    currentPeriodEnd: string | null;
    paymentDeadline: string | null;
  };
  periodEnd: string | null;
  expiresSoon: boolean;
}

export interface AdminSubscriptionDashboard {
  generatedAt: string;
  truncated: boolean;
  userLimit: number;
  pageToken: string | null;
  nextPageToken: string | null;
  serverQuery: string | null;
  summaryScope: 'page';
  expiringSoonDays: number;
  summary: AdminSubscriptionSummary;
  rows: AdminSubscriptionRow[];
}

export interface FetchAdminSubscriptionDashboardArgs {
  pageToken?: string | null;
  pageSize?: number;
  query?: string | null;
}

interface AdminSubscriptionsState {
  dashboard: AdminSubscriptionDashboard | null;
  loading: 'idle' | 'pending' | 'failed';
  error: string | null;
}

const initialState: AdminSubscriptionsState = {
  dashboard: null,
  loading: 'idle',
  error: null,
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

export const fetchAdminSubscriptionDashboard = createAsyncThunk<
  AdminSubscriptionDashboard,
  FetchAdminSubscriptionDashboardArgs | void,
  { rejectValue: string }
>('adminSubscriptions/fetchDashboard', async (args, { rejectWithValue }) => {
  try {
    const functions = getFunctions(getApp(), 'asia-northeast1');
    const fn = httpsCallable(functions, 'getAdminSubscriptionDashboard');
    const result = await fn(args ?? {});
    return result.data as AdminSubscriptionDashboard;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'サブスクリプション情報の取得に失敗しました。'));
  }
});

const adminSubscriptionsSlice = createSlice({
  name: 'adminSubscriptions',
  initialState,
  reducers: {
    clearAdminSubscriptionsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminSubscriptionDashboard.pending, (state) => {
        state.loading = 'pending';
        state.error = null;
      })
      .addCase(fetchAdminSubscriptionDashboard.fulfilled, (state, action) => {
        state.loading = 'idle';
        state.dashboard = action.payload;
      })
      .addCase(fetchAdminSubscriptionDashboard.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload ?? 'サブスクリプション情報の取得に失敗しました。';
      });
  },
});

export const { clearAdminSubscriptionsError } = adminSubscriptionsSlice.actions;
export default adminSubscriptionsSlice.reducer;
