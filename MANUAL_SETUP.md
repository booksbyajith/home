# Manual setup — going live

This is the **only** list of manual steps. Everything is done in a **web browser**: the Firebase console, the Google Cloud console and GitHub. You do **not** need a terminal, Git or Node.js on your computer. The tasks that used to need a terminal (secrets, seed data, admin access) now run as a GitHub Actions workflow called **Admin tools**.

Values used throughout (change them if yours differ):

| Name | Value |
|---|---|
| Firebase / Google Cloud project ID | `booksbyajith` |
| Project number | `338840294291` |
| GitHub repository | `booksbyajith/home` |
| Website address | `https://booksbyajith.github.io/home/` |
| Site origin (no path) | `https://booksbyajith.github.io` |
| Storage bucket (bank slips) | `booksbyajith-slips` |

---

## Progress so far

| Step | Status |
|---|---|
| 1. Firebase project `booksbyajith` | ✅ done |
| 2. **Blaze plan** | ❌ **blocking — see step 2** |
| 3. Firestore in `asia-south1` | ✅ done |
| 3. Storage bucket `booksbyajith-slips` | ✅ done |
| 4. Google sign-in | ✅ enabled — authorised domain still to add |
| 5. Web app registered | ✅ done |
| 6. reCAPTCHA / App Check | ❌ domain error — see step 6 |
| 7. Deploy service account | ⚠ created in the wrong project — redo, see step 7 |
| 8. Signed URLs | to do (now browser-only) |
| 9. GitHub variables | ✅ mostly done — two fixes, see step 9 |
| 10–23 | to do |

---

## 1. Code in the `booksbyajith/home` repository

The code is currently in `iamarasinghe96/booksbyajith` on the branch `claude/vibrant-darwin-7s0i1a`. It needs to be in **`booksbyajith/home`** on the branch **`main`**, because the website and workflows run from there.

**Easiest:** give Claude access to `booksbyajith/home` and ask it to push the code there:

1. Make sure the Claude GitHub App is installed on the `booksbyajith` account: <https://github.com/apps/claude/installations/select_target> → choose **booksbyajith** → allow **home**.
2. In the Claude Code session settings, add the repository `booksbyajith/home` (or start a new session with it selected), and say "push the code to booksbyajith/home main".

**Without Claude (all in the browser):**

