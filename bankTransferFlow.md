# Bank Transfer Subscription Workflow

This document outlines the step-by-step process for users subscribing via bank transfer, including renewal, expiration, and handling of missed payments.

## Phase 1: Initial Application

### Step 1.1: System Displays Bank Transfer Plan

- **Action:** The frontend displays the bank transfer plan option to the user.

### Step 1.2: User Selects Bank Transfer Plan

- **Action:** User clicks the "6ヶ月プラン（銀行振込）" (6-Month Plan - Bank Transfer) button and confirms their choice in a dialog.
- **System Response (Frontend):** Triggers a call to a Cloud Function.

### Step 1.3: System Processes Application Request & Notifies User

- **Trigger:** Frontend calls the `requestBankTransferPayment` Cloud Function (Callable).
- **Cloud Function (`requestBankTransferPayment`) Actions:**
  1.  **Firestore Update:**
      - **Collection:** `users`
      - **Document:** `{uid}` (Authenticated User's ID)
      - **Fields Added/Updated:**
        - `bankPaymentInfo`: (Object)
          - `status`: `'payment_requested'`
          - `planId`: `'half_yearly_bank'` (or the `planId` passed from frontend)
          - `planName`: e.g., `'6ヶ月プラン (銀行振込)'` (from `BANK_TRANSFER_PLANS[planId].name`)
          - `amount`: e.g., `6800` (from `BANK_TRANSFER_PLANS[planId].amount`)
          - `currency`: e.g., `'円'` (from `BANK_TRANSFER_PLANS[planId].currency` or default 'JPY')
          - `requestedAt`: `admin.firestore.FieldValue.serverTimestamp()`
          - `paymentDeadline`: `admin.firestore.Timestamp.fromDate(deadlineDate)` (Calculated as `now + PAYMENT_DEADLINE_DAYS`)
        - `updatedAt`: `admin.firestore.FieldValue.serverTimestamp()`
  2.  **Email:** Sends an "お申込み受付メール" (Application Reception Email) to the user's registered email address. This email includes:
      - Bank account details for the transfer.
      - The total amount due.
      - Instructions for the transfer reference/name.
      - Payment deadline.
- **System Response (Frontend):** Displays a message like "ご登録のメールアドレスに振込詳細をお送りしました。ご確認ください。" (Transfer details have been sent to your registered email address. Please check.)

## Phase 2: User Payment and Initial Confirmation Request

### Step 2.1: User Makes Bank Transfer & Requests Confirmation

- **Action (User Offline):** User performs the bank transfer according to the details received in the email.
- **Action (User Online):** User navigates to a designated area on the frontend (e.g., profile page).
- **UI Condition:** The form/button to request confirmation is shown if `users/{uid}/bankPaymentInfo.status` is `'payment_requested'`.
- **User Input:** User enters their "振込名義" (transfer name/reference) into a form.
- **System Response (Frontend):** User clicks the "振込確認をリクエスト" (Request Transfer Confirmation) button.

### Step 2.2: System Records User's Initial Confirmation Request

- **Trigger:** Frontend calls the `requestBankTransferConfirmation` Cloud Function (Callable).
- **Cloud Function (`requestBankTransferConfirmation`) Actions:**
  1.  **Firestore Create (New Document):**
      - **Collection:** `bankTransferRequests`
      - **Document:** New unique ID (e.g., `{requestId}`)
      - **Fields Added:**
        - `uid`: User's ID
        - `userDisplayName`: User's display name (from `users/{uid}` or auth token)
        - `userEmail`: User's email (from `users/{uid}` or auth token)
        - `transferName`: Transfer name/reference entered by the user
        - `planId`: Value from `users/{uid}/bankPaymentInfo.planId`
        - `amount`: Value from `users/{uid}/bankPaymentInfo.amount`
        - `requestedAt`: `admin.firestore.FieldValue.serverTimestamp()` (Timestamp of this confirmation request)
        - `status`: `'pending_confirmation'` (Awaiting admin verification)
        - `requestType`: `'initial'` (Indicates an initial subscription request)
        - `originalRequestedAt`: Value from `users/{uid}/bankPaymentInfo.requestedAt` (Timestamp of the initial application)
  2.  **Firestore Update:**
      - **Collection:** `users`
      - **Document:** `{uid}`
      - **Fields Updated:**
        - `bankPaymentInfo.status`: `'pending_confirmation'`
        - `bankPaymentInfo.transferNameReported`: The transfer name/reference reported by the user
        - `bankPaymentInfo.confirmationRequestedAt`: `admin.firestore.FieldValue.serverTimestamp()`
        - `updatedAt`: `admin.firestore.FieldValue.serverTimestamp()`
- **System Response (Frontend):** Displays a message like "振込確認のリクエストを受け付けました。確認が完了し次第、メールにてご連絡いたします。通常X営業日ほどかかります。" (Transfer confirmation request received. We will notify you by email once confirmed. This usually takes X business days.)

## Phase 3: Admin Verification and Plan Activation (Initial or Renewal)

### Step 3.1: Admin Reviews and Approves Request

- **Action (Admin Panel):** Admin views pending transfer requests (e.g., by querying `bankTransferRequests` where `status === 'pending_confirmation'` or `status === 'renewal_pending_confirmation'`).
- **Admin Action:** Admin verifies the payment details (amount, transfer name/reference) against actual bank records.
- **System Response (Admin Panel):** Admin clicks an "承認" (Approve) button for the specific request.

### Step 3.2: System Processes Approval and Activates/Extends Plan

- **Trigger:** Admin panel calls the `approveBankTransferPayment` Cloud Function (Callable, with admin privileges check).
- **Cloud Function (`approveBankTransferPayment`) Actions:**
  1.  **Firestore Update:**
      - **Collection:** `bankTransferRequests`
      - **Document:** `{requestId}` (ID of the request being approved)
      - **Fields Updated:**
        - `status`: `'confirmed'`
        - `confirmedAt`: `admin.firestore.FieldValue.serverTimestamp()`
        - `confirmedBy`: Admin's UID (optional, for tracking who approved)
  2.  **Firestore Update:**
      - **Collection:** `users`
      - **Document:** `{uid}` (User ID from the `bankTransferRequests` document)
      - **Fields Added/Updated:**
        - `appPlanId`: `'half_yearly_bank'` (or value from `bankRequestData.planId`)
        - `stripePriceId`: `'bank_half_yearly'` (Internal identifier)
        - `subscriptionStatus`: `'active'`
        - `currentPeriodStart`:
          - For `requestType === 'initial'`: `admin.firestore.Timestamp.now()`
          - For `requestType === 'renewal'`: The user's _previous_ `currentPeriodEnd` value.
        - `currentPeriodEnd`: Calculated as new `currentPeriodStart` + 6 months.
        - `bankPaymentInfo`: (Object, merged with existing `bankPaymentInfo` data from `bankRequestData`)
          - `status`: `'active'`
          - `confirmedAt`: `admin.firestore.FieldValue.serverTimestamp()`
          - `planActivatedAt`: `admin.firestore.FieldValue.serverTimestamp()` (For initial)
          - `lastRenewalConfirmedAt`: `admin.firestore.FieldValue.serverTimestamp()` (For renewal, recommended)
        - `cancelAtPeriodEnd`: `false`
        - `canceledAt`: `admin.firestore.FieldValue.delete()`
        - `endedAt`: `admin.firestore.FieldValue.delete()`
        - `updatedAt`: `admin.firestore.FieldValue.serverTimestamp()`
  3.  **Email:**
      - For `requestType === 'initial'`: Sends "プランが有効になりました" (Your Plan Has Been Activated) email.
      - For `requestType === 'renewal'`: Sends "更新完了・プラン延長" (Renewal Complete & Plan Extended) email.
- **System Response (Admin Panel):** Displays a success message to the admin.
- **System Response (User):** User can now access services associated with the active plan. The UI should reflect the active subscription status.

## Phase 4: Renewal Flow

### Step 4.1: System Sends Renewal Notification (Scheduled)

- **Trigger:** Scheduled Cloud Function `sendBankTransferRenewalNotices` (e.g., daily at 09:00).
- **Cloud Function (`sendBankTransferRenewalNotices`) Actions:**
  1.  **Firestore Query:**
      - **Collection:** `users`
      - **Conditions:**
        - `appPlanId === 'half_yearly_bank'`
        - `subscriptionStatus === 'active'`
        - `bankPaymentInfo.status === 'active'`
        - `currentPeriodEnd` is `DAYS_BEFORE_EXPIRATION_FOR_RENEWAL_NOTICE` (e.g., 7) days away.
  2.  **For each matching user:**
      - **Email:** Sends a "更新案内メール" (Renewal Notification Email) with bank details, renewal amount, payment deadline, etc.
      - **Firestore Update:**
        - **Collection:** `users`
        - **Document:** `{uid}`
        - **Fields Updated/Added:**
          - `bankPaymentInfo.status`: `'renewal_requested'`
          - `bankPaymentInfo.renewalRequestedAt`: `admin.firestore.FieldValue.serverTimestamp()`
          - `bankPaymentInfo.renewalAmount`: Current price of the plan (e.g., `6800` from `BANK_TRANSFER_PLANS[RENEWAL_PLAN_ID_BANK].amount`)
          - `bankPaymentInfo.renewalPaymentDeadline`: `admin.firestore.Timestamp.fromDate(paymentDeadline)` (Calculated as `now + RENEWAL_PAYMENT_DUE_DAYS`)
          - `updatedAt`: `admin.firestore.FieldValue.serverTimestamp()`

### Step 4.2: User Makes Renewal Payment & Requests Confirmation

- **Action (User Offline & Online):** Similar to initial application (Phase 2.1). User makes the transfer and uses the frontend to report it.
- **UI Condition:** Frontend shows renewal payment confirmation form if `users/{uid}/bankPaymentInfo.status` is `'renewal_requested'`.
- **Trigger:** Frontend calls a Cloud Function (e.g., `requestBankTransferConfirmation` adapted or a new one for renewals).
- **Cloud Function Actions (e.g., adapted `requestBankTransferConfirmation` or new function):**
  1.  **Firestore Create (New Document):**
      - **Collection:** `bankTransferRequests`
      - **Document:** New unique ID (e.g., `{renewalRequestId}`)
      - **Fields Added:**
        - `uid`, `userDisplayName`, `userEmail`, `transferName`, `planId`
        - `amount`: Renewal amount (from `users/{uid}/bankPaymentInfo.renewalAmount`)
        - `requestedAt`: `admin.firestore.FieldValue.serverTimestamp()`
        - `status`: `'renewal_pending_confirmation'`
        - `requestType`: `'renewal'`
        - `originalRequestedAt`: Value from `users/{uid}/bankPaymentInfo.renewalRequestedAt` (Timestamp of the renewal notice)
  2.  **Firestore Update:**
      - **Collection:** `users`
      - **Document:** `{uid}`
      - **Fields Updated:**
        - `bankPaymentInfo.status`: `'renewal_pending_confirmation'`
        - `bankPaymentInfo.transferNameReported`: Transfer name reported by user for renewal
        - `bankPaymentInfo.confirmationRequestedAt`: `admin.firestore.FieldValue.serverTimestamp()`
        - `updatedAt`: `admin.firestore.FieldValue.serverTimestamp()`

### Step 4.3: Admin Verifies and Approves Renewal

- **Action (Admin Panel):** Similar to initial approval (Phase 3.1). Admin reviews requests where `status === 'renewal_pending_confirmation'` or `requestType === 'renewal'`.
- **Trigger:** Admin panel calls the `approveBankTransferPayment` Cloud Function.
- **Cloud Function (`approveBankTransferPayment`) Actions:** (Refer to Phase 3.2, specifically for `requestType === 'renewal'`)

## Phase 5: Expiration Handling (for Unrenewed Subscriptions)

### Step 5.1: System Processes Plan Expiration (Scheduled)

- **Trigger:** Scheduled Cloud Function `processExpiredBankTransferSubscriptions` (e.g., daily at 10:00).
- **Cloud Function (`processExpiredBankTransferSubscriptions`) Actions:**
  1.  **Firestore Query:**
      - **Collection:** `users`
      - **Conditions:**
        - `appPlanId === 'half_yearly_bank'`
        - `bankPaymentInfo.status` is `'renewal_requested'` OR `'renewal_pending_confirmation'`
        - `currentPeriodEnd` is in the past ( `< admin.firestore.Timestamp.now()`).
  2.  **For each matching user:**
      - **Firestore Update:**
        - **Collection:** `users`
        - **Document:** `{uid}`
        - **Fields Updated:**
          - `subscriptionStatus`: `'expired'`
          - `bankPaymentInfo.status`: `'expired'`
          - `endedAt`: `admin.firestore.FieldValue.serverTimestamp()`
          - `updatedAt`: `admin.firestore.FieldValue.serverTimestamp()`
      - **Email (Optional):** Sends a "プラン有効期限切れ" (Your Plan Has Expired) email to the user. The email might state "ご入金期限が過ぎたため、プランが失効しました。" (Your plan has expired because the payment deadline has passed.)

## Phase 6: Handling Missed Initial Payments

### Step 6.1: System Processes Missed Initial Payment (Scheduled)

- **Trigger:** Scheduled Cloud Function `processMissedBankTransferPayments` (e.g., daily at 11:00).
- **Cloud Function (`processMissedBankTransferPayments`) Actions:**
  1.  **Firestore Query:**
      - **Collection:** `users`
      - **Conditions:**
        - `appPlanId === 'half_yearly_bank'` (or the relevant bank plan ID)
        - `bankPaymentInfo.status === 'payment_requested'`
        - `bankPaymentInfo.paymentDeadline` is in the past ( `< admin.firestore.Timestamp.now()`).
  2.  **For each matching user:**
      - **Firestore Update:**
        - **Collection:** `users`
        - **Document:** `{uid}`
        - **Fields Updated:**
          - `bankPaymentInfo.status`: `'payment_failed'`
          - `updatedAt`: `admin.firestore.FieldValue.serverTimestamp()`
      - **Email:** Sends a "お振込み期限切れ・申込キャンセル" (Payment Deadline Missed & Application Canceled) email. The email might state "お振込み期限が過ぎたため、お申込みはキャンセルされました。再度お手続きをご希望の場合は、改めてプラン選択ページよりお申込みください。" (Your application has been canceled because the payment deadline has passed. If you wish to apply again, please do so from the plan selection page.)

---

_This document now includes the initial application, renewal, expiration, and missed initial payment flows for bank transfer subscriptions._

### mail from system

#### 1. 銀行振込申込み

　　\* bankTransferRequestNotification

##### 1-1. 振込み確認リクエスト後承認

　　bankTransferApprovalNotification

#### 1-2. 振込み無視で期限

　　bankPaymentDeadlineMissedNotification

#### 2. renewal通知

　　bankRenewalNotification

##### 2-1 振込確認リクエスト後承認

　　1-1

##### 2-2 振込無視で期限

　　 bankPlanExpiredNotification

#### e-mail確認

emailVerification_ja
emailVerification_en

#### passwordReset

passwordReset_ja
passwordReset_en

#### account Delete

accountDeletedNotification
