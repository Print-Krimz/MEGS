# Targeted security regression correction

Work is on branch `megs-security-surgical-auth-hardening`, checkout `MEGS-security-surgical-auth-hardening`, starting at `8f89185d936454b1466e1d2a1e73e1513f701484`. The baseline was clean; the separate `MEGS` copy is unchanged. Creator baseline `1897420` is an ancestor and was the local main reference during implementation. The corrective changes and targeted developer-switch rollback are being committed for pull-request review at the user's request. No reset, migration against a hosted database, deployment or merge was performed. Remote main may have advanced since the recorded implementation baseline.

## Confirmed causes and corrections

- `8f89185` added Redis-backed quotas/revocation and required `REDIS_URL` at production startup. All consumers now use the existing PostgreSQL database through Prisma. Redis dependencies and active startup/deployment instructions were removed, with no unrelated dependency upgrades.
- The patch rejected demo bypass flags at startup and restricted their use to development/test. The creator's earlier MFA/OTP helpers also contained production guards. The three requested `DISABLE_*` flags now work directly in hosted production. Only developers with backend deployment access configure them; MEGS application roles cannot override them. CAPTCHA, origins, proxy restrictions, token validation, passwords and roles retain their existing protections.
- The apparent 20-resume restriction was an hourly shared AI-operation quota: 20/user, 120/IP, 200/global, shared among uploads, job applications, manual resume analysis and AI search/ranking. It was not a lifetime file count or a 20-file batch size. Resume routes no longer participate in these counters; unrelated AI search/ranking quotas remain. Multipart `fields: 20` bounds non-file fields in one request and is unrelated to cumulative resume counts. Single-file API contracts, size/type/byte validation and owner checks remain.

## Developer-owned Heroku controls and targeted rollback

The creator's main repository, HEAD `189742008300427dedff2c9bb9fdb7a5057499f9`, uses `skip: () => process.env.DISABLE_RATE_LIMIT === "true"` in `backend/src/middleware/rate-limiter.middleware.ts`. That file and its history were inspected before this rollback. The target middleware now follows the same environment-switch behavior, while retaining PostgreSQL shared counters, hashed keys, separate account/IP budgets and fail-closed store errors. The separate main checkout remains untouched.

Removed the newly introduced Database Maintenance security-switch panel, administrator write endpoint, database control overrides, revision/epoch settings and switch-update audit implementation. Core configuration exposes only a read-only status for pending login/OTP forms. Even an authenticated MEGS Administrator cannot change flags through the API. Existing business administration and audit records are retained. No live database was altered.

