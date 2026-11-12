# Manual setup — going live

This is the **only** list of manual steps. Everything else (code, tests, workflows) is already done. Work through the steps in order; each one says what to do and what you should see.

Allow about **1–2 hours**. You will switch between the Firebase console, the Google Cloud console, GitHub and a terminal.

**Placeholders used below:** `<project-id>` is your Firebase project ID (for example `booksbyajith-12345`), `<project-number>` is its numeric project number, `<owner>` is the GitHub account or organisation that owns this repository.

---

## 1. Before you start

You need:

- A Google account to own the Firebase project (the author's or the team's).
- A payment card for the Firebase **Blaze** (pay-as-you-go) plan. A small site like this normally stays within the free allowance; the budget alert in step 2 warns you if it doesn't.
- An email account that can send by **SMTP** (for example a Google Workspace or Gmail account with an app password, or Zoho / Brevo / Mailgun). You need: host, port, user name, password and a "from" address.
- The **Google account(s) that will use the admin panel**.
- On your computer: Node.js 22+, pnpm 10 (`corepack enable`), Git, and the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`).

```bash
git clone https://github.com/<owner>/booksbyajith.git
```

```bash
cd booksbyajith && pnpm install
```

Values you will collect, and where each one goes:

| Value | From step | Goes into |
|---|---|---|
| Firebase project ID and number | 2 | GitHub variables, commands |
| Web app config (apiKey, authDomain, …) | 5 | GitHub variables |
| reCAPTCHA v3 site key | 6 | GitHub variable `PUBLIC_RECAPTCHA_SITE_KEY` |
| Service account JSON key | 7 | GitHub secret `FIREBASE_SERVICE_ACCOUNT` |
| SMTP details, team email addresses | 10 | Secret Manager (via script) |
| Bank details, phone numbers, prices | 15 | Admin → Settings / Books |

---

## 2. Create the Firebase project, Blaze plan and budget alert

1. Open <https://console.firebase.google.com> → **Create a project**. Name it (for example `booksbyajith`). Google Analytics is not needed; you can turn it off.
2. In the project, click the gear icon → **Project settings**. Note the **Project ID** and **Project number**.
3. Bottom-left **Spark plan → Upgrade** → choose **Blaze** and link a billing account.
4. Open <https://console.cloud.google.com/billing> → your billing account → **Budgets & alerts** → **Create budget**:
   - Scope: this project only.
   - Amount: for example **USD 10** per month.
   - Alert thresholds: **50 %, 90 %, 100 %**, email to billing admins.

**Expected:** the Firebase console shows "Blaze" and the budget appears in the list.

## 3. Create Firestore and Storage in `asia-south1` (Mumbai)

1. Firebase console → **Build → Firestore Database → Create database**.
   - Edition: Standard. Database ID: `(default)`.
   - **Location: `asia-south1 (Mumbai)`**. This cannot be changed later.
   - Start in **production mode** (the real rules are deployed in step 11).
2. **Build → Storage → Get started** → location **`asia-south1`** → production mode.

**Expected:** Firestore shows an empty database; Storage shows an empty bucket named like `<project-id>.firebasestorage.app`. Note the bucket name for step 9.

## 4. Enable Google sign-in and authorised domains

1. **Build → Authentication → Get started → Sign-in method → Google → Enable**. Choose the project support email and save.
2. **Authentication → Settings → Authorized domains → Add domain**: `<owner>.github.io` (and your custom domain later, step 18).

**Expected:** Google shows "Enabled"; the domain is listed next to `localhost` and `<project-id>.firebaseapp.com`.

## 5. Register the web app

1. **Project settings → General → Your apps → Web (`</>`)**. Nickname `site`. Do **not** tick Firebase Hosting.
2. Copy the values from the `firebaseConfig` snippet: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

These values are public by design (security comes from the rules and App Check), but they are still kept out of the code and set as GitHub variables in step 9.

## 6. App Check with reCAPTCHA v3

1. Open <https://www.google.com/recaptcha/admin/create>:
   - Type: **reCAPTCHA v3**. Domains: `<owner>.github.io` (add the custom domain later).
   - Copy the **site key** and the **secret key**.
2. Firebase console → **Build → App Check → Apps** → your web app → **reCAPTCHA** → paste the **secret key** → Save.
3. **App Check → APIs**: leave **Cloud Firestore**, **Cloud Storage** and **Authentication** as **Unenforced**.
   The public pages read prices and settings from Firestore without App Check, and the security rules already block everything else. The Cloud Functions enforce App Check in their own code, so nothing needs enforcing here.

**Expected:** the web app shows "reCAPTCHA" as registered provider. Keep the **site key** for step 9.

## 7. Service account for deployments

1. Open <https://console.cloud.google.com/iam-admin/serviceaccounts?project=<project-id>> → **Create service account**. Name: `github-deploy`.
2. Grant these roles:
   - Firebase Admin
   - Cloud Functions Admin
   - Cloud Run Admin
   - Service Account User
   - Secret Manager Admin
   - Cloud Datastore Index Admin
   - Firebase Rules Admin
   - Artifact Registry Administrator
   - Cloud Build Editor
   - Eventarc Admin
   - Service Usage Admin
3. Open the new account → **Keys → Add key → Create new key → JSON**. A `.json` file downloads. Keep it private; do not commit it.

**Expected:** the account is listed with the roles above and one key.

## 8. Allow signed URLs for bank slips

Admins view bank slips through short-lived signed URLs. The functions' runtime account must be allowed to sign them. In a terminal:

```bash
gcloud auth login
```

```bash
gcloud services enable iamcredentials.googleapis.com --project <project-id>
```

```bash
gcloud iam service-accounts add-iam-policy-binding <project-number>-compute@developer.gserviceaccount.com --member="serviceAccount:<project-number>-compute@developer.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator" --project <project-id>
```

**Expected:** the command prints the updated policy containing `roles/iam.serviceAccountTokenCreator`. (If the compute service account does not exist yet, do this step after the first functions deploy in step 11 and run it again.)

## 9. GitHub repository settings

In the repository on GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Secrets → New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT` = the full contents of the JSON key from step 7.
3. **Settings → Secrets and variables → Actions → Variables → New repository variable** for each:

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | `<project-id>` |
| `PUBLIC_FIREBASE_API_KEY` | `apiKey` from step 5 |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `PUBLIC_FIREBASE_APP_ID` | `appId` |
| `PUBLIC_RECAPTCHA_SITE_KEY` | site key from step 6 |
| `PUBLIC_FUNCTIONS_REGION` | `asia-south1` |
| `SITE_URL` | `https://<owner>.github.io/booksbyajith` (no trailing slash) |
| `ALLOWED_ORIGINS` | `https://<owner>.github.io` |
| `STORAGE_BUCKET` | the bucket name from step 3 |
| `PUBLIC_ANALYTICS_PROVIDER` | `none` (see step 21) |

