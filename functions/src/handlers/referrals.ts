import admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { appBaseUrlConfig, getAdminNotificationBcc, stripeSecretKey } from '../config';
import { db, initializeStripeSDK } from '../utils';

const DEFAULT_MONTHLY_REWARD_AMOUNT = 1280;
const DEFAULT_MONTHLY_GRANT_LIMIT_MONTHS = 3;
const REFERRAL_CODE_PREFIX = 'TORAI';
const LIFETIME_COUPON_ID = 'torai_referral_lifetime_50_percent';
const LIFETIME_GRANT_STALE_AFTER_MS = 15 * 60 * 1000;

type ReferralRewardKind = 'subscription_credit' | 'lifetime_50_percent' | 'lifetime_free';

type ReferralMilestone = {
  threshold: number;
  rewardMonths: number;
  kind: ReferralRewardKind;
  label: string;
};

const DEFAULT_MILESTONES: ReferralMilestone[] = [
  { threshold: 1, rewardMonths: 1, kind: 'subscription_credit', label: '1人紹介: 1ヶ月無料' },
  { threshold: 5, rewardMonths: 3, kind: 'subscription_credit', label: '5人紹介: 追加3ヶ月無料' },
  { threshold: 10, rewardMonths: 6, kind: 'subscription_credit', label: '10人紹介: 追加6ヶ月無料' },
  { threshold: 30, rewardMonths: 12, kind: 'subscription_credit', label: '30人紹介: 1年無料' },
  { threshold: 50, rewardMonths: 0, kind: 'lifetime_50_percent', label: '50人紹介: 永久50%オフ' },
  {
    threshold: 100,
    rewardMonths: 0,
    kind: 'lifetime_free',
    label: '100人紹介: 次回更新から永遠無料',
  },
];

type ReferralConfig = {
  monthlyRewardAmount: number;
  monthlyGrantLimitMonths: number;
  milestones: ReferralMilestone[];
};

type PreparedReferralGrant = {
  grantMonths: number;
  grantAmount: number;
  grantDestination: 'stripe_customer_balance' | 'bank_credit';
  idempotencyKey: string;
  previousStatus: string;
  usageRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  usageMonthKey: string;
  countsAgainstCurrentAvailable: boolean;
};

function assertAuthenticated(request: any): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
  }
  return request.auth.uid;
}

function normalizeReferralCode(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', '紹介コードが指定されていません。');
  }
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (!normalized || normalized.length > 40) {
    throw new HttpsError('invalid-argument', '紹介コードが不正です。');
  }
  return normalized;
}

function valueToString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isJapaneseReferralUser(data: FirebaseFirestore.DocumentData | undefined): boolean {
  const preferredLanguage = valueToString(data?.preferredLanguage);
  return preferredLanguage === null || preferredLanguage === 'ja';
}

function getErrorLogFields(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

function getDefaultReferralCode(uid: string): string {
  return `${REFERRAL_CODE_PREFIX}-${uid.slice(0, 10).toUpperCase()}`;
}

function timestampToIso(value: unknown): string | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  return null;
}

function timestampToMillis(value: unknown): number | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toMillis();
  }
  return null;
}

function getMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeMilestones(value: unknown): ReferralMilestone[] {
  if (!Array.isArray(value)) {
    return DEFAULT_MILESTONES;
  }

  const milestones = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const data = item as Record<string, unknown>;
      const threshold = typeof data.threshold === 'number' ? Math.floor(data.threshold) : 0;
      const rewardMonths =
        typeof data.rewardMonths === 'number' ? Math.max(0, Math.floor(data.rewardMonths)) : 0;
      const kind =
        data.kind === 'lifetime_50_percent' || data.kind === 'lifetime_free'
          ? data.kind
          : 'subscription_credit';
      const label =
        typeof data.label === 'string' && data.label.trim()
          ? data.label.trim()
          : `${threshold}人紹介`;
      if (threshold <= 0) {
        return null;
      }
      return { threshold, rewardMonths, kind, label };
    })
    .filter((item): item is ReferralMilestone => Boolean(item))
    .sort((a, b) => a.threshold - b.threshold);

  if (milestones.length === 0) {
    return DEFAULT_MILESTONES;
  }

  const hasLifetime50At50 = milestones.some(
    (milestone) => milestone.threshold === 50 && milestone.kind === 'lifetime_50_percent'
  );
  const hasLifetimeFreeAt100 = milestones.some(
    (milestone) => milestone.threshold === 100 && milestone.kind === 'lifetime_free'
  );
  const hasLegacyLifetime50At100 = milestones.some(
    (milestone) => milestone.threshold === 100 && milestone.kind === 'lifetime_50_percent'
  );
  if (hasLegacyLifetime50At100 && !hasLifetime50At50 && !hasLifetimeFreeAt100) {
    const upgradedMilestones: ReferralMilestone[] = [
      ...milestones.filter(
        (milestone) => !(milestone.threshold === 100 && milestone.kind === 'lifetime_50_percent')
      ),
      {
        threshold: 50,
        rewardMonths: 0,
        kind: 'lifetime_50_percent',
        label: '50人紹介: 永久50%オフ',
      },
      {
        threshold: 100,
        rewardMonths: 0,
        kind: 'lifetime_free',
        label: '100人紹介: 次回更新から永遠無料',
      },
    ];
    return upgradedMilestones.sort((a, b) => a.threshold - b.threshold);
  }

  return milestones;
}

async function getReferralConfig(): Promise<ReferralConfig> {
  const snap = await db.collection('referralConfig').doc('default').get();
  const data = snap.data() || {};
  const monthlyRewardAmount =
    typeof data.monthlyRewardAmount === 'number' && data.monthlyRewardAmount > 0
      ? Math.floor(data.monthlyRewardAmount)
      : DEFAULT_MONTHLY_REWARD_AMOUNT;
  const monthlyGrantLimitMonths =
    typeof data.monthlyGrantLimitMonths === 'number' && data.monthlyGrantLimitMonths > 0
      ? Math.floor(data.monthlyGrantLimitMonths)
      : DEFAULT_MONTHLY_GRANT_LIMIT_MONTHS;

  return {
    monthlyRewardAmount,
    monthlyGrantLimitMonths,
    milestones: normalizeMilestones(data.milestones),
  };
}

