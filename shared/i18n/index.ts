/**
 * Tiny i18n layer (no dependencies).
 *
 *  - `t("some.key", { n: 3 })` returns the string for the current language,
 *    falling back to English, then to the key itself.
 *  - The language is "auto" (browser UI language) or chosen in Settings.
 *  - Number/date formatting uses the matching locale (see `locale()`).
 *
 * Dictionaries live in ./locales/*.ts. English is the source of truth for
 * the set of keys; tests/i18n.test.ts checks every language covers it.
 */
import { en, type Dict } from './locales/en';
import { es } from './locales/es';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { pl } from './locales/pl';
import { tr } from './locales/tr';

export const LANGS = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'es', label: 'Español', locale: 'es-AR' },
  { code: 'pt', label: 'Português (BR)', locale: 'pt-BR' },
  { code: 'ru', label: 'Русский', locale: 'ru-RU' },
  { code: 'uk', label: 'Українська', locale: 'uk-UA' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'pl', label: 'Polski', locale: 'pl-PL' },
  { code: 'tr', label: 'Türkçe', locale: 'tr-TR' },
] as const;

export type Lang = (typeof LANGS)[number]['code'];
export type LangSetting = Lang | 'auto';
export type Key = keyof Dict;

export const DICTS: Record<Lang, Partial<Dict>> = { en, es, pt, ru, uk, de, fr, pl, tr };

/** "es-AR" → "es", "pt-BR" → "pt", unknown → "en". */
export function detectLang(ui?: string | null): Lang {
  const code = (ui ?? '').toLowerCase().split(/[-_]/)[0];
  return (LANGS.find((l) => l.code === code)?.code ?? 'en') as Lang;
}

function browserLang(): string {
  try {
    const g = globalThis as { chrome?: { i18n?: { getUILanguage?: () => string } }; navigator?: { language?: string } };
    return g.chrome?.i18n?.getUILanguage?.() ?? g.navigator?.language ?? 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = detectLang(browserLang());

export function resolveLang(setting: LangSetting | undefined | null): Lang {
  return !setting || setting === 'auto' ? detectLang(browserLang()) : setting;
}

export function setLang(setting: LangSetting | undefined | null): Lang {
  current = resolveLang(setting);
  return current;
}

export function getLang(): Lang {
  return current;
}

/** BCP-47 locale for Intl number/date formatting. */
export function locale(): string {
  return LANGS.find((l) => l.code === current)?.locale ?? 'en-US';
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
