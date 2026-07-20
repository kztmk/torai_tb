import admin from 'firebase-admin';
import { logger as loggerV2 } from 'firebase-functions/v2'; // v2 loggerをインポート
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import {
  allowedOrigins,
  appBaseUrlConfig,
  getAdminNotificationBcc,
} from '../config'; // config.ts から APP_URL と allowedOrigins をインポート
import {
  FIRST_MONTH_DISCOUNT_CURRENCY,
  FIRST_MONTH_DISCOUNT_VALID_DAYS,
  getFirstMonthDiscountExpiresAt,
} from '../firstMonthDiscount';
import { getMailchimpTag } from '../mailchimpTag';
import { corsHandler, db } from '../utils'; // utils.ts から db をインポート

// Firebase Admin SDKの初期化は通常、プロジェクトのルート index.ts や utils.ts で一度だけ行います。
// このファイルで再度呼び出す必要はありません。
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

interface SendCustomVerificationEmailData {
  lang?: string; // 例: 'ja', 'en'
}

interface AdminUserActionData {
  email?: string;
}

interface AdminSetUserDisabledData extends AdminUserActionData {
  disabled?: boolean;
}

interface AcceptTermsResponse {
  termsAccepted: boolean;
  isAdmin: boolean;
}

function isStripeDeletionBlocked(userData: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!userData?.stripeSubscriptionId) {
    return false;
  }
  if (userData.cancelAtPeriodEnd === true) {
    return false;
  }

  return ['active', 'trialing', 'past_due', 'unpaid'].includes(userData.subscriptionStatus);
}

const WELCOME_EMAIL_TEMPLATE_JA = 'welcomeEmailVerification_ja';
const WELCOME_EMAIL_TEMPLATE_VERIFIED_JA = 'welcomeEmail_ja';
const MAIL_TEMPLATE_COLLECTION_CANDIDATES = ['mail-template', 'mail-templates'];

function getCleanedAppBaseUrl() {
  const appBaseUrl = appBaseUrlConfig.value();
  loggerV2.info(`Original APP_URL from config: "${appBaseUrl}"`);

  if (!appBaseUrl) {
    loggerV2.error(
      'Application base URL (APP_URL) is not configured or is empty in Firebase Functions environment variables.'
    );
    throw new HttpsError('internal', 'アプリケーションのベースURLが設定されていません。');
  }

  const cleanedAppBaseUrl = appBaseUrl.endsWith('/') ? appBaseUrl.slice(0, -1) : appBaseUrl;
  loggerV2.info(`Cleaned APP_URL for verification link: "${cleanedAppBaseUrl}"`);
  return cleanedAppBaseUrl;
}

async function generateVerificationLink(userEmail: string, lang = 'ja') {
  const cleanedAppBaseUrl = getCleanedAppBaseUrl();
  const actionCodeSettings = {
    url: `${cleanedAppBaseUrl}/auth/action?mode=verifyEmail&lang=${lang}`,
    handleCodeInApp: true,
  };

  return admin.auth().generateEmailVerificationLink(userEmail, actionCodeSettings);
}

async function queueTemplatedVerificationEmail(params: {
  userEmail: string;
  displayName: string;
  verificationLink: string;
  templateName: string;
}) {
  const templateSubject = await getTemplateSubjectFallback(params.templateName);
  await db.collection('mail').add({
    to: [params.userEmail],
    ...(templateSubject
      ? {
          message: {
            subject: templateSubject,
          },
        }
      : {}),
    template: {
      name: params.templateName,
      data: {
        displayName: params.displayName,
        verificationLink: params.verificationLink,
        appName: '虎威',
      },
    },
  });
}

async function getTemplateSubjectFallback(templateName: string): Promise<string | null> {
  for (const collectionName of MAIL_TEMPLATE_COLLECTION_CANDIDATES) {
    const templateSnap = await db.collection(collectionName).doc(templateName).get();
    if (!templateSnap.exists) {
      continue;
    }

    const templateData = templateSnap.data() || {};
    const subject = templateData.subject || templateData.title;
    if (typeof subject === 'string' && subject.trim()) {
      return subject.trim();
    }
  }

  return null;
}

