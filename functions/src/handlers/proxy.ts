// functions/src/handlers/proxy.ts
import { createHmac, randomUUID } from 'crypto';
import admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';
import { corsHandler } from '../utils'; // utilsからcorsHandlerをインポート

interface GasProxySettings {
  googleSheetUrl?: string;
  gasProxySecret?: string;
}

interface ProxyAuthPayload {
  uid: string;
  timestamp: string;
  signature: string;
  requestId: string;
}

interface InitializeGasProxyAuthData {
  googleSheetUrl?: string;
  setupCode?: string;
}

interface ClearGasProxyAuthResponse {
  success: boolean;
  googleSheetUrl: string;
  initializedAt: string;
}

const SETUP_CODE_PATTERN = /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/i;
const AUTH_QUERY_PARAM_KEYS = new Set([
  'uid',
  'firebaseUid',
  'timestamp',
  'signature',
  'requestId',
]);

const getFirstQueryValue = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null;
  }
  return typeof value === 'string' ? value : null;
};

const appendQueryParam = (params: URLSearchParams, key: string, value: unknown) => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item !== undefined && item !== null) {
        params.append(key, String(item));
      }
    });
    return;
  }

  if (value !== undefined && value !== null) {
    params.append(key, String(value));
  }
};

const isValidGasUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('https://script.google.com/macros/s/');

const maskUid = (uid: string) =>
  uid.length <= 8 ? `${uid.slice(0, 2)}***` : `${uid.slice(0, 4)}***${uid.slice(-4)}`;

const getGasUrlDebugInfo = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.host,
      pathPrefix: parsedUrl.pathname.slice(0, 24),
    };
  } catch (error) {
    return {
      host: 'invalid-url',
      pathPrefix: '',
    };
  }
};

const stableStringify = (value: any): string => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return JSON.stringify(value.toISOString());
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const stripAuthField = (body: any) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }

  const sanitized: { [key: string]: any } = {};
  Object.keys(body).forEach((key) => {
    if (key !== '_auth') {
      sanitized[key] = body[key];
    }
  });
  return sanitized;
};

const createQuerySignatureBody = (params: URLSearchParams) => {
  const body: { [key: string]: string[] } = {};
  const keys = Array.from(new Set(Array.from(params.keys())));

  keys.forEach((key) => {
    if (AUTH_QUERY_PARAM_KEYS.has(key)) {
      return;
    }

    body[key] = params.getAll(key);
  });

  return body;
};

const createRequestSignature = (
  secret: string,
  timestamp: string,
  uid: string,
  action: string,
  target: string,
  body: any
) => {
  const payload = [timestamp, uid, action || '', target || '', stableStringify(body || {})].join(
    '.'
  );
  return createHmac('sha256', secret)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const ALLOWED_GAS_REDIRECT_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);

const copyHeadersWithoutContentType = (headers: any): Record<string, any> => {
  const copiedHeaders: Record<string, any> = {};
  const copyHeader = (value: any, key: any) => {
    if (
      typeof key === 'string' &&
      key.toLowerCase() !== 'content-type' &&
      key.toLowerCase() !== 'content-length'
    ) {
      copiedHeaders[key] = value;
    }
  };

  if (!headers) {
    return copiedHeaders;
  }
  if (Array.isArray(headers)) {
    // entries() / fetch Headers iterable: each entry is [name, value]
    headers.forEach(([headerName, headerValue]: [any, any]) => copyHeader(headerValue, headerName));
    return copiedHeaders;
  }
  if (typeof headers.forEach === 'function') {
    // standard Headers.prototype.forEach callback signature: (value, name, parent)
    headers.forEach((headerValue: any, headerName: any) => copyHeader(headerValue, headerName));
    return copiedHeaders;
  }
  if (typeof headers === 'object') {
    Object.entries(headers).forEach(([key, value]) => copyHeader(value, key));
  }

  return copiedHeaders;
};

