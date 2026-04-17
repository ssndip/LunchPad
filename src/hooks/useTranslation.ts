import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { translations } from '../translations';

export function useTranslation() {
  const lang = useStore((state) => state.lang);

  const dynamicTranslations = useStore((state) => state.dynamicTranslations);

  const t = useCallback((key: string, replacements?: Record<string, string | number>) => {
    const keys = key.split('.');
    
    // Try dynamic translations first
    let val: any = dynamicTranslations[lang];
    let found = false;
    
    if (val) {
      found = true;
      for (const k of keys) {
        if (!val || typeof val !== 'object') {
          found = false;
          break;
        }
        val = val[k];
      }
    }

    // Fallback to static translations
    if (!found || typeof val !== 'string') {
      val = (translations as any)[lang] || translations['en'];
      for (const k of keys) {
        if (!val || typeof val !== 'object') {
          val = key;
          break;
        }
        val = val[k];
      }
    }

    if (typeof val !== 'string') return key;

    // Handle replacements (e.g. {{count}})
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        val = (val as string).replace(`{{${k}}}`, String(v));
      });
    }

    return val;
  }, [lang, dynamicTranslations]);

  return { t, lang };
}