1. Open <https://github.com/new/import>.
2. "Your old repository's clone URL": `https://github.com/iamarasinghe96/booksbyajith`. If that repository is private, enter your GitHub user name and a [personal access token](https://github.com/settings/tokens) as the password.
3. Owner: **booksbyajith**. Name: **home** (if `home` already exists and is empty, delete it first in its **Settings → Danger zone**). Click **Begin import**.
4. In the imported repository, open **Branches**, find `claude/vibrant-darwin-7s0i1a`, open a **pull request into `main`** and merge it. (If `main` doesn't exist yet, go to **Settings → General → Default branch** and switch it to `claude/vibrant-darwin-7s0i1a`, then rename that branch to `main` on the **Branches** page.)

**Expected:** `booksbyajith/home` → `main` shows the folders `site`, `functions`, `firebase`, `scripts`, `tests` and `.github`. Do steps 9 onwards in **this** repository.

---

## 2. Blaze plan (required) ❗

The order system **cannot run on the free Spark plan**. Firebase only allows these on Blaze:

- **Cloud Functions** — they create orders, check prices and stock, send emails and change order status. Without them nobody can place an order.
- **Secret Manager** — where the email password is kept.
- **Cloud Storage** — where bank slips are stored (since October 2024 new Storage buckets need Blaze).

Blaze is pay-as-you-go but includes the same free allowance as Spark. A site of this size normally costs **nothing or a few cents a month**; the budget alert below emails you long before any real cost.

**Your billing account has reached its limit of linked projects.** Fix that in one of these ways (quickest first):

- **A. Unlink an old project.** <https://console.cloud.google.com/billing> → your billing account → **Account management** → find a project you no longer use (for example the accidental `github-deploy-…` project from step 7, if it is linked) → **⋮ → Disable billing**. This frees a slot immediately.
- **B. Create a second billing account.** <https://console.cloud.google.com/billing> → **Create account** → add the same or another card. Each billing account has its own project limit.
- **C. Ask for a higher limit.** <https://support.google.com/code/contact/billing_quota_increase> — Google usually answers within a few days.

Then:

1. Firebase console → project **booksbyajith** → bottom-left **Spark → Upgrade** → **Blaze** → choose the billing account.
2. <https://console.cloud.google.com/billing> → your billing account → **Budgets & alerts** → **Create budget**:
   - Projects: **booksbyajith** only.
   - Amount: **USD 5** (or LKR equivalent) per month.
   - Alert thresholds: **50 %, 90 %, 100 %**, email to billing admins.

**Expected:** the Firebase console shows **Blaze**, and the budget appears in the list.

> If you decide you will never use Blaze, the brief's ordering system (server-side price checks, rate limiting, emails, private bank slips) cannot be delivered as designed. Tell Claude and it can propose a reduced, Spark-only version and explain exactly what is lost.

## 3. Storage bucket for bank slips ✅

Done: a private Google Cloud Storage bucket **`booksbyajith-slips`** in **asia-south1 (Mumbai)**, public access prevention on. Firebase's own "Storage → Get started" page is not used (it refused the location), so ignore it.

Set the GitHub variable `STORAGE_BUCKET` = `booksbyajith-slips` (step 9).

## 4. Authorised domain for sign-in

Firebase console → **Authentication → Settings → Authorized domains → Add domain** → enter exactly:

```
booksbyajith.github.io
```

Only the host name: no `https://`, no `/home`. GitHub Pages serves every repository of the `booksbyajith` account from this one host; `/home` is only the path.

**Expected:** `booksbyajith.github.io` is listed next to `localhost` and `booksbyajith.firebaseapp.com`.

## 5. Web app — done ✅

You already have the config. (These values are public by design; it is fine that they appear in the website. Security comes from the rules and App Check.)

## 6. App Check with Fraud Defense (reCAPTCHA Enterprise)

Firebase no longer accepts new reCAPTCHA Classic registrations, so the site uses **Fraud Defense (reCAPTCHA Enterprise)**. It needs one **site key** and no secret key. It is free up to 10,000 checks a month.

1. Firebase console → left sidebar **App Check** → **Apps** → **site** → **Fraud Defense (formerly reCAPTCHA Enterprise)** → **+**.
2. It asks for a **reCAPTCHA Enterprise site key**. Click the link to create one (or open <https://console.cloud.google.com/security/recaptcha?project=booksbyajith>, click **Enable** if asked, then **Create key**):
   - Display name: `booksbyajith-site`. Application type: **Web**.
   - Domains: `booksbyajith.github.io` (host name only).
   - Leave "Use checkbox challenge" **off** (score-based). **Create key**, then copy the **key ID**.
3. Paste the key ID into the App Check form → **Save**. The **site** row becomes **Registered**.
4. **App Check → APIs**: leave Cloud Firestore, Cloud Storage and Authentication **Unenforced**.
5. GitHub `booksbyajith/home` variable `PUBLIC_RECAPTCHA_SITE_KEY` = the same key ID.

## 7. Service account for deployments (redo)

The account you created, `iam-admin@github-deploy-514511.iam.gserviceaccount.com`, was created in a **separate new project** (`github-deploy-514511`), so it has no access to `booksbyajith`. Create it inside `booksbyajith` instead:

1. Open <https://console.cloud.google.com/iam-admin/serviceaccounts?project=booksbyajith> — check the project picker at the top says **booksbyajith**.
2. **+ Create service account**. Name: `github-deploy`. **Create and continue**.
3. Add these roles (type each name in the role search box):
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
   - Firebase Authentication Admin
4. **Done**. Click the new account → **Keys → Add key → Create new key → JSON → Create**. A `.json` file downloads. Keep it private.

**Expected:** the account's email ends with `@booksbyajith.iam.gserviceaccount.com`.

Then tidy up the accidental project: <https://console.cloud.google.com/cloud-resource-manager> → tick `github-deploy-514511` → **Delete**. (If it was linked to billing, this also frees a billing slot for step 2.)

## 8. Allow signed URLs for bank slips (browser only, after step 11)

Do this after the first functions deploy (step 11), because the account it changes is created by that deploy.

1. Open <https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com?project=booksbyajith> → **Enable**.
2. Open <https://console.cloud.google.com/iam-admin/serviceaccounts?project=booksbyajith>.
3. Click **Default compute service account** (`338840294291-compute@developer.gserviceaccount.com`).
4. Tab **Principals with access** (or **Permissions**) → **Grant access**.
   - New principals: `338840294291-compute@developer.gserviceaccount.com` (the same account — it signs on its own behalf).
   - Role: **Service Account Token Creator**.
   - **Save**.

**Expected:** the account is listed with the role "Service Account Token Creator". Admins can now open bank slips.

## 9. GitHub settings in `booksbyajith/home`

Yes — everything in this step must be in **`booksbyajith/home`**, because that is where the site and workflows run. If you set variables in the old repository, set them again here.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** — fix these two and add the missing ones:

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://booksbyajith.github.io` ← fix: replace the `<owner>` placeholder |
| `SITE_URL` | `https://booksbyajith.github.io/home` ✅ (no trailing slash) |
| `FIREBASE_PROJECT_ID` | `booksbyajith` ✅ |
| `PUBLIC_FIREBASE_PROJECT_ID` | `booksbyajith` ← **missing**, add it |
| `PUBLIC_FIREBASE_API_KEY` | ✅ |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ |
| `PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ |
| `PUBLIC_FIREBASE_APP_ID` | ✅ |
| `PUBLIC_FUNCTIONS_REGION` | ✅ `asia-south1` |
| `PUBLIC_ANALYTICS_PROVIDER` | ✅ `none` |
| `PUBLIC_RECAPTCHA_SITE_KEY` | site key from step 6 ← add |
| `STORAGE_BUCKET` | `booksbyajith-slips` ← add |

3. **Settings → Secrets and variables → Actions → Secrets → New repository secret** for each:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | open the JSON file from step 7 in Notepad/TextEdit, copy **everything**, paste |
| `SMTP_HOST` | `smtp.mail.yahoo.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | the books Yahoo email address |
| `SMTP_PASS` | a Yahoo **app password** (not the normal password) — see below |
| `MAIL_FROM` | `Dr. Ajith Amarasinghe Books <the books Yahoo email address>` — Yahoo only sends from its own address |
| `TEAM_EMAILS` | addresses that receive new-order emails, separated by commas (can include the Yahoo address) |
| `ADMIN_EMAILS` | the Google account(s) that will use the admin panel, separated by commas |

**Yahoo app password:** sign in to Yahoo Mail → profile picture → **Account info** → **Account security** → turn on **2-step verification** if it is off → **Generate app password** (or "Manage app passwords") → name it `booksbyajith website` → copy the 16-letter password into `SMTP_PASS`.

These are GitHub *secrets*: nobody can read them back, and they never appear in logs or in the code.

**Expected:** 13 variables and 8 secrets.

## 10. Copy the secrets into Google Secret Manager

GitHub → **Actions → Admin tools (secrets, seed data, admin access) → Run workflow** → task **sync-secrets** → **Run workflow**.

**Expected:** a green run whose log shows `SMTP_HOST: saved`, …, `HASH_SALT: saved` (or "already exists, kept" on later runs). Optional Telegram and WhatsApp secrets you haven't set are saved as `disabled`. Run this again whenever you change one of the GitHub secrets, then redeploy functions (step 11).

## 11. Deploy rules, indexes and functions

GitHub → **Actions → Deploy Firebase (rules, indexes, functions) → Run workflow** (leave all three ticked).

**Expected:** a green run, and Firebase console → **Functions** lists **16 functions** in `asia-south1`.

The first deploy of a new project often fails while Google switches on its services ("API not enabled", "Eventarc service agent", "permission denied … retry"). **Wait 5 minutes and run it again**; this can take two or three tries. Then do **step 8**.

## 12. Seed the books and settings

GitHub → **Actions → Admin tools → Run workflow** → task **seed**.

**Expected:** the log shows `Created: books/portuguese-era-1505-1594, books/finding-sinhabahu, books/chinese-expedition, config/public, config/private`. Running it again shows "Nothing to create" (it never overwrites).

## 13. Deploy the website

GitHub → **Actions → Deploy site to GitHub Pages → Run workflow** (it also runs automatically on every push to `main`).

**Expected:** a green run and the site at **<https://booksbyajith.github.io/home/>**. The order page says ordering is not open yet — correct until step 15.

## 14. Grant admin access

1. Each admin opens **<https://booksbyajith.github.io/home/admin/>** → **Sign in with Google**. They see **"Not authorised"** — that creates their account.
2. Make sure their Google address is in the `ADMIN_EMAILS` secret (step 9).
3. GitHub → **Actions → Admin tools → Run workflow** → task **grant-admins**.
4. They click **Check again** (or sign out and in).

**Expected:** the admin dashboard appears. If the run says "User not found", that person has not signed in once yet (step 14.1).

To remove someone: temporarily set `ADMIN_EMAILS` to **only that person**, run the task **revoke-admins**, then put the remaining admins back into `ADMIN_EMAILS`.

## 15. Fill in the settings and prices

In the admin panel:

1. **Settings → Bank details:** bank, branch, account name, account number, payment instructions (Sinhala and English). Save.
2. **Settings → Delivery fees:** default fee, extra per additional copy, delivery days, and any districts that differ. Save.
3. **Settings → Contact numbers and links:** WhatsApp number, order phone number, Facebook page URL. Save.
4. **Settings → Couriers:** add each courier (tracking URL with `{trackingNo}` if the courier has one). Save.
5. Optional: Videos and reels, Story of the week, Bundle discount, Signed copies.
6. **Books:** for each book set price, stock and sale mode, tick **Available to order**. Save each.
7. **Settings → Ordering:** tick **Orders open**. Save.

**Expected:** the public order page shows the books, prices and bank details.

## 16. Upload the real images

On GitHub you can upload files in the browser: open the folder (for example `site/public/covers`) → **Add file → Upload files** → drag the images in → **Commit changes**. Use **exactly the same file names** as the placeholders; the site redeploys automatically.

| File | Size | Shown on |
|---|---|---|
| `site/public/covers/portuguese-era-1505-1594-front.jpg` | 1200 × 1800 | slideshow, book page, order page, link previews |
| `site/public/covers/portuguese-era-1505-1594-back.jpg` | 1200 × 1800 | book gallery |
| `site/public/covers/portuguese-era-1505-1594-inner-1.jpg` | 1200 × 1800 | book gallery |
| `site/public/covers/portuguese-era-1505-1594-inner-2.jpg` | 1200 × 1800 | book gallery |
| `site/public/covers/finding-sinhabahu-front.jpg` / `-back.jpg` / `-inner-1.jpg` / `-inner-2.jpg` | 1200 × 1800 | as above |
| `site/public/covers/chinese-expedition-front.jpg` / `-back.jpg` / `-inner-1.jpg` / `-inner-2.jpg` | 1200 × 1800 | as above |
| `site/public/samples/<book>/page-01.jpg` … `page-03.jpg` (folders `portuguese-era-1505-1594`, `finding-sinhabahu`, `chinese-expedition`) | 1200 × 1700 | "Look inside" |
| `site/public/author/author-portrait.jpg` | 1200 × 1500 | About, Home, Press kit |
| `site/public/icons/*` (optional) | as existing | browser tab and phone home screen |

JPG, under about 600 KB each. To add or remove inside pages, edit the `covers` and `samples` lists in `site/src/content/books/<book>/book.yaml` (pencil icon on GitHub).

## 17. Review the Sinhala and Tamil text and placeholders

Please have the author (or a Sinhala editor, and a Tamil editor for the Tamil pages) check — all can be edited on GitHub with the pencil icon:

- `site/src/i18n/si.ts` and `site/src/i18n/ta.ts` — all interface text. The Tamil text is a first translation and should be read by a native Tamil speaker.
- Admin → **Settings → WhatsApp message templates** — the Sinhala and Tamil versions. Settings saved before Tamil was added have no Tamil text; Tamil customers then get the English message until you fill in the Tamil box.
- `site/src/content/books/*/book.yaml` — the `ta:` titles of the two Sinhala books are working translations (marked `AUTHOR: please confirm`).
- `site/src/content/*/ta/` and `site/src/content/books/*/ta.md` — Tamil pages, news, FAQ and book descriptions (marked `TRANSLATION:`).
- `site/src/content/pages/si/about.md` and `en/about.md` — replace the paragraph marked **"Placeholder — in the author's own words"**.
- `site/src/content/books/*/si.md` and `en.md` — book descriptions (marked `AUTHOR:`). The English titles of the two Sinhala books are working translations (comments in their `book.yaml`).
- `site/src/content/blog/*/welcome.md` — placeholder welcome post.
- `site/src/content/pages/*/privacy.md` and `terms.md` — privacy policy, delivery and returns.
- `site/src/content/faq/` — answers about payment, delivery and returns.

## 18. Optional: custom domain (e.g. `books.example.lk`)

1. `booksbyajith/home` → **Settings → Pages → Custom domain** → enter the domain → Save. At your domain registrar, create the DNS record GitHub shows (a `CNAME` pointing to `booksbyajith.github.io`). Tick **Enforce HTTPS** when it becomes available.
2. Update variables: `SITE_URL` = `https://books.example.lk` (no `/home`), `ALLOWED_ORIGINS` = `https://books.example.lk`.
3. Firebase → Authentication → Authorized domains → add `books.example.lk`.
4. reCAPTCHA admin → your key → Domains → add `books.example.lk`.
5. Run **Deploy Firebase** (functions only) and then **Deploy site**.

## 19. Optional: Telegram alerts for new orders

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts → copy the **token**.
2. Create a team group, add the bot, send any message in the group.
3. Open `https://api.telegram.org/bot<token>/getUpdates` in a browser and copy `chat` → `id` (a negative number).
4. Add GitHub secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, run **Admin tools → sync-secrets**, then **Deploy Firebase** (functions only).

**Expected:** new orders produce a Telegram message with order number, books, total and district (no names, phones or addresses).

## 20. Optional: WhatsApp Cloud API (automatic messages)

The admin panel already opens WhatsApp with each message ready to send. This only makes sending automatic.

1. <https://developers.facebook.com> → **Create app** → **Business** → add **WhatsApp**. Add and verify the business phone number. Copy the **Phone number ID**.
2. In Meta Business Settings create a **System user** with a **permanent token** that has `whatsapp_business_messaging`.
3. In WhatsApp Manager → **Message templates**, get four Utility templates approved (Sinhala and English) with body parameters in this order:

   | Event | Parameters `{{1}}`, `{{2}}`, … |
   |---|---|
   | acknowledged | name, order number, book titles |
   | payment_verified | order number |
   | dispatched | order number, book titles, courier, tracking number, tracking URL |
   | rejected | order number, reason |

4. Add GitHub secrets `WA_TOKEN` and `WA_PHONE_NUMBER_ID`, run **Admin tools → sync-secrets**, then **Deploy Firebase** (functions only).
5. Admin → **Settings → Notifications → WhatsApp Cloud API**: tick **Enabled**, set the Graph API version (e.g. `v21.0`) and the four template names. Save.

## 21. Optional: analytics

Cookieless. Set the GitHub variables, then run **Deploy site**.

- **GoatCounter:** sign up at <https://www.goatcounter.com>. `PUBLIC_ANALYTICS_PROVIDER` = `goatcounter`, `PUBLIC_ANALYTICS_ENDPOINT` = `https://<your-code>.goatcounter.com`.
- **Plausible:** `PUBLIC_ANALYTICS_PROVIDER` = `plausible`, `PUBLIC_ANALYTICS_SRC` = `https://plausible.io/js/script.js`, `PUBLIC_ANALYTICS_ENDPOINT` = `booksbyajith.github.io`.
- **Meta Pixel (off by default):** set `PUBLIC_META_PIXEL_ID`. Visitors see a consent banner and the pixel loads only if they accept.

## 22. Live test order

Do this once with real money and your own phone:

- [ ] Open the site on a phone. Check the home slideshow, a book page and the language toggle.
- [ ] Order one book with **your own** mobile number and email. Use "Use my current location". Pay a small real transfer and upload the slip.
- [ ] Halfway through, refresh the page: the form and slip are restored.
- [ ] Success page: download the **JPG** and **PDF** receipts; check the Sinhala text and that the QR code opens the tracking page.
- [ ] Check the **team email** arrives with the slip attached, and the **customer confirmation** email.
- [ ] Admin: open the order, view the slip, open the Google Maps link.
- [ ] **Acknowledge** → WhatsApp opens with the message → send it to yourself.
- [ ] **Payment verified** → WhatsApp message and "payment verified" email.
- [ ] **Dispatch** with a courier and tracking number → WhatsApp message and email; the tracking page shows the courier and number.
- [ ] **Mark delivered**.
- [ ] Second test order: **Reject** with a reason (email arrives) → **Reopen** → **Cancel**. Check Admin → Books: stock went down and back up.
- [ ] Export orders to **CSV** and print a **label**.
- [ ] Track the first order on another device using the order number and the last 4 digits.
- [ ] Subscribe to the newsletter, then delete the test subscriber in the admin panel.
- [ ] Refund your test payments.

## 23. Troubleshooting

| Problem | What to do |
|---|---|
| reCAPTCHA says "domain is invalid" | Enter only `booksbyajith.github.io` — no `https://`, no path, no slash. |
| "Not authorised" after **grant-admins** | Click **Check again**, or sign out and in. |
| **grant-admins** says "User not found" | That person must sign in once at `/home/admin/` first. Check the spelling in `ADMIN_EMAILS`. |
| Every order/track/form action fails with `unauthenticated` | The reCAPTCHA site key (variable) and secret key (App Check) must be from the same key, and `booksbyajith.github.io` must be on that key. Run **Deploy site** after changing the variable. |
| Browser shows CORS errors | `ALLOWED_ORIGINS` must be exactly `https://booksbyajith.github.io`. Run **Deploy Firebase** (functions) after changing it. |
| Bank slip won't open in admin | Do step 8 and check `STORAGE_BUCKET`. |
| Emails don't arrive | Admin dashboard shows "Failed notifications". Check the Yahoo app password and that `MAIL_FROM` uses the Yahoo address. Re-run **sync-secrets**, then **Deploy Firebase** (functions). Check spam folders. |
| Deploy fails: "billing account … required" / "Blaze" | Step 2 is not finished. |
| Deploy fails: "secret … not found" | Run **Admin tools → sync-secrets** first. |
| Admin shows "query requires an index" | Run **Deploy Firebase** with indexes ticked and wait a few minutes. |
| Order page says ordering is not open | Admin → Settings → Ordering → **Orders open**, and the bank account number must be filled in. |
| Site build fails: "Missing or invalid public build configuration" | A variable from step 9 is missing or misspelled (most often `PUBLIC_FIREBASE_PROJECT_ID`). |
