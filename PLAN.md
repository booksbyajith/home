# PLAN.md — Author website and direct book-ordering system for Dr. Ajith Amarasinghe

This is the implementation plan. An implementing model follows it phase by phase, top to bottom, and commits at the end of each phase. Nothing in here needs a human: every manual step is deferred to `MANUAL_SETUP.md`, which is written in the last phase.

**Contents**

1. How to use this plan
2. Verified environment facts (read before installing anything)
3. Decisions
4. Repository layout
5. Toolchain and versions
6. Configuration: build-time variables, function parameters, secrets
7. Routes and pages
8. Content model (files in the repo)
9. Data model (Firestore and Storage)
10. Shared domain logic
11. Cloud Functions
12. Security rules and indexes
13. Notifications
14. Client architecture
15. i18n key list
16. Test matrix
17. CI/CD
18. Phases
19. `MANUAL_SETUP.md` outline
20. Risks and pre-authorised fallbacks
21. Definition of Done

---

## 1. How to use this plan

1. Work through the phases in §18 in order. A phase is finished only when every command in its "Must pass" list exits 0 and every acceptance criterion holds. Then commit with the given message.
2. Never stop to ask the human for an account, key, project or decision. If something is unspecified, decide it, add a line to §3 "Decisions" in this file (next free `D-` number), and continue.
3. If a step fails for a reason listed in §20, apply the fallback written there. Those fallbacks are already approved.
4. Rules that override everything else:
   - **No manual steps during the build.** Everything runs against the Firebase Emulator Suite with project ID `demo-ajith` and placeholder config.
   - **No secrets or personal data in the repo.** No real emails, phone numbers, bank details, API keys, tokens or admin lists in any file. `pnpm scan` (§17) must stay green.
   - **No reference to any medical clinic** anywhere in the repo or the built site: no clinic name, address, phone, email, logo or link. The bio may say the author is a medical specialist. `pnpm scan` enforces this with a keyword guard.
   - **Customer data is never publicly readable.** Clients never write to Firestore or Storage. All writes go through callable functions.
5. When this plan gives a version number, use that exact version. They were checked against the npm registry on 2026-11-12 and they are newer than most training data, so do not substitute versions from memory.
6. When an API detail of a library is uncertain, read the installed package's own types and README in `node_modules` before writing code against it.

---

## 2. Verified environment facts

These were checked by running commands in the build sandbox on 2026-11-12. They explain several decisions below.

| Fact | Evidence | Consequence |
|---|---|---|
| The Cloud Functions `nodejs20` runtime was decommissioned on 2026-10-30. `firebase-tools@15.36.0` throws `Runtime Node.js 20 was decommissioned … To deploy you must first upgrade` | `firebase-tools/lib/deploy/functions/runtimes/supported/types.js` and `index.js` (`guardVersionSupport`) | The locked "Node 20" cannot be deployed. See D-01. |
| `nodejs22` and `nodejs24` are both GA in the same file. `nodejs24` is deprecated 2028-04-30 | same file | Functions runtime is `nodejs24`. |
| `@firebase/rules-unit-testing@6.0.0` requires Node ≥ 24.12. `astro@7.4.11` requires Node ≥ 22.23.4. `firebase-admin@14.5.1` requires Node ≥ 22 | `npm view … engines` | Toolchain Node is 24.22.3 everywhere. |
| The sandbox has Node 22.23.4 and pnpm 10.28.0. With `useNodeVersion: 24.22.3` in `pnpm-workspace.yaml`, `pnpm exec node -v` prints `v24.22.3` | ran it | Always run tools through `pnpm run` / `pnpm exec`, never bare `node` or `npx`. |
| pnpm 10 blocks dependency build scripts by default (`re2`, `protobufjs` were ignored) | `pnpm ignored-builds` | Declare `onlyBuiltDependencies` (§5). |
| `typescript@7` is not supported by `@astrojs/check` (peer `^5 \|\| ^6`) or `typescript-eslint@8.72.2` (peer `<6.1.0`) | `npm view … peerDependencies` | Pin `typescript@6.0.3`. |
| `@astrojs/tailwind` only supports Tailwind 3 and Astro ≤ 5 | peer deps | Use Tailwind 4 through `@tailwindcss/vite`. |
| `firebase-functions-test@3.5.0` does not accept `firebase-admin@14` and wants Jest | peer deps | Do not use it. Test callables over HTTP against the emulator (§16). |
| Auth, Firestore and Storage emulators start in the sandbox (Java 21 present, emulator JARs download successfully) | `firebase emulators:exec` smoke run | Emulator workflow is viable. |
| `::1` is not available in the sandbox (`EAFNOSUPPORT`) | emulator warnings | Set `"host": "127.0.0.1"` on every emulator and use `127.0.0.1`, not `localhost`, in all URLs. |
| The Storage emulator prints `Unexpected rules runtime error: Picked up JAVA_TOOL_OPTIONS…`. Rules still evaluate correctly (allowed path 200, denied path 403, with and without the variable) | ran both | Harmless noise. Ignore it. |
| Under the Functions emulator `skipTokenVerification` is on: an `X-Firebase-AppCheck` header is decoded as an unsigned JWT and not verified. A missing header with `enforceAppCheck: true` is still rejected with `unauthenticated` | `firebase-tools/lib/emulator/functionsEmulator.js:1025`, `firebase-functions/lib/common/providers/https.js` | Emulator clients send a locally minted JWT-shaped token (D-14). Enforcement is testable. |
| `sharp@0.35.5` renders Sinhala with correct shaping (conjuncts such as ක්‍රි and ශ්‍රී) from the `.woff`/`.woff2` files in `@fontsource/noto-serif-sinhala` using `sharp({ text: { text, font, fontfile } })` | rendered and inspected a PNG | Build-time Open Graph images use sharp. No headless browser is needed. |
| Astro 7 has stable `security.csp` (since 6.0) that emits a `<meta http-equiv="content-security-policy">` with hashes. It is inactive in `astro dev` | `astro/dist/types/public/config.d.ts` | Use it. Test CSP only against `astro build` + `astro preview`. |
| Playwright 1.63.0 with Chromium build 1243 is preinstalled at `/opt/pw-browsers`. No WebKit or Firefox | `ls /opt/pw-browsers` | Pin `@playwright/test@1.63.0`. E2E is Chromium only, with a mobile and a desktop viewport. |
| `https://github.com/.../releases` returns 403 from the sandbox | curl | The gitleaks binary cannot be downloaded locally. gitleaks runs in CI. A local scanner script covers the same ground during the build (D-22). |

---

## 3. Decisions

Locked decisions from the brief are not repeated here. This list records what the brief left open, plus one forced deviation.

**Forced deviation**

- **D-01 Functions runtime is Node 24, not Node 20.** Node 20 can no longer be deployed (§2). `nodejs24` is the supported runtime that matches the Node version the test toolchain needs, so tested and deployed versions are the same. It is set in two places only: `firebase.json` → `functions[0].runtime` and `functions/package.json` → `engines.node`.

**Toolchain**

- D-02 Node 24.22.3 for all tooling, pinned by `useNodeVersion` in `pnpm-workspace.yaml` and by `.node-version`. pnpm 10.28.0, pinned by `packageManager`.
- D-03 TypeScript 6.0.3. Tailwind 4.3.5 via `@tailwindcss/vite`, configured in CSS with `@theme`. No `tailwind.config.js`.
- D-04 Interactive UI uses Preact 10 (`preact@10.29.8`, `@astrojs/preact@6.1.5`). Small widgets with no state (slideshow, language toggle, share buttons) are plain TypeScript in Astro `<script>` tags.
- D-05 `/functions` is self-contained. It has no `workspace:` dependencies and its `tsconfig.json` extends nothing outside `/functions`, because Firebase uploads only that folder. Code shared with the site lives in `functions/src/shared/` and the site imports it through the alias `@shared/*`.
- D-06 Function dependencies are pinned to exact versions (no `^`). `functions/package.json` has `"gcp-build": ""` so Cloud Build does not rebuild. `lib/` is built by the `predeploy` hook and uploaded.

**Site**

- D-07 Sinhala is served at the root (`/books/`), English under `/en/` (`/en/books/`). Routing uses a rest parameter folder `site/src/pages/[...lang]/`. Astro's `i18n` config is not used. Page bodies live in `site/src/views/` and route files are thin wrappers.
- D-08 The site URL is one value, `SITE_URL` (for example `https://owner.github.io/booksbyajith`). `astro.config.ts` derives `site` from its origin and `base` from its path. In the Pages workflow it defaults to the `base_url` output of `actions/configure-pages`, so no owner name is hard-coded.
- D-09 `trailingSlash: 'always'`, `build.format: 'directory'`. Every internal link goes through `href()` in `site/src/lib/paths.ts`.
- D-10 `sitemap.xml` and `robots.txt` are hand-written Astro endpoints fed by the route registry `site/src/lib/routes.ts`. `@astrojs/sitemap` is not used, because it emits `sitemap-index.xml` rather than `sitemap.xml`.
- D-11 Fonts come from the npm packages `@fontsource/noto-sans-sinhala` and `@fontsource/noto-serif-sinhala` (weights 400/600/700 and 500/700, subsets `sinhala` and `latin`). Vite bundles the files. Nothing loads from a font CDN.
- D-12 Public pages read `books/*` and `config/public` with a plain `fetch` to the Firestore REST API and a 40-line decoder. The Firebase SDK is loaded only where a callable is used (order, track, forms) and on `/admin/`. This keeps Lighthouse scores high.
- D-13 App Check is enforced on callable functions only. It is not enforced on Firestore, which is protected by rules. `MANUAL_SETUP.md` says so explicitly, because enforcing it on Firestore would break D-12.
- D-14 In emulator mode the client registers an App Check `CustomProvider` that returns an unsigned JWT built from `PUBLIC_APPCHECK_DEBUG_TOKEN`. In production it uses `ReCaptchaV3Provider`. The real debug-token flow cannot work offline because it calls Google.
- D-15 App Check and reCAPTCHA are initialised lazily, immediately before the first callable. They never load on page load.
- D-16 Cover images stay in `site/public/covers/` as the brief requires. `scripts/build-images.mjs` generates resized WebP variants into `site/public/covers/_gen/` (git-ignored) before each build.
- D-17 Open Graph images are generated before each build by `scripts/build-og.mjs` using sharp into `site/public/og/` (git-ignored). One 1200×630 JPG per book, post and language, plus a default.
- D-18 The service worker is hand-written (an Astro endpoint, about 40 lines). It precaches the offline page and falls back to it for failed navigations. No PWA plugin.
- D-19 The admin panel is one static page, `/admin/`, containing a Preact app with hash routing (`#/orders/AJ-2611-7K3Q`). It is `noindex` and absent from the sitemap. Its UI is bilingual through the same i18n files, with the language stored in `localStorage`.
- D-20 Facebook reels and videos use a click-to-load facade: a card with the title and a play button, replaced by the Facebook iframe on click. No Facebook code loads before that.
- D-21 Analytics is off by default. `PUBLIC_ANALYTICS_PROVIDER` is `none`, `goatcounter` or `plausible`. Only the pathname is sent. URL fragments and query strings are stripped. Meta Pixel loads only when `PUBLIC_META_PIXEL_ID` is set and the visitor accepts a consent banner, which is rendered only in that case.
- D-22 Secret scanning has two layers: `gitleaks` in CI, and `scripts/scan.mjs` locally and in CI. The script fails on API-key patterns, any email address outside `example.com`/`example.org`, Sri Lankan phone number patterns outside test fixtures, and the keywords `clinic`, `hospital`, `channelling`, `channeling`, `medical centre`, `medical center`, `nursing home`.

**Ordering**

- D-23 Order IDs are `AJ-<YYMM>-<4 chars>` in Asia/Colombo time, for example `AJ-2611-7K3Q`. The alphabet is `23456789ABCDEFGHJKMNPQRSTVWXYZ` (30 symbols, no `0 1 I L O U`). IDs are random (`crypto.randomInt`). Collisions are handled by `create()` with up to 5 retries.
- D-24 Stock is reserved when the order is created (decremented in the same transaction) and returned when an order becomes `rejected` or `cancelled`. Pre-order books skip the stock check.
- D-25 If the client's displayed total differs from the server's, the order is still accepted (the customer has already paid). It is stored with `totalMismatch: true` and highlighted in admin. Stored totals are always the server's.
- D-26 A book can be sold directly only if `priceLKR > 0`. Books 2 and 3 are seeded with `priceLKR: 0` and `saleMode: 'unavailable'` and display "Price to be announced".
- D-27 Bundle discount: when enabled and the cart holds at least `minQty` copies, `floor(subtotal × percentOff / 100)`. Signed-copy surcharge: `surchargeLKR × totalQty` when the customer ticks the box. Delivery: `fees[district] ?? defaultFeeLKR`, plus `perExtraCopyLKR × (totalQty − 1)`. All money is integer rupees.
- D-28 The form has one free-text field for "gift / dedication request" (`dedicationNote`, 300 characters) and one checkbox for a signed copy (`signedCopy`).
- D-29 Mobile numbers must be Sri Lankan mobiles and are stored as `94XXXXXXXXX`. The WhatsApp number accepts a Sri Lankan mobile or any international number entered with `+`, stored as digits only.
- D-30 `trackOrder` returns the same `not-found` error for an unknown order ID and for wrong phone digits. After 5 failures for one order ID in an hour it returns `resource-exhausted`.
- D-31 Rate limits: `createOrder` 3 per phone per hour, 10 per phone per day, 10 per IP per hour. `trackOrder` 30 per IP per 10 minutes. Other public callables 5 per IP per hour. Keys are HMAC-SHA256 with the secret `HASH_SALT`, so no phone number or IP is stored.
- D-32 The status machine adds one transition to the brief's list: `rejected → pending_verification` ("reopen"), for when the customer replies with a valid slip. It re-reserves stock.
- D-33 One-click WhatsApp: the admin button opens a blank tab synchronously on click, calls `updateOrderStatus`, then points the tab at the returned `wa.me` URL. The order page also always shows a "Send WhatsApp message" link with that URL, in case the browser blocks the tab.
- D-34 Tracking and receipt links carry the order ID in the URL fragment (`/track/#AJ-2611-7K3Q`), never in the query string, so it is not sent to servers or analytics.
- D-35 The device keeps `phoneLast4` with each "My orders" entry so tracking can be prefilled. This stays on the customer's own device.

**Backend**

- D-36 Notifications are driven by one Firestore trigger on `orders/{orderId}/audit/{eventId}`. `createOrder` and `updateOrderStatus` write a `status` audit event in the same transaction as the order change. The event ID is the idempotency key.
- D-37 Every secret is declared with `defineSecret`, so every secret must exist at deploy time. Optional integrations are switched off by storing the literal value `disabled`. `scripts/set-secrets.mjs` does this for skipped optional secrets.
- D-38 `HASH_SALT` is an extra secret (not in the brief) used for rate-limit keys and newsletter email hashes.
- D-39 Signed URLs need a private key, which the emulator does not have. In emulator mode `getSlipUrl` returns a `data:` URL built from the file bytes. In production it returns a V4 signed URL valid for 5 minutes.
- D-40 The Telegram alert contains the order ID, book titles, total and district. It contains no name, phone number or address.
- D-41 Approved reader reviews are copied to `books/{slug}/reviews/{id}` (public read, no personal data beyond a display name). Submissions wait in `review_submissions` (admin only). The brief's rule "books is public-read" covers this subcollection.
- D-42 Admin lists, the dashboard and CSV exports read Firestore directly from the admin client, which the rules permit for `admin: true`. All writes go through callables.
- D-43 Order search uses a `search` token array (order ID, full phone numbers, last 4 digits, lower-cased name words) and `array-contains`. It matches whole tokens, not substrings.
- D-44 Admin E2E signs in with an email/password form that exists only when `PUBLIC_USE_EMULATORS=true`. A test asserts the production build does not contain it. Production offers Google sign-in only.
- D-45 `.firebaserc` contains only `demo-ajith`. Real deploys pass `--project` from a GitHub variable.
- D-46 Sinhala UI text and message templates are written by the implementer and flagged in `MANUAL_SETUP.md` for the author to review.

---

## 4. Repository layout

