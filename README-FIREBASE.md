# Firebase activity and contact messages

The existing Firebase project remains **purperfect-169de**. Nothing is deployed by this change. There is no migration or deletion of existing documents. Existing edits to the admin pages are preserved.

Changed files are grouped by purpose:

- Customer entry points: `js/ingestion-client.mjs`, `js/script.js`, `contact.html`, `quiz.html`, `pet.html`, `apps/web/src/App.jsx`, `apps/web/src/pages/ContactPage.jsx`, `apps/web/src/pages/QuizPage.jsx`, `apps/web/src/pages/StickerPage.jsx`, `apps/web/src/lib/apiClient.js`, `apps/web/vite.config.js`.
- Admin: `admin/index.html`, `admin/js/admin.js`, `admin/js/login.js`. `admin/login.html` already had local edits and was not changed by this task. The Firebase web configuration and admin CSS are retained.
- API: `apps/api/src/server.js`, `apps/api/src/config/env.js`, `apps/api/src/routes/ingestion.js`, `apps/api/src/routes/quiz.js`, `apps/api/src/services/ingestionRepository.js`, `apps/api/src/middleware/ingestionGuard.js`, `apps/api/src/middleware/requireAdmin.js`, `apps/api/src/middleware/validate.js`.
- Rules/build/deployment: `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `Dockerfile`, `.dockerignore`, `.gcloudignore`, `scripts/build-hosting.mjs`, root/API `package.json`, `package-lock.json`, `.gitignore`.
- Checks/documentation: `apps/api/test/ingestion.test.js`, `tests/client.test.mjs`, `tests/firestore.rules.test.mjs`, this guide.

## Customer entry points and local development

The root `index.html`, `about.html`, and `contact.html` remain the static marketing site. `quiz.html` redirects to `/quiz`; `pet.html` redirects to `/pet`. These are the working React features. React also supports `/`, `/about`, `/contact`, and `/quiz/result/:id`. Both contact forms and both sets of Shopee links are connected. The old `/admin/share` URL redirects to the authenticated dashboard in Hosting and the local full-site server.

Use Node.js 22 and npm. Configure backend credentials first, then run from the repository root:

```sh
npm ci
npm run dev:site
```

Open `http://localhost:3001/` and `http://localhost:3001/admin/login.html`. This builds the customer app and serves static pages, React routes, and the API on **one origin**. Restart `npm run dev:site` after editing frontend files.

For React hot reload, run `npm run dev:api` and `npm run dev:web` in separate terminals; open `http://localhost:5173/`. Vite proxies `/api` to port 3001. Use the full-site mode when testing transitions between the static site and React. A plain Python static server cannot serve the API or the React route fallbacks. Ports 5500/8000 on localhost retain an API fallback to `http://localhost:3001` for the static contact page.

## Events and storage

All four metrics use `analytics_events/{sha256(type + ':' + eventId)}`. Each document contains **only**:

```text
type: browser_session | quiz_completion | sticker_generation | shop_redirect
createdAt: Firestore server timestamp
```

No names, emails, message contents, page URLs, photos, IP addresses, or quiz answers are stored in these events. Random event IDs are used for idempotency, and only their hashes appear as document IDs. No mutable public totals exist.

| Metric | Trigger | Exclusions and deduplication |
| --- | --- | --- |
| Website Visitors (browser sessions) | First customer page in a tab's sessionStorage session | Same ID across static pages, React routes, reloads, and React StrictMode. `/admin` and `/admin/*` excluded. Not unique people. |
| Quiz Completions | Server successfully evaluates a submitted quiz with all 5 static and 5 adaptive answers | One completion ID per quiz attempt; retries reuse it; retake creates a new one. Debug save, incomplete answers, failed API calls, local error previews, result viewing, and downloads never emit this event. Successful server evaluations using the existing fallback breed profiles still count as completed quizzes. |
| Sticker Generations | Real photo inference succeeds and the selected sticker output image loads | Generated only in the real Generate handler. Not upload, debug output, preview viewing, caption generation, download, or failure. Concurrent clicks are guarded; stale work after changing/removing a photo is ignored. |
| Shop Redirect Clicks | Trusted click or middle click on a `https://shopee.co.th` link (including subdomains) | Delegated handling covers dynamic links in both frontends. Never blocks or changes navigation. It represents a click, **never a purchase**. |

The sticker feature currently chooses a matching asset from the repository's sticker library after inference. This change records successful completion of that existing pipeline; it does not add a new generative-image service.

