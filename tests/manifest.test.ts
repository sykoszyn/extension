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
      // Only the official FACEIT API — no developer backend.
      expect(m.host_permissions).toEqual(['https://open.faceit.com/*']);
    }
  });
});