async function assertAdminHttpRequest(request: any) {
  const authorization = request.get('authorization') || request.get('Authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/);
  if (!match) {
    loggerV2.error('HTTP admin account action rejected: missing bearer token.');
    throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
  }

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(match[1]);
  } catch (tokenError: any) {
    loggerV2.error('Failed to verify admin HTTP ID token.', {
      message:
        tokenError instanceof Error ? tokenError.message : 'Unknown token verification error.',
    });
    throw new HttpsError(
      'unauthenticated',
      '認証トークンが無効または期限切れです。',
      tokenError instanceof Error ? tokenError.message : undefined
    );
  }
  if (decodedToken.isAdmin) {
    return decodedToken.uid;
  }

  const requesterDoc = await db.collection('users').doc(decodedToken.uid).get();
  const requesterData = requesterDoc.exists ? requesterDoc.data() : null;
  if (!requesterData?.isAdmin) {
    loggerV2.warn(`User ${decodedToken.uid} is not an admin. Permission denied.`);
    throw new HttpsError('permission-denied', '管理者権限が必要です。');
  }

  return decodedToken.uid;
}

function sendHttpError(response: any, error: any, fallbackMessage: string) {
  if (error instanceof HttpsError) {
    const statusByCode: Record<string, number> = {
      'invalid-argument': 400,
      unauthenticated: 401,
      'permission-denied': 403,
      'not-found': 404,
      'failed-precondition': 412,
      internal: 500,
    };
    response.status(statusByCode[error.code] ?? 500).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  loggerV2.error(fallbackMessage, error);
  response.status(500).json({
    success: false,
    message: fallbackMessage,
    code: 'internal',
  });
}

function runAdminHttpHandler(request: any, response: any, handler: () => Promise<void>) {
  corsHandler(request, response, async (corsError?: any) => {
    if (corsError) {
      loggerV2.warn('Admin account HTTP CORS rejected.', {
        origin: request.get('origin') || '',
        message: corsError.message,
      });
      response.status(403).json({
        success: false,
        message: 'CORSで許可されていないオリジンです。',
        code: 'permission-denied',
      });
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({
        success: false,
        message: 'POSTメソッドのみ利用できます。',
        code: 'method-not-allowed',
      });
      return;
    }

    try {
      await handler();
    } catch (handlerError) {
      loggerV2.error('Unhandled error in admin HTTP handler:', handlerError);
      sendHttpError(response, handlerError, '予期しないエラーが発生しました。');
    }
  });
}

function normalizeEmail(email?: unknown) {
  if (typeof email !== 'string') {
    throw new HttpsError('invalid-argument', 'メールアドレスは必須です。');
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new HttpsError('invalid-argument', 'メールアドレスは必須です。');
  }

  return normalizedEmail;
}

function toAdminAccountResponse(userRecord: admin.auth.UserRecord) {
  return {
    uid: userRecord.uid,
    email: userRecord.email ?? '',
    displayName: userRecord.displayName ?? '',
    disabled: userRecord.disabled,
    emailVerified: userRecord.emailVerified,
    creationTime: userRecord.metadata.creationTime,
    lastSignInTime: userRecord.metadata.lastSignInTime ?? '',
  };
}

export const sendCustomVerificationEmail = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      loggerV2.error('User not authenticated for sendCustomVerificationEmail');
      throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;
    const userDisplayName = request.auth.token.name || ''; // 表示名がなければメールアドレス
    if (!userEmail) {
      loggerV2.error(`User ${userId} does not have an email address.`);
      throw new HttpsError('failed-precondition', 'メールアドレスが登録されていません。');
    }

    const data = request.data as SendCustomVerificationEmailData;
    const lang = data.lang || 'ja'; // デフォルト言語を 'ja' とする

    try {
      const verificationLink = await generateVerificationLink(userEmail, lang);

      let templateName = 'emailVerification_ja';
      let mailUserName = userDisplayName.length > 0 ? userDisplayName : '虎威ユーザー';
      if (lang === 'en') {
        templateName = 'emailVerification_en';
        mailUserName = 'Torai member';
      }

      await queueTemplatedVerificationEmail({
        userEmail,
        displayName: mailUserName,
        verificationLink,
        templateName,
      });

      loggerV2.info(
        `Custom verification email sent to ${userEmail} for user ${userId} with lang ${lang}.`
      );
      return { success: true, message: '確認メールを送信しました。' };
    } catch (error: any) {
      loggerV2.error(`Error sending custom verification email for user ${userId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'メール送信中にエラーが発生しました。', error.message);
    }
  }
);

export const sendWelcomeEmailForNewUser = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      loggerV2.error('User not authenticated for sendWelcomeEmailForNewUser');
      throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;
    const userDisplayName = request.auth.token.name || '虎威ユーザー';

    if (!userEmail) {
      loggerV2.warn(`Welcome email skipped for user ${userId}: email is empty.`);
      await db.collection('users').doc(userId).set(
        {
          welcomeEmailError: 'メールアドレスがないため、ようこそメールを送信できませんでした。',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw new HttpsError('failed-precondition', 'メールアドレスが登録されていません。');
    }

    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    const userData = userDoc.data() ?? {};
    if (userDoc.exists && userData.welcomeEmailSentAt) {
      loggerV2.info(`Welcome email already sent for user ${userId}. Skipping.`);
      return { success: true, skipped: true, message: 'ようこそメールは送信済みです。' };
    }

    try {
      const authUser = await admin.auth().getUser(userId);
      const isEmailVerified = authUser.emailVerified;

      if (isEmailVerified) {
        // Google等で既に認証済みの場合は検証リンクなしのテンプレートを使用
        await db.collection('mail').add({
          to: [userEmail],
          template: {
            name: WELCOME_EMAIL_TEMPLATE_VERIFIED_JA,
            data: {
              displayName: userDisplayName,
              appName: '虎威',
            },
          },
        });
      } else {
        const verificationLink = await generateVerificationLink(userEmail, 'ja');
        await queueTemplatedVerificationEmail({
          userEmail,
          displayName: userDisplayName,
          verificationLink,
          templateName: WELCOME_EMAIL_TEMPLATE_JA,
        });
      }

      const nextMailchimpTags = getMailchimpTag('registered');
      await userDocRef.set(
        {
          email: userEmail,
          displayName: request.auth.token.name || null,
          applyMailchimpTag: nextMailchimpTags,
          welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          welcomeEmailError: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      loggerV2.info(`Welcome verification email queued for ${userEmail} (${userId}).`);
      return { success: true, skipped: false, message: 'ようこそメールを送信しました。' };
    } catch (error: any) {
      loggerV2.error(`Error queueing welcome email for user ${userId}:`, error);
      await userDocRef.set(
        {
          email: userEmail,
          displayName: request.auth.token.name || null,
          welcomeEmailError: error?.message || 'ようこそメールの送信中にエラーが発生しました。',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'ようこそメールの送信中にエラーが発生しました。',
        error?.message
      );
    }
  }
);

export const acceptTerms = onCall<unknown, Promise<AcceptTermsResponse>>(
  { region: 'asia-northeast1' },
  async (request) => {
    if (!request.auth?.uid) {
      loggerV2.warn('acceptTerms rejected: unauthenticated request.');
      throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
    }

    const uid = request.auth.uid;
    const authUser = await admin.auth().getUser(uid);
    const isGoogleUser = authUser.providerData.some(
      (provider) => provider.providerId === 'google.com'
    );
    const userDocRef = db.collection('users').doc(uid);
    let isAdmin = false;

    await db.runTransaction(async (transaction) => {
      const userDocSnap = await transaction.get(userDocRef);
      const userData = userDocSnap.data() ?? {};
      const firstMonthDiscount = userData?.firstMonthDiscount;
      const isJapaneseUser =
        userData?.preferredLanguage === undefined ||
        userData?.preferredLanguage === null ||
        userData?.preferredLanguage === 'ja';
      isAdmin = Boolean(userData?.isAdmin);
      const nextMailchimpTags = getMailchimpTag('agreed');
      const shouldActivateFirstMonthDiscount =
        isJapaneseUser &&
        isGoogleUser &&
        firstMonthDiscount?.status === 'pending_terms' &&
        firstMonthDiscount?.source === 'google_new_user';

      const updateData: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        termsAccepted: true,
        applyMailchimpTag: nextMailchimpTags,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (
        isJapaneseUser &&
        userData?.referral?.referredByUid &&
        !userData?.referral?.termsAcceptedAt
      ) {
        updateData.referral = {
          ...userData.referral,
          termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
      }

      if (shouldActivateFirstMonthDiscount) {
        updateData.firstMonthDiscount = {
          status: 'eligible',
          currency: FIRST_MONTH_DISCOUNT_CURRENCY,
          validDays: FIRST_MONTH_DISCOUNT_VALID_DAYS,
          source: 'google_new_user',
          eligibleAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: getFirstMonthDiscountExpiresAt(),
        };
      }

      transaction.set(userDocRef, updateData, { merge: true });
    });

    loggerV2.info('Terms accepted.', {
      uid,
      isAdmin,
      isGoogleUser,
    });

    return { termsAccepted: true, isAdmin };
  }
);

// ユーザーデータのクリーンアップを行う内部ヘルパー関数
async function cleanupUserDataInternal(uid: string) {
  loggerV2.info(`Starting internal data cleanup for user: ${uid}`);
  const operations: Promise<any>[] = [];

  // 1. Firestoreからユーザーデータを削除
  const userDocRef = db.collection('users').doc(uid);
  operations.push(
    userDocRef
      .delete()
      .then(() => {
        loggerV2.info(`Firestore data deleted for user: ${uid}`);
      })
      .catch((error) => {
        loggerV2.error(`Error deleting Firestore data for user ${uid}:`, error);
        throw new Error(`Failed to delete Firestore data for user ${uid}: ${error.message}`);
      })
  );

  const gasProxySecretRef = db.collection('gasProxySecrets').doc(uid);
  operations.push(
    gasProxySecretRef
      .delete()
      .then(() => {
        loggerV2.info(`GAS proxy secret deleted for user: ${uid}`);
      })
      .catch((error) => {
        loggerV2.error(`Error deleting GAS proxy secret for user ${uid}:`, error);
        throw new Error(`Failed to delete GAS proxy secret for user ${uid}: ${error.message}`);
      })
  );

  const supportMessageThreadRef = db.collection('supportMessageThreads').doc(uid);
  operations.push(
    db
      .recursiveDelete(supportMessageThreadRef)
      .then(() => {
        loggerV2.info(`Support message thread and messages deleted for user: ${uid}`);
      })
      .catch((error) => {
        loggerV2.error(`Error deleting support message thread for user ${uid}:`, error);
        throw new Error(
          `Failed to delete support message thread for user ${uid}: ${error.message}`
        );
      })
  );

  // 2. Realtime Databaseからユーザーデータを削除 (もし使用している場合)
  // 例: /user-data/{uid} にデータが格納されていると仮定
  const rtdbUserRef = admin.database().ref(`/user-data/${uid}`); // パスは実際の構造に合わせてください
  operations.push(
    rtdbUserRef
      .remove()
      .then(() => {
        loggerV2.info(`Realtime Database data for user: ${uid} removed.`);
      })
      .catch((error) => {
        loggerV2.error(`Error removing Realtime Database data for user ${uid}:`, error);
        throw new Error(
          `Failed to delete Realtime Database data for user ${uid}: ${error.message}`
        );
      })
  );

  // 他にも削除すべきデータがあればここに追加（例: Cloud Storageのユーザーファイルなど）
  // 例:
  // const storageBucket = admin.storage().bucket();
  // operations.push(
  //   storageBucket.deleteFiles({ prefix: `user-files/${uid}/` })
  //     .then(() => loggerV2.info(`Cloud Storage files deleted for user: ${uid}`))
  //     .catch(error => {
  //       loggerV2.error(`Error deleting Cloud Storage files for user ${uid}:`, error);
  //       throw new Error(`Failed to delete Cloud Storage files for user ${uid}: ${error.message}`);
  //     })
  // );

  try {
    await Promise.all(operations);
    loggerV2.info(`Internal data cleanup finished successfully for user: ${uid}`);
  } catch (error) {
    loggerV2.error(
      `One or more internal cleanup operations failed for user ${uid}:`,
      error instanceof Error ? error.message : error
    );
    // このエラーは呼び出し元 (deleteUserAccount) でキャッチされる
    throw error;
  }
}

/**
 * ユーザーアカウントの削除と関連データのクリーンアップを行うCallable Function (v2)
 */
export const deleteUserAccount = onCall(
  {
    region: 'asia-northeast1', // 必要に応じてリージョンを指定
    cors: allowedOrigins, // CORS許可オリジンを設定
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      loggerV2.error('User not authenticated for deleteUserAccount.');
      throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
    }

    const uid = request.auth.uid;
    const userEmail = request.auth.token.email; // メール送信のために取得
    const userDisplayName = request.auth.token.name || userEmail;

    loggerV2.info(`Attempting to delete account and data for user: ${uid}`);

    try {
      // 1. ユーザーデータの削除 (Firestore, Realtime Databaseなど)
      // この内部関数は上で定義されています。
      await cleanupUserDataInternal(uid);

      // 2. Firebase Authenticationからユーザーを削除
      await admin.auth().deleteUser(uid);
      loggerV2.info(`User successfully deleted from Firebase Authentication: ${uid}`);

      // 3. アカウント削除完了メールを送信 (Trigger Email Extensionを使用)
      if (userEmail) {
        const bcc = getAdminNotificationBcc();
        const mailDoc = {
          to: [userEmail],
          ...(bcc.length > 0 ? { bcc } : {}),
          template: {
            name: 'accountDeletedNotification', // 事前に作成したTrigger Emailのテンプレート名
            data: {
              displayName: userDisplayName || 'お客様',
              appName: '虎威', // アプリケーション名など
            },
          },
        };
        await db.collection('mail').add(mailDoc);
        loggerV2.info(`Account deletion notification email queued for: ${userEmail}`);
      } else {
        loggerV2.warn(`User ${uid} does not have an email. Skipping deletion notification.`);
      }

      return { success: true, message: 'アカウントと関連データが正常に削除されました。' };
    } catch (error: any) {
      loggerV2.error(`Error during account deletion process for user ${uid}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      // エラーメッセージをより具体的にすることも検討
      throw new HttpsError(
        'internal',
        'アカウントの削除処理中にエラーが発生しました。',
        error.message
      );
    }
  }
);

