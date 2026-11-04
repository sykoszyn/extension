import { describe, expect, it } from 'vitest';
import { mergeSettings } from '@shared/settings';

describe('settings', () => {
  it('defaults keep Auto Accept off and need no account or server', () => {
    const s = mergeSettings(undefined);
    expect(s.autoAccept.enabled).toBe(false);
    expect(s.autoAccept.acknowledged).toBe(false);
    expect(s.faceitApiKey).toBe('');
  });
  it('drops obsolete backend settings from older versions', () => {
    const s = mergeSettings({ backendUrl: 'https://x.supabase.co', apiMode: 'backend', faceitApiKey: 'k' } as any);
    expect(s).not.toHaveProperty('backendUrl');
    expect(s).not.toHaveProperty('apiMode');
    expect(s.faceitApiKey).toBe('k');
  });
});
