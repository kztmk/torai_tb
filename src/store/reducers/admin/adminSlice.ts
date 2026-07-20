import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BankTransferRequest } from '@/types/admin';
import {
  approveBankTransferRequestThunk,
  fetchPendingBankTransferRequestsThunk,
  rejectBankTransferRequestThunk, // Import the new thunk
} from './adminThunks';

// State type for the admin slice
export interface AdminState {
  pendingBankTransferRequests: BankTransferRequest[];
  loading: 'idle' | 'pending' | 'succeeded' | 'failed';
  error: string | null;
  updatingRequestId: string | null; // For individual request updates
}

const initialState: AdminState = {
  pendingBankTransferRequests: [],
  loading: 'idle',
  error: null,
  updatingRequestId: null,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setUpdatingRequestId: (state, action: PayloadAction<string | null>) => {
      state.updatingRequestId = action.payload;
    },
    // You might add other reducers here, e.g., for clearing errors
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPendingBankTransferRequestsThunk.pending, (state) => {
        state.loading = 'pending';
        state.error = null;
      })
      .addCase(
        fetchPendingBankTransferRequestsThunk.fulfilled,
        (state, action: PayloadAction<BankTransferRequest[]>) => {
          state.loading = 'succeeded';
          state.pendingBankTransferRequests = action.payload;
        }
      )
      .addCase(fetchPendingBankTransferRequestsThunk.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload || '不明なエラーが発生しました。';
      });
    // Cases for approveBankTransferRequestThunk
    builder
      .addCase(approveBankTransferRequestThunk.pending, (state, action) => {
        // action.meta.arg is the requestId passed to the thunk
        state.updatingRequestId = action.meta.arg;
        state.error = null; // Clear previous errors
      })
      .addCase(
        approveBankTransferRequestThunk.fulfilled,
        (
          state,
          action: PayloadAction<{ success: boolean; message: string; requestId: string }>
        ) => {
          state.updatingRequestId = null;
          // Remove the approved request from the list
          state.pendingBankTransferRequests = state.pendingBankTransferRequests.filter(
            (req) => req.id !== action.payload.requestId
          );
          state.error = null;
        }
      )
      .addCase(approveBankTransferRequestThunk.rejected, (state, action) => {
        state.updatingRequestId = null;
        if (action.payload) {
          state.error = action.payload.message;
        } else {
          state.error = '承認処理中に不明なエラーが発生しました。';
        }
      });

    // Cases for rejectBankTransferRequestThunk
    builder
      .addCase(rejectBankTransferRequestThunk.pending, (state, action) => {
        state.updatingRequestId = action.meta.arg.requestId;
        state.error = null;
      })
      .addCase(
        rejectBankTransferRequestThunk.fulfilled,
        (
          state,
          action: PayloadAction<{ success: boolean; message: string; requestId: string }>
        ) => {
          state.updatingRequestId = null;
          // Remove the reverted request from the list of pending requests
          state.pendingBankTransferRequests = state.pendingBankTransferRequests.filter(
            (req) => req.id !== action.payload.requestId
          );
          state.error = null;
        }
      )
      .addCase(rejectBankTransferRequestThunk.rejected, (state, action) => {
        state.updatingRequestId = null;
        state.error = action.payload
          ? action.payload.message
          : '差し戻し処理中に不明なエラーが発生しました。';
      });
  },
});

export const { setUpdatingRequestId } = adminSlice.actions;
export default adminSlice.reducer;
