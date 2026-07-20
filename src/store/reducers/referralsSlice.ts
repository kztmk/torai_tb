import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface ReferralDashboardSummary {
  registeredCount: number;
  termsAcceptedCount: number;
  subscribedCount: number;
  earnedMonths: number;
  earnedAmount: number;
  grantedMonths: number;
  grantedAmount: number;
  pendingGrantMonths: number;
  pendingGrantAmount: number;
  availableAmount: number;
  consumedAmount: number;
  stripeAvailableAmount: number;
  bankAvailableAmount: number;
  lifetimeDiscountPercent: number | null;
}

export interface ReferralReward {
  id: string;
  label: string;
  kind: 'subscription_credit' | 'lifetime_50_percent' | 'lifetime_free';
  status: 'earned' | 'partially_granted' | 'granted' | string;
  rewardMonths: number;
  rewardAmount: number;
  grantedMonths: number;
  grantedAmount: number;
  remainingMonths: number;
  remainingAmount: number;
  earnedAt: string | null;
  grantedAt: string | null;
}

export interface ReferredUser {
  uid: string;
  registeredAt: string | null;
  termsAccepted: boolean;
  subscriptionQualified: boolean;
  subscriptionStatus: string;
}

export interface ReferralDashboard {
  referralCode: string;
  referralUrl: string;
  summary: ReferralDashboardSummary;
  rewards: ReferralReward[];
  referredUsers: ReferredUser[];
}

interface ReferralsState {
  dashboard: ReferralDashboard | null;
  loading: 'idle' | 'pending' | 'failed';
  error: string | null;
}

const initialState: ReferralsState = {
  dashboard: null,
  loading: 'idle',
  error: null,
};

const functions = () => getFunctions(getApp(), 'asia-northeast1');

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
};

export const fetchReferralDashboard = createAsyncThunk<
  ReferralDashboard,
  void,
  { rejectValue: string }
>('referrals/fetchDashboard', async (_, { rejectWithValue }) => {
  try {
    const fn = httpsCallable(functions(), 'getMyReferralDashboard');
    const result = await fn();
    return result.data as ReferralDashboard;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, '紹介ダッシュボードの取得に失敗しました。'));
  }
});

export const registerReferralCode = createAsyncThunk<
  void,
  { referralCode: string },
  { rejectValue: string }
>('referrals/registerCode', async (payload, { rejectWithValue }) => {
  try {
    const fn = httpsCallable(functions(), 'registerReferralForCurrentUser');
    await fn(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, '紹介コードの登録に失敗しました。'));
  }
});

const referralsSlice = createSlice({
  name: 'referrals',
  initialState,
  reducers: {
    clearReferralError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReferralDashboard.pending, (state) => {
        state.loading = 'pending';
        state.error = null;
      })
      .addCase(fetchReferralDashboard.fulfilled, (state, action) => {
        state.loading = 'idle';
        state.dashboard = action.payload;
      })
      .addCase(fetchReferralDashboard.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload ?? '紹介ダッシュボードの取得に失敗しました。';
      });
  },
});

export const { clearReferralError } = referralsSlice.actions;
export default referralsSlice.reducer;
