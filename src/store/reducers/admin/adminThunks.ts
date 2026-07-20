import { createAsyncThunk } from '@reduxjs/toolkit';
import { getApp } from 'firebase/app'; // getAppをインポート
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/firebase';
import {
  BankTransferRequest,
  RevertBankTransferRequestPayload,
  RevertBankTransferResponsePayload,
} from '@/types/admin';

// Assuming types are in the same directory

const SLICE_NAME = 'admin';

export const fetchPendingBankTransferRequestsThunk = createAsyncThunk<
  BankTransferRequest[], // Return type of the payload creator
  void, // First argument to the payload creator (not needed here)
  { rejectValue: string } // Types for ThunkAPI
>(`${SLICE_NAME}/fetchPendingBankTransferRequests`, async (_, thunkApi) => {
  try {
    const requestsRef = collection(db, 'bankTransferRequests');
    const q = query(requestsRef, where('status', '==', 'pending_confirmation'));
    const querySnapshot = await getDocs(q);
    const pendingRequests: BankTransferRequest[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let serializedRequestedAt = data.requestedAt; // Initialize with original value
      let serializedOriginalRequestedAt = data.originalRequestedAt; // Initialize for originalRequestedAt

      // Duck-typing: Check if data.requestedAt has a toDate method (characteristic of Firestore Timestamp)
      // and attempt to convert it to an ISO string.
      if (data.requestedAt && typeof data.requestedAt.toDate === 'function') {
        try {
          serializedRequestedAt = data.requestedAt.toDate().toISOString();
        } catch (e) {
          // Log error if serialization fails, and keep original (or handle as error)
          console.error(
            "Failed to serialize timestamp for field 'requestedAt'",
            data.requestedAt,
            e
          );
          // serializedRequestedAt will remain data.requestedAt, which might still be non-serializable.
          // Consider setting to null or a placeholder if this occurs frequently.
        }
      }

      // Serialize originalRequestedAt if it's a Timestamp
      if (data.originalRequestedAt && typeof data.originalRequestedAt.toDate === 'function') {
        try {
          serializedOriginalRequestedAt = data.originalRequestedAt.toDate().toISOString();
        } catch (e) {
          console.error(
            "Failed to serialize timestamp for field 'originalRequestedAt'",
            data.originalRequestedAt,
            e
          );
        }
      }

      // Potentially other timestamp fields to serialize:
      // let serializedConfirmedAt = data.confirmedAt;
      // if (data.confirmedAt && typeof data.confirmedAt.toDate === 'function') { /* ... serialize ... */ }

      pendingRequests.push({
        id: doc.id,
        ...data,
        requestedAt: serializedRequestedAt, // Use the processed version
        originalRequestedAt: serializedOriginalRequestedAt, // Use the processed version
        // confirmedAt: serializedConfirmedAt, // If applicable
      } as BankTransferRequest); // Ensure BankTransferRequest type matches these serialized fields
    });
    // Sort by ISO string in descending order (newest first)
    // localeCompare returns > 0 if b.requestedAt is "greater" (later) than a.requestedAt
    return pendingRequests.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  } catch (error: any) {
    console.error('Error fetching pending bank transfer requests (thunk): ', error);
    return thunkApi.rejectWithValue(
      error.message || '振込確認リクエストの読み込みに失敗しました。'
    );
  }
});

/**
 * 銀行振込リクエストを承認するThunk
 */
export const approveBankTransferRequestThunk = createAsyncThunk<
  { success: boolean; message: string; requestId: string }, // 成功時の返り値の型
  string, // 引数 (requestId) の型
  { rejectValue: { message: string; requestId: string } } // エラー時のrejectValueの型
>('admin/approveBankTransferRequest', async (requestId, { rejectWithValue }) => {
  try {
    // Firebaseアプリインスタンスを取得し、正しいリージョンを指定してFunctionsインスタンスを取得
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1');
    const approveBankTransferPayment = httpsCallable(functions, 'approveBankTransferPayment');
    const result = (await approveBankTransferPayment({ requestId })) as {
      data: { success: boolean; message: string };
    };

    if (result.data.success) {
      return { ...result.data, requestId };
    }
    // Cloud Function側でsuccess: falseだがエラーではない場合 (通常はエラーとしてスローされるべき)
    return rejectWithValue({ message: result.data.message || '承認に失敗しました。', requestId });
  } catch (error: any) {
    console.error('Error approving bank transfer request:', error);
    return rejectWithValue({
      message: error.message || '承認処理中にエラーが発生しました。',
      requestId,
    });
  }
});

/**
 * 銀行振込リクエストを差し戻すThunk (管理者がユーザーのステータスを 'payment_requested' または 'renewal_requested' に戻す)
 */
export const rejectBankTransferRequestThunk = createAsyncThunk<
  { success: boolean; message: string; requestId: string }, // 成功時の返り値の型
  RevertBankTransferRequestPayload,
  { rejectValue: { message: string; requestId: string } } // エラー時のrejectValueの型
>('admin/rejectBankTransferRequest', async (payload, { rejectWithValue }) => {
  const { requestId, rejectionReason } = payload;
  try {
    const app = getApp();
    const functions = getFunctions(app, 'asia-northeast1'); // リージョンを適切に指定
    // Cloud Function名を 'revertBankTransferPayment' と仮定
    const revertBankTransfer = httpsCallable<
      RevertBankTransferRequestPayload,
      RevertBankTransferResponsePayload
    >(functions, 'revertBankTransferPayment');

    const result = await revertBankTransfer({ requestId, rejectionReason });

    if (result.data.success) {
      return { ...result.data, requestId };
    }
    // Cloud Function側で success: false だがエラーではない場合
    return rejectWithValue({
      message: result.data.message || '差し戻しに失敗しました。',
      requestId,
    });
  } catch (error: any) {
    console.error('Error reverting bank transfer request:', error);
    return rejectWithValue({
      message: error.message || '差し戻し処理中にエラーが発生しました。',
      requestId,
    });
  }
});
