import axios, { AxiosRequestConfig } from 'axios';
import { auth } from '@/firebase';

export const GAS_PROXY_ENDPOINT = import.meta.env.VITE_PROXY_URL || '/api/gas-proxy';

/**
 * GAS / Google サービス（スプレッドシート・ドライブ・トリガー等）への
 * アクセス権限が不足している場合に、ユーザーへ提示する共通メッセージ。
 */
export const GAS_PERMISSION_ERROR_MESSAGE =
  'シートやGoogleドライブへのアクセス権限がありません。スプレッドシートの「虎威連携」メニューから権限の設定（再承認）をやり直してください。';

/**
 * GAS から返るエラーメッセージが「権限関連」かどうかを判定する。
 * 日本語／英語双方の Apps Script 認可エラー文言とスコープ URL に対応。
 */
export const isGasPermissionError = (message: unknown): boolean => {
  if (typeof message !== 'string' || message === '') {
    return false;
  }
  const text = message.toLowerCase();
  return (
    (message.includes('権限') && (message.includes('ありません') || message.includes('必要'))) ||
    text.includes('permission') ||
    text.includes('authorization is required') ||
    text.includes('authorization-is') ||
    text.includes('permission_denied') ||
    text.includes('www.googleapis.com/auth/')
  );
};

/**
 * GAS レスポンス（多重にラップされている場合を含む）から、
 * status === 'error' のノードの message / error のみを抽出する。
 * 投稿本文などのユーザーデータは走査しないため誤検知しない。
 */
const traverseGasErrors = (data: unknown): { hasError: boolean; messages: string[] } => {
  let hasError = false;
  const messages: string[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.status === 'error') {
      hasError = true;
      if (typeof node.message === 'string' && node.message) {
        messages.push(node.message);
      }
      if (typeof node.error === 'string' && node.error) {
        messages.push(node.error);
      }
    }
    if (node.data && typeof node.data === 'object') {
      visit(node.data);
    }
  };

  visit(data);
  return { hasError, messages };
};

export const getGasResponseErrorMessage = (
  data: unknown,
  fallbackMessage: string
): string | null => {
  const { hasError, messages } = traverseGasErrors(data);
  if (!hasError) {
    return null;
  }

  return messages[0] ?? fallbackMessage;
};

const collectGasErrorMessages = (data: unknown): string[] => {
  return traverseGasErrors(data).messages;
};

type GasProxyParams = {
  action: string;
  target: string;
  [key: string]: string | number | boolean | undefined;
};

export const gasProxyPost = async <TBody = unknown>(
  body: TBody,
  params: GasProxyParams,
  config: AxiosRequestConfig = {}
) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('ユーザー認証が必要です。');
  }

  const response = await axios.post(GAS_PROXY_ENDPOINT, body, {
    ...config,
    headers: {
      ...config.headers,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    params: {
      ...config.params,
      ...params,
    },
  });

  // GAS は権限エラーでも HTTP 200 + { status:'error' } を返すため、
  // レスポンス本文を走査し、権限関連エラーならわかりやすいメッセージで throw する。
  // 各 thunk の catch が error.message を rejectWithValue へ渡すことで、
  // すべての GAS 経由処理（シート・ドライブ・トリガー等）で統一表示される。
  const permissionError = collectGasErrorMessages(response.data).find(isGasPermissionError);
  if (permissionError) {
    const friendlyError = new Error(GAS_PERMISSION_ERROR_MESSAGE);
    (friendlyError as Error & { isGasPermissionError?: boolean }).isGasPermissionError = true;
    (friendlyError as Error & { gasOriginalMessage?: string }).gasOriginalMessage = permissionError;
    throw friendlyError;
  }

  return response;
};
