import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('../functions/src/shared', import.meta.url)) } },
  define: { __USE_EMULATORS__: 'true' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
