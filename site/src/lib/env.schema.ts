import { z } from 'zod';

/**
 * Build-time public configuration. Validated once in astro.config.ts and injected into
 * client and server code as the global constant __PUBLIC_ENV__.
 */
export const publicEnvSchema = z.object({
  SITE_URL: z.url(),
  PUBLIC_USE_EMULATORS: z.enum(['true', 'false']).default('false'),
  PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().default(''),
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().default(''),
  PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  PUBLIC_RECAPTCHA_SITE_KEY: z.string().default(''),
  PUBLIC_APPCHECK_DEBUG_TOKEN: z.string().default(''),
  PUBLIC_FUNCTIONS_REGION: z.string().default('asia-south1'),
  PUBLIC_ANALYTICS_PROVIDER: z.enum(['none', 'goatcounter', 'plausible']).default('none'),
  PUBLIC_ANALYTICS_SRC: z.string().default(''),
  PUBLIC_ANALYTICS_ENDPOINT: z.string().default(''),
  PUBLIC_META_PIXEL_ID: z.string().default(''),
});

export type RawPublicEnv = z.infer<typeof publicEnvSchema>;

export interface PublicEnv {
  siteUrl: string;
  origin: string;
  base: string;
  useEmulators: boolean;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  recaptchaSiteKey: string;
  appCheckDebugToken: string;
  functionsRegion: string;
  analytics: { provider: 'none' | 'goatcounter' | 'plausible'; src: string; endpoint: string };
  metaPixelId: string;
}

export function loadPublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const r = publicEnvSchema.safeParse(source);
  if (!r.success) {
    const missing = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Missing or invalid public build configuration: ${missing}. See .env.example and MANUAL_SETUP.md (GitHub variables).`,
    );
  }
  const e = r.data;
  const url = new URL(e.SITE_URL);
  const base = url.pathname.replace(/\/+$/, '');
  return {
    siteUrl: url.origin + base,
    origin: url.origin,
    base,
    useEmulators: e.PUBLIC_USE_EMULATORS === 'true',
    firebase: {
      apiKey: e.PUBLIC_FIREBASE_API_KEY,
      authDomain: e.PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: e.PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: e.PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: e.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: e.PUBLIC_FIREBASE_APP_ID,
    },
    recaptchaSiteKey: e.PUBLIC_RECAPTCHA_SITE_KEY,
    appCheckDebugToken: e.PUBLIC_APPCHECK_DEBUG_TOKEN,
    functionsRegion: e.PUBLIC_FUNCTIONS_REGION,
    analytics: { provider: e.PUBLIC_ANALYTICS_PROVIDER, src: e.PUBLIC_ANALYTICS_SRC, endpoint: e.PUBLIC_ANALYTICS_ENDPOINT },
    metaPixelId: e.PUBLIC_META_PIXEL_ID,
  };
}
