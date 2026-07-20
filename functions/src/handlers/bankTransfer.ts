// functions/src/handlers/bankTransfer.ts
import admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  BANK_ACCOUNT_DETAILS,
  BANK_TRANSFER_PLANS,
  getAdminNotificationBcc,
  PAYMENT_DEADLINE_DAYS,
  stripeSecretKey,
} from '../config';
import { getBankTransferFeeAmount } from '../firstMonthDiscount';
import { getMailchimpTag } from '../mailchimpTag';
import { db, initializeStripeSDK } from '../utils'; // utilsからdbをインポート
import { createDirectMessage } from './messages';
import { qualifyReferralSubscription } from './referrals';

function getErrorLogFields(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

async function assertBankTransferAdmin(request: any, functionName: string): Promise<string> {
  if (!request.auth || !request.auth.uid) {
    logger.error(`User not authenticated for ${functionName}`);
    throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
  }

  if (request.auth.token.isAdmin) {
    return request.auth.uid;
  }

  const requesterDoc = await db.collection('users').doc(request.auth.uid).get();
  const requesterData = requesterDoc.exists ? requesterDoc.data() : null;
  if (!requesterData?.isAdmin) {
    logger.error(
      `User ${request.auth.uid} is not an admin. Permission denied for ${functionName}.`
    );
    throw new HttpsError('permission-denied', 'この操作を実行するには管理者権限が必要です。');
  }

  return request.auth.uid;
}

// 銀行振込申込みでbankPaymentInfoデータを作成し入金メールを送信
export const requestBankTransferPayment = onCall({ region: 'asia-northeast1' }, async (request) => {
  // 1. 認証チェック
  if (!request.auth || !request.auth.uid) {
    logger.error('User not authenticated for requestBankTransferPayment');
    throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
  }
  const userId = request.auth.uid;
  const userEmail = request.auth.token.email;
  const userName = request.auth.token.name || userEmail; // ユーザー名（表示用）

  if (!userEmail) {
    logger.error(
      `User ${userId} does not have an email address, which is required for bank transfer notifications.`
    );
    throw new HttpsError('failed-precondition', '銀行振込の手続きにはメールアドレスが必要です。');
  }

  // 2. リクエストデータからプランIDを取得
  const { planId } = request.data as { planId: string };
  if (!planId) {
    logger.error('planId is missing in the request data for requestBankTransferPayment.');
    throw new HttpsError('invalid-argument', 'プランIDが指定されていません。');
  }

  const planDetails = BANK_TRANSFER_PLANS[planId];
  if (!planDetails) {
    logger.error(`Invalid planId: ${planId} provided for requestBankTransferPayment.`);
    throw new HttpsError(
      'not-found',
      `指定されたプランID (${planId}) は銀行振込に対応していません。`
    );
  }

  try {
    // 3. FirestoreのユーザーデータにbankPaymentInfoを追加/更新
    const userDocRef = db.collection('users').doc(userId);
    const now = new Date();
    const deadlineDate = new Date(now.getTime() + PAYMENT_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
    const deadlineTimestamp = admin.firestore.Timestamp.fromDate(deadlineDate);
    const bankTransferFeeAmount = await getBankTransferFeeAmount();
    let firstMonthDiscountStatus: unknown = null;
    let discountExpiresAtMillis: number | null = null;

    const bankPaymentInfoData = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      const userData = userDoc.data() || {};
      const firstMonthDiscount = userData.firstMonthDiscount;
      const discountExpiresAt = firstMonthDiscount?.expiresAt as
        | admin.firestore.Timestamp
        | undefined;
      const referralBankAvailableAmount = Math.max(
        0,
        Math.floor(userData.referralCredit?.bankAvailableAmount ?? 0)
      );
      const isFirstMonthDiscountActive =
        firstMonthDiscount?.status === 'eligible' &&
        discountExpiresAt &&
        discountExpiresAt.toMillis() > now.getTime();
      const feeDiscountAmount = isFirstMonthDiscountActive ? bankTransferFeeAmount : 0;
      const totalBeforeReferralCredit =
        planDetails.amount + bankTransferFeeAmount - feeDiscountAmount;
      const referralCreditAppliedAmount = Math.min(
        referralBankAvailableAmount,
        totalBeforeReferralCredit
      );
      const totalAmount = totalBeforeReferralCredit - referralCreditAppliedAmount;
      const nextBankPaymentInfoData = {
        status: 'payment_requested', // 支払い情報送信済み・入金待ち
        planId,
        planName: planDetails.name,
        amount: totalAmount,
        baseAmount: planDetails.amount,
        feeAmount: bankTransferFeeAmount,
        discountAmount: feeDiscountAmount,
        referralCreditAppliedAmount,
        totalAmount,
        firstMonthDiscountApplied: Boolean(isFirstMonthDiscountActive),
        currency: planDetails.currency || 'JPY',
        requestedAt: admin.firestore.FieldValue.serverTimestamp(), // 実際の申込日時
        paymentDeadline: deadlineTimestamp, // 支払期限
      };
      const userUpdateData: any = {
        applyMailchimpTag: getMailchimpTag('bankRequested'),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const hasBankPaymentInfoMap =
        userData.bankPaymentInfo &&
        typeof userData.bankPaymentInfo === 'object' &&
        !Array.isArray(userData.bankPaymentInfo);
      if (hasBankPaymentInfoMap) {
        Object.entries(nextBankPaymentInfoData).forEach(([key, value]) => {
          userUpdateData[`bankPaymentInfo.${key}`] = value;
        });
        userUpdateData['bankPaymentInfo.rejectionReason'] = admin.firestore.FieldValue.delete();
        userUpdateData['bankPaymentInfo.rejectedAt'] = admin.firestore.FieldValue.delete();
        userUpdateData['bankPaymentInfo.rejectedRequestId'] = admin.firestore.FieldValue.delete();
        userUpdateData['bankPaymentInfo.transferNameReported'] =
          admin.firestore.FieldValue.delete();
        userUpdateData['bankPaymentInfo.confirmationRequestedAt'] =
          admin.firestore.FieldValue.delete();
        userUpdateData['bankPaymentInfo.confirmedAt'] = admin.firestore.FieldValue.delete();
        userUpdateData['bankPaymentInfo.planActivatedAt'] = admin.firestore.FieldValue.delete();
        userUpdateData['bankPaymentInfo.canceledAt'] = admin.firestore.FieldValue.delete();
      } else {
        userUpdateData.bankPaymentInfo = nextBankPaymentInfoData;
      }
      if (isFirstMonthDiscountActive) {
        userUpdateData.firstMonthDiscount = {
          ...firstMonthDiscount,
          status: 'redeemed',
          redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
          checkoutSessionId: 'bank_transfer',
          amountOff: feeDiscountAmount,
          appliedPlanId: planId,
        };
      }
      if (referralCreditAppliedAmount > 0) {
        userUpdateData['referralCredit.bankAvailableAmount'] =
          admin.firestore.FieldValue.increment(-referralCreditAppliedAmount);
        userUpdateData['referralCredit.consumedAmount'] =
          admin.firestore.FieldValue.increment(referralCreditAppliedAmount);
        userUpdateData['referralCredit.updatedAt'] = admin.firestore.FieldValue.serverTimestamp();
      }

      if (userDoc.exists) {
        transaction.update(userDocRef, userUpdateData);
      } else {
        const newUserData: any = {
          bankPaymentInfo: nextBankPaymentInfoData,
          applyMailchimpTag: userUpdateData.applyMailchimpTag,
          updatedAt: userUpdateData.updatedAt,
        };
        if (isFirstMonthDiscountActive) {
          newUserData.firstMonthDiscount = userUpdateData.firstMonthDiscount;
        }
        transaction.set(userDocRef, newUserData, { merge: true });
      }
      firstMonthDiscountStatus = firstMonthDiscount?.status ?? null;
      discountExpiresAtMillis = discountExpiresAt?.toMillis() ?? null;
      return nextBankPaymentInfoData;
    });
    logger.info('Bank payment request info successfully added/updated.', {
      userId,
      planId,
      baseAmount: bankPaymentInfoData.baseAmount,
      feeAmount: bankPaymentInfoData.feeAmount,
      discountAmount: bankPaymentInfoData.discountAmount,
      referralCreditAppliedAmount: bankPaymentInfoData.referralCreditAppliedAmount,
      totalAmount: bankPaymentInfoData.totalAmount,
      firstMonthDiscountApplied: Boolean(bankPaymentInfoData.firstMonthDiscountApplied),
      firstMonthDiscountStatus,
      firstMonthDiscountExpiresAtMillis: discountExpiresAtMillis,
    });

    // 4. 振込詳細メールを送信 (Trigger Email Extension を利用する想定)
    // Trigger Email Extensionが 'mail' コレクションを監視していると仮定
    const mailCollectionRef = admin.firestore().collection('mail');
    const formattedDeadline = `${deadlineDate.getFullYear()}年${
      deadlineDate.getMonth() + 1
    }月${deadlineDate.getDate()}日`;

    const templateName = 'bankTransferRequestNotification';

    // テンプレートの存在を確認
    const templateQuery = await admin
      .firestore()
      .collection('mail-templates') // Trigger Emailのテンプレートコレクション名
      .doc(templateName)
      .get();

    if (!templateQuery.exists) {
      logger.error(
        `Trigger Email template "${templateName}" not found. Cannot send bank transfer notification.`
      );
      throw new HttpsError(
        'not-found',
        `メールテンプレート "${templateName}" が見つかりません。銀行振込通知を送信できません。`
      );
    }

    // テンプレートが存在する場合、メールを送信
    if (templateQuery.exists) {
      const bcc = getAdminNotificationBcc();
      await mailCollectionRef.add({
        to: [userEmail],
        ...(bcc.length > 0 ? { bcc } : {}),
        template: {
          name: 'bankTransferRequestNotification', // 事前に作成したTrigger Emailのテンプレート名
          data: {
            displayName: userName,
            serviceName: BANK_ACCOUNT_DETAILS.serviceName,
            planName: planDetails.name,
            amount: planDetails.amount.toLocaleString(), // 金額を読みやすい形式に
            bankTransferFee: bankPaymentInfoData.feeAmount.toLocaleString(),
            feeDiscountAmount: bankPaymentInfoData.discountAmount.toLocaleString(),
            referralCreditAppliedAmount:
              bankPaymentInfoData.referralCreditAppliedAmount.toLocaleString(),
            totalAmount: bankPaymentInfoData.totalAmount.toLocaleString(),
            firstMonthDiscountApplied: Boolean(bankPaymentInfoData.firstMonthDiscountApplied),
            currency: planDetails.currency || 'JPY',
            bankName: BANK_ACCOUNT_DETAILS.bankName,
            branchName: BANK_ACCOUNT_DETAILS.branchName,
            accountType: BANK_ACCOUNT_DETAILS.accountType,
            accountNumber: BANK_ACCOUNT_DETAILS.accountNumber,
            accountHolder: BANK_ACCOUNT_DETAILS.accountHolder,
            paymentDeadline: formattedDeadline,
            // // メールテンプレート内で振込名義に関する指示を記述
          },
          attachments: [],
        },
        attachments: [],
        // もしTrigger Emailのテンプレート機能を使わない場合:
        // message: {
        //   subject: `【${userName}】銀行振込お申込みありがとうございます `,
        //   html: `${BANK_ACCOUNT_DETAILS.accountHolder}様<br><br>${formattedDeadline}}`,
        //   text: `...ここにテキストメール本文を生成するロジック...`,
        // },
      });
      logger.info(
        `Bank transfer details email queued for user ${userId} (${userEmail}) for plan ${planId}.${BANK_ACCOUNT_DETAILS.accountHolder}, ${userName}, ${formattedDeadline}`
      );
    }

    return {
      success: true,
      bankPaymentInfo: bankPaymentInfoData,
      message: '銀行振込の詳細をご登録のメールアドレスにお送りしました。ご確認ください。',
    };
  } catch (error: any) {
    logger.error(
      `Error processing bank transfer request for user ${userId}, plan ${planId}:`,
      error
    );
    // HttpsErrorインスタンスはそのままスロー
    if (error instanceof HttpsError) {
      throw error;
    }
    // その他のエラーは一般的な内部エラーとしてスロー
    throw new HttpsError('internal', '銀行振込の申込処理中にエラーが発生しました。', error.message);
  }
});

// 入金完了確認をリクエスト、bankPayment.status:'pending_confirmation'へ
export const requestBankTransferConfirmation = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    // ... (元の関数のロジック)
    // 1. 認証チェック
    if (!request.auth || !request.auth.uid) {
      logger.error('User not authenticated for requestBankTransferConfirmation');
      throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
    }
    const userId = request.auth.uid;

    // 2. リクエストデータから振込名義を取得
    const { transferName } = request.data as { transferName: string };
    if (!transferName || typeof transferName !== 'string' || transferName.trim() === '') {
      logger.error(
        'transferName is missing or invalid in the request data for requestBankTransferConfirmation.'
      );
      throw new HttpsError('invalid-argument', '振込名義が指定されていません。');
    }

    // const db = admin.firestore();

    try {
      // 3. users/{uid} ドキュメントからユーザー情報を取得
      const userDocRef = db.collection('users').doc(userId);
      const userDocSnap = await userDocRef.get();

      if (!userDocSnap.exists) {
        logger.error(
          `User document not found for user: ${userId} in requestBankTransferConfirmation.`
        );
        throw new HttpsError('not-found', 'ユーザー情報が見つかりません。');
      }
      const userData = userDocSnap.data();
      const userDisplayName =
        userData?.displayName || request.auth.token.name || userData?.email || '不明なユーザー';
      const userEmail = userData?.email || request.auth.token.email;

      if (!userEmail) {
        logger.error(`User ${userId} does not have an email address.`);
        // メールアドレスは必須ではないかもしれないが、管理者への通知等で利用する可能性を考慮
      }

      // 4. users/{uid}/bankPaymentInfo からプランIDと金額を取得
      const currentBankPaymentInfo = userData?.bankPaymentInfo;
      let determinedRequestType: 'initial' | 'renewal';

      if (currentBankPaymentInfo?.status === 'payment_requested') {
        determinedRequestType = 'initial';
      } else if (currentBankPaymentInfo?.status === 'renewal_requested') {
        determinedRequestType = 'renewal';
      } else {
        logger.error(
          `User ${userId} bankPaymentInfo.status is '${currentBankPaymentInfo?.status}', which is not 'payment_requested' or 'renewal_requested'.`
        );
        throw new HttpsError(
          'failed-precondition',
          '振込完了連絡の対象となる有効な申込情報または更新情報が見つからないか、既に処理済みです。'
        );
      }

      const planId = currentBankPaymentInfo.planId;
      const amount = currentBankPaymentInfo.amount;

      if (!planId || typeof amount !== 'number') {
        logger.error(`Missing planId or amount in bankPaymentInfo for user ${userId}.`);
        throw new HttpsError('internal', '申込情報に不備があります。');
      }

      // 5. bankTransferRequests コレクションに新しいドキュメントを作成
      const bankTransferRequestsRef = db.collection('bankTransferRequests');
      await bankTransferRequestsRef.add({
        uid: userId,
        userDisplayName,
        userEmail,
        transferName: transferName.trim(), // 入力された振込名義
        planId,
        planName: currentBankPaymentInfo.planName ?? '',
        amount,
        baseAmount: currentBankPaymentInfo.baseAmount ?? amount,
        feeAmount: currentBankPaymentInfo.feeAmount ?? 0,
        discountAmount: currentBankPaymentInfo.discountAmount ?? 0,
        totalAmount: currentBankPaymentInfo.totalAmount ?? amount,
        firstMonthDiscountApplied: Boolean(currentBankPaymentInfo.firstMonthDiscountApplied),
        requestedAt: admin.firestore.FieldValue.serverTimestamp(), // 確認リクエスト日時
        status: 'pending_confirmation',
        requestType: determinedRequestType,
        originalRequestedAt: currentBankPaymentInfo.requestedAt, // 元の申込日時も記録しておくと便利
      });

      // 6. users/{uid}/bankPaymentInfo の status を 'pending_confirmation' に更新し、transferNameReported を記録
      await userDocRef.update({
        'bankPaymentInfo.status': 'pending_confirmation',
        'bankPaymentInfo.transferNameReported': transferName.trim(),
        'bankPaymentInfo.confirmationRequestedAt': admin.firestore.FieldValue.serverTimestamp(), // 確認リクエスト日時も記録
        'bankPaymentInfo.rejectionReason': admin.firestore.FieldValue.delete(),
        'bankPaymentInfo.rejectedAt': admin.firestore.FieldValue.delete(),
        'bankPaymentInfo.rejectedRequestId': admin.firestore.FieldValue.delete(),
        applyMailchimpTag: getMailchimpTag('bankPendingConfirmation'),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Bank transfer confirmation request successfully processed for user ${userId}. Transfer Name: ${transferName}`
      );
      return {
        success: true,
        message: '振込完了の確認リクエストを受け付けました。確認が完了次第、ご連絡いたします。',
        bankPaymentInfo: {
          status: 'pending_confirmation',
        },
      };
    } catch (error: any) {
      logger.error(`Error processing bank transfer confirmation for user ${userId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        '振込完了確認リクエストの処理中にエラーが発生しました。',
        error.message
      );
    }
  }
);

// 入金前の銀行振込申込みをユーザー自身がキャンセルする
export const cancelBankTransferPayment = onCall({ region: 'asia-northeast1' }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    logger.error('User not authenticated for cancelBankTransferPayment');
    throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
  }

  const userId = request.auth.uid;
  const userDocRef = db.collection('users').doc(userId);

  try {
    let canceledBankPaymentInfo: { status: 'payment_canceled' } | null = null;

    await db.runTransaction(async (transaction) => {
      const userDocSnap = await transaction.get(userDocRef);

      if (!userDocSnap.exists) {
        logger.error(`User document not found for user: ${userId} in cancelBankTransferPayment.`);
        throw new HttpsError('not-found', 'ユーザー情報が見つかりません。');
      }

      const currentBankPaymentInfo = userDocSnap.data()?.bankPaymentInfo;
      const currentFirstMonthDiscount = userDocSnap.data()?.firstMonthDiscount;
      if (currentBankPaymentInfo?.status !== 'payment_requested') {
        logger.error(
          `User ${userId} bankPaymentInfo.status is '${currentBankPaymentInfo?.status}', which cannot be canceled by user.`
        );
        throw new HttpsError(
          'failed-precondition',
          'キャンセル可能な銀行振込のお申込みが見つかりません。'
        );
      }

      canceledBankPaymentInfo = { status: 'payment_canceled' };

      const updateData: any = {
        'bankPaymentInfo.status': 'payment_canceled',
        'bankPaymentInfo.canceledAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const referralCreditAppliedAmount =
        typeof currentBankPaymentInfo.referralCreditAppliedAmount === 'number'
          ? Math.max(0, currentBankPaymentInfo.referralCreditAppliedAmount)
          : 0;
      if (referralCreditAppliedAmount > 0) {
        updateData['referralCredit.bankAvailableAmount'] = admin.firestore.FieldValue.increment(
          referralCreditAppliedAmount
        );
        updateData['referralCredit.consumedAmount'] = admin.firestore.FieldValue.increment(
          -referralCreditAppliedAmount
        );
        updateData['referralCredit.updatedAt'] = admin.firestore.FieldValue.serverTimestamp();
      }
      const discountExpiresAt = currentFirstMonthDiscount?.expiresAt as
        | admin.firestore.Timestamp
        | undefined;
      if (
        currentBankPaymentInfo.firstMonthDiscountApplied &&
        currentFirstMonthDiscount?.status === 'redeemed' &&
        currentFirstMonthDiscount?.checkoutSessionId === 'bank_transfer' &&
        discountExpiresAt
      ) {
        const isExpired = discountExpiresAt.toMillis() <= Date.now();
        updateData['firstMonthDiscount.status'] = isExpired ? 'expired' : 'eligible';
        updateData['firstMonthDiscount.redeemedAt'] = admin.firestore.FieldValue.delete();
        updateData['firstMonthDiscount.checkoutSessionId'] = admin.firestore.FieldValue.delete();
        updateData['firstMonthDiscount.amountOff'] = admin.firestore.FieldValue.delete();
        updateData['firstMonthDiscount.appliedPlanId'] = admin.firestore.FieldValue.delete();
      }

      transaction.update(userDocRef, updateData);
    });

    logger.info(`Bank transfer payment canceled by user ${userId}.`);
    return {
      success: true,
      message: '銀行振込のお申込みをキャンセルしました。',
      bankPaymentInfo: canceledBankPaymentInfo,
    };
  } catch (error: any) {
    logger.error(`Error canceling bank transfer payment for user ${userId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      'internal',
      '銀行振込のお申込みキャンセル中にエラーが発生しました。',
      error.message
    );
  }
});

// 振込確認リクエスト対象データを承認 メール送信とプランデータを作成しbankPaymentInfo.status:'active'
export const approveBankTransferPayment = onCall(
  { region: 'asia-northeast1', secrets: [stripeSecretKey] },
  async (request) => {
    // 1. 認証および管理者権限チェック
    const adminId = await assertBankTransferAdmin(request, 'approveBankTransferPayment');

    // 2. リクエストデータから requestId を取得
    const { requestId } = request.data as { requestId: string };
    if (!requestId) {
      logger.error('requestId is missing in the request data for approveBankTransferPayment.');
      throw new HttpsError('invalid-argument', 'リクエストIDが指定されていません。');
    }

    //const db = admin.firestore();
    const bankRequestRef = db.collection('bankTransferRequests').doc(requestId);

    try {
      const approvedBankRequestData: admin.firestore.DocumentData = await db.runTransaction(
        async (transaction) => {
          const bankRequestDoc = await transaction.get(bankRequestRef);
          if (!bankRequestDoc.exists) {
            logger.error(`Bank transfer request document not found: ${requestId}`);
            throw new HttpsError(
              'not-found',
              `指定された振込リクエスト (ID: ${requestId}) が見つかりません。`
            );
          }

          const bankRequestData = bankRequestDoc.data();
          if (!bankRequestData) {
            logger.error(`Bank transfer request data is empty for: ${requestId}`);
            throw new HttpsError(
              'internal',
              `振込リクエスト (ID: ${requestId}) のデータ取得に失敗しました。`
            );
          }

          // 既に処理済みか、または承認待ちでない場合はエラー
          if (bankRequestData.status === 'confirmed') {
            logger.info(`Bank transfer request ${requestId} is already confirmed.`);
            throw new HttpsError('already-exists', 'この振込リクエストは既に承認済みです。');
          }
          if (
            bankRequestData.status !== 'pending_confirmation' &&
            bankRequestData.status !== 'renewal_pending_confirmation'
          ) {
            throw new HttpsError(
              'failed-precondition',
              `この振込リクエスト (ID: ${requestId}) は承認待ちの状態ではありません (現在の状態: ${bankRequestData.status})。`
            );
          }

          const userId = bankRequestData.uid;
          const userEmail = bankRequestData.userEmail; // メール送信に必要

          if (!userId) {
            logger.error(`uid is missing in bankTransferRequest ${requestId}.`);
            throw new HttpsError('internal', 'リクエストデータにユーザーIDが含まれていません。');
          }
          if (!userEmail) {
            logger.warn(
              `userEmail is missing in bankTransferRequest ${requestId}. Cannot send notification email.`
            );
            // メール送信はスキップされるが、処理は続行する（要件による）
          }

          const userRef = db.collection('users').doc(userId);

          // プラン詳細を取得 (期間など)
          const requestedPlanId = bankRequestData.planId;
          const planDetails = BANK_TRANSFER_PLANS[requestedPlanId];
          if (!planDetails) {
            // このエラーはトランザクションの外で早期にキャッチされるべきだが、念のため
            logger.error(
              `Plan details not found for planId: ${requestedPlanId} within transaction.`
            );
            throw new HttpsError('internal', `Plan details for ${requestedPlanId} not found.`);
          }
          const planDurationMonths = planDetails.durationMonths || 6; // プラン定義から期間を取得、なければデフォルト6ヶ月

          // サブスクリプション期間の計算
          const now = admin.firestore.Timestamp.now();
          let newCurrentPeriodStartDate: Date;
          let newCurrentPeriodEndDate: Date;

          if (bankRequestData.requestType === 'renewal') {
            const existingUserDoc = await transaction.get(userRef); // トランザクション内でユーザーデータを取得
            if (!existingUserDoc.exists) {
              logger.error(`User document not found for uid: ${userId} during renewal approval.`);
              throw new HttpsError('not-found', `User document for uid ${userId} not found.`);
            }
            const existingUserData = existingUserDoc.data();
            const existingCurrentPeriodEndTimestamp = existingUserData?.currentPeriodEnd as
              | admin.firestore.Timestamp
              | undefined;

            if (
              existingCurrentPeriodEndTimestamp &&
              existingCurrentPeriodEndTimestamp.toDate() > now.toDate()
            ) {
              // 既存の有効期限が未来の場合：既存の有効期限の翌日を開始日とする
              newCurrentPeriodStartDate = new Date(existingCurrentPeriodEndTimestamp.toDate());
              newCurrentPeriodStartDate.setDate(newCurrentPeriodStartDate.getDate() + 1);
            } else {
              // 既存の有効期限がない、または過去の場合：今日を開始日とする
              newCurrentPeriodStartDate = now.toDate();
              logger.warn(
                `Renewal for user ${userId} but existing currentPeriodEnd is past or missing. Starting new period from now.`
              );
            }
            newCurrentPeriodEndDate = new Date(newCurrentPeriodStartDate);
            newCurrentPeriodEndDate.setMonth(
              newCurrentPeriodEndDate.getMonth() + planDurationMonths
            );
          } else {
            // initial (初回申込)
            newCurrentPeriodStartDate = now.toDate();
            newCurrentPeriodEndDate = new Date(newCurrentPeriodStartDate);
            newCurrentPeriodEndDate.setMonth(
              newCurrentPeriodEndDate.getMonth() + planDurationMonths
            );
          }
          const currentPeriodStart = admin.firestore.Timestamp.fromDate(newCurrentPeriodStartDate);
          const currentPeriodEnd = admin.firestore.Timestamp.fromDate(newCurrentPeriodEndDate);

          // bankTransferRequests の更新
          transaction.update(bankRequestRef, {
            status: 'confirmed',
            confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            confirmedBy: adminId, // どの管理者が承認したか記録 (任意)
          });

          // users の更新
          transaction.update(userRef, {
            appPlanId: requestedPlanId, // 承認されたプランID
            // stripePriceId: 'bank_half_yearly', // 銀行振込の場合、このフィールドはStripe用なので通常は不要
            subscriptionStatus: 'active',
            applyMailchimpTag: getMailchimpTag('subscribedBank'),
            currentPeriodStart,
            currentPeriodEnd,
            'bankPaymentInfo.status': 'active',
            'bankPaymentInfo.confirmedAt': admin.firestore.FieldValue.serverTimestamp(),
            'bankPaymentInfo.planActivatedAt': admin.firestore.FieldValue.serverTimestamp(),
            cancelAtPeriodEnd: false,
            canceledAt: admin.firestore.FieldValue.delete(), // nullの代わりにdeleteを使用
            endedAt: admin.firestore.FieldValue.delete(), // nullの代わりにdeleteを使用
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }); // ユーザーの他の情報を保持しつつ更新

          // メール送信処理はトランザクション成功後に行う
          return {
            ...bankRequestData,
            uid: userId,
            planId: requestedPlanId,
            currentPeriodStart,
            currentPeriodEnd,
          };
        }
      );

      // トランザクション成功後にメール送信
      if (approvedBankRequestData.uid) {
        try {
          const stripe = initializeStripeSDK();
          await qualifyReferralSubscription({
            referredUid: approvedBankRequestData.uid,
            source: 'bank',
            stripe,
          });
        } catch (error) {
          logger.error('Failed to qualify referral subscription for bank transfer approval.', {
            uid: approvedBankRequestData.uid,
            requestId,
            ...getErrorLogFields(error),
          });
        }
      }
      if (approvedBankRequestData.userEmail) {
        const userEmail = approvedBankRequestData.userEmail;
        const userDisplayName = approvedBankRequestData.userDisplayName || 'お客様';
        const planIdForEmail = approvedBankRequestData.planId;
        const planDetailsForEmail = BANK_TRANSFER_PLANS[planIdForEmail] || {
          name: '指定プラン',
          amount: 0,
          currency: 'JPY',
        };
        const approvalTemplateName = 'bankTransferApprovalNotification';

        const userPlanStartDate = approvedBankRequestData.currentPeriodStart?.toDate();
        const formattedStartDate = userPlanStartDate
          ? `${userPlanStartDate.getFullYear()}年${userPlanStartDate.getMonth() + 1}月${userPlanStartDate.getDate()}日`
          : 'N/A';
        const userPlanEndDate = approvedBankRequestData.currentPeriodEnd?.toDate();
        const formattedEndDate = userPlanEndDate
          ? `${userPlanEndDate.getFullYear()}年${userPlanEndDate.getMonth() + 1}月${userPlanEndDate.getDate()}日`
          : 'N/A';
        let requestType = '開始';
        if (approvedBankRequestData.requestType === 'renewal') {
          requestType = '更新';
        }

        const mailCollectionRef = db.collection('mail');
        const bcc = getAdminNotificationBcc();
        await mailCollectionRef.add({
          to: [userEmail],
          ...(bcc.length > 0 ? { bcc } : {}),
          template: {
            name: approvalTemplateName,
            data: {
              displayName: userDisplayName || 'お客様',
              serviceName: BANK_ACCOUNT_DETAILS.serviceName,
              planName: planDetailsForEmail.name,
              transferName: approvedBankRequestData.transferName || '',
              amount: (
                approvedBankRequestData.amount ??
                planDetailsForEmail.amount ??
                0
              ).toLocaleString(),
              currency: approvedBankRequestData.currency || planDetailsForEmail.currency || 'JPY',
              periodStartDate: formattedStartDate,
              periodEndDate: formattedEndDate,
              requestType,
            },
          },
        });
        logger.info(
          `Bank transfer approval email queued for user ${approvedBankRequestData.uid} (${userEmail}). Request ID: ${requestId}`,
          { templateName: approvalTemplateName }
        );
      } else {
        logger.warn(
          `Skipping bank transfer approval email for request ${requestId} due to missing email or data.`
        );
      }

      if (approvedBankRequestData.uid) {
        try {
          const planIdForMessage = approvedBankRequestData.planId;
          const planDetailsForMessage = BANK_TRANSFER_PLANS[planIdForMessage] || {
            name: '銀行振込プラン',
            amount: 0,
            currency: 'JPY',
          };
          const messageStartDate = approvedBankRequestData.currentPeriodStart?.toDate();
          const formattedMessageStartDate = messageStartDate
            ? `${messageStartDate.getFullYear()}年${messageStartDate.getMonth() + 1}月${messageStartDate.getDate()}日`
            : 'N/A';
          const messageEndDate = approvedBankRequestData.currentPeriodEnd?.toDate();
          const formattedMessageEndDate = messageEndDate
            ? `${messageEndDate.getFullYear()}年${messageEndDate.getMonth() + 1}月${messageEndDate.getDate()}日`
            : 'N/A';
          const requestTypeLabel =
            approvedBankRequestData.requestType === 'renewal' ? '更新' : '開始';

          const messageId = await createDirectMessage({
            userUid: approvedBankRequestData.uid,
            senderUid: adminId,
            senderRole: 'admin',
            body: `銀行振込の入金を確認し、プランの${requestTypeLabel}手続きが完了しました。\n\nプラン: ${planDetailsForMessage.name}\nご利用期間: ${formattedMessageStartDate} 〜 ${formattedMessageEndDate}\n\n引き続きサービスをご利用いただけます。`,
            attachments: [],
            isImportant: true,
            userEmail: approvedBankRequestData.userEmail || '',
            userDisplayName: approvedBankRequestData.userDisplayName || 'お客様',
          });
          logger.info(`Bank transfer approval message created for request ${requestId}.`, {
            uid: approvedBankRequestData.uid,
            messageId,
          });
        } catch (error) {
          logger.error('Failed to create bank transfer approval message.', {
            uid: approvedBankRequestData.uid,
            requestId,
            ...getErrorLogFields(error),
          });
        }
      }

      logger.info(
        `Bank transfer payment successfully approved for request ${requestId} by admin ${adminId}.`
      );
      return { success: true, message: '銀行振込の承認処理が完了し、プランが有効化されました。' };
    } catch (error: any) {
      logger.error(`Error approving bank transfer payment for request ${requestId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        '銀行振込の承認処理中にエラーが発生しました。',
        error.message
      );
    }
  }
);

// revertBankTransferPayment 関数の実装...
export const revertBankTransferPayment = onCall({ region: 'asia-northeast1' }, async (request) => {
  // 1. 認証および管理者権限チェック
  const adminId = await assertBankTransferAdmin(request, 'revertBankTransferPayment');

  // 2. リクエストデータから requestId と差し戻し理由を取得
  const { requestId, rejectionReason } = request.data as {
    requestId: string;
    rejectionReason?: string;
  };
  if (!requestId) {
    logger.error('requestId is missing in the request data for revertBankTransferPayment.');
    throw new HttpsError('invalid-argument', 'リクエストIDが指定されていません。');
  }
  if (typeof rejectionReason !== 'string') {
    throw new HttpsError('invalid-argument', '差し戻し理由は文字列で入力してください。');
  }
  const trimmedRejectionReason = rejectionReason.trim();
  if (!trimmedRejectionReason) {
    logger.error('rejectionReason is missing in the request data for revertBankTransferPayment.');
    throw new HttpsError('invalid-argument', '差し戻し理由を入力してください。');
  }
  if (trimmedRejectionReason.length > 1000) {
    throw new HttpsError('invalid-argument', '差し戻し理由は1000文字以内で入力してください。');
  }

  // const db = admin.firestore();
  const bankRequestRef = db.collection('bankTransferRequests').doc(requestId);

  try {
    await db.runTransaction(async (transaction) => {
      const bankRequestDoc = await transaction.get(bankRequestRef);
      if (!bankRequestDoc.exists) {
        logger.error(`Bank transfer request document not found: ${requestId}`);
        throw new HttpsError(
          'not-found',
          `指定された振込リクエスト (ID: ${requestId}) が見つかりません。`
        );
      }

      const bankRequestData = bankRequestDoc.data();
      if (!bankRequestData) {
        logger.error(`Bank transfer request data is empty for: ${requestId}`);
        throw new HttpsError(
          'internal',
          `振込リクエスト (ID: ${requestId}) のデータ取得に失敗しました。`
        );
      }

      // 差し戻し対象のステータスか確認 (例: 'pending_confirmation', 'renewal_pending_confirmation')
      if (
        bankRequestData.status !== 'pending_confirmation' &&
        bankRequestData.status !== 'renewal_pending_confirmation'
      ) {
        throw new HttpsError(
          'failed-precondition',
          `この振込リクエスト (ID: ${requestId}) は差し戻し可能な状態ではありません (現在の状態: ${bankRequestData.status})。`
        );
      }

      const userId = bankRequestData.uid;
      if (!userId) {
        logger.error(`uid is missing in bankTransferRequest ${requestId}.`);
        throw new HttpsError('internal', 'リクエストデータにユーザーIDが含まれていません。');
      }

      const userRef = db.collection('users').doc(userId);

      // bankTransferRequests の更新
      transaction.update(bankRequestRef, {
        status: 'reverted_by_admin', // 差し戻し済みステータス
        rejectionReason: trimmedRejectionReason,
        revertedAt: admin.firestore.FieldValue.serverTimestamp(),
        revertedBy: adminId,
      });

      // users の bankPaymentInfo を更新
      const targetUserStatus =
        bankRequestData.requestType === 'renewal' ? 'renewal_requested' : 'payment_requested';

      transaction.update(userRef, {
        'bankPaymentInfo.status': targetUserStatus,
        'bankPaymentInfo.rejectionReason': trimmedRejectionReason,
        'bankPaymentInfo.rejectedAt': admin.firestore.FieldValue.serverTimestamp(),
        'bankPaymentInfo.rejectedRequestId': requestId,
        'bankPaymentInfo.transferNameReported': admin.firestore.FieldValue.delete(),
        'bankPaymentInfo.confirmationRequestedAt': admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const bankRequestDocAfterTx = await bankRequestRef.get();
    const bankRequestDataAfterTx = bankRequestDocAfterTx.data();
    if (bankRequestDataAfterTx) {
      if (bankRequestDataAfterTx.userEmail) {
        const mailCollectionRef = db.collection('mail');
        const requestType = bankRequestDataAfterTx.requestType === 'renewal' ? '更新' : '開始';
        const bcc = getAdminNotificationBcc();
        await mailCollectionRef.add({
          to: [bankRequestDataAfterTx.userEmail],
          ...(bcc.length > 0 ? { bcc } : {}),
          template: {
            name: 'bankTransferRejectionNotification',
            data: {
              displayName: bankRequestDataAfterTx.userDisplayName || 'お客様',
              serviceName: BANK_ACCOUNT_DETAILS.serviceName,
              planName: bankRequestDataAfterTx.planName || '銀行振込プラン',
              transferName: bankRequestDataAfterTx.transferName || '',
              rejectionReason: trimmedRejectionReason,
              requestType,
            },
          },
        });
        logger.info(`Bank transfer rejection email queued for request ${requestId}.`, {
          requestId,
          uid: bankRequestDataAfterTx.uid,
          userEmail: bankRequestDataAfterTx.userEmail,
        });
      } else {
        logger.warn(`Skipping bank transfer rejection email for request ${requestId}.`, {
          requestId,
          uid: bankRequestDataAfterTx.uid,
          reason: 'missing userEmail',
        });
      }

      if (bankRequestDataAfterTx.uid) {
        const messageId = await createDirectMessage({
          userUid: bankRequestDataAfterTx.uid,
          senderUid: adminId,
          senderRole: 'admin',
          body: `銀行振込の確認依頼を差し戻しました。\n\n差し戻し理由:\n${trimmedRejectionReason}\n\n内容をご確認のうえ、振込名義を入力して再度確認リクエストを送信してください。`,
          attachments: [],
          isImportant: true,
          userEmail: bankRequestDataAfterTx.userEmail || '',
          userDisplayName: bankRequestDataAfterTx.userDisplayName || 'お客様',
        });
        logger.info(`Bank transfer rejection message created for request ${requestId}.`, {
          requestId,
          uid: bankRequestDataAfterTx.uid,
          messageId,
        });
      } else {
        logger.warn(`Skipping bank transfer rejection message for request ${requestId}.`, {
          requestId,
          userEmail: bankRequestDataAfterTx.userEmail,
          reason: 'missing uid',
        });
      }
    } else {
      logger.warn(`Skipping bank transfer rejection notifications for request ${requestId}.`, {
        requestId,
        reason: 'missing bankRequestDataAfterTx',
      });
    }

    logger.info(`Bank transfer request ${requestId} successfully reverted by admin ${adminId}.`);
    return { success: true, message: '振込リクエストの差し戻し処理が完了しました。' };
  } catch (error: any) {
    logger.error(`Error reverting bank transfer request ${requestId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      'internal',
      '振込リクエストの差し戻し処理中にエラーが発生しました。',
      error.message
    );
  }
});