const fetchWithManualRedirectPreservingRequest = async (
  url: string,
  options: any,
  maxRedirects = 3
): Promise<Awaited<ReturnType<typeof fetch>>> => {
  let currentUrl = url;
  let currentOptions = { ...options };
  let response: Awaited<ReturnType<typeof fetch>>;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    response = await fetch(currentUrl, {
      ...currentOptions,
      redirect: 'manual',
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const redirectUrl = response.headers.get('location');
    if (!redirectUrl) {
      return response;
    }

    const nextUrl = new URL(redirectUrl, currentUrl);
    if (!ALLOWED_GAS_REDIRECT_HOSTS.has(nextUrl.hostname)) {
      throw new Error(`Blocked unexpected GAS redirect host: ${nextUrl.hostname}`);
    }
    currentUrl = nextUrl.toString();

    if ([301, 302, 303].includes(response.status)) {
      currentOptions = {
        ...currentOptions,
        method: 'GET',
        headers: copyHeadersWithoutContentType(currentOptions.headers),
      };
      delete currentOptions.body;
    }
  }

  throw new Error('GAS Web App redirect limit exceeded.');
};

const createProxyAuthPayload = (
  secret: string,
  uid: string,
  action: string,
  target: string,
  body: any
): ProxyAuthPayload => {
  const timestamp = String(Date.now());
  const requestId = randomUUID();
  return {
    uid,
    timestamp,
    requestId,
    signature: createRequestSignature(secret, timestamp, uid, action, target, body),
  };
};

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') {
    throw new Error('Authorization header is missing.');
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new Error('Authorization header must be a Bearer token.');
  }

  return match[1];
};

