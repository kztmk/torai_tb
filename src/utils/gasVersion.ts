// GAS バックエンド（kztmk/ts_autopost）のバージョン管理ユーティリティ。
// - GitHub Release の最新タグを取得する
// - デプロイ済み GAS バージョンと比較し、更新が必要かを判定する

// 公開リポジトリの最新 Release を返す GitHub API。
// 未認証でも公開リポジトリなら CORS 許可・レート制限 60req/h（IP 単位）で利用できる。
export const GAS_LATEST_RELEASE_API =
  'https://api.github.com/repos/kztmk/ts_autopost/releases/latest';

// リリースページ（更新手順の案内リンク用）。
export const GAS_RELEASES_PAGE_URL = 'https://github.com/kztmk/ts_autopost/releases';

/** 先頭の "v" や前後の空白を除去して純粋なバージョン文字列にする。 */
export const normalizeVersion = (value: string | null | undefined): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/^v/i, '');
};

/**
 * セマンティックバージョンを比較する。
 *  a < b -> 負, a === b -> 0, a > b -> 正。
 * 数値以外・欠損セグメントは 0 として扱う（例: "1.2" は "1.2.0" 相当）。
 */
export const compareVersions = (a: string, b: string): number => {
  const pa = normalizeVersion(a).split('.');
  const pb = normalizeVersion(b).split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const na = parseInt(pa[i] ?? '0', 10);
    const nb = parseInt(pb[i] ?? '0', 10);
    const va = Number.isNaN(na) ? 0 : na;
    const vb = Number.isNaN(nb) ? 0 : nb;
    if (va !== vb) {
      return va < vb ? -1 : 1;
    }
  }
  return 0;
};

/**
 * デプロイ済みバージョンが最新より古いか判定する。
 * どちらかが空・不明な場合は「古い」とはみなさない（誤って赤表示しない）。
 */
export const isGasOutdated = (
  current: string | null | undefined,
  latest: string | null | undefined
): boolean => {
  const c = normalizeVersion(current);
  const l = normalizeVersion(latest);
  if (!c || !l) {
    return false;
  }
  return compareVersions(c, l) < 0;
};

/**
 * GitHub Release の最新版バージョン（tag_name から "v" を除去）を取得する。
 * 失敗時（ネットワーク・レート制限など）は null を返し、UI は最新判定をスキップする。
 */
export const fetchLatestGasVersion = async (
  signal?: AbortSignal
): Promise<string | null> => {
  try {
    const res = await fetch(GAS_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { tag_name?: string };
    const version = normalizeVersion(data?.tag_name);
    return version || null;
  } catch {
    return null;
  }
};