async function compensateStripeReferralGrant(args: {
  stripe: Stripe;
  stripeCustomerId: string;
  referrerUid: string;
  rewardId: string;
  grant: PreparedReferralGrant;
  stripeBalanceTransactionId: string;
  error: unknown;
}): Promise<string> {
  const {
    stripe,
    stripeCustomerId,
    referrerUid,
    rewardId,
    grant,
    stripeBalanceTransactionId,
    error,
  } = args;
  const compensationIdempotencyKey = `${grant.idempotencyKey}_compensation`;
  logger.error('Firestore referral grant completion failed after Stripe credit was created.', {
    referrerUid,
    rewardId,
    stripeBalanceTransactionId,
    compensationIdempotencyKey,
    ...getErrorLogFields(error),
  });
  const transaction = await stripe.customers.createBalanceTransaction(
    stripeCustomerId,
    {
      amount: grant.grantAmount,
      currency: 'jpy',
      description: `虎威 紹介報酬 相殺 ${grant.grantMonths}ヶ月分`,
      metadata: {
        referrerUid,
        rewardId,
        source: 'torai_referral_compensation',
        originalBalanceTransactionId: stripeBalanceTransactionId,
      },
    },
    {
      idempotencyKey: compensationIdempotencyKey,
    }
  );
  logger.warn('Compensating Stripe balance transaction created for referral grant.', {
    referrerUid,
    rewardId,
    stripeBalanceTransactionId,
    compensatingStripeBalanceTransactionId: transaction.id,
  });
  return transaction.id;
}

