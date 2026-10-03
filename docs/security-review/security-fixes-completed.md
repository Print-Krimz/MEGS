# MEGS security fixes: earlier patches and this implementation

Implementation date: **4 October 2026, Asia/Singapore**. Branch: **`megs-security-surgical-auth-hardening`**. Worktree: **`MEGS-security-surgical-auth-hardening`**. Application baseline: main `1897420`; implementation starts from review commit `a515b6e`.

The creator approved the review. This branch adds local fixes and tests; it does not change deployed services. The original checkout and main are preserved. No database migration, seed, live key rotation, backup rewrite, merge or deployment is part of this change.

## The earlier five fixes

These protections were already present in the updated main. This work retains and tests them rather than counting them as new fixes.

| Fix | Problem | Solution and intended result |
| --- | --- | --- |
| 1. Verified login tokens | Forged tokens could be accepted by custom verification. | Use Supabase's supported verification and enforce algorithm, issuer, audience and time claims. Database identity and active-account checks remain. |
| 2. Staff two-step authentication | A staff token without the required second factor could reach staff operations. | Enforce verified AAL2 for administrators and TA staff. Applicants keep their intended access, and authenticated logout remains available. |
| 3. Account and password restrictions | Inactive/pending accounts and URL variations could bypass restrictions. | Require active accounts and use exact route/method exceptions for forced password changes. |
| 4. Secrets and staff setup | Source defaults and seeds could expose or reset staff credentials. | Explicit credentials and password-change requirements protect staff setup. This implementation restores dedicated key enforcement and compatibility after later upstream fallback changes. No seed runs. |
| 5. Authentication data exposure | Tokens could appear in logs/URLs, or missing email configuration could report delivery success. | Remove query-token authentication, redact sensitive messages and fail clearly when production email is unavailable. This implementation completes notification expiration/revocation and broader error boundaries. |

## This implementation, in the review's priority order

“Implemented locally” means source changes and local tests exist. It does not prove production configuration, capacity or provider policy. Some review items were verification gaps, not demonstrated exploits.

