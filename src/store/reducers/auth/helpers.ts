// src/store/reducers/auth/helpers.ts
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/firebase';

/**
 * ファイル拡張子を取得する
 * @param file ファイルオブジェクト
 * @returns 拡張子文字列
 */
export const getFileExtension = (file: File): string => {
  const fileName = file.name;
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return '';
  } // 拡張子がない場合は空文字を返す
  return fileName.substring(lastDotIndex + 1);
};

/**
 * 画像をアップロードする
 * @param file アップロードするファイル
 * @param uid ユーザーID
 * @param useCase 使用用途（'avatar'または'background'）
 * @returns ダウンロードURL
 */
export const uploadImage = async (
  file: File,
  uid: string,
  useCase: 'avatar' | 'background'
): Promise<string> => {
  const ext = getFileExtension(file);
  if (ext === '') {
    throw new Error('Invalid file extension');
  }
  const fileName = `${useCase}.${ext}`;
  const fileRef = storageRef(storage, `user-data/${uid}/images/${fileName}`);
  console.log(`Uploading image to ${fileRef.fullPath}`);
  await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(fileRef);
  console.log(`Image uploaded successfully. Download URL: ${downloadUrl}`);
  return downloadUrl;
};
