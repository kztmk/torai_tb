import admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { xApiKey, xApiKeySecret } from '../config';
import { db } from '../utils';

const X_OAUTH_TOKEN_URL = 'https://api.x.com/oauth2/token';
const X_TRENDS_URL = 'https://api.x.com/2/trends/by/woeid/1118370';
const TOKYO_WOEID = 1118370;
const MAX_TRENDS = 20;
const MAX_STORED_SNAPSHOTS = 12;
const TREND_SNAPSHOT_CLEANUP_LIMIT = 500;
const FIRESTORE_BATCH_WRITE_LIMIT = 500;
const X_API_TIMEOUT_MS = 10000;

type XBearerTokenResponse = {
  access_token?: unknown;
  token_type?: unknown;
};

type XTrendResponseItem = {
  trend_name: string;
  tweet_count?: number | null;
};

type XTrendsResponse = {
  data?: unknown;
  errors?: unknown;
};

type StoredXTrend = {
  rank: number;
  chart: string;
  keyword: string;
  posts?: number;
};

const readResponseText = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text.slice(0, 1000);
};

const getXBearerToken = async (): Promise<string> => {
  const apiKey = xApiKey.value().trim();
  const apiKeySecret = xApiKeySecret.value().trim();
  if (!apiKey || !apiKeySecret) {
    throw new Error('X API Key or API Key Secret is not configured.');
  }

  const credentials = Buffer.from(
    `${encodeURIComponent(apiKey)}:${encodeURIComponent(apiKeySecret)}`
  ).toString('base64');
  const response = await fetch(X_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(X_API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`X bearer token request failed (${response.status}): ${await readResponseText(response)}`);
  }

  const payload = (await response.json()) as XBearerTokenResponse | null;
  if (
    !payload ||
    typeof payload.access_token !== 'string' ||
    !payload.access_token ||
    typeof payload.token_type !== 'string' ||
    payload.token_type.toLowerCase() !== 'bearer'
  ) {
    throw new Error('X bearer token response is invalid.');
  }
  return payload.access_token;
};

export const normalizeXTrends = (data: unknown): StoredXTrend[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is XTrendResponseItem => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const trend = item as Record<string, unknown>;
      return (
        typeof trend.trend_name === 'string' &&
        trend.trend_name.trim().length > 0 &&
        (trend.tweet_count === undefined ||
          trend.tweet_count === null ||
          typeof trend.tweet_count === 'number')
      );
    })
    .slice(0, MAX_TRENDS)
    .map((item, index) => ({
      rank: index + 1,
      chart: '東京のトレンド',
      keyword: item.trend_name.trim(),
      ...(typeof item.tweet_count === 'number' && Number.isFinite(item.tweet_count)
        ? { posts: item.tweet_count }
        : {}),
    }));
};

const fetchTokyoXTrends = async (): Promise<StoredXTrend[]> => {
  const bearerToken = await getXBearerToken();
  const url = new URL(X_TRENDS_URL);
  url.searchParams.set('max_trends', String(MAX_TRENDS));
  url.searchParams.set('trend.fields', 'trend_name,tweet_count');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(X_API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`X trends request failed (${response.status}): ${await readResponseText(response)}`);
  }

  const payload = (await response.json()) as XTrendsResponse | null;
  const trends = normalizeXTrends(payload?.data);
  if (trends.length === 0) {
    throw new Error(
      `X trends response contained no usable data: ${JSON.stringify(payload?.errors || [])}`
    );
  }
  return trends;
};

const deleteOldTrendSnapshots = async (): Promise<void> => {
  const snapshot = await db
    .collection('XTrends')
    .select()
    .orderBy('timestamp', 'desc')
    .limit(TREND_SNAPSHOT_CLEANUP_LIMIT)
    .get();
  if (snapshot.size <= MAX_STORED_SNAPSHOTS) {
    return;
  }

  const documentsToDelete = snapshot.docs.slice(MAX_STORED_SNAPSHOTS);
  for (let index = 0; index < documentsToDelete.length; index += FIRESTORE_BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    documentsToDelete
      .slice(index, index + FIRESTORE_BATCH_WRITE_LIMIT)
      .forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
};

export const updateTokyoXTrends = onSchedule(
  {
    schedule: 'every 4 hours',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
    secrets: [xApiKey, xApiKeySecret],
    retryCount: 1,
  },
  async () => {
    try {
      const trends = await fetchTokyoXTrends();
      await db.collection('XTrends').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        location: { name: 'Tokyo', woeid: TOKYO_WOEID },
        source: 'x-api-v2',
        xtrends: trends,
      });
      try {
        await deleteOldTrendSnapshots();
      } catch (cleanupError) {
        logger.warn('Failed to clean up old X trend snapshots, but trends were updated.', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
      logger.info('Tokyo X trends updated.', { trendCount: trends.length });
    } catch (error) {
      logger.error('Failed to update Tokyo X trends.', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
);
