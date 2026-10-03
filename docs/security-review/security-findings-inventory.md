# MEGS security findings inventory

> **4 October 2026 implementation update:** [Completed source changes, actual verification and open deployment/policy items](security-fixes-completed.md) supersede the review statuses below. This inventory retains the earlier baseline evidence and original finding mapping.

Review date: **3 October 2026 (Asia/Singapore)**. Review baseline: local `main` and fetched `origin/main` at `1897420`. Original review baseline: `dfbfcd6`. Previous security branch: `security/surgical-auth-hardening` at `cf802e5`.

## Scope and count

The original report, `docs/skill-evaluation/findings.md`, contains **12 grouped entries, F01-F12**. Some contain multiple concerns; F11 is a performance review and F12 contains testing and network observations. It does not establish exactly 16 confirmed security vulnerabilities. This inventory preserves its original IDs rather than inventing findings to match a remembered count.

The five patch stages addressed multiple original findings. Git ancestry confirms that both security commits, `32dffb8` and `cf802e5`, are included in current `main`. Later upstream changes altered some of those controls. The companion [remaining-findings report](security-remaining-findings.md) separates **14 current review items**: 11 residual concerns from the original review, one streaming follow-up, and two follow-ups about subsequent key/configuration and test-removal changes. These are a mixture of source-confirmed weaknesses, conditional risks, and verification gaps, not 14 demonstrated production exploits.

The local checkout was fast-forwarded to match GitHub at the user's request. No security implementation, seed, migration execution, key rotation, real email, paid AI call, deployment, or production scan was performed during this review. Pulling upstream brought its existing migration files into the checkout; no migration was executed. This follow-up publishes only the two review reports, a README link and narrow ignore-rule exceptions on `security/remaining-findings-review`, based on the updated main. The earlier branch remains available; its merged work is not reopened or overwritten. Maintainer evaluation happens in a new draft pull request before any merge into main.

## Original findings and current status

| Original ID | Original problem | Current source assessment | Next review item |
| --- | --- | --- | --- |
| F01 | JWT identity accepted without mandatory signature verification | Original bypass addressed: `verifyAccessToken` uses provider `getClaims`, rejects unsupported algorithms and checks issuer, audience, expiry, issued-at, optional not-before, subject and assurance level. Middleware retains the DB user lookup. Actual provider integration and deployed settings were not tested. | R14 for regression coverage |
| F02 | Staff first-factor session could access protected operations without MFA | Original gap addressed when `NODE_ENV=production`: ordinary administrator/TA requests require verified AAL2. Enrollment/challenge/recovery handlers verify identity separately. Recovery requires re-enrollment rather than granting ordinary AAL1 staff access. Later upstream added a non-production `DISABLE_MFA` switch. | R05, R14 |
| F03 | Backup encryption could use a source-public static key | Original public-literal fallback removed and key-version format retained. Later upstream added a production fallback derived from another credential; changing that credential can change the backup key under the same key ID. Dedicated-key enforcement is no longer identical to the original patch. | R13 |
| F04 | Seed could reset staff passwords to known defaults | Original script defaults/reset behavior addressed: explicit credentials, minimum password length, existing-password preservation and forced change for new staff. Seed was not executed; operational provisioning and live credentials remain unverified. | Verification prerequisite |
| F05 | Forced password change bypass through query text | Original bypass addressed: exact method plus `baseUrl`/`path` policy replaces `originalUrl` substring matching. Ordinary requests remain restricted. | R14 |
| F06 | PENDING_VERIFICATION accepted by shared authentication middleware | Original middleware gap addressed: requires both `isActive` and exactly `ACTIVE`. Recovery/onboarding state transitions still need full integration tests. | R01, R14 |
| F07 | Missing production mail config could log invitation tokens and report success | Original missing-transport behavior addressed: production throws; targeted redaction covers Bearer values, named query parameters and six-digit codes. Development mock success remains intentional. This is targeted redaction, not proof that every log in the application is safe. | R10, R14 |
| F08 | Broad CORS, proxy-dependent limits, production bypass flags and Turnstile validation gaps | Still requires review. CORS reflects origins; proxy trust is one hop; limiters use default process-local storage; CAPTCHA/rate-limit disable flags are not confined to tests. Turnstile action is not checked and hostname checking is conditional. | R02-R06 |
| F09 | Public OTP fallback and possibly non-atomic single-use flows | Public OTP literal removed, but explicit secret enforcement was later relaxed outside tests. MFA recovery now atomically claims an unused code with `updateMany` and requires exactly one affected row. Password-reset sessions still perform the external password update before marking the session used. Concurrent reset exploitability remains untested. | R01, R13, R14 |
| F10 | Uploads, service-role storage, external fetching, error exposure and AI trust boundaries | Most remain review items. Latest uploads also accept Word files and WEBP, expanding the parser surface. Existing document-owner/role checks, private bucket creation and short signed URL lifetimes are positive controls. No confirmed SSRF, cross-applicant document bypass or SQL injection is asserted. | R07-R11 |
| F11 | Performance candidates without production measurements | Still a measurement backlog, not established security exploits. Resource exhaustion/cost overlaps R04, R07 and R09. See the performance appendix below. | Performance appendix |
| F12 | Missing clone-visible tests and historical local listener observations | Tests added in `32dffb8` were later removed from current `main`; `.gitignore` now excludes `tests/` and `backend/tests/`. Original local PostgreSQL listener observation is historical and proves neither project ownership nor public exposure. | R14; fresh network scope needed |