| Priority | Item | Problem | Fix and result | Remaining prerequisite |
| --- | --- | --- | --- | --- |
| High | R13 | Changing a database/provider credential could also change backup and OTP keys. | New writes require dedicated secrets consistently. Decryption accepts explicit historical raw keys and multiple historical keys under a reused versioned ID. Synthetic recovery tests cover both formats. | Retain the actual historical keys privately before rollout; do not replace them with guesses. |
| High | R14 | Security tests had disappeared from the published source. | Restore the original tests, add focused regressions and explicitly track them. Add CI that runs without production secrets or services. | GitHub CI execution and branch-protection settings need maintainer review after publishing. |
| High | R01 | Concurrent requests could reuse reset, verification or setup tokens. | Conditional database updates claim a token before privileged work; exactly one claimant proceeds. OTP attempts are bounded atomically. Recovery cannot activate restricted accounts. | Tests mock atomic database operations; real database/provider fault integration remains unverified. |
| High | R05 | Configuration could disable production protections. | Reject production bypass flags and unknown runtime names. Development/test bypasses require explicit local settings. Tests never load local environment files. | Set `NODE_ENV=production` and required settings on the deployment. |
| High | R07 | A file's declared type and small compressed size did not bound its real processing cost. | Check bytes and supported structure, archive expansion, image dimensions, parser deadlines and admission. Keep PDF, DOCX, binary DOC, JPEG, PNG and WEBP. Cap backup expansion and simultaneous maintenance. | Structural checks are not malware scanning; worker heap limits are not an OS-level total-memory guarantee. Validate deployment capacity and real backup size. |
| High | R04 | Counters reset across processes; costly work lacked separate budgets. | Redis-backed user/IP/global quotas, separate authentication identities, bounded resume queue with deduplication, and local concurrency limits. Bulk scoring reads 100 applications at a time and waits for queue capacity; individual scoring still waits for completion. Return 429/retry metadata. AI timeouts abort local requests and stop timeout fallback duplication. | Provision a private shared Redis service and verify ACLs/capacity. Limits are starting safeguards, not measured production capacity. |
| High | R09 | Older resume links could fetch arbitrary destinations. | Exact HTTPS host allowlist, DNS/IP checks, pinned TLS destination, no redirects, bounded bytes and deadlines. Internal document references must match the application's owner. | Configure approved canonical legacy hosts/URLs. Rejected redirected or unapproved historic links need owner review. |
| High | R11 | Resumes could instruct the AI; unvalidated answers could affect records. | Separate system instructions from bounded source data; strictly validate resume scores, summary, arrays and allowed fields. Invalid results are not applied. **Automatic categorization remains enabled by the user's decision.** | This cannot guarantee resistance to a plausible manipulated score. Consent, provider retention/location and hiring-policy review remain open. |
| Medium | R12 | Notifications could outlive token/account permission. | Use verified expiry, shared revocation of the presented token, account checks before delivery and at 30-second heartbeats, and stream cleanup. Read current tokens on reconnect; bound retries and stop on 401/403. Synchronize cross-tab identity changes. | Revocation of the presented token is immediate across configured instances; idle connections close on the next heartbeat. Other existing access tokens follow their own expiry/provider semantics. |
| Medium | R10 | Provider errors could expose internal data. | Fixed public messages and sanitized 5xx responses with log references; retain form validation and controlled domain feedback. Omit raw exception payloads from error/warning logs, sanitize sensitive mail logs and stored worker summaries, and close export/batch error paths. | Operators receive operation/reference information, not raw provider payloads. Add deliberate safe diagnostics when needed; never expose secrets. |
| Medium | R06 | CAPTCHA was not bound to the expected site/action. | Require exact hostnames and the existing signup/login/forgot-password widget actions; reject missing claims. | Configure exact production/approved-preview hostnames and existing site/secret keys together. No Cloudflare call was made during tests. |
| Medium | R02 | Any website could receive browser-access permission. | Exact configured HTTPS origins in production, explicit localhost development origins, compatible preflight/Bearer/notification access, and support for clients without an Origin header. | List every approved frontend/preview explicitly. CORS is not an authentication mechanism. |
| Medium | R03 | Limits relied on an assumed proxy hop. | Default to no forwarded-header trust; require explicit production policy. Reject blanket/mapped blanket ranges. Synthetic forwarding tests cover trusted and untrusted chains. | **Production ingress topology remains unverified.** Use a hop count only when every reachable path has that mandatory topology. |
| Medium | R08 | Privileged storage required complete ownership assurance. | Owner/staff checks precede signing on download, preview and resolver paths. Failed resolution cannot return the original private path. Refuse public buckets. Keep existing global TA/admin scope and short-lived links. | Cloud bucket policies/ACL/RLS and intended staff assignment scope were not queried. A public bucket will now fail clearly until its owner corrects configuration. |

## Behavior preserved and explicit changes

- Applicants retain normal login, verified onboarding, self-owned documents and applications. Staff retain AAL2 access and the existing review scope. Password-change and logout routes keep explicit exceptions.
- One valid token use succeeds. An ambiguous provider or database failure after claiming a reset/setup/OTP token leaves it consumed. Request a new code or invitation rather than reopening a token that might already have changed credentials.
- Resume submissions are saved even when the queue is full, with a clear manual-review summary. TA reanalysis is refused before changing processing state when admission is unavailable.
- Unsupported or oversized files are rejected before storage. Small valid PDF/DOCX/DOC fixtures run through the actual isolated parsers. Approved legacy links served as generic binary content are detected from their bytes.
- Logout is authenticated but exempt from exhausted login budgets. Shared-store failure denies access; it does not permit a bypass or report successful revocation.
- Dedicated secrets must reproduce the desired existing effective keys, or use a separately approved transition. Pending OTPs issued under a changed key require resending. No live transition is performed here.

## Configuration and rollout prerequisites

