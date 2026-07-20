// functions/src/handlers/stripe.ts
import admin from 'firebase-admin'; // db を使う場合は admin をインポート
import { logger } from 'firebase-functions';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import {
  appBaseUrlConfig,
  getAppPlanIdForStripePriceId,
  STRIPE_PRICE_ID_BASIC_MONTHLY, // 環境変数から読み込むための設定をインポート
  STRIPE_PRICE_ID_BASIC_MONTHLY_USD,
  STRIPE_PRICE_ID_HALF_YEARLY, // 環境変数から読み込むための設定をインポート
  STRIPE_PRICE_ID_YEARLY, // 環境変数から読み込むための設定をインポート
  getAdminNotificationEmail,
  stripeSecretKey,
  stripeWebhookSecret,
} from '../config';
import {
  getFirstMonthDiscountAmountOff,
  getFirstMonthDiscountCouponId,
  getFirstMonthDiscountPromotionCode,
  getOrCreateFirstMonthDiscountCoupon,
} from '../firstMonthDiscount';
import { getMailchimpTag } from '../mailchimpTag';
import { db, initializeStripeSDK } from '../utils'; // utilsからヘルパーとdbをインポート
import {
  getReferralLifetimeDiscountCouponId,
  qualifyReferralSubscription,
} from './referrals';

function getErrorLogFields(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

// 管理者通知の notice_Of 値。新規サブスク開始時にプラン別に出し分ける。
const NEW_SUBSCRIPTION_NOTICE_BY_PLAN: { [appPlanId: string]: string } = {
  basic_monthly: '新規monthly',
  half_yearly: '新規half_yearly',
  yearly: '新規yearly',
};
// notice_Of の候補に該当しないプラン／イベント向けの汎用メッセージ。
const ADMIN_NOTICE_FALLBACK = 'Stripeから通知がありました。内容はダッシュボードで確認してください。';
const ADMIN_NOTICE_CANCEL = 'キャンセル';

type PublicSubscriptionPrice = {
  planId: 'basic_monthly';
  unitAmount: number;
  currency: string;
  interval: 'month';
  intervalCount: number;
};

let usdMonthlyPriceCache: { expiresAt: number; price: PublicSubscriptionPrice } | null = null;

const isJapanesePreferredLanguage = (value: unknown): boolean =>
  value === undefined || value === null || value === 'ja';

const getStripePriceCurrency = (subscription: Stripe.Subscription): string | null => {
  const currency = subscription.items.data[0]?.price?.currency;
  return typeof currency === 'string' && currency !== '' ? currency.toLowerCase() : null;
};

function getSubscriptionItemPeriod(
  subscription: Stripe.Subscription,
  context: string
): {
  currentPeriodStart: admin.firestore.Timestamp | null;
  currentPeriodEnd: admin.firestore.Timestamp | null;
} {
  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    logger.warn(`Subscription ${subscription.id} does not have any items to derive period start/end.`, {
      context,
    });
    return { currentPeriodStart: null, currentPeriodEnd: null };
  }

  const currentPeriodStart =
    typeof firstItem.current_period_start === 'number'
      ? admin.firestore.Timestamp.fromMillis(firstItem.current_period_start * 1000)
      : null;
  const currentPeriodEnd =
    typeof firstItem.current_period_end === 'number'
      ? admin.firestore.Timestamp.fromMillis(firstItem.current_period_end * 1000)
      : null;

  if (!currentPeriodStart || !currentPeriodEnd) {
    logger.warn(`Subscription ${subscription.id} item period is not available.`, {
      context,
      subscriptionItemId: firstItem.id,
      hasCurrentPeriodStart: Boolean(currentPeriodStart),
      hasCurrentPeriodEnd: Boolean(currentPeriodEnd),
    });
  }

  return { currentPeriodStart, currentPeriodEnd };
}

/**
 * Stripe サブスクのライフサイクル（新規開始・キャンセル予約）を管理者へメール通知する。
 * - 宛先は ADMIN_NOTIFICATION_EMAIL（To）。未設定ならスキップ。
 * - Trigger Email 拡張が監視する `mail` コレクションへ書き込む。
 * - Stripe は同一イベントを再送するため event.id で冪等化し、二重送信を防ぐ。
 * - 通知失敗は webhook 本処理に影響させない（呼び出し側で握りつぶす）。
 */
