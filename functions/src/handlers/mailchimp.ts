import mailchimp from '@mailchimp/mailchimp_marketing';
import admin from 'firebase-admin';
import { createHash } from 'crypto';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { mailchimpApiKey, mailchimpAudienceId } from '../config';

export interface SyncUserData {
  email?: string;
  displayName?: string;
  applyMailchimpTag?: string[];
  preferredLanguage?: string;
  mailchimpPersistentTags?: string[];
}

const ENGLISH_AUDIENCE_TAG = 'torai-en';

function uniqueTags(...tagGroups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(tagGroups.flatMap((tags) => tags || []).filter(Boolean)));
}

function getEffectiveTags(data?: SyncUserData): string[] {
  return uniqueTags(
    data?.applyMailchimpTag,
    data?.mailchimpPersistentTags,
    data?.preferredLanguage === 'en' ? [ENGLISH_AUDIENCE_TAG] : undefined
  );
}

const MAILCHIMP_SERVER_PREFIX_PATTERN = /^us\d+$/;

function getMailchimpServerPrefix(apiKey: string): string | null {
  const serverPrefix = apiKey.trim().split('-').pop();
  if (!serverPrefix || !MAILCHIMP_SERVER_PREFIX_PATTERN.test(serverPrefix)) {
    return null;
  }

  return serverPrefix;
}

function getWriteType(event: Parameters<Parameters<typeof onDocumentWritten>[1]>[0]): string {
  const beforeExists = event.data?.before.exists;
  const afterExists = event.data?.after.exists;

  if (!beforeExists && afterExists) {
    return 'created';
  }
  if (beforeExists && afterExists) {
    return 'updated';
  }
  if (beforeExists && !afterExists) {
    return 'deleted';
  }

  return 'unknown';
}

function getMailchimpErrorStatus(error: any): number | undefined {
  return error?.status || error?.response?.status || error?.response?.statusCode;
}

function isPermanentMailchimpError(error: any): boolean {
  const status = getMailchimpErrorStatus(error);
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return true;
  }

  return typeof error?.message === 'string' && error.message.toLowerCase() === 'forbidden';
}

