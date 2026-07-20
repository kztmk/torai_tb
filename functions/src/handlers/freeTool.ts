import { createHash, randomBytes } from 'crypto';
import admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { db } from '../utils';

type ToolSubscriptionStatus = 'active' | 'inactive';

type FreeToolKeyData = {
  uid?: string;
  revoked?: boolean;
  lastStatus?: ToolSubscriptionStatus;
  lastCheckedAt?: admin.firestore.Timestamp | null;
  nextRefreshAt?: admin.firestore.Timestamp | null;
};

type FreeToolKeyUserData = {
  keyHash?: string;
};

type FreeToolUserSubscriptionFields = {
  subscriptionStatus?: unknown;
  appPlanId?: unknown;
};

const FREE_TOOL_STATUS_CACHE_MS = 10 * 24 * 60 * 60 * 1000;
const FREE_TOOL_UNLOCK_KEY_MAX_LENGTH = 100;
const FREE_TOOL_REQUEST_BODY_MAX_LENGTH = 1000;
const FREE_TOOL_DELETE_BATCH_SIZE = 450;
const FREE_TOOL_KEYS_COLLECTION = 'freeToolUnlockKeys';
const FREE_TOOL_KEY_USERS_COLLECTION = 'freeToolUnlockKeyUsers';

const hashUnlockKey = (unlockKey: string): string =>
  createHash('sha256').update(unlockKey).digest('hex');

const generateUnlockKey = (): string =>
  `TORAI-${randomBytes(24).toString('base64url').toUpperCase()}`;

const toIsoString = (timestamp: admin.firestore.Timestamp | Date): string =>
  timestamp instanceof Date ? timestamp.toISOString() : timestamp.toDate().toISOString();

const normalizeRequestKey = (request: any): string => {
  let body = request.body;
  if (Buffer.isBuffer(body)) {
    if (body.length > FREE_TOOL_REQUEST_BODY_MAX_LENGTH) {
      return '';
    }
    body = body.toString('utf-8');
  }
  if (typeof body === 'string') {
    if (body.length > FREE_TOOL_REQUEST_BODY_MAX_LENGTH) {
      return '';
    }
    const trimmed = body.trim();
    if (trimmed.toUpperCase().startsWith('TORAI-')) {
      return trimmed.toUpperCase();
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        const parsedTrimmed = parsed.trim();
        return parsedTrimmed.toUpperCase().startsWith('TORAI-')
          ? parsedTrimmed.toUpperCase()
          : '';
      }
      body = parsed;
    } catch {
      return trimmed.toUpperCase();
    }
  }
  const parsedBody = typeof body === 'object' && body !== null ? body : {};
  const rawKey = parsedBody.unlockKey ?? parsedBody.key;
  return typeof rawKey === 'string' && rawKey.length <= FREE_TOOL_REQUEST_BODY_MAX_LENGTH
    ? rawKey.trim().toUpperCase()
    : '';
};

const getExternalToolStatus = (
  userData: FirebaseFirestore.DocumentData | undefined
): ToolSubscriptionStatus => {
  const subscriptionStatus =
    typeof userData?.subscriptionStatus === 'string' ? userData.subscriptionStatus : 'inactive';
  const appPlanId = typeof userData?.appPlanId === 'string' ? userData.appPlanId : '';
  return subscriptionStatus === 'active' ||
    subscriptionStatus === 'trialing' ||
    appPlanId === 'lifetime'
    ? 'active'
    : 'inactive';
};

export const issueFreeToolUnlockKey = onCall(
  { region: 'asia-northeast1' },
  async (request): Promise<{ unlockKey: string; issuedAt: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
    }

    const uid = request.auth.uid;
    const unlockKey = generateUnlockKey();
    const keyHash = hashUnlockKey(unlockKey);
    const issuedAt = admin.firestore.Timestamp.now();
    const keyRef = db.collection(FREE_TOOL_KEYS_COLLECTION).doc(keyHash);
    const userKeyRef = db.collection(FREE_TOOL_KEY_USERS_COLLECTION).doc(uid);

    await db.runTransaction(async (transaction) => {
      const userKeySnap = await transaction.get(userKeyRef);
      const existingKeyHash = (userKeySnap.data() as FreeToolKeyUserData | undefined)?.keyHash;
      if (existingKeyHash && existingKeyHash !== keyHash) {
        transaction.set(
          db.collection(FREE_TOOL_KEYS_COLLECTION).doc(existingKeyHash),
          {
            revoked: true,
            revokedAt: issuedAt,
            updatedAt: issuedAt,
          },
          { merge: true }
        );
      }

      transaction.set(keyRef, {
        uid,
        revoked: false,
        createdAt: issuedAt,
        updatedAt: issuedAt,
      });
      transaction.set(
        userKeyRef,
        {
          keyHash,
          issuedAt,
          updatedAt: issuedAt,
        },
        { merge: true }
      );
    });

    logger.info('Free tool unlock key issued.', {
      uid,
      keyHashPrefix: keyHash.slice(0, 8),
    });

    return {
      unlockKey,
      issuedAt: toIsoString(issuedAt),
    };
  }
);

