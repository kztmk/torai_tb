import dayjs from 'dayjs';
import { User } from 'firebase/auth'; // Firebase User型
import { AppDispatch } from '@/store'; // ReduxのDispatch型

import {
  clearGoogleAccessToken,
  linkAndGetGoogleToken,
} from '@/store/reducers/googleAccessTokenSlice';
// SliceのアクションとThunk
import { uploadFileToGoogleDrive, UploadSuccessResult } from './uploadToGDriveFirebase';

// アップロード関数

// アップロード処理関数
// 必要な引数を定義
interface PerformUploadArgs {
  selectedFile: File;
  user: User;
  googleAccessToken: string;
  dispatch: AppDispatch; // Redux Dispatch関数
}

// 戻り値の型 (成功または失敗を示す)
interface PerformUploadResult {
  success: boolean;
  message: string; // UI表示用のメッセージ
  uploadData?: UploadSuccessResult; // 成功した場合のデータ
  needsReauth?: boolean; // 再認証が必要かどうかのフラグ
}

export const performUploadWorkflow = async ({
  selectedFile,
  googleAccessToken,
  dispatch,
}: PerformUploadArgs): Promise<PerformUploadResult> => {
  let currentToken = googleAccessToken;

  // 1. トークンがない場合は取得を試みる
  if (!currentToken) {
    console.log('No Google access token found, attempting to link/re-authenticate...');
    try {
      const resultAction = await dispatch(linkAndGetGoogleToken());
      if (linkAndGetGoogleToken.fulfilled.match(resultAction)) {
        currentToken = resultAction.payload.accessToken;
        console.log('New token obtained via initial check.');
      } else {
        // 取得失敗
        const errMsg = resultAction.payload ?? 'Google連携/認証に失敗しました。';
        console.error('Failed to get initial Google token:', errMsg);
        return { success: false, message: `Google認証エラー: ${errMsg}`, needsReauth: true }; // 再認証が必要
      }
    } catch (thunkError) {
      console.error('Error dispatching linkAndGetGoogleToken:', thunkError);
      return { success: false, message: '認証処理中にエラーが発生しました。', needsReauth: true };
    }
  }

  // ★ ここでターゲットフォルダ名を決定 ★
  const currentYear = dayjs().format('YYYY');
  const currentMonth = dayjs().format('MM');
  const dynamicTargetFolderName = `X_Post_MediaFiles/${currentYear}/${currentMonth}`;

  console.log(`Target folder for upload: ${dynamicTargetFolderName}`);

  // 2. トークンを使ってアップロード実行
  if (!currentToken) {
    // ここに来る場合、上記の取得に失敗している
    return {
      success: false,
      message: 'Googleアクセストークンが利用できません。',
      needsReauth: true,
    };
  }

  console.log(`Uploading "${selectedFile.name}" with Google Token...`);
  const uploadResult = await uploadFileToGoogleDrive(
    selectedFile,
    currentToken,
    dynamicTargetFolderName
  );

  if (uploadResult.error) {
    console.error('Upload failed:', uploadResult.message, uploadResult.details);

    // 3. トークン関連エラーなら、トークンクリアして再認証が必要なことを伝える
    if (uploadResult.status === 401 || uploadResult.status === 403) {
      console.log('Potential token expiry/invalidation detected. Clearing token.');
      dispatch(clearGoogleAccessToken()); // ★ Stateのトークンをクリア
      return {
        success: false,
        message: `Googleアクセス権限が無効か期限切れのようです。再認証してください。`,
        needsReauth: true,
      }; // ★ 再認証フラグを立てる
    }
    // その他のアップロードエラー
    return { success: false, message: `アップロードエラー: ${uploadResult.message}` };
  }

  // 4. アップロード成功 - GASへのデータ送信
  console.log('Upload successful:', uploadResult);

  return { success: true, message: 'アップロード成功', uploadData: uploadResult };
};
