import { MAP_META } from '../constants';

const BY_LABEL = new Map<string, string>(
  Object.entries(MAP_META).flatMap(([key, m]) => [
    [m.label.toLowerCase(), key],
    [m.label.toLowerCase().replace(/\s+/g, ''), key],
    [key.replace(/^de_/, ''), key],
  ]),
);
BY_LABEL.set('dust2', 'de_dust2');

/** "Mirage" | "de_mirage" | "DE_MIRAGE" → "de_mirage". Unknown maps are kept lowercased. */
export function normalizeMap(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (MAP_META[s]) return s;
  return BY_LABEL.get(s) ?? BY_LABEL.get(s.replace(/\s+/g, '')) ?? s;
}

export function mapLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return MAP_META[key]?.label ?? key.replace(/^(de|cs)_/, '').replace(/^\w/, (c) => c.toUpperCase());
}

export function mapShort(key: string | null | undefined): string {
  if (!key) return '?';
  return MAP_META[key]?.short ?? mapLabel(key).slice(0, 3).toUpperCase();
}

export function mapHue(key: string | null | undefined): number {
  return (key ? MAP_META[key]?.hue : undefined) ?? 20;
}

/** Competitive 5v5 maps (the CS2 pool). Aim/AWP/1v1/2v2 community maps are not. */
export function isCompetitiveMap(key: string | null | undefined): boolean {
  return !!key && key in MAP_META;
}
