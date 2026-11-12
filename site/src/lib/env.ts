import type { PublicEnv } from './env.schema';

export type { PublicEnv };

declare global {
  const __PUBLIC_ENV__: PublicEnv;
  /** Compile-time constant so emulator-only code is removed from production bundles. */
  const __USE_EMULATORS__: boolean;
}

/** Validated public build configuration, injected by astro.config.ts. */
export const env: PublicEnv = __PUBLIC_ENV__;
