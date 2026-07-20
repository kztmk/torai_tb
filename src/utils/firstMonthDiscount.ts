import { doc, Firestore, getDoc, Timestamp } from 'firebase/firestore';

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

export const fetchFirstMonthDiscountConfig = async (
  firestore: Firestore
): Promise<FirstMonthDiscountConfig> => {
  const configSnap = await getDoc(
    doc(firestore, FIRST_MONTH_DISCOUNT_CONFIG_COLLECTION, FIRST_MONTH_DISCOUNT_CONFIG_DOC_ID)
  );
  const configData = configSnap.data();
  return {
    amountByPlanId: normalizeAmountByPlanId(configData?.amountByPlanId),
    bankTransferFeeAmount: normalizeAmount(
      configData?.bankTransferFeeAmount,
      DEFAULT_BANK_TRANSFER_FEE_AMOUNT
    ),
  };
};

export const fetchFirstMonthDiscountAmountByPlanId = async (
  firestore: Firestore
): Promise<Record<string, number>> => {
  const config = await fetchFirstMonthDiscountConfig(firestore);
  return config.amountByPlanId;
};

export const getFirstMonthDiscountAmountOff = (
  planId?: string | null,
  amountByPlanId: Record<string, number> = DEFAULT_FIRST_MONTH_DISCOUNT_AMOUNT_BY_PLAN_ID
): number | null => {
  if (!planId) {
    return null;
  }
  return amountByPlanId[planId] ?? null;
};

export const formatFirstMonthDiscountAmount = (
  planId?: string | null,
  amountByPlanId?: Record<string, number>
): string => {
  const amountOff = getFirstMonthDiscountAmountOff(planId, amountByPlanId);
  return amountOff ? `${amountOff.toLocaleString()}円` : '対象プランごとの金額';
};

export const getFirstMonthDiscountExpiresAt = (): Timestamp => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + FIRST_MONTH_DISCOUNT_VALID_DAYS);
  return Timestamp.fromDate(expiresAt);
};

export const isFirstMonthDiscountActive = (expiresAt?: string | null): boolean => {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() > Date.now();
};

export const formatFirstMonthDiscountRemaining = (
  expiresAt?: string | null,
  now = Date.now()
): string | null => {
  if (!expiresAt) {
    return null;
  }

  const remainingMillis = new Date(expiresAt).getTime() - now;
  if (remainingMillis <= 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.ceil(remainingMillis / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}時間 ${minutes}分 ${seconds.toString().padStart(2, '0')}秒`;
  }

  if (minutes > 0) {
    return `${minutes}分 ${seconds.toString().padStart(2, '0')}秒`;
  }

  return `${seconds}秒`;
};

export const formatBankTransferFeeDiscountAmount = (
  bankTransferFeeAmount = DEFAULT_BANK_TRANSFER_FEE_AMOUNT
): string => `${bankTransferFeeAmount.toLocaleString()}円`;