Developers configure these values in **Heroku app > Settings > Config Vars** on the backend app. Heroku exposes them to Node through `process.env`; changing a Config Var creates a release and restarts the app. A local `.env.example` does not configure Heroku. See [Heroku Config Vars](https://devcenter.heroku.com/articles/config-vars).

| Developer setting | Literal `true` | `false` or unset |
| --- | --- | --- |
| `DISABLE_MFA` | Staff may continue using a verified password-authenticated AAL1 session. Pending MFA forms offer Continue without MFA; the original token, revocation and account state are still checked. | Staff MFA/AAL2 enforcement resumes; affected AAL1 sessions must sign in and verify/enroll. Factors and recovery codes are retained. Notification streams recheck on delivery/heartbeat. |
| `DISABLE_OTP` | Pending registration/reset forms offer Continue without OTP. Code comparison/guess counting are bypassed. | Existing OTP hash/attempt checks resume, including valid pending challenges. |
| `DISABLE_RATE_LIMIT` | Request quota middleware and resend/password-reset cooldowns are skipped. | All retained quotas enforce again against existing unexpired shared counter windows, which survive dyno restarts. An already-exhausted window can still return 429. |

Each flag is independent. Only exact lowercase `true` disables a control. The creator's former production guards for MFA/OTP were deliberately not restored: they would prevent the requested hosted demo switches from working. Runtime production validation still protects CAPTCHA, secrets, origins and proxy configuration.

OTP bypass still requires an existing, unused, unexpired challenge and the appropriate account state. Used, expired or invalidated challenges require a new request. Reset-session expiry, single-use claims and password rules remain. File/resource concurrency gates and provider quotas remain independent of the rate flag. No ordinary MEGS role grants access to Heroku; developer access depends on Heroku permissions.

## Stack and deployment consistency

The manuscript's implementation section (PDF page 47) and proposed technologies (page 59) support React/Tailwind, Node/Express, PostgreSQL and Gemini; page 47 also states Bcrypt/JWT and Nodemailer. Existing Supabase/Prisma authentication, storage and database tooling is retained. No framework, database, infrastructure service or separate cloud deployment was introduced. Matching/ranking mathematics, weights, business state transitions, digital 201 records and API responses were not redesigned.

The existing Procfile starts `node dist/server.js`; no replica topology was changed or inferred from a hosting provider. Atomic PostgreSQL counter upserts and hashed token revocations survive restarts and share enforcement across processes using the same database. Database outages fail closed; missing additive tables fail startup. Expired state is ignored immediately and cleaned in bounded indexed batches every minute.

Resume analysis remains an in-process worker: one active job, waiting admission, same-record deduplication while admitted, and no total-count rejection. Content generation and embeddings share two active Gemini requests per process. More replicas increase provider concurrency accordingly; that limit is not a provider-wide quota. The existing worker is not a durable distributed job system. A process crash can interrupt queued jobs; stored applications remain available for the existing staff analysis retry/manual review workflow. This patch does not claim crash-proof exactly-once delivery.

Gemini 429/500/503 responses receive at most three attempts with exponential backoff/jitter and Retry-After/RetryInfo hints. Hints above 60 seconds and exhausted attempts surface recoverable failures rather than immediate extra requests. Ambiguous cancellations/timeouts are not resubmitted. Quota failure does not trigger another content model/modality. Retries precede profile/score writes; worker failures remain NEEDS_ATTENTION and extraction failures retain UNAVAILABLE feedback. Provider quota tiers, SMTP limits and Supabase availability still apply; no unlimited third-party capacity is promised. See [Gemini API error guidance](https://ai.google.dev/gemini-api/docs/api-errors).

## Verification

Remote main was fetched during commit preparation and has advanced to `991a687`. A non-mutating merge check of the existing hardening branch found conflicts in backend startup, middleware/routes/services, Gemini and frontend notifications. No merge or rebase was performed. Results below validate this branch's local state; integration with current main requires conflict resolution and fresh verification.

- Baseline: 186 backend tests passed.
- Final: **207 backend tests in 35 files** and **14 frontend tests in 3 files** passed.
- Both production builds passed (backend includes Prisma client generation and TypeScript).
- 50 sequential uploads through actual auth/upload middleware for one user/IP passed with mocked extraction. Invalid bytes, missing auth and wrong roles were rejected.
- 50 queued analyses passed, including recovery from throttling at resume 21; each application had exactly one score write/categorization. Same-record retry recovered a persisted NEEDS_ATTENTION failure. A 151-task admission check passed without count rejection or duplicates.
- Independent environment flags in production, pending MFA continuation, restored MFA/OTP checks and quota exhaustion -> developer flag true -> continue -> flag false -> enforcement passed with mocked database/provider boundaries. Authenticated administrator PATCH/POST/PUT attempts at the removed switch endpoint return 404; public configuration mutations return 404. Read-only status performs no settings database access.
- Existing authentication/recovery, notifications, parser formats, scoring/revalidation and security regressions passed. The 205-application paged scoring regression remains unchanged and passed.
- Frontend lint passed with 17 pre-existing warnings; the existing large bundle warning remains. No unrelated cleanup was added.
- Redis-free lockfile consistency passed `npm ci --dry-run --ignore-scripts --offline`; `git diff --check` passed.

**Not run:** live PostgreSQL migrations/row-lock concurrency and transaction rollback integration, live complete server startup against services, hosted browser/demo flows, real Gemini/SMTP/Supabase runs, and the full recruitment/deployment/reporting end-to-end suite. The Docker daemon was unavailable and no disposable PostgreSQL was available. Mock checks are not substitutes for these integrations. No credentials or hosted resources were used.

## Migration prerequisite and patch-only rollback

Before using this backend with a configured database, apply the additive `20261014000000_security_state_without_redis` migration through the existing Prisma workflow. It creates only SecurityCounter and SessionRevocation, without altering/deleting business tables. This migration has not been applied here. Startup checks these tables; Redis is unnecessary.

If replacing a running Redis-based version, outstanding token revocations are not automatically imported. Preserve them at cutover by transferring still-valid hashed revocations or retiring old tokens before switching stores. The same consideration applies when reverting stores; otherwise previously logged-out tokens could become usable until expiry. No live cutover was performed.

The pre-rollback local state is retained in `MEGS-before-developer-switch-rollback.patch`. `MEGS-developer-switch-rollback.patch` records only this developer-switch rollback. Do not reverse the entire corrective patch just to undo the administrator panel.

An exact source patch, including new files, is saved one directory above this checkout as `MEGS-corrective-developer-switches-8f89185.patch`. From this checkout, preserve any later work, then run:

```powershell
git apply --reverse --check "..\MEGS-corrective-developer-switches-8f89185.patch"
git apply --reverse "..\MEGS-corrective-developer-switches-8f89185.patch"
```

Only run the second command if the check succeeds. If later edits conflict, resolve just those patch hunks; do not reset whole commits/files. Reinstall from the restored lockfile and rebuild if actually rolling back. Leave the additive database tables/data in place; they do not require destructive rollback. Reverting code restores the previous Redis requirement and demo/count regressions, so it is a source rollback option, not a recommended hosted state.

## Changed files

```text
.env.example
.gitignore
README.md
backend/.env.example
backend/package-lock.json
backend/package.json
backend/prisma/schema/migrations/20261014000000_security_state_without_redis/migration.sql
backend/prisma/schema/security.prisma
backend/server.ts
backend/src/controllers/core/config.controller.ts
backend/src/controllers/core/mfa-continue.controller.ts
backend/src/controllers/core/notification.controller.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rate-limiter.middleware.ts
backend/src/routes/applicant/applicant.routes.ts
backend/src/routes/applicant/application.routes.ts
backend/src/routes/core/auth.routes.ts
backend/src/routes/core/config.routes.ts
backend/src/routes/ta/ta.routes.ts
backend/src/security/auth-policy.ts
backend/src/security/provider-retry.ts
backend/src/security/public-messages.ts
backend/src/security/runtime-config.ts
backend/src/security/security-controls.ts
backend/src/security/session-revocation.ts
backend/src/security/shared-store.ts
backend/src/services/applicant/applicant.service.ts
backend/src/services/applicant/application.service.ts
backend/src/services/core/auth.service.ts
backend/src/services/scoring/embedding.service.ts
backend/src/services/ta/ta.ai.service.ts
backend/src/utils/gemini.ts
backend/src/workers/resume.worker.ts
backend/tests/security/auth-middleware.test.ts
backend/tests/security/embedding-retry.test.ts
backend/tests/security/logout-route.test.ts
backend/tests/security/mfa-continue.test.ts
backend/tests/security/provider-retry.test.ts
backend/tests/security/reset-concurrency.test.ts
backend/tests/security/resume-automation.test.ts
backend/tests/security/resume-backpressure-proof.test.ts
backend/tests/security/resume-queue.test.ts
backend/tests/security/resume-upload-route.test.ts
backend/tests/security/runtime-config.test.ts
backend/tests/security/security-controls.test.ts
backend/tests/security/shared-budgets.test.ts
backend/tests/security/shared-store-client.test.ts
docs/security-review/corrective-patch-baseline.md
docs/security-review/corrective-patch-report.md
docs/security-review/security-fixes-completed.md
frontend/src/components/auth/MfaChallengeModal.tsx
frontend/src/components/auth/MfaDisabledContinuation.tsx
frontend/src/components/auth/MfaSetupModal.tsx
frontend/src/hooks/useSecurityControls.ts
frontend/src/lib/api/auth.api.ts
frontend/src/pages/auth/ForgotPasswordPage.tsx
frontend/src/pages/auth/RegisterPage.tsx
frontend/tests/security/demo-controls.test.tsx
```