export const getAdminUserAccountByEmail = onRequest(
  { region: 'asia-northeast1' },
  (request, response) => {
    runAdminHttpHandler(request, response, async () => {
      try {
        await assertAdminHttpRequest(request);
        const data = request.body as AdminUserActionData;
        const email = normalizeEmail(data.email);
        const userRecord = await admin.auth().getUserByEmail(email);
        response.json({
          success: true,
          user: toAdminAccountResponse(userRecord),
        });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          sendHttpError(
            response,
            new HttpsError('not-found', '指定されたメールアドレスのユーザーが見つかりません。'),
            'ユーザー情報の取得に失敗しました。'
          );
          return;
        }
        sendHttpError(response, error, 'ユーザー情報の取得に失敗しました。');
      }
    });
  }
);

export const setAdminUserDisabledByEmail = onRequest(
  { region: 'asia-northeast1' },
  (request, response) => {
    runAdminHttpHandler(request, response, async () => {
      try {
        const adminUid = await assertAdminHttpRequest(request);
        const data = request.body as AdminSetUserDisabledData;
        const email = normalizeEmail(data.email);

        if (typeof data.disabled !== 'boolean') {
          throw new HttpsError('invalid-argument', 'disabled は boolean で指定してください。');
        }

        const userRecord = await admin.auth().getUserByEmail(email);
        if (userRecord.uid === adminUid) {
          throw new HttpsError('failed-precondition', '自分自身の認証状態は変更できません。');
        }

        const updatedUser = await admin.auth().updateUser(userRecord.uid, {
          disabled: data.disabled,
        });
        loggerV2.info(
          `Admin ${adminUid} set disabled=${data.disabled} for user ${updatedUser.uid}.`
        );

        response.json({
          success: true,
          message: data.disabled
            ? 'ユーザーの認証を停止しました。'
            : 'ユーザーの認証停止を解除しました。',
          user: toAdminAccountResponse(updatedUser),
        });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          sendHttpError(
            response,
            new HttpsError('not-found', '指定されたメールアドレスのユーザーが見つかりません。'),
            'ユーザーの認証状態変更に失敗しました。'
          );
          return;
        }
        sendHttpError(response, error, 'ユーザーの認証状態変更に失敗しました。');
      }
    });
  }
);

