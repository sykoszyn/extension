/**
 * Generates manifest.json per target browser from one shared definition.
 *
 * Real differences handled here:
 *  - Chromium (Chrome, Edge, Brave, Opera): MV3 `background.service_worker`.
 *  - Firefox: MV3 `background.scripts` (event page; Firefox does not run
 *    extension service workers), `browser_specific_settings.gecko` with a
 *    stable add-on id, a minimum version and the data-collection declaration
 *    required for new AMO submissions.
 *  - `minimum_chrome_version` is meaningful only for Chromium stores.
 *  - Opera and Brave consume the Chrome package unchanged; Edge too. They are
 *    emitted as separate folders so each store gets its own artefact.
 */

export const TARGETS = ['chrome', 'edge', 'brave', 'opera', 'firefox'];

export const FACEIT_API_HOSTS = ['https://open.faceit.com/*'];

/**
 * @param {string} target
 * @param {string} version
 * @param {{ proxyUrl?: string }} [opts] public URL of the SykosTracker Cloudflare proxy, if any
 * @returns {any}
 */
export function buildManifest(target, version, opts = {}) {
  const hosts = [...FACEIT_API_HOSTS, ...(opts.proxyUrl ? [`${new URL(opts.proxyUrl).origin}/*`] : [])];
  if (!TARGETS.includes(target)) throw new Error(`Unknown target ${target}`);
  const icons = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };

  const base = {
    manifest_version: 3,
    name: '__MSG_extName__',
    short_name: 'SykosTracker',
    default_locale: 'en',
    version,
    description: '__MSG_extDesc__',
    icons,
    action: { default_title: 'SykosTracker', default_popup: 'extension/popup/index.html', default_icon: icons },
    options_ui: { page: 'dashboard/index.html#settings', open_in_tab: true },
    permissions: ['storage', 'unlimitedStorage', 'notifications', 'alarms'],
    // External hosts: the official FACEIT Data API and, if configured, the
    // publisher's stateless Cloudflare proxy that holds the API key.
    host_permissions: hosts,
    content_scripts: [
      {
        matches: ['https://www.faceit.com/*'],
        js: ['content.js'],
        run_at: 'document_idle',
        all_frames: false,
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  };

  if (target === 'firefox') {
    return {
      ...base,
      background: { scripts: ['background.js'] },
      browser_specific_settings: {
        gecko: {
          id: 'sykostracker@sykostracker.app',
          strict_min_version: '128.0',
          data_collection_permissions: {
            // Nicknames / player ids / match ids the user looks up are sent to the
            // FACEIT Data API (open.faceit.com) to fetch stats. Nothing else leaves the browser.
            required: ['websiteActivity'],
          },
        },
      },
    };
  }

  return {
    ...base,
    minimum_chrome_version: '116',
    background: { service_worker: 'background.js' },
  };
}