1. Set `NODE_ENV=production`. Leave `DISABLE_CAPTCHA`, `DISABLE_RATE_LIMIT`, `DISABLE_OTP` and `DISABLE_MFA` false/unset. Dedicated `OTP_SECRET` and `BACKUP_ENCRYPTION_SECRET` require at least 32 characters; generate/retain suitable random values privately.
2. Preserve backup provenance. Original raw envelopes need `BACKUP_ENCRYPTION_LEGACY_SECRETS`; versioned envelopes use `BACKUP_ENCRYPTION_LEGACY_KEYS`, for example `{"v1":["historical-secret-one","historical-secret-two"]}`. Those placeholder values are **not usable credentials**. Same-ID recovery must include the actual former dedicated or derived secret. The upstream derivation was HMAC-SHA256 over the former master credential with label `megs-BACKUP_ENCRYPTION_SECRET-v1`; this report does not recover that credential. Keep the current effective key and a distinct ID for any future approved key change.
3. Configure `FRONTEND_URL`, optional comma-separated `CORS_ALLOWED_ORIGINS`, exact `TURNSTILE_HOSTNAMES`, and `TURNSTILE_SECRET_KEY` or the existing `TURNSTILE_SECRET` alias. Production frontend origins must be HTTPS origins without paths.
4. Set `TRUST_PROXY` after confirming ingress. `false` ignores forwarded addresses. Exact trusted address/CIDR lists are supported. A value such as `1` is safe only if all reachable routes have exactly the required trusted hop; no such live topology was verified here.
5. Configure `REDIS_URL` privately (prefer encrypted transport and private ingress). Instances must share the same store/key prefixes. Verify SCRIPT/LOAD, EVALSHA, counter and TTL operations, and SET/EXISTS for revocation. No silent in-memory fallback is allowed in production. Connection/command deadlines are five seconds; a terminal outage requires process restart, while requests fail closed.
6. Review initial quotas: combined login key 5/15 minutes; independent account 30/15 minutes and IP 100/15 minutes; mail account 2/hour. AI/ranking/profile resume extraction user 20/hour and global 200/hour; reports 30/user/hour and 600 global/hour; backup/restore and scoring-configuration changes each 6/user/hour and 24 global/hour; analytics 180/user/15 minutes and 3,000 global/15 minutes. Operation IP budgets are six times their user budgets. Scoring keeps 15 active tasks and at most 100 queued tasks per process with producer backpressure; resume analysis keeps at most 100 admitted jobs including the active job. Tune only after measured staging use, while retaining independent shared limits.
7. Files: 5 MiB input; DOCX 512 entries, 8 MiB/entry and 32 MiB total expansion; images 40 million pixels, WEBP at most 100 frames. At most four buffered uploads and two parser workers per process. Parser deadline is ten seconds with 96 MiB old-generation heap; external buffers remain outside that heap cap. Maintenance reserves one operation before upload buffering; backups allow 50 MiB compressed, 128 MiB expanded and 250,000 records. Larger legitimate historical backups require a reviewed offline recovery plan, not disabling bounds.
8. Add exact `LEGACY_RESUME_HOSTS` only for legitimate canonical HTTPS sources. The configured Supabase hostname is already allowed. Downloads reject redirects, private/special addresses, more than 5 MiB and more than 15 seconds, including a three-second DNS deadline.
9. Keep production SMTP and prior JWT configuration. Verify private buckets and hosting permissions in separately approved staging/cloud checks. Confirm AI applicant-data consent/retention/location with the owner.

## Verification

Available baseline: the restored original suite passed 34 tests across seven files before implementation. Initial backend type checking failed against a stale generated Prisma client; frontend type checking lacked the already-declared Leaflet package. Both local dependency issues were repaired. Prisma generation used a synthetic URL and did not connect to or migrate a database.

Final combined verification on 4 October 2026, using Node 24.12.0 locally:

| Check actually run | Result |
| --- | --- |
| Backend Vitest suite | **186 tests passed across 28 files**. |
| Frontend Vitest suite | **11 tests passed across two files**. |
| Backend TypeScript `tsc --noEmit` and `tsc` | Both passed; compiled backend produced successfully. |
| Frontend TypeScript `tsc -b` | Passed. |
| Frontend Oxlint | Passed with the same 17 pre-existing warnings; no new lint failures. No backend lint script is configured. |
| Frontend Vite production build | Passed; existing bundle-size warning remains (largest chunk about 902 kB). |
| `node tests/security/compiled-parser-compatibility.cjs` | Passed: production-compiled workers extract PDF, DOCX and binary DOC offline. |
| Git whitespace check | Passed. |
| Dependency advisory comparison | Actually executed for unchanged main and the patched lockfile; remaining entries are listed below. |