```
/
├─ PLAN.md  README.md  MANUAL_SETUP.md
├─ package.json  pnpm-workspace.yaml  pnpm-lock.yaml  .node-version
├─ .gitignore  .gitleaks.toml  .env.example  .prettierrc.json  eslint.config.mjs  tsconfig.base.json
├─ firebase.json  .firebaserc
├─ .github/workflows/  ci.yml  deploy-pages.yml  deploy-firebase.yml
├─ firebase/
│  ├─ firestore.rules  firestore.indexes.json  storage.rules
├─ functions/
│  ├─ package.json  tsconfig.json  vitest.config.ts  .secret.local.example  .env.example
│  └─ src/
│     ├─ index.ts                     exports every function
│     ├─ options.ts                   region, params, secrets
│     ├─ shared/                      pure code, also imported by the site as @shared/*
│     │  ├─ constants.ts  districts.ts  errors.ts  types.ts
│     │  ├─ phone.ts  pricing.ts  status.ts  templates.ts  schemas.ts  csv.ts  mask.ts
│     ├─ lib/                         admin.ts guard.ts rateLimit.ts orderId.ts slip.ts search.ts time.ts
│     ├─ callables/                   one file per callable (§11)
│     ├─ triggers/onOrderAudit.ts
│     └─ notify/                      index.ts outbox.ts email.ts emailTemplates.ts telegram.ts whatsappCloud.ts
├─ site/
│  ├─ package.json  astro.config.ts  tsconfig.json  vitest.config.ts
│  ├─ public/
│  │  ├─ covers/      <slug>-front.jpg, -back.jpg, -inner-1.jpg … (placeholders, committed)
│  │  ├─ samples/<slug>/page-01.jpg …
│  │  ├─ author/      author-portrait.jpg (placeholder)
│  │  ├─ icons/       favicon and PWA icons
│  │  └─ press-kit/
│  └─ src/
│     ├─ content.config.ts
│     ├─ content/     books/ blog/ news/ press/ events/ testimonials/ faq/ pages/
│     ├─ i18n/        si.ts en.ts index.ts
│     ├─ layouts/     BaseLayout.astro  AdminLayout.astro
│     ├─ components/  Astro components (Header, Footer, Cover, Seo, Slideshow, …)
│     ├─ islands/     Preact components (order/, track/, forms/, admin/, shared/)
│     ├─ lib/         paths.ts routes.ts env.ts csp.ts seo.ts publicData.ts firebase.ts
│     │               draft.ts slipStore.ts myOrders.ts receipt.ts geo.ts imageCompress.ts analytics.ts
│     ├─ views/       one .astro per page body, takes a `lang` prop
│     ├─ pages/       [...lang]/…  admin/index.astro  404.astro  sitemap.xml.ts  robots.txt.ts
│     │               rss.xml.ts  en/rss.xml.ts  manifest.webmanifest.ts  sw.js.ts
│     └─ styles/global.css
├─ scripts/
│  ├─ dev.mjs  ensure-local-env.mjs  seed.mjs  grant-admin.mjs  set-secrets.mjs  scan.mjs  check-links.mjs
│  ├─ build-images.mjs  build-og.mjs  make-placeholders.mjs  lhci.mjs  check-prod-bundle.mjs
└─ tests/
   ├─ package.json  vitest.rules.config.ts  vitest.functions.config.ts  playwright.config.ts  lighthouserc.cjs
   ├─ helpers/        emulator.ts (reset, seed, tokens, callable client)  fixtures.ts  files/
   ├─ rules/          firestore.test.ts  storage.test.ts
   ├─ functions/      integration tests, one file per area
   └─ e2e/            Playwright specs
```

Workspace packages: `site`, `functions`, `tests`. `/scripts` and `/firebase` are plain folders that use the root `package.json` dependencies.

---

## 5. Toolchain and versions

`pnpm-workspace.yaml`

```yaml
packages:
  - site
  - functions
  - tests
useNodeVersion: 24.22.3
onlyBuiltDependencies:
  - esbuild
  - sharp
  - protobufjs
ignoredBuiltDependencies:
  - re2
```

Root `package.json`: `"private": true`, `"type": "module"`, `"packageManager": "pnpm@10.28.0"`, `"engines": { "node": ">=24.12.0" }`. `.node-version` contains `24.22.3`.

Pinned versions (exact, as verified):

| Where | Packages |
|---|---|
| root (dev) | `firebase-tools@15.36.0`, `typescript@6.0.3`, `eslint@10.14.0`, `typescript-eslint@8.72.2`, `prettier@3.10.0`, `prettier-plugin-astro@1.1.2`, `sharp@0.35.5`, `firebase-admin@14.5.1`, `yaml` (latest), `concurrently` (latest), `wait-on` (latest), `@fontsource/noto-sans-sinhala@5.3.0`, `@fontsource/noto-serif-sinhala@5.3.0` |
| `site` | `astro@7.4.11`, `@astrojs/preact@6.1.5`, `preact@10.29.8`, `@astrojs/mdx@8.1.5`, `@astrojs/rss@4.0.19`, `@astrojs/check@0.9.12`, `tailwindcss@4.3.5`, `@tailwindcss/vite@4.3.5`, `firebase@13.3.0`, `zod@4.6.7`, `idb-keyval@6.3.0`, `browser-image-compression@2.0.2`, `html-to-image@1.11.13`, `jspdf@4.2.1`, `qrcode@1.5.4`, both `@fontsource` packages, `vitest@5.1.0` |
| `functions` | `firebase-functions@7.4.0`, `firebase-admin@14.5.1`, `zod@4.6.7`, `nodemailer@10.5.0`, `@types/nodemailer` (latest), `vitest@5.1.0`, `typescript@6.0.3` |
| `tests` | `@playwright/test@1.63.0`, `@firebase/rules-unit-testing@6.0.0`, `firebase@13.3.0`, `firebase-admin@14.5.1`, `vitest@5.1.0`, `@lhci/cli@0.16.1`, `@axe-core/playwright@4.14.0`, `sharp@0.35.5` |

`zod` must be the same version in `site` and `functions`, because both compile `functions/src/shared/schemas.ts`.

Root scripts (all are run as `pnpm <name>`):

| Script | Does |
|---|---|
| `dev` | `node scripts/dev.mjs`: builds functions in watch mode, starts emulators, waits, seeds fixtures, starts `astro dev` in emulator mode |
| `build` | `pnpm --filter site build` (runs `build-images` and `build-og` first) |
| `build:emu` | the same build with `.env.emulator` values |
| `lint` | `eslint .` and `prettier --check .` |
| `typecheck` | `tsc --noEmit` in `functions` and `tests`, `astro check` in `site` |
| `scan` | `node scripts/scan.mjs` |
| `test:unit` | `vitest run` in `functions` and `site` |
| `test:rules` | `firebase emulators:exec --only firestore,storage --project demo-ajith "pnpm --filter tests exec vitest run -c vitest.rules.config.ts"` |
| `test:functions` | builds functions, then `firebase emulators:exec --only auth,firestore,storage,functions --project demo-ajith "pnpm --filter tests exec vitest run -c vitest.functions.config.ts"` |
| `test:e2e` | `build:emu`, builds functions, then `firebase emulators:exec … "pnpm --filter tests exec playwright test --trace off"` |
| `test:lhci` | `build:emu`, then `firebase emulators:exec … "node scripts/lhci.mjs"` |
| `check:links` | `node scripts/check-links.mjs site/dist` |
| `check:prod` | production-mode build with placeholder config, then `node scripts/check-prod-bundle.mjs` |
| `test` | `lint`, `typecheck`, `scan`, `test:unit`, `test:rules`, `test:functions`, `test:e2e` in that order |
| `seed` | `node scripts/seed.mjs` (flags in §18 Phase 3) |

`firebase.json`

```json
{
  "firestore": { "rules": "firebase/firestore.rules", "indexes": "firebase/firestore.indexes.json", "location": "asia-south1" },
  "storage": { "rules": "firebase/storage.rules" },
  "functions": [{
    "source": "functions", "codebase": "default", "runtime": "nodejs24",
    "ignore": ["node_modules", ".git", "src", "**/*.test.ts", ".secret.local", ".secret.local.example", ".env.demo-ajith", ".env.example", "vitest.config.ts"],
    "predeploy": ["pnpm --filter functions build"]
  }],
  "emulators": {
    "auth": { "host": "127.0.0.1", "port": 9099 },
    "functions": { "host": "127.0.0.1", "port": 5001 },
    "firestore": { "host": "127.0.0.1", "port": 8080 },
    "storage": { "host": "127.0.0.1", "port": 9199 },
    "hub": { "host": "127.0.0.1", "port": 4400 },
    "logging": { "host": "127.0.0.1", "port": 4500 },
    "ui": { "enabled": true, "host": "127.0.0.1", "port": 4000 },
    "singleProjectMode": true
  }
}
```

The `functions.ignore` list must not contain `lib` (the compiled code is uploaded) or `.env` (the deploy workflow writes `functions/.env` and it must be uploaded; see §17). `functions/.env` is git-ignored.

`.gitignore` includes: `node_modules`, `dist`, `functions/lib`, `.astro`, `*.log`, `.env`, `.env.*` (except `.env.example`, `.env.emulator` and `functions/.env.demo-ajith`), `functions/.secret.local`, `functions/.env`, `site/public/covers/_gen`, `site/public/og`, `playwright-report`, `test-results`, `.lighthouseci`, `*-debug.log`, `.firebase`.

---

## 6. Configuration

### 6.1 Build-time public variables (site)

Read through `site/src/lib/env.ts`, which validates them with zod and throws a clear build error when one is missing. `.env.example` lists them all with neutral placeholders (`your-project-id`, `your-api-key`, `https://example.com/site`) and `PUBLIC_USE_EMULATORS=false`; `check:prod` builds with it, so it must not contain `demo-ajith` or `127.0.0.1`. `.env.emulator` is committed and holds the emulator values in the table below.

| Variable | Emulator value | Purpose |
|---|---|---|
| `SITE_URL` | `http://127.0.0.1:4321/booksbyajith` | origin plus base path (D-08) |
| `PUBLIC_USE_EMULATORS` | `true` | connect to emulators, emulator sign-in form, CustomProvider |
| `PUBLIC_FIREBASE_API_KEY` | `demo-api-key` | Firebase web config |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | `demo-ajith.firebaseapp.com` | |
| `PUBLIC_FIREBASE_PROJECT_ID` | `demo-ajith` | |
| `PUBLIC_FIREBASE_STORAGE_BUCKET` | `demo-ajith.firebasestorage.app` | |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `000000000000` | |
| `PUBLIC_FIREBASE_APP_ID` | `1:000000000000:web:demo` | |
| `PUBLIC_RECAPTCHA_SITE_KEY` | `demo-recaptcha-key` | App Check in production |
| `PUBLIC_APPCHECK_DEBUG_TOKEN` | `00000000-0000-4000-8000-000000000000` | emulator App Check token seed (D-14) |
| `PUBLIC_FUNCTIONS_REGION` | `asia-south1` | |
| `PUBLIC_ANALYTICS_PROVIDER` | `none` | `none`, `goatcounter`, `plausible` |
| `PUBLIC_ANALYTICS_SRC` | empty | script URL |
| `PUBLIC_ANALYTICS_ENDPOINT` | empty | GoatCounter endpoint or Plausible domain |
| `PUBLIC_META_PIXEL_ID` | empty | off when empty |

In GitHub Actions these come from repository **variables** (not secrets), because Firebase web config is public by design.

### 6.2 Function parameters (non-secret)

Declared in `functions/src/options.ts` with `defineString`. In the emulator they come from `functions/.env.demo-ajith` (committed, emulator values only). In production the deploy workflow writes `functions/.env` from GitHub variables.

| Param | Emulator value | Purpose |
|---|---|---|
| `SITE_URL` | `http://127.0.0.1:4321/booksbyajith` | links in messages and emails |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:4321` | comma-separated CORS origins for callables |
| `STORAGE_BUCKET` | empty | override for the slip bucket. Empty means the default bucket |

### 6.3 Secrets (`defineSecret`)

| Secret | Required | Notes |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | yes | Nodemailer SMTP |
| `TEAM_EMAILS` | yes | comma-separated team addresses |
| `HASH_SALT` | yes | 64 hex characters, generated by `set-secrets.mjs` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional | `disabled` turns Telegram off |
| `WA_TOKEN`, `WA_PHONE_NUMBER_ID` | optional | `disabled` turns the WhatsApp Cloud adapter off |

`isSet(value)` in `options.ts` returns false for an empty string or `disabled`. In the emulator, secrets come from `functions/.secret.local`. `scripts/ensure-local-env.mjs` creates it from `functions/.secret.local.example` when it is missing, and the `dev`, `test:functions`, `test:e2e` and `test:lhci` scripts run that first. The example file holds obviously fake values (`smtp.example.com`, `team@example.com`, `HASH_SALT=0000…`).

### 6.4 Business data

Bank details, delivery fees, phone numbers, Facebook URL, reel URLs, bundle and surcharge settings, couriers and message templates live in Firestore `config/public` and `config/private` (§9) and are edited in the admin Settings screen. None of it is in the repo. The seed script writes empty placeholders in production mode and fake values in fixture mode.

---

## 7. Routes and pages

Sinhala paths are shown. The English path is the same with an `/en` prefix. All are static.

| Path | View | Notes |
|---|---|---|
| `/` | `HomeView` | slideshow, featured book, latest news and blog, author intro, story of the week, reels, newsletter signup |
| `/books/` | `BooksView` | all books |
| `/books/<slug>/` | `BookView` | gallery, description, specs, awards, look inside, testimonials and reader reviews, press mentions, order or external button, notify-me, share buttons, `Book` JSON-LD |
| `/blog/`, `/blog/<slug>/`, `/blog/tag/<tag>/` | `PostListView`, `PostView` | MDX |
| `/news/`, `/news/<slug>/` | same views | Markdown |
| `/press/` | `PressView` | "Press & Events": media coverage plus the next events |
| `/events/` | `EventsView` | upcoming and past launches and talks |
| `/press-kit/` | `PressKitView` | author photo, short and long bio, covers, book facts, downloads |
| `/order/` | `OrderView` | order island |
| `/order/success/` | `OrderSuccessView` | receipt island |
| `/track/` | `TrackView` | tracking island and "My orders" |
| `/bulk-orders/` | `BulkOrdersView` | enquiry form |
| `/about/`, `/faq/`, `/contact/`, `/privacy/`, `/terms/` | content views | |
| `/newsletter/unsubscribe/` | `UnsubscribeView` | token in the fragment, `noindex` |
| `/offline/` | `OfflineView` | service-worker fallback, `noindex` |
| `/admin/` | `AdminLayout` + admin island | not localised by path, `noindex`, not in sitemap |
| `/404` | `404.astro` | bilingual |
| `/rss.xml`, `/en/rss.xml` | endpoints | blog and news merged, newest first |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js` | endpoints | |

Book slugs: `portuguese-era-1505-1594`, `finding-sinhabahu`, `chinese-expedition`.

Global requirements for every page: header with nav and language toggle, footer, canonical URL, `hreflang` alternates (`si`, `en`, `x-default` → Sinhala), Open Graph and Twitter tags with an absolute image URL, `lang` attribute, skip link, CSP meta, no inline `style` attributes.

---

## 8. Content model

`site/src/content.config.ts` defines these collections with the `glob` loader. All schemas use `astro/zod`.

| Collection | Files | Fields |
|---|---|---|
| `bookFacts` | `books/<slug>/book.yaml` | `slug`, `order`, `featured`, `title {si,en}`, `subtitle {si,en}?`, `originalLanguage ('si'\|'en')`, `publisher?`, `isbn?`, `pages?`, `binding {si,en}?`, `firstPublished?` (year or ISO date), `launch {date, venue {si,en}}?`, `awards [{si,en}]`, `covers [{file, kind: 'front'\|'back'\|'inner', alt {si,en}}]`, `samples [{file, alt {si,en}}]`, `defaults {priceLKR, saleMode, externalUrl?, stock, inStock, preorder, signedCopyAvailable}` |
| `bookText` | `books/<slug>/si.md`, `en.md` | `summary` (≤ 200 chars, used for meta description), body = long description |
| `blog` | `blog/<lang>/<slug>.mdx` | `title`, `description`, `date`, `updated?`, `tags[]`, `cover?`, `coverAlt?`, `translationKey?`, `draft` |
| `news` | `news/<lang>/<slug>.md` | same as `blog` |
| `press` | `press/<id>.yaml` | `outlet`, `title`, `url`, `date`, `language`, `bookSlug?`, `excerpt {si,en}?` |
| `events` | `events/<id>.yaml` | `title {si,en}`, `type ('launch'\|'talk'\|'other')`, `start`, `end?`, `venue {si,en}`, `city {si,en}`, `description {si,en}?`, `url?`, `bookSlug?` |
| `testimonials` | `testimonials/<id>.yaml` | `bookSlug?`, `quote {si,en}`, `author`, `role {si,en}?` |
| `faq` | `faq/<lang>/<nn>-<slug>.md` | `question`, `order`, `category ('payment'\|'delivery'\|'returns'\|'bulk'\|'general')`, body = answer |
| `pages` | `pages/<lang>/<about\|privacy\|terms>.md` | `title`, `description`, `updated` |

