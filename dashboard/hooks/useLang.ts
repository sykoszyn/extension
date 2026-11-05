import { useMemo } from 'react';
import { setLang, type Lang, type LangSetting } from '@shared/i18n';

/**
 * Applies the language setting before children render and returns the
 * resolved language. Roots use it as a React `key`, so switching language
 * re-renders the whole tree with the new strings.
 */
export function useLang(setting: LangSetting | undefined): Lang {
  return useMemo(() => setLang(setting ?? 'auto'), [setting]);
}