function areStringArraysEqual(left?: string[], right?: string[]): boolean {
  const normalizedLeft = left || [];
  const normalizedRight = right || [];
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function normalizeEmail(value?: string): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

async function unsubscribePreviousMailchimpEmail(args: {
  uid: string;
  audienceId: string;
  currentEmail: string;
  previousEmail?: string;
}) {
  const { uid, audienceId, currentEmail, previousEmail } = args;
  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const normalizedPreviousEmail = normalizeEmail(previousEmail);
  if (!normalizedCurrentEmail || !normalizedPreviousEmail) {
    return;
  }
  if (normalizedCurrentEmail === normalizedPreviousEmail) {
    return;
  }

  const previousSubscriberHash = createHash('md5').update(normalizedPreviousEmail).digest('hex');
  try {
    await mailchimp.lists.updateListMember(audienceId, previousSubscriberHash, {
      status: 'unsubscribed',
    } as any);
    logger.info('Successfully unsubscribed previous Mailchimp email.', {
      uid,
      previousSubscriberHash,
    });
  } catch (error: any) {
    const status = getMailchimpErrorStatus(error);
    const errorDetails = {
      uid,
      previousSubscriberHash,
      status,
      responseBody: error.response?.body,
      responseText: error.response?.text,
      message: error.message,
    };
    if (status === 404 || isPermanentMailchimpError(error)) {
      logger.warn('Skipping previous Mailchimp email unsubscribe after permanent error.', errorDetails);
      return;
    }
    logger.error('Transient Mailchimp error while unsubscribing previous email, retrying.', errorDetails);
    throw error;
  }
}

function hasRelevantMailchimpFieldChange(args: {
  afterData?: SyncUserData;
  beforeData?: SyncUserData;
}): boolean {
  const {afterData, beforeData} = args;
  return (
    afterData?.email !== beforeData?.email ||
    afterData?.displayName !== beforeData?.displayName ||
    afterData?.preferredLanguage !== beforeData?.preferredLanguage ||
    !areStringArraysEqual(afterData?.applyMailchimpTag, beforeData?.applyMailchimpTag) ||
    !areStringArraysEqual(
      afterData?.mailchimpPersistentTags,
      beforeData?.mailchimpPersistentTags
    )
  );
}

export async function syncUserDataToMailchimp(args: {
  uid: string;
  writeType: string;
  afterData?: SyncUserData;
  beforeData?: SyncUserData;
}) {
  const apiKey = mailchimpApiKey.value().trim();
  const audienceId = mailchimpAudienceId.value().trim();
  const { uid, writeType, afterData, beforeData } = args;

  if (!apiKey || !audienceId) {
    logger.error('Mailchimp API Key or Audience ID is not configured.');
    return;
  }

  const email = afterData?.email;
  if (!email) {
    logger.info('No email found in user document, skipping Mailchimp sync.', {uid, writeType});
    return;
  }

  const serverPrefix = getMailchimpServerPrefix(apiKey);
  if (!serverPrefix) {
    logger.error('Mailchimp API Key does not include a valid server prefix such as "-us21".');
    return;
  }

  mailchimp.setConfig({
    apiKey,
    server: serverPrefix,
  });

  const subscriberHash = createHash('md5').update(email.toLowerCase()).digest('hex');
  const tags = getEffectiveTags(afterData);

  logger.info('Starting Mailchimp sync.', {
    uid,
    writeType,
    subscriberHash,
    audienceId,
    serverPrefix,
    tags,
  });

  try {
    const mergeFields: Record<string, string> = {};
    if (afterData.displayName) {
      mergeFields.FNAME = afterData.displayName;
    }

    await unsubscribePreviousMailchimpEmail({
      uid,
      audienceId,
      currentEmail: email,
      previousEmail: beforeData?.email,
    });

    const member = await mailchimp.lists.setListMember(audienceId, subscriberHash, {
      email_address: email,
      status_if_new: 'subscribed',
      merge_fields: mergeFields,
    } as any);
    logger.info('Successfully synced user to Mailchimp.', {
      uid,
      subscriberHash,
      mailchimpId: (member as any)?.id,
      mailchimpStatus: (member as any)?.status,
      mailchimpUniqueEmailId: (member as any)?.unique_email_id,
    });

    const newTags = tags;
    const oldTags = getEffectiveTags(beforeData);

    const tagsToUpdate: { name: string; status: 'active' | 'inactive' }[] = [];

    newTags.forEach((tag) => {
      tagsToUpdate.push({ name: tag, status: 'active' });
    });

    oldTags.forEach((tag) => {
      if (!newTags.includes(tag)) {
        tagsToUpdate.push({ name: tag, status: 'inactive' });
      }
    });

    if (tagsToUpdate.length > 0) {
      await mailchimp.lists.updateListMemberTags(audienceId, subscriberHash, {
        tags: tagsToUpdate,
      });
      logger.info(
        'Successfully updated Mailchimp tags.',
        {uid, subscriberHash, tags: tagsToUpdate}
      );
    } else {
      logger.info('No Mailchimp tag changes to apply.', {uid, subscriberHash});
    }
  } catch (error: any) {
    const errorStatus = getMailchimpErrorStatus(error);
    const errorDetails = {
      uid,
      subscriberHash,
      status: errorStatus,
      responseBody: error.response?.body,
      responseText: error.response?.text,
      message: error.message,
    };

    if (isPermanentMailchimpError(error)) {
      logger.warn('Permanent Mailchimp error, skipping retry.', errorDetails);
      return;
    }

    logger.error('Transient Mailchimp error, retrying.', errorDetails);
    throw error;
  }
}

export const syncToMailchimp = onDocumentWritten(
  {
    document: 'users/{uid}',
    region: 'asia-northeast1',
    retry: true,
    secrets: [mailchimpApiKey],
  },
  async (event) => {
    const uid = event.params.uid;
    const writeType = getWriteType(event);

    const afterData = event.data?.after.data() as SyncUserData | undefined;
    const beforeData = event.data?.before.data() as SyncUserData | undefined;

    // ドキュメントが削除された場合は同期をスキップ（必要に応じてunsubscribe処理を追加）
    if (!event.data?.after.exists) {
      logger.info('Document deleted, skipping Mailchimp sync.', {uid, writeType});
      return;
    }

    if (!hasRelevantMailchimpFieldChange({afterData, beforeData})) {
      logger.info('No relevant Mailchimp fields changed, skipping sync.', {uid, writeType});
      return;
    }

    if (
      afterData?.preferredLanguage === 'en' &&
      !afterData.mailchimpPersistentTags?.includes(ENGLISH_AUDIENCE_TAG)
    ) {
      await event.data.after.ref.set(
        {
          mailchimpPersistentTags: admin.firestore.FieldValue.arrayUnion(ENGLISH_AUDIENCE_TAG),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await syncUserDataToMailchimp({uid, writeType, afterData, beforeData});
  }
);