Seed content the implementer writes:

- The three books, with the facts given in the brief and nothing invented. Working English titles for the Sinhala books: "The Portuguese Period in Lanka (1505–1594)" and "The Chinese Expedition Hidden from Lankan History". Mark them in `book.yaml` with a comment as working translations for the author to confirm.
- Book 1: `featured: true`, launch 2026-11-11 at the Mahaweli Centre, Colombo, `defaults.priceLKR: 4500`, `saleMode: direct`, `stock: 100`.
- Book 2: Vijitha Yapa Publishers, ISBN 978-955-665-398-4, 334 pages, soft binding, award "Winner, State Literary Award 2020 (Social Science)". Defaults per D-26.
- Book 3: first published 2014, Colombo, ISBN 9789554185104. Defaults per D-26.
- One news post in each language about the 11 Nov 2026 launch, linking to `https://theleader.lk/news/dr-ajith-amarasinghe-launches-book-on-portuguese-era`. State only what the brief states. One `press` entry for the same article and one `events` entry for the launch.
- One short blog post per language marked clearly as a placeholder welcome post.
- `about.md`: medical specialist by profession, member of the Royal Asiatic Society of Sri Lanka, author of three historical research works, then a block marked `<!-- AUTHOR: replace this paragraph with your own words -->` containing visible placeholder text.
- FAQ entries covering payment, delivery time, delivery areas, damaged copies, bulk and library orders.
- Privacy policy covering: what is collected, why, who sees it, bank slip handling, location data, on-device draft storage, retention and anonymisation after the configured number of months, analytics, how to request deletion. Terms covering delivery, returns and damaged copies.

Reading time: `site/src/lib/readingTime.ts`, whitespace-separated word count divided by 180, minimum 1 minute.

---

## 9. Data model

Types for every document live in `functions/src/shared/types.ts`. Timestamps are Firestore `Timestamp`. Money is integer LKR. `L10n` means `{ si: string, en: string }`.

### 9.1 `books/{slug}` (public read)

| Field | Type | Notes |
|---|---|---|
| `slug` | string | same as the document ID |
| `title` | L10n | copied from content, used in orders and messages |
| `priceLKR` | int ≥ 0 | source of truth at checkout |
| `saleMode` | `'direct' \| 'external' \| 'unavailable'` | |
| `externalUrl` | string \| null | required (https) when `saleMode` is `external` |
| `stock` | int ≥ 0 | |
| `inStock` | boolean | manual switch |
| `preorder` | boolean | when true, orders are accepted regardless of `stock` |
| `preorderNote` | L10n \| null | for example an expected date |
| `signedCopyAvailable` | boolean | |
| `sortOrder` | int | |
| `updatedAt` | Timestamp | |

A book is orderable when `saleMode == 'direct' && priceLKR > 0 && inStock && (preorder || stock >= qty)`. This rule is `isOrderable(book, qty)` in `shared/pricing.ts`.

### 9.2 `books/{slug}/reviews/{reviewId}` (public read)

`displayName` (string ≤ 40), `rating` (int 1–5), `text` (string ≤ 1000), `lang` (`'si' | 'en'`), `approvedAt` (Timestamp). No contact details.

### 9.3 `config/public` (public read)

| Field | Type |
|---|---|
| `ordersOpen` | boolean |
| `notice` | L10n \| null (site-wide banner on the order page) |
| `bank` | `{ accountName, accountNumber, bankName, branch, branchCode: string\|null, swift: string\|null }` |
| `paymentInstructions` | L10n |
| `delivery` | `{ fees: { [districtId]: int }, defaultFeeLKR: int, perExtraCopyLKR: int, estimateDays: { min: int, max: int } }` |
| `contact` | `{ whatsappNumber: string, orderPhone: string, facebookPageUrl: string }` (numbers as digits, `94…`) |
| `social` | `{ reels: [{ url, title: L10n }] (≤ 6), videos: [{ url, title: L10n }] (≤ 6), storyOfWeek: { url, title: L10n, blurb: L10n } \| null }` |
| `bundle` | `{ enabled: boolean, minQty: int ≥ 2, percentOff: int 0–50 }` |
| `signedCopy` | `{ enabled: boolean, surchargeLKR: int ≥ 0 }` |
| `couriers` | `[{ name: string, trackingUrlTemplate: string \| null }]` (template contains `{trackingNo}`) |
| `updatedAt`, `updatedBy` | Timestamp, uid |

The order page disables checkout and shows `order.notConfigured` when `ordersOpen` is false or `bank.accountNumber` is empty.

### 9.4 `config/private` (admin read)

| Field | Type |
|---|---|
| `templates` | `{ acknowledged, payment_verified, dispatched, rejected, back_in_stock: L10n }` |
| `retention` | `{ anonymiseAfterMonths: int 1–60 }` (default 12) |
| `lowStockThreshold` | int (default 5) |
| `notifications` | `{ customerEmails: boolean, whatsappCloud: { enabled: boolean, graphApiVersion: string, templateNames: { acknowledged, payment_verified, dispatched, rejected: string }, languageCodes: { si: string, en: string } } }` |
| `updatedAt`, `updatedBy` | Timestamp, uid |

Default templates (English exactly as in the brief; Sinhala as below, see D-46):

| Key | English | Sinhala |
|---|---|---|
| `acknowledged` | Thank you for ordering {bookTitles}, {name}! 🙏 Your order number is {orderId}. We will verify your bank transfer shortly and start preparing your book. | {name}, {bookTitles} ඇණවුම් කිරීම ගැන ඔබට ස්තුතියි! 🙏 ඔබගේ ඇණවුම් අංකය {orderId}. අපි ඔබගේ බැංකු තැන්පතුව ඉක්මනින් තහවුරු කර පොත සූදානම් කිරීම අරඹන්නෙමු. |
| `payment_verified` | Your payment for order {orderId} has been verified ✅. We are now preparing your book for dispatch. | ඇණවුම් අංක {orderId} සඳහා ඔබගේ ගෙවීම තහවුරු විය ✅. අපි දැන් ඔබගේ පොත යැවීමට සූදානම් කරමින් සිටිමු. |
| `dispatched` | Good news! Your order {orderId} ({bookTitles}) has been posted via {courier}, tracking number {trackingNo}. You should receive it within 3 days. Track it here: {trackingUrl}. Follow our Facebook page for history stories: {facebookUrl} | සුබ ආරංචියක්! ඔබගේ ඇණවුම {orderId} ({bookTitles}) {courier} මගින් තැපැල් කර ඇත. ලුහුබැඳීමේ අංකය {trackingNo}. දින 3ක් ඇතුළත ඔබට ලැබෙනු ඇත. මෙතැනින් පරීක්ෂා කරන්න: {trackingUrl}. ඉතිහාස කතා සඳහා අපගේ Facebook පිටුව අනුගමනය කරන්න: {facebookUrl} |
| `rejected` | We could not verify the payment for order {orderId}: {reason}. Please reply to this message so we can help. | ඇණවුම් අංක {orderId} සඳහා ගෙවීම තහවුරු කිරීමට අපට නොහැකි විය: {reason}. කරුණාකර මෙම පණිවිඩයට පිළිතුරු දෙන්න, අපි ඔබට උදව් කරන්නෙමු. |
| `back_in_stock` | Good news! {bookTitles} is available again. Order here: {orderUrl} | සුබ ආරංචියක්! {bookTitles} නැවත ලබා ගත හැක. මෙතැනින් ඇණවුම් කරන්න: {orderUrl} |

