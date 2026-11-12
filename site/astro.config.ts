import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { cspConfig } from './src/lib/csp';
import { loadPublicEnv } from './src/lib/env.schema';

const env = loadPublicEnv(process.env);

export default defineConfig({
  site: env.origin,
  base: env.base || '/',
  trailingSlash: 'always',
  output: 'static',
  outDir: process.env.ASTRO_OUT_DIR || './dist',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: [preact(), mdx()],
  security: { csp: cspConfig(env) },
  vite: {
    plugins: [tailwindcss()],
    define: { __PUBLIC_ENV__: JSON.stringify(env), __USE_EMULATORS__: JSON.stringify(env.useEmulators) },
    resolve: {
      alias: { '@shared': fileURLToPath(new URL('../functions/src/shared', import.meta.url)) },
    },
    build: { assetsInlineLimit: 0 },
  },
});
