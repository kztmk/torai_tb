/**
 * 投稿本文の文字数制限ユーティリティ。
 * - Bluesky: 300 グラフェム
 * - Threads: 500 文字
 * クロスポストで Bluesky を含む場合は、より厳しい 300 グラフェムを適用する。
 */

export const BLUESKY_GRAPHEME_LIMIT = 300;
export const THREADS_CHAR_LIMIT = 500;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** グラフェム単位の文字数を数える（絵文字・結合文字を1として数える）。 */
export const graphemeCount = (text: string): number => {
  if (!text) return 0;
  if (graphemeSegmenter) {
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _segment of graphemeSegmenter.segment(text)) {
      count += 1;
    }
    return count;
  }
  // フォールバック: コードポイント数
  return Array.from(text).length;
};

/**
 * 選択中のプラットフォーム構成に応じた上限を返す。
 * Bluesky を含むなら 300、Threads のみなら 500。
 */
export const limitForPlatforms = (hasBluesky: boolean, hasThreads: boolean): number => {
  if (hasBluesky) return BLUESKY_GRAPHEME_LIMIT;
  if (hasThreads) return THREADS_CHAR_LIMIT;
  return THREADS_CHAR_LIMIT;
};

/** Threads 用の実文字数（コードポイント数。絵文字は 1 として数える）。 */
export const characterCount = (text: string): number => (text ? Array.from(text).length : 0);

/**
 * 選択中プラットフォームの上限を超えているか。
 * Bluesky: グラフェム 300 / Threads: 文字数 500。混在時は両方を満たす必要がある。
 */
export const isSegmentOverLimit = (
  text: string,
  hasBluesky: boolean,
  hasThreads: boolean
): boolean => {
  if (hasBluesky && graphemeCount(text) > BLUESKY_GRAPHEME_LIMIT) return true;
  if (hasThreads && characterCount(text) > THREADS_CHAR_LIMIT) return true;
  return false;
};
