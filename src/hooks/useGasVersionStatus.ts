import { useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/rtkhooks';
import { fetchLatestGasVersion, isGasOutdated, normalizeVersion } from '@/utils/gasVersion';

export interface GasVersionStatus {
  /** デプロイ済み GAS バックエンドのバージョン（未取得なら空文字）。 */
  current: string;
  /** GitHub Release の最新バージョン（未取得・取得失敗なら null）。 */
  latest: string | null;
  /** デプロイ済みが最新より古い場合に true。 */
  outdated: boolean;
  /** GitHub からの最新版取得中か。 */
  loading: boolean;
}

/**
 * デプロイ済み GAS バージョン（store）と GitHub Release の最新版を突き合わせ、
 * 更新が必要かどうかを返す。最新版取得はマウント時に 1 回だけ行う。
 */
export const useGasVersionStatus = (): GasVersionStatus => {
  // appInfo エンドポイントで取得したバージョンを優先し、無ければトリガー状態の version をフォールバックに使う。
  const gasVersion = useAppSelector((state) => state.apiController.gasVersion);
  const triggerVersion = useAppSelector((state) => state.apiController.triggerStatus.version);
  const current = normalizeVersion(gasVersion || triggerVersion);

  const [latest, setLatest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchLatestGasVersion(controller.signal)
      .then((version) => setLatest(version))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return {
    current,
    latest,
    outdated: isGasOutdated(current, latest),
    loading,
  };
};