`PUBLIC_USE_EMULATORS` must **not** be set (the workflow sets it to `false`).

**Expected:** 13 variables and 1 secret listed.

## 10. Set the function secrets

Secrets live in Google Secret Manager, never in the repository. Log in once with an account that owns the project:

```bash
pnpm exec firebase login
```

Then run the script; it asks for each value with hidden input:

```bash
pnpm exec node scripts/set-secrets.mjs --project <project-id>
```

| Secret | What to enter |
|---|---|
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `465` (SSL) or `587` (STARTTLS) |
| `SMTP_USER` | SMTP user name |
| `SMTP_PASS` | SMTP password or app password |
| `MAIL_FROM` | e.g. `Dr. Ajith Amarasinghe Books <orders@your-domain>` |
| `TEAM_EMAILS` | comma-separated addresses that get new-order emails |
| `HASH_SALT` | press Enter to generate a random value |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | press Enter to skip (step 19) |
| `WA_TOKEN`, `WA_PHONE_NUMBER_ID` | press Enter to skip (step 20) |

**Expected:** "saved" after each one. Skipped optional secrets are stored as `disabled`.

## 11. Deploy rules, indexes and functions

GitHub → **Actions → Deploy Firebase (rules, indexes, functions) → Run workflow** (leave all three boxes ticked).

