import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DICTS, LANGS, detectLang, setLang, t } from '@shared/i18n';
import { en } from '@shared/i18n/locales/en';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === 'locales' ? [] : sourceFiles(p);
    return /\.(tsx?|mjs)$/.test(f) ? [p] : [];
  });
}

describe('i18n', () => {
  it('every language has every key, with the same placeholders', () => {
    for (const { code } of LANGS) {
      const dict = DICTS[code];
      for (const k of Object.keys(en) as (keyof typeof en)[]) {
        expect(dict[k], `${code} is missing "${k}"`).toBeTypeOf('string');
        expect(placeholders(dict[k]!), `${code}.${k} placeholders`).toEqual(placeholders(en[k]));
      }
      expect(Object.keys(dict).filter((k) => !(k in en)), `${code} has unknown keys`).toEqual([]);
    }
  });

  it('every t("…") used in the code exists', () => {
    const files = ['shared', 'dashboard', 'extension'].flatMap((d) => sourceFiles(d));
    const used = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9.]+)'/g)) used.add(m[1]);
    const missing = [...used].filter((k) => !(k in en));
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(150);
  });

  it('detects the browser language and falls back to English', () => {
    expect(detectLang('es-AR')).toBe('es');
    expect(detectLang('pt-BR')).toBe('pt');
    expect(detectLang('ru')).toBe('ru');
    expect(detectLang('uk-UA')).toBe('uk');
    expect(detectLang('ja-JP')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });

  it('translates with variables; Spanish uses "vos"', () => {
    setLang('es');
    expect(t('panel.vsYou')).toBe('VS vos');
    expect(t('met.vs', { n: 3 })).toBe('3× vs');
    setLang('ru');
    expect(t('panel.vsYou')).toBe('VS ты');
    setLang('en');
    expect(t('wl', { w: 2, l: 1 })).toBe('2 W · 1 L');
  });

  it('extension name/description exist for every language (_locales)', () => {
    const folder = { en: 'en', es: 'es', pt: 'pt_BR', ru: 'ru', uk: 'uk', de: 'de', fr: 'fr', pl: 'pl', tr: 'tr' } as const;
    for (const { code } of LANGS) {
      const m = JSON.parse(readFileSync(`extension/_locales/${folder[code]}/messages.json`, 'utf8'));
      expect(m.extName.message).toBe('SykosTracker');
      expect(m.extDesc.message.length).toBeLessThanOrEqual(132);
    }
  });
});
