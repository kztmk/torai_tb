// functions/src/handlers/mokumokurenCoupon.ts
import { createHash } from 'crypto';
import admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import Stripe from 'stripe';
import { mokumokurenStripeKey } from '../config';
import { db } from '../utils';

// 新規サブスク特典: 契約完了（users/{uid}.currentPeriodStart が初めて作成されたとき）に、
// 兄弟アプリ mokumokuren の「Pro 2ヶ月無料」プロモーションコードを mokumokuren 側の
// Stripe アカウント（虎威とは別アカウント）に発行し、users/{uid}.mokumokurenCoupon に
// 保存する。サブスク管理画面（MokumokurenCouponCard）がこのフィールドを表示する。
// コードは uid から決定的に生成するため、リトライ・再実行しても同じコードに収束する。

const COUPON_ID = 'mokumokuren-2mo-free';
const CODE_PREFIX = 'TORAI-';
// 紛らわしい文字（0/O/1/I/L）を除いたアルファベット
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function codeForUid(uid: string): string {
  const digest = createHash('sha256').update(`mokumokuren-coupon:${uid}`).digest();
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET[digest[i] % CODE_ALPHABET.length];
  }
  return CODE_PREFIX + code;
}

// 「100%オフ × 2ヶ月」クーポン本体。mokumokuren 側アカウントに無ければ作る。
async function ensureCoupon(stripe: Stripe): Promise<void> {
  try {
    await stripe.coupons.retrieve(COUPON_ID);
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeError) || error.code !== 'resource_missing') {
      throw error;
    }
    try {
      await stripe.coupons.create({
        id: COUPON_ID,
        percent_off: 100,
        duration: 'repeating',
        duration_in_months: 2,
        name: 'mokumokuren Pro 2 months free (torai perk)',
      });
    } catch (createError) {
      // 同時実行で他インスタンスが先に作成した場合、create は 400 で落ちるが目的の
      // クーポンは実在する。再取得できればそれで良い（外周の恒久エラー処理に 400 を
      // 渡すと silent skip になってしまう）。実在しなければ元のエラーを投げる。
      try {
        await stripe.coupons.retrieve(COUPON_ID);
      } catch (retrieveError) {
        // クーポンが本当に存在しない（resource_missing）なら create の失敗が真因なので
        // そちらを投げる（恒久エラーとして処理される）。それ以外＝一時エラー（429/5xx/
        // 切断等）は retrieveError を投げて retry 機構に乗せる — ここで createError を
        // 投げると一時的な失敗まで恒久 400 扱いになり silent skip してしまう。
        if (
          retrieveError instanceof Stripe.errors.StripeError &&
          retrieveError.code === 'resource_missing'
        ) {
          throw createError;
        }
        throw retrieveError;
      }
    }
  }
}

export const issueMokumokurenCoupon = onDocumentWritten(
  {
    document: 'users/{uid}',
    region: 'asia-northeast1',
    retry: true,
    secrets: [mokumokurenStripeKey],
  },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after;
    if (!after?.exists) {return;}
    const afterData = after.data() ?? {};
    const beforeData = event.data?.before?.data() ?? {};

    // 契約完了の瞬間（currentPeriodStart の新規作成）だけに反応。発行済みなら何もしない。
    if (!afterData.currentPeriodStart || beforeData.currentPeriodStart) {return;}
    if (afterData.mokumokurenCoupon?.code) {return;}

    // v7 の SecretParam.value() は未設定でも throw せず '' を返すが、new Stripe('') は
    // 同期 throw する（retry ループの元）。空・プレースホルダ運用はここで打ち切る。
    const stripeKey = mokumokurenStripeKey.value();
    if (!stripeKey) {
      logger.error('MOKUMOKUREN_STRIPE_KEY is empty; skipping coupon issuance.', { uid });
      return;
    }

    const code = codeForUid(uid);
    const stripe = new Stripe(stripeKey);

    try {
      await ensureCoupon(stripe);

      let promo: Stripe.PromotionCode;
      try {
        promo = await stripe.promotionCodes.create(
          {
            promotion: { type: 'coupon', coupon: COUPON_ID },
            code,
            max_redemptions: 1,
            metadata: { source: 'torai', toraiUid: uid },
          },
          { idempotencyKey: `torai-moku-v1-${uid}` }
        );
      } catch (createError) {
        // 前回 Firestore 書き込み前に落ちた等で、コードだけ既に存在するケースは再利用する。
        // metadata.toraiUid の一致を必須にし、ハッシュ衝突や手動作成による
        // 「他ユーザーのコード」を誤って掴まないようにする。
        const existing = await stripe.promotionCodes.list({ code, limit: 1 });
        const matched = existing.data.find((p) => p.metadata?.toraiUid === uid);
        if (!matched) {
          throw createError;
        }
        promo = matched;
      }

      await db.doc(`users/${uid}`).set(
        {
          mokumokurenCoupon: {
            code: promo.code,
            promotionCodeId: promo.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      logger.info('Issued mokumokuren coupon.', { uid, code: promo.code });
    } catch (error) {
      // 恒久エラー（400: パラメータ/冪等キー不整合、401: キー無効、403: 権限不足）は同一
      // パラメータで再試行しても直らないためリトライさせない。429/5xx/ネットワーク断などの
      // 一時エラーだけ throw して retry に任せる。
      if (
        error instanceof Stripe.errors.StripeError &&
        (error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 403)
      ) {
        logger.error('Permanent Stripe error; skipping coupon issuance.', {
          uid,
          statusCode: error.statusCode,
          message: error.message,
        });
        return;
      }
      logger.error('Failed to issue mokumokuren coupon.', {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
);