## Current review queue

Priorities below indicate review order. Severity depends on access, real deployment configuration and reproduction evidence.

| Order | Item | Review priority | Concern in plain language | Evidence level |
| --- | --- | --- | --- | --- |
| 1 | R13 | High | Backup keys can change when another credential changes | Seen in code and fake-data checks |
| 2 | R14 | High | Security checks are missing from the published test suite | Confirmed in Git history |
| 3 | R01 | High | A password-reset link may be reused by simultaneous requests | Code sequence seen; misuse needs testing |
| 4 | R05 | High | Configuration switches can turn off protection | Code behavior seen; live settings unknown |
| 5 | R07 | High | Uploaded file contents and processing limits need stronger checks | Checks missing in reviewed paths; harmful file not tested |
| 6 | R04 | High | Repeated expensive requests lack shared work limits | Source gap; cost and load not measured |
| 7 | R09 | High | Older resume links can trigger unrestricted downloads | Fetch behavior seen; attacker control unproven |
| 8 | R11 | High | AI scoring and applicant-data sharing need safeguards | Data flow seen; manipulation and provider policy unverified |
| 9 | R12 | Medium | Notification connections can stay open after login permission expires | Connection lifecycle seen; live behavior untested |
| 10 | R10 | Medium | Detailed internal errors may reach users or stored summaries | Error paths seen; secret disclosure needs testing |
| 11 | R06 | Medium | CAPTCHA checks are not fully tied to the intended site and action | Validation gap seen; misuse not demonstrated |
| 12 | R02 | Medium | Browser access rules allow arbitrary websites | Setting seen; account theft not demonstrated |
| 13 | R03 | Medium | Request limits depend on unverified proxy/IP assumptions | Deployment-dependent; forwarding misuse untested |
| 14 | R08 | Medium | Private document access needs a complete permissions check | Verification gap; no cross-user bypass proven |

## Performance appendix: preserve all original candidates

These are investigation candidates, not benchmark results or proven availability attacks.

1. Public jobs use `findMany` without a DB page limit in the reviewed listing path (`backend/src/services/applicant/application.service.ts`). Establish counts, indexes and representative query plans before adding pagination; preserve existing filtering and navigation.
2. Candidate ranking fetches score rows, chooses latest scores and sorts/slices in JavaScript (`backend/src/services/scoring/candidate-scoring.service.ts:236`). Any DB optimization must retain latest-configuration and per-application semantics.
3. Every protected request verifies the token and reads the DB user (`backend/src/middleware/auth.middleware.ts`). Measure cost; retain account-state, role and revocation behavior.
4. Prisma permits 20 connections per process (`backend/src/utils/prisma.ts:8`); queue concurrency is configured separately. Total dynos, queue depth and provider connection budgets are unknown.
5. Backup creation/restoration uses synchronous gzip/gunzip (`backend/src/services/admin/backup.service.ts:200` and `:489`). Encrypted input still needs decompressed-size and work limits. Existing export caps are positive controls; not all exports are unbounded.
6. Gemini fallback uses `Promise.race` without cancelling the timed-out provider operation (`backend/src/utils/gemini.ts:42-55`). Overlapping calls can consume quota; no paid call was made.
7. Frontend query staleness and polling can multiply work across tabs (`frontend/src/providers/QueryProvider.tsx`, notification and applicant hooks). Measure before changing private-data cache behavior.

## Verification record and limits

- Git fetch and fast-forward succeeded. Local `main` and fetched `origin/main` match `1897420`; the security branch remains at `cf802e5`.
- Source was inspected on updated `main`; code references in the companion report refer to that revision.
- Six isolated checks passed using extracted current-source secret-selection helpers and fake credentials: test-versus-production missing-secret behavior for OTP and backups, short-secret replacement, changed derived keys after master rotation, stable dedicated keys, and a synthetic AES-GCM decryption/recovery demonstration. No `.env` loader, real record or provider was used. These checks confirm the concern; they do not show a fix or validate the complete backup format.
- Before updating `main`, the preserved old security worktree ran its existing suite successfully: **34 tests in 7 files**. That result applies to `cf802e5`, not the newer `main`.
- Those tests use mocks and do not establish actual Supabase signature verification, DB concurrency, live MFA, or notification reconnection/expiry behavior. No current-main full test, lint or build success is claimed.
- Current `main` has no tracked security suite; historical type/build blockers were not revalidated and must not be treated as current failures or successes.
- No `.env` file or production secret value was read. Deployment versions, bucket ACL/RLS, provider retention settings, flags and firewall configuration remain unknown.
- No new fix has been implemented in this review. All proposed results in the companion report are acceptance criteria for future work.

## Branch-first review workflow

`security/remaining-findings-review` starts at `1897420` and contains only this review documentation. The original `security/surgical-auth-hardening` branch is preserved at `cf802e5`; its commits are already included in main. The same security worktree folder is reused for the new branch. The creator can review, request changes or reject the new draft PR before deciding on a merge. Publishing these reports does not apply the proposed security fixes.