The shared module is `js/ingestion-client.mjs`. Session IDs use sessionStorage, not Firebase Authentication. Visitors do not need accounts, and anonymous Firebase Auth does not need to be enabled. Clearing storage starts a new session; separate origins have separate sessions. Browsers may copy sessionStorage into duplicated tabs or restore it after restart. If sessionStorage is blocked, visitor tracking is skipped to avoid counting every page load.

`POST /api/analytics/events` accepts exactly `{type, eventId}` for browser sessions, sticker generations, and shop clicks. UUID v4 IDs are required. Public quiz events are rejected; only the server's validated `/api/quiz/evaluate` success path records them. Firestore `create()` makes duplicate writes atomic, including concurrent requests and retries. Retry does not change the original timestamp.

The dashboard uses Firestore server-side `count()` queries over one shared, rolling 7- or 30-day interval, ending when Refresh is clicked. All four metrics use that exact interval. Dates are displayed in the admin's local time. Counts are not extrapolated or backfilled from old quiz/debug/share documents. Loading, `0 — No activity`, and unavailable totals are distinct. Use Refresh to include events recorded since the last query.

## Messages and admin access

`POST /api/messages` saves to the existing `messages` collection using a hashed submission ID. It preserves the original fields and length limits:

```text
name: trimmed string, 2–100 characters
email: trimmed valid email, 5–150 characters
subject: trimmed string, 0–150 characters
message: trimmed string, 1–2000 characters
status: unread
source: contact-page
createdAt: Firestore server timestamp
```

Extra fields, client timestamps, and client status overrides are rejected. A transaction makes retries with the same ID and contents return success without overwriting the document or an admin's read/replied status. Reusing an ID for different contents is rejected. Each form validates input, disables fields and submission while saving, reports failure, and shows success only after the server confirms a committed write. A digest of the last submission and its random ID are kept in sessionStorage, so identical retries across form remounts or the static/React contact pages also reuse the ID. Contact details and message text are not stored there.

Public Firestore message creation is now denied so scripts cannot bypass the API's validation and rate limits. Admin message search, status filtering, unread notifications, read/replied controls, and email reply remain. Email reply opens the administrator's email client; it does not send automatically. Mark replied after sending the email.

In Firebase Console:

1. Use the existing `purperfect-169de` project and its existing default Firestore database.
2. Enable Authentication → Email/Password for admin login if not already enabled. Add `localhost` and your actual hosting/custom domains to authorized domains as needed; domains do not include ports.
3. For each intended admin, confirm `users/{Firebase Authentication UID}` has `role: "admin"` and **`active: true`** (boolean). Missing `active`, `false`, and string `"true"` do not grant access. Set this using the console or an already authorized admin; never let public users set their own role.
4. Deploy the Firestore rules and the `analytics_events` index and wait until the index is ready. No new Firebase web app or project is needed. `js/firebase-config.js` keeps the existing public Firebase web configuration.

Firestore rules require an active admin to read analytics/messages, and deny **all client writes** to analytics, including admin client writes. The admin's live profile listener clears data and redirects when access is revoked. Legacy API reads `/api/quiz/share/analytics` and `/api/quiz/results/recent` now also require a Firebase bearer ID token and an active admin profile; the server checks token revocation. Existing `quiz_results` and `share_events` data is retained and is separate from these four totals.

## Server configuration

For local development, create **`apps/api/.env`**, which is ignored by Git and excluded from the hosting build:

```dotenv
DATA_STORE=firebase
FIREBASE_PROJECT_ID=purperfect-169de
FIREBASE_USE_APPLICATION_DEFAULT=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
```

Obtain local Application Default Credentials with `gcloud auth application-default login`, using an account authorized for this existing project. Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` to an existing service-account JSON file **outside the repository**, or use the already-supported backend-only `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`. Never put private credentials in `js/firebase-config.js`, a `VITE_*` variable, or a web directory.

The API refuses ingestion with HTTP 503 if Firebase is not configured; it does not silently save analytics/messages to memory or another database. Cloud Run uses its attached service account and `FIREBASE_USE_APPLICATION_DEFAULT=true`, so no private key file is needed there.

Optional settings:

- `ALLOWED_ORIGINS`: comma-separated exact origins for your custom domain. Defaults include the existing Firebase hosting domains and, outside production, localhost development origins. CORS is not authentication.
- `PORT`: defaults to 3001 locally; the Docker image uses 8080.
- `SERVE_WEB=true`: used by `npm run dev:site` for local full-site serving. Production Hosting serves the prepared web files; Cloud Run serves the API.
- Existing AI integrations still use `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and optional `NINJA_API_BASE_URL`, `NINJA_API_PATH`, `NINJA_API_KEY`, and `CAT_API_KEY`. Keep API keys in backend environment variables or Secret Manager. Real adaptive quizzes require a reachable Ollama service with the selected model installed. Cloud Run's `localhost:11434` is not your laptop; configure a reachable protected model service before testing production quizzes. Firebase Hosting has a 60-second request timeout, so the model must answer within that limit.
- Leave `VITE_API_BASE_URL` unset for the supplied same-origin deployment. The ingestion client uses the Hosting `/api` rewrite; Vite uses its local proxy.

