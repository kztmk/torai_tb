import admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { BANK_TRANSFER_PLANS, RENEWAL_PLAN_ID_BANK, STRIPE_PRICE_ID_TO_APP_PLAN_ID, stripeSecretKey } from '../config';
import { db, initializeStripeSDK } from '../utils';

const DASHBOARD_USER_LIMIT = 500;
const EXPIRING_SOON_DAYS = 14;

type AttentionLevel = 'ok' | 'warning' | 'danger';
type SubscriptionSource = 'stripe' | 'bank' | 'mixed' | 'none';
type FunnelStage = 'regist' | 'termaccepted' | 'subscribed';

type StripeSummary = {
  status: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  appPlanId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  error: string | null;
};

type StripeSubscriptionLookupTarget = {
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
};

type AdminSubscriptionDashboardRequest = {
  pageSize?: unknown;
  pageToken?: unknown;
  query?: unknown;
};

type StripeSubscriptionCache = {
  byId: Map<string, Stripe.Subscription>;
  byCustomerId: Map<string, Stripe.Subscription>;
  errorsBySubscriptionId: Map<string, string>;
  errorsByCustomerId: Map<string, string>;
};

const STRIPE_SUBSCRIPTION_SCAN_LIMIT = 1000;
const STRIPE_MISSING_LOOKUP_CONCURRENCY = 8;

function objectHasOwn(target: object, property: PropertyKey): boolean {
  // eslint-disable-next-line prefer-object-has-own -- Keep compatibility without Object.hasOwn typing casts.
  return Object.prototype.hasOwnProperty.call(target, property);
}

function assertAuthenticated(request: any): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
  }
  return request.auth.uid;
}

async function assertAdmin(request: any): Promise<string> {
  const uid = assertAuthenticated(request);
  if (request.auth.token.isAdmin) {
    return uid;
  }

  const requesterDoc = await db.collection('users').doc(uid).get();
  if (!requesterDoc.data()?.isAdmin) {
    throw new HttpsError('permission-denied', 'この操作を実行するには管理者権限が必要です。');
  }
  return uid;
}

function timestampToIso(value: unknown): string | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function secondsToIso(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

function valueToString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getErrorLogFields(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

function normalizeDashboardPageSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DASHBOARD_USER_LIMIT;
  }
  return Math.max(1, Math.min(DASHBOARD_USER_LIMIT, Math.floor(value)));
}

function normalizeDashboardQuery(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 200) : null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  return item?.price?.id ?? null;
}

function getSubscriptionCustomerId(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer;
  return typeof customer === 'string' ? customer : customer?.id ?? null;
}

function serializeStripeSubscription(subscription: Stripe.Subscription | null, error: string | null): StripeSummary {
  if (!subscription) {
    return {
      status: null,
      customerId: null,
      subscriptionId: null,
      priceId: null,
      appPlanId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      error,
    };
  }

  const priceId = getSubscriptionPriceId(subscription);
  return {
    status: subscription.status ?? null,
    customerId: getSubscriptionCustomerId(subscription),
    subscriptionId: subscription.id,
    priceId,
    appPlanId: priceId ? STRIPE_PRICE_ID_TO_APP_PLAN_ID[priceId] ?? null : null,
    currentPeriodStart: secondsToIso((subscription as any).current_period_start),
    currentPeriodEnd: secondsToIso((subscription as any).current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    error,
  };
}

function getStripeSubscriptionPriority(subscription: Stripe.Subscription): number {
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return 0;
  }
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    return 1;
  }
  if (subscription.status === 'incomplete') {
    return 2;
  }
  return 3;
}

function rememberCustomerSubscription(
  cache: Map<string, Stripe.Subscription>,
  subscription: Stripe.Subscription
) {
  const customerId = getSubscriptionCustomerId(subscription);
  if (!customerId) {
    return;
  }

  const existing = cache.get(customerId);
  if (
    !existing ||
    getStripeSubscriptionPriority(subscription) < getStripeSubscriptionPriority(existing)
  ) {
    cache.set(customerId, subscription);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    })
  );
}