export const deleteAdminUserAccountByEmail = onRequest(
  { region: 'asia-northeast1' },
  (request, response) => {
    runAdminHttpHandler(request, response, async () => {
      try {
        const adminUid = await assertAdminHttpRequest(request);
        const data = request.body as AdminUserActionData;
        const email = normalizeEmail(data.email);
        const userRecord = await admin.auth().getUserByEmail(email);
        if (userRecord.uid === adminUid) {
          throw new HttpsError('failed-precondition', '自分自身のアカウントは削除できません。');
        }

        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        if (isStripeDeletionBlocked(userDoc.data())) {
          throw new HttpsError(
            'failed-precondition',
            '有効なStripeサブスクリプションがあるため削除できません。先にStripeの期間末キャンセルまたは解約を完了してください。'
          );
        }

        await cleanupUserDataInternal(userRecord.uid);
        await admin.auth().deleteUser(userRecord.uid);
        loggerV2.info(`Admin ${adminUid} deleted account and data for user ${userRecord.uid}.`);

        if (userRecord.email) {
          const bcc = getAdminNotificationBcc();
          await db.collection('mail').add({
            to: [userRecord.email],
            ...(bcc.length > 0 ? { bcc } : {}),
            template: {
              name: 'accountDeletedNotification',
              data: {
                displayName: userRecord.displayName || userRecord.email,
                appName: '虎威',
              },
            },
          });
        }

        response.json({
          success: true,
          message: 'ユーザーのアカウントと関連データを削除しました。',
          uid: userRecord.uid,
          email: userRecord.email ?? email,
        });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          sendHttpError(
            response,
            new HttpsError('not-found', '指定されたメールアドレスのユーザーが見つかりません。'),
            'アカウント削除に失敗しました。'
          );
          return;
        }
        sendHttpError(response, error, 'アカウント削除に失敗しました。');
      }
    });
  }
);

