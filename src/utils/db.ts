// src/utils/db.ts
import { DBSchema, IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'ImageCacheDB';
const STORE_NAME = 'imageBlobs';
const DB_VERSION = 1;

interface ImageCacheDBSchema extends DBSchema {
  [STORE_NAME]: {
    key: string; // fileId
    value: Blob;
  };
}

let dbPromise: Promise<IDBPDatabase<ImageCacheDBSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<ImageCacheDBSchema>> => {
  if (!dbPromise) {
    dbPromise = openDB<ImageCacheDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME); // キーは別途指定するため、keyPath は不要
        }
      },
    });
  }
  return dbPromise;
};

export const getBlobFromCache = async (fileId: string): Promise<Blob | undefined> => {
  try {
    const db = await getDb();
    return await db.get(STORE_NAME, fileId);
  } catch (error) {
    console.error('Failed to get blob from cache:', error);
    return undefined;
  }
};

export const saveBlobToCache = async (fileId: string, blob: Blob): Promise<void> => {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, blob, fileId);
    console.log(`Blob saved to cache for fileId: ${fileId}`);
  } catch (error) {
    console.error('Failed to save blob to cache:', error);
    // ここでエラーを再スローするかどうかは要件次第
  }
};

export const deleteBlobFromCache = async (fileId: string): Promise<void> => {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, fileId);
    console.log(`Blob deleted from cache for fileId: ${fileId}`);
  } catch (error) {
    console.error('Failed to delete blob from cache:', error);
  }
};

// (オプション) キャッシュ全体をクリアする関数など
export const clearImageCache = async (): Promise<void> => {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
    console.log('Image cache cleared.');
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};
