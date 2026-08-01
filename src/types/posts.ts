/**
 * 投稿（Post）関連の型。GAS の types.ts（PostInput / PostRow / PostStatus）に対応。
 */
import type { Platform } from './accounts';

export type PostStatus = 'queued' | 'processing' | 'posted' | 'failed';

/** フロント → GAS の Post 作成入力（id・status 等はサーバ採番） */
export interface PostInput {
  platform: Platform;
  accountId: string;
  contents: string;
  mediaUrls?: string[];
  /** ISO 8601 文字列。空文字 = 即時投稿 */
  postSchedule: string;
  crossPostGroupId?: string;
  inReplyTo?: string;
}

/** GAS が返す Posts シートの 1 行 */
export interface PostRow {
  id: string;
  createdAt: string;
  platform: Platform;
  accountId: string;
  contents: string;
  /** 画像 URL の JSON 配列文字列 */
  mediaUrls: string;
  postSchedule: string;
  crossPostGroupId: string;
  inReplyTo: string;
  status: PostStatus;
  postId: string;
  errorMessage: string;
}

/** Posted シートの 1 行（投稿済み＋エンゲージメント） */
export interface PostedRow {
  id: string;
  createdAt: string;
  postedAt: string;
  platform: Platform;
  accountId: string;
  contents: string;
  mediaUrls: string;
  postSchedule: string;
  crossPostGroupId: string;
  inReplyTo: string;
  postId: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  insightsUpdatedAt: string;
}

/** Errors シートの 1 行 */
export interface ErrorRow {
  timestamp: string;
  context: string;
  message: string;
  stack: string;
  detail: string;
}