interface SendPasswordResetEmailData {
  email: string;
  lang?: string; // 例: 'ja', 'en'
}

export const sendPasswordResetLink = onCall({ region: 'asia-northeast1' }, async (request) => {
  const data = request.data as SendPasswordResetEmailData;
  const { email, lang = 'ja' } = data; // デフォルト言語を 'ja'

  if (!email) {
    loggerV2.error('Email is required for sendPasswordResetLink.');
    throw new HttpsError('invalid-argument', 'メールアドレスは必須です。');
  }

  // ユーザーが存在するかどうかを事前に確認することも可能ですが、
  // generatePasswordResetLink はユーザーが存在しない場合でもエラーをスローしないため、
  // ユーザーに「メールアドレスが登録されていれば」メールが送信される旨を伝えるのが一般的です。
  let userDisplayName = 'お客様'; // デフォルトの表示名
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    userDisplayName = userRecord.displayName || userRecord.email || userDisplayName;
  } catch (error: any) {
    // auth/user-not-found の場合は、ユーザーに通知せず処理を続行し、
    // メールが送信されたかのような応答を返すことで、アカウント存在の有無を推測させないようにします。
    if (error.code !== 'auth/user-not-found') {
      loggerV2.warn(`Error fetching user by email ${email} (but proceeding):`, error.message);
    }
    // ユーザーが見つからない場合でも、エラーをスローせずに続行します。
    // メールの宛先が存在しないため、実際にはメールは送信されませんが、
    // クライアントには成功したかのように見せかけることでセキュリティを向上させます。
  }

  try {
    const appBaseUrl = appBaseUrlConfig.value();
    if (!appBaseUrl) {
      loggerV2.error('Application base URL (APP_URL) is not configured.');
      throw new HttpsError('internal', 'アプリケーションのベースURLが設定されていません。');
    }

    // パスワードリセット後のリダイレクト先などを指定
    const actionCodeSettings = {
      url: `${appBaseUrl}/auth/signin?resetPassword=true&lang=${lang}`, // 例: パスワードリセット後にサインインページへ
      handleCodeInApp: true,
    };

    const passwordResetLink = await admin
      .auth()
      .generatePasswordResetLink(email, actionCodeSettings);

    let templateName = 'passwordReset_ja'; // Trigger Emailのテンプレート名
    if (lang === 'en') {
      templateName = 'passwordReset_en';
    }

    await db.collection('mail').add({
      to: [email],
      template: {
        name: templateName,
        data: {
          displayName: userDisplayName,
          passwordResetLink, // テンプレートに渡す変数
          appName: '虎威', // アプリケーション名
        },
      },
    });

    loggerV2.info(`Password reset email queued for ${email} with lang ${lang}.`);
    return {
      success: true,
      message: 'パスワードリセット用のメールを送信しました。メールボックスをご確認ください。',
    };
  } catch (error: any) {
    loggerV2.error(`Error sending password reset email for ${email}:`, error);
    throw new HttpsError(
      'internal',
      'パスワードリセットメールの送信中にエラーが発生しました。',
      error.message
    );
  }
});
