import { useEffect } from 'react';
import { useAppSelector } from '@/hooks/rtkhooks';
import { normalizeAppLanguage, setAppLanguage } from '.';

export default function LanguageSynchronizer() {
  const { loading, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (loading || user.uid === null) {
      return;
    }
    // Users created before language support intentionally default to Japanese.
    const savedLanguage = normalizeAppLanguage(user.preferredLanguage) || 'ja';
    void setAppLanguage(savedLanguage);
  }, [loading, user.preferredLanguage, user.uid]);

  return null;
}
