# Books by Dr. Ajith Amarasinghe

Bilingual (Sinhala / English) author website with direct book ordering, order tracking and an admin panel.

- **Site:** Astro (static) + TypeScript + Tailwind 4 + Preact islands, deployed to GitHub Pages.
- **Backend:** Firebase — Auth (Google sign-in, admins only), Firestore, Storage, Cloud Functions v2 (Node 24, `asia-south1`), App Check.
- **Everything runs locally on the Firebase Emulator Suite.** No real Firebase project is needed to develop or test.

Setting up the real accounts and going live is described step by step in [`MANUAL_SETUP.md`](MANUAL_SETUP.md). The full design, data model and decisions are in [`PLAN.md`](PLAN.md).

## Repository layout

| Folder | Contents |
|---|---|
| `site/` | Astro site: pages, views, Preact islands (order flow, tracking, forms, admin), content files, i18n |
| `functions/` | Cloud Functions. `src/shared/` is pure code also used by the site (pricing, phone numbers, status machine, templates, validation) |
| `firebase/` | Firestore and Storage security rules, indexes |
| `scripts/` | Dev server, seeding, admin grants, secrets, image and Open Graph generation, scanners |
| `tests/` | Rules tests, function integration tests, Playwright E2E, Lighthouse config |
| `patches/` | A small `firebase-tools` patch so emulator traffic bypasses an HTTPS proxy (see PLAN.md D-47) |

## Prerequisites

- **Node.js 22+** on your PATH. pnpm downloads and uses the pinned Node 24.22.3 for every command (`useNodeVersion` in `pnpm-workspace.yaml`).
- **pnpm 10** (`corepack enable` then `corepack prepare pnpm@10.28.0 --activate`).
- **Java 21** for the Firestore and Storage emulators.

```bash
pnpm install
```

## Local development

```bash
pnpm dev
```

This builds the functions (and keeps rebuilding them on change), starts the emulators, seeds test data and runs the site:

| What | URL |
|---|---|
| Site | http://127.0.0.1:4321/booksbyajith/ |
| Admin | http://127.0.0.1:4321/booksbyajith/admin/ |
| Emulator UI (data, emails, logs) | http://127.0.0.1:4000/ |

**Admin login in development.** Create a user and give it the admin claim:

1. In the Emulator UI → Authentication, add a user with an email and password (any fake address, for example `admin@example.com`).
2. Run:

   ```bash
   pnpm exec node scripts/grant-admin.mjs admin@example.com --emulator
   ```

3. On `/admin/`, use the "Emulator sign-in" form (it only exists in emulator builds).

**Emails and messages in development** are never sent. They are written to the `dev_outbox` collection (open it in the Emulator UI → Firestore). Emulator secrets come from `functions/.secret.local`, created from `functions/.secret.local.example` on first run.

**Seed data.** `scripts/seed.mjs --emulator --fixtures` writes the three books, default config, and test fixtures (fake bank details, delivery fees, couriers). Without `--fixtures` it only creates missing documents and never overwrites.

## Tests

| Command | Runs |
|---|---|
| `pnpm lint` | ESLint and Prettier |
| `pnpm typecheck` | TypeScript in functions and tests, `astro check` in the site |
| `pnpm scan` | Local secret / personal-data / policy scanner (gitleaks also runs in CI) |
| `pnpm test:unit` | Vitest unit tests (shared logic, notifications, site helpers) |
| `pnpm test:rules` | Firestore and Storage security rules tests on the emulators |
| `pnpm test:functions` | Callable and trigger integration tests on the emulators |
| `pnpm test:e2e` | Builds the site in emulator mode and runs Playwright (mobile + desktop) on the emulators |
| `pnpm test:lhci` | Lighthouse CI (mobile) on Home, a book page and the Order page |
| `pnpm check:links` | Every internal link in `site/dist` resolves under the base path |
| `pnpm check:prod` | Production-mode build contains no emulator code or values |
| `pnpm test` | lint → typecheck → scan → unit → rules → functions → E2E |

The emulator-based commands start and stop their own emulators, so stop `pnpm dev` first (the ports are shared). To run one Playwright spec against emulators you already have running: `cd tests && pnpm exec playwright test order.spec.ts`.

## Content

### Add a blog or news post

Create a Markdown file (or `.mdx` for blog posts that need components):

```
site/src/content/blog/si/<slug>.md      Sinhala blog post
site/src/content/blog/en/<slug>.md      English blog post
site/src/content/news/si/<slug>.md      Sinhala news
site/src/content/news/en/<slug>.md      English news
```

