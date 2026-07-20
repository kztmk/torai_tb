// functions/src/utils.ts
import cors from 'cors';
import admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import Stripe from 'stripe';
import { allowedOrigins, stripeSecretKey } from './config'; // configからインポート

// index.ts で行うか、ここで一度だけ行う)
// if (admin.apps.length === 0) {
//     admin.initializeApp();
// }

export const db = admin.firestore(); // Firestoreインスタンスをエクスポート

export function initializeStripeSDK(): Stripe {
  const currentStripeSecretKey = stripeSecretKey.value();
  if (!currentStripeSecretKey) {
    logger.error('Stripe secret key (STRIPE_SECRET_KEY) is not configured or is empty.');
    throw new Error('Server configuration error: Stripe secret key missing.');
  }
  return new Stripe(currentStripeSecretKey, {
    apiVersion: '2026-05-27.dahlia',
  });
}

export const corsHandler = cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    logger.info('CORS check. Origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      logger.info('Origin allowed:', origin);
      callback(null, true);
    } else {
      logger.error('CORS Error: Origin not allowed:', origin);
      callback(new Error(`Origin ${origin} not allowed by CORS policy.`));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Target-Gas-Url'],
  credentials: true,
});
