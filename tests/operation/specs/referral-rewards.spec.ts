import {
  getLifetimeFreeNotificationMails,
  getOperationReferralReferredUid,
  getOperationReferralReferrerUid,
  getOperationUserDocByUid,
  getReferralQualificationDoc,
  getReferralRewardsForReferrer,
  getReferralSummaryDoc,
  hasFirebaseClientEnv,
  hasOperationReferralReferredUid,
  hasOperationReferralReferrerUid,
} from '../helpers/firebaseState';
import { describeChecklistCase, expect, test } from '../helpers/operationTest';

const milestoneExpectations = [
  { threshold: 1, kind: 'subscription_credit', rewardMonths: 1 },
  { threshold: 5, kind: 'subscription_credit', rewardMonths: 3 },
  { threshold: 10, kind: 'subscription_credit', rewardMonths: 6 },
  { threshold: 30, kind: 'subscription_credit', rewardMonths: 12 },
  { threshold: 50, kind: 'lifetime_50_percent', rewardMonths: 0 },
  { threshold: 100, kind: 'lifetime_free', rewardMonths: 0 },
] as const;

const getStripeSubscription = async (subscriptionId: string) => {
  const secretKey = process.env.OPERATION_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Stripe subscription lookup failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as { id: string; status: string };
};

test.describe('operation checklist: referral rewards', () => {
  test.skip(!hasFirebaseClientEnv(), 'Firebase VITE_* env vars are required.');

  test(describeChecklistCase('18-4'), async () => {
    test.skip(
      !hasOperationReferralReferrerUid() || !hasOperationReferralReferredUid(),
      'OPERATION_REFERRAL_REFERRER_UID and OPERATION_REFERRAL_REFERRED_UID are required.'
    );

    const referrerUid = getOperationReferralReferrerUid();
    const referredUid = getOperationReferralReferredUid();
    const [qualification, referredUser, summary, rewards] = await Promise.all([
      getReferralQualificationDoc(referredUid),
      getOperationUserDocByUid(referredUid),
      getReferralSummaryDoc(referrerUid),
      getReferralRewardsForReferrer(referrerUid),
    ]);

    expect(qualification).not.toBeNull();
    expect(qualification?.referrerUid).toBe(referrerUid);
    expect(qualification?.referredUid).toBe(referredUid);
    expect(qualification?.qualifiedAt).toBeDefined();

    expect(referredUser?.referral?.rewardQualified).toBe(true);
    expect(referredUser?.referral?.subscribedAt).toBeDefined();
    expect(summary?.subscribedCount).toBeGreaterThanOrEqual(1);
    expect(rewards.length).toBeGreaterThan(0);
  });

  test(describeChecklistCase('18-7'), async () => {
    test.skip(
      !hasOperationReferralReferrerUid(),
      'OPERATION_REFERRAL_REFERRER_UID or OPERATION_TEST_UID is required.'
    );

    const referrerUid = getOperationReferralReferrerUid();
    const [summary, rewards] = await Promise.all([
      getReferralSummaryDoc(referrerUid),
      getReferralRewardsForReferrer(referrerUid),
    ]);
    const subscribedCount =
      typeof summary?.subscribedCount === 'number' ? summary.subscribedCount : 0;
    const expectedMilestones = milestoneExpectations.filter(
      (milestone) => milestone.threshold <= subscribedCount
    );

    test.skip(subscribedCount === 0, 'Referral subscribedCount is 0 for this referrer.');
    expect(expectedMilestones.length).toBeGreaterThan(0);

    for (const milestone of expectedMilestones) {
      const reward = rewards.find((item) => item.milestoneThreshold === milestone.threshold);

      expect(reward, `missing reward for threshold ${milestone.threshold}`).toBeDefined();
      expect(reward?.kind).toBe(milestone.kind);
      expect(reward?.rewardMonths).toBe(milestone.rewardMonths);
      expect(reward?.status).toEqual(expect.stringMatching(/^(earned|partially_granted|granted)$/));
    }

    if (subscribedCount >= 50) {
      expect(summary?.lifetimeDiscountPercent).toBeGreaterThanOrEqual(50);
    }
    if (subscribedCount >= 100) {
      expect(summary?.lifetimeDiscountPercent).toBe(100);
    }
  });

  test(describeChecklistCase('18-8'), async () => {
    test.skip(
      !hasOperationReferralReferrerUid() || !hasOperationReferralReferredUid(),
      'OPERATION_REFERRAL_REFERRER_UID and OPERATION_REFERRAL_REFERRED_UID are required.'
    );

    const referrerUid = getOperationReferralReferrerUid();
    const referredUid = getOperationReferralReferredUid();
    const qualification = await getReferralQualificationDoc(referredUid);

    expect(qualification).not.toBeNull();
    expect(qualification?.referrerUid).toBe(referrerUid);
    expect(qualification?.referredUid).toBe(referredUid);
    expect(qualification?.qualifiedAt).toBeDefined();
  });

  test(describeChecklistCase('18-9'), async () => {
    test.skip(
      !hasOperationReferralReferrerUid(),
      'OPERATION_REFERRAL_REFERRER_UID or OPERATION_TEST_UID is required.'
    );

    const referrerUid = getOperationReferralReferrerUid();
    const [referrerUser, summary, rewards, mails] = await Promise.all([
      getOperationUserDocByUid(referrerUid),
      getReferralSummaryDoc(referrerUid),
      getReferralRewardsForReferrer(referrerUid),
      getLifetimeFreeNotificationMails(referrerUid),
    ]);
    const lifetimePercent = referrerUser?.referral?.lifetimeDiscountPercent;

    test.skip(
      typeof lifetimePercent !== 'number' || lifetimePercent < 100,
      'This referrer has not reached the 100-referral lifetime free milestone.'
    );

    expect(referrerUser?.appPlanId).toBe('lifetime');
    expect(referrerUser?.subscriptionStatus).toBe('active');
    expect(referrerUser?.stripeSubscriptionId).toBeUndefined();
    expect(referrerUser?.stripePriceId).toBeUndefined();
    expect(referrerUser?.referral?.lifetimeDiscountStatus).toBe('applied');
    expect(referrerUser?.referral?.lifetimeFreeStripeSubscriptionCanceledAt).toBeDefined();
    expect(summary?.lifetimeDiscountPercent).toBe(100);

    const lifetimeReward = rewards.find((reward) => reward.milestoneThreshold === 100);
    expect(lifetimeReward).toBeDefined();
    expect(lifetimeReward?.kind).toBe('lifetime_free');
    expect(lifetimeReward?.status).toBe('granted');
    expect(lifetimeReward?.stripeSubscriptionCanceled).toBe(true);

    expect(mails.length).toBeGreaterThan(0);
    expect(mails[0]?.message?.subject).toContain('紹介100人達成');

    const canceledSubscriptionId = process.env.OPERATION_REFERRAL_STRIPE_SUBSCRIPTION_ID;
    if (canceledSubscriptionId) {
      const subscription = await getStripeSubscription(canceledSubscriptionId);

      if (subscription) {
        expect(subscription.status).toBe('canceled');
      }
    }
  });
});
