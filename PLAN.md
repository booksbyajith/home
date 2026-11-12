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

**Added during implementation**

- D-47 `firebase-tools@15.36.0` sends emulator loopback requests through `HTTPS_PROXY` and ignores `NO_PROXY`, which breaks Firestore trigger registration behind a proxy. A `pnpm patch` (`patches/firebase-tools@15.36.0.patch`) skips the proxy for `127.x`, `localhost` and `[::1]`. It changes nothing for real Google API calls.
- D-48 Callable CORS origins are read from `process.env.ALLOWED_ORIGINS` when the module loads (the deployed `functions/.env`), falling back to allow-all when empty. `defineList` was not used because it expects a JSON array in `.env`. Protection does not depend on CORS.
- D-49 `requestStockAlert`, `submitReview` and `submitEnquiry` also require `consent: true`, matching the consent checkboxes in §14.7.
- D-50 Order-anonymisation selects closed orders (`delivered`, `rejected`, `cancelled`) by `closedAt`, not only delivered ones, so abandoned orders do not keep personal data forever.
- D-51 `browser-image-compression` runs with `useWebWorker: false`. Its worker loads a script from a CDN by default, which the CSP blocks and the no-CDN rule forbids.
- D-52 Receipt test (§16.4.1): the title-overlap masks use a 2 px blur and a threshold of 200 (fallback R15; 1 px was too sensitive to a 1–2 px sub-pixel offset between html-to-image and the browser). Measured: correct font 0.60, wrong font 0.05.
- D-53 jsPDF always declares a default Helvetica font resource even when no text is drawn, so the PDF check is "no `BT … ET` text-drawing block outside the image bytes" rather than "no `/Font`". The PDF content stream is left uncompressed so this check can read it.
- D-54 Public build variables are injected as one validated object, `__PUBLIC_ENV__`, through Vite `define` (see `site/src/lib/env.schema.ts`), instead of `import.meta.env`. Missing values fail the build with a message that points to `.env.example`.
- D-55 Generated responsive images go to `site/public/_gen/` (all image folders, not only covers) with a size manifest in `site/src/generated/images.json`; both are git-ignored and rebuilt by `prebuild`.
- D-56 Every form island renders with `method="post"` and keeps its submit button disabled until hydrated (`data-hydrated="true"`), so an unhydrated form can never submit natively and put field values in a URL.
- D-57 Analytics are first-party beacons sent with `fetch` (GoatCounter `/count?p=<pathname>`, Plausible `/api/event`), not third-party scripts. Only the pathname is sent. Covered by a unit test instead of a second E2E build.
- D-58 `ALLOWED_ORIGINS`, `SITE_URL` and `STORAGE_BUCKET` reach the functions through `functions/.env`; App Check is enforced by the functions' own `enforceAppCheck: true`, so in the console Firestore, Storage and Auth stay "Unenforced" (MANUAL_SETUP.md step 6).
- D-59 Order IDs on the success page, tracking links and QR codes use the URL fragment (D-34); the newsletter unsubscribe token also travels in the fragment and is removed from the address bar on load.
- D-60 `@grpc/grpc-js` is overridden to 1.14.7 (from the Firebase client's `~1.9.0`) to clear a high-severity advisory; the rules tests exercise the Node Firestore client with the override.
- D-61 Tamil (`ta`, under `/ta/`) is the third language. Interface text lives in `site/src/i18n/ta.ts`; content uses `ta.md` / `content/*/ta/`. The `ta` field of localised Firestore values (settings, templates, preorder notes) is optional, so settings saved before Tamil existed stay valid; `l10nText()` falls back to English, then Sinhala. The admin panel offers all three languages.