async function rollbackPreparedReferralGrant(args: {
  rewardRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  referrerUid: string;
  rewardId: string;
  grant: PreparedReferralGrant;
  stripeBalanceTransactionId: string;
  compensatingStripeBalanceTransactionId: string;
  error: unknown;
}) {
  const {
    rewardRef,
    referrerUid,
    rewardId,
    grant,
    stripeBalanceTransactionId,
    compensatingStripeBalanceTransactionId,
    error,
  } = args;
  const batch = db.batch();
  batch.set(
    rewardRef,
    {
      status: grant.previousStatus,
      referralGrantError:
        error instanceof Error
          ? `Stripe grant compensated after Firestore completion failed: ${error.message}`
          : 'Stripe grant compensated after Firestore completion failed.',
      stripeBalanceTransactionIds: admin.firestore.FieldValue.arrayUnion(
        stripeBalanceTransactionId
      ),
      stripeCompensatingBalanceTransactionIds: admin.firestore.FieldValue.arrayUnion(
        compensatingStripeBalanceTransactionId
      ),
      grantingMonthKey: admin.firestore.FieldValue.delete(),
      grantingMonths: admin.firestore.FieldValue.delete(),
      grantingAmount: admin.firestore.FieldValue.delete(),
      grantingIdempotencyKey: admin.firestore.FieldValue.delete(),
      previousStatus: admin.firestore.FieldValue.delete(),
      grantingAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      attemptCount: admin.firestore.FieldValue.increment(1),
    },
    { merge: true }
  );
  batch.set(
    grant.usageRef,
    {
      grantingMonths: admin.firestore.FieldValue.increment(-grant.grantMonths),
      grantingAmount: admin.firestore.FieldValue.increment(-grant.grantAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
  logger.warn('Rolled back prepared referral grant after Stripe compensation.', {
    referrerUid,
    rewardId,
    stripeBalanceTransactionId,
    compensatingStripeBalanceTransactionId,
  });
}

async function ensureReferralCode(uid: string): Promise<string> {
  const summaryRef = db.collection('referralSummaries').doc(uid);

  const code = await db.runTransaction(async (transaction) => {
    const freshSummary = await transaction.get(summaryRef);
    const existingCode = freshSummary.data()?.referralCode;
    const determinedCode =
      typeof existingCode === 'string' && existingCode ? existingCode : getDefaultReferralCode(uid);
    const codeRef = db.collection('referralCodes').doc(determinedCode);
    const freshCode = await transaction.get(codeRef);
    if (freshCode.exists && freshCode.data()?.uid !== uid) {
      throw new HttpsError('already-exists', '紹介コードが重複しています。');
    }

    transaction.set(
      summaryRef,
      {
        uid,
        referralCode: determinedCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(freshSummary.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );
    transaction.set(
      codeRef,
      {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return determinedCode;
  });

  return code;
}

function getLifetimeDiscountPercent(kind: ReferralRewardKind): number | null {
  if (kind === 'lifetime_50_percent') {
    return 50;
  }
  if (kind === 'lifetime_free') {
    return 100;
  }
  return null;
}

function isLifetimeRewardAlreadyApplied(
  referrerData: FirebaseFirestore.DocumentData | undefined,
  percentOff: number
): boolean {
  if (!referrerData) {
    return false;
  }
  const referral =
    referrerData.referral && typeof referrerData.referral === 'object'
      ? (referrerData.referral as Record<string, unknown>)
      : {};
  const appliedPercent =
    typeof referral.lifetimeDiscountPercent === 'number' ? referral.lifetimeDiscountPercent : 0;
  if (appliedPercent < percentOff || referral.lifetimeDiscountStatus !== 'applied') {
    return false;
  }

  if (percentOff >= 100) {
    return referrerData.appPlanId === 'lifetime' && referrerData.subscriptionStatus === 'active';
  }

  return true;
}

async function ensureLifetimeCoupon(stripe: Stripe, percentOff = 50) {
  const couponId = LIFETIME_COUPON_ID;
  let shouldUseDeterministicCouponId = true;
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    if (!coupon.deleted) {
      return coupon;
    }
    shouldUseDeterministicCouponId = false;
  } catch (_error) {
    // Create below when the deterministic coupon does not exist.
  }

  const fallbackCouponKey = String(percentOff);
  const configRef = db.collection('referralConfig').doc('default');
  if (!shouldUseDeterministicCouponId) {
    const configSnap = await configRef.get();
    const fallbackCouponId = configSnap.data()?.lifetimeCouponIds?.[fallbackCouponKey];
    if (typeof fallbackCouponId === 'string' && fallbackCouponId) {
      try {
        const fallbackCoupon = await stripe.coupons.retrieve(fallbackCouponId);
        if (!fallbackCoupon.deleted) {
          return fallbackCoupon;
        }
      } catch (_error) {
        // Create below when the stored fallback coupon is no longer usable.
      }
    }
  }

  const couponCreateParams: Stripe.CouponCreateParams = {
    percent_off: percentOff,
    duration: 'forever',
    name: percentOff >= 100 ? 'Torai referral lifetime free' : 'Torai referral lifetime 50% off',
    metadata: { source: 'torai_referral' },
  };
  if (shouldUseDeterministicCouponId) {
    couponCreateParams.id = couponId;
  }

  const coupon = await stripe.coupons.create(couponCreateParams);
  if (!shouldUseDeterministicCouponId) {
    await configRef.set(
      {
        lifetimeCouponIds: {
          [fallbackCouponKey]: coupon.id,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  return coupon;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function queueLifetimeFreeNotificationEmail(
  referrerUid: string,
  referrerData: FirebaseFirestore.DocumentData
) {
  const email = typeof referrerData.email === 'string' ? referrerData.email.trim() : '';
  if (!email) {
    logger.warn('Skipping lifetime free notification email because user has no email.', {
      referrerUid,
    });
    return;
  }

  const displayName =
    typeof referrerData.displayName === 'string' && referrerData.displayName.trim()
      ? referrerData.displayName.trim()
      : 'お客様';
  const escapedDisplayName = escapeHtml(displayName);
  const subject = '【虎威】紹介100人達成による永久無料化のお知らせ';
  const text = `${displayName} 様\n\nいつも虎威をご利用いただきありがとうございます。\n\n紹介100人達成により、虎威は永久無料でご利用いただける状態になりました。\n今後クレジットカードへの課金が発生しないように、Stripe上の課金契約を停止しました。\n\n引き続き、虎威を無料でご利用いただけます。\n\n虎威サポート`;
  const html = `
    <p>${escapedDisplayName} 様</p>
    <p>いつも虎威をご利用いただきありがとうございます。</p>
    <p>紹介100人達成により、虎威は永久無料でご利用いただける状態になりました。</p>
    <p>今後クレジットカードへの課金が発生しないように、Stripe上の課金契約を停止しました。</p>
    <p>引き続き、虎威を無料でご利用いただけます。</p>
    <p>虎威サポート</p>
  `;
  const bcc = getAdminNotificationBcc();

  await db.collection('mail').add({
    to: [email],
    ...(bcc.length > 0 ? { bcc } : {}),
    message: {
      subject,
      text,
      html,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      source: 'torai_referral_lifetime_free',
      referrerUid,
    },
  });
}

async function applyLifetimeDiscountIfPossible(
  referrerUid: string,
  percentOff = 50,
  stripe?: Stripe | null
) {
  const referrerDoc = await db.collection('users').doc(referrerUid).get();
  const referrerData = referrerDoc.data() || {};
  const referralUpdate = {
    ...(referrerData.referral || {}),
    lifetimeDiscountPercent: percentOff,
  };
  const lifetimeFreeUpdate =
    percentOff >= 100
      ? {
          appPlanId: 'lifetime',
          subscriptionStatus: 'active',
        }
      : {};

  if (!referrerData.stripeSubscriptionId || !stripe) {
    await referrerDoc.ref.set(
      {
        referral: {
          ...referralUpdate,
          lifetimeDiscountStatus: 'pending_stripe_subscription',
        },
        ...lifetimeFreeUpdate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return null;
  }

  if (percentOff >= 100) {
    const stripeSubscriptionId = referrerData.stripeSubscriptionId;
    const restoreExistingField = (fieldName: string) =>
      Object.hasOwn(referrerData, fieldName)
        ? referrerData[fieldName]
        : admin.firestore.FieldValue.delete();
    const hasOriginalReferral = Object.hasOwn(referrerData, 'referral');
    const originalReferral =
      referrerData.referral && typeof referrerData.referral === 'object'
        ? referrerData.referral
        : {};
    const restoreExistingReferralField = (fieldName: string) =>
      Object.hasOwn(originalReferral, fieldName)
        ? originalReferral[fieldName]
        : admin.firestore.FieldValue.delete();
    const rollbackLifetimeFreeUpdate: Record<string, unknown> = {
      appPlanId: restoreExistingField('appPlanId'),
      subscriptionStatus: restoreExistingField('subscriptionStatus'),
      stripeSubscriptionId: restoreExistingField('stripeSubscriptionId'),
      stripePriceId: restoreExistingField('stripePriceId'),
      cancelAtPeriodEnd: restoreExistingField('cancelAtPeriodEnd'),
      pendingPlanChange: restoreExistingField('pendingPlanChange'),
      currentPeriodEnd: restoreExistingField('currentPeriodEnd'),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (hasOriginalReferral) {
      Object.entries(originalReferral).forEach(([key, value]) => {
        rollbackLifetimeFreeUpdate[`referral.${key}`] = value;
      });
      rollbackLifetimeFreeUpdate['referral.lifetimeDiscountPercent'] =
        restoreExistingReferralField('lifetimeDiscountPercent');
      rollbackLifetimeFreeUpdate['referral.lifetimeDiscountStatus'] =
        restoreExistingReferralField('lifetimeDiscountStatus');
      rollbackLifetimeFreeUpdate['referral.lifetimeDiscountAppliedAt'] =
        restoreExistingReferralField('lifetimeDiscountAppliedAt');
      rollbackLifetimeFreeUpdate['referral.lifetimeFreeStripeSubscriptionCanceledAt'] =
        restoreExistingReferralField('lifetimeFreeStripeSubscriptionCanceledAt');
    } else {
      rollbackLifetimeFreeUpdate.referral = admin.firestore.FieldValue.delete();
    }
    await referrerDoc.ref.set(
      {
        referral: {
          ...referralUpdate,
          lifetimeDiscountStatus: 'applied',
          lifetimeDiscountAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
          lifetimeFreeStripeSubscriptionCanceledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        ...lifetimeFreeUpdate,
        stripeSubscriptionId: admin.firestore.FieldValue.delete(),
        stripePriceId: admin.firestore.FieldValue.delete(),
        cancelAtPeriodEnd: admin.firestore.FieldValue.delete(),
        pendingPlanChange: admin.firestore.FieldValue.delete(),
        currentPeriodEnd: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId, {
        invoice_now: false,
        prorate: false,
      });
    } catch (error) {
      logger.error('Failed to cancel Stripe subscription for lifetime free referral reward.', {
        referrerUid,
        stripeSubscriptionId,
        ...getErrorLogFields(error),
      });
      await referrerDoc.ref.update(rollbackLifetimeFreeUpdate);
      throw error;
    }
    await queueLifetimeFreeNotificationEmail(referrerUid, referrerData);
    return null;
  }

  const coupon = await ensureLifetimeCoupon(stripe, percentOff);
  await stripe.subscriptions.update(referrerData.stripeSubscriptionId, {
    discounts: [{ coupon: coupon.id }],
    metadata: {
      firebaseUID: referrerUid,
      referralLifetimeDiscount: 'true',
      referralLifetimeDiscountPercent: String(percentOff),
    },
  } as any);
  await referrerDoc.ref.set(
    {
      referral: {
        ...referralUpdate,
        lifetimeDiscountStatus: 'applied',
        lifetimeDiscountAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      ...lifetimeFreeUpdate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return coupon.id;
}

async function grantPendingReferralCredits(referrerUid: string, stripe?: Stripe | null) {
  const config = await getReferralConfig();
  const monthKey = getMonthKey();
  const usageRef = db.collection('referralMonthlyGrantUsage').doc(`${referrerUid}_${monthKey}`);
  const rewardsSnap = await db
    .collection('referralRewards')
    .where('referrerUid', '==', referrerUid)
    .where('status', 'in', ['earned', 'partially_granted', 'granting'])
    .orderBy('earnedAt', 'asc')
    .limit(20)
    .get();

  if (rewardsSnap.empty) {
    return;
  }

  const referrerRef = db.collection('users').doc(referrerUid);
  const referrerSnap = await referrerRef.get();
  const referrerData = referrerSnap.data() || {};
  const stripeCustomerId =
    typeof referrerData.stripeCustomerId === 'string' ? referrerData.stripeCustomerId : null;

  const usageSnap = await usageRef.get();
  const usageData = usageSnap.data() || {};
  const usedMonths = typeof usageData.grantedMonths === 'number' ? usageData.grantedMonths : 0;
  const reservedMonths =
    typeof usageData.grantingMonths === 'number' ? usageData.grantingMonths : 0;
  let availableMonths = Math.max(0, config.monthlyGrantLimitMonths - usedMonths - reservedMonths);

  for (const rewardDoc of rewardsSnap.docs) {
    const reward = rewardDoc.data();
    const lifetimeDiscountPercent = getLifetimeDiscountPercent(reward.kind);
    if (lifetimeDiscountPercent) {
      let lifetimeGrantPrepared = false;
      let lifetimePreviousStatus = typeof reward.status === 'string' ? reward.status : 'earned';
      try {
        await db.runTransaction(async (transaction) => {
          const freshRewardSnap = await transaction.get(rewardDoc.ref);
          const freshReward = freshRewardSnap.data();
          if (!freshRewardSnap.exists || !freshReward) {
            logger.warn('Skipping lifetime referral reward because reward no longer exists.', {
              referrerUid,
              rewardId: rewardDoc.id,
            });
            return;
          }
          if (freshReward.status === 'granting') {
            const previousStatus =
              freshReward.previousStatus === 'partially_granted' ? 'partially_granted' : 'earned';
            const grantingAtMillis = timestampToMillis(freshReward.grantingAt);
            const isStaleGrant =
              !grantingAtMillis || Date.now() - grantingAtMillis >= LIFETIME_GRANT_STALE_AFTER_MS;
            if (!isStaleGrant) {
              logger.info(
                'Skipping lifetime referral reward because another grant is in progress.',
                {
                  referrerUid,
                  rewardId: rewardDoc.id,
                }
              );
              return;
            }

            const freshReferrerSnap = await transaction.get(referrerRef);
            if (isLifetimeRewardAlreadyApplied(freshReferrerSnap.data(), lifetimeDiscountPercent)) {
              transaction.set(
                rewardDoc.ref,
                {
                  status: 'granted',
                  grantedAt: admin.firestore.FieldValue.serverTimestamp(),
                  stripeSubscriptionCanceled: lifetimeDiscountPercent >= 100,
                  grantingAt: admin.firestore.FieldValue.delete(),
                  previousStatus: admin.firestore.FieldValue.delete(),
                  referralGrantError: admin.firestore.FieldValue.delete(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              transaction.set(
                db.collection('referralSummaries').doc(referrerUid),
                {
                  lifetimeDiscountPercent,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              logger.warn('Recovered stale lifetime referral reward as already applied.', {
                referrerUid,
                rewardId: rewardDoc.id,
                lifetimeDiscountPercent,
              });
              return;
            }

            lifetimePreviousStatus = previousStatus;
            lifetimeGrantPrepared = true;
            transaction.set(
              rewardDoc.ref,
              {
                status: 'granting',
                grantingAt: admin.firestore.FieldValue.serverTimestamp(),
                previousStatus,
                referralGrantError: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            logger.warn('Retrying stale lifetime referral reward grant.', {
              referrerUid,
              rewardId: rewardDoc.id,
              lifetimeDiscountPercent,
            });
            return;
          }
          if (!['earned', 'partially_granted'].includes(freshReward.status)) {
            logger.info('Skipping lifetime referral reward because reward status changed.', {
              referrerUid,
              rewardId: rewardDoc.id,
              status: freshReward.status,
            });
            return;
          }

          lifetimePreviousStatus = freshReward.status;
          lifetimeGrantPrepared = true;
          transaction.set(
            rewardDoc.ref,
            {
              status: 'granting',
              grantingAt: admin.firestore.FieldValue.serverTimestamp(),
              previousStatus: freshReward.status,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });

        if (!lifetimeGrantPrepared) {
          continue;
        }

        const couponId = await applyLifetimeDiscountIfPossible(
          referrerUid,
          lifetimeDiscountPercent,
          stripe
        );
        await rewardDoc.ref.set(
          {
            status: 'granted',
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
            stripeSubscriptionCanceled: lifetimeDiscountPercent >= 100,
            ...(couponId ? { stripeCouponId: couponId } : {}),
            grantingAt: admin.firestore.FieldValue.delete(),
            previousStatus: admin.firestore.FieldValue.delete(),
            referralGrantError: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await db.collection('referralSummaries').doc(referrerUid).set(
          {
            lifetimeDiscountPercent,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        logger.error('Failed to apply lifetime referral reward.', {
          referrerUid,
          rewardId: rewardDoc.id,
          lifetimeDiscountPercent,
          ...getErrorLogFields(error),
        });
        if (lifetimeGrantPrepared) {
          try {
            await rewardDoc.ref.set(
              {
                status: lifetimePreviousStatus,
                referralGrantError:
                  error instanceof Error ? error.message : 'Lifetime referral reward failed.',
                grantingAt: admin.firestore.FieldValue.delete(),
                previousStatus: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } catch (rollbackError) {
            logger.error('Failed to roll back lifetime referral reward state.', {
              referrerUid,
              rewardId: rewardDoc.id,
              ...getErrorLogFields(rollbackError),
            });
          }
        }
      }
      continue;
    }

    if (availableMonths <= 0 && reward.status !== 'granting') {
      continue;
    }

    let preparedGrant: PreparedReferralGrant | null = null;
    let stripeBalanceTransactionId: string | null = null;

    if (
      reward.status === 'granting' &&
      reward.grantingMonthKey === monthKey &&
      typeof reward.grantingMonths === 'number' &&
      typeof reward.grantingAmount === 'number' &&
      typeof reward.grantingIdempotencyKey === 'string'
    ) {
      preparedGrant = {
        grantMonths: reward.grantingMonths,
        grantAmount: reward.grantingAmount,
        grantDestination:
          reward.grantDestination === 'stripe_customer_balance'
            ? 'stripe_customer_balance'
            : 'bank_credit',
        idempotencyKey: reward.grantingIdempotencyKey,
        previousStatus:
          typeof reward.previousStatus === 'string' ? reward.previousStatus : 'earned',
        usageRef,
        usageMonthKey: monthKey,
        countsAgainstCurrentAvailable: false,
      };
    } else {
      try {
        await db.runTransaction(async (transaction) => {
          preparedGrant = null;
          const [freshRewardSnap, freshUsageSnap] = await Promise.all([
            transaction.get(rewardDoc.ref),
            transaction.get(usageRef),
          ]);
          const freshReward = freshRewardSnap.data();
          if (!freshRewardSnap.exists || !freshReward) {
            logger.warn('Skipping referral grant because reward no longer exists.', {
              referrerUid,
              rewardId: rewardDoc.id,
            });
            return;
          }
          if (freshReward.status === 'granting') {
            const staleGrantingMonthKey =
              typeof freshReward.grantingMonthKey === 'string'
                ? freshReward.grantingMonthKey
                : null;
            const staleGrantingMonths =
              typeof freshReward.grantingMonths === 'number'
                ? Math.max(0, freshReward.grantingMonths)
                : 0;
            const staleGrantingAmount =
              typeof freshReward.grantingAmount === 'number'
                ? Math.max(0, freshReward.grantingAmount)
                : 0;
            const staleIdempotencyKey =
              typeof freshReward.grantingIdempotencyKey === 'string'
                ? freshReward.grantingIdempotencyKey
                : null;
            const previousStatus =
              freshReward.previousStatus === 'partially_granted' ? 'partially_granted' : 'earned';

            if (
              staleGrantingMonthKey &&
              staleGrantingMonths > 0 &&
              staleGrantingAmount > 0 &&
              staleIdempotencyKey
            ) {
              preparedGrant = {
                grantMonths: staleGrantingMonths,
                grantAmount: staleGrantingAmount,
                grantDestination:
                  freshReward.grantDestination === 'stripe_customer_balance'
                    ? 'stripe_customer_balance'
                    : 'bank_credit',
                idempotencyKey: staleIdempotencyKey,
                previousStatus,
                usageRef: db
                  .collection('referralMonthlyGrantUsage')
                  .doc(`${referrerUid}_${staleGrantingMonthKey}`),
                usageMonthKey: staleGrantingMonthKey,
                countsAgainstCurrentAvailable: false,
              };
              logger.warn('Retrying stale referral grant preparation.', {
                referrerUid,
                rewardId: rewardDoc.id,
                grantingMonthKey: staleGrantingMonthKey,
              });
            } else {
              const staleUsageUpdate =
                staleGrantingMonthKey && (staleGrantingMonths > 0 || staleGrantingAmount > 0)
                  ? {
                      grantingMonths: admin.firestore.FieldValue.increment(-staleGrantingMonths),
                      grantingAmount: admin.firestore.FieldValue.increment(-staleGrantingAmount),
                      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }
                  : null;
              transaction.set(
                rewardDoc.ref,
                {
                  status: previousStatus,
                  referralGrantError: 'Stale granting state was missing required grant metadata.',
                  grantingMonthKey: admin.firestore.FieldValue.delete(),
                  grantingMonths: admin.firestore.FieldValue.delete(),
                  grantingAmount: admin.firestore.FieldValue.delete(),
                  grantingIdempotencyKey: admin.firestore.FieldValue.delete(),
                  previousStatus: admin.firestore.FieldValue.delete(),
                  grantingAt: admin.firestore.FieldValue.delete(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              if (staleUsageUpdate && staleGrantingMonthKey) {
                transaction.set(
                  db
                    .collection('referralMonthlyGrantUsage')
                    .doc(`${referrerUid}_${staleGrantingMonthKey}`),
                  staleUsageUpdate,
                  { merge: true }
                );
              }
              logger.warn('Rolled back invalid stale referral grant state.', {
                referrerUid,
                rewardId: rewardDoc.id,
              });
            }
            return;
          }
          if (!['earned', 'partially_granted'].includes(freshReward.status)) {
            logger.info('Skipping referral grant preparation because reward status changed.', {
              referrerUid,
              rewardId: rewardDoc.id,
              status: freshReward.status,
            });
            return;
          }

          const freshRemainingMonths =
            typeof freshReward.remainingMonths === 'number'
              ? Math.max(0, freshReward.remainingMonths)
              : 0;
          const freshUsage = freshUsageSnap.data() || {};
          const freshUsedMonths =
            typeof freshUsage.grantedMonths === 'number' ? freshUsage.grantedMonths : 0;
          const freshReservedMonths =
            typeof freshUsage.grantingMonths === 'number' ? freshUsage.grantingMonths : 0;
          const freshAvailableMonths = Math.max(
            0,
            config.monthlyGrantLimitMonths - freshUsedMonths - freshReservedMonths
          );
          const grantMonths = Math.min(freshRemainingMonths, freshAvailableMonths, availableMonths);
          if (grantMonths <= 0) {
            return;
          }
          const grantAmount = grantMonths * config.monthlyRewardAmount;
          const grantDestination: 'stripe_customer_balance' | 'bank_credit' =
            stripeCustomerId && stripe ? 'stripe_customer_balance' : 'bank_credit';
          const attemptCount =
            typeof freshReward.attemptCount === 'number'
              ? Math.max(0, Math.floor(freshReward.attemptCount))
              : 0;
          const idempotencyKey = `referral_grant_${rewardDoc.id}_${grantMonths}_${monthKey}_${attemptCount}`;
          preparedGrant = {
            grantMonths,
            grantAmount,
            grantDestination,
            idempotencyKey,
            previousStatus: freshReward.status,
            usageRef,
            usageMonthKey: monthKey,
            countsAgainstCurrentAvailable: true,
          };
          transaction.set(
            rewardDoc.ref,
            {
              status: 'granting',
              grantDestination,
              grantingMonthKey: monthKey,
              grantingMonths: grantMonths,
              grantingAmount: grantAmount,
              grantingIdempotencyKey: idempotencyKey,
              previousStatus: freshReward.status,
              grantingAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          transaction.set(
            usageRef,
            {
              referrerUid,
              monthKey,
              grantingMonths: admin.firestore.FieldValue.increment(grantMonths),
              grantingAmount: admin.firestore.FieldValue.increment(grantAmount),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });
      } catch (error) {
        logger.error('Failed to prepare referral grant.', {
          referrerUid,
          rewardId: rewardDoc.id,
          ...getErrorLogFields(error),
        });
        continue;
      }
    }

    if (!preparedGrant) {
      continue;
    }
    const grant = preparedGrant;

    if (grant.grantDestination === 'stripe_customer_balance' && stripeCustomerId && stripe) {
      try {
        const transaction = await stripe.customers.createBalanceTransaction(
          stripeCustomerId,
          {
            amount: -grant.grantAmount,
            currency: 'jpy',
            description: `虎威 紹介報酬 ${grant.grantMonths}ヶ月分`,
            metadata: {
              referrerUid,
              rewardId: rewardDoc.id,
              source: 'torai_referral',
            },
          },
          {
            idempotencyKey: grant.idempotencyKey,
          }
        );
        stripeBalanceTransactionId = transaction.id;
      } catch (error) {
        await db.runTransaction(async (transaction) => {
          const freshRewardSnap = await transaction.get(rewardDoc.ref);
          const freshReward = freshRewardSnap.data();
          if (
            freshRewardSnap.exists &&
            freshReward?.status === 'granting' &&
            freshReward.grantingIdempotencyKey === grant.idempotencyKey
          ) {
            transaction.set(
              rewardDoc.ref,
              {
                status: grant.previousStatus,
                referralGrantError: error instanceof Error ? error.message : 'Stripe grant failed.',
                grantingMonthKey: admin.firestore.FieldValue.delete(),
                grantingMonths: admin.firestore.FieldValue.delete(),
                grantingAmount: admin.firestore.FieldValue.delete(),
                grantingIdempotencyKey: admin.firestore.FieldValue.delete(),
                previousStatus: admin.firestore.FieldValue.delete(),
                grantingAt: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            transaction.set(
              grant.usageRef,
              {
                grantingMonths: admin.firestore.FieldValue.increment(-grant.grantMonths),
                grantingAmount: admin.firestore.FieldValue.increment(-grant.grantAmount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        });
        logger.error('Failed to create Stripe referral balance transaction.', {
          referrerUid,
          rewardId: rewardDoc.id,
          ...getErrorLogFields(error),
        });
        continue;
      }
    }

    let grantCommitted = false;
    try {
      await db.runTransaction(async (transaction) => {
        grantCommitted = false;
        const freshRewardSnap = await transaction.get(rewardDoc.ref);
        const freshReward = freshRewardSnap.data();
        if (!freshRewardSnap.exists || !freshReward) {
          logger.warn('Skipping referral grant because reward no longer exists.', {
            referrerUid,
            rewardId: rewardDoc.id,
          });
          return;
        }
        if (
          freshReward.status !== 'granting' ||
          freshReward.grantingIdempotencyKey !== grant.idempotencyKey
        ) {
          logger.info('Skipping referral grant completion because reward is not prepared.', {
            referrerUid,
            rewardId: rewardDoc.id,
            status: freshReward.status,
          });
          return;
        }
        const freshRemainingMonths =
          typeof freshReward.remainingMonths === 'number'
            ? Math.max(0, freshReward.remainingMonths)
            : 0;
        if (freshRemainingMonths < grant.grantMonths) {
          logger.warn('Completing referral grant with lower remaining months than reserved.', {
            referrerUid,
            rewardId: rewardDoc.id,
            grantMonths: grant.grantMonths,
            freshRemainingMonths,
          });
        }
        const newRemainingMonths = Math.max(0, freshRemainingMonths - grant.grantMonths);
        transaction.set(
          grant.usageRef,
          {
            referrerUid,
            monthKey: grant.usageMonthKey,
            grantedMonths: admin.firestore.FieldValue.increment(grant.grantMonths),
            grantedAmount: admin.firestore.FieldValue.increment(grant.grantAmount),
            grantingMonths: admin.firestore.FieldValue.increment(-grant.grantMonths),
            grantingAmount: admin.firestore.FieldValue.increment(-grant.grantAmount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        const rewardUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
          status: newRemainingMonths > 0 ? 'partially_granted' : 'granted',
          remainingMonths: newRemainingMonths,
          remainingAmount: newRemainingMonths * config.monthlyRewardAmount,
          grantedMonths: admin.firestore.FieldValue.increment(grant.grantMonths),
          grantedAmount: admin.firestore.FieldValue.increment(grant.grantAmount),
          grantDestination: grant.grantDestination,
          grantedAt: admin.firestore.FieldValue.serverTimestamp(),
          grantingMonthKey: admin.firestore.FieldValue.delete(),
          grantingMonths: admin.firestore.FieldValue.delete(),
          grantingAmount: admin.firestore.FieldValue.delete(),
          grantingIdempotencyKey: admin.firestore.FieldValue.delete(),
          previousStatus: admin.firestore.FieldValue.delete(),
          grantingAt: admin.firestore.FieldValue.delete(),
          referralGrantError: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (stripeBalanceTransactionId) {
          rewardUpdate.stripeBalanceTransactionIds = admin.firestore.FieldValue.arrayUnion(
            stripeBalanceTransactionId
          );
        }
        transaction.set(rewardDoc.ref, rewardUpdate, { merge: true });
        transaction.set(
          db.collection('referralSummaries').doc(referrerUid),
          {
            grantedMonths: admin.firestore.FieldValue.increment(grant.grantMonths),
            grantedAmount: admin.firestore.FieldValue.increment(grant.grantAmount),
            pendingGrantMonths: admin.firestore.FieldValue.increment(-grant.grantMonths),
            pendingGrantAmount: admin.firestore.FieldValue.increment(-grant.grantAmount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        transaction.set(
          referrerRef,
          {
            referralCredit: {
              totalGrantedAmount: admin.firestore.FieldValue.increment(grant.grantAmount),
              ...(grant.grantDestination === 'stripe_customer_balance'
                ? {
                    stripeGrantedAmount: admin.firestore.FieldValue.increment(grant.grantAmount),
                  }
                : {
                    bankAvailableAmount: admin.firestore.FieldValue.increment(grant.grantAmount),
                  }),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        grantCommitted = true;
      });
    } catch (error) {
      if (stripeBalanceTransactionId && stripeCustomerId && stripe) {
        const postFailureRewardSnap = await rewardDoc.ref.get();
        const postFailureReward = postFailureRewardSnap.data();
        const rawRecordedStripeTransactionIds = postFailureReward?.stripeBalanceTransactionIds;
        const recordedStripeTransactionIds: unknown[] = Array.isArray(
          rawRecordedStripeTransactionIds
        )
          ? rawRecordedStripeTransactionIds
          : [];
        if (recordedStripeTransactionIds.includes(stripeBalanceTransactionId)) {
          logger.warn('Firestore referral grant completion appears to have been committed.', {
            referrerUid,
            rewardId: rewardDoc.id,
            stripeBalanceTransactionId,
            message: error instanceof Error ? error.message : 'Unknown completion status error.',
          });
          grantCommitted = true;
        } else {
          const compensatingStripeBalanceTransactionId = await compensateStripeReferralGrant({
            stripe,
            stripeCustomerId,
            referrerUid,
            rewardId: rewardDoc.id,
            grant,
            stripeBalanceTransactionId,
            error,
          });
          await rollbackPreparedReferralGrant({
            rewardRef: rewardDoc.ref,
            referrerUid,
            rewardId: rewardDoc.id,
            grant,
            stripeBalanceTransactionId,
            compensatingStripeBalanceTransactionId,
            error,
          });
          continue;
        }
      } else {
        const grantDestinationLabel =
          grant.grantDestination === 'stripe_customer_balance' ? 'Stripe' : 'bank';
        logger.error(`Failed to complete ${grantDestinationLabel} credit referral grant.`, {
          referrerUid,
          rewardId: rewardDoc.id,
          grantDestination: grant.grantDestination,
          ...getErrorLogFields(error),
        });
        continue;
      }
    }
    if (grantCommitted) {
      if (grant.countsAgainstCurrentAvailable) {
        availableMonths -= grant.grantMonths;
      }
    } else if (stripeBalanceTransactionId) {
      logger.warn('Stripe referral balance transaction existed but Firestore grant was skipped.', {
        referrerUid,
        rewardId: rewardDoc.id,
        stripeBalanceTransactionId,
      });
      await compensateStripeReferralGrant({
        stripe: stripe!,
        stripeCustomerId: stripeCustomerId!,
        referrerUid,
        rewardId: rewardDoc.id,
        grant,
        stripeBalanceTransactionId,
        error: new Error('Firestore referral grant completion was skipped.'),
      });
    }
  }
}

export async function qualifyReferralSubscription(params: {
  referredUid: string;
  source: 'stripe' | 'bank';
  stripe?: Stripe | null;
  currency?: string | null;
}) {
  const { referredUid, source, stripe = null } = params;
  const currency = params.currency ?? (source === 'bank' ? 'jpy' : null);
  if (source === 'stripe' && currency?.toLowerCase() !== 'jpy') {
    logger.info('Skipping referral qualification for a non-JPY Stripe subscription.', {
      referredUid,
      currency,
    });
    return;
  }
  const config = await getReferralConfig();
  const referredRef = db.collection('users').doc(referredUid);
  const qualificationRef = db.collection('referralQualifications').doc(referredUid);
  let referrerUid: string | null = null;

  await db.runTransaction(async (transaction) => {
    const [referredSnap, qualificationSnap] = await Promise.all([
      transaction.get(referredRef),
      transaction.get(qualificationRef),
    ]);
    const referredData = referredSnap.data() || {};
    if (!isJapaneseReferralUser(referredData)) {
      logger.info('Skipping referral qualification for a non-Japanese user.', { referredUid });
      return;
    }
    if (qualificationSnap.exists) {
      const existingReferrerUid = qualificationSnap.data()?.referrerUid;
      if (typeof existingReferrerUid === 'string') {
        const existingReferrerSnap = await transaction.get(
          db.collection('users').doc(existingReferrerUid)
        );
        referrerUid = isJapaneseReferralUser(existingReferrerSnap.data())
          ? existingReferrerUid
          : null;
      }
      return;
    }
    const referral = referredData.referral || {};
    referrerUid =
      typeof referral.referredByUid === 'string' && referral.referredByUid !== referredUid
        ? referral.referredByUid
        : null;
    if (!referrerUid) {
      return;
    }

    const summaryRef = db.collection('referralSummaries').doc(referrerUid);
    const referrerRef = db.collection('users').doc(referrerUid);
    const [summarySnap, referrerSnap] = await Promise.all([
      transaction.get(summaryRef),
      transaction.get(referrerRef),
    ]);
    if (!isJapaneseReferralUser(referrerSnap.data())) {
      logger.info('Skipping referral qualification for a non-Japanese referrer.', {
        referredUid,
        referrerUid,
      });
      referrerUid = null;
      return;
    }
    const previousSubscribedCount =
      typeof summarySnap.data()?.subscribedCount === 'number'
        ? summarySnap.data()!.subscribedCount
        : 0;
    const newSubscribedCount = previousSubscribedCount + 1;
    let earnedMonths = 0;
    let earnedAmount = 0;

    transaction.set(qualificationRef, {
      referrerUid,
      referredUid,
      source,
      qualifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(
      referredRef,
      {
        referral: {
          ...referral,
          subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
          rewardQualified: true,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    config.milestones
      .filter(
        (milestone) =>
          milestone.threshold > previousSubscribedCount && milestone.threshold <= newSubscribedCount
      )
      .forEach((milestone) => {
        const rewardRef = db
          .collection('referralRewards')
          .doc(`${referrerUid}_${milestone.threshold}`);
        const amount = milestone.rewardMonths * config.monthlyRewardAmount;
        if (milestone.kind === 'subscription_credit') {
          earnedMonths += milestone.rewardMonths;
          earnedAmount += amount;
        }
        transaction.set(
          rewardRef,
          {
            referrerUid,
            milestoneThreshold: milestone.threshold,
            kind: milestone.kind,
            label: milestone.label,
            rewardMonths: milestone.rewardMonths,
            rewardAmount: amount,
            remainingMonths: milestone.rewardMonths,
            remainingAmount: amount,
            status: 'earned',
            earnedByReferredUid: referredUid,
            earnedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

    transaction.set(
      summaryRef,
      {
        uid: referrerUid,
        referralCode: summarySnap.data()?.referralCode || getDefaultReferralCode(referrerUid),
        subscribedCount: admin.firestore.FieldValue.increment(1),
        earnedMonths: admin.firestore.FieldValue.increment(earnedMonths),
        earnedAmount: admin.firestore.FieldValue.increment(earnedAmount),
        pendingGrantMonths: admin.firestore.FieldValue.increment(earnedMonths),
        pendingGrantAmount: admin.firestore.FieldValue.increment(earnedAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(summarySnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );
  });

  if (referrerUid) {
    await ensureReferralCode(referrerUid);
    await grantPendingReferralCredits(referrerUid, stripe);
  }
}

export async function getReferralLifetimeDiscountCouponId(stripe: Stripe): Promise<string> {
  const coupon = await ensureLifetimeCoupon(stripe);
  return coupon.id;
}

export const registerReferralForCurrentUser = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = assertAuthenticated(request);
    const referralCode = normalizeReferralCode(
      (request.data as { referralCode?: unknown })?.referralCode
    );
    const codeSnap = await db.collection('referralCodes').doc(referralCode).get();
    if (!codeSnap.exists) {
      throw new HttpsError('not-found', '紹介コードが見つかりません。');
    }
    const referrerUid = codeSnap.data()?.uid;
    if (!referrerUid || referrerUid === uid) {
      throw new HttpsError('failed-precondition', '自分自身の紹介コードは使用できません。');
    }

    const userRef = db.collection('users').doc(uid);
    const referrerRef = db.collection('users').doc(referrerUid);
    await db.runTransaction(async (transaction) => {
      const [userSnap, referrerSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(referrerRef),
      ]);
      const userData = userSnap.data() || {};
      if (!isJapaneseReferralUser(userData) || !isJapaneseReferralUser(referrerSnap.data())) {
        throw new HttpsError(
          'failed-precondition',
          '紹介プログラムは日本語版でのみ利用できます。'
        );
      }
      if (userData.referral?.referredByUid) {
        return;
      }
      const bankPaymentInfo =
        userData.bankPaymentInfo && typeof userData.bankPaymentInfo === 'object'
          ? userData.bankPaymentInfo
          : null;
      const subscriptionStatus = valueToString(userData.subscriptionStatus);
      const hasSubscriptionHistory =
        userData.termsAccepted === true ||
        (subscriptionStatus !== null && subscriptionStatus !== 'inactive') ||
        Boolean(userData.appPlanId) ||
        Boolean(userData.stripeCustomerId) ||
        Boolean(userData.stripeSubscriptionId) ||
        Boolean(userData.currentPeriodStart) ||
        Boolean(userData.currentPeriodEnd) ||
        Boolean(bankPaymentInfo);
      if (hasSubscriptionHistory) {
        throw new HttpsError('failed-precondition', '紹介コードは新規登録時のみ使用できます。');
      }
      transaction.set(
        userRef,
        {
          referral: {
            referredByUid: referrerUid,
            referralCodeUsed: referralCode,
            registeredAt: admin.firestore.FieldValue.serverTimestamp(),
            rewardQualified: false,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { success: true };
  }
);

export const getMyReferralDashboard = onCall(
  { region: 'asia-northeast1', secrets: [stripeSecretKey] },
  async (request) => {
    const uid = assertAuthenticated(request);
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.data() || {};
    if (!isJapaneseReferralUser(userData)) {
      throw new HttpsError(
        'failed-precondition',
        '紹介プログラムは日本語版でのみ利用できます。'
      );
    }
    const code = await ensureReferralCode(uid);
    const appBaseUrl = appBaseUrlConfig.value() || 'http://localhost:5173';

    const [referredUsersSnap, rewardsSnap, summarySnap] = await Promise.all([
      db.collection('users').where('referral.referredByUid', '==', uid).limit(500).get(),
      db
        .collection('referralRewards')
        .where('referrerUid', '==', uid)
        .orderBy('earnedAt', 'desc')
        .limit(100)
        .get(),
      db.collection('referralSummaries').doc(uid).get(),
    ]);

    let stripeAvailableAmount = 0;
    const stripeCustomerId =
      typeof userData.stripeCustomerId === 'string' ? userData.stripeCustomerId.trim() : '';
    if (stripeCustomerId) {
      try {
        const stripe = initializeStripeSDK();
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (!customer.deleted && typeof customer.balance === 'number' && customer.balance < 0) {
          stripeAvailableAmount = Math.abs(customer.balance);
        }
      } catch (error) {
        logger.warn('Failed to retrieve Stripe customer balance for referral dashboard.', {
          uid,
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    const referredUsers = referredUsersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        registeredAt: timestampToIso(data.referral?.registeredAt),
        termsAccepted: data.termsAccepted === true,
        subscriptionQualified: data.referral?.rewardQualified === true,
        subscriptionStatus: data.subscriptionStatus ?? 'inactive',
      };
    });

    const rewards = rewardsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        label: data.label ?? '',
        kind: data.kind ?? 'subscription_credit',
        status: data.status ?? 'earned',
        rewardMonths: data.rewardMonths ?? 0,
        rewardAmount: data.rewardAmount ?? 0,
        grantedMonths: data.grantedMonths ?? 0,
        grantedAmount: data.grantedAmount ?? 0,
        remainingMonths: data.remainingMonths ?? 0,
        remainingAmount: data.remainingAmount ?? 0,
        earnedAt: timestampToIso(data.earnedAt),
        grantedAt: timestampToIso(data.grantedAt),
      };
    });

    const summary = summarySnap.data() || {};
    const grantedAmount = typeof summary.grantedAmount === 'number' ? summary.grantedAmount : 0;
    const bankAvailableAmount =
      typeof userData.referralCredit?.bankAvailableAmount === 'number'
        ? userData.referralCredit.bankAvailableAmount
        : 0;
    const availableAmount = stripeAvailableAmount + bankAvailableAmount;
    const consumedAmount = Math.max(0, grantedAmount - availableAmount);

    return {
      referralCode: code,
      referralUrl: `${appBaseUrl.replace(/\/$/, '')}/auth/signin?ref=${encodeURIComponent(code)}`,
      summary: {
        registeredCount: referredUsers.length,
        termsAcceptedCount: referredUsers.filter((user) => user.termsAccepted).length,
        subscribedCount:
          typeof summary.subscribedCount === 'number'
            ? summary.subscribedCount
            : referredUsers.filter((user) => user.subscriptionQualified).length,
        earnedMonths: summary.earnedMonths ?? 0,
        earnedAmount: summary.earnedAmount ?? 0,
        grantedMonths: summary.grantedMonths ?? 0,
        grantedAmount,
        pendingGrantMonths: summary.pendingGrantMonths ?? 0,
        pendingGrantAmount: summary.pendingGrantAmount ?? 0,
        availableAmount,
        consumedAmount,
        stripeAvailableAmount,
        bankAvailableAmount,
        lifetimeDiscountPercent:
          summary.lifetimeDiscountPercent ?? userData.referral?.lifetimeDiscountPercent ?? null,
      },
      rewards,
      referredUsers,
    };
  }
);
