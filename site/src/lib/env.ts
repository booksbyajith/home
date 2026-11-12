import type { PublicEnv } from './env.schema';

export type { PublicEnv };

declare global {
  const __PUBLIC_ENV__: PublicEnv;
}

/** Validated public build configuration, injected by astro.config.ts. */
export const env: PublicEnv = __PUBLIC_ENV__;
