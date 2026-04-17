import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { translations } from '../translations';

export function useTranslation() {
  const lang = useStore((state) => state.lang);

  const t = useCallback((key: string) => {
    const keys = key.split('.');
    let val: any = translations[lang];
    for (const k of keys) {
      if (!val || typeof val !== 'object') return key;
      val = val[k];
    }
    return typeof val === 'string' ? val : key;
  }, [lang]);

  return { t, lang };
}
