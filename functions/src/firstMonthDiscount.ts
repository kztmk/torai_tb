import admin from 'firebase-admin';
import Stripe from 'stripe';
import { appBaseUrlConfig } from './config';

export const FIRST_MONTH_DISCOUNT_CURRENCY = 'jpy';
export const FIRST_MONTH_DISCOUNT_VALID_DAYS = 1;
export const DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID: Record<string, number> = {
  basic_monthly: 780,
  half_yearly: 1000,
  yearly: 2000,
};
export const DEFAULT_BANK_TRANSFER_FEE_AMOUNT = 880;
export const FIRST_MONTH_DISCOUNT_CONFIG_COLLECTION = 'discounts';
export const FIRST_MONTH_DISCOUNT_CONFIG_DOC_ID = 'firstMonthDiscount';

export interface FirstMonthDiscountConfig {
  amountByPlanId: Record<string, number>;
  bankTransferFeeAmount: number;
}

const normalizeAmountByPlanId = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID;
  }

  const normalized = {...DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID};
  Object.entries(value as Record<string, unknown>).forEach(([planId, amount]) => {
    if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
      normalized[planId] = Math.floor(amount);
    }
  });

  return normalized;
};

const normalizeAmount = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
};

export const getFirstMonthDiscountConfig = async (): Promise<FirstMonthDiscountConfig> => {
  const configSnap = await admin
    .firestore()
    .collection(FIRST_MONTH_DISCOUNT_CONFIG_COLLECTION)
    .doc(FIRST_MONTH_DISCOUNT_CONFIG_DOC_ID)
    .get();
  const configData = configSnap.data();

  return {
    amountByPlanId: normalizeAmountByPlanId(configData?.amountByPlanId),
    bankTransferFeeAmount: normalizeAmount(
      configData?.bankTransferFeeAmount,
      DEFAULT_BANK_TRANSFER_FEE_AMOUNT
    ),
  };
};

export const getFirstMonthDiscountAmountOff = async (planId: string): Promise<number | null> => {
  const config = await getFirstMonthDiscountConfig();
  return config.amountByPlanId[planId] ?? null;
};

export const getBankTransferFeeAmount = async (): Promise<number> => {
  const config = await getFirstMonthDiscountConfig();
  return config.bankTransferFeeAmount;
};

export const getFirstMonthDiscountCouponId = (
  planId: string,
  amountOff: number | null
): string | null => {
  return amountOff ? `torai_first_payment_${planId}_${amountOff}_jpy_off` : null;
};

export const getFirstMonthDiscountExpiresAt = (): admin.firestore.Timestamp => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + FIRST_MONTH_DISCOUNT_VALID_DAYS);
  return admin.firestore.Timestamp.fromDate(expiresAt);
};

export const getFirstMonthDiscountPromotionCode = (uid: string, planId: string): string => {
  const uidSuffix = uid
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10)
    .toUpperCase();
  const environmentPrefix = (appBaseUrlConfig.value() || '').includes('preview') ? 'P' : 'T';
  const planPrefix =
    {
      basic_monthly: 'M',
      half_yearly: 'H',
      yearly: 'Y',
    }[planId] || 'P';
  return `TORAI-${planPrefix}-${environmentPrefix}-${uidSuffix}`;
};

export const getOrCreateFirstMonthDiscountCoupon = async (
  stripe: Stripe,
  planId: string,
  amountOff: number | null
): Promise<string | null> => {
  const couponId = getFirstMonthDiscountCouponId(planId, amountOff);
  if (!amountOff || !couponId) {
    return null;
  }

  const configRef = admin
    .firestore()
    .collection(FIRST_MONTH_DISCOUNT_CONFIG_COLLECTION)
    .doc(FIRST_MONTH_DISCOUNT_CONFIG_DOC_ID);
  let shouldUseDeterministicCouponId = true;
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    if (!coupon.deleted) {
      return coupon.id;
    }
    shouldUseDeterministicCouponId = false;
  } catch (_error) {
    // Create below when the deterministic coupon does not exist.
  }

  if (!shouldUseDeterministicCouponId) {
    const configSnap = await configRef.get();
    const fallbackCouponId = configSnap.data()?.fallbackCouponIds?.[couponId];
    if (typeof fallbackCouponId === 'string' && fallbackCouponId) {
      try {
        const fallbackCoupon = await stripe.coupons.retrieve(fallbackCouponId);
        if (!fallbackCoupon.deleted) {
          return fallbackCoupon.id;
        }
      } catch (_error) {
        // Create below when the stored fallback coupon is no longer usable.
      }
    }
  }

  const couponCreateParams: Stripe.CouponCreateParams = {
    duration: 'once',
    amount_off: amountOff,
    currency: FIRST_MONTH_DISCOUNT_CURRENCY,
    name: `Torai first ${planId} ${amountOff} off`,
  };
  if (shouldUseDeterministicCouponId) {
    couponCreateParams.id = couponId;
  }

  const coupon = await stripe.coupons.create(couponCreateParams);
  if (!shouldUseDeterministicCouponId) {
    await configRef.set(
      {
        fallbackCouponIds: {
          [couponId]: coupon.id,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  return coupon.id;
};
