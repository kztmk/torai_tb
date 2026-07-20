import { useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

export type PublicSubscriptionPrice = {
  planId: 'basic_monthly';
  unitAmount: number;
  currency: string;
  interval: 'month';
  intervalCount: number;
};

type PublicSubscriptionPricingResponse = {
  plans: PublicSubscriptionPrice[];
};

let pricingRequest: Promise<PublicSubscriptionPricingResponse> | null = null;

const fetchPublicSubscriptionPricing = async (): Promise<PublicSubscriptionPricingResponse> => {
  if (pricingRequest !== null) {
    return pricingRequest;
  }

  const functions = getFunctions(getApp(), 'asia-northeast1');
  const callable = httpsCallable<Record<string, never>, PublicSubscriptionPricingResponse>(
    functions,
    'getPublicSubscriptionPricing'
  );
  pricingRequest = callable({})
    .then((result) => result.data)
    .catch((error) => {
      pricingRequest = null;
      throw error;
    });
  return pricingRequest;
};

export const formatPublicSubscriptionAmount = (
  price: PublicSubscriptionPrice,
  locale: string
): string => {
  const amount = price.unitAmount / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency,
  }).format(amount);
};

export const useUsdMonthlyPrice = (enabled: boolean) => {
  const [price, setPrice] = useState<PublicSubscriptionPrice | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setPrice(null);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    void fetchPublicSubscriptionPricing()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const monthlyPrice = response.plans.find(
          (candidate) =>
            candidate.planId === 'basic_monthly' &&
            candidate.currency.toUpperCase() === 'USD' &&
            candidate.interval === 'month'
        );
        if (monthlyPrice === undefined) {
          throw new Error('USD monthly pricing was not returned.');
        }
        setPrice(monthlyPrice);
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }
        setPrice(null);
        setError(reason instanceof Error ? reason.message : 'SUBSCRIPTION_PRICING_LOAD_FAILED');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { price, loading, error };
};
