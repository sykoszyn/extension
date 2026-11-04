import { describe, expect, it } from 'vitest';
import { handleFromUrl, LINKS } from '@shared/links';

describe('creator links', () => {
  it('derives the X handle', () => {
    expect(handleFromUrl('https://x.com/sykoszyn')).toBe('@sykoszyn');
    expect(handleFromUrl('https://twitter.com/sykoszyn/')).toBe('@sykoszyn');
    expect(handleFromUrl('https://ko-fi.com/x')).toBe('X / Twitter');
  });
  it('defaults to hidden when not compiled in', () => {
    expect(LINKS).toEqual({ twitter: '', donate: '' });
  });
});