Template variables: `{name}`, `{orderId}`, `{bookTitles}`, `{total}`, `{courier}`, `{trackingNo}`, `{trackingUrl}` (the site's track page with `#<orderId>`), `{facebookUrl}`, `{reason}`, `{orderUrl}`. Unknown variables are left as written. `{bookTitles}` uses titles in the order's language, joined with `, `.

### 9.5 `orders/{orderId}` (admin read)

| Field | Type | Notes |
|---|---|---|
| `orderId` | string | document ID, format D-23 |
| `status` | OrderStatus | §10.3 |
| `lang` | `'si' \| 'en'` | the customer's site language |
| `createdAt`, `updatedAt` | Timestamp | |
| `closedAt` | Timestamp \| null | set on `delivered`, `rejected`, `cancelled` |
| `anonymisedAt` | Timestamp \| null | |
| `customer` | `{ name, mobile, whatsapp, email: string \| null }` | `mobile` is `94XXXXXXXXX` |
| `phoneLast4` | string | last 4 digits of `mobile` |
| `address` | `{ line1, line2: string\|null, city, districtId, postalCode, landmark: string\|null }` | |
| `geo` | `{ lat, lng, accuracyM, capturedAt: Timestamp } \| null` | |
| `items` | `[{ slug, title: L10n, qty, unitPriceLKR, lineTotalLKR, preorder: boolean }]` | prices copied from Firestore at order time |
| `bookSlugs` | string[] | for filtering |
| `totalQty` | int | |
| `totals` | `{ subtotalLKR, bundleDiscountLKR, signedSurchargeLKR, deliveryFeeLKR, grandTotalLKR }` | |
| `clientExpectedTotalLKR` | int | what the customer saw |
| `totalMismatch` | boolean | D-25 |
| `signedCopy` | boolean | |
| `dedicationNote` | string \| null | ≤ 300 chars |
| `slip` | `{ path, contentType, sizeBytes, sha256 } \| null` | null after anonymisation |
| `statusHistory` | `[{ status, at: Timestamp }]` | the only data the tracking page shows |
| `dispatch` | `{ courier, trackingNo, trackingUrl: string\|null, dispatchedAt } \| null` | |
| `rejection` | `{ reason, at } \| null` | |
| `stockReserved` | boolean | |
| `search` | string[] | D-43 |

### 9.6 `orders/{orderId}/audit/{eventId}` (admin read)

| Field | Type | Notes |
|---|---|---|
| `type` | `'status' \| 'note' \| 'slip_view' \| 'anonymise'` | |
| `at` | Timestamp | |
| `by` | `{ uid, email } \| null` | null for the customer's own submission |
| `from`, `to` | OrderStatus \| null | for `status` |
| `note` | string \| null | internal note text, rejection reason, or cancellation reason |
| `meta` | map \| null | for example `{ courier, trackingNo }` |

Admin emails appear here because this is private operational data. They never appear in code.

### 9.7 Other collections

| Collection | Access | Fields |
|---|---|---|
| `rate_limits/{hmacKey}` | server only | `count`, `windowStart`, `expiresAt` (TTL) |
| `notification_log/{key}` | server only | `orderId`, `event`, `channel`, `sentAt`, `expiresAt` (TTL, 90 days) |
| `notification_failures/{id}` | admin read | `orderId`, `event`, `channel`, `errorCode`, `errorMessage` (truncated to 300 chars, with emails and digit runs redacted), `at`, `attempt` |
| `dev_outbox/{id}` | admin read, emulator only | `channel ('email'\|'telegram'\|'whatsapp_cloud')`, `to`, `subject`, `html`, `text`, `attachments [{ filename, sizeBytes, contentType }]`, `meta`, `createdAt` |
| `newsletter_subscribers/{emailHmac}` | admin read | `email`, `lang`, `consentAt`, `consentText`, `source`, `unsubToken`, `unsubscribedAt: Timestamp\|null` |
| `stock_alerts/{id}` | admin read | `slug`, `contact { whatsapp: string\|null, email: string\|null }`, `lang`, `createdAt`, `notifiedAt: Timestamp\|null` |
| `enquiries/{id}` | admin read | `kind ('school'\|'library'\|'university'\|'bookshop'\|'other')`, `organisation`, `contactName`, `phone`, `email: string\|null`, `books [{ slug, qty }]`, `message`, `lang`, `createdAt`, `handledAt: Timestamp\|null` |
| `review_submissions/{id}` | admin read | `slug`, `displayName`, `rating`, `text`, `lang`, `createdAt`, `status ('pending'\|'approved'\|'rejected')`, `moderatedAt`, `moderatedBy` |

### 9.8 Storage

One bucket. Objects: `slips/{orderId}/slip.<ext>` where `<ext>` is `jpg`, `png`, `webp` or `pdf`. Written and read only by the Admin SDK. Custom metadata: `orderId`, `sha256`. No download tokens.

---

## 10. Shared domain logic (`functions/src/shared/`)

All of this is pure TypeScript with no Node or Firebase imports, so the site can bundle it.

### 10.1 `constants.ts`, `districts.ts`, `errors.ts`

- `LANGS = ['si', 'en']`, `DEFAULT_LANG = 'si'`, `TIMEZONE = 'Asia/Colombo'`.
- `SLIP_MAX_BYTES = 5 * 1024 * 1024`, `SLIP_IMAGE_TARGET_BYTES = 1.5 * 1024 * 1024`, `SLIP_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']`.
- `MAX_QTY_PER_BOOK = 20`, `MAX_TOTAL_QTY = 50`.
- `ORDER_ID_REGEX = /^AJ-\d{4}-[2-9A-HJKMNP-TV-Z]{4}$/`.
- `DISTRICTS`: 25 entries `{ id, si, en }` in this order: `colombo` කොළඹ, `gampaha` ගම්පහ, `kalutara` කළුතර, `kandy` මහනුවර, `matale` මාතලේ, `nuwara-eliya` නුවරඑළිය, `galle` ගාල්ල, `matara` මාතර, `hambantota` හම්බන්තොට, `jaffna` යාපනය, `kilinochchi` කිලිනොච්චි, `mannar` මන්නාරම, `vavuniya` වවුනියාව, `mullaitivu` මුලතිව්, `batticaloa` මඩකලපුව, `ampara` අම්පාර, `trincomalee` ත්‍රිකුණාමලය, `kurunegala` කුරුණෑගල, `puttalam` පුත්තලම, `anuradhapura` අනුරාධපුරය, `polonnaruwa` පොළොන්නරුව, `badulla` බදුල්ල, `monaragala` මොණරාගල, `ratnapura` රත්නපුර, `kegalle` කෑගල්ල.
- `ErrorCode`, sent in `HttpsError.details.code`: `VALIDATION`, `ORDERS_CLOSED`, `BOOK_UNAVAILABLE`, `OUT_OF_STOCK`, `SLIP_INVALID`, `SLIP_TOO_LARGE`, `RATE_LIMITED`, `NOT_FOUND`, `LOCKED`, `INVALID_TRANSITION`, `MISSING_FIELDS`, `NOT_ADMIN`, `APP_CHECK`.

### 10.2 `phone.ts`, `mask.ts`

- `normaliseLkMobile(input): string | null`. Strips spaces, dashes, dots and brackets. Accepts `07XXXXXXXX`, `7XXXXXXXX`, `947XXXXXXXX`, `+947XXXXXXXX`, `00947XXXXXXXX`. The result must match `/^947[0-9]\d{7}$/`. Returns `94XXXXXXXXX` or null.
- `normaliseWhatsApp(input): string | null`. Tries `normaliseLkMobile` first. Otherwise, if the input starts with `+` and has 8–15 digits, returns the digits.
- `maskPhone('94771234567') → '••• ••• 4567'`. `last4(phone)`.

### 10.3 `status.ts` — the state machine

```
pending_verification ──► acknowledged ──► payment_verified ──► dispatched ──► delivered
        │                     │                  │
        ├──► rejected ◄───────┤                  │
        └──► cancelled ◄──────┴──────────────────┘
rejected ──► pending_verification   (reopen)
```

| From | Allowed `to` |
|---|---|
| `pending_verification` | `acknowledged`, `rejected`, `cancelled` |
| `acknowledged` | `payment_verified`, `rejected`, `cancelled` |
| `payment_verified` | `dispatched`, `cancelled` |
| `dispatched` | `delivered` |
| `rejected` | `pending_verification` |
| `delivered`, `cancelled` | none |

Required fields per target: `dispatched` needs `courier` (1–60 chars) and `trackingNo` (1–60 chars). `rejected` needs `reason` (3–300 chars). `cancelled` takes an optional `reason`.

Exports: `ORDER_STATUSES`, `TRANSITIONS`, `canTransition(from, to)`, `requiredFields(to)`, `isTerminal(status)`, `releasesStock(to)` (true for `rejected`, `cancelled`), `reservesStock(from, to)` (true for `rejected → pending_verification`), `templateKeyFor(to)` (`acknowledged`, `payment_verified`, `dispatched`, `rejected`, otherwise null), `customerEmailFor(to)` (true for `payment_verified`, `dispatched`, `rejected`).

### 10.4 `pricing.ts`

```ts
computeTotals(input: {
  lines: { slug: string; qty: number; unitPriceLKR: number }[];
  districtId: string;
  signedCopy: boolean;
  config: Pick<PublicConfig, 'delivery' | 'bundle' | 'signedCopy'>;
}): Totals
```

Rules per D-27. `signedSurchargeLKR` is 0 unless `config.signedCopy.enabled && input.signedCopy`. `grandTotalLKR = subtotal − bundleDiscount + signedSurcharge + deliveryFee`. The site calls the same function to show the total, so client and server agree by construction.

### 10.5 `templates.ts`, `csv.ts`, `schemas.ts`

- `renderTemplate(template, vars)`, `buildWaUrl(number, text)` → `https://wa.me/<digits>?text=<encodeURIComponent(text)>`, `buildMapsUrl(lat, lng)` → `https://maps.google.com/?q=<lat>,<lng>`, `buildTrackUrl(siteUrl, lang, orderId)`.
- `toCsv(rows, columns)`: RFC 4180 quoting, a UTF-8 BOM, and a leading `'` on any cell starting with `=`, `+`, `-` or `@`.
- `schemas.ts`: one zod schema per callable input (§11), exported with inferred types. String fields are trimmed and length-limited: name 2–80, address lines ≤ 120, city ≤ 60, postal code `/^\d{5}$/`, landmark ≤ 200, email ≤ 120.

---

## 11. Cloud Functions

All functions: v2, region `asia-south1`, `maxInstances: 10`, memory 256 MiB unless stated. All callables: `enforceAppCheck: true`, `cors` from `ALLOWED_ORIGINS` (`true` in the emulator). Each callable file exports a `handle…(data, ctx, deps)` function that holds the logic and a thin `onCall` wrapper, so the handler can be called directly in tests.

`lib/guard.ts`:

- `requireAppCheck(request)`: throws `failed-precondition` (`APP_CHECK`) when `request.app` is undefined. A second line of defence behind `enforceAppCheck`.
- `requireAdmin(request)`: throws `permission-denied` (`NOT_ADMIN`) unless `request.auth?.token.admin === true`. Returns `{ uid, email }`.
- `clientIp(request)`: `request.rawRequest.ip`, falling back to the first entry of `x-forwarded-for`.
- `parse(schema, data)`: zod parse. On failure throws `invalid-argument` (`VALIDATION`) with field paths only, never values.

`lib/rateLimit.ts`: `enforceRateLimit({ scope, id, limit, windowSec })`. Key = `HMAC-SHA256(HASH_SALT, scope + '|' + id + '|' + floor(now / windowSec))`. A transaction increments `rate_limits/{key}` and sets `expiresAt = windowEnd + 1 hour`. Throws `resource-exhausted` (`RATE_LIMITED`) when the count exceeds the limit.

### 11.1 Public callables

**`createOrder`** — memory 512 MiB, timeout 60 s, secrets `HASH_SALT`.

Input:

```ts
{
  lang: 'si' | 'en',
  items: { slug: string; qty: number }[],        // 1–10 lines, unique slugs, qty 1–20, total ≤ 50
  customer: { name: string; mobile: string; whatsapp: string; email?: string },
  address: { line1: string; line2?: string; city: string; districtId: string; postalCode: string; landmark?: string },
  geo?: { lat: number; lng: number; accuracyM: number; capturedAt: number },   // epoch ms
  signedCopy: boolean,
  dedicationNote?: string,
  expectedTotalLKR: number,
  slip: { fileName: string; contentType: string; dataBase64: string },
  consent: true
}
```

Output: `{ orderId, createdAt (epoch ms), status, items, totals, phoneMasked, totalMismatch }`.

Steps, in order:

1. `requireAppCheck`, `parse`. Normalise both phone numbers.
2. Rate limits (D-31) for the phone and the IP.
3. Decode the slip. Reject when the decoded size is over 5 MB (`SLIP_TOO_LARGE`). Detect the type from magic bytes (`FF D8 FF`, `89 50 4E 47`, `RIFF….WEBP`, `%PDF-`). Reject when it is not one of the four types or does not match the declared `contentType` (`SLIP_INVALID`). Compute SHA-256.
4. Read `config/public`. Reject with `ORDERS_CLOSED` when `ordersOpen` is false or the bank account number is empty.
5. Generate an order ID and upload the slip to `slips/{orderId}/slip.<ext>`.
6. Run a transaction: read each book; reject with `BOOK_UNAVAILABLE` or `OUT_OF_STOCK` (details list the slugs) when `isOrderable` fails; compute totals with `computeTotals`; decrement stock for non-preorder lines; `create()` the order with status `pending_verification` and one `statusHistory` entry; create the audit event `{ type: 'status', from: null, to: 'pending_verification', by: null }`.
7. If the transaction fails, delete the uploaded slip, then rethrow. If it fails because the ID already exists, go back to step 5 (up to 5 times).
8. Return the output. Log only `orderId`, item count and total.

**`trackOrder`** — input `{ orderId: string; phoneLast4: string }` (`ORDER_ID_REGEX`, `/^\d{4}$/`). Output `{ orderId, status, timeline: { status, at }[], courier: string | null, trackingNo: string | null, trackingUrl: string | null }`. Rate limit per IP. Reads the order; on a missing order or wrong digits, counts a failure against `track-fail|orderId` (5 per hour, then `LOCKED`) and throws `not-found`. Anonymised orders still track by ID and digits because `phoneLast4` is kept.

**`subscribeNewsletter`** — input `{ email, lang, consent: true, source: string }`. Output `{ ok: true }` whether or not the address was already subscribed. Document ID is `HMAC(HASH_SALT, lowercased email)`. Generates `unsubToken` (32 random bytes, base64url).

**`unsubscribeNewsletter`** — input `{ token }`. Output `{ ok: true }` always. Sets `unsubscribedAt`.

**`requestStockAlert`** — input `{ slug, lang, whatsapp?: string, email?: string }`, at least one contact. Output `{ ok: true }`.

**`submitEnquiry`** — input matches the `enquiries` fields. Output `{ ok: true }`. Sends a team email through the notifier (event `enquiry`).

**`submitReview`** — input `{ slug, displayName, rating, text, lang }`. Output `{ ok: true }`. Creates a `review_submissions` document with status `pending`.

The last five use `enforceRateLimit({ scope: <name>, id: ip, limit: 5, windowSec: 3600 })` and need `HASH_SALT`.

### 11.2 Admin callables

All call `requireAppCheck` and `requireAdmin` first.

**`updateOrderStatus`** — input `{ orderId, to: OrderStatus, courier?: string, trackingNo?: string, reason?: string }`. Output `{ orderId, status, waUrl: string | null, message: string | null }`.

In one transaction: read the order; throw `failed-precondition` (`INVALID_TRANSITION`) unless `canTransition`; throw `invalid-argument` (`MISSING_FIELDS`) when a required field is missing; return stock to each non-preorder line's book when `releasesStock(to) && stockReserved`; check and re-reserve stock when `reservesStock`; set `status`, `updatedAt`, `closedAt`, `dispatch` or `rejection`; append to `statusHistory`; create the audit event with `by`, `from`, `to`, `note`, `meta`. After the transaction: load the template for `templateKeyFor(to)` in the order's language, render it, and return `waUrl` built with the customer's WhatsApp number. For `dispatch`, `trackingUrl` in `dispatch` comes from the courier's `trackingUrlTemplate` when one matches by name.

**`addOrderNote`** — input `{ orderId, note (1–1000 chars) }`. Output `{ ok: true }`. Creates an audit event of type `note`.

**`getSlipUrl`** — input `{ orderId }`. Output `{ url, contentType, expiresAt (epoch ms) }`. Creates an audit event of type `slip_view`. URL per D-39.

**`updateSettings`** — input `{ public?: Partial<PublicConfig>, private?: Partial<PrivateConfig> }`, each validated by a strict zod schema (unknown keys rejected; URLs must be `https:`; phone numbers normalised; delivery fee keys must be district IDs; every template must be ≤ 1000 chars). Merges at the top-level key, sets `updatedAt` and `updatedBy`. Output `{ ok: true }`.

**`updateBook`** — input `{ slug, priceLKR?, saleMode?, externalUrl?, stock?, inStock?, preorder?, preorderNote?, signedCopyAvailable? }`. Rejects `saleMode: 'direct'` with a resulting price of 0 and `saleMode: 'external'` without an `https:` URL. When the book goes from not orderable to orderable, emails every `stock_alerts` entry for that slug that has an email and no `notifiedAt` (event `back_in_stock`, idempotency key `stock|<alertId>`) and sets `notifiedAt` on those. Entries with only a WhatsApp number stay pending for the admin to message. Output `{ ok: true, alertsEmailed: number }`.

**`moderateReview`** — input `{ id, action: 'approve' | 'reject' | 'unpublish' }`. Approve copies the public fields to `books/{slug}/reviews/{id}`. Unpublish deletes that copy. Output `{ ok: true }`.

**`adminUpdateRecord`** — input `{ collection: 'stock_alerts' | 'enquiries' | 'newsletter_subscribers', id, action: 'mark_notified' | 'mark_handled' | 'delete' }`, with only the valid pairs accepted. Output `{ ok: true }`.

**`anonymiseOldOrders`** — input `{ dryRun: boolean }`. Selects orders with `anonymisedAt == null` and `closedAt` older than `retention.anonymiseAfterMonths`, up to 200 per call. For each: deletes the slip object; sets `customer` to `{ name: '[removed]', mobile: '', whatsapp: '', email: null }`, clears `address` fields except `districtId`, sets `geo`, `dedicationNote` and `slip` to null, sets `search` to `[orderId]`, sets `anonymisedAt`; deletes audit events of type `note`; adds an audit event of type `anonymise`. Output `{ matched, anonymised, hasMore }`.

### 11.3 Trigger

**`onOrderAudit`** — `onDocumentCreated('orders/{orderId}/audit/{eventId}')`, secrets: all eleven, retries enabled. Ignores events whose type is not `status`. Loads the order and calls `notify()` (§13).

### 11.4 Secret bindings

A function can read only the secrets listed in its options. Bind exactly these:

| Function | Secrets |
|---|---|
| `createOrder`, `trackOrder`, `subscribeNewsletter`, `unsubscribeNewsletter`, `requestStockAlert`, `submitReview` | `HASH_SALT` |
| `submitEnquiry` | `HASH_SALT`, the five SMTP secrets, `TEAM_EMAILS` |
| `updateBook` | the five SMTP secrets |
| `onOrderAudit` | all eleven |
| other admin callables | none |

---

## 12. Security rules and indexes

### 12.1 `firebase/firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }

    match /books/{slug} {
      allow read: if true;
      allow write: if false;
      match /reviews/{reviewId} {
        allow read: if true;
        allow write: if false;
      }
    }

    match /config/public {
      allow read: if true;
      allow write: if false;
    }
    match /config/private {
      allow read: if isAdmin();
      allow write: if false;
    }

    match /orders/{orderId} {
      allow read: if isAdmin();
      allow write: if false;
      match /audit/{eventId} {
        allow read: if isAdmin();
        allow write: if false;
      }
    }

    match /newsletter_subscribers/{id} { allow read: if isAdmin(); allow write: if false; }
    match /stock_alerts/{id}           { allow read: if isAdmin(); allow write: if false; }
    match /enquiries/{id}              { allow read: if isAdmin(); allow write: if false; }
    match /review_submissions/{id}     { allow read: if isAdmin(); allow write: if false; }
    match /notification_failures/{id}  { allow read: if isAdmin(); allow write: if false; }
    match /dev_outbox/{id}             { allow read: if isAdmin(); allow write: if false; }

    // rate_limits, notification_log and anything not listed: no client access.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 12.2 `firebase/storage.rules`

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 12.3 `firebase/firestore.indexes.json`

Composite indexes on `orders` (collection scope):

1. `status` ASC, `createdAt` DESC
2. `bookSlugs` ARRAY_CONTAINS, `createdAt` DESC
3. `search` ARRAY_CONTAINS, `createdAt` DESC
4. `status` ASC, `bookSlugs` ARRAY_CONTAINS, `createdAt` DESC
5. `anonymisedAt` ASC, `closedAt` ASC

Others: `stock_alerts` (`slug` ASC, `notifiedAt` ASC), `review_submissions` (`status` ASC, `createdAt` DESC).

Field overrides with `"ttl": true`: `rate_limits.expiresAt`, `notification_log.expiresAt`.

Admin queries that combine a search token with a book filter apply the book filter in the client (Firestore allows one `array-contains` per query).

---

## 13. Notifications (`functions/src/notify/`)

`notify(order, event)` builds a list of sends and runs each through `sendOnce`.

| Event | Sends |
|---|---|
| `pending_verification` with `from == null` (new order) | team email with the slip attached; customer confirmation email when an email was given; Telegram alert when enabled |
| `payment_verified`, `dispatched`, `rejected` | customer email when an email was given and `notifications.customerEmails` is true; WhatsApp Cloud template message when enabled |
| `acknowledged` | WhatsApp Cloud template message when enabled |
| anything else | nothing |

`sendOnce({ key, channel, orderId, event, send })`:

1. `key = orderId + '|' + eventId + '|' + channel + '|' + recipientRole` (`team` or `customer`).
2. `notification_log/{sha256(key)}.create(...)`. If it already exists, return without sending. This makes retries safe.
3. Call `send()`. On failure, delete the log document, write `notification_failures`, and continue with the other sends. After all sends, throw if any failed, so the trigger retries only the failed ones.

Transport selection in `notify/index.ts`: when `process.env.FUNCTIONS_EMULATOR === 'true'`, every channel writes to `dev_outbox` and logs one line (`channel`, `event`, `orderId`). Otherwise the real senders run.

- `email.ts`: Nodemailer SMTP transport from the secrets (`secure` when the port is 465). `sendEmail({ to, subject, html, text, attachments })`.
- `emailTemplates.ts`: functions returning `{ subject, html, text }` for `teamNewOrder`, `customerConfirmation`, `customerVerified`, `customerDispatched`, `customerRejected`, `teamEnquiry`, `backInStock`, each in Sinhala and English. HTML is a single-column table layout, 600 px maximum width, inline CSS, system fonts, no images. The team email contains full order details and a link to `SITE_URL/admin/#/orders/<orderId>`. Customer emails contain the order ID, items, total and a tracking link. They never contain the bank slip.
- `telegram.ts`: `POST https://api.telegram.org/bot<token>/sendMessage` with `{ chat_id, text }`. Content per D-40. Active only when both secrets pass `isSet`.
- `whatsappCloud.ts`: `POST https://graph.facebook.com/<graphApiVersion>/<WA_PHONE_NUMBER_ID>/messages` with a `template` message: template name from `notifications.whatsappCloud.templateNames[event]`, language code from `languageCodes[order.lang]`, body parameters in the fixed order `name, orderId, bookTitles, courier, trackingNo, trackingUrl, reason` (only those the event uses). Active only when the config flag is true and both secrets pass `isSet`. Uses global `fetch`, which the tests mock.

Logging rule for every file in `/functions`: log IDs, counts, status names and error codes only. Never log names, phone numbers, emails, addresses or message bodies. `lib/log.ts` wraps `firebase-functions/logger` and its `redact()` replaces email-shaped strings and runs of 7 or more digits.

---

## 14. Client architecture

### 14.1 Design system

Defined once in `site/src/styles/global.css` with Tailwind `@theme`.

- Colours: `--color-paper #f8f3e7`, `--color-ink #1f1b16`, `--color-maroon #7a1f1f` (primary, buttons and links), `--color-maroon-dark #5c1616`, `--color-gold #9a6b12` (accents, never for body text), `--color-teal #1f4e5f`, `--color-line #dccfb4`, `--color-success #1e6b3a`, `--color-danger #a32020`. Every text and background pair used must reach WCAG AA (4.5:1). The axe E2E test checks it.
- Type: headings `Noto Serif Sinhala`, body `Noto Sans Sinhala`, with system fallbacks. Body 17 px with line-height 1.75 for Sinhala. `font-display: swap`. Preload the two Sinhala WOFF2 files used above the fold.
- Layout: mobile first, content width 72 ch for prose and 1200 px for grids. Tap targets at least 44 px. Visible focus ring on every interactive element.
- No inline `style` attributes anywhere in markup (CSP, §14.9). Use classes.

### 14.2 Language and paths

- `site/src/i18n/si.ts` and `en.ts` export flat objects with the keys in §15. `index.ts` exports `t(lang, key, vars?)` and the type `I18nKey`. `en.ts` is typed as `Record<keyof typeof si, string>`, so a missing key fails `typecheck`.
- `paths.ts`: `href(lang, path)` returns `BASE_URL` + (`/en` for English) + `path`, always ending in `/`. `altHref(currentPath, targetLang)`. `absUrl(pathWithBase)`.
- The language toggle is a normal link to the alternate page. It stores the choice in `localStorage['aj.lang']`. There is no automatic redirect. A blog or news post with no translation links to the other language's index.
- Islands receive `lang` and a dictionary subset as props, so they need no i18n runtime.

### 14.3 Public data (`lib/publicData.ts`)

- `fetchPublicConfig()` and `fetchBooks()` call `GET {firestoreBase}/v1/projects/{projectId}/databases/(default)/documents/config/public` and `…/documents/books`. `firestoreBase` is `http://127.0.0.1:8080` in emulator mode and `https://firestore.googleapis.com` otherwise.
- `decodeFirestoreValue()` converts the REST value format (`stringValue`, `integerValue`, `doubleValue`, `booleanValue`, `nullValue`, `timestampValue`, `mapValue`, `arrayValue`) to plain objects. It has unit tests.
- Results are cached in `sessionStorage` for 5 minutes. Failures return null and callers fall back to the static defaults from the content files. Nothing is written to the console.
- A small script in `BaseLayout` runs on `requestIdleCallback`, fetches the config, and fills elements marked with `data-config` (Facebook link, WhatsApp link). Those elements are hidden until filled.
- Book pages show the price from the build, then replace it with the live price and stock state.

### 14.4 Firebase client (`lib/firebase.ts`)

- `callable<Req, Res>(name)` dynamically imports `firebase/app`, `firebase/app-check` and `firebase/functions`, initialises them once, and returns the callable. App Check per D-14 and D-15.
- Emulator token: `base64url('{"alg":"none","typ":"JWT"}') + '.' + base64url(JSON.stringify({ sub: appId, aud: [projectId], iss: 'emulator', jti: debugToken, iat, exp })) + '.emulator'`.
- `mapError(err)` turns an `HttpsError` into an i18n key using `details.code`.
- `islands/admin/firebaseAdmin.ts` additionally loads `firebase/auth` and `firebase/firestore` and connects them to the emulators in emulator mode. Nothing outside `islands/admin/` imports it.
- The client never imports `firebase/storage`.

### 14.5 Order flow (`islands/order/`)

Four steps in one island, `OrderApp.tsx`, with a step indicator: 1 Books, 2 Delivery details, 3 Payment and slip, 4 Review and submit.

- Step 1: every orderable book with quantity steppers; unavailable books are listed as disabled with the reason. `?book=<slug>` adds that book once. Shows the bundle offer when configured.
- Step 2: the form fields from the brief. District is a `<select>` of the 25 districts in the current language. "WhatsApp number same as mobile" checkbox, ticked by default. Signed-copy checkbox when enabled, with its surcharge. Inline validation with the shared zod schema, on blur and on Next. Each error is tied to its field with `aria-describedby`.
- "Use my current location" (`lib/geo.ts`): `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`, a 15 s timeout and `maximumAge: 0`. On success, stores `lat`, `lng`, `accuracyM`, `capturedAt`, shows the accuracy and a "View on Google Maps" link from `buildMapsUrl`, and a "Remove location" button. On error, shows `order.geo.denied`, `order.geo.unavailable` or `order.geo.timeout` and lets the customer continue. The button is hidden when the API is missing.
- Step 3: the total from `computeTotals`, the bank details and payment instructions from `config/public`, each bank field with a copy button, and the warning `order.payment.warning`. Slip input accepts `image/jpeg,image/png,image/webp,application/pdf`. Files over 5 MB are rejected. Images over 1.5 MB are compressed with `browser-image-compression` (`maxSizeMB: 1.5`, `maxWidthOrHeight: 2000`, `useWebWorker: true`). Shows a preview for images and the file name for PDFs, with a Replace button.
- Step 4: read-only summary, consent checkbox linking to the privacy policy, Submit. On submit: convert the slip to base64, call `createOrder`, then save the receipt, add to "My orders", clear the draft, and go to `/order/success/#<orderId>`. Submit is disabled while pending. Errors are shown from `mapError` and the draft is kept.

Draft persistence:

| Store | Key | Content |
|---|---|---|
| `localStorage` | `aj.orderDraft.v1` | `{ v: 1, updatedAt, step, cart: [{ slug, qty }], fields: { name, mobile, whatsappSame, whatsapp, email, line1, line2, city, districtId, postalCode, landmark, signedCopy, dedicationNote }, geo, slipMeta: { name, type, size } \| null, consent }` |
| IndexedDB (`idb-keyval`, database `aj-order`, store `draft`) | `slip.v1` | `{ blob, name, type, size, savedAt }` |
| `localStorage` | `aj.myOrders.v1` | up to 20 of `{ orderId, createdAt, titles[], totalLKR, phoneLast4, lang }` |
| `localStorage` | `aj.receipts.v1` | up to 20 receipt payloads keyed by order ID |

`lib/draft.ts`: `loadDraft()`, `saveDraft()` debounced 400 ms and flushed on `visibilitychange` and `pagehide`, `clearDraft()` (clears both stores). A draft with a different `v` is discarded. On load with a non-empty draft the island restores every field, the step and the slip, and shows the banner `order.draft.restored` with a "Start over" button that asks for confirmation. If IndexedDB is unavailable, the form still works and shows `order.draft.slipNotSaved` after a reload. All storage access is wrapped in try/catch.

### 14.6 Success page and receipt (`lib/receipt.ts`, `islands/order/Receipt.tsx`)

- Reads the order ID from the fragment and the payload from `aj.receipts.v1`. If there is no payload (another device), shows the order ID and a link to the tracking page.
- Shows the summary, next steps, a "Message us on WhatsApp" button (`buildWaUrl(config.contact.whatsappNumber, t('success.waMessage', { orderId }))`), and the two download buttons.
- The receipt is a 720 px wide, white element with `data-testid="receipt"`, positioned off-screen with a class (`fixed` at `left: -10000px`, never `display: none`): site name, order ID, date, items, each total line, masked phone, status, and a QR code (`qrcode`, rendered to a data URL) of `absUrl(href(lang, '/track/')) + '#' + orderId`. The QR `<img>` carries the encoded URL in `data-qr-url`.
- `renderReceiptJpg(node)`: `await document.fonts.ready`, then `htmlToImage.toJpeg(node, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff' })`.
- `renderReceiptPdf(jpgDataUrl, width, height)`: `new jsPDF({ unit: 'px', format: [width, height], hotfixes: ['px_scaling'] })`, then `addImage(jpgDataUrl, 'JPEG', 0, 0, width, height)`. No call to `text()` or `setFont()` anywhere. `scan.mjs` fails the build if `site/src` contains `.text(` on a jsPDF instance (pattern `pdf\.text\(|doc\.text\(`).
- File names: `receipt-<orderId>.jpg` and `.pdf`. `html-to-image`, `jspdf` and `qrcode` are dynamically imported on first use.

### 14.7 Tracking and forms

- `islands/track/TrackApp.tsx`: order ID and last-4 inputs, prefilled from the fragment and from "My orders". Shows the timeline with dates in Asia/Colombo, the courier, tracking number and courier link. Lists "My orders" with a Track button each and a "Remove from this device" button.
- `islands/forms/`: `NewsletterForm`, `StockAlertForm`, `EnquiryForm`, `ReviewForm`. Each loads Firebase only on submit, has a consent checkbox where personal data is stored, and a hidden honeypot field that makes the submit a silent no-op when filled.

### 14.8 Admin app (`islands/admin/`)

Hash routes: `#/` dashboard, `#/orders`, `#/orders/<id>`, `#/print?ids=…`, `#/books`, `#/settings`, `#/reviews`, `#/subscribers`, `#/alerts`, `#/enquiries`, `#/maintenance`.

- `AuthGate`: signed out → "Sign in with Google" (`signInWithPopup`). Signed in without the `admin` claim → `admin.notAuthorised`, a "Check again" button (`getIdTokenResult(true)`) and Sign out. No data listener starts before the claim is confirmed. In emulator mode only, an extra email and password form with `data-testid="emulator-signin"`.
- Dashboard: counts per status (`getCountFromServer`), today's orders, revenue this month (`getAggregateFromServer(sum('totals.grandTotalLKR'))` over orders with status `payment_verified`, `dispatched` or `delivered` created this month, Asia/Colombo), low-stock books, pending reviews, unhandled enquiries, notification failures in the last 7 days.
- Orders list: `onSnapshot`, newest first, 25 per page with "Load more". Filters: status, date range, book. Search box per D-43. Cards on mobile, table on desktop. Orders with `totalMismatch` carry a badge. Row checkboxes feed "Export CSV" and "Print labels".
- Order detail: customer, address, Maps link when `geo` exists, items and totals, slip viewer (`getSlipUrl`; an `<img>` for images, a link for PDFs), timeline, audit log, note box. Action buttons are generated from `TRANSITIONS[status]`. `dispatched` opens a form with a courier select (from `config.public.couriers`, plus "Other") and tracking number. `rejected` and `cancelled` open a reason form. Each action that has a template follows D-33 and leaves a `data-testid="wa-link"` anchor. A "Re-send WhatsApp message" menu rebuilds any template client-side with the shared functions.
- CSV columns: `orderId, date, name, mobile, whatsapp, addressLine1, addressLine2, city, district, postalCode, landmark, items, totalQty, totalLKR, status, courier, trackingNo`.
- Print view: A4 sheet of 8 labels (2 × 4, 99.1 × 67.7 mm) or a single 100 × 150 mm label, plus an optional packing slip per order. Uses `@media print` and `@page`. Each label: name, address lines, city, district, postal code, mobile, order ID.
- Books: price, stock, sale mode, external URL, in-stock, pre-order, pre-order note, signed-copy flag, per book (`updateBook`).
- Settings: one form section per `config/public` and `config/private` group (`updateSettings`). Template editors show the available variables and a live preview with sample values.
- Reviews, subscribers (with CSV export), stock alerts (WhatsApp button and "Mark notified"), enquiries ("Mark handled").
- Maintenance: retention months, "Preview" (`anonymiseOldOrders({ dryRun: true })`) and "Anonymise now" with a typed confirmation.

### 14.9 Content Security Policy (`lib/csp.ts`)

`astro.config.ts` sets `security.csp` with directives built from the environment:

| Directive | Value |
|---|---|
| `default-src` | `'self'` |
| `script-src` | Astro's hashes, `'self'`, `https://www.google.com/recaptcha/`, `https://www.gstatic.com/recaptcha/`, `https://apis.google.com`, the analytics script origin when configured, `https://connect.facebook.net` only when the pixel is configured |
| `style-src` | Astro's hashes, `'self'` |
| `img-src` | `'self' data: blob: https://storage.googleapis.com`, plus `https://www.facebook.com` only when the pixel is configured |
| `font-src` | `'self' data:` |
| `connect-src` | `'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.google.com/recaptcha/ https://<region>-<projectId>.cloudfunctions.net`, the analytics endpoint when configured, and `http://127.0.0.1:*` in emulator mode |
| `frame-src` | `https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://<authDomain> https://www.facebook.com` |
| `worker-src` | `'self' blob:` |
| `manifest-src` | `'self'` |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |

Check the exact option names (`directives`, `scriptDirective.resources`, `styleDirective.resources`) in `node_modules/astro/dist/types/public/config.d.ts` before writing the config. JSON-LD blocks are data, not script, and need no hash.

### 14.10 Other client pieces

- Slideshow (`components/Slideshow.astro` plus a `<script>`): a horizontal scroll-snap track, so swipe is native. Previous and next buttons, dot buttons, and a visible pause/play button. Autoplay every 5 s; it stops on hover, on focus within, when the tab is hidden, when the user presses pause, and never starts under `prefers-reduced-motion: reduce`. `section[aria-roledescription="carousel"]` with a label, slides as `role="group"` with `aria-label="n of N"`, `aria-live="off"` while autoplaying and `polite` otherwise. First slide image is `loading="eager"` with `fetchpriority="high"`; the rest are lazy.
- `components/Cover.astro`: `<picture>` with WebP `srcset` (320, 640, 960) from `_gen`, the original JPG as fallback, explicit `width` and `height`.
- `components/Seo.astro`: title, description, canonical, alternates, Open Graph (`og:type` `book` for book pages with `book:isbn`, `article` for posts), Twitter card, JSON-LD (`Book` on book pages, `Article` on posts, `Person` on About, `WebSite` on Home, `Event` on events, `FAQPage` on FAQ).
- Share buttons: Facebook (`https://www.facebook.com/sharer/sharer.php?u=`), WhatsApp (`https://wa.me/?text=`), copy link (`navigator.clipboard`, with a status message).
- PWA: `manifest.webmanifest` (name, short name, `start_url` and `scope` = base path, `display: standalone`, theme colours, 192 and 512 icons plus a maskable icon). `sw.js` per D-18, registered on `load`, not registered on `/admin/`.
- Analytics per D-21 in `lib/analytics.ts`.

---

## 15. i18n key list

Both `si.ts` and `en.ts` define every key below. Dots are part of the key string. Add keys when needed and keep both files in step (the type check enforces it).

```
site.name, site.tagline, site.skipToContent, site.langToggle, site.langName.si, site.langName.en,
site.menu, site.close, site.loading, site.error.generic, site.error.offline, site.retry, site.copied, site.copy,

nav.home, nav.books, nav.blog, nav.news, nav.press, nav.events, nav.about, nav.faq, nav.contact,
nav.order, nav.track, nav.pressKit, nav.bulk,

footer.about, footer.links, footer.legal, footer.privacy, footer.terms, footer.follow, footer.facebook,
footer.rights, footer.newsletter,

home.hero.label, home.hero.prev, home.hero.next, home.hero.pause, home.hero.play, home.hero.slideOf,
home.featured.title, home.featured.launched, home.featured.orderNow, home.featured.details,
home.latest.title, home.latest.all, home.author.title, home.author.more,
home.story.title, home.story.watch, home.reels.title, home.reels.play, home.reels.onFacebook,
home.newsletter.title, home.newsletter.blurb,

books.title, books.intro, books.price, books.priceTba, books.orderDirect, books.buyExternal,
books.unavailable, books.outOfStock, books.preorder, books.inStock, books.lowStock, books.viewDetails,

book.gallery, book.cover.front, book.cover.back, book.cover.inner, book.description, book.specs,
book.spec.isbn, book.spec.pages, book.spec.language, book.spec.binding, book.spec.publisher,
book.spec.published, book.spec.launch, book.awards, book.lookInside, book.sampleOf,
book.testimonials, book.readerReviews, book.noReviews, book.writeReview, book.press,
book.share, book.share.facebook, book.share.whatsapp, book.share.copy,
book.notify.title, book.notify.blurb, book.notify.submit, book.notify.done,
book.lang.si, book.lang.en,

post.readingTime, post.published, post.updated, post.tags, post.tagged, post.back, post.related,
post.noTranslation, blog.title, blog.intro, news.title, news.intro, rss.title, rss.description,

press.title, press.intro, press.coverage, press.readArticle, press.upcoming, press.allEvents,
events.title, events.upcoming, events.past, events.none, events.type.launch, events.type.talk,
events.type.other, events.details,
pressKit.title, pressKit.intro, pressKit.photo, pressKit.shortBio, pressKit.longBio, pressKit.covers,
pressKit.facts, pressKit.download, pressKit.contact,

about.title, about.credentials, faq.title, faq.cat.payment, faq.cat.delivery, faq.cat.returns,
faq.cat.bulk, faq.cat.general, contact.title, contact.intro, contact.whatsapp, contact.facebook,
contact.phone, contact.hours, privacy.title, terms.title,

order.title, order.step.books, order.step.details, order.step.payment, order.step.review,
order.stepOf, order.next, order.back, order.closed, order.notConfigured,
order.cart.empty, order.cart.add, order.cart.remove, order.cart.qty, order.cart.increase,
order.cart.decrease, order.cart.max, order.cart.bundleHint, order.cart.unavailable,
order.field.name, order.field.mobile, order.field.mobileHint, order.field.whatsappSame,
order.field.whatsapp, order.field.email, order.field.emailHint, order.field.line1, order.field.line2,
order.field.city, order.field.district, order.field.districtPlaceholder, order.field.postalCode,
order.field.landmark, order.field.signedCopy, order.field.signedCopyFee, order.field.dedication,
order.field.dedicationHint, order.field.optional,
order.geo.button, order.geo.locating, order.geo.saved, order.geo.accuracy, order.geo.viewMap,
order.geo.remove, order.geo.denied, order.geo.unavailable, order.geo.timeout,
order.summary.subtotal, order.summary.bundle, order.summary.signed, order.summary.delivery,
order.summary.total, order.summary.items,
order.payment.title, order.payment.instructions, order.payment.warning, order.payment.bankName,
order.payment.branch, order.payment.accountName, order.payment.accountNumber, order.payment.amount,
order.payment.reference,
order.slip.title, order.slip.choose, order.slip.replace, order.slip.hint, order.slip.tooLarge,
order.slip.wrongType, order.slip.compressing, order.slip.ready, order.slip.required,
order.review.title, order.review.edit, order.review.consent, order.review.submit, order.review.submitting,
order.draft.restored, order.draft.startOver, order.draft.confirmClear, order.draft.slipNotSaved,
order.error.required, order.error.name, order.error.mobile, order.error.whatsapp, order.error.email,
order.error.postalCode, order.error.district, order.error.outOfStock, order.error.unavailable,
order.error.rateLimited, order.error.slipInvalid, order.error.submit,

success.title, success.thanks, success.orderId, success.next.title, success.next.verify,
success.next.message, success.next.dispatch, success.whatsapp, success.waMessage, success.downloadJpg,
success.downloadPdf, success.generating, success.track, success.noReceipt, success.totalChanged,
receipt.title, receipt.orderId, receipt.date, receipt.items, receipt.qty, receipt.total, receipt.phone,
receipt.status, receipt.scan, receipt.thanks,

track.title, track.intro, track.orderId, track.last4, track.submit, track.notFound, track.locked,
track.timeline, track.courier, track.trackingNo, track.courierLink, track.myOrders, track.myOrders.none,
track.myOrders.track, track.myOrders.remove,
status.pending_verification, status.acknowledged, status.payment_verified, status.dispatched,
status.delivered, status.rejected, status.cancelled,
status.desc.pending_verification, status.desc.acknowledged, status.desc.payment_verified,
status.desc.dispatched, status.desc.delivered, status.desc.rejected, status.desc.cancelled,

newsletter.email, newsletter.consent, newsletter.submit, newsletter.done, newsletter.unsub.title,
newsletter.unsub.done, review.name, review.rating, review.text, review.submit, review.done,
review.moderated, bulk.title, bulk.intro, bulk.kind, bulk.kind.school, bulk.kind.library,
bulk.kind.university, bulk.kind.bookshop, bulk.kind.other, bulk.organisation, bulk.contactName,
bulk.phone, bulk.email, bulk.books, bulk.message, bulk.consent, bulk.submit, bulk.done,
form.error.required, form.error.email, form.error.phone, form.error.rateLimited, form.error.generic,

offline.title, offline.body, notFound.title, notFound.body, notFound.home,
consent.pixel.text, consent.pixel.accept, consent.pixel.decline,

admin.title, admin.signIn, admin.signOut, admin.notAuthorised, admin.checkAgain, admin.nav.dashboard,
admin.nav.orders, admin.nav.books, admin.nav.settings, admin.nav.reviews, admin.nav.subscribers,
admin.nav.alerts, admin.nav.enquiries, admin.nav.maintenance,
admin.dash.today, admin.dash.revenueMonth, admin.dash.byStatus, admin.dash.lowStock,
admin.dash.pendingReviews, admin.dash.enquiries, admin.dash.failures,
admin.orders.search, admin.orders.filter.status, admin.orders.filter.book, admin.orders.filter.from,
admin.orders.filter.to, admin.orders.filter.all, admin.orders.loadMore, admin.orders.none,
admin.orders.selected, admin.orders.exportCsv, admin.orders.printLabels, admin.orders.mismatch,
admin.order.customer, admin.order.address, admin.order.map, admin.order.items, admin.order.slip,
admin.order.viewSlip, admin.order.openPdf, admin.order.timeline, admin.order.audit, admin.order.notes,
admin.order.addNote, admin.order.dedication, admin.order.signed, admin.order.anonymised,
admin.action.acknowledge, admin.action.verify, admin.action.dispatch, admin.action.deliver,
admin.action.reject, admin.action.cancel, admin.action.reopen, admin.action.sendWhatsapp,
admin.action.resend, admin.action.confirm, admin.field.courier, admin.field.courierOther,
admin.field.trackingNo, admin.field.reason, admin.error.transition, admin.error.missing,
admin.print.sheet, admin.print.single, admin.print.packingSlip, admin.print.print,
admin.books.price, admin.books.stock, admin.books.saleMode, admin.books.mode.direct,
admin.books.mode.external, admin.books.mode.unavailable, admin.books.externalUrl, admin.books.inStock,
admin.books.preorder, admin.books.preorderNote, admin.books.signed, admin.save, admin.saved,
admin.settings.orders, admin.settings.ordersOpen, admin.settings.notice, admin.settings.bank,
admin.settings.instructions, admin.settings.delivery, admin.settings.defaultFee,
admin.settings.perExtraCopy, admin.settings.estimateDays, admin.settings.contact,
admin.settings.whatsappNumber, admin.settings.orderPhone, admin.settings.facebookUrl,
admin.settings.social, admin.settings.reels, admin.settings.videos, admin.settings.story,
admin.settings.bundle, admin.settings.signedCopy, admin.settings.couriers, admin.settings.templates,
admin.settings.templateVars, admin.settings.preview, admin.settings.notifications,
admin.settings.lowStock, admin.settings.retention,
admin.reviews.approve, admin.reviews.reject, admin.reviews.unpublish, admin.subs.export,
admin.alerts.markNotified, admin.enquiries.markHandled, admin.maint.preview, admin.maint.run,
admin.maint.confirm, admin.maint.result
```

---

## 16. Test matrix

All tests run against project `demo-ajith`. Nothing contacts Google.

### 16.1 Unit tests (Vitest, no emulator)

| File | Covers |
|---|---|
| `functions/src/shared/phone.test.ts` | every accepted input form, rejected inputs, WhatsApp international numbers, masking |
| `functions/src/shared/pricing.test.ts` | single and multiple books, bundle threshold and rounding, signed surcharge on and off, per-district and default delivery fee, extra-copy fee, `isOrderable` for each sale mode, zero price, pre-order |
| `functions/src/shared/status.test.ts` | every pair of statuses against the table in §10.3 (49 cases), required fields, stock release and reserve flags, template keys |
| `functions/src/shared/templates.test.ts` | variable substitution, unknown variables, `wa.me` encoding of Sinhala and emoji, Maps and tracking URLs |
| `functions/src/shared/schemas.test.ts` | valid and invalid payloads for each callable schema |
| `functions/src/shared/csv.test.ts` | quoting, BOM, formula-injection guard |
| `functions/src/lib/orderId.test.ts` | format, alphabet, Asia/Colombo month boundary |
| `functions/src/lib/slip.test.ts` | magic-byte detection for the four types, mismatch, oversize |
| `functions/src/lib/log.test.ts` | redaction of emails and digit runs |
| `functions/src/notify/notify.test.ts` | with fake senders and an in-memory log: which sends each event produces; a second run with the same event ID sends nothing; a failed send is logged to failures and retried alone; Telegram skipped when a secret is `disabled`; WhatsApp Cloud skipped when the flag is off |
| `functions/src/notify/whatsappCloud.test.ts` | request URL, headers and body with mocked `fetch`; error response handling |
| `functions/src/notify/telegram.test.ts` | request shape; no personal data in the text |
| `functions/src/notify/emailTemplates.test.ts` | both languages render; customer emails carry no attachment |
| `site/src/lib/publicData.test.ts` | Firestore REST decoder |
| `site/src/lib/paths.test.ts` | base path and language prefix combinations |
| `site/src/lib/draft.test.ts` | save, load, version mismatch, clear (with a storage stub) |
| `site/src/lib/readingTime.test.ts` | word counting for Sinhala and English |
| `site/src/i18n/i18n.test.ts` | both dictionaries have identical key sets and no empty values |

### 16.2 Rules tests (`tests/rules/`, `@firebase/rules-unit-testing`)

Each row is checked for three identities: anonymous, signed-in without the claim, signed-in with `admin: true`.

| Path | Read | Write |
|---|---|---|
| `books/x`, `books/x/reviews/y`, `config/public` | all three allowed | all three denied |
| `config/private`, `orders/x`, `orders/x/audit/y`, `newsletter_subscribers/x`, `stock_alerts/x`, `enquiries/x`, `review_submissions/x`, `notification_failures/x`, `dev_outbox/x` | admin only | all three denied |
| `rate_limits/x`, `notification_log/x`, `anything/else` | all three denied | all three denied |
| Storage `slips/AJ-2611-7K3Q/slip.jpg`, `other/file` | all three denied | all three denied |

Also: a list query on `orders` by a non-admin is denied; an admin token with `admin: false` is denied.

### 16.3 Function integration tests (`tests/functions/`, emulators running)

`tests/helpers/emulator.ts` provides `resetAll()` (clears Firestore, Auth and Storage through the emulator REST endpoints, then seeds fixtures), `call(name, data, { idToken?, appCheck? })` (HTTP POST to `http://127.0.0.1:5001/demo-ajith/asia-south1/<name>`), `adminToken()` and `userToken()` (create users with the Admin SDK, set the claim, sign in through the Auth emulator REST API), and `waitForOutbox(predicate)`.

| File | Cases |
|---|---|
| `createOrder.test.ts` | happy path (order document, slip object, stock decremented, audit event, output shape); totals recomputed when the client sends a wrong `expectedTotalLKR` (`totalMismatch`); unknown book; `external` and `unavailable` books; zero-price book; out of stock; pre-order with zero stock accepted; orders closed; empty bank details; oversize slip; wrong magic bytes; invalid phone; missing consent; no App Check header rejected; a 4.5 MB PDF accepted |
| `rateLimit.test.ts` | fourth order from one phone in an hour rejected; `trackOrder` lockout after 5 wrong attempts; stored keys contain no phone number or IP |
| `trackOrder.test.ts` | correct digits return status, timeline, courier, tracking number and nothing else (assert the exact key set); wrong digits and unknown ID give identical errors |
| `updateOrderStatus.test.ts` | full path to `delivered`; every invalid transition rejected; dispatch without courier or tracking number rejected; reject without reason rejected; reject and cancel return stock; reopen re-reserves stock; `waUrl` matches the rendered template in the order's language; non-admin and anonymous callers rejected; audit event records the admin |
| `notifications.test.ts` | new order produces a team email (with slip attachment metadata) and a customer email in `dev_outbox`; no customer email when none was given; verified, dispatched and rejected produce customer emails in the right language; writing the same audit event twice produces no duplicate; Telegram entry present with no name, phone or address |
| `admin.test.ts` | `getSlipUrl` returns a usable URL for admins only and writes a `slip_view` event; `addOrderNote`; `updateSettings` accepts valid input and rejects unknown keys, `http:` URLs and bad district keys; `updateBook` validation and back-in-stock emails; `moderateReview` publishes and unpublishes; `adminUpdateRecord`; `anonymiseOldOrders` dry run, real run (fields cleared, slip deleted, tracking still works) |
| `engagement.test.ts` | newsletter subscribe is idempotent and unsubscribe works; stock alert needs a contact; enquiry stored and team email queued; review stored as pending; rate limit at the sixth call |

### 16.4 Playwright E2E (`tests/e2e/`)

Projects: `mobile` (Pixel 7 device descriptor) and `desktop` (1280 × 800). Both Chromium. `workers: 1`. The site under test is the emulator-mode build served by `astro preview` at `http://127.0.0.1:4321/booksbyajith/`, so the base path and the CSP are exercised. Each spec calls `resetAll()` in `beforeEach`. Service workers are blocked except in `pwa.spec.ts`.

| Spec | Brief § 8 item | Asserts |
|---|---|---|
| `order.spec.ts` | 1 | two books, all fields, slip upload, submit, success page shows a valid order ID and the right total; the order exists in Firestore with the slip in Storage; the draft is cleared; "My orders" has the entry |
| `draft.spec.ts` | 2 | fill every field and attach a slip, reload on step 3: every field, the step, the cart and the slip preview are restored and the banner shows; "Start over" clears everything; reload again shows an empty form |
| `geolocation.spec.ts` | 3 | with permission granted and coordinates mocked, the Maps link has `?q=6.9271,79.8612` and the stored order has `geo`; with permission denied, the message shows and the order can still be placed |
| `receipt.spec.ts` | 4 | see §16.4.1 |
| `track.spec.ts` | 5 | correct digits show the timeline; wrong digits show the not-found message; the page shows no name, address or full phone number; prefilled from the fragment and from "My orders" |
| `admin.spec.ts` | 6 | admin signs in, opens the new order, views the slip, then acknowledge → verify → dispatch (courier and tracking number). After each step the `wa-link` href starts with `https://wa.me/<customer number>?text=` and decodes to the expected template text in the customer's language. `dev_outbox` holds the team email, the confirmation, the verified email and the dispatched email. The tracking page then shows the courier and tracking number |
| `admin-blocked.spec.ts` | 7 | a signed-in user without the claim sees "Not authorised", no order data is rendered, and a direct Firestore read from the page context is denied; a signed-out visitor sees only the sign-in button |
| `home.spec.ts` | — | slideshow has one slide per book; next, previous and dots work; autoplay advances and stops on hover and on pause; with reduced motion it does not advance; featured "Order now" reaches the order page with the book in the cart |
| `site.spec.ts` | — | every route in `routes.ts` returns 200 in both languages with one `h1`, correct `lang`, a canonical link, `og:image` resolving to 200, and no console errors or CSP violations; language toggle maps each page to its counterpart; book pages have valid `Book` JSON-LD; `rss.xml`, `sitemap.xml`, `robots.txt` and the manifest are well formed; unknown path shows the 404 page |
| `forms.spec.ts` | — | newsletter, notify-me, enquiry and review forms submit and store documents; honeypot blocks |
| `admin-tools.spec.ts` | — | settings edit changes the bank details on the order page; book price edit changes the order total; CSV export downloads with the BOM and the right rows; print view renders 8 labels per sheet; review approval makes the review appear on the book page |
| `a11y.spec.ts` | — | axe (`wcag2a`, `wcag2aa`) finds no violations on Home, a book page, each order step, Track and the admin order page |
| `pwa.spec.ts` | — | the service worker registers; with the network offline, navigating to an uncached page shows the offline page |
| `no-pii.spec.ts` | — | during a full order and a tracking lookup, no request URL, query string or console message contains the test name, phone number, email or address; the only place they travel is the `createOrder` request body |

#### 16.4.1 Receipt test in detail

The test must be able to fail when Sinhala is rendered as boxes or in a fallback font, so a whole-image comparison alone is not enough.

1. Use a dedicated context: viewport 900 × 1400, `deviceScaleFactor: 2`, locale `si`. Place a Sinhala order for book 1 and reach the success page.
2. Assert `document.fonts.check('16px "Noto Sans Sinhala"', 'ලංකාවේ')` and the same for the serif face.
3. Download the JPG. Assert it is a JPEG 1440 px wide.
4. Move the receipt element on-screen through the CSSOM (`el.style.position = 'static'`; an injected `<style>` tag would be blocked by the CSP) and take an element screenshot. This is the reference: real browser text shaping.
5. Whole image: scale both to the same size with sharp, convert to greyscale, and assert a mean absolute difference below 6 %.
6. Sinhala title: crop both images to the bounding box of the book-title element (`data-testid="receipt-title"`), blur by 1 px, threshold at 128, and compute the intersection-over-union of dark pixels. Assert it is at least 0.5.
7. Negative control: set the title's `fontFamily` to `monospace` through the CSSOM, take another screenshot, and assert its intersection-over-union against the JPG crop is at least 0.15 lower than the value from step 6.
8. Download the PDF. Assert it starts with `%PDF-`, contains `/DCTDecode`, and contains no `/Font` entry. Extract the image stream between `stream` and `endstream` of the image object, decode it with sharp, and repeat steps 5 and 6 on it.
9. Assert the QR image is present, is not blank, and its `data-qr-url` equals the expected tracking URL with the order ID in the fragment.

### 16.5 Lighthouse CI (`tests/lighthouserc.cjs`)

URLs: Home, `/books/portuguese-era-1505-1594/`, `/order/` (Sinhala). Mobile emulation (the default), 3 runs each. Assertions: `categories:performance`, `categories:accessibility`, `categories:best-practices`, `categories:seo` each `minScore: 0.9`, aggregation `median-run`. Chrome path from `node -e "console.log(require('playwright').chromium.executablePath())"`, flags `--headless=new --no-sandbox`. `scripts/lhci.mjs` starts `astro preview`, waits for it, runs `lhci autorun`, and stops it.

### 16.6 Static checks

- `scripts/check-links.mjs`: every `href` and `src` in `site/dist` that is internal starts with the base path and resolves to a file.
- `scripts/check-prod-bundle.mjs`: the production-mode build contains none of `emulator-signin`, `127.0.0.1`, `demo-ajith`, `signInWithEmailAndPassword`.
- `scripts/scan.mjs` per D-22 and §14.6, run over the tracked files and over `site/dist`.

---

## 17. CI/CD

Use the current major version of each action. Known-good majors: `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`, `actions/setup-java@v4`, `actions/cache@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`, `google-github-actions/auth@v2`, `gitleaks/gitleaks-action@v2`, `actions/upload-artifact@v4`.

Common setup in every job: checkout, `pnpm/action-setup` (reads `packageManager`), `setup-node` with `node-version-file: .node-version` and `cache: pnpm`, `pnpm install --frozen-lockfile`. Jobs that run emulators add `setup-java` (Temurin 21) and cache `~/.cache/firebase/emulators`. Jobs that run a browser add `pnpm --filter tests exec playwright install --with-deps chromium`.

### `ci.yml` — on `pull_request`, and on `push` to branches other than `main`

| Job | Commands |
|---|---|
| `static` | `pnpm lint`, `pnpm typecheck`, `pnpm scan`, `pnpm test:unit`, `pnpm audit --prod --audit-level high` |
| `secrets` | `gitleaks/gitleaks-action` with `fetch-depth: 0` and `.gitleaks.toml` |
| `emulator-tests` | `pnpm test:rules`, `pnpm test:functions` |
| `e2e` | `pnpm test:e2e`, `pnpm check:links`, `pnpm check:prod`; uploads `playwright-report` on failure |
| `lighthouse` | `pnpm test:lhci`; uploads `.lighthouseci` |

### `deploy-pages.yml` — on `push` to `main`, plus `workflow_dispatch`

Permissions `pages: write`, `id-token: write`, `contents: read`. Concurrency group `pages`. Steps: common setup, `actions/configure-pages` (id `pages`), `pnpm build` with `SITE_URL: ${{ vars.SITE_URL || steps.pages.outputs.base_url }}`, `PUBLIC_USE_EMULATORS: 'false'` and every other `PUBLIC_*` value from `vars`, then `pnpm check:links`, `pnpm scan`, upload `site/dist`, deploy. The build fails with a clear message when a required `PUBLIC_FIREBASE_*` variable is missing (from `env.ts`).

### `deploy-firebase.yml` — `workflow_dispatch` only

Inputs: three booleans, `rules`, `indexes`, `functions`, all default true. Steps: common setup, `google-github-actions/auth` with `credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}`, write `functions/.env` from `vars.SITE_URL`, `vars.ALLOWED_ORIGINS` and `vars.STORAGE_BUCKET`, build the `--only` list from the inputs (`firestore:rules,storage` / `firestore:indexes` / `functions`), then `pnpm exec firebase deploy --only <list> --project ${{ vars.FIREBASE_PROJECT_ID }} --non-interactive --force`.

---

## 18. Phases

Each phase ends with a commit. Do not start a phase until the previous one's "Must pass" list is green. Write the tests named in a phase during that phase.

### Phase 0 — Repository bootstrap

**Files:** root `package.json`, `pnpm-workspace.yaml`, `.node-version`, `.gitignore`, `.prettierrc.json`, `eslint.config.mjs`, `tsconfig.base.json`, `.env.example`, `.env.emulator`, `.gitleaks.toml`, `firebase.json`, `.firebaserc`, `firebase/firestore.rules` and `firebase/storage.rules` (deny-all for now), `firebase/firestore.indexes.json` (empty arrays), `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts` (one `ping` callable), `functions/.secret.local.example`, `functions/.env.demo-ajith`, `functions/.env.example`, `site/package.json` (name only), `tests/package.json`, `scripts/scan.mjs`.

**Details**

- `functions/tsconfig.json`: `module` and `moduleResolution` `NodeNext`, `target` `ES2023`, `strict`, `outDir` `lib`, `rootDir` `src`, tests excluded. It must not extend a file outside `/functions` (D-05). `functions/package.json`: `"type": "module"`, `"main": "lib/index.js"`, `"engines": { "node": "24" }`, scripts `build` (`tsc`), `watch`, `test`, `"gcp-build": ""`.
- `eslint.config.mjs`: `typescript-eslint` recommended for `**/*.{ts,tsx,mjs}`; ignore `dist`, `lib`, `.astro`, `_gen`. Add `no-console` as an error inside `functions/src` (use the logger) and inside `site/src`.
- `.gitleaks.toml`: extend the default rules; allowlist the paths `.env.emulator`, `.env.example`, `functions/.secret.local.example` and the regex `demo-[a-z-]+`.
- `scripts/scan.mjs`: scans `git ls-files` output plus any directory given as an argument. Rules per D-22 and §14.6. Allowlist for phone patterns: `tests/**`, `functions/src/**/*.test.ts`, `PLAN.md`. Allowlist for the keyword guard: `PLAN.md` and `scripts/scan.mjs` only, so `README.md` and `MANUAL_SETUP.md` must not use those words either. Prints file, line and rule for each hit and exits 1.

**Must pass:** `pnpm install`, `pnpm lint`, `pnpm scan`, `pnpm --filter functions build`, and `pnpm exec firebase emulators:exec --only auth,firestore,storage,functions --project demo-ajith "curl -sf -X POST -H 'Content-Type: application/json' -d '{\"data\":{}}' http://127.0.0.1:5001/demo-ajith/asia-south1/ping"`.

**Acceptance:** `pnpm exec node -v` prints `v24.22.3`. The ping call returns `{"result":{"ok":true}}`. No file contains a real email, phone number or key.

**Commit:** `chore: bootstrap workspace, toolchain and Firebase emulator config`

### Phase 1 — Shared domain library

**Files:** everything in `functions/src/shared/` (§10) and its tests, `functions/vitest.config.ts`.

**Must pass:** `pnpm --filter functions test`, `pnpm --filter functions build`, `pnpm lint`.

**Acceptance:** all §16.1 tests for `shared/` pass. `shared/` imports nothing except `zod`.

**Commit:** `feat(shared): phone, pricing, status machine, templates, schemas and CSV helpers`

### Phase 2 — Security rules and indexes

**Files:** `firebase/firestore.rules`, `firebase/storage.rules`, `firebase/firestore.indexes.json` (§12), `tests/vitest.rules.config.ts`, `tests/rules/firestore.test.ts`, `tests/rules/storage.test.ts`, `tests/tsconfig.json`.

**Must pass:** `pnpm test:rules`.

**Acceptance:** every cell of the §16.2 table is asserted. Rule files match §12 exactly.

**Commit:** `feat(firebase): default-deny Firestore and Storage rules with tests, indexes and TTL`

### Phase 3 — Core order functions, seed script, test helpers

**Files:** `functions/src/options.ts`, `functions/src/lib/*`, `functions/src/callables/createOrder.ts`, `trackOrder.ts`, updated `index.ts` (remove `ping`), `scripts/seed.mjs`, `scripts/ensure-local-env.mjs`, `tests/helpers/emulator.ts`, `tests/helpers/fixtures.json`, `tests/helpers/files/` (a small JPG, PNG, WebP and PDF, and a generator for a 4.5 MB PDF), `tests/vitest.functions.config.ts`, `tests/functions/createOrder.test.ts`, `rateLimit.test.ts`, `trackOrder.test.ts`, minimal `site/src/content/books/*/book.yaml` for the three books (the seed reads them).

**Details**

- `scripts/seed.mjs` flags: `--emulator` (sets `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` and project `demo-ajith`), `--fixtures` (after the defaults, applies `tests/helpers/fixtures.json`, overwriting: fake bank details, delivery fees, couriers, bundle and surcharge settings, test contact numbers, and book overrides so that book 2 is direct at Rs. 2,500 with stock 10 and book 3 is direct at Rs. 1,800 with stock 0), `--project <id>` (production, uses Application Default Credentials). Without `--fixtures` it writes `books/*` from `book.yaml` defaults and `config/public` and `config/private` with empty business fields and the default templates. Without `--fixtures` it only creates documents that do not exist and never overwrites.
- Fixture phone numbers are obviously fake (for example `94770000001`).
- First task of this phase: confirm the 4.5 MB PDF upload passes through the emulator (the emulator's body limit is 32 MB).

**Must pass:** `pnpm test:unit`, `pnpm test:functions`, `pnpm lint`, `pnpm scan`.

**Acceptance:** the three test files cover every case listed in §16.3 for them. A grep of the functions emulator log during the tests finds no fixture name, phone number, email or address.

**Commit:** `feat(functions): createOrder and trackOrder with validation, stock, rate limiting and seed data`

### Phase 4 — Admin functions

**Files:** `functions/src/callables/updateOrderStatus.ts`, `addOrderNote.ts`, `getSlipUrl.ts`, `updateSettings.ts`, `updateBook.ts`, `moderateReview.ts`, `adminUpdateRecord.ts`, `anonymiseOldOrders.ts`, `scripts/grant-admin.mjs`, `tests/functions/updateOrderStatus.test.ts`, `admin.test.ts`.

**Details**

- `scripts/grant-admin.mjs <email> [--project <id>] [--emulator] [--revoke]`: looks the user up by email, sets or removes the `admin` claim, revokes refresh tokens, prints the UID. If the user does not exist it exits 1 with the message "Ask this person to sign in once at /admin, then run this again." It stores nothing.
- `updateBook`'s back-in-stock emails need the notifier from Phase 5. In this phase leave a single call to `notifyBackInStock()` that is implemented in Phase 5, and skip that one test until then.

**Must pass:** `pnpm test:functions`, `pnpm test:unit`, `pnpm lint`.

**Acceptance:** all §16.3 cases for the two files pass except the back-in-stock email case. `grant-admin.mjs --emulator` grants and revokes the claim (covered by the test helper using the same code path).

**Commit:** `feat(functions): admin callables for status workflow, settings, books, reviews and retention`

### Phase 5 — Notifications

**Files:** `functions/src/notify/*`, `functions/src/triggers/onOrderAudit.ts`, their unit tests, `tests/functions/notifications.test.ts`, the back-in-stock case in `admin.test.ts`.

**Must pass:** `pnpm test:unit`, `pnpm test:functions`.

**Acceptance:** all §16.1 notify tests and §16.3 notification cases pass. In emulator mode no code path opens an SMTP connection or calls `fetch` to Telegram or Meta (asserted by the unit tests with spies).

**Commit:** `feat(functions): idempotent email, Telegram and WhatsApp Cloud notifications with dev outbox`

### Phase 6 — Engagement functions

**Files:** `functions/src/callables/subscribeNewsletter.ts`, `unsubscribeNewsletter.ts`, `requestStockAlert.ts`, `submitEnquiry.ts`, `submitReview.ts`, `tests/functions/engagement.test.ts`.

**Must pass:** `pnpm test:functions`, `pnpm test:unit`, `pnpm typecheck` (functions and tests), `pnpm lint`, `pnpm scan`.

**Acceptance:** `functions/src/index.ts` exports exactly the 15 callables and 1 trigger of §11. All §16.3 tests pass.

**Commit:** `feat(functions): newsletter, stock alerts, enquiries and moderated reviews`

### Phase 7 — Site scaffold

**Files:** `site/package.json`, `astro.config.ts`, `tsconfig.json` (with the `@shared/*` alias, mirrored in `vite.resolve.alias`), `src/styles/global.css`, `src/lib/env.ts`, `paths.ts`, `routes.ts`, `csp.ts`, `seo.ts`, `publicData.ts`, `src/i18n/*`, `src/layouts/BaseLayout.astro`, `src/components/Header.astro`, `Footer.astro`, `Seo.astro`, `LangToggle.astro`, `Cover.astro`, `src/content.config.ts`, `src/views/HomeView.astro` (stub), `src/pages/[...lang]/index.astro`, `src/pages/404.astro`, `sitemap.xml.ts`, `robots.txt.ts`, `scripts/make-placeholders.mjs`, `scripts/build-images.mjs`, `scripts/build-og.mjs`, `scripts/check-links.mjs`, `scripts/dev.mjs`, placeholder images, favicon set, `tests/playwright.config.ts`, a first `tests/e2e/site.spec.ts`.

**Details**

- Step 1 is a spike: create `src/pages/[...lang]/index.astro` with `getStaticPaths` returning `{ params: { lang: undefined } }` and `{ params: { lang: 'en' } }`, build, and confirm `dist/index.html` and `dist/en/index.html` exist. If it fails, apply fallback R1 now.
- `astro.config.ts`: `output: 'static'`, `site` and `base` from `SITE_URL` (D-08), `trailingSlash: 'always'`, `integrations: [preact(), mdx()]`, `vite.plugins: [tailwindcss()]`, `security.csp` (§14.9), `build.inlineStylesheets: 'auto'`.
- `scripts/make-placeholders.mjs` (run once, output committed): uses sharp to draw each placeholder as a flat coloured rectangle with the file's purpose written on it. Covers 1200 × 1800 JPG. Files per book: `<slug>-front.jpg`, `<slug>-back.jpg`, `<slug>-inner-1.jpg`, `<slug>-inner-2.jpg`, and `samples/<slug>/page-01.jpg` to `page-03.jpg`. Also `author/author-portrait.jpg` (1200 × 1500) and the icon set (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`).
- `site` scripts: `prebuild` runs `build-images` and `build-og`; `build` runs `astro build`; `preview` runs `astro preview --host 127.0.0.1 --port 4321`.
- `playwright.config.ts`: the two projects, `baseURL` `http://127.0.0.1:4321/booksbyajith/`, `webServer` running `pnpm --filter site preview` with `reuseExistingServer: false`, `workers: 1`.

**Must pass:** `pnpm build:emu`, `pnpm check:links`, `pnpm typecheck`, `pnpm lint`, `pnpm scan site/dist`, `pnpm test:unit`, `pnpm test:e2e` (the first spec).

**Acceptance:** both language home pages build under the base path with header, footer, language toggle, CSP meta, canonical and alternates. Sinhala text renders in the bundled fonts (the built CSS references local font files only; no request leaves `127.0.0.1`). `sitemap.xml` and `robots.txt` exist.

**Commit:** `feat(site): Astro scaffold with bilingual routing, design system, SEO, CSP and placeholders`

### Phase 8 — Content and public pages

**Files:** all content in §8, every view and route in §7 except Home, Order, Success, Track and Admin, components `BookCard`, `Gallery`, `SpecList`, `ShareButtons`, `PostCard`, `EventCard`, `PressItem`, `Testimonial`, `FaqList`, `Prose`, `ConfigLink`, the RSS endpoints, `src/lib/readingTime.ts`, extended `site.spec.ts`.

**Details**

- The gallery and "look inside" viewer is a native `<dialog>` lightbox with previous and next buttons, keyboard support and focus return.
- Book pages fetch live price and stock (§14.3) and render the order button (`/order/?book=<slug>`), the external link, or the unavailable state with the notify-me form (form wiring arrives in Phase 11; render the container now).
- The contact page builds its WhatsApp and phone links from `config/public` at run time.
- Press kit: short bio, long bio, book fact sheets, and download links to the cover and portrait files.

**Must pass:** `pnpm build:emu`, `pnpm check:links`, `pnpm typecheck`, `pnpm scan site/dist`, `pnpm test:e2e`.

**Acceptance:** every route in `routes.ts` passes the `site.spec.ts` checks in both languages. The launch news post links to the press article. Each book and post has its own `og:image`, title and description. RSS feeds validate. No page mentions a clinic.

**Commit:** `feat(site): books, blog, news, press, events, press kit, about, FAQ, contact and legal pages`

### Phase 9 — Home page

**Files:** `src/views/HomeView.astro`, `src/components/Slideshow.astro`, `FeaturedBook.astro`, `LatestPosts.astro`, `AuthorIntro.astro`, `StoryOfWeek.astro`, `Reels.astro`, `tests/e2e/home.spec.ts`.

**Must pass:** `pnpm build:emu`, `pnpm test:e2e`, `pnpm check:links`.

**Acceptance:** `home.spec.ts` passes on both viewports. The reels and story sections stay hidden when the config has no URLs and load no Facebook resource until a card is clicked.

**Commit:** `feat(site): home page with accessible cover slideshow, featured book and social sections`

### Phase 10 — Order flow, success page and receipt

**Files:** `src/lib/firebase.ts`, `draft.ts`, `slipStore.ts`, `myOrders.ts`, `geo.ts`, `imageCompress.ts`, `receipt.ts`, `src/islands/order/*`, `src/views/OrderView.astro`, `OrderSuccessView.astro`, their routes, `tests/e2e/order.spec.ts`, `draft.spec.ts`, `geolocation.spec.ts`, `receipt.spec.ts`, `no-pii.spec.ts`.

**Must pass:** `pnpm test:unit`, `pnpm build:emu`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`.

**Acceptance:** §8 items 1 to 4 of the brief pass on both viewports. The receipt JPG and PDF show correctly shaped Sinhala. The order page loads no Firebase or reCAPTCHA script until the customer submits.

**Commit:** `feat(site): order flow with draft persistence, geolocation, slip upload and JPG/PDF receipts`

### Phase 11 — Tracking and forms

**Files:** `src/islands/track/*`, `src/islands/forms/*`, `src/views/TrackView.astro`, `BulkOrdersView.astro`, `UnsubscribeView.astro`, their routes, form placements (newsletter on Home and footer, notify-me and review on book pages), reader reviews list on book pages (REST read of `books/{slug}/reviews`), `tests/e2e/track.spec.ts`, `forms.spec.ts`.

**Must pass:** `pnpm build:emu`, `pnpm test:e2e`, `pnpm typecheck`.

**Acceptance:** §8 item 5 of the brief passes. The four forms store documents through callables.

**Commit:** `feat(site): order tracking, newsletter, stock alerts, bulk enquiries and reader reviews`

### Phase 12 — Admin panel

**Files:** `src/layouts/AdminLayout.astro`, `src/pages/admin/index.astro`, `src/islands/admin/*` (§14.8), `scripts/check-prod-bundle.mjs`, `tests/e2e/admin.spec.ts`, `admin-blocked.spec.ts`, `admin-tools.spec.ts`.

**Must pass:** `pnpm build:emu`, `pnpm test:e2e`, `pnpm check:prod`, `pnpm typecheck`, `pnpm lint`.

**Acceptance:** §8 items 6 and 7 of the brief pass on both viewports. Every admin screen is usable at 360 px width. No admin email appears in the source or the build.

**Commit:** `feat(admin): order management, one-click WhatsApp workflow, settings, exports and labels`

### Phase 13 — PWA, analytics, accessibility and performance

**Files:** `src/pages/manifest.webmanifest.ts`, `sw.js.ts`, `src/views/OfflineView.astro`, `src/lib/analytics.ts`, `src/components/PixelConsent.astro`, `tests/lighthouserc.cjs`, `scripts/lhci.mjs`, `tests/e2e/a11y.spec.ts`, `pwa.spec.ts`.

**Must pass:** `pnpm test:e2e`, `pnpm test:lhci`.

**Acceptance:** Lighthouse mobile scores are at least 90 in all four categories on the three URLs. axe finds no violations. With analytics configured in a test build, the only request is to the configured endpoint and it carries a pathname with no query string or fragment.

**Commit:** `feat(site): PWA basics, cookieless analytics, accessibility and Lighthouse budget`

### Phase 14 — CI/CD

**Files:** `.github/workflows/ci.yml`, `deploy-pages.yml`, `deploy-firebase.yml` (§17).

**Must pass:** `pnpm test` (the full local chain), and a YAML parse of the three files (`node -e` with the `yaml` package).

**Acceptance:** each workflow uses only repository `vars` and `secrets`, never literal project IDs, emails or keys. `deploy-firebase.yml` has no `push` trigger.

**Commit:** `ci: PR checks on emulators, GitHub Pages deploy and manual Firebase deploy`

### Phase 15 — Documentation and final audit

**Files:** `README.md`, `MANUAL_SETUP.md` (§19), `scripts/set-secrets.mjs`, updates to this file's Decisions if any were added.

**Details**

- `README.md`: what the project is, prerequisites (Node via pnpm, Java 21), `pnpm install`, `pnpm dev`, the emulator workflow and UI, every test command, how to add a blog post, a news post, an event, a press item and a book (content files plus the seed or admin step), how to replace covers, how to change message templates (admin Settings, and the defaults in the seed), how to add an i18n key, the data model summary, the security model, troubleshooting.
- `scripts/set-secrets.mjs --project <id>`: prompts for each secret in §6.3 (hidden input), generates `HASH_SALT`, writes `disabled` for skipped optional secrets, and pipes each value to `firebase functions:secrets:set <NAME> --data-file -`. It never prints or stores a value.
- Final audit: run `pnpm test`, `pnpm test:lhci`, `pnpm check:prod`, `pnpm scan site/dist`, then walk the Definition of Done (§21) and tick each line in the commit body.

**Must pass:** everything in the final audit.

**Commit:** `docs: README, manual setup checklist and final audit`

---

## 19. `MANUAL_SETUP.md` outline

The only place manual steps appear. Each step has: what to do (exact clicks or one command), and the expected result. Order:

1. **Before you start**: what you need (a Google account for Firebase, a card for the Blaze plan, an SMTP account, about an hour). A table of every value you will collect and where it goes.
2. **Create the Firebase project** and upgrade to **Blaze**. Create a **budget alert** in Google Cloud Billing (suggested: USD 10 with alerts at 50 %, 90 %, 100 %).
3. **Create Firestore** in `asia-south1` (production mode) and **Storage** in `asia-south1`.
4. **Enable Google sign-in** in Authentication. Add the authorised domains (`<owner>.github.io`, later the custom domain).
5. **Register the web app** and copy the web config values.
6. **App Check**: create a reCAPTCHA v3 key for the site domains, register the web app in App Check with it, copy the site key. Enforce App Check for **Cloud Functions only**. Do not enforce it for Firestore (D-13).
7. **Service account for deploys**: create it with the roles Firebase Admin, Cloud Functions Admin, Cloud Run Admin, Service Account User, Secret Manager Admin, Cloud Datastore Index Admin, Firebase Rules Admin, Artifact Registry Administrator and Cloud Build Editor. Download the JSON key.
8. **Allow signed URLs**: grant the Functions runtime service account the "Service Account Token Creator" role on itself (one `gcloud` command, given in full). Expected result: slips open in the admin panel.
9. **GitHub repository settings**: Pages source = GitHub Actions. Add the variables (`FIREBASE_PROJECT_ID`, every `PUBLIC_*` from §6.1 with `PUBLIC_USE_EMULATORS=false`, `ALLOWED_ORIGINS`, `STORAGE_BUCKET`, optional `SITE_URL`). Add the secret `FIREBASE_SERVICE_ACCOUNT` (the JSON key).
10. **Set every secret**: run `pnpm exec node scripts/set-secrets.mjs --project <id>`. Lists each secret and what to enter.
11. **Deploy rules, indexes and functions**: run the "Deploy Firebase" workflow. Expected result: 15 callables and 1 trigger in `asia-south1`. Includes what to do if the first deploy asks to enable APIs (run it again).
12. **Seed production data**: `pnpm seed --project <id>`.
13. **Deploy the site**: push to `main` or run the Pages workflow. Open the site URL.
14. **Grant admins**: each admin signs in once at `/admin/` and sees "Not authorised". Run `pnpm exec node scripts/grant-admin.mjs <email> --project <id>` for each, then they press "Check again".
15. **Fill in Settings** in the admin panel: bank details, delivery fees, WhatsApp and order phone numbers, Facebook page URL, reel URLs, couriers, bundle and signed-copy options. Then set prices, stock and sale mode for each book, and switch "Orders open" on.
16. **Upload the real images**: the exact file names and sizes for covers, sample pages and the author portrait, and where each appears.
17. **Review the Sinhala text**: the UI dictionary file, the message templates in Settings, the About page placeholder paragraph, the privacy policy and terms.
18. **Optional: custom domain** (Pages settings, DNS records, set `SITE_URL`, add the domain to Auth authorised domains, the reCAPTCHA key and `ALLOWED_ORIGINS`, then redeploy functions and the site).
19. **Optional: Telegram alerts** (create a bot with BotFather, get the chat ID, set the two secrets, redeploy functions).
20. **Optional: WhatsApp Cloud API** (Meta business account, phone number ID, permanent token, four approved templates with the parameter order from §13, set secrets, enable the flag in Settings).
21. **Optional: analytics** (GoatCounter or Plausible account, set the three variables, redeploy the site).
22. **Live test order**: place a real order for one book with a test slip; check the team email and customer email; in admin acknowledge, verify, dispatch and deliver, sending each WhatsApp message to your own number; track the order; download both receipts; confirm the slip opens; reject and reopen a second test order; confirm stock numbers; then cancel the test orders.
23. **Troubleshooting**: Not authorised after granting (press "Check again" or sign out and in); `unauthenticated` on every callable (App Check key or domain mismatch); CORS errors (`ALLOWED_ORIGINS`); slip will not open (step 8); emails not arriving (check `notification_failures` on the dashboard); deploy says a secret is missing (step 10).

---

## 20. Risks and pre-authorised fallbacks

| # | If this happens | Do this |
|---|---|---|
| R1 | The `[...lang]` rest-parameter routes do not build under the base path | Keep Sinhala routes in `src/pages/` and add thin wrappers under `src/pages/en/` that import the same views. Record it in Decisions |
| R2 | The CSP blocks receipt rendering or island markup (a `style-src` violation in the E2E console check) | First remove the inline style at its source. If the violation comes from `html-to-image` itself, add the directive `style-src-attr 'unsafe-inline'`. Never add `'unsafe-inline'` to `script-src` |
| R3 | Astro's `security.csp` cannot express a needed directive | Write the same policy as a hand-built `<meta>` in `BaseLayout`, generating script hashes in an `astro:build:done` hook |
| R4 | Lighthouse performance is unstable around 0.9 on CI runners | Change the aggregation to `optimistic`. Do not lower the threshold. Then look for real savings (font preloads, image sizes, deferring islands) |
| R5 | The Functions emulator cannot resolve packages through pnpm's symlinks | Add `node-linker=hoisted` to `.npmrc` and reinstall |
| R6 | `getAggregateFromServer(sum(…))` is unavailable in the emulator or SDK | Compute the monthly revenue in the client from the month's orders query |
| R7 | `html-to-image` does not embed the Sinhala font (the pixel comparison fails with fallback glyphs) | Call `getFontEmbedCSS(node)` first and pass the result as `fontEmbedCSS`. If still wrong, inline the two WOFF2 files as base64 `@font-face` rules inside the receipt element |
| R8 | A library API differs from this plan (jsPDF 4, Vitest 5, zod 4, Preact integration) | Read the types and README in `node_modules` and adapt the call. Keep the behaviour the plan describes |
| R9 | `pnpm audit --prod` reports an advisory with no fixed version | Add it to `pnpm.auditConfig.ignoreGhsas` with a comment and list it in the README under "Known advisories" |
| R10 | gitleaks flags a placeholder | Add the narrowest path or regex allowlist entry to `.gitleaks.toml`. Never allowlist a whole directory of source |
| R11 | Ports are still in use after a crashed emulator run | Run `pnpm exec firebase emulators:exec` again after killing the listed PIDs. `scripts/dev.mjs` checks the ports first and names the process |
| R12 | The Auth emulator rejects the email and password sign-in used by tests | Enable it by creating the users with the Admin SDK with a password (already the plan). If the provider must be switched on, set it through the emulator config REST endpoint in `resetAll()` |
| R13 | Deploy fails because Cloud Build tries to compile TypeScript | Confirm `"gcp-build": ""` is present and `lib/` is uploaded (not in `functions.ignore`) |
| R14 | Firestore TTL field overrides are rejected by the emulator on load | Keep them in the file (they are valid for production) and ignore the emulator warning. Tests do not depend on TTL deletion |
| R15 | The receipt title overlap score (§16.4.1 step 6) is unstable between runs | Increase the blur to 2 px before lowering any threshold. The negative control in step 7 must keep failing for a wrong font |

Things that cannot be proven locally and are covered by the live test in `MANUAL_SETUP.md`: real reCAPTCHA App Check tokens, Google sign-in popup, signed URLs, SMTP delivery, Eventarc trigger delivery in `asia-south1`, GitHub Pages serving under the real base path.

---

## 21. Definition of Done

**Working rules**

- [ ] The whole build and every test ran on emulators with project `demo-ajith`. No manual step was needed before `MANUAL_SETUP.md`.
- [ ] `pnpm scan` and gitleaks are clean. No real email, phone number, bank detail, key, token or admin list is in the repo or its history.
- [ ] No clinic name, address, phone, email, logo or link appears in the repo or in `site/dist`.
- [ ] Each phase was committed with its message.

**Architecture**

- [ ] Astro static output deploys to GitHub Pages through Actions. Changing `SITE_URL` alone moves the site to a custom domain.
- [ ] Firestore and Functions are configured for `asia-south1`. Functions run on `nodejs24` (D-01).
- [ ] Sinhala is the default language, English is available on every page, and all UI strings come from the i18n files.
- [ ] Noto Sans Sinhala and Noto Serif Sinhala are bundled. No request goes to a font CDN.

**Public site**

- [ ] Home has the auto-playing, swipeable, pausable, reduced-motion-aware slideshow, the featured book with "Order now", latest news and blog, author intro, Facebook link, story of the week and reels.
- [ ] Each of the three books has a detail page with gallery, description, specs, awards, look inside, testimonials and reviews, press mentions, order or external button, share buttons and `Book` JSON-LD.
- [ ] Blog and News exist as separate collections with tags, cover images, reading time, both languages, RSS and per-post Open Graph images. The launch news post links to the press article.
- [ ] Press & Events, Events, Press kit, About (with the marked placeholder), FAQ, Contact, Privacy, Terms, Bulk orders, 404 and Offline pages exist.
- [ ] `sitemap.xml`, `robots.txt`, favicons, Open Graph defaults and a CSP meta tag are present on every page.
- [ ] Lighthouse mobile is at least 90 for Performance, Accessibility, Best Practices and SEO on Home, a book page and the Order page.

**Ordering**

- [ ] The form has every field in the brief, all 25 districts, and phone normalisation to `94XXXXXXXXX`.
- [ ] "Use my current location" stores latitude, longitude, accuracy and timestamp, shows a Google Maps link, and handles denial.
- [ ] The payment step shows the server-consistent total, bank details from `config/public` and the warning. The slip accepts JPG, PNG, WebP and PDF up to 5 MB and compresses images to 1.5 MB or less.
- [ ] The draft, including the slip, survives a refresh and a closed tab, shows the restored banner with "Start over", and clears only after a successful submission. "My orders" is kept on the device.
- [ ] `createOrder` validates with zod, recomputes totals from Firestore, checks stock, generates a non-sequential ID, stores the slip through the Admin SDK, writes the order as `pending_verification` with history, and triggers notifications. It enforces App Check and rate limits per phone and per IP.
- [ ] The success page shows the order ID, summary, next steps, the prefilled WhatsApp button and both receipt downloads. Sinhala renders correctly in the JPG and the PDF, and the PDF contains no jsPDF text.
- [ ] Tracking needs the order ID and the last 4 phone digits and returns only the status timeline, courier and tracking number.

**Admin**

- [ ] Access needs Google sign-in and the `admin` claim set by `grant-admin.mjs`. Non-admins see "Not authorised". No admin email is in code or rules.
- [ ] Dashboard, order list with filters and search, and order detail with Maps link, slip viewer, timeline, notes and audit log all work on a phone.
- [ ] The status workflow is enforced server-side and invalid transitions are rejected. Dispatch needs courier and tracking number. Rejection needs a reason.
- [ ] Each stage has a one-click WhatsApp button that updates the status and opens the correct `wa.me` link in the customer's language. Templates are editable.
- [ ] CSV export and A4 and single label printing work.
- [ ] Settings edits bank details, delivery fees, phone numbers, Facebook URL, templates, book prices, stock, sale mode and reel URLs through validated callables.
- [ ] Old delivered orders can be anonymised from the admin panel with a configurable age.

**Notifications**

- [ ] New orders email the team with the slip attached and the customer when an email was given. Verified, dispatched and rejected email the customer.
- [ ] Email uses Nodemailer over SMTP with secrets. Telegram runs only when both secrets are set. The WhatsApp Cloud adapter is implemented, tested with mocks and off by default.
- [ ] Senders are idempotent. Failures go to `notification_failures`. Logs contain no personal data. In emulator mode everything goes to `dev_outbox`.

**Security and privacy**

- [ ] Rules match §12 and the rules tests cover anonymous, non-admin and admin for Firestore and Storage.
- [ ] No personal data appears in URLs, query strings, analytics or console logs. Phones are masked on receipts and tracking.
- [ ] Firebase web config is injected at build time from GitHub variables.
- [ ] The privacy policy documents retention.

**Extras**

- [ ] Newsletter signup with consent, admin list and CSV export. Pre-orders and notify-me. Bundle discount. Signed-copy option with surcharge. Bulk enquiry form. Moderated reader reviews. Press kit. Events. Reading samples. Story of the week. Cookieless analytics with Meta Pixel off by default. Installable PWA with an offline page.

**Tests and delivery**

- [ ] Unit, rules, function integration and Playwright tests (mobile and desktop) all pass locally and in `ci.yml`, including the seven E2E scenarios in the brief. Lighthouse CI passes.
- [ ] `ci.yml` runs lint, typecheck, unit tests, rules tests, E2E, the dependency audit and gitleaks on pull requests. `deploy-pages.yml` deploys on push to `main`. `deploy-firebase.yml` is manual.
- [ ] `README.md` covers local development, the emulator workflow, adding a post or a book and changing templates.
- [ ] `MANUAL_SETUP.md` contains every manual step in order, with expected results, ending in the live test order.
