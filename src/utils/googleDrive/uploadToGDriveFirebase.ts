export interface UploadSuccessResult {
  error?: false;
  fileId: string;
  imageUrl: string | null;
  fileName: string;
  mimeType: string;
}

export interface UploadErrorResult {
  error: true;
  message: string;
  status?: number;
  details?: any;
}

type UploadFunctionResult = UploadSuccessResult | UploadErrorResult;

/**
 * 指定されたパスのフォルダIDを取得、なければ作成してIDを返すヘルパー関数
 * パスは '/' 区切りで階層を指定可能 (例: "Parent/Child/Grandchild")
 * @param folderPath 作成または検索するフォルダのパス
 * @param accessToken Google API呼び出し用のアクセストークン
 * @returns 最下層のフォルダID (string) またはエラー発生時は null
 */
async function getOrCreateFolderIdByPath(
  folderPath: string,
  accessToken: string
): Promise<string | null> {
  const folderNames = folderPath.split('/').filter((name) => name.length > 0); // パスを分割
  let parentFolderId = 'root'; // ルートから開始

  console.log(`(getOrCreateFolderIdByPath) Ensuring folder path: ${folderPath}`);

  try {
    for (const folderName of folderNames) {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='${encodeURIComponent(folderName)}' and '${parentFolderId}' in parents and trashed=false&fields=files(id, name)`;
      console.log(
        `(getOrCreateFolderIdByPath) Searching for "${folderName}" in parent ${parentFolderId}...`
      );

      const searchResponse = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const searchResult = await searchResponse.json().catch(() => ({}));

      if (!searchResponse.ok) {
        console.error(
          `(getOrCreateFolderIdByPath) Error searching folder "${folderName}": ${searchResponse.status}`,
          searchResult
        );
        return null; // 検索エラー
      }

      if (searchResult.files && searchResult.files.length > 0) {
        // フォルダが見つかった場合
        parentFolderId = searchResult.files[0].id;
        console.log(
          `(getOrCreateFolderIdByPath) Found folder "${folderName}" with ID: ${parentFolderId}`
        );
      } else {
        // フォルダが見つからない場合は作成
        console.log(
          `(getOrCreateFolderIdByPath) Folder "${folderName}" not found in ${parentFolderId}. Creating...`
        );
        const createUrl = 'https://www.googleapis.com/drive/v3/files';
        const folderMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId], // ★ 現在の親フォルダを指定
        };

        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(folderMetadata),
        });
        const createResponseBody = await createResponse.json().catch(() => ({}));

        if (!createResponse.ok) {
          console.error(
            `(getOrCreateFolderIdByPath) Error creating folder "${folderName}": ${createResponse.status}`,
            createResponseBody
          );
          return null; // 作成失敗
        }
        const newFolderId = createResponseBody.id;
        if (!newFolderId) {
          console.error(
            '(getOrCreateFolderIdByPath) Folder creation succeeded but no ID returned:',
            createResponseBody
          );
          return null;
        }
        parentFolderId = newFolderId; // 次のループのために親IDを更新
        console.log(
          `(getOrCreateFolderIdByPath) Created folder "${folderName}" with ID: ${parentFolderId}`
        );
      }
    }
    // ループが完了したら、最後の parentFolderId が目的のフォルダID
    return parentFolderId;
  } catch (error) {
    console.error(`(getOrCreateFolderIdByPath) Unexpected error for path "${folderPath}":`, error);
    return null;
  }
}

/**
 * 指定されたファイルをユーザーのGoogle Driveにアップロードし、
 * File IDや画像表示URL（画像の場合）を含む結果を返します。
 *
 * @param file アップロードする File オブジェクト
 * @param accessToken Google API呼び出しに使用するアクセストークン (nullでないこと)
 * @returns アップロード結果 (UploadSuccessResult) またはエラー情報 (UploadErrorResult) を解決する Promise
 */
export async function uploadFileToGoogleDrive(
  file: File,
  accessToken: string, // この関数が呼ばれる時点でトークンは有効なはずなので null を許容しない
  targetFolderPath: string
): Promise<UploadFunctionResult> {
  // 引数チェック (file は呼び出し元でチェック済みと仮定)
  if (!accessToken) {
    // 基本的に uploadManager から呼ばれる際にはチェック済みのはず
    console.error('uploadFileToGoogleDrive called without accessToken');
    return { error: true, message: 'アクセストークンが必要です。' };
  }

  const isImage = file.type.startsWith('image/');
  // isVideo はここでは直接使わないが、ログ等で役立つかも
  // const isVideo = file.type.startsWith('video/');

  try {
    // ★ 0. 保存先フォルダIDを取得/作成 ★
    const folderId = await getOrCreateFolderIdByPath(targetFolderPath, accessToken);
    if (!folderId) {
      // フォルダの取得/作成に失敗した場合、ルートにアップロードするかエラーにするか選択
      // ここではエラーにする
      console.error('(uploadFileToGoogleDrive) Failed to get or create target folder.');
      return {
        error: true,
        message: `保存先フォルダ「${targetFolderPath}」の準備に失敗しました。`,
      };
    }
    console.log(`(uploadFileToGoogleDrive) Target folder ID: ${folderId}`);

    // 1. Google Drive にファイルをアップロード
    console.log(`(uploadFileToGoogleDrive) Uploading "${file.name}"...`);
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [folderId], // 特定のフォルダに入れたい場合
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    // ★ レスポンスボディを先に取得しておく (エラー時も必要) ★
    const uploadResponseBody = await uploadResponse.json().catch(() => ({}));

    if (!uploadResponse.ok) {
      const errorMessage =
        uploadResponseBody?.error?.message ||
        uploadResponse.statusText ||
        '不明なアップロードエラー';
      console.error(
        '(uploadFileToGoogleDrive) Upload failed:',
        uploadResponse.status,
        uploadResponseBody
      );
      return {
        error: true,
        message: `ファイルアップロード失敗: ${errorMessage}`,
        status: uploadResponse.status, // ★ ステータスコードを返す
        details: uploadResponseBody,
      };
    }

    const uploadedFileData = uploadResponseBody;
    const newFileId = uploadedFileData.id as string;
    if (!newFileId) {
      console.error(
        '(uploadFileToGoogleDrive) Upload succeeded but no File ID returned:',
        uploadedFileData
      );
      return {
        error: true,
        message: 'アップロード成功しましたが、File IDを取得できませんでした。',
        details: uploadedFileData,
      };
    }
    console.log(`(uploadFileToGoogleDrive) File uploaded, ID: ${newFileId}`);

    let imageUrl: string | null = null;

    // 2. 画像の場合のみ、共有設定を変更し、表示用URLを生成
    if (isImage) {
      console.log(`(uploadFileToGoogleDrive) Setting permissions for image (ID: ${newFileId})...`);
      try {
        const permissionResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${newFileId}/permissions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone',
            }),
          }
        );

        const permissionResponseBody = await permissionResponse.json().catch(() => ({}));

        if (!permissionResponse.ok) {
          const errorMessage =
            permissionResponseBody?.error?.message ||
            permissionResponse.statusText ||
            '不明な権限エラー';
          // 権限設定エラーは警告に留め、imageUrl を null のままにする
          console.warn(
            `(uploadFileToGoogleDrive) Failed to set public permission (continuing): ${errorMessage}`,
            permissionResponseBody
          );
        } else {
          console.log('(uploadFileToGoogleDrive) File permissions set to public readable.');
          imageUrl = `https://drive.google.com/uc?export=view&id=${newFileId}`;
        }
      } catch (permError) {
        console.warn(
          `(uploadFileToGoogleDrive) Error occurred while setting permissions: ${permError}`
        );
        // imageUrl は null のまま
      }
    }

    // 3. 成功結果を返す
    console.log(`(uploadFileToGoogleDrive) Returning success for File ID: ${newFileId}`);
    return {
      // error: false, // 省略可能
      fileId: newFileId,
      imageUrl,
      fileName: file.name,
      mimeType: file.type,
    };
  } catch (err) {
    // fetch 自体の失敗など
    console.error('(uploadFileToGoogleDrive) Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
    return {
      error: true,
      message: `アップロード処理中に予期せぬエラーが発生しました: ${errorMessage}`,
      details: err,
    };
  }
}