const loadGasProxySettings = async (uid: string): Promise<Required<GasProxySettings>> => {
  const secretRef = admin.firestore().collection('gasProxySecrets').doc(uid);
  const [settingsSnapshot, secretSnapshot] = await Promise.all([
    admin.database().ref(`user-data/${uid}/settings`).get(),
    secretRef.get(),
  ]);
  const settings = (settingsSnapshot.exists() ? settingsSnapshot.val() : {}) as GasProxySettings;
  const secretData = secretSnapshot.exists ? (secretSnapshot.data() as GasProxySettings) : {};
  const gasProxySecret = secretData.gasProxySecret || settings.gasProxySecret;

  if (!isValidGasUrl(settings.googleSheetUrl)) {
    throw new Error('Google Sheet GAS URL is not configured for this user.');
  }

  if (!gasProxySecret) {
    throw new Error(
      'GAS連携の初期設定が完了していません。Spreadsheetの「虎威連携」メニューで本人確認コードを生成し、虎威のプロフィール画面でGAS WebアプリURLと本人確認コードを保存してください。'
    );
  }

  if (!secretData.gasProxySecret && settings.gasProxySecret) {
    await secretRef.set({
      gasProxySecret: settings.gasProxySecret,
      googleSheetUrl: settings.googleSheetUrl,
      migratedFromRealtimeDatabase: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    googleSheetUrl: settings.googleSheetUrl,
    gasProxySecret,
  };
};

const assertCanUseGasProxy = async (uid: string, hasAdminClaim = false) => {
  const userSnap = await admin.firestore().collection('users').doc(uid).get();
  const userData = userSnap.data() || {};
  const subscriptionStatus =
    typeof userData.subscriptionStatus === 'string' ? userData.subscriptionStatus : null;
  const appPlanId = typeof userData.appPlanId === 'string' ? userData.appPlanId : null;
  if (
    hasAdminClaim ||
    userData.isAdmin === true ||
    subscriptionStatus === 'active' ||
    subscriptionStatus === 'trialing' ||
    subscriptionStatus === 'past_due' ||
    appPlanId === 'lifetime'
  ) {
    return { isAdmin: hasAdminClaim || userData.isAdmin === true };
  }

  throw new Error('GASプロキシを利用するには有効な契約が必要です。');
};

export const initializeGasProxyAuth = onCall({ region: 'asia-northeast1' }, async (request) => {
  if (!request.auth?.uid) {
    logger.warn('initializeGasProxyAuth rejected: unauthenticated request.');
    throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
  }

  const { googleSheetUrl: rawGoogleSheetUrl, setupCode } = (request.data ||
    {}) as InitializeGasProxyAuthData;
  const googleSheetUrl = typeof rawGoogleSheetUrl === 'string' ? rawGoogleSheetUrl.trim() : '';
  const normalizedSetupCode = typeof setupCode === 'string' ? setupCode.trim().toUpperCase() : '';
  const uid = request.auth.uid;
  logger.info('initializeGasProxyAuth called.', {
    uid: maskUid(uid),
    hasGoogleSheetUrl: Boolean(googleSheetUrl),
    hasSetupCode: Boolean(normalizedSetupCode),
    gasUrl: typeof googleSheetUrl === 'string' ? getGasUrlDebugInfo(googleSheetUrl) : null,
  });

  if (!isValidGasUrl(googleSheetUrl)) {
    logger.warn('initializeGasProxyAuth rejected: invalid GAS URL.', {
      uid: maskUid(uid),
      gasUrlType: typeof googleSheetUrl,
    });
    throw new HttpsError('invalid-argument', 'GAS WebアプリURLが正しくありません。');
  }
  if (!normalizedSetupCode) {
    logger.warn('initializeGasProxyAuth rejected: missing setup code.', {
      uid: maskUid(uid),
    });
    throw new HttpsError('invalid-argument', '本人確認コードは必須です。');
  }
  if (!SETUP_CODE_PATTERN.test(normalizedSetupCode)) {
    logger.warn('initializeGasProxyAuth rejected: invalid setup code format.', {
      uid: maskUid(uid),
      setupCodeLength: normalizedSetupCode.length,
    });
    throw new HttpsError(
      'invalid-argument',
      '本人確認コードの形式が正しくありません。Spreadsheetの「虎威連携」メニューで生成されたコードを入力してください。'
    );
  }
  logger.info('initializeGasProxyAuth setup code format accepted.', {
    uid: maskUid(uid),
    setupCodeLength: normalizedSetupCode.length,
  });

  const initializeUrl = new URL(googleSheetUrl);
  initializeUrl.searchParams.set('action', 'initialize');
  initializeUrl.searchParams.set('target', 'security');
  logger.info('Calling GAS security initialize endpoint.', {
    uid: maskUid(uid),
    gasUrl: getGasUrlDebugInfo(googleSheetUrl),
  });

  let gasResponse: Awaited<ReturnType<typeof fetch>>;
  try {
    const initializeBody = JSON.stringify({
      uid,
      setupCode: normalizedSetupCode,
    });
    gasResponse = await fetchWithManualRedirectPreservingRequest(initializeUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: initializeBody,
      timeout: 15000,
    });
  } catch (fetchError: any) {
    logger.error('Failed to connect to GAS Web App.', {
      uid: maskUid(uid),
      gasUrl: getGasUrlDebugInfo(googleSheetUrl),
      message: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error.',
    });
    throw new HttpsError(
      'unavailable',
      'GAS Webアプリへの通信に失敗しました。URLが正しいか、GASが公開されているか確認してください。',
      fetchError instanceof Error ? fetchError.message : undefined
    );
  }

  const responseText = await gasResponse.text();
  if (!gasResponse.ok) {
    logger.error('GAS initialization request failed with non-OK status.', {
      uid: maskUid(uid),
      status: gasResponse.status,
      responsePreview: responseText.substring(0, 500),
    });
    throw new HttpsError(
      'failed-precondition',
      `GAS Webアプリからエラーが返されました（ステータスコード: ${gasResponse.status}）。URLやデプロイ設定を確認してください。`
    );
  }

  let responseData: any;
  try {
    responseData = JSON.parse(responseText);
  } catch (error) {
    logger.error('Failed to parse GAS initialize response as JSON.', {
      uid: maskUid(uid),
      status: gasResponse.status,
      responsePreview: responseText.substring(0, 500),
    });
    throw new HttpsError('internal', 'GASからの初期化レスポンスを解析できませんでした。');
  }

  if (!responseData || typeof responseData !== 'object') {
    logger.error('Invalid GAS initialize response structure.', {
      uid: maskUid(uid),
      status: gasResponse.status,
      responseData,
    });
    throw new HttpsError('internal', 'GASからの初期化レスポンスが不正な形式です。');
  }

  logger.info('Received GAS initialize response.', {
    uid: maskUid(uid),
    httpStatus: gasResponse.status,
    gasStatus: responseData.status || '',
    gasCode: responseData.code || '',
    hasProxySecret: Boolean(responseData.data?.proxySecret),
    hasInitializedAt: Boolean(responseData.data?.initializedAt),
    gasMessage: responseData.message || '',
  });

  if (!gasResponse.ok || responseData.status !== 'success' || !responseData.data?.proxySecret) {
    logger.warn('initializeGasProxyAuth rejected: GAS initialize failed.', {
      uid: maskUid(uid),
      httpStatus: gasResponse.status,
      gasStatus: responseData.status || '',
      gasCode: responseData.code || '',
      hasProxySecret: Boolean(responseData.data?.proxySecret),
      gasMessage: responseData.message || '',
    });
    throw new HttpsError(
      'failed-precondition',
      responseData.message || 'GAS連携の初期化に失敗しました。',
      {
        gasStatus: responseData.status || '',
        gasCode: responseData.code || '',
        hasProxySecret: Boolean(responseData.data?.proxySecret),
      }
    );
  }

  // GAS returns ownerUid for display/debug purposes only, and the value is
  // masked before it leaves Apps Script. Do not compare it with the raw
  // Firebase UID here; GAS has already initialized the proxy secret using the
  // UID sent by this callable.

  logger.info('Saving GAS proxy initialization data.', {
    uid: maskUid(uid),
    rtdbPath: `user-data/${uid}/settings`,
    firestorePath: `gasProxySecrets/${uid}`,
  });

  try {
    await Promise.all([
      admin
        .database()
        .ref(`user-data/${uid}/settings`)
        .update({
          googleSheetUrl,
          gasProxyInitializedAt: responseData.data.initializedAt || new Date().toISOString(),
        }),
      admin
        .firestore()
        .collection('gasProxySecrets')
        .doc(uid)
        .set({
          gasProxySecret: responseData.data.proxySecret,
          googleSheetUrl,
          initializedAt: responseData.data.initializedAt || new Date().toISOString(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
    ]);
  } catch (error: any) {
    logger.error('Failed to save GAS proxy initialization data.', {
      uid: maskUid(uid),
      message: error instanceof Error ? error.message : 'Unknown save error.',
    });
    throw new HttpsError('internal', 'GAS連携情報の保存に失敗しました。');
  }

  logger.info('GAS proxy initialization data saved.', {
    uid: maskUid(uid),
    rtdbSettingsUpdated: true,
    firestoreSecretStored: true,
    initializedAt: responseData.data.initializedAt || '',
  });

  return {
    success: true,
    googleSheetUrl,
    initializedAt: responseData.data.initializedAt || '',
    ownerUid: responseData.data.ownerUid || '',
  };
});

export const clearGasProxyAuth = onCall<unknown, Promise<ClearGasProxyAuthResponse>>(
  { region: 'asia-northeast1' },
  async (request) => {
    if (!request.auth?.uid) {
      logger.warn('clearGasProxyAuth rejected: unauthenticated request.');
      throw new HttpsError('unauthenticated', 'この操作を行うには認証が必要です。');
    }

    const uid = request.auth.uid;
    logger.info('Clearing GAS proxy authentication data.', { uid: maskUid(uid) });

    try {
      await Promise.all([
        admin.database().ref(`user-data/${uid}/settings`).update({
          googleSheetUrl: '',
          gasProxyInitializedAt: '',
        }),
        admin.firestore().collection('gasProxySecrets').doc(uid).delete(),
      ]);
    } catch (error) {
      logger.error('Failed to clear GAS proxy authentication data.', {
        uid: maskUid(uid),
        message: error instanceof Error ? error.message : 'Unknown clear error.',
      });
      throw new HttpsError('internal', 'GAS連携情報の解除に失敗しました。');
    }

    logger.info('GAS proxy authentication data cleared.', { uid: maskUid(uid) });
    return {
      success: true,
      googleSheetUrl: '',
      initializedAt: '',
    };
  }
);

// proxyToGas 関数の実装...
export const proxyToGas = onRequest(
  { region: 'asia-northeast1', memory: '1GiB' },
  (request, response) => {
    corsHandler(request, response, async (err?: any) => {
      if (err) {
        logger.error('CORS handler error:', err.message);
        return;
      }
      // // OPTIONS (プリフライト) リクエストの処理
      // // corsHandlerが適用された後なので、method が OPTIONS ならここで終了してOK
      // if (request.method === 'OPTIONS') {
      //   response.status(204).send(''); // No Content
      //   return;
      // }

      // POST メソッド以外の拒否
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST, OPTIONS');
        response.status(405).send('Method Not Allowed');
        return;
      }

      logger.info('Processing POST request:');

      let uid: string;
      let requesterToken: admin.auth.DecodedIdToken | null = null;
      try {
        const idToken = getBearerToken(request.headers.authorization);
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        requesterToken = decodedToken;
        uid = decodedToken.uid;
      } catch (authError: any) {
        logger.warn('Unauthorized GAS proxy request.', {
          message: authError instanceof Error ? authError.message : 'Unknown authorization error.',
        });
        response.status(401).json({
          status: 'error',
          message: 'Unauthorized GAS proxy request.',
        });
        return;
      }

      const requestUrl = new URL(request.url || '/', 'http://localhost');
      const action =
        requestUrl.searchParams.get('action') ||
        getFirstQueryValue(request.query?.action) ||
        (typeof request.body?.action === 'string' ? request.body.action : null);
      const target =
        requestUrl.searchParams.get('target') ||
        getFirstQueryValue(request.query?.target) ||
        (typeof request.body?.target === 'string' ? request.body.target : null);
      if (!action || !target) {
        response.status(400).json({
          status: 'error',
          message: 'Both action and target query parameters are required.',
        });
        return;
      }

      let isAdmin = requesterToken?.isAdmin === true;
      try {
        const access = await assertCanUseGasProxy(uid, isAdmin);
        isAdmin = isAdmin || access.isAdmin;
      } catch (subscriptionError) {
        logger.warn('GAS proxy request rejected because subscription is not active.', {
          uid: maskUid(uid),
          message:
            subscriptionError instanceof Error
              ? subscriptionError.message
              : 'Subscription validation failed.',
        });
        response.status(403).json({
          status: 'error',
          message:
            subscriptionError instanceof Error
              ? subscriptionError.message
              : 'GASプロキシを利用するには有効な契約が必要です。',
        });
        return;
      }

      const isXMarketingSampleAction =
        target === 'xMarketing' && (action === 'importSampleData' || action === 'deleteSampleData');
      if (isXMarketingSampleAction && !isAdmin) {
        logger.warn('Non-admin X marketing sample request rejected.', {
          uid: maskUid(uid),
          action,
        });
        response.status(403).json({
          status: 'error',
          message: 'この操作は管理者のみ実行できます。',
        });
        return;
      }

      let gasSettings: Required<GasProxySettings>;
      try {
        gasSettings = await loadGasProxySettings(uid);
      } catch (configError: any) {
        logger.warn('GAS proxy configuration error.', {
          uid: maskUid(uid),
          message:
            configError instanceof Error ? configError.message : 'Unknown configuration error.',
        });
        response.status(412).json({
          status: 'error',
          message:
            configError instanceof Error ? configError.message : 'GAS proxy configuration error.',
        });
        return;
      }

      // クエリパラメータ処理
      let finalTargetUrl = gasSettings.googleSheetUrl;
      let gasMethod = 'POST';
      try {
        const fallbackSearchParams = new URLSearchParams();
        Object.entries(request.query || {}).forEach(([key, value]) => {
          appendQueryParam(fallbackSearchParams, key, value);
        });

        const outboundSearchParams = requestUrl.search
          ? new URLSearchParams(requestUrl.search)
          : fallbackSearchParams;
        if (!outboundSearchParams.has('action')) {
          outboundSearchParams.set('action', action);
        }
        if (!outboundSearchParams.has('target')) {
          outboundSearchParams.set('target', target);
        }

        if (action === 'fetch') {
          gasMethod = 'GET';
        }

        const bodyForSignature =
          gasMethod === 'POST'
            ? stripAuthField(request.body)
            : createQuerySignatureBody(outboundSearchParams);
        const proxyAuth = createProxyAuthPayload(
          gasSettings.gasProxySecret,
          uid,
          action,
          target,
          bodyForSignature
        );

        if (gasMethod === 'GET') {
          outboundSearchParams.set('uid', proxyAuth.uid);
          outboundSearchParams.set('timestamp', proxyAuth.timestamp);
          outboundSearchParams.set('signature', proxyAuth.signature);
          outboundSearchParams.set('requestId', proxyAuth.requestId);
        } else if (
          request.body &&
          typeof request.body === 'object' &&
          !Array.isArray(request.body)
        ) {
          request.body = {
            ...stripAuthField(request.body),
            _auth: proxyAuth,
          };
        } else {
          request.body = {
            _auth: proxyAuth,
          };
        }

        if (outboundSearchParams.toString()) {
          const targetUrl = new URL(gasSettings.googleSheetUrl);
          outboundSearchParams.forEach((value, key) => {
            targetUrl.searchParams.append(key, value);
          });
          finalTargetUrl = targetUrl.toString();
          logger.info('Query parameters detected. Forwarding GAS request.');
        } else {
          logger.info('No query parameters detected. Forwarding GAS request.');
        }
      } catch (urlError) {
        logger.error('Error parsing request URL or query string:', urlError, {
          requestUrl: request.url,
        });
        response.status(400).json({ status: 'error', message: 'Invalid request URL format.' });
        return;
      }

      try {
        // GAS への転送処理
        logger.info(`Proxying ${gasMethod} request to configured GAS URL.`);
        const gasRequestOptions: any = {
          method: gasMethod,
          headers: {
            ...(gasMethod !== 'GET'
              ? { 'Content-Type': request.get('Content-Type') || 'application/json' }
              : {}),
            // 他に必要なヘッダーがあればここに追加 (例: Authorization)
          },
          timeout: 30000,
          // redirect: 'follow', // GAS がリダイレクトする場合に必要
        };
        if (gasMethod !== 'GET') {
          gasRequestOptions.body = JSON.stringify(request.body);
        }
        const gasResponse = await fetchWithManualRedirectPreservingRequest(
          finalTargetUrl,
          gasRequestOptions
        );

        logger.info(`Received response from GAS. Status: ${gasResponse.status}`);

        const responseText = await gasResponse.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          logger.error('Failed to parse GAS response as JSON from configured GAS URL.', {
            status: gasResponse.status,
            responsePreview: responseText.substring(0, 500), // ログ出力を増やす
          });
          // GAS からのレスポンスが JSON でない場合のエラーハンドリング改善
          response
            .status(502) // Bad Gateway
            .json({
              status: 'error',
              message: 'Invalid or non-JSON response from target GAS service.',
              gasStatus: gasResponse.status,
              gasResponse: responseText.substring(0, 500), // クライアントにも一部返す (デバッグ用)
            });
          return;
        }

        // GAS のステータスコードをそのままクライアントに返す
        response.status(gasResponse.status).json(responseData);
      } catch (error: any) {
        // エラー型を any または unknown に
        logger.error('Error proxying request to configured GAS URL:', error);
        // エラーオブジェクトからメッセージを取得
        const errorMessage = error instanceof Error ? error.message : 'Unknown proxy error.';
        // スタックトレースもログに出力
        if (error instanceof Error) {
          logger.error('Stack trace:', error.stack);
        }
        response.status(502).json({
          // Bad Gateway
          status: 'error',
          message: `Failed to proxy request: ${errorMessage}`,
        });
      }
    });
  }
);