## Deployment commands (not executed)

These commands deploy to the **existing** project. Install/authenticate the Firebase CLI and Google Cloud CLI first. Cloud Run/Cloud Build require billing and the relevant project permissions. The Dockerfile uses the repository root as the build context and installs only API production dependencies.

One-time service setup, only if the named service account does not already exist:

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com --project=purperfect-169de
gcloud iam service-accounts create purrishco-api --display-name="PurrishCo API" --project=purperfect-169de
gcloud projects add-iam-policy-binding purperfect-169de --member="serviceAccount:purrishco-api@purperfect-169de.iam.gserviceaccount.com" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding purperfect-169de --member="serviceAccount:purrishco-api@purperfect-169de.iam.gserviceaccount.com" --role="roles/firebaseauth.viewer"
```

From the repository root, deploy the API. Replace the Ollama URL with your reachable model service; this placeholder is not a working endpoint:

```sh
gcloud run deploy purrishco-api \
  --source . \
  --project=purperfect-169de \
  --region=asia-east1 \
  --service-account=purrishco-api@purperfect-169de.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars='NODE_ENV=production,DATA_STORE=firebase,FIREBASE_PROJECT_ID=purperfect-169de,FIREBASE_USE_APPLICATION_DEFAULT=true,OLLAMA_BASE_URL=https://YOUR-REACHABLE-OLLAMA-HOST,OLLAMA_MODEL=qwen2.5:3b'
