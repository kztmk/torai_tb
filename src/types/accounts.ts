/**
 * Bluesky / Threads の PlatformAccount 型（Phase 9）。
 * GAS の blueskyAuth / threadsAuth が返すマスク済み表示用データに対応する。
 * 機密（appPassword / appSecret）はサーバ側でマスクされて届く。
 */

export type Platform = 'bluesky' | 'threads';

/** GAS maskAccount（Bluesky）に対応する表示用アカウント */
export interface BlueskyAccountView {
  accountId: string;
  platform: 'bluesky';
  displayName: string;
  handle: string;
  /** マスク済み（例: `ab****yz`） */
  appPassword: string;
  did: string;
  /** ログイン済みセッション（accessJwt）を保持しているか */
  hasSession: boolean;
}

/** GAS maskThreadsAccount に対応する表示用アカウント */
export interface ThreadsAccountView {
  accountId: string;
  platform: 'threads';
  displayName: string;
  appId: string;
  /** マスク済み */
  appSecret: string;
  userId: string;
  /** 認可済みトークンから取得した @ユーザー名（取り違え確認用 / 未取得時は空） */
  username: string;
  /** OAuth 認可済み（accessToken 保持）か */
  authorized: boolean;
  /** トークン保存日時（ISO 文字列 / 未認可時は空） */
  tokenSavedAt: string;
}

export type PlatformAccountView = BlueskyAccountView | ThreadsAccountView;

// ---- 作成・更新の入力 ----

export interface BlueskyCreateInput {
  accountId: string;
  handle: string;
  appPassword: string;
  displayName?: string;
}

export interface BlueskyUpdateInput {
  accountId: string;
  handle?: string;
  appPassword?: string;
  displayName?: string;
}

export interface ThreadsCreateInput {
  accountId: string;
  appId: string;
  appSecret: string;
  displayName?: string;
}

export interface ThreadsUpdateInput {
  accountId: string;
  appId?: string;
  appSecret?: string;
  displayName?: string;
}

/** threadsAuth authorizeUrl の戻り値 */
export interface ThreadsAuthorizeUrlResult {
  accountId: string;
  authorizeUrl: string;
  /** Meta アプリの「有効な OAuth リダイレクト URI」に登録する値 */
  redirectUri: string;
  expiresInSeconds: number;
}
