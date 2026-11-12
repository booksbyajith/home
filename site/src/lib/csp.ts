import type { AstroUserConfig } from 'astro';
import type { PublicEnv } from './env.schema';

type CspConfig = Exclude<NonNullable<NonNullable<AstroUserConfig['security']>['csp']>, boolean>;
type CspDirectives = NonNullable<CspConfig['directives']>;

const originOf = (u: string) => {
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
};

/** Content-Security-Policy pieces for Astro's security.csp option. */
export function cspConfig(env: PublicEnv): CspConfig {
  const pixel = !!env.metaPixelId;
  const analyticsScript = '';
  const analyticsConnect =
    env.analytics.provider === 'goatcounter'
      ? originOf(env.analytics.endpoint)
      : env.analytics.provider === 'plausible'
        ? originOf(env.analytics.src)
        : '';
  const fnOrigin = `https://${env.functionsRegion}-${env.firebase.projectId}.cloudfunctions.net`;

  const scriptResources = [
    "'self'",
    'https://www.google.com/recaptcha/',
    'https://www.gstatic.com/recaptcha/',
    'https://apis.google.com',
    analyticsScript,
    pixel ? 'https://connect.facebook.net' : '',
  ].filter(Boolean);

  const connect = [
    "'self'",
    'https://firestore.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://www.googleapis.com',
    'https://firebaseappcheck.googleapis.com',
    'https://content-firebaseappcheck.googleapis.com',
    'https://www.google.com/recaptcha/',
    fnOrigin,
    analyticsConnect,
    pixel ? 'https://www.facebook.com' : '',
    env.useEmulators ? 'http://127.0.0.1:*' : '',
  ].filter(Boolean);

  const directives = [
    "default-src 'self'",
    `img-src 'self' data: blob: https://storage.googleapis.com${pixel ? ' https://www.facebook.com' : ''}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    `frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://${env.firebase.authDomain} https://www.facebook.com`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return {
    algorithm: 'SHA-256',
    directives: directives as CspDirectives,
    scriptDirective: { resources: scriptResources },
    styleDirective: { resources: ["'self'"] },
  };
}