**Expected:** the run finishes green and the Firebase console → Functions lists **16 functions** in `asia-south1`: `createOrder`, `trackOrder`, `updateOrderStatus`, `addOrderNote`, `getSlipUrl`, `updateSettings`, `updateBook`, `moderateReview`, `adminUpdateRecord`, `anonymiseOldOrders`, `subscribeNewsletter`, `unsubscribeNewsletter`, `requestStockAlert`, `submitEnquiry`, `submitReview` and the trigger `onOrderAudit`.

The first deploy of a new project often fails while Google enables APIs ("API not enabled", "Eventarc service agent"). Wait 5 minutes and run the workflow again. Then repeat step 8 if it reported that the compute service account did not exist.

## 12. Seed the books and settings

Create Application Default Credentials for your account, then seed (it only creates missing documents):

```bash
gcloud auth application-default login
```

```bash
pnpm build:functions
```

```bash
pnpm seed --project <project-id>
```

**Expected:** "Created: books/portuguese-era-1505-1594, books/finding-sinhabahu, books/chinese-expedition, config/public, config/private". Running it again prints "Nothing to create".

## 13. Deploy the website

Merge the work into `main` (or GitHub → **Actions → Deploy site to GitHub Pages → Run workflow**).

**Expected:** the run is green and the site opens at `https://<owner>.github.io/booksbyajith/`. The order page says ordering is not open yet; that is correct until step 15.

## 14. Grant admin access

For each person who will use the admin panel:

1. They open `https://<owner>.github.io/booksbyajith/admin/`, click **Sign in with Google** and sign in. They will see **"Not authorised"**. That creates their account.
2. You run (with the credentials from step 12):

   ```bash
   pnpm exec node scripts/grant-admin.mjs <their-google-email> --project <project-id>
   ```

3. They click **Check again** (or sign out and in).

**Expected:** the admin dashboard appears. To remove access later, run the same command with `--revoke`. Admin email addresses are never stored in the code.

## 15. Fill in the settings and prices

In the admin panel:

1. **Settings → Bank details:** bank, branch, account name, account number, and payment instructions in both languages. Save.
2. **Settings → Delivery fees:** default fee, extra per additional copy, delivery days, and any district that differs from the default. Save.
3. **Settings → Contact numbers and links:** WhatsApp number (used for the "Message us" buttons), order phone number, Facebook page URL. Save.
4. **Settings → Couriers:** add each courier, with a tracking URL containing `{trackingNo}` if the courier has one. Save.
5. Optional: **Videos and reels**, **Story of the week**, **Bundle discount**, **Signed copies**.
6. **Books:** for each book set price, stock and sale mode (**Order on this site**, **External link** with a URL, or **Not available**) and tick **Available to order**. Save each.
7. **Settings → Ordering:** tick **Orders open**. Save.

**Expected:** the public order page shows the books, prices and your bank details.

## 16. Upload the real images

Replace the placeholder files **with the same file names**, commit and push to `main`. Recommended sizes (JPG, under ~600 KB each):

| File | Size | Shown on |
|---|---|---|
| `site/public/covers/portuguese-era-1505-1594-front.jpg` | 1200 × 1800 | slideshow, book page, order page, link previews |
| `site/public/covers/portuguese-era-1505-1594-back.jpg` | 1200 × 1800 | book gallery |
| `site/public/covers/portuguese-era-1505-1594-inner-1.jpg` | 1200 × 1800 | book gallery |
| `site/public/covers/portuguese-era-1505-1594-inner-2.jpg` | 1200 × 1800 | book gallery |
| `site/public/covers/finding-sinhabahu-front.jpg` | 1200 × 1800 | as above |
| `site/public/covers/finding-sinhabahu-back.jpg` | 1200 × 1800 | |
| `site/public/covers/finding-sinhabahu-inner-1.jpg` | 1200 × 1800 | |
| `site/public/covers/finding-sinhabahu-inner-2.jpg` | 1200 × 1800 | |
| `site/public/covers/chinese-expedition-front.jpg` | 1200 × 1800 | |
| `site/public/covers/chinese-expedition-back.jpg` | 1200 × 1800 | |
| `site/public/covers/chinese-expedition-inner-1.jpg` | 1200 × 1800 | |
| `site/public/covers/chinese-expedition-inner-2.jpg` | 1200 × 1800 | |
| `site/public/samples/<slug>/page-01.jpg` … `page-03.jpg` (for each of the three slugs) | 1200 × 1700 | "Look inside" |
| `site/public/author/author-portrait.jpg` | 1200 × 1500 | About, Home, Press kit |
| `site/public/icons/*` (optional) | as existing | browser tab and home-screen icon |

