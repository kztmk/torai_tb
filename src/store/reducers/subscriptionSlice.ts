// src/store/reducers/subscriptionSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getApp } from 'firebase/app'; // Firebase Appインスタンスを取得するためにインポート
import { getFunctions, httpsCallable } from 'firebase/functions';

interface CreateCheckoutSessionPayload {
  planId: string;
  // userId?: string; // Firebase Functions側で context.auth.uid から取得するため通常不要
}

interface CheckoutSessionResponse {
  sessionId: string;
  url?: string;
}

// Firebase Functionsを呼び出す非同期Thunk
export const createCheckoutSessionThunk = createAsyncThunk<
  CheckoutSessionResponse, // 成功時の返り値の型
  CreateCheckoutSessionPayload, // Thunkに渡す引数の型
  { rejectValue: string } // エラー時の型 (エラーメッセージなど)
>('subscription/createCheckoutSession', async (payload, { rejectWithValue }) => {
  try {
    console.info('[StripeCheckout] createStripeCheckoutSession callable start', {
      planId: payload.planId,
      region: 'asia-northeast1',
    });
    const app = getApp(); // デフォルトのFirebase Appインスタンスを取得
    const functions = getFunctions(app, 'asia-northeast1'); // ★ リージョンを明示的に指定
    // 'createStripeCheckoutSession' はFirebase Functionsで定義する関数名
    const createStripeCheckoutSessionCallable = httpsCallable<
      CreateCheckoutSessionPayload,
      CheckoutSessionResponse
    >(functions, 'createStripeCheckoutSession');

    // Firebase Functions を呼び出し
    const result = await createStripeCheckoutSessionCallable(payload);

    console.info('[StripeCheckout] createStripeCheckoutSession callable success', {
      planId: payload.planId,
      hasSessionId: Boolean(result.data.sessionId),
      sessionId: result.data.sessionId,
    });

    if (!result.data.sessionId) {
      throw new Error('Session ID not returned from Firebase Function.');
    }
    return result.data; // { sessionId: 'cs_test_...' } のようなオブジェクトを期待
  } catch (error: any) {
    console.error('Error creating Stripe Checkout session via Firebase Functions:', {
      planId: payload.planId,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      name: error?.name,
      stack: error?.stack,
      rawError: error,
    });
    // Firebase Functionsからのエラーは error.message や error.details で詳細が取れる場合がある
    const errorMessage = error.message || 'Checkout session creation failed';
    return rejectWithValue(errorMessage);
  }
});

interface SubscriptionState {
  checkoutLoading: 'idle' | 'pending';
  checkoutError: string | null;
  sessionId: string | null; // Add sessionId to state
  sessionUrl: string | null;
}

const initialState: SubscriptionState = {
  checkoutLoading: 'idle',
  checkoutError: null,
  sessionId: null, // Initialize sessionId
  sessionUrl: null,
};

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    // 必要に応じて同期的なActionやReducerをここに追加
    clearCheckoutError: (state) => {
      state.checkoutError = null;
      state.sessionId = null;
      state.sessionUrl = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createCheckoutSessionThunk.pending, (state) => {
        state.checkoutLoading = 'pending';
        state.checkoutError = null;
        state.sessionId = null; // Reset sessionId on pending
        state.sessionUrl = null;
      })
      .addCase(
        createCheckoutSessionThunk.fulfilled,
        (state, action: PayloadAction<CheckoutSessionResponse>) => {
          state.checkoutLoading = 'idle';
          state.sessionId = action.payload.sessionId; // Store sessionId in state
          state.sessionUrl = action.payload.url ?? null;
          // DO NOT redirect here. Side effects should be handled in components/hooks.
        }
      )
      .addCase(
        createCheckoutSessionThunk.rejected,
        (state, action: PayloadAction<string | undefined>) => {
          state.checkoutLoading = 'idle';
          state.checkoutError =
            action.payload || 'An unknown error occurred during checkout session creation.';
          state.sessionId = null; // Reset sessionId on error
          state.sessionUrl = null;
        }
      );
  },
});

export const { clearCheckoutError } = subscriptionSlice.actions;
export default subscriptionSlice.reducer;
