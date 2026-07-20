import admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getAdminNotificationBcc } from '../config';
import { db } from '../utils';

const DIRECT_MESSAGE_EMAIL_TEMPLATE = 'adminDirectMessageNotification';
const MAX_MESSAGE_BODY_LENGTH = 5000;
const MAX_MESSAGE_SUBJECT_LENGTH = 120;
const RECENT_MESSAGE_DAYS = 60;
const MAX_ATTACHMENTS = 3;
const BROADCAST_OVERVIEW_COLLECTION = 'messageMetadata';
const BROADCAST_OVERVIEW_DOC_ID = 'broadcastOverview';
const BROADCAST_OVERVIEW_LIMIT = 30;

type SenderRole = 'user' | 'admin';

export interface MessageAttachment {
  name: string;
  url: string;
  contentType: string;
  size: number;
  storagePath: string;
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

function normalizeText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName}を入力してください。`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new HttpsError('invalid-argument', `${fieldName}を入力してください。`);
  }
  if (normalized.length > maxLength) {
    throw new HttpsError('invalid-argument', `${fieldName}は${maxLength}文字以内で入力してください。`);
  }

  return normalized;
}

function timestampToIso(value: unknown): string | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  return null;
}

function recentMessageThreshold() {
  return admin.firestore.Timestamp.fromMillis(
    Date.now() - RECENT_MESSAGE_DAYS * 24 * 60 * 60 * 1000
  );
}

function normalizeAttachments(value: unknown, userUid: string): MessageAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  if (value.length > MAX_ATTACHMENTS) {
    throw new HttpsError('invalid-argument', `添付ファイルは${MAX_ATTACHMENTS}件までです。`);
  }

  return value.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') {
      throw new HttpsError('invalid-argument', '添付ファイル情報が不正です。');
    }
    const data = attachment as Record<string, unknown>;
    const name = normalizeText(data.name, '添付ファイル名', 200);
    const url = normalizeText(data.url, '添付ファイルURL', 2000);
    const contentType = normalizeText(data.contentType, '添付ファイル形式', 100);
    const storagePath = normalizeText(data.storagePath, '添付ファイル保存先', 500);
    const size = typeof data.size === 'number' && Number.isFinite(data.size) ? data.size : 0;
    if (storagePath.includes('..') || !storagePath.startsWith(`message-attachments/${userUid}/`)) {
      throw new HttpsError('invalid-argument', '添付ファイルの保存先が不正です。');
    }
    if (!contentType.startsWith('image/')) {
      throw new HttpsError('invalid-argument', '添付できるファイルは画像のみです。');
    }
    if (size > 10 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', '添付画像は10MB以内にしてください。');
    }
    return { name, url, contentType, size, storagePath };
  });
}

function serializeMessage(doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    body: data.body ?? '',
    senderUid: data.senderUid ?? '',
    senderRole: data.senderRole ?? '',
    recipientUid: data.recipientUid ?? '',
    recipientRole: data.recipientRole ?? '',
    createdAt: timestampToIso(data.createdAt),
    readAt: timestampToIso(data.readAt),
    readByUid: data.readByUid ?? null,
    isImportant: Boolean(data.isImportant),
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
  };
}

function serializeThread(doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    userUid: data.userUid ?? doc.id,
    userEmail: data.userEmail ?? '',
    userDisplayName: data.userDisplayName ?? '',
    latestMessageText: data.latestMessageText ?? '',
    latestMessageAt: timestampToIso(data.latestMessageAt),
    latestSenderRole: data.latestSenderRole ?? '',
    userUnreadCount: data.userUnreadCount ?? 0,
    adminUnreadCount: data.adminUnreadCount ?? 0,
    hasImportant: Boolean(data.hasImportant),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function getReadBroadcastIdSet(threadData: FirebaseFirestore.DocumentData | undefined) {
  const readBroadcastIdsValue = threadData?.readBroadcastIds;
  const readBroadcastIds = Array.isArray(readBroadcastIdsValue) ? readBroadcastIdsValue : [];
  return new Set(readBroadcastIds.filter((id): id is string => typeof id === 'string'));
}

function getBroadcastOverviewRef() {
  return db.collection(BROADCAST_OVERVIEW_COLLECTION).doc(BROADCAST_OVERVIEW_DOC_ID);
}

function normalizeBroadcastIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is string => typeof id === 'string');
}

function serializeBroadcast(
  doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot,
  readAt?: admin.firestore.Timestamp | null
) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    subject: data.subject ?? '',
    body: data.body ?? '',
    senderUid: data.senderUid ?? '',
    createdAt: timestampToIso(data.createdAt),
    readAt: readAt ? readAt.toDate().toISOString() : null,
  };
}

async function getUserProfile(uid: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', '対象ユーザーが見つかりません。');
  }
  const userData = userDoc.data() || {};
  return {
    uid,
    email: userData.email || '',
    displayName: userData.displayName || userData.email || uid,
  };
}

export async function createDirectMessage(params: {
  userUid: string;
  senderUid: string;
  senderRole: SenderRole;
  body: string;
  attachments: MessageAttachment[];
  isImportant: boolean;
  userEmail: string;
  userDisplayName: string;
}) {
  const now = admin.firestore.Timestamp.now();
  const threadRef = db.collection('supportMessageThreads').doc(params.userUid);
  const messageRef = threadRef.collection('messages').doc();
  const recipientRole: SenderRole = params.senderRole === 'admin' ? 'user' : 'admin';

  const batch = db.batch();
  batch.set(
    threadRef,
    {
      userUid: params.userUid,
      userEmail: params.userEmail,
      userDisplayName: params.userDisplayName,
      latestMessageText: params.body,
      latestMessageAt: now,
      latestSenderRole: params.senderRole,
      ...(params.isImportant ? { hasImportant: true } : {}),
      updatedAt: now,
      ...(recipientRole === 'user'
        ? { userUnreadCount: admin.firestore.FieldValue.increment(1) }
        : { adminUnreadCount: admin.firestore.FieldValue.increment(1) }),
    },
    { merge: true }
  );
  batch.set(messageRef, {
    body: params.body,
    attachments: params.attachments,
    isImportant: params.isImportant,
    senderUid: params.senderUid,
    senderRole: params.senderRole,
    recipientUid: recipientRole === 'user' ? params.userUid : 'admin',
    recipientRole,
    createdAt: now,
    readAt: null,
    readByUid: null,
  });
  await batch.commit();

  return messageRef.id;
}

export const sendUserMessageToAdmin = onCall({ region: 'asia-northeast1' }, async (request) => {
  const uid = assertAuthenticated(request);
  const body = normalizeText(request.data?.body, 'メッセージ本文', MAX_MESSAGE_BODY_LENGTH);
  const attachments = normalizeAttachments(request.data?.attachments, uid);
  const user = await getUserProfile(uid);

  const messageId = await createDirectMessage({
    userUid: uid,
    senderUid: uid,
    senderRole: 'user',
    body,
    attachments,
    isImportant: Boolean(request.data?.isImportant),
    userEmail: user.email,
    userDisplayName: user.displayName,
  });

  logger.info('User message to admin created.', { uid, messageId });
  return { success: true, messageId };
});

export const sendAdminMessageToUser = onCall({ region: 'asia-northeast1' }, async (request) => {
  const adminUid = await assertAdmin(request);
  const userUid = normalizeText(request.data?.userUid, '送信先ユーザー', 128);
  const body = normalizeText(request.data?.body, 'メッセージ本文', MAX_MESSAGE_BODY_LENGTH);
  const attachments = normalizeAttachments(request.data?.attachments, userUid);
  const user = await getUserProfile(userUid);

  const messageId = await createDirectMessage({
    userUid,
    senderUid: adminUid,
    senderRole: 'admin',
    body,
    attachments,
    isImportant: Boolean(request.data?.isImportant),
    userEmail: user.email,
    userDisplayName: user.displayName,
  });

  if (user.email) {
    const bcc = getAdminNotificationBcc();
    await db.collection('mail').add({
      to: [user.email],
      ...(bcc.length > 0 ? { bcc } : {}),
      template: {
        name: DIRECT_MESSAGE_EMAIL_TEMPLATE,
        data: {
          displayName: user.displayName || 'お客様',
          body,
          hasAttachments: attachments.length > 0,
          appName: '虎威',
        },
      },
    });
  }

  logger.info('Admin message to user created.', { adminUid, userUid, messageId });
  return { success: true, messageId };
});

export const sendAdminBroadcastMessage = onCall({ region: 'asia-northeast1' }, async (request) => {
  const adminUid = await assertAdmin(request);
  const subject = normalizeText(request.data?.subject, '件名', MAX_MESSAGE_SUBJECT_LENGTH);
  const body = normalizeText(request.data?.body, 'メッセージ本文', MAX_MESSAGE_BODY_LENGTH);
  const now = admin.firestore.Timestamp.now();

  const docRef = await db.collection('broadcastMessages').add({
    subject,
    body,
    senderUid: adminUid,
    createdAt: now,
    updatedAt: now,
  });
  await db.runTransaction(async (transaction) => {
    const overviewRef = getBroadcastOverviewRef();
    const overviewSnap = await transaction.get(overviewRef);
    const previousIds = normalizeBroadcastIds(overviewSnap.data()?.latestBroadcastIds);
    const latestBroadcastIds = [
      docRef.id,
      ...previousIds.filter((id) => id !== docRef.id),
    ].slice(0, BROADCAST_OVERVIEW_LIMIT);

    transaction.set(
      overviewRef,
      {
        latestBroadcastIds,
        latestBroadcastAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  logger.info('Admin broadcast message created.', { adminUid, broadcastId: docRef.id });
  return { success: true, broadcastId: docRef.id };
});

export const getUserMessages = onCall({ region: 'asia-northeast1' }, async (request) => {
  const uid = assertAuthenticated(request);
  const includePast = Boolean(request.data?.includePast);
  const threadRef = db.collection('supportMessageThreads').doc(uid);
  const messagesQuery = includePast
    ? threadRef.collection('messages').orderBy('createdAt', 'desc').limit(300)
    : threadRef
        .collection('messages')
        .where('createdAt', '>=', recentMessageThreshold())
        .orderBy('createdAt', 'desc')
        .limit(100);
  const [threadDoc, messagesSnap, broadcastsSnap] = await Promise.all([
    threadRef.get(),
    messagesQuery.get(),
    db.collection('broadcastMessages').orderBy('createdAt', 'desc').limit(30).get(),
  ]);

  const threadData = threadDoc.data();
  const readBroadcastIdSet = getReadBroadcastIdSet(threadData);
  const broadcastMessages = broadcastsSnap.docs.map((doc) => {
    const readAt = readBroadcastIdSet.has(doc.id)
      ? (threadData?.broadcastReadAt as admin.firestore.Timestamp | undefined) ?? null
      : null;
    return serializeBroadcast(doc, readAt);
  });

  return {
    thread: threadDoc.exists ? serializeThread(threadDoc) : null,
    directMessages: messagesSnap.docs.map(serializeMessage).reverse(),
    broadcastMessages,
  };
});

export const getUserMessageOverview = onCall({ region: 'asia-northeast1' }, async (request) => {
  const uid = assertAuthenticated(request);
  const [threadDoc, broadcastOverviewSnap] = await Promise.all([
    db.collection('supportMessageThreads').doc(uid).get(),
    getBroadcastOverviewRef().get(),
  ]);
  const threadData = threadDoc.data() || {};
  const readBroadcastIdSet = getReadBroadcastIdSet(threadData);
  let latestBroadcastIds = normalizeBroadcastIds(broadcastOverviewSnap.data()?.latestBroadcastIds);
  if (!broadcastOverviewSnap.exists) {
    const broadcastsSnap = await db
      .collection('broadcastMessages')
      .orderBy('createdAt', 'desc')
      .limit(BROADCAST_OVERVIEW_LIMIT)
      .get();
    latestBroadcastIds = broadcastsSnap.docs.map((doc) => doc.id);
  }
  const unreadBroadcastCount = latestBroadcastIds.reduce((count, broadcastId) => {
    if (!readBroadcastIdSet.has(broadcastId)) {
      return count + 1;
    }
    return count;
  }, 0);

  return {
    unreadDirectCount: threadData.userUnreadCount ?? 0,
    unreadBroadcastCount,
    unreadCount: (threadData.userUnreadCount ?? 0) + unreadBroadcastCount,
    latestThread: threadDoc.exists ? serializeThread(threadDoc) : null,
  };
});

export const markUserDirectMessagesRead = onCall({ region: 'asia-northeast1' }, async (request) => {
  const uid = assertAuthenticated(request);
  const now = admin.firestore.Timestamp.now();
  const threadRef = db.collection('supportMessageThreads').doc(uid);
  const unreadMessages = await threadRef
    .collection('messages')
    .where('recipientRole', '==', 'user')
    .where('readAt', '==', null)
    .limit(499)
    .get();

  const batch = db.batch();
  unreadMessages.docs.forEach((doc) => {
    batch.update(doc.ref, {
      readAt: now,
      readByUid: uid,
    });
  });
  batch.set(
    threadRef,
    {
      userUnreadCount: 0,
      userLastReadAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await batch.commit();

  return { success: true, readCount: unreadMessages.size };
});

export const markBroadcastMessageRead = onCall({ region: 'asia-northeast1' }, async (request) => {
  const uid = assertAuthenticated(request);
  const broadcastId = normalizeText(request.data?.broadcastId, 'メッセージID', 128);
  const now = admin.firestore.Timestamp.now();
  const threadRef = db.collection('supportMessageThreads').doc(uid);
  const readRef = db
    .collection('broadcastMessages')
    .doc(broadcastId)
    .collection('reads')
    .doc(uid);
  const batch = db.batch();
  batch.set(readRef, { uid, readAt: now }, { merge: true });
  batch.set(
    threadRef,
    {
      userUid: uid,
      readBroadcastIds: admin.firestore.FieldValue.arrayUnion(broadcastId),
      broadcastReadAt: now,
    },
    { merge: true }
  );
  await batch.commit();

  return { success: true };
});

export const getAdminMessageThreads = onCall({ region: 'asia-northeast1' }, async (request) => {
  await assertAdmin(request);
  const snap = await db
    .collection('supportMessageThreads')
    .where('adminUnreadCount', '>', 0)
    .orderBy('adminUnreadCount', 'desc')
    .orderBy('latestMessageAt', 'desc')
    .limit(100)
    .get();

  return {
    threads: snap.docs
      .map(serializeThread)
      .sort((left, right) => (right.latestMessageAt ?? '').localeCompare(left.latestMessageAt ?? '')),
  };
});

export const getAdminMessageThread = onCall({ region: 'asia-northeast1' }, async (request) => {
  await assertAdmin(request);
  const userUid = normalizeText(request.data?.userUid, 'ユーザー', 128);
  const includePast = Boolean(request.data?.includePast);
  const messagesQuery = includePast
    ? db
        .collection('supportMessageThreads')
        .doc(userUid)
        .collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(300)
    : db
        .collection('supportMessageThreads')
        .doc(userUid)
        .collection('messages')
        .where('createdAt', '>=', recentMessageThreshold())
        .orderBy('createdAt', 'desc')
        .limit(200);
  const [threadDoc, messagesSnap] = await Promise.all([
    db.collection('supportMessageThreads').doc(userUid).get(),
    messagesQuery.get(),
  ]);

  return {
    thread: threadDoc.exists ? serializeThread(threadDoc) : null,
    messages: messagesSnap.docs.map(serializeMessage).reverse(),
  };
});

// 管理者がメールアドレスから送信先ユーザーの UID を検索する。
// Firebase UID は管理者が把握しづらいため、メールアドレスでの検索を可能にする。
export const findUserUidByEmail = onCall({ region: 'asia-northeast1' }, async (request) => {
  await assertAdmin(request);
  const email = normalizeText(request.data?.email, 'メールアドレス', 256).trim().toLowerCase();

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    let displayName = userRecord.displayName || '';
    let resolvedEmail = userRecord.email || email;

    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data() || {};
      if (!displayName && typeof data.displayName === 'string') {
        displayName = data.displayName;
      }
      if (typeof data.email === 'string' && data.email) {
        resolvedEmail = data.email;
      }
    }

    return { uid: userRecord.uid, email: resolvedEmail, displayName };
  } catch (error: any) {
    const code = error?.code || error?.errorInfo?.code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
      throw new HttpsError(
        'not-found',
        '指定されたメールアドレスのユーザーが見つかりません。メールアドレスをご確認ください。'
      );
    }
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error('findUserUidByEmail failed.', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new HttpsError('internal', 'ユーザー検索中にエラーが発生しました。');
  }
});

export const markAdminThreadRead = onCall({ region: 'asia-northeast1' }, async (request) => {
  const adminUid = await assertAdmin(request);
  const userUid = normalizeText(request.data?.userUid, 'ユーザー', 128);
  const now = admin.firestore.Timestamp.now();
  const threadRef = db.collection('supportMessageThreads').doc(userUid);
  const unreadMessages = await threadRef
    .collection('messages')
    .where('recipientRole', '==', 'admin')
    .where('readAt', '==', null)
    .limit(499)
    .get();

  const batch = db.batch();
  unreadMessages.docs.forEach((doc) => {
    batch.update(doc.ref, {
      readAt: now,
      readByUid: adminUid,
    });
  });
  batch.set(
    threadRef,
    {
      adminUnreadCount: 0,
      adminLastReadAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await batch.commit();

  return { success: true, readCount: unreadMessages.size };
});

export const setMessageImportant = onCall({ region: 'asia-northeast1' }, async (request) => {
  await assertAdmin(request);
  const userUid = normalizeText(request.data?.userUid, 'ユーザー', 128);
  const messageId = normalizeText(request.data?.messageId, 'メッセージID', 128);
  const isImportant = Boolean(request.data?.isImportant);
  const threadRef = db.collection('supportMessageThreads').doc(userUid);
  const messageRef = threadRef.collection('messages').doc(messageId);

  await messageRef.update({
    isImportant,
    importantUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  let hasImportant = isImportant;
  if (!isImportant) {
    const importantMessages = await threadRef
      .collection('messages')
      .where('isImportant', '==', true)
      .limit(1)
      .get();
    hasImportant = !importantMessages.empty;
  }

  await threadRef.set(
    {
      hasImportant,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true };
});
