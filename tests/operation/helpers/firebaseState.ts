import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, ref } from 'firebase/database';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from 'firebase/firestore';

const requiredEnvKeys = [
  'VITE_API_KEY',
  'VITE_AUTH_DOMAIN',
  'VITE_DATABASE_URL',
  'VITE_PROJECT_ID',
  'VITE_STORAGE_BUCKET',
  'VITE_MESSAGING_SENDER_ID',
  'VITE_APP_ID',
] as const;

export const hasFirebaseClientEnv = (): boolean =>
  requiredEnvKeys.every((envKey) => Boolean(process.env[envKey]));

export const hasOperationUid = (): boolean => Boolean(process.env.OPERATION_TEST_UID);
export const hasOperationReferralReferrerUid = (): boolean =>
  Boolean(process.env.OPERATION_REFERRAL_REFERRER_UID || process.env.OPERATION_TEST_UID);
export const hasOperationReferralReferredUid = (): boolean =>
  Boolean(process.env.OPERATION_REFERRAL_REFERRED_UID);

const firebaseApp = () =>
  getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.VITE_API_KEY,
        authDomain: process.env.VITE_AUTH_DOMAIN,
        databaseURL: process.env.VITE_DATABASE_URL,
        projectId: process.env.VITE_PROJECT_ID,
        storageBucket: process.env.VITE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_APP_ID,
      });

export const getOperationReferralReferrerUid = (): string => {
  const uid = process.env.OPERATION_REFERRAL_REFERRER_UID || process.env.OPERATION_TEST_UID;

  if (!uid) {
    throw new Error(
      'OPERATION_REFERRAL_REFERRER_UID or OPERATION_TEST_UID is required for referral state checks.'
    );
  }

  return uid;
};

export const getOperationReferralReferredUid = (): string => {
  const uid = process.env.OPERATION_REFERRAL_REFERRED_UID;

  if (!uid) {
    throw new Error('OPERATION_REFERRAL_REFERRED_UID is required for referral state checks.');
  }

  return uid;
};

export const getOperationUserDoc = async () => {
  const uid = process.env.OPERATION_TEST_UID;

  if (!uid) {
    throw new Error('OPERATION_TEST_UID is required for Firebase state checks.');
  }

  const db = getFirestore(firebaseApp());
  const snapshot = await getDoc(doc(db, 'users', uid));

  return snapshot.exists() ? snapshot.data() : null;
};

export const getOperationUserDocByUid = async (uid: string) => {
  const db = getFirestore(firebaseApp());
  const snapshot = await getDoc(doc(db, 'users', uid));

  return snapshot.exists() ? snapshot.data() : null;
};

export const getReferralQualificationDoc = async (referredUid: string) => {
  const db = getFirestore(firebaseApp());
  const snapshot = await getDoc(doc(db, 'referralQualifications', referredUid));

  return snapshot.exists() ? snapshot.data() : null;
};

export const getReferralSummaryDoc = async (referrerUid: string) => {
  const db = getFirestore(firebaseApp());
  const snapshot = await getDoc(doc(db, 'referralSummaries', referrerUid));

  return snapshot.exists() ? snapshot.data() : null;
};

export const getReferralRewardsForReferrer = async (referrerUid: string) => {
  const db = getFirestore(firebaseApp());
  const snapshot = await getDocs(
    query(collection(db, 'referralRewards'), where('referrerUid', '==', referrerUid), limit(200))
  );

  return snapshot.docs.map((rewardDoc) => ({
    id: rewardDoc.id,
    ...rewardDoc.data(),
  })).sort((a, b) => {
    const thresholdA = typeof a.milestoneThreshold === 'number' ? a.milestoneThreshold : 0;
    const thresholdB = typeof b.milestoneThreshold === 'number' ? b.milestoneThreshold : 0;
    return thresholdA - thresholdB;
  });
};

export const getLifetimeFreeNotificationMails = async (referrerUid: string) => {
  const db = getFirestore(firebaseApp());
  const snapshot = await getDocs(
    query(
      collection(db, 'mail'),
      where('metadata.source', '==', 'torai_referral_lifetime_free'),
      where('metadata.referrerUid', '==', referrerUid),
      limit(10)
    )
  );

  return snapshot.docs.map((mailDoc) => ({
    id: mailDoc.id,
    ...mailDoc.data(),
  }));
};

export const getOperationUserSettings = async () => {
  const uid = process.env.OPERATION_TEST_UID;

  if (!uid) {
    throw new Error('OPERATION_TEST_UID is required for Firebase state checks.');
  }

  const database = getDatabase(firebaseApp());
  const snapshot = await get(ref(database, `user-data/${uid}/settings`));

  return snapshot.exists() ? snapshot.val() : null;
};
