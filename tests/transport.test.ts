import { describe, expect, it } from 'vitest';
import { buildRequest, resolveKey } from '@ext/background/transport';
import { mergeSettings } from '@shared/settings';

const PROXY = 'https://sykostracker-proxy.example.workers.dev';

describe('transport routing', () => {
  it('uses the built-in proxy when the user has no key (no Authorization sent)', () => {
    const s = mergeSettings({});
    expect(resolveKey(s, PROXY).source).toBe('proxy');
    const r = buildRequest(s, '/players', { nickname: 'Sykos', game: 'cs2' }, PROXY);
    expect(r.url).toBe(`${PROXY}/data/v4/players?nickname=Sykos&game=cs2`);
    expect(r.headers).not.toHaveProperty('Authorization');
  });
  it("the user's own key goes straight to FACEIT and wins over the proxy", () => {
    const s = mergeSettings({ faceitApiKey: ' my-key ' });
    expect(resolveKey(s, PROXY).source).toBe('user');
    const r = buildRequest(s, '/players/abc', {}, PROXY);
    expect(r.url).toBe('https://open.faceit.com/data/v4/players/abc');
    expect(r.headers.Authorization).toBe('Bearer my-key');
  });
  it('no key and no proxy → clear configuration error', () => {
    expect(() => buildRequest(mergeSettings({}), '/players', {}, '')).toThrow(/API key/);
  });
});