```

`--allow-unauthenticated` permits the public ingestion and customer quiz endpoints. Private API routes still enforce admin tokens. Keep the service name and region aligned with `firebase.json`. If using a custom origin, set `ALLOWED_ORIGINS` in the Cloud Run service configuration as well. Use Secret Manager for optional API keys rather than pasting them into these commands.

Then deploy the rules/index and Hosting:

```sh
npm ci
npm test
firebase deploy --only firestore:rules,firestore:indexes --project purperfect-169de
firebase deploy --only hosting --project purperfect-169de
```

If index deployment asks to remove any existing indexes not listed locally, **decline removal**. The only new required composite index is `analytics_events` on `type ASC` and `createdAt ASC`; retain all existing indexes. Wait for the new index to be ready before checking totals. The Hosting predeploy hook runs `npm run build:hosting`, which creates `hosting/` from explicit public-file paths plus the React assets. The backend, `.env` files, package metadata, tests, and training checkpoint are not published. These commands do not deploy or change Storage rules.

## Verification and manual acceptance checks

Verified in this workspace: 8 API tests, 7 DOM tests, and the Firestore emulator suite all passed. The emulator suite also exercised real Admin SDK concurrent writes, server timestamps, and message transactions. The production build, JavaScript syntax checks, and `git diff --check` passed. A local HTTP smoke test verified 13 public routes/assets, denied unauthenticated legacy analytics reads, and confirmed backend/config/training files were not served. The prepared Hosting directory contains 32 public files. These were local checks, not a deployment or a live browser login/inference test.

```sh
npm test
npm run build:hosting
```

The API tests cover schema rejection, atomic event duplicates, message retries without overwriting admin status, backend failures, request limits, completed versus failed quizzes, and unauthenticated private-route rejection. DOM tests cover shared-session tracking, React effect cleanup behavior, admin exclusion, blocked sessionStorage, analytics retries, Shopee click behavior, and form validation/loading/retry/success.

Rules tests require Java 21+ and the Firebase CLI and use a demo emulator project only:

```sh
firebase emulators:exec --only firestore --project demo-purrishco "npm run test:rules"
```

The rules suite checks active/inactive/missing admin profiles, anonymous/customer access, analytics aggregation permissions and 7/30-day windows, message status updates, forbidden analytics writes/deletes, role escalation, and revocation. Do not point this test suite at the production database.

For live acceptance after you configure and deploy:

1. **Browser sessions:** Open the public home page in a fresh tab/session. Refresh dashboard totals: expect +1. Reload and navigate through static Contact, Quiz, and Pet pages on that same origin: expect no additional session. Opening only the admin pages must not increment it. Clear sessionStorage or use a fresh private session to test a new session. Use a separate browser profile for admin to avoid mixing test activity.
2. **Quiz:** Finish all ten questions with Ollama running. Expect one `quiz_completion`. Rerender, navigate away/back, view/share/download the result, or replay the same `/api/quiz/evaluate` request: no extra event for that completion ID. Retake and complete another quiz: +1. Debug output, incomplete quiz submission, and failed evaluations: +0. API event writes never include the answers.
3. **Sticker:** Upload a valid pet photo and click Generate; wait for inference and the output image. Expect +1. Upload without generating, invalid/non-pet photo, failed image loading, debug output, preview viewing, and download: +0. Rapid double click while generation is pending: one event. A deliberate subsequent successful generation is another event.
4. **Shop:** Click a Shopee link on the static home page and on the React home or result page. Each click should add one redirect. Block `/api/analytics/events` in browser DevTools and click again: Shopee still opens. No purchase metric is created.
5. **Messages:** Submit a valid message from `/contact.html` and `/contact`; each appears in the admin list with the existing fields and unread status. Invalid/blank/overlength inputs must not save. Slow or block the API: the form must remain busy until a response, prevent duplicate submissions, and show an error on failure. Retry after restoring connectivity without editing: the same submission ID must not create another document. Search/filter it, mark read, open Reply by email, then mark replied. Reload to confirm status persists.
6. **Dashboard/access:** Compare the four counts for Last 7 days and Last 30 days. Use test data in the emulator to check date boundaries without editing production events. A quiet interval displays zero, not an error. Disable the network or use an undeployed index to see unavailable totals. Sign out, sign in as a customer, or set the admin profile inactive: analytics/messages must be inaccessible. Direct public Firestore event writes, reads, updates, deletes, and message creates must be denied.

## Reliability and spam limits

Ingestion uses exact field/type/length validation, server timestamps, hashed UUID idempotency, an origin allowlist, a 32 KB body limit, and bounded per-process IP rate limits (120 API requests/minute, 60 event requests/minute, 5 message requests/hour). The proxy trust setting is deliberately left off so arbitrary `X-Forwarded-For` headers cannot reset limits. Behind Cloud Run/proxies, callers may share a network bucket, which can cause throttling of legitimate traffic; per-instance limits also reset on restart and are not a global quota across replicas.

This is basic abuse mitigation, not fraud-proof analytics. A bot can omit/spoof Origin, rotate addresses, generate fresh UUIDs, or call the real quiz evaluator with fabricated valid-shaped answers. Client-side sticker generation cannot be proven to the server by a public event alone. Browser-session and click events are also client claims. For stronger protection at higher traffic, add App Check enforcement on the API, CAPTCHA for contact submissions, a verified ingress/proxy configuration, and shared server-side quotas. None of these require visitor accounts.

Analytics delivery is best effort: the browser retries a failed request once using the same ID; session writes can retry on subsequent navigation or connectivity restoration. Blockers, offline tabs, unload timing, API/Firestore outages, and server write failures can undercount. An analytics failure does not prevent a completed quiz, usable sticker, or Shopee navigation. Contact submission is different: it never claims success before a committed save. Clearing or blocking sessionStorage, changing origins, or starting a new session loses the persistent contact retry ID, so manually resubmitting after an ambiguous failure can then create a duplicate; the database still deduplicates every retry carrying the same ID. With sessionStorage blocked, retries are deduplicated within the mounted form only.

No historical visitor/sticker/click totals can be reconstructed from placeholders. New totals begin when ingestion is configured and the connected site is used. Production IAM, billing, index readiness, live admin credentials, actual model inference, and deployed network routing require the manual checks above; local checks do not verify your live project settings.

The build still reports the existing large ML/browser bundle warning. The dependency install reports 14 existing audit advisories (10 moderate, 4 high); unrelated dependency upgrades were not included in this change.

References: [Firebase aggregation queries](https://firebase.google.com/docs/firestore/query-data/aggregation-queries), [Firestore rules and server SDK behavior](https://firebase.google.com/docs/firestore/security/rules-query), [Hosting to Cloud Run, supported regions, and timeout](https://firebase.google.com/docs/hosting/cloud-run), [Firebase rules unit tests](https://firebase.google.com/docs/rules/unit-tests).