async function getStripeSubscriptionCache(
  stripe: Stripe,
  targets: StripeSubscriptionLookupTarget[]
): Promise<StripeSubscriptionCache> {
  const byId = new Map<string, Stripe.Subscription>();
  const byCustomerId = new Map<string, Stripe.Subscription>();
  const errorsBySubscriptionId = new Map<string, string>();
  const errorsByCustomerId = new Map<string, string>();
  const subscriptionIds = Array.from(
    new Set(
      targets
        .map((target) => target.stripeSubscriptionId)
        .filter((value): value is string => Boolean(value))
    )
  );
  const customerIds = Array.from(
    new Set(
      targets
        .map((target) => target.stripeCustomerId)
        .filter((value): value is string => Boolean(value))
    )
  );

  try {
    const subscriptions = await stripe.subscriptions
      .list({
        limit: 100,
        status: 'all',
        expand: ['data.items.data.price'],
      })
      .autoPagingToArray({ limit: STRIPE_SUBSCRIPTION_SCAN_LIMIT });

    subscriptions.forEach((subscription) => {
      byId.set(subscription.id, subscription);
      rememberCustomerSubscription(byCustomerId, subscription);
    });

    const missingSubscriptionIds = subscriptionIds.filter(
      (subscriptionId) => !byId.has(subscriptionId)
    );
    if (missingSubscriptionIds.length > 0) {
      logger.info('Fetching Stripe subscriptions missing from dashboard scan.', {
        count: missingSubscriptionIds.length,
        limit: STRIPE_SUBSCRIPTION_SCAN_LIMIT,
      });
      await runWithConcurrency(
        missingSubscriptionIds,
        STRIPE_MISSING_LOOKUP_CONCURRENCY,
        async (subscriptionId) => {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ['items.data.price'],
            });
            byId.set(subscription.id, subscription);
            rememberCustomerSubscription(byCustomerId, subscription);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Stripe契約情報の取得に失敗しました。';
            logger.error('Failed to retrieve missing Stripe subscription for admin dashboard.', {
              subscriptionId,
              message,
            });
            errorsBySubscriptionId.set(subscriptionId, message);
          }
        }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Stripe契約一覧の取得に失敗しました。';
    logger.error('Failed to fetch Stripe subscriptions list for admin dashboard.', {
      message,
      limit: STRIPE_SUBSCRIPTION_SCAN_LIMIT,
    });
    subscriptionIds.forEach((subscriptionId) => {
      errorsBySubscriptionId.set(subscriptionId, message);
    });
    customerIds.forEach((customerId) => {
      errorsByCustomerId.set(customerId, message);
    });
  }

  return { byId, byCustomerId, errorsBySubscriptionId, errorsByCustomerId };
}