export const checkFreeToolSubscriptionStatus = onRequest(
  { region: 'asia-northeast1', cors: true },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({
        success: false,
        message: 'POSTメソッドのみ利用できます。',
        code: 'method-not-allowed',
      });
      return;
    }

    const unlockKey = normalizeRequestKey(request);
    if (!unlockKey) {
      response.status(400).json({
        success: false,
        message: '高機能解除キーを指定してください。',
        code: 'invalid-argument',
      });
      return;
    }
    if (!unlockKey.startsWith('TORAI-')) {
      response.status(400).json({
        success: false,
        message: '高機能解除キーが無効です。',
        code: 'invalid-argument',
      });
      return;
    }
    if (unlockKey.length > FREE_TOOL_UNLOCK_KEY_MAX_LENGTH) {
      response.status(400).json({
        success: false,
        message: '高機能解除キーが無効です。',
        code: 'invalid-argument',
      });
      return;
    }

    const keyHash = hashUnlockKey(unlockKey);
    const keyRef = db.collection(FREE_TOOL_KEYS_COLLECTION).doc(keyHash);
    const now = admin.firestore.Timestamp.now();

    try {
      const keySnap = await keyRef.get();
      if (!keySnap.exists) {
        response.status(403).json({
          success: false,
          message: '高機能解除キーが無効です。',
          code: 'permission-denied',
        });
        return;
      }

      const keyData = keySnap.data() as FreeToolKeyData;
      if (keyData.revoked === true || !keyData.uid) {
        response.status(403).json({
          success: false,
          message: '高機能解除キーが無効です。',
          code: 'permission-denied',
        });
        return;
      }

      const cachedUntil = keyData.lastCheckedAt
        ? admin.firestore.Timestamp.fromMillis(
            keyData.lastCheckedAt.toMillis() + FREE_TOOL_STATUS_CACHE_MS
          )
        : null;

      let result: {
        status: ToolSubscriptionStatus;
        cached: boolean;
        checkedAt: admin.firestore.Timestamp;
        nextRefreshAt: admin.firestore.Timestamp;
      };

      if (
        keyData.lastStatus &&
        keyData.lastCheckedAt &&
        cachedUntil &&
        cachedUntil.toMillis() > now.toMillis()
      ) {
        result = {
          status: keyData.lastStatus,
          cached: true,
          checkedAt: keyData.lastCheckedAt,
          nextRefreshAt: cachedUntil,
        };
      } else {
        const userSnap = await db.collection('users').doc(keyData.uid).get();
        const status = getExternalToolStatus(userSnap.data());
        const nextRefreshAt = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + FREE_TOOL_STATUS_CACHE_MS
        );

        try {
          await keyRef.update({
            lastStatus: status,
            lastCheckedAt: now,
            nextRefreshAt,
            updatedAt: now,
          });
        } catch (updateError) {
          logger.warn('Failed to update free tool key cache status, but proceeding to return status.', {
            keyHashPrefix: keyHash.slice(0, 8),
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });
        }

        result = {
          status,
          cached: false,
          checkedAt: now,
          nextRefreshAt,
        };
      }

      response.json({
        success: true,
        subscription_status: result.status,
        subscriptionStatus: result.status,
        cached: result.cached,
        checkedAt: toIsoString(result.checkedAt),
        nextRefreshAt: toIsoString(result.nextRefreshAt),
      });
    } catch (error: any) {
      logger.error('Failed to check free tool subscription status.', {
        keyHashPrefix: keyHash.slice(0, 8),
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        success: false,
        message: 'サブスクリプション状態の確認に失敗しました。',
        code: 'internal',
      });
    }
  }
);

export const invalidateFreeToolCacheOnUserChange = onDocumentWritten(
  { document: 'users/{uid}', region: 'asia-northeast1', retry: true },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before.data() as FreeToolUserSubscriptionFields | undefined;
    const after = event.data?.after.data() as FreeToolUserSubscriptionFields | undefined;

    const isCreated = !event.data?.before.exists;
    if (isCreated) {
      return;
    }

    const isDeleted = !event.data?.after.exists;
    const changed =
      isDeleted ||
      before?.subscriptionStatus !== after?.subscriptionStatus ||
      before?.appPlanId !== after?.appPlanId;
    if (!changed) {
      return;
    }

    if (isDeleted) {
      let batch = db.batch();
      let pendingDeletes = 0;
      let deletedKeyCount = 0;
      batch.delete(db.collection(FREE_TOOL_KEY_USERS_COLLECTION).doc(uid));
      pendingDeletes += 1;

      const keysSnap = await db
        .collection(FREE_TOOL_KEYS_COLLECTION)
        .where('uid', '==', uid)
        .get();

      for (const keyDoc of keysSnap.docs) {
        batch.delete(keyDoc.ref);
        pendingDeletes += 1;
        deletedKeyCount += 1;

        if (pendingDeletes >= FREE_TOOL_DELETE_BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          pendingDeletes = 0;
        }
      }

      if (pendingDeletes > 0) {
        await batch.commit();
      }

      logger.info('All free tool unlock keys deleted due to user deletion.', {
        uid,
        deletedKeyCount,
      });
      return;
    }

    const userKeySnap = await db.collection(FREE_TOOL_KEY_USERS_COLLECTION).doc(uid).get();
    const keyHash = (userKeySnap.data() as FreeToolKeyUserData | undefined)?.keyHash;
    if (typeof keyHash !== 'string' || !keyHash) {
      return;
    }

    try {
      await db
        .collection(FREE_TOOL_KEYS_COLLECTION)
        .doc(keyHash)
        .update({
          lastCheckedAt: null,
          nextRefreshAt: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error: any) {
      if (error?.code === 5 || error?.message?.includes('NOT_FOUND')) {
        logger.warn('Free tool unlock key document not found during cache invalidation.', {
          uid,
          keyHashPrefix: keyHash.slice(0, 8),
        });
        return;
      }
      throw error;
    }

    logger.info('Free tool status cache invalidated due to user subscription change.', {
      uid,
      keyHashPrefix: keyHash.slice(0, 8),
    });
  }
);