To add or remove inside pages or samples, edit the `covers` and `samples` lists in `site/src/content/books/<slug>/book.yaml`.

**Expected:** after the Pages workflow finishes, the new covers appear and link previews on Facebook use them (Facebook caches previews; use the [Sharing Debugger](https://developers.facebook.com/tools/debug/) to refresh).

## 17. Review the Sinhala text and placeholders

Please have the author (or a Sinhala editor) check:

- `site/src/i18n/si.ts` — all interface text.
- **Admin → Settings → WhatsApp message templates** — the Sinhala versions.
- `site/src/content/pages/si/about.md` and `en/about.md` — replace the paragraph marked **"Placeholder — in the author's own words"**.
- `site/src/content/books/*/{si,en}.md` — book descriptions (marked `AUTHOR:`). The English titles of the two Sinhala books are working translations (see the comments in their `book.yaml`).
- `site/src/content/blog/*/welcome.md` — placeholder welcome post.
- `site/src/content/pages/*/privacy.md` and `terms.md` — privacy policy, delivery and returns. Check the retention period matches **Settings → Remove personal data after (months)**.
- `site/src/content/faq/` — answers about payment, delivery and returns.

## 18. Optional: custom domain

1. GitHub → **Settings → Pages → Custom domain** → enter e.g. `books.example.lk` → Save. Create the DNS records GitHub shows (a `CNAME` to `<owner>.github.io`, or `A` records for an apex domain). Tick **Enforce HTTPS** when available.
2. Update GitHub variables: `SITE_URL` = `https://books.example.lk` (no path), `ALLOWED_ORIGINS` = `https://books.example.lk`.
3. Firebase → Authentication → Settings → **Authorized domains** → add the domain.
4. reCAPTCHA admin → your key → **Domains** → add the domain.
5. Run the **Deploy Firebase** workflow (functions only is enough) and then the **Deploy site** workflow.

**Expected:** the site works at the new domain; links in WhatsApp messages and emails use it.

## 19. Optional: Telegram alerts for new orders

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts → copy the **token**.
2. Create a group for the team, add the bot, and send any message in the group.
3. Open `https://api.telegram.org/bot<token>/getUpdates` in a browser and copy `chat.id` (a negative number for groups).
4. Set the two secrets, then redeploy functions (workflow, functions only):

   ```bash
   pnpm exec node scripts/set-secrets.mjs --project <project-id> --only TELEGRAM_BOT_TOKEN,TELEGRAM_CHAT_ID
   ```

**Expected:** new orders produce a Telegram message with the order number, books, total and district (no names, phones or addresses).

## 20. Optional: WhatsApp Cloud API (automatic messages)

The admin panel already opens WhatsApp with each message ready to send. This optional step sends them automatically instead.

1. <https://developers.facebook.com> → **Create app** → type **Business** → add **WhatsApp**. Add and verify your business phone number. Copy the **Phone number ID**.
2. In Meta Business Settings create a **System user** with a **permanent token** that has `whatsapp_business_messaging`.
3. In WhatsApp Manager → **Message templates**, create and get approved four templates (category Utility), in Sinhala and English, with body parameters in this exact order:

   | Event | Parameters `{{1}}`, `{{2}}`, … |
   |---|---|
   | acknowledged | name, order number, book titles |
   | payment_verified | order number |
   | dispatched | order number, book titles, courier, tracking number, tracking URL |
   | rejected | order number, reason |

4. Set the secrets and redeploy functions:

   ```bash
   pnpm exec node scripts/set-secrets.mjs --project <project-id> --only WA_TOKEN,WA_PHONE_NUMBER_ID
   ```

5. Admin → **Settings → Notifications → WhatsApp Cloud API**: tick **Enabled**, set the Graph API version (e.g. `v21.0`) and the four template names. Save.

## 21. Optional: analytics

Cookieless and privacy-friendly. Choose one, set the GitHub variables, then rerun the **Deploy site** workflow.

- **GoatCounter:** sign up at <https://www.goatcounter.com>, pick a code. `PUBLIC_ANALYTICS_PROVIDER=goatcounter`, `PUBLIC_ANALYTICS_ENDPOINT=https://<code>.goatcounter.com`.
- **Plausible:** add the site at <https://plausible.io>. `PUBLIC_ANALYTICS_PROVIDER=plausible`, `PUBLIC_ANALYTICS_SRC=https://plausible.io/js/script.js`, `PUBLIC_ANALYTICS_ENDPOINT=<your site domain>`.
- **Meta Pixel (off by default):** set `PUBLIC_META_PIXEL_ID`. Visitors then see a consent banner and the pixel loads only if they accept.

## 22. Live test order

Do this once with real money and your own phone:

- [ ] Open the site on a phone. Check the home slideshow, a book page and the language toggle.
- [ ] Order one book with **your own** mobile number and email. Use "Use my current location". Pay a small real transfer and upload the slip.
- [ ] Halfway through, refresh the page: the form and slip are restored.
- [ ] Success page: download the **JPG** and **PDF** receipts; check the Sinhala text and that the QR code opens the tracking page.
- [ ] Check the **team email** arrives with the slip attached, and the **customer confirmation** email.
- [ ] Admin: open the order, view the slip, open the Google Maps link.
- [ ] Press **Acknowledge** → WhatsApp opens with the message → send it to yourself.
- [ ] **Payment verified** → WhatsApp message and "payment verified" email.
- [ ] **Dispatch** with a courier and tracking number → WhatsApp message and email; the tracking page shows the courier and number.
- [ ] **Mark delivered**.
- [ ] Place a second test order, **Reject** it with a reason (email arrives), then **Reopen** it, then **Cancel** it. Check Admin → Books: the stock went down and back up correctly.
- [ ] Export orders to **CSV** and print a **label**.
- [ ] Track the first order on another device using the order number and the last 4 digits.
- [ ] Subscribe to the newsletter, then delete the test subscriber in the admin panel.
- [ ] Refund your test payments.

## 23. Troubleshooting

| Problem | What to do |
|---|---|
| "Not authorised" after running `grant-admin.mjs` | Click **Check again**, or sign out and in. The claim applies to new sign-ins. |
| Every order/track/form call fails with `unauthenticated` | App Check: the reCAPTCHA site key (variable) and secret key (App Check console) must be from the same key, and the site's domain must be listed on the reCAPTCHA key. Rebuild the site after changing the variable. |
| Browser console shows CORS errors calling functions | `ALLOWED_ORIGINS` must match the site's origin exactly (scheme + host, no path). Redeploy functions after changing it. |
| Bank slip won't open in admin | Repeat step 8 (signed URLs) and check `STORAGE_BUCKET`. |
| Emails don't arrive | Admin dashboard shows "Failed notifications". Check the SMTP secrets (step 10), the spam folder, and that the SMTP account allows sending as `MAIL_FROM`. Redeploy functions after changing secrets. |
| Deploy fails: "secret … not found" | Run step 10 again; every secret must exist (optional ones as `disabled`). |
| Deploy fails: "query requires an index" in admin | Run the Deploy Firebase workflow with **indexes** ticked and wait a few minutes for the indexes to build. |
| Order page says ordering is not open | Admin → Settings → Ordering → **Orders open**, and the bank account number must be filled in. |
| Site build fails: "Missing or invalid public build configuration" | A GitHub variable from step 9 is missing or misspelled. |
