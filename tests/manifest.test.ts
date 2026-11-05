import { describe, expect, it } from 'vitest';
import { buildManifest, TARGETS } from '@ext/manifest/build-manifest.mjs';

describe('per-browser manifests', () => {
  it('Chromium targets use a service worker', () => {
    for (const t of ['chrome', 'edge', 'brave', 'opera']) {
      const m = buildManifest(t, '1.0.0');
      expect(m.manifest_version).toBe(3);
      expect(m.background).toEqual({ service_worker: 'background.js' });
      expect(m).not.toHaveProperty('browser_specific_settings');
    }
  });
  it('Firefox uses background.scripts + gecko settings', () => {
    const m = buildManifest('firefox', '1.0.0');
    expect(m.background).toEqual({ scripts: ['background.js'] });
    expect(m.browser_specific_settings.gecko.id).toMatch(/@/);
    expect(m).not.toHaveProperty('minimum_chrome_version');
  });
  it('requests only minimal permissions (no cookies, tabs, webRequest)', () => {
    for (const t of TARGETS) {
      const m = buildManifest(t, '1.0.0');
      expect(m.permissions.sort()).toEqual(['alarms', 'notifications', 'storage', 'unlimitedStorage']);
      expect(JSON.stringify(m)).not.toMatch(/cookies|webRequest|"tabs"|<all_urls>/);
      expect(m.content_scripts[0].matches).toEqual(['https://www.faceit.com/*']);
      // Without a proxy configured: only the official FACEIT API.
      expect(m.host_permissions).toEqual(['https://open.faceit.com/*']);
    }
  });
  it('adds exactly the proxy origin when one is configured', () => {
    for (const t of TARGETS) {
      const m = buildManifest(t, '1.0.0', { proxyUrl: 'https://sykostracker-proxy.me.workers.dev' });
      expect(m.host_permissions).toEqual(['https://open.faceit.com/*', 'https://sykostracker-proxy.me.workers.dev/*']);
    }
  });
  it('name/description come from _locales (store localisation)', () => {
    const m = buildManifest('chrome', '1.0.0');
    expect(m.name).toBe('__MSG_extName__');
    expect(m.description).toBe('__MSG_extDesc__');
    expect(m.default_locale).toBe('en');
  });
});
