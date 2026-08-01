/**
 * 投稿画像の共通型・アップロードヘルパ（Phase 9）。
 * クライアントで 1MB 未満にリサイズ → ユーザーの Google ドライブへアップロード（公開リンク）。
 */
import type { User } from 'firebase/auth';
import { auth } from '@/firebase';
import type { AppDispatch } from '@/store';
import { performUploadWorkflow } from '@/utils/googleDrive/uploadManager';
import { resizeImageToLimit } from '@/utils/imageResize';

export interface UploadedMedia {
  fileId: string;
  /** 公開 URL（mediaUrls に入れる） */
  url: string;
  /** ローカルプレビュー用 objectURL */
  preview: string;
  name: string;
}

export const MAX_IMAGES = 4;

// Drive 公開画像を正しい content-type で返すエンドポイント
export const driveImageUrl = (fileId: string) => `https://lh3.googleusercontent.com/d/${fileId}`;
const driveUrl = driveImageUrl;

/** Drive ファイルを「リンクを知る全員」に公開する（既に公開でもエラーにしない）。 */
export async function makeDrivePublic(fileId: string, token: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch(() => undefined);
}

/** 1枚をリサイズ → Drive アップロード → UploadedMedia を返す（失敗時 throw）。 */
export async function uploadImageToDrive(
  file: File,
  token: string,
  dispatch: AppDispatch
): Promise<UploadedMedia> {
  const resized = await resizeImageToLimit(file);
  const result = await performUploadWorkflow({
    selectedFile: resized,
    user: auth.currentUser as User,
    googleAccessToken: token || '',
    dispatch,
  });
  if (!result.success || !result.uploadData) {
    throw new Error(result.message || 'アップロードに失敗しました。');
  }
  return {
    fileId: result.uploadData.fileId,
    url: driveUrl(result.uploadData.fileId),
    preview: URL.createObjectURL(resized),
    name: file.name,
  };
}
