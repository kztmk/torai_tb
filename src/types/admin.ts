export interface BankTransferRequest {
  id: string; // Firestore document ID
  uid: string;
  userDisplayName?: string;
  userEmail?: string;
  transferName: string;
  planId: string;
  amount: number;
  requestedAt: string; // Firestore Timestamp
  status: 'pending_confirmation' | 'confirmed' | 'rejected' | 'reverted_by_admin'; // Added 'reverted_by_admin'
  requestType: 'initial' | 'renewal';
  originalRequestedAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  revertedAt?: string; // Timestamp for when it was reverted
  revertedBy?: string; // Admin who reverted
  rejectionReason?: string;
}

export interface RevertBankTransferRequestPayload {
  requestId: string;
  rejectionReason: string;
}

export interface RevertBankTransferResponsePayload {
  success: boolean;
  message: string;
}
