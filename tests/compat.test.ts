import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  delete (globalThis as any).chrome;
});

describe('compat layer after "Extension context invalidated"', () => {
  it('storage helpers fail quietly instead of throwing', async () => {
    const invalid = () => {
      throw new Error('Extension context invalidated.');
    };
    (globalThis as any).chrome = {
      runtime: { id: undefined },
      storage: { local: { get: invalid, set: invalid }, onChanged: { addListener: invalid, removeListener: invalid } },
    };
    const c = await import('@ext/compat/browser');
    expect(c.contextValid()).toBe(false);
    await expect(c.storageGet('k', 42)).resolves.toBe(42);
    await expect(c.storageSet('k', 1)).resolves.toBeUndefined();
    const off = c.onStorageChange('k', () => undefined);
    expect(() => off()).not.toThrow();
    expect(c.isContextInvalidated(new Error('Extension context invalidated.'))).toBe(true);
    expect(c.isContextInvalidated(new Error('other'))).toBe(false);
  });

  it('works normally while the context is valid', async () => {
    const store: Record<string, unknown> = {};
    (globalThis as any).chrome = {
      runtime: { id: 'abc' },
      storage: {
        local: { get: async (k: string) => ({ [k]: store[k] }), set: async (o: Record<string, unknown>) => Object.assign(store, o) },
        onChanged: { addListener: () => undefined, removeListener: () => undefined },
      },
    };
    const c = await import('@ext/compat/browser');
    await c.storageSet('k', 7);
    await expect(c.storageGet('k', 0)).resolves.toBe(7);
  });
});