Front matter:

```yaml
---
title: Post title
description: One or two sentences (max 200 characters) used for search results and link previews.
date: 2026-11-20
tags: [launch, portuguese-period]
cover: /covers/portuguese-era-1505-1594-front.jpg   # optional, a path under site/public
coverAlt: Description of the cover image
translationKey: my-post        # same value in the si and en versions links them together
draft: false
---
```

Each post gets its own page, Open Graph image (generated at build time), RSS entry and sitemap entry. Push to `main` to publish.

### Add an event, press item or testimonial

One YAML file per item in `site/src/content/events/`, `site/src/content/press/` or `site/src/content/testimonials/` (see the existing files and `testimonials/README.md` for the fields).

### Add a book

1. Create `site/src/content/books/<slug>/book.yaml` (copy an existing one), plus `si.md` and `en.md` with a `summary` and the description.
2. Put the images in `site/public/covers/` and `site/public/samples/<slug>/` with the file names listed in `book.yaml`.
3. Create the book's price/stock document: run `pnpm seed --project <id>` (creates only missing documents), then set price, stock and sale mode in Admin → Books.

Firestore `books/{slug}` holds the live price and stock (the source of truth at checkout). The `defaults` in `book.yaml` are only used when the book is first seeded and as the price shown before the live price loads.

### Replace images

Drop real images over the placeholders with the same file names (see `MANUAL_SETUP.md` step 16). Responsive WebP versions are generated on every build.

## Message templates and settings

The WhatsApp message templates, bank details, delivery fees, contact numbers, Facebook link, reels, couriers, bundle discount and signed-copy surcharge are **not in the code**. Change them in **Admin → Settings**. The built-in defaults (used when a value has never been set) are in `functions/src/shared/templates.ts` and `functions/src/shared/defaults.ts`.

Template placeholders: `{name} {orderId} {bookTitles} {total} {courier} {trackingNo} {trackingUrl} {facebookUrl} {reason} {orderUrl}`.

## Translations

All interface text is in `site/src/i18n/si.ts` and `site/src/i18n/en.ts`. To add a string, add the key to `si.ts` and the same key to `en.ts`; `pnpm typecheck` and the unit tests fail if either file is missing a key or a placeholder.

## How it fits together

- **Ordering.** The order page keeps a draft in `localStorage` and the bank slip in IndexedDB, so a refresh or closed tab loses nothing. Submitting calls the `createOrder` function, which validates everything with zod, recalculates prices from Firestore, checks stock, stores the slip in Storage and creates the order. The receipt (JPG and PDF) is rendered from HTML in the browser so Sinhala text is shaped correctly.
- **Status workflow.** `pending_verification → acknowledged → payment_verified → dispatched → delivered`, with `rejected` (reason required, can be reopened) and `cancelled`. Only the `updateOrderStatus` function can change a status; each button in the admin panel also opens WhatsApp with the right message ready to send.
- **Notifications.** A Firestore trigger on each status change sends emails (and optional Telegram / WhatsApp Cloud API messages). Every send happens at most once, and failures are recorded in `notification_failures`.

### Security model

- Firestore: `books`, `books/*/reviews` and `config/public` are public-read. Everything else is readable only by users with the `admin` custom claim. **No client can write anything**; all writes go through Cloud Functions.
- Storage: no client access at all. Admins see slips through short-lived signed URLs.
- Public functions require App Check and are rate-limited per phone number and per IP (stored as salted hashes, never in plain text).
- Tracking needs the order number and the last four digits of the phone number, and returns only status and courier details.
- No personal data in URLs, logs or analytics. Order numbers on the success, tracking and receipt pages are in the URL fragment, which is never sent to a server.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Port 8080 is not open` / port in use | Another emulator run is still active. Stop it (`pkill -f firebase`) and retry. |
| `Missing or invalid public build configuration` | The build needs the variables in `.env.example`. Locally use `pnpm build:emu`; in CI set the repository variables (MANUAL_SETUP.md step 9). |
| `astro check` fails with `Cannot find package '@emnapi/core'` | Delete all `node_modules` folders and run `pnpm install` again. |
| Functions emulator can't register the Firestore trigger behind a proxy | Make sure `pnpm install` applied `patches/firebase-tools@15.36.0.patch`. |
| A Playwright test can't find a form element | Forms are islands that hydrate when visible. Scroll to them and wait for `[data-hydrated="true"]`. |

### Known advisories

`@grpc/grpc-js` (pulled in by the Firebase client SDK) is overridden to a patched version in `pnpm-workspace.yaml`.