function getStripeSubscriptionSummary(
  cache: StripeSubscriptionCache,
  stripeSubscriptionId: string | null,
  stripeCustomerId: string | null
): StripeSummary {
  try {
    if (stripeSubscriptionId) {
      const cachedSubscription = cache.byId.get(stripeSubscriptionId);
      if (cachedSubscription) {
        return serializeStripeSubscription(cachedSubscription, null);
      }
      return serializeStripeSubscription(
        null,
        cache.errorsBySubscriptionId.get(stripeSubscriptionId) ?? 'Subscription not found in Stripe'
      );
    }

    if (stripeCustomerId) {
      const cachedSubscription = cache.byCustomerId.get(stripeCustomerId);
      if (cachedSubscription) {
        return serializeStripeSubscription(cachedSubscription, null);
      }
      return serializeStripeSubscription(
        null,
        cache.errorsByCustomerId.get(stripeCustomerId) ?? null
      );
    }

    return serializeStripeSubscription(null, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe契約情報の取得に失敗しました。';
    logger.error('Failed to retrieve Stripe subscription for admin dashboard.', {
      stripeSubscriptionId,
      stripeCustomerId,
      message,
    });
    return serializeStripeSubscription(null, message);
  }
}

function isActiveLike(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

function isExpiringSoon(periodEndIso: string | null): boolean {
  if (!periodEndIso) {
    return false;
  }
  const endTime = new Date(periodEndIso).getTime();
  const now = Date.now();
  return endTime >= now && endTime <= now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
}

async function getDashboardUserDocs(args: {
  pageSize: number;
  pageToken: string | null;
  query: string | null;
}): Promise<{
  docs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[];
  nextPageToken: string | null;
  hasNextPage: boolean;
}> {
  const { pageSize, pageToken, query } = args;

  if (query) {
    const candidates = new Map<string, admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>>();
    const addDocs = (snap: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>) => {
      snap.docs.forEach((doc) => candidates.set(doc.id, doc));
    };
    if (!query.includes('/')) {
      try {
        const exactUserDoc = await db.collection('users').doc(query).get();
        if (exactUserDoc.exists) {
          candidates.set(
            exactUserDoc.id,
            exactUserDoc as admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
          );
        }
      } catch (error) {
        logger.warn('Failed to fetch exact user document for dashboard search.', {
          query,
          ...getErrorLogFields(error),
        });
      }
    }

    const searchableFields = [
      'email',
      'displayName',
      'stripeCustomerId',
      'stripeSubscriptionId',
      'appPlanId',
      'subscriptionStatus',
    ];
    await Promise.all(
      searchableFields.map(async (field) => {
        const searchValue = field === 'email' ? query.toLowerCase() : query;
        const snap = await db
          .collection('users')
          .where(field, '==', searchValue)
          .limit(pageSize)
          .get();
        addDocs(snap);
      })
    );

    return {
      docs: Array.from(candidates.values()).slice(0, pageSize),
      nextPageToken: null,
      hasNextPage: candidates.size > pageSize,
    };
  }

  let queryRef: admin.firestore.Query<admin.firestore.DocumentData> = db
    .collection('users')
    .orderBy(admin.firestore.FieldPath.documentId());
  if (pageToken) {
    queryRef = queryRef.startAfter(pageToken);
  }
  const snap = await queryRef.limit(pageSize + 1).get();
  const docs = snap.docs.slice(0, pageSize);
  const hasNextPage = snap.docs.length > pageSize;
  return {
    docs,
    nextPageToken: hasNextPage ? docs[docs.length - 1]?.id ?? null : null,
    hasNextPage,
  };
}

export const getAdminSubscriptionDashboard = onCall(
  { region: 'asia-northeast1', secrets: [stripeSecretKey], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const adminUid = await assertAdmin(request);
    const stripe = initializeStripeSDK();
    const requestData = (request.data || {}) as AdminSubscriptionDashboardRequest;
    const pageSize = normalizeDashboardPageSize(requestData.pageSize);
    const pageToken = valueToString(requestData.pageToken);
    const serverQuery = normalizeDashboardQuery(requestData.query);
    const usersPage = await getDashboardUserDocs({ pageSize, pageToken, query: serverQuery });
    const stripeCache = await getStripeSubscriptionCache(
      stripe,
      usersPage.docs.map((doc) => {
        const data = doc.data();
        return {
          stripeSubscriptionId: valueToString(data.stripeSubscriptionId),
          stripeCustomerId: valueToString(data.stripeCustomerId),
        };
      })
    );

    const rows = usersPage.docs.map((doc) => {
      const data = doc.data();
      const firestoreStatus = valueToString(data.subscriptionStatus) ?? 'inactive';
      const firestorePlanId = valueToString(data.appPlanId);
      const firestoreStripeCustomerId = valueToString(data.stripeCustomerId);
      const firestoreStripeSubscriptionId = valueToString(data.stripeSubscriptionId);
      const firestoreStripePriceId = valueToString(data.stripePriceId);
      const termsAccepted = data.termsAccepted === true;
      const bankPaymentInfo = data.bankPaymentInfo && typeof data.bankPaymentInfo === 'object'
        ? (data.bankPaymentInfo as any)
        : null;
      const bankStatus = bankPaymentInfo ? valueToString(bankPaymentInfo.status) : null;
      const hasBankSubscription =
        firestorePlanId === RENEWAL_PLAN_ID_BANK ||
        (bankStatus !== null &&
          objectHasOwn(BANK_TRANSFER_PLANS, valueToString(bankPaymentInfo?.planId) ?? ''));
      const hasLifetimePlan = firestorePlanId === 'lifetime';

      const stripeSummary = getStripeSubscriptionSummary(
        stripeCache,
        firestoreStripeSubscriptionId,
        firestoreStripeCustomerId
      );

      const mismatchReasons: string[] = [];
      if (stripeSummary.error) {
        mismatchReasons.push('Stripe情報を取得できませんでした');
      }
      if (stripeSummary.status && firestoreStatus !== stripeSummary.status) {
        mismatchReasons.push(`Firestore状態(${firestoreStatus})とStripe状態(${stripeSummary.status})が異なります`);
      }
      if (isActiveLike(stripeSummary.status)) {
        if (stripeSummary.priceId && firestoreStripePriceId && firestoreStripePriceId !== stripeSummary.priceId) {
          mismatchReasons.push('FirestoreのStripe価格IDとStripeの価格IDが異なります');
        }
        if (stripeSummary.appPlanId && firestorePlanId && firestorePlanId !== stripeSummary.appPlanId) {
          mismatchReasons.push('FirestoreのプランIDとStripe価格のプランIDが異なります');
        }
      }
      if (
        isActiveLike(firestoreStatus) &&
        !hasBankSubscription &&
        !hasLifetimePlan &&
        !isActiveLike(stripeSummary.status)
      ) {
        mismatchReasons.push('Firestoreでは有効ですがStripeでは有効契約が見つかりません');
      }
      if (isActiveLike(stripeSummary.status) && !isActiveLike(firestoreStatus)) {
        mismatchReasons.push('Stripeでは有効ですがFirestoreでは有効になっていません');
      }

      const source: SubscriptionSource =
        stripeSummary.subscriptionId && hasBankSubscription
          ? 'mixed'
          : stripeSummary.subscriptionId
            ? 'stripe'
            : hasBankSubscription
              ? 'bank'
              : 'none';
      const attentionLevel: AttentionLevel = stripeSummary.error
        ? 'danger'
        : mismatchReasons.length > 0 || firestoreStatus === 'past_due' || stripeSummary.status === 'past_due'
          ? 'warning'
          : 'ok';
      const periodEnd = stripeSummary.currentPeriodEnd ?? timestampToIso(data.currentPeriodEnd);
      const isContracted =
        isActiveLike(firestoreStatus) ||
        isActiveLike(stripeSummary.status) ||
        bankStatus === 'active' ||
        hasLifetimePlan;
      const funnelStage: FunnelStage = isContracted
        ? 'subscribed'
        : termsAccepted
          ? 'termaccepted'
          : 'regist';

      return {
        uid: doc.id,
        email: valueToString(data.email) ?? '',
        displayName: valueToString(data.displayName) ?? '',
        source,
        funnelStage,
        attentionLevel,
        mismatchReasons,
        firestore: {
          status: firestoreStatus,
          termsAccepted,
          appPlanId: firestorePlanId,
          stripeCustomerId: firestoreStripeCustomerId,
          stripeSubscriptionId: firestoreStripeSubscriptionId,
          stripePriceId: firestoreStripePriceId,
          currentPeriodStart: timestampToIso(data.currentPeriodStart),
          currentPeriodEnd: timestampToIso(data.currentPeriodEnd),
          cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
          updatedAt: timestampToIso(data.updatedAt),
        },
        stripe: stripeSummary,
        bank: {
          status: bankStatus,
          planId: valueToString(bankPaymentInfo?.planId),
          planName: valueToString(bankPaymentInfo?.planName),
          amount:
            typeof bankPaymentInfo?.totalAmount === 'number'
              ? bankPaymentInfo.totalAmount
              : typeof bankPaymentInfo?.amount === 'number'
                ? bankPaymentInfo.amount
                : null,
          currentPeriodEnd: timestampToIso(data.currentPeriodEnd),
          paymentDeadline: timestampToIso(bankPaymentInfo?.paymentDeadline),
        },
        periodEnd,
        expiresSoon: isExpiringSoon(periodEnd),
      };
    });

    rows.sort((a, b) => {
      const rank = { danger: 0, warning: 1, ok: 2 };
      const rankDiff = rank[a.attentionLevel] - rank[b.attentionLevel];
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return (a.periodEnd ?? '9999').localeCompare(b.periodEnd ?? '9999');
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.totalUsers += 1;
        if (isActiveLike(row.firestore.status)) {
          acc.firestoreActiveCount += 1;
        }
        if (isActiveLike(row.stripe.status)) {
          acc.stripeActiveCount += 1;
        }
        if (row.source === 'bank' || row.source === 'mixed') {
          acc.bankCount += 1;
        }
        if (row.firestore.status === 'inactive' && row.source === 'none') {
          acc.inactiveCount += 1;
        }
        if (row.firestore.status === 'past_due' || row.stripe.status === 'past_due') {
          acc.pastDueCount += 1;
        }
        if (row.firestore.status === 'canceled' || row.stripe.status === 'canceled') {
          acc.canceledCount += 1;
        }
        if (row.mismatchReasons.length > 0) {
          acc.mismatchCount += 1;
        }
        if (row.expiresSoon) {
          acc.expiringWithin14DaysCount += 1;
        }
        if (row.firestore.termsAccepted) {
          acc.termsAcceptedCount += 1;
        }
        if (row.funnelStage === 'regist') {
          acc.registCount += 1;
          acc.preSubscriptionCount += 1;
        }
        if (row.funnelStage === 'termaccepted') {
          acc.termacceptedCount += 1;
          acc.preSubscriptionCount += 1;
        }
        if (row.funnelStage === 'subscribed') {
          acc.subscribedCount += 1;
        }
        return acc;
      },
      {
        totalUsers: 0,
        termsAcceptedCount: 0,
        registCount: 0,
        termacceptedCount: 0,
        preSubscriptionCount: 0,
        subscribedCount: 0,
        firestoreActiveCount: 0,
        stripeActiveCount: 0,
        bankCount: 0,
        inactiveCount: 0,
        pastDueCount: 0,
        canceledCount: 0,
        mismatchCount: 0,
        expiringWithin14DaysCount: 0,
      }
    );

    logger.info('Admin subscription dashboard generated.', {
      adminUid,
      totalUsers: summary.totalUsers,
      mismatchCount: summary.mismatchCount,
      truncated: usersPage.hasNextPage,
      pageSize,
      pageToken,
      serverQuery,
    });

    return {
      generatedAt: new Date().toISOString(),
      truncated: usersPage.hasNextPage,
      userLimit: pageSize,
      pageToken,
      nextPageToken: usersPage.nextPageToken,
      serverQuery,
      summaryScope: 'page',
      expiringSoonDays: EXPIRING_SOON_DAYS,
      summary,
      rows,
    };
  }
);
