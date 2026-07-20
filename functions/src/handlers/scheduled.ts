// functions/src/handlers/scheduled.ts
import admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  BANK_ACCOUNT_DETAILS,
  BANK_TRANSFER_PLANS,
  DAYS_BEFORE_EXPIRATION_FOR_RENEWAL_NOTICE,
  getAdminNotificationBcc,
  RENEWAL_PLAN_ID_BANK,
} from '../config';
import { getBankTransferFeeAmount } from '../firstMonthDiscount';
import { getMailchimpTag } from '../mailchimpTag';
import { db } from '../utils';

// プランの最終日までに入金されなかったものをキャンセルに
export const processExpiredBankTransferSubscriptions = onSchedule(
  { schedule: 'every day 10:00', region: 'asia-northeast1' },
  async (_event: any) => {
    logger.info('Scheduled function processExpiredBankTransferSubscriptions started.', {
      structuredData: true,
    });

    // const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef
        .where('appPlanId', '==', RENEWAL_PLAN_ID_BANK) // RENEWAL_PLAN_ID_BANK は sendBankTransferRenewalNotices で定義されたものと同じ
        .where('bankPaymentInfo.status', 'in', [
          'renewal_requested',
          'renewal_pending_confirmation',
        ])
        .where('currentPeriodEnd', '<', now) // currentPeriodEnd が現在時刻より過去
        .get();

      if (snapshot.empty) {
        logger.info('No users found for bank transfer expiration processing today.', {
          structuredData: true,
        });
        return;
      }

      const promises = snapshot.docs.map(async (doc) => {
        const user = doc.data();
        const userId = doc.id;
        const periodEndDate = user.currentPeriodEnd.toDate();

        // 1. Firestore Update
        await db
          .collection('users')
          .doc(userId)
          .set(
            {
              subscriptionStatus: 'expired',
              applyMailchimpTag: getMailchimpTag('cancelled'),
              bankPaymentInfo: {
                ...(user.bankPaymentInfo || {}), // 既存のbankPaymentInfoを保持しつつstatusを上書き
                status: 'payment_expired',
              },
              endedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        // 2. Email Sending (via Trigger Email Extension) - Optional
        if (user.email) {
          const bcc = getAdminNotificationBcc();
          await db.collection('mail').add({
            to: [user.email],
            ...(bcc.length > 0 ? { bcc } : {}),
            template: {
              name: 'bankPlanExpiredNotification', // 事前に作成したTrigger Emailのテンプレート名
              data: {
                displayName: user.displayName || 'お客様',
                serviceName: BANK_ACCOUNT_DETAILS.serviceName, // BANK_ACCOUNT_DETAILS が利用可能である前提
                planName:
                  user.bankPaymentInfo?.planName ||
                  BANK_TRANSFER_PLANS[RENEWAL_PLAN_ID_BANK]?.name ||
                  '登録プラン',
                periodEndDate: `${periodEndDate.getFullYear()}年${periodEndDate.getMonth() + 1}月${periodEndDate.getDate()}日`,
                reason: 'ご入金期限が過ぎたため、プランが失効しました。', // 失効理由
              },
            },
          });
          logger.info(`Plan expiration email queued for user ${userId} (${user.email}).`);
        } else {
          logger.warn(`User ${userId} has no email, skipping plan expiration notice.`);
        }
      });

      await Promise.all(promises);
      logger.info(`Successfully processed ${promises.length} users for plan expiration.`);
    } catch (error) {
      logger.error('Error in processExpiredBankTransferSubscriptions scheduled function: ', error);
    }
  }
);

// 初回申込みで期日入金されなかったものをキャンセルに
export const processMissedBankTransferPayments = onSchedule(
  { schedule: 'every day 11:00', region: 'asia-northeast1' },
  async (_event) => {
    logger.info('Scheduled function processMissedBankTransferPayments started.', {
      structuredData: true,
    });

    // const db = admin.firestore();
    const now = admin.firestore.Timestamp.now(); // 現在時刻のTimestamp

    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef
        .where('bankPaymentInfo.planId', '==', RENEWAL_PLAN_ID_BANK) // 銀行振込プランID (既存の定数を利用)
        .where('bankPaymentInfo.status', '==', 'payment_requested')
        .where('bankPaymentInfo.paymentDeadline', '<', now) // paymentDeadline が現在時刻より過去
        .get();

      if (snapshot.empty) {
        logger.info('No users found for missed bank transfer payment processing today.', {
          structuredData: true,
        });
        return;
      }

      const promises = snapshot.docs.map(async (doc) => {
        const user = doc.data();
        const userId = doc.id;

        // 1. Firestore Update
        await db
          .collection('users')
          .doc(userId)
          .set(
            {
              bankPaymentInfo: {
                ...(user.bankPaymentInfo || {}), // 既存のbankPaymentInfoを保持しつつstatusを上書き
                status: 'payment_failed', // 支払い失敗ステータスに更新
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        // 2. Email Sending (via Trigger Email Extension)
        if (user.email) {
          const bcc = getAdminNotificationBcc();
          await db.collection('mail').add({
            to: [user.email],
            ...(bcc.length > 0 ? { bcc } : {}),
            template: {
              name: 'bankPaymentDeadlineMissedNotification', // 事前に作成したTrigger Emailのテンプレート名
              data: {
                displayName: user.displayName || 'お客様',
                serviceName: BANK_ACCOUNT_DETAILS.serviceName,
                planName:
                  user.bankPaymentInfo?.planName ||
                  BANK_TRANSFER_PLANS[RENEWAL_PLAN_ID_BANK]?.name ||
                  'お申込みプラン',
                reason:
                  'お振込み期限が過ぎたため、お申込みはキャンセルされました。再度お手続きをご希望の場合は、改めてプラン選択ページよりお申込みください。',
              },
            },
          });
          logger.info(
            `Payment deadline missed notification email queued for user ${userId} (${user.email}).`
          );
        } else {
          logger.warn(`User ${userId} has no email, skipping payment deadline missed notice.`);
        }
      });

      await Promise.all(promises);
      logger.info(
        `Successfully processed ${promises.length} users for missed bank transfer payments.`
      );
    } catch (error) {
      logger.error('Error in processMissedBankTransferPayments scheduled function: ', error);
    }
  }
);

// Renewal対象を検索しRenewalNoticeメールを送信、bankPaymentInfo.statusを'renewal_requested'に変更
export const sendBankTransferRenewalNotices = onSchedule(
  { schedule: 'every day 09:00', region: 'asia-northeast1' },
  async (_event: any) => {
    logger.info('Scheduled function sendBankTransferRenewalNotices started.', {
      structuredData: true,
    });

    // const db = admin.firestore();
    const now = new Date();
    const targetEndDate = new Date(now);
    targetEndDate.setDate(now.getDate() + DAYS_BEFORE_EXPIRATION_FOR_RENEWAL_NOTICE);
    logger.info(`targetEnDate: ${targetEndDate.toISOString()}`);

    // FirestoreのTimestamp型で比較するために、日付の開始と終了を設定
    const targetEndDateStart = new Date(targetEndDate);
    targetEndDateStart.setHours(0, 0, 0, 0);
    const targetEndDateEnd = new Date(targetEndDate);
    targetEndDateEnd.setHours(23, 59, 59, 999);

    const firestoreTargetStart = admin.firestore.Timestamp.fromDate(targetEndDateStart);
    const firestoreTargetEnd = admin.firestore.Timestamp.fromDate(targetEndDateEnd);

    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef
        .where('appPlanId', '==', RENEWAL_PLAN_ID_BANK)
        .where('subscriptionStatus', '==', 'active')
        .where('bankPaymentInfo.status', '==', 'active')
        .where('currentPeriodEnd', '>=', firestoreTargetStart)
        .where('currentPeriodEnd', '<=', firestoreTargetEnd)
        .get();

      if (snapshot.empty) {
        logger.info('No users found for bank transfer renewal notice today.', {
          structuredData: true,
        });
        return;
      }

      const renewalPlanDetails = BANK_TRANSFER_PLANS[RENEWAL_PLAN_ID_BANK];
      if (!renewalPlanDetails) {
        logger.error(`Renewal plan details not found for planId: ${RENEWAL_PLAN_ID_BANK}`);
        return;
      }
      //const renewalAmount = renewalPlanDetails.amount;
      const bankTransferFeeAmount = await getBankTransferFeeAmount();
      logger.info(`Renewal count: ${snapshot.docs.length}`);

      const promises = snapshot.docs.map(async (doc) => {
        const user = doc.data();
        const userId = doc.id;

        if (!user.email) {
          logger.warn(`User ${userId} has no email, skipping renewal notice.`);
          return;
        }

        const paymentDeadline = doc.data().currentPeriodEnd.toDate();
        const formattedPaymentDeadline = `${paymentDeadline.getFullYear()}年${paymentDeadline.getMonth() + 1}月${paymentDeadline.getDate()}日`;
        const bankPaymentInfo = doc.data().bankPaymentInfo ?? {};
        const renewalAmount = bankPaymentInfo.baseAmount ?? bankPaymentInfo.amount;
        if (typeof renewalAmount !== 'number' || !Number.isFinite(renewalAmount)) {
          logger.warn(
            `User ${userId} has no valid bank renewal amount, skipping renewal notice.`
          );
          return;
        }

        // 1. Firestore Update
        await db
          .collection('users')
          .doc(userId)
          .set(
            {
              bankPaymentInfo: {
                status: 'renewal_requested',
                requestedAt: admin.firestore.FieldValue.serverTimestamp(),
                renewalAmount,
                paymentDeadline: admin.firestore.Timestamp.fromDate(paymentDeadline),
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        const bcc = getAdminNotificationBcc();
        // 2. Email Sending (via Trigger Email Extension)
        await db.collection('mail').add({
          to: [user.email],
          ...(bcc.length > 0 ? { bcc } : {}),
          template: {
            name: 'bankRenewalNotification', // 事前に作成したTrigger Emailのテンプレート名
            data: {
              displayName: user.displayName || 'お客様',
              serviceName: BANK_ACCOUNT_DETAILS.serviceName,
              planName: renewalPlanDetails.name,
              renewalAmount: renewalAmount.toLocaleString(), // 金額をフォーマット
              bankTransferFee: bankTransferFeeAmount.toLocaleString(),
              totalAmount: (renewalAmount + bankTransferFeeAmount).toLocaleString(), // 合計金額をフォーマット
              paymentDeadline: formattedPaymentDeadline,
              bankName: BANK_ACCOUNT_DETAILS.bankName,
              branchName: BANK_ACCOUNT_DETAILS.branchName,
              accountType: BANK_ACCOUNT_DETAILS.accountType,
              accountNumber: BANK_ACCOUNT_DETAILS.accountNumber,
              accountHolder: BANK_ACCOUNT_DETAILS.accountHolder,
              transferReferenceNote: BANK_ACCOUNT_DETAILS.transferReferenceNote, // 振込名義に関する注意書きなど
            },
          },
        });
        logger.info(`Renewal notice email queued for user ${userId} (${user.email}).`);
      });

      await Promise.all(promises);
      logger.info(`Successfully processed ${promises.length} users for renewal notices.`);
    } catch (error) {
      logger.error('Error in sendBankTransferRenewalNotices scheduled function: ', error);
    }
  }
);
