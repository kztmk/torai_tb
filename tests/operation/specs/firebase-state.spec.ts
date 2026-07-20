import {
  getOperationUserDoc,
  getOperationUserSettings,
  hasFirebaseClientEnv,
  hasOperationUid,
} from '../helpers/firebaseState';
import { describeChecklistCase, expect, test } from '../helpers/operationTest';

test.describe('operation checklist: Firebase state', () => {
  test.skip(!hasFirebaseClientEnv(), 'Firebase VITE_* env vars are required.');
  test.skip(!hasOperationUid(), 'OPERATION_TEST_UID is required.');

  test(describeChecklistCase('1-4'), async () => {
    const userDoc = await getOperationUserDoc();

    expect(userDoc).not.toBeNull();
    expect(userDoc?.email).toEqual(expect.any(String));
    expect(userDoc?.subscriptionStatus).toBeDefined();
  });

  test(describeChecklistCase('1-9'), async () => {
    const userDoc = await getOperationUserDoc();
    const firstMonthDiscount = userDoc?.firstMonthDiscount;

    test.skip(!firstMonthDiscount, 'firstMonthDiscount is not set for this user.');

    expect(firstMonthDiscount.status).toEqual(expect.any(String));
    expect(firstMonthDiscount.expiresAt).toBeDefined();
  });

  test(describeChecklistCase('13-8'), async () => {
    const settings = await getOperationUserSettings();

    expect(settings).not.toBeNull();
    expect(settings).toHaveProperty('googleSheetUrl');
  });
});
