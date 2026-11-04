import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export const alias = {
  '@shared': r('./shared'),
  '@ext': r('./extension'),
  '@dash': r('./dashboard'),
};

// Used by vitest. The production build is orchestrated by scripts/build.mjs,
// which runs three separate Vite builds (pages, background, content script).
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
