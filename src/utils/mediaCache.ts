import Mp4Image from '@/assets/images/mp4image.jpg';
import { getBlobFromCache, saveBlobToCache } from '@/utils/db';

interface MediaLoadingCallbacks {
  onLoadingStart?: (fileId: string) => void;
  onSuccess?: (fileId: string, objectUrl: string, blob?: Blob) => void;
  onError?: (fileId: string, error: Error | string) => void;
}

/**
 * Google Driveからファイルを取得してIndexedDBにキャッシュし、BlobURLを生成する
 */
export async function fetchAndCacheBlob(
  fileId: string,
  accessToken: string | null,
  mimeType?: string,
  callbacks?: MediaLoadingCallbacks
): Promise<string | null> {
  if (!fileId || !accessToken) {
    return null;
  }

  // ローディング開始通知
  callbacks?.onLoadingStart?.(fileId);

  try {
    // 動画の場合は特別処理
    if (mimeType && mimeType.startsWith('video/')) {
      callbacks?.onSuccess?.(fileId, Mp4Image);
      return Mp4Image;
    }

    // const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    // Google Driveからファイル取得
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorBody = await response.text(); // エラーレスポンスの内容を確認
      console.error('Google Drive API fetch error status:', response.status, 'body:', errorBody);
      // エラーレスポンスボディをエラーメッセージに含める
      throw new Error(
        `ファイル取得エラー: ${response.status}. Response: ${errorBody.substring(0, 200)}`
      ); // エラーボディが長い場合があるので一部のみ表示
    }

    if (!response.ok) {
      throw new Error(`ファイル取得エラー: ${response.status}`);
    }

    const blob = await response.blob();

    if (!blob.type.startsWith('image/') && !blob.type.startsWith('video/')) {
      throw new Error('サポートされていないファイル形式です');
    }

    // 動画だった場合
    if (blob.type.startsWith('video/')) {
      await saveBlobToCache(fileId, blob); // キャッシュはしておく
      callbacks?.onSuccess?.(fileId, Mp4Image, blob);
      return Mp4Image;
    }

    // 画像の場合
    await saveBlobToCache(fileId, blob);
    const objectUrl = URL.createObjectURL(blob);
    callbacks?.onSuccess?.(fileId, objectUrl, blob);
    return objectUrl;
  } catch (error) {
    console.error(`Error fetching/caching blob for fileId ${fileId}:`, error);
    callbacks?.onError?.(fileId, error instanceof Error ? error : String(error));
    return null;
  }
}

/**
 * ファイルIDに対応する画像をロード（キャッシュを優先的に使用）
 */
export async function loadImage(
  fileId: string,
  accessToken: string | null,
  mimeType?: string,
  callbacks?: MediaLoadingCallbacks
): Promise<string | null> {
  if (!fileId) {
    return null;
  }

  // 動画の場合は即座にデフォルト画像を返す
  if (mimeType && mimeType.startsWith('video/')) {
    callbacks?.onSuccess?.(fileId, Mp4Image);
    return Mp4Image;
  }

  // ローディング開始通知
  callbacks?.onLoadingStart?.(fileId);

  try {
    // IndexedDBキャッシュを確認
    const cachedBlob = await getBlobFromCache(fileId);

    if (cachedBlob) {
      console.log(`Cache hit for fileId: ${fileId}`);
      // キャッシュヒット：BlobURLを生成
      const objectUrl = URL.createObjectURL(cachedBlob);
      callbacks?.onSuccess?.(fileId, objectUrl, cachedBlob);
      return objectUrl;
    }
    console.log(`Cache miss for fileId: ${fileId}. Fetching from Google Drive...`);
    // キャッシュミス：Google Driveから取得
    if (accessToken) {
      return await fetchAndCacheBlob(fileId, accessToken, mimeType, callbacks);
    }
    // トークンがない場合
    const error = '認証トークンが必要です';
    callbacks?.onError?.(fileId, error);
    console.warn(`Cannot fetch image for ${fileId} without access token.`);
    return null;
  } catch (error) {
    console.error(`Error in loadImage for ${fileId}:`, error);
    callbacks?.onError?.(fileId, error instanceof Error ? error : String(error));
    return null;
  }
}

/**
 * BlobURLマネージャークラス - URLの追跡と解放を管理
 */
export class BlobUrlManager {
  private blobUrls: Record<string, string> = {};

  // BlobURLを追加して追跡
  addUrl(key: string, url: string): void {
    if (this.blobUrls[key]) {
      this.releaseUrl(key);
    }
    this.blobUrls[key] = url;
  }

  // 特定のBlobURLを解放
  releaseUrl(key: string): void {
    const url = this.blobUrls[key];
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      delete this.blobUrls[key];
    }
  }

  // すべてのBlobURLを解放
  releaseAll(): void {
    Object.entries(this.blobUrls).forEach(([url]) => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.blobUrls = {};
  }

  // キーに対応するURLを取得
  getUrl(key: string): string | undefined {
    return this.blobUrls[key];
  }

  // すべてのBlobURLを取得
  getAllUrls(): Record<string, string> {
    return { ...this.blobUrls };
  }
}