async function sendAdminSubscriptionNotification(params: {
  eventId: string;
  noticeOf: string;
  userId?: string | null;
  userEmail?: string | null;
  displayName?: string | null;
  appPlanId?: string | null;
  stripePriceId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) {
    logger.info('ADMIN_NOTIFICATION_EMAIL is not set; skipping admin subscription notification.', {
      eventId: params.eventId,
      noticeOf: params.noticeOf,
    });
    return;
  }

  // 冪等化: 同一 event.id では一度だけ送信する。
  const dedupeRef = db.collection('adminStripeNotifications').doc(params.eventId);
  try {
    await dedupeRef.create({
      noticeOf: params.noticeOf,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.info('Admin subscription notification already sent for this event; skipping.', {
      eventId: params.eventId,
      noticeOf: params.noticeOf,
    });
    return;
  }

  await db.collection('mail').add({
    to: [adminEmail],
    template: {
      name: 'adminSubscriptionNotification',
      data: {
        notice_Of: params.noticeOf,
        userId: params.userId ?? '',
        userEmail: params.userEmail ?? '',
        displayName: params.displayName ?? '',
        planId: params.appPlanId ?? '',
        stripePriceId: params.stripePriceId ?? '',
        subscriptionId: params.subscriptionId ?? '',
      },
    },
  });
  logger.info('Admin subscription notification queued.', {
    eventId: params.eventId,
    noticeOf: params.noticeOf,
    userId: params.userId ?? '',
  });
}

/**
 * 日本語以外の画面で表示するUSD月額プランの公開価格情報を返す。
 * Price IDやStripeの秘密情報は返さず、画面表示に必要な値だけを公開する。
 */
export const getPublicSubscriptionPricing = onCall(
  { region: 'asia-northeast1', secrets: [stripeSecretKey] },
  async () => {
    if (usdMonthlyPriceCache && usdMonthlyPriceCache.expiresAt > Date.now()) {
      return { plans: [usdMonthlyPriceCache.price] };
    }

    const priceId = STRIPE_PRICE_ID_BASIC_MONTHLY_USD.value().trim();
    if (priceId === '') {
      logger.error('STRIPE_PRICE_ID_BASIC_MONTHLY_USD is not configured.');
      throw new HttpsError('failed-precondition', 'USDの月額プランは現在利用できません。');
    }

    const stripe = initializeStripeSDK();
    const price = await stripe.prices.retrieve(priceId);
    if (
      !price.active ||
      price.currency.toLowerCase() !== 'usd' ||
      price.type !== 'recurring' ||
      price.recurring?.interval !== 'month' ||
      typeof price.unit_amount !== 'number'
    ) {
      logger.error('Configured USD monthly Stripe Price is invalid.', {
        priceId,
        active: price.active,
        currency: price.currency,
        type: price.type,
        interval: price.recurring?.interval ?? null,
        hasUnitAmount: typeof price.unit_amount === 'number',
      });
      throw new HttpsError('failed-precondition', 'USDの月額プラン設定が正しくありません。');
    }

    const publicPrice: PublicSubscriptionPrice = {
      planId: 'basic_monthly',
      unitAmount: price.unit_amount,
      currency: price.currency.toUpperCase(),
      interval: 'month',
      intervalCount: price.recurring.interval_count,
    };
    usdMonthlyPriceCache = {
      expiresAt: Date.now() + 60 * 60 * 1000,
      price: publicPrice,
    };
    return { plans: [publicPrice] };
  }
);

/**
 * Stripe Checkoutセッションを作成するCallable Function (v2)
 * @param {onCall.CallableRequest<data>} request - フロントエンドから渡されるデータ
 * @param {string} request.data.planId - 選択されたプランのID
 * @returns {Promise<{sessionId: string}>} 作成されたCheckoutセッションのID
 */
export const createStripeCheckoutSession = onCall(
  { region: 'asia-northeast1', secrets: [stripeSecretKey] },
  async (request) => {
    const stripe = initializeStripeSDK();

    // 1. 認証チェック
    if (!request.auth) {
      logger.error('User is not authenticated.');
      throw new HttpsError('unauthenticated', 'この機能を利用するには認証が必要です。');
    }
    // request.authがundefinedでないことをTypeScriptに明確に伝えるため、ローカル変数に代入します。
    const authData = request.auth;

    const userId = authData.uid;
    const userEmail = authData.token.email;
    const { planId } = request.data;
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    const userData = userDoc.data() || {};
    const isJapaneseBilling = isJapanesePreferredLanguage(userData.preferredLanguage);
    const billingCurrency = isJapaneseBilling ? 'jpy' : 'usd';
    const checkoutDebugContext = {
      userId,
      planId,
      billingCurrency,
      preferredLanguage: userData.preferredLanguage ?? null,
      functionName: 'createStripeCheckoutSession',
    };

    if (!planId) {
      logger.error('planId is missing.');
      throw new HttpsError('invalid-argument', 'プランID (planId) が指定されていません。');
    }

    // 2. planIdに基づいてStripeのPrice IDを決定
    let priceId: string | undefined;

    // 環境変数からStripe Price IDを取得
    const basicMonthlyPriceId = STRIPE_PRICE_ID_BASIC_MONTHLY.value();
    const basicMonthlyUsdPriceId = STRIPE_PRICE_ID_BASIC_MONTHLY_USD.value().trim();
    const halfYearlyPriceId = STRIPE_PRICE_ID_HALF_YEARLY.value();
    const yearlyPriceId = STRIPE_PRICE_ID_YEARLY.value();

    if (planId === 'free') {
      logger.warn('Attempted to create checkout session for free plan.');
      throw new HttpsError('invalid-argument', '無料プランは決済セッションを作成できません。');
    } else if (!isJapaneseBilling && planId !== 'basic_monthly') {
      logger.warn('Non-Japanese checkout attempted to select an unavailable plan.', {
        ...checkoutDebugContext,
      });
      throw new HttpsError('failed-precondition', 'USDでは月額プランのみ利用できます。');
    } else if (planId === 'basic_monthly') {
      priceId = isJapaneseBilling ? basicMonthlyPriceId : basicMonthlyUsdPriceId;
    } else if (planId === 'half_yearly') {
      priceId = halfYearlyPriceId;
    } else if (planId === 'yearly') {
      priceId = yearlyPriceId;
    } else {
      // 上記以外の未知のplanId
      logger.error(`Unknown planId: ${planId}`);
      throw new HttpsError('not-found', `指定されたプランID (${planId}) は無効です。`);
    }

    logger.info('Stripe checkout request received.', {
      ...checkoutDebugContext,
      priceId,
      hasUserEmail: Boolean(userEmail),
    });

    // priceIdが取得できなかった場合 (環境変数が設定されていないなど、または上記の分岐で設定されなかった場合)
    if (!priceId) {
      logger.error('No Stripe Price ID configured for the selected plan and currency.', {
        ...checkoutDebugContext,
        hasBasicMonthlyPriceId: basicMonthlyPriceId !== '',
        hasBasicMonthlyUsdPriceId: basicMonthlyUsdPriceId !== '',
        hasHalfYearlyPriceId: halfYearlyPriceId !== '',
        hasYearlyPriceId: yearlyPriceId !== '',
      });
      throw new HttpsError(
        'failed-precondition',
        isJapaneseBilling
          ? `プランID (${planId}) に対応する価格設定がありません。`
          : 'USDの月額プランは現在利用できません。'
      );
    }

    const configuredPrice = await stripe.prices.retrieve(priceId);
    if (
      !configuredPrice.active ||
      configuredPrice.currency.toLowerCase() !== billingCurrency ||
      configuredPrice.type !== 'recurring' ||
      (!isJapaneseBilling && configuredPrice.recurring?.interval !== 'month')
    ) {
      logger.error('Selected Stripe Price does not match the requested billing market.', {
        ...checkoutDebugContext,
        priceId,
        active: configuredPrice.active,
        currency: configuredPrice.currency,
        type: configuredPrice.type,
        interval: configuredPrice.recurring?.interval ?? null,
      });
      throw new HttpsError('failed-precondition', 'Stripeの価格設定が正しくありません。');
    }

    const appBaseUrl = appBaseUrlConfig.value() || 'http://localhost:3000'; // デフォルトはローカル開発用

    try {
      // 3. Stripe Checkoutセッションを作成
      let customerId: string;
      if (userEmail) {
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        } else {
          const customer = await stripe.customers.create({
            email: userEmail,
            name: authData.token.name || '', // authDataを使用
            metadata: {
              firebaseUID: userId,
            },
          });
          customerId = customer.id;
        }
      } else {
        // メールアドレスがない場合の顧客作成 (匿名認証など)
        const customer = await stripe.customers.create({
          metadata: { firebaseUID: userId },
        });
        customerId = customer.id;
      }
      await userDocRef.set(
        {
          stripeCustomerId: customerId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const firstMonthDiscount = userData?.firstMonthDiscount;
      const referralLifetimeDiscountPercent =
        typeof userData?.referral?.lifetimeDiscountPercent === 'number'
          ? userData.referral.lifetimeDiscountPercent
          : null;
      const shouldPrioritizeReferralLifetimeDiscount =
        referralLifetimeDiscountPercent !== null && referralLifetimeDiscountPercent >= 100;
      if (shouldPrioritizeReferralLifetimeDiscount) {
        throw new HttpsError(
          'failed-precondition',
          '永久無料の利用権が適用済みのため、決済セッションは作成できません。'
        );
      }
      const discountExpiresAt = firstMonthDiscount?.expiresAt as
        | admin.firestore.Timestamp
        | undefined;
      const isFirstMonthDiscountActive =
        firstMonthDiscount?.status === 'eligible' &&
        discountExpiresAt &&
        discountExpiresAt.toMillis() > Date.now();
      let appliedPromotionCodeId: string | null = null;
      let referralLifetimeCouponId: string | null = null;

      logger.info('First month discount eligibility checked.', {
        ...checkoutDebugContext,
        customerId,
        discountStatus: firstMonthDiscount?.status ?? null,
        hasExpiresAt: Boolean(discountExpiresAt),
        expiresAtMillis: discountExpiresAt?.toMillis() ?? null,
        isFirstMonthDiscountActive: Boolean(isFirstMonthDiscountActive),
        savedCouponId: firstMonthDiscount?.couponId ?? null,
        savedAppliedPlanId: firstMonthDiscount?.appliedPlanId ?? null,
        savedPromotionCodeId: firstMonthDiscount?.promotionCodeId ?? null,
      });

      if (
        isJapaneseBilling &&
        isFirstMonthDiscountActive &&
        !shouldPrioritizeReferralLifetimeDiscount
      ) {
        const amountOff = await getFirstMonthDiscountAmountOff(planId);
        const couponId = await getOrCreateFirstMonthDiscountCoupon(stripe, planId, amountOff);
        const expectedCouponId = getFirstMonthDiscountCouponId(planId, amountOff);
        const existingPromotionCodeId = firstMonthDiscount.promotionCodeId as string | undefined;
        const existingPromotionCodePlanId = firstMonthDiscount.appliedPlanId as string | undefined;

        logger.info('First month discount coupon resolved.', {
          ...checkoutDebugContext,
          amountOff,
          couponId,
          expectedCouponId,
          existingPromotionCodeId: existingPromotionCodeId ?? null,
          existingPromotionCodePlanId: existingPromotionCodePlanId ?? null,
        });

        if (!amountOff || !couponId) {
          logger.warn('No first month discount configured for selected plan.', {
            ...checkoutDebugContext,
            amountOff,
            couponId,
          });
        } else if (existingPromotionCodeId && existingPromotionCodePlanId === planId) {
          try {
            const promotionCode = await stripe.promotionCodes.retrieve(existingPromotionCodeId, {
              expand: ['promotion.coupon'],
            });
            const promotionCodeCoupon = promotionCode.promotion.coupon;
            const promotionCodeCouponId =
              typeof promotionCodeCoupon === 'string'
                ? promotionCodeCoupon
                : (promotionCodeCoupon?.id ?? null);
            logger.info('Saved promotion code retrieved from Stripe.', {
              ...checkoutDebugContext,
              promotionCodeId: promotionCode.id,
              promotionCodeActive: promotionCode.active,
              promotionCodeCustomer: promotionCode.customer,
              promotionCodeCouponId,
              expectedCouponId,
            });
            if (
              promotionCode.active &&
              promotionCode.customer === customerId &&
              promotionCodeCouponId === expectedCouponId
            ) {
              appliedPromotionCodeId = promotionCode.id;
              logger.info('Saved promotion code will be applied to Checkout.', {
                ...checkoutDebugContext,
                appliedPromotionCodeId,
              });
            } else {
              logger.warn('Saved promotion code did not match current checkout context.', {
                ...checkoutDebugContext,
                promotionCodeId: promotionCode.id,
                promotionCodeActive: promotionCode.active,
                promotionCodeCustomer: promotionCode.customer,
                customerId,
                promotionCodeCouponId,
                expectedCouponId,
              });
            }
          } catch (retrieveError: any) {
            logger.warn('Failed to retrieve existing promotion code from Stripe. Will recreate.', {
              ...checkoutDebugContext,
              existingPromotionCodeId,
              message:
                retrieveError instanceof Error
                  ? retrieveError.message
                  : 'Unknown promotion code retrieval error.',
            });
          }
        }

        if (amountOff && couponId && !appliedPromotionCodeId) {
          const promotionCodeValue = getFirstMonthDiscountPromotionCode(userId, planId);
          const existingPromotionCodes = await stripe.promotionCodes.list({
            code: promotionCodeValue,
            active: true,
            customer: customerId,
            limit: 100,
          });

          logger.info('Promotion code lookup completed.', {
            ...checkoutDebugContext,
            promotionCodeValue,
            existingPromotionCodeCount: existingPromotionCodes.data.length,
            customerId,
          });

          const getCodeCouponId = (code: Stripe.PromotionCode): string | null => {
            const c = code.promotion.coupon;
            return typeof c === 'string' ? c : (c?.id ?? null);
          };

          let promotionCode = existingPromotionCodes.data.find((code) => {
            const promotionCodeCouponId = getCodeCouponId(code);
            return code.customer === customerId && promotionCodeCouponId === expectedCouponId;
          });

          const conflictingPromotionCodes = existingPromotionCodes.data.filter((code) => {
            const promotionCodeCouponId = getCodeCouponId(code);
            return code.customer === customerId && promotionCodeCouponId !== expectedCouponId;
          });

          for (const conflictingPromotionCode of conflictingPromotionCodes) {
            const promotionCodeCouponId = getCodeCouponId(conflictingPromotionCode);
            logger.info('Deactivating stale Stripe promotion code before recreating.', {
              ...checkoutDebugContext,
              promotionCodeId: conflictingPromotionCode.id,
              promotionCodeValue,
              promotionCodeCouponId,
              expectedCouponId,
              customerId,
            });
            await stripe.promotionCodes.update(conflictingPromotionCode.id, { active: false });
          }

          if (!promotionCode) {
            const promotionExpiresAt = Math.max(
              Math.floor(discountExpiresAt.toMillis() / 1000),
              Math.floor(Date.now() / 1000) + 3600
            );
            logger.info('Creating Stripe promotion code for first month discount.', {
              ...checkoutDebugContext,
              promotionCodeValue,
              couponId,
              customerId,
              expiresAtUnix: promotionExpiresAt,
            });
            promotionCode = await stripe.promotionCodes.create({
              promotion: { coupon: couponId, type: 'coupon' },
              code: promotionCodeValue,
              customer: customerId,
              expires_at: promotionExpiresAt,
              max_redemptions: 1,
              metadata: {
                firebaseUID: userId,
                planId,
                source: 'google_new_user_first_month',
              },
            });
          } else {
            logger.info('Existing Stripe promotion code will be reused.', {
              ...checkoutDebugContext,
              promotionCodeId: promotionCode.id,
              promotionCodeValue,
              couponId,
              customerId,
            });
          }
          appliedPromotionCodeId = promotionCode.id;
          await userDocRef.set(
            {
              firstMonthDiscount: {
                ...firstMonthDiscount,
                amountOff,
                couponId,
                appliedPlanId: planId,
                promotionCodeId: promotionCode.id,
                promotionCode: promotionCode.code,
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          logger.info('First month discount promotion code saved to Firestore.', {
            ...checkoutDebugContext,
            amountOff,
            couponId,
            appliedPlanId: planId,
            promotionCodeId: promotionCode.id,
          });
        }
      } else if (
        isJapaneseBilling &&
        firstMonthDiscount?.status === 'eligible' &&
        discountExpiresAt
      ) {
        await userDocRef.set(
          {
            firstMonthDiscount: {
              ...firstMonthDiscount,
              status: 'expired',
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        logger.info('First month discount marked as expired before Checkout.', {
          ...checkoutDebugContext,
          expiresAtMillis: discountExpiresAt.toMillis(),
        });
      }

      if (
        isJapaneseBilling &&
        referralLifetimeDiscountPercent !== null &&
        referralLifetimeDiscountPercent >= 50 &&
        !appliedPromotionCodeId
      ) {
        referralLifetimeCouponId = await getReferralLifetimeDiscountCouponId(stripe);
        logger.info('Referral lifetime discount will be applied to Checkout.', {
          ...checkoutDebugContext,
          referralLifetimeCouponId,
          referralLifetimeDiscountPercent,
        });
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${appBaseUrl}/profile?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/profile?payment_canceled=true`,
        client_reference_id: userId,
        metadata: {
          appPlanId: planId,
          billingCurrency,
          preferredLanguage:
            typeof userData.preferredLanguage === 'string' ? userData.preferredLanguage : 'ja',
          firstMonthDiscountApplied: appliedPromotionCodeId ? 'true' : 'false',
          referralLifetimeDiscountApplied: referralLifetimeCouponId ? 'true' : 'false',
          referralLifetimeDiscountPercent:
            referralLifetimeDiscountPercent !== null ? String(referralLifetimeDiscountPercent) : '',
        },
      };

      if (appliedPromotionCodeId) {
        sessionParams.discounts = [{ promotion_code: appliedPromotionCodeId }];
      } else if (referralLifetimeCouponId) {
        sessionParams.discounts = [{ coupon: referralLifetimeCouponId }];
      } else if (isJapaneseBilling) {
        sessionParams.allow_promotion_codes = true;
      }

      logger.info('Creating Stripe Checkout session.', {
        ...checkoutDebugContext,
        customerId,
        priceId,
        firstMonthDiscountApplied: Boolean(appliedPromotionCodeId),
        appliedPromotionCodeId,
        referralLifetimeCouponId,
        discounts: sessionParams.discounts ?? null,
        allowPromotionCodes: sessionParams.allow_promotion_codes ?? false,
        successUrl: sessionParams.success_url,
        cancelUrl: sessionParams.cancel_url,
      });

      const session = await stripe.checkout.sessions.create(sessionParams);

      logger.info('Stripe Checkout session created.', {
        ...checkoutDebugContext,
        sessionId: session.id,
        customerId,
        priceId,
        firstMonthDiscountApplied: Boolean(appliedPromotionCodeId),
        appliedPromotionCodeId,
        sessionUrlExists: Boolean(session.url),
      });
      if (!session.url) {
        logger.error('Stripe Checkout session URL was not returned.', {
          ...checkoutDebugContext,
          sessionId: session.id,
        });
        throw new HttpsError('internal', 'Stripe CheckoutセッションURLの取得に失敗しました。');
      }

      return { sessionId: session.id, url: session.url };
    } catch (error: any) {
      logger.error('Error creating Stripe Checkout session.', {
        ...checkoutDebugContext,
        errorName: error?.name,
        errorType: error?.type,
        errorCode: error?.code,
        declineCode: error?.decline_code,
        param: error?.param,
        statusCode: error?.statusCode,
        message: error?.message,
        rawMessage: error?.raw?.message,
        rawType: error?.raw?.type,
        rawCode: error?.raw?.code,
        rawParam: error?.raw?.param,
      });
      throw new HttpsError(
        'internal',
        'Stripe Checkoutセッションの作成に失敗しました。',
        error.message
      );
    }
  }
);

// createStripePortalLink 関数の実装...
export const createStripePortalLink = onCall(
  { region: 'asia-northeast1', secrets: [stripeSecretKey] },
  async (request) => {
    // ユーザーが認証されているか確認
    if (!request.auth || !request.auth.uid) {
      logger.error('User not authenticated for createStripePortalLink');
      throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const userId = request.auth.uid;
    logger.info(`Creating Stripe portal link for user: ${userId}`);
    let stripe: Stripe;
    try {
      stripe = initializeStripeSDK();
    } catch (error: any) {
      // initializeStripeSDK からのエラーをキャッチして HttpsError として再スロー
      logger.error('Failed to initialize Stripe SDK for createStripePortalLink:', error.message);
      throw new HttpsError('internal', 'Server configuration error.', error.message);
    }

    try {
      // FirestoreからユーザーのStripe顧客IDを取得
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        logger.error(`User document not found for user: ${userId}`);
        throw new HttpsError('not-found', 'User document not found.');
      }

      const stripeCustomerId = userDoc.data()?.stripeCustomerId;
      if (!stripeCustomerId) {
        logger.error(`Stripe customer ID not found for user: ${userId}`);
        throw new HttpsError('failed-precondition', 'Stripe customer ID not found for the user.');
      }

      // Stripe Customer Portalセッションを作成
      // return_url は、ポータルでの操作完了後にユーザーが戻ってくるURL
      const appBaseUrl = appBaseUrlConfig.value();
      if (!appBaseUrl) {
        logger.error('APP_URL (appBaseUrlConfig) is not configured for createStripePortalLink.');
        throw new HttpsError(
          'internal',
          'Server configuration error: Application base URL is not set.'
        );
      }
      const returnUrl = `${appBaseUrl}/profile?session_id={CHECKOUT_SESSION_ID}`;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });

      logger.info(`Stripe portal session created for user ${userId}: ${portalSession.url}`);
      return { url: portalSession.url };
    } catch (error: any) {
      logger.error(`Error creating Stripe portal session for user ${userId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to create Stripe portal session.', error.message);
    }
  }
);

// stripeWebhookHandler 関数の実装...
export const stripeWebhookHandler = onRequest(
  { region: 'asia-northeast1', secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (request, response) => {
    let stripe: Stripe;
    try {
      stripe = initializeStripeSDK();
    } catch (error: any) {
      logger.error('Failed to initialize Stripe SDK for webhook:', error.message);
      response.status(500).send('Server configuration error: Stripe SDK initialization failed.');
      return;
    }

    const webhookSecretValue = stripeWebhookSecret.value();
    if (!webhookSecretValue) {
      logger.error('Stripe Webhook secret (STRIPE_WEBHOOK_SECRET) is not configured or is empty.');
      response.status(500).send('Server configuration error: Webhook secret missing.');
      return;
    }

    const sig = request.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      // Webhook署名を検証してイベントを構築
      // request.rawBody を使用するために、body-parserなどのミドルウェアが
      // リクエストボディをパースする前に rawBody を取得する必要がある。
      // Firebase Functions v2 (onRequest) では、request.rawBody が利用可能。
      if (!request.rawBody) {
        logger.error('Webhook error: Missing rawBody for signature verification.');
        response.status(400).send('Webhook error: Missing rawBody.');
        return;
      }
      event = stripe.webhooks.constructEvent(request.rawBody, sig, webhookSecretValue);
      logger.info(`Received Stripe event: ${event.type}, ID: ${event.id}`);
    } catch (err: any) {
      logger.error(`⚠️ Webhook signature verification failed.`, err.message);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // 特定のイベントタイプを処理
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        logger.info(
          `Checkout session completed for user: ${session.client_reference_id}, session_id: ${session.id}, subscription_id: ${session.subscription}`
        );
        // client_reference_id に Firebase User ID を設定した場合
        const userId = session.client_reference_id; // Firebase User ID
        // session.subscription / session.customer は string | object | null のため安全に ID を取り出す
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id ?? null;
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer as Stripe.Customer | null)?.id ?? null;

        if (userId && subscriptionId && customerId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            if (!subscription) {
              logger.error(`Could not retrieve subscription ${subscriptionId} from Stripe.`);
              break;
            }

            const subscriptionStatus = subscription.status;
            const stripePriceId = // StripeのPrice ID
              subscription.items.data.length > 0 ? subscription.items.data[0].price.id : null;
            const appPlanId = stripePriceId
              ? getAppPlanIdForStripePriceId(stripePriceId)
              : null; // アプリ内プランID

            let currentPeriodEnd: admin.firestore.Timestamp | null = null;
            let currentPeriodStart: admin.firestore.Timestamp | null = null;

            ({ currentPeriodStart, currentPeriodEnd } = getSubscriptionItemPeriod(
              subscription,
              'checkout.session.completed'
            ));

            const userDocRef = db.collection('users').doc(userId);
            const userDocSnap = await userDocRef.get();
            const dataToUpdate: any = {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus,
            };
            if (session.metadata?.firstMonthDiscountApplied === 'true') {
              const existingFirstMonthDiscount = userDocSnap.data()?.firstMonthDiscount;
              dataToUpdate.firstMonthDiscount = {
                ...(existingFirstMonthDiscount && typeof existingFirstMonthDiscount === 'object'
                  ? existingFirstMonthDiscount
                  : {}),
                status: 'redeemed',
                checkoutSessionId: session.id,
                redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
            }
            if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
              dataToUpdate.applyMailchimpTag = getMailchimpTag('subscribed');
            }
            if (stripePriceId) {
              dataToUpdate.stripePriceId = stripePriceId; // StripeのPrice IDを保存
            }
            if (appPlanId) {
              const lifetimePercent = userDocSnap.data()?.referral?.lifetimeDiscountPercent;
              dataToUpdate.appPlanId =
                typeof lifetimePercent === 'number' && lifetimePercent >= 100
                  ? 'lifetime'
                  : appPlanId; // アプリ内プランIDを保存
            } else if (stripePriceId) {
              // マッピングにないPrice IDの場合の警告
              logger.warn(
                `No appPlanId mapping found for stripePriceId: ${stripePriceId} for user ${userId}. Storing stripePriceId only.`
              );
            }
            if (currentPeriodEnd) {
              dataToUpdate.currentPeriodEnd = currentPeriodEnd;
            }
            if (currentPeriodStart) {
              dataToUpdate.currentPeriodStart = currentPeriodStart;
            }
            logger.info(
              `Attempting to update Firestore for user ${userId} with data:`,
              dataToUpdate
            );
            await userDocRef.set(dataToUpdate, { merge: true }); // updateからset + merge: true に変更してドキュメントが存在しない場合も対応
            logger.info(
              `User ${userId} data updated from checkout.session.completed. StripeCustomerId: ${customerId}, Status: ${subscriptionStatus}, StripePriceID: ${stripePriceId}, AppPlanID: ${appPlanId}`
            );
            if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
              try {
                await qualifyReferralSubscription({
                  referredUid: userId,
                  source: 'stripe',
                  stripe,
                  currency: getStripePriceCurrency(subscription),
                });
              } catch (error) {
                logger.error('Failed to qualify referral subscription from checkout session.', {
                  userId,
                  ...getErrorLogFields(error),
                });
              }

              // 管理者へ「新規サブスク開始」を通知（プラン別 notice_Of、該当外は汎用文）。
              try {
                const newUserData = userDocSnap.data() || {};
                await sendAdminSubscriptionNotification({
                  eventId: event.id,
                  noticeOf:
                    (appPlanId && NEW_SUBSCRIPTION_NOTICE_BY_PLAN[appPlanId]) ||
                    ADMIN_NOTICE_FALLBACK,
                  userId,
                  userEmail: newUserData.email ?? session.customer_details?.email ?? null,
                  displayName: newUserData.displayName ?? null,
                  appPlanId,
                  stripePriceId,
                  subscriptionId,
                });
              } catch (error) {
                logger.error('Failed to send admin notification for new subscription.', {
                  userId,
                  eventId: event.id,
                  ...getErrorLogFields(error),
                });
              }
            }
          } catch (dbError) {
            logger.error(`Error updating Firestore for user ${userId} after checkout:`, dbError);
          }
        } else {
          logger.warn(
            'Checkout session completed but missing userId, subscriptionId, or customerId.',
            session
          );
        }
        break;
      }
      // customer.subscription.created と customer.subscription.updated は同様の処理を行う
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : (subscription.customer as Stripe.Customer | null)?.id ?? null;
        if (!customerId) {
          logger.error(
            `Missing customerId in subscription ${subscription.id} for event ${event.type}. Cannot update Firestore.`
          );
          break;
        }
        logger.info(
          `Subscription event: ${event.type} for customer ${customerId}, subscription ${subscription.id}, status ${subscription.status}, items:`,
          subscription.items.data
        );
        // stripeSubscriptionId でユーザーを検索（同一 stripeCustomerId を複数ユーザーが持つ場合でも正確に特定できる）
        const usersRef = db.collection('users');
        let querySnapshot = await usersRef
          .where('stripeSubscriptionId', '==', subscription.id)
          .limit(1)
          .get();

        if (querySnapshot.empty) {
          // フォールバック: サブスクリプション作成直後など stripeSubscriptionId がまだ書き込まれていない場合
          logger.warn(
            `No user found with stripeSubscriptionId: ${subscription.id} for event ${event.type}. Falling back to stripeCustomerId lookup.`
          );
          querySnapshot = await usersRef
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
        }

        if (querySnapshot.empty) {
          logger.warn(
            `No user found with stripeCustomerId: ${customerId} for event ${event.type}. This might be an event order issue.`
          );
          break;
        }

        const userDoc = querySnapshot.docs[0];
        const userId = userDoc.id;
        const userDocRef = userDoc.ref;
        const userData = userDoc.data(); // 既存のユーザーデータを取得
        logger.info(
          `[Debug UserData for ${userId}] Before processing event ${event.id}:`,
          JSON.stringify(userData)
        );

        const dataToUpdate: any = {
          stripeSubscriptionId: subscription.id, // 念のため更新
        };

        // Handle subscription cancellation scheduling.
        // Only update cancelAtPeriodEnd when cancellation-related fields actually changed,
        // to avoid a concurrent unrelated subscription.updated event overwriting a
        // cancelAtPeriodEnd: true that a prior cancellation event just wrote.
        // Stripe dahlia API: Billing Portal cancellation sets `cancel_at` (timestamp) rather
        // than `cancel_at_period_end`, so we detect both fields in previous_attributes.
        const prevAttrs = event.data.previous_attributes as Record<string, unknown> | undefined;
        logger.info(
          `[Debug prevAttrs for event ${event.id}]:`,
          JSON.stringify(prevAttrs ?? null)
        );
        const cancelAtPeriodEndChanged =
          prevAttrs != null && 'cancel_at_period_end' in prevAttrs;
        const cancelAtChanged = prevAttrs != null && 'cancel_at' in prevAttrs;
        if (cancelAtPeriodEndChanged || cancelAtChanged) {
          // In dahlia API, "cancel at period end" sets cancel_at to the period end timestamp.
          // Treat either a truthy cancel_at_period_end OR a non-null cancel_at as "scheduled to cancel".
          const isScheduledToCancel = !!(
            subscription.cancel_at_period_end ||
            (subscription as any).cancel_at != null
          );
          dataToUpdate.cancelAtPeriodEnd = isScheduledToCancel;
          if (isScheduledToCancel) {
            logger.info(
              `User ${userId} (customer ${customerId}) scheduled subscription cancellation at period end.`
            );
            dataToUpdate.canceledAt = subscription.canceled_at
              ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000)
              : admin.firestore.FieldValue.serverTimestamp();

            // 管理者へ「キャンセル（期末解約予約）」を通知。
            try {
              await sendAdminSubscriptionNotification({
                eventId: event.id,
                noticeOf: ADMIN_NOTICE_CANCEL,
                userId,
                userEmail: userData?.email ?? null,
                displayName: userData?.displayName ?? null,
                appPlanId: userData?.appPlanId ?? null,
                stripePriceId: userData?.stripePriceId ?? null,
                subscriptionId: subscription.id,
              });
            } catch (error) {
              logger.error('Failed to send admin notification for subscription cancellation.', {
                userId,
                eventId: event.id,
                ...getErrorLogFields(error),
              });
            }
          } else {
            // Cancellation schedule was removed
            dataToUpdate.canceledAt = admin.firestore.FieldValue.delete();
          }
        } else {
          logger.info(
            `cancel_at_period_end/cancel_at not in previous_attributes for event ${event.id}; skipping cancelAtPeriodEnd update.`
          );
        }

        const subscriptionStatus = subscription.status; //例: 'active', 'trialing', 'canceled', 'past_due', 'unpaid'
        dataToUpdate.subscriptionStatus = subscriptionStatus;
        if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
          dataToUpdate.applyMailchimpTag = getMailchimpTag('subscribed');
        } else if (
          subscriptionStatus === 'canceled' ||
          subscriptionStatus === 'incomplete_expired' ||
          subscriptionStatus === 'unpaid'
        ) {
          dataToUpdate.applyMailchimpTag = getMailchimpTag('cancelled');
        }

        // StripeのPrice IDを取得 (通常は最初のアイテム)
        const stripePriceId =
          subscription.items.data.length > 0 ? subscription.items.data[0].price.id : null;
        const appPlanId = stripePriceId
          ? getAppPlanIdForStripePriceId(stripePriceId)
          : null;

        if (stripePriceId) {
          dataToUpdate.stripePriceId = stripePriceId;
        }
        if (appPlanId) {
          const lifetimePercent = userData?.referral?.lifetimeDiscountPercent;
          dataToUpdate.appPlanId =
            typeof lifetimePercent === 'number' && lifetimePercent >= 100 ? 'lifetime' : appPlanId;
        } else if (stripePriceId) {
          logger.warn(
            `No appPlanId mapping found for stripePriceId: ${stripePriceId} for user ${userId} (customer ${customerId}) on event ${event.type}. Storing stripePriceId only.`
          );
        }

        let currentPeriodEnd: admin.firestore.Timestamp | null = null;
        let currentPeriodStart: admin.firestore.Timestamp | null = null;

        ({ currentPeriodStart, currentPeriodEnd } = getSubscriptionItemPeriod(
          subscription,
          event.type
        ));

        if (currentPeriodStart) {
          dataToUpdate.currentPeriodStart = currentPeriodStart;
        }
        if (currentPeriodEnd) {
          dataToUpdate.currentPeriodEnd = currentPeriodEnd;
        }

        // --- pendingPlanChange の処理 ---
        const previousAttributes = event.data.previous_attributes;
        let previousStripePriceId: string | null = null;

        if (previousAttributes && previousAttributes.items) {
          // previous_attributes.items.data が配列であることを期待
          // StripeのAPIバージョンやイベントの具体的な内容によって構造が異なる可能性に注意
          const previousItems = previousAttributes.items as
            | Stripe.ApiList<Stripe.SubscriptionItem>
            | undefined;
          if (previousItems && previousItems.data && previousItems.data.length > 0) {
            // 最初のアイテムの価格IDを取得
            // price オブジェクト全体が previous_attributes に含まれるか、price ID のみかを確認
            const prevItemPrice = previousItems.data[0].price;
            if (prevItemPrice && typeof prevItemPrice === 'object' && prevItemPrice.id) {
              previousStripePriceId = prevItemPrice.id;
            } else if (typeof prevItemPrice === 'string') {
              // price がID文字列の場合 (古いAPIバージョンなど)
              previousStripePriceId = prevItemPrice;
            }
          }
        } else if (
          userData?.stripePriceId &&
          stripePriceId &&
          userData.stripePriceId !== stripePriceId
        ) {
          // previous_attributes.items がない場合、Firestoreの現在の値と比較
          previousStripePriceId = userData.stripePriceId;
        }
        logger.info(
          `[Debug Plan IDs for ${userId}] Event ${event.id}: previousStripePriceId determined as: ${previousStripePriceId}, current event stripePriceId: ${stripePriceId}`
        );

        if (previousStripePriceId && stripePriceId && previousStripePriceId !== stripePriceId) {
          // プラン変更があった場合
          logger.info(
            `Plan change detected for user ${userId}. From: ${previousStripePriceId}, To: ${stripePriceId}. Effective date will be currentPeriodEnd.`
          );
          if (currentPeriodEnd) {
            // currentPeriodEnd がないと発効日が不明確
            dataToUpdate.pendingPlanChange = {
              fromPlanId: previousStripePriceId,
              toPlanId: stripePriceId,
              effectiveDate: currentPeriodEnd, // この時点での currentPeriodEnd を発効予定日とする
            };
            logger.info(
              `Setting pendingPlanChange for user ${userId}:`,
              dataToUpdate.pendingPlanChange
            );
          } else {
            logger.warn(
              `Cannot set pendingPlanChange for user ${userId} because currentPeriodEnd is not available.`
            );
          }
        } else if (
          userData?.pendingPlanChange &&
          stripePriceId === userData.pendingPlanChange.toPlanId
        ) {
          // 予定されていたプラン変更が適用された場合
          logger.info(
            `Pending plan change to ${stripePriceId} applied for user ${userId}. Clearing pendingPlanChange.`
          );
          dataToUpdate.pendingPlanChange = admin.firestore.FieldValue.delete(); // pendingPlanChange を削除
        } else if (
          userData?.pendingPlanChange &&
          stripePriceId !== userData.pendingPlanChange.toPlanId &&
          event.type === 'customer.subscription.updated'
        ) {
          // ユーザーが保留中のプラン変更をキャンセル、または別のプランに再度変更した場合など
          logger.info(
            `Pending plan change for user ${userId} seems to be outdated or canceled. Clearing pendingPlanChange.`
          );
          dataToUpdate.pendingPlanChange = admin.firestore.FieldValue.delete();
        }

        logger.info(
          `[Firestore write] user ${userId} event ${event.type} dataToUpdate:`,
          JSON.stringify(dataToUpdate)
        );
        try {
          await userDocRef.set(dataToUpdate, { merge: true });
          logger.info(
            `Updated subscription details for user ${userId} (customer ${customerId}) for event ${event.type}. Status: ${subscriptionStatus}, cancelAtPeriodEnd: ${subscription.cancel_at_period_end}, StripePriceID: ${stripePriceId}, AppPlanID: ${appPlanId}`
          );
          if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
            try {
              await qualifyReferralSubscription({
                referredUid: userId,
                source: 'stripe',
                stripe,
                currency: getStripePriceCurrency(subscription),
              });
            } catch (error) {
              logger.error('Failed to qualify referral subscription from subscription webhook.', {
                userId,
                eventType: event.type,
                ...getErrorLogFields(error),
              });
            }
          }
        } catch (dbError) {
          logger.error(
            `Error updating Firestore for user ${userId} (customer ${customerId}) on event ${event.type}:`,
            dbError
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : (subscription.customer as Stripe.Customer | null)?.id ?? null;
        if (!customerId) {
          logger.error(
            `Missing customerId in subscription ${subscription.id} for event ${event.type}. Cannot update Firestore.`
          );
          break;
        }
        logger.info(
          `Subscription DELETED for customer ${customerId}, subscription ${subscription.id}`
        );
        // stripeSubscriptionId でユーザーを検索（同一 stripeCustomerId を複数ユーザーが持つ場合でも正確に特定できる）
        const usersRef = db.collection('users');
        let querySnapshot = await usersRef
          .where('stripeSubscriptionId', '==', subscription.id)
          .limit(1)
          .get();

        if (querySnapshot.empty) {
          logger.warn(
            `No user found with stripeSubscriptionId: ${subscription.id} for event ${event.type}. Falling back to stripeCustomerId lookup.`
          );
          querySnapshot = await usersRef
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
        }

        if (querySnapshot.empty) {
          logger.error(
            `No user found with stripeCustomerId: ${customerId} for event ${event.type}`
          );
          break;
        }
        const userDoc = querySnapshot.docs[0];
        const userId = userDoc.id;
        const userDocRef = userDoc.ref;
        const userData = userDoc.data();
        const isLifetimeFreeUser =
          userData?.appPlanId === 'lifetime' ||
          (typeof userData?.referral?.lifetimeDiscountPercent === 'number' &&
            userData.referral.lifetimeDiscountPercent >= 100);

        const dataToUpdate: any = isLifetimeFreeUser
          ? {
              appPlanId: 'lifetime',
              subscriptionStatus: 'active',
              applyMailchimpTag: getMailchimpTag('subscribed'),
            }
          : {
              subscriptionStatus: 'canceled', // または 'inactive' などアプリの仕様に合わせて
              applyMailchimpTag: getMailchimpTag('cancelled'),
            };
        Object.assign(dataToUpdate, {
          stripePriceId: admin.firestore.FieldValue.delete(), // Stripe Price IDを削除
          currentPeriodEnd: null, // 期間終了日をクリア
          currentPeriodStart: null, // 期間開始日もクリア
          cancelAtPeriodEnd: admin.firestore.FieldValue.delete(), // キャンセル予約フラグも削除
          pendingPlanChange: admin.firestore.FieldValue.delete(), // 保留中のプラン変更も削除
          stripeSubscriptionId: admin.firestore.FieldValue.delete(), // Stripe Subscription IDを削除
        });

        // Record when the cancellation was requested and when it actually ended
        if (subscription.canceled_at) {
          dataToUpdate.canceledAt = admin.firestore.Timestamp.fromMillis(
            subscription.canceled_at * 1000
          );
        }
        if (subscription.ended_at) {
          dataToUpdate.endedAt = admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000);
        }

        try {
          await userDocRef.set(dataToUpdate, { merge: true });
          logger.info(`DELETED (canceled) subscription for user ${userId}.`);
        } catch (dbError) {
          logger.error(`Error updating Firestore for user ${userId} on DELETED event:`, dbError);
        }

        break;
      }
      // --- 支払い失敗関連のイベント処理 ---
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        let subscriptionId: string | null = null;

        // Attempt to get subscriptionId from various possible locations within the Invoice object

        // 1. Try from invoice.parent.subscription_details.subscription
        // According to Invoices.d.ts, invoice.parent can be Invoice.Parent | null
        // and Invoice.Parent.subscription_details can be Parent.SubscriptionDetails | null
        // and Parent.SubscriptionDetails.subscription can be string | Stripe.Subscription
        if (
          invoice.parent &&
          invoice.parent.type === 'subscription_details' &&
          invoice.parent.subscription_details
        ) {
          const subDetailsSubscription = invoice.parent.subscription_details.subscription;
          if (typeof subDetailsSubscription === 'string') {
            subscriptionId = subDetailsSubscription;
          } else if (subDetailsSubscription && subDetailsSubscription.id) {
            // Expanded Subscription object
            subscriptionId = subDetailsSubscription.id;
          }
        }

        // 2. If not found, try from the first line item's 'subscription' property
        // According to InvoiceLineItems.d.ts, InvoiceLineItem.subscription can be string | Stripe.Subscription | null
        if (!subscriptionId && invoice.lines?.data?.length > 0) {
          const firstLineItem = invoice.lines.data[0];
          if (firstLineItem.subscription) {
            if (typeof firstLineItem.subscription === 'string') {
              subscriptionId = firstLineItem.subscription;
            } else if (firstLineItem.subscription.id) {
              // Expanded Subscription object
              subscriptionId = firstLineItem.subscription.id;
            }
          }
        }

        // 3. Fallback: Try from first line item's parent.subscription_item_details.subscription
        // This was observed in the provided JSON for evt_1RPEiyPhCspTvNYmPtNsiuDZ
        // According to InvoiceLineItems.d.ts, firstLine.parent can be InvoiceLineItem.Parent | null
        // and InvoiceLineItem.Parent.subscription_item_details can be Parent.SubscriptionItemDetails | null
        // and Parent.SubscriptionItemDetails.subscription is string | null (not an expanded object here)
        if (!subscriptionId && invoice.lines?.data?.length > 0) {
          const firstLine = invoice.lines.data[0];
          if (
            firstLine.parent &&
            firstLine.parent.type === 'subscription_item_details' &&
            firstLine.parent.subscription_item_details
          ) {
            if (firstLine.parent.subscription_item_details.subscription) {
              subscriptionId = firstLine.parent.subscription_item_details.subscription;
            }
          }
        }

        logger.warn(
          `Processing invoice.payment_failed for customer ${customerId}, subscription ${subscriptionId || 'N/A'}, invoice ${invoice.id}. Billing reason: ${invoice.billing_reason}, Attempt count: ${invoice.attempt_count}, Next attempt: ${invoice.next_payment_attempt}`
        );

        if (customerId && subscriptionId) {
          logger.info(
            `Found customerId (${customerId}) and subscriptionId (${subscriptionId}) for invoice.payment_failed.`
          );
          const usersRef = db.collection('users');
          const querySnapshot = await usersRef
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

          if (querySnapshot.empty) {
            logger.error(
              `No user found with stripeCustomerId: ${customerId} for event ${event.type} (invoice.payment_failed).`
            );
            break;
          }
          const userDoc = querySnapshot.docs[0];
          const userId = userDoc.id;
          const userDocRef = userDoc.ref;
          logger.info(
            `User ${userId} found for invoice.payment_failed. Attempting to retrieve subscription ${subscriptionId}.`
          );

          // Stripeから最新のサブスクリプション情報を取得してステータスを確認
          // invoice.payment_failed イベントだけではサブスクリプションのステータスが即座に past_due になるとは限らないため
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            if (subscription) {
              const dataToUpdate: any = {
                subscriptionStatus: subscription.status, // 'active', 'past_due', 'unpaid' など
              };
              // 支払い失敗の理由や次回試行日などをFirestoreに保存することも検討可能
              // dataToUpdate.lastPaymentFailure = {
              //   invoiceId: invoice.id,
              //   reason: invoice.last_payment_error?.message || 'Unknown',
              //   nextAttempt: invoice.next_payment_attempt ? admin.firestore.Timestamp.fromMillis(invoice.next_payment_attempt * 1000) : null,
              //   attemptCount: invoice.attempt_count
              // };

              await userDocRef.update(dataToUpdate);
              logger.info(
                `Updated subscription status to ${subscription.status} for user ${userId} (customer ${customerId}) due to invoice.payment_failed (invoice ${invoice.id}).`
              );
            } else {
              logger.error(
                `Could not retrieve subscription ${subscriptionId} from Stripe after invoice.payment_failed.`
              );
            }
          } catch (stripeError) {
            logger.error(
              `Error retrieving subscription ${subscriptionId} from Stripe after invoice.payment_failed:`,
              stripeError
            );
          }
        } else {
          logger.warn(
            `invoice.payment_failed event for invoice ${invoice.id} is missing customerId ('${customerId}') or valid subscriptionId ('${subscriptionId || 'N/A'}').`
          );
        }
        break;
      }
      // payment_intent.payment_failed は invoice.payment_failed と重複することが多いが、
      // より詳細なエラー情報が必要な場合に利用。ここでは主に invoice.payment_failed で対応。
      // customer.subscription.updated で past_due, unpaid, canceled への変更は既に処理されている。
      // customer.subscription.deleted も既に処理されている。

      // 必要に応じて payment_intent.payment_failed の処理を追加
      // case 'payment_intent.payment_failed': {
      //   const paymentIntent = event.data.object as Stripe.PaymentIntent;
      //   logger.warn(
      //     `PaymentIntent payment_failed: ${paymentIntent.id}, customer: ${paymentIntent.customer}, error: ${paymentIntent.last_payment_error?.message}`
      //   );
      //   // ここで顧客IDからユーザーを特定し、UIに表示するための詳細なエラー情報を保存するなどの処理を検討
      //   // ただし、サブスクリプションステータスの更新は customer.subscription.updated や invoice.payment_failed で行う方が一般的
      //   break;
      // }

      // 他のイベントタイプ
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    // Stripeに成功応答を返す
    response.status(200).send({ received: true });
  }
);
