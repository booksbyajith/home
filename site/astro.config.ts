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
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: [preact(), mdx()],
  security: { csp: cspConfig(env) },
  vite: {
    plugins: [tailwindcss()],
    define: { __PUBLIC_ENV__: JSON.stringify(env) },
    resolve: {
      alias: { '@shared': fileURLToPath(new URL('../functions/src/shared', import.meta.url)) },
    },
    build: { assetsInlineLimit: 0 },
  },
});
