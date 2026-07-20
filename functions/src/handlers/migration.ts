// functions/src/handlers/migration.ts
import admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../utils';

const LIFETIME_PLAN_ID = 'lifetime'; // 本来は config.ts で管理するのが望ましい

export const assignLifetimePlanToExistingUsers = onRequest(
  { region: 'asia-northeast1', timeoutSeconds: 540, memory: '1GiB' }, // ユーザー数が多い場合に備えてメモリも増やす
  async (_, res) => {
    // !!! セキュリティ警告 !!!
    // この関数は公開エンドポイントです。本番環境で実行する前に、必ず認証/認可の仕組みを導入するか、 // (コメントは変更なし)
    // 実行後速やかに関数を無効化/削除してください。
    // 例: リクエストヘッダーのシークレットキーを確認
    // const expectedSecret = functions.config().secrets?.migration_key; // 環境変数などで設定
    // if (!expectedSecret || req.headers['x-migration-secret'] !== expectedSecret) {
    //   logger.warn('Unauthorized attempt to run assignLifetimePlanToExistingUsers');
    //   res.status(403).send('Forbidden');
    //   return;
    // }

    logger.info('Starting to assign lifetime plan to existing users.');

    let processedUserCount = 0;
    let updatedUserCount = 0;
    let nextPageToken: string | undefined;

    try {
      const usersRef = db.collection('users');
      let batch = db.batch();
      let batchCount = 0;

      do {
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken); // 1000人ずつ取得
        nextPageToken = listUsersResult.pageToken;

        for (const userRecord of listUsersResult.users) {
          processedUserCount++;
          const userId = userRecord.uid;
          const userEmail = userRecord.email;
          const userDisplayName = userRecord.displayName;

          const userDocRef = usersRef.doc(userId);
          const userDocSnap = await userDocRef.get();

          if (userDocSnap.exists) {
            const userData = userDocSnap.data();
            // 既に何らかのプランIDが設定されている場合はスキップ
            if (userData && userData.appPlanId && userData.appPlanId !== null) {
              logger.info(`User ${userId} already has appPlanId: ${userData.appPlanId}. Skipping.`);
              continue;
            }
            // appPlanId が null または存在しない場合 (ドキュメントは存在する)
            logger.info(
              `User ${userId} document exists, appPlanId is null or missing. Assigning lifetime plan.`
            );
            batch.update(userDocRef, {
              appPlanId: LIFETIME_PLAN_ID,
              subscriptionStatus: 'active',
              currentPeriodStart: admin.firestore.Timestamp.now(),
              currentPeriodEnd: null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              // email, displayName, termsAccepted, createdAt などは既存の値を保持
            });
          } else {
            // Firestoreにドキュメントが存在しない場合、新規作成
            logger.info(
              `User ${userId} document does not exist. Creating with lifetime plan and defaults.`
            );
            batch.set(userDocRef, {
              email: userEmail || null,
              displayName: userDisplayName || null,
              termsAccepted: false, // デフォルト値
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              appPlanId: LIFETIME_PLAN_ID,
              subscriptionStatus: 'active',
              currentPeriodStart: admin.firestore.Timestamp.now(),
              currentPeriodEnd: null,
              bankPaymentInfo: null, // デフォルト値
            });
          }
          updatedUserCount++;
          batchCount++;

          if (batchCount >= 490) {
            // バッチの制限(500)近くになったらコミット
            logger.info(`Committing batch of ${batchCount} operations.`);
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
        logger.info(`Processed ${processedUserCount} users so far. Fetching next page...`);
      } while (nextPageToken);

      if (batchCount > 0) {
        // 残りのバッチをコミット
        logger.info(`Committing final batch of ${batchCount} operations.`);
        await batch.commit();
      }

      logger.info(
        `Successfully processed ${processedUserCount} users. Assigned/Updated lifetime plan for ${updatedUserCount} users.`
      );
      res.status(200).send({
        message: `Successfully processed ${processedUserCount} users. Assigned/Updated lifetime plan for ${updatedUserCount} users.`,
        processedCount: processedUserCount,
        updatedCount: updatedUserCount,
      });
    } catch (error: any) {
      logger.error('Error assigning lifetime plan to existing users:', error);
      res.status(500).send({
        message: 'Internal Server Error while assigning lifetime plan.',
        error: error.message,
        processedCount: processedUserCount,
        updatedCount: updatedUserCount,
      });
    }
  }
);