Tests use local fixtures and provider/store mocks. Real RSA signatures pass through Supabase's supported verifier with a mocked JWKS HTTP response. PDF/DOCX/DOC extraction uses actual parser workers. No applicant data, live login, real email, AI request, seed, backup restoration or production scanning is used. CI targets Node 22; that remote runtime/workflow has not yet been executed.

## Files changed

| Area | Main files |
| --- | --- |
| Authentication and one-time codes | `backend/src/services/core/auth.service.ts`, `backend/src/security/auth-policy.ts`, `auth-token.ts`, `backup-crypto.ts`, `backend/src/utils/otp.ts`, auth middleware/controller/types. |
| Runtime and request/work limits | `backend/server.ts`, `backend/src/security/runtime-config.ts`, `shared-store.ts`, `session-revocation.ts`, `bounded-work-queue.ts`, rate/maintenance middleware, auth/admin/TA/applicant routers, scoring revalidation service. |
| Files, storage and resume analysis | Upload middleware; `security/file-validation.ts`, `document-parser.ts`, `backup-limits.ts`, `legacy-resume-download.ts`; backup/document/applicant/application/employee/TA services; resume worker and TA analysis controller. |
| AI and error boundaries | `backend/src/utils/gemini.ts`, `mailer.ts`, `response.ts`, `env.ts`; `security/ai-output.ts`, `errors.ts`, `public-messages.ts`; audit/maintenance export and invitation batch boundaries. |
| Notifications and session UI | Notification controller, `frontend/src/lib/notification-stream.ts`, `useRealtimeNotifications.ts`, `AuthProvider.tsx`. |
| Dependencies, tests and documentation | Backend package/lockfile; root/backend/frontend ignore exceptions; 28 backend and two frontend test files, offline fixture/license and compiled-parser check; `.github/workflows/security-checks.yml`; `.env.example`, README and the three review Markdown files. |

### Additional dependency advisories

The public npm advisory check found 19 affected backend package entries on unchanged main (one critical, nine high, nine moderate). Compatible updates to Multer and Vitest remove the upload-parser entries and the critical test-server advisory. The current check still lists **18 affected package entries: eight high and ten moderate**. These counts include transitive/dev dependencies and are not proof that every advisory is reachable in this app.

Remaining entries: `@hono/node-server`, `@prisma/config`, `@prisma/dev`, `@vitest/mocker`, `brace-expansion`, `deepmerge-ts`, `exceljs`, `fast-uri`, `hono`, `ip-address`, `mysql2`, `nanoid`, `nodemailer`, `prisma`, `qs`, `uuid`, `valibot`, `vitest`. No forced major upgrades/downgrades were applied. This remains a separate dependency-maintenance review; **do not describe this branch as free of all known vulnerabilities**.

### What was not verified

- Actual Redis Lua/ACL behavior or disposable database/provider fault integration: Docker is installed, but its daemon is unavailable. Mocked shared-store and atomic-claim tests are explicitly not substitutes for those integrations.
- Live hosting/proxy topology, cloud storage ACL/RLS, secrets presence, backup key provenance, database size/capacity, deployment version or Gemini retention/consent.
- GitHub workflow execution, merge protection, hosted browser journeys or production load. CI is added but cannot be said to have passed before running remotely.
- Semgrep, CodeQL, Nmap, k6 and jq are unavailable in the local toolchain; no scanner or load-test success is claimed.

## Skills and scope

Applied the installed security audit/auditor, API security design/testing, backend/frontend security, Node, TypeScript, database/concurrency, React and architecture guidance to the relevant patches and validation. The feature workflow instructed separate implementation and security review; cross-review caught and corrected logout parsing, quota ordering, proxy range equivalence, IPv6 URL checks and parser termination issues. Design/Tailwind guidance required no UI redesign, and performance guidance was used for bounded work rather than unsupported performance claims. Missing scanner tools were reported rather than emulated as successful scans.
