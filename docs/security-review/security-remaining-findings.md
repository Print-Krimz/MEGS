# MEGS remaining security findings and proposed fixes

> **Implementation update, 4 October 2026:** The creator approved this review. Local patches and verification now live on `megs-security-surgical-auth-hardening`. Read [the compiled earlier and current fixes, results and rollout prerequisites](security-fixes-completed.md). The evidence and proposed changes below remain the **historical 3 October review snapshot**, not a claim about the patched source or deployed configuration.

**Review only - no security implementation authorized in this phase.** Date: 3 October 2026 (Asia/Singapore). Source baseline: `1897420`. Review branch: `security/remaining-findings-review`, created from the updated `origin/main` in the existing `MEGS-security-surgical-auth-hardening` worktree. See [the full inventory](security-findings-inventory.md) for the original F01-F12 mapping and completed work.

## What this report means

The original review grouped its concerns into 12 entries, not exactly 16 confirmed vulnerabilities. This report breaks the residual security work into 14 review items. Eleven come from original concerns, R12 is a notification-lifecycle follow-up, and R13-R14 reflect later upstream changes. Findings labelled conditional or verification gap require additional evidence before being called exploitable vulnerabilities. Suggested priorities are review order, not measured CVSS scores.

Each item states the problem, current evidence, realistic impact, proposed solution, functionality to preserve, and the test/result needed before closing it. **Proposed solution and expected result do not mean a fix has been applied.** No production scanning, real emails, AI requests, seed execution, migrations or live changes were performed.

## Highest-to-lowest review priority

High-priority items appear first, followed by medium-priority items. Within each group, the order reflects impact, dependencies and practical next steps. This is a review order, not a claim that every item is a confirmed live vulnerability. No critical or low-severity item has been established in this follow-up. Finding IDs stay unchanged so earlier references remain valid.

| Order | Priority | Item | Problem in plain language | Current evidence |
| --- | --- | --- | --- | --- |
| 1 | High | R13 | Backup keys can change when another credential changes | Seen in code and fake-data checks |
| 2 | High | R14 | Security checks are missing from the published test suite | Confirmed in Git history |
| 3 | High | R01 | A password-reset link may be reused by simultaneous requests | Code sequence seen; misuse needs testing |
| 4 | High | R05 | Configuration switches can turn off protection | Code behavior seen; live settings unknown |
| 5 | High | R07 | Uploaded file contents and processing limits need stronger checks | Checks missing in reviewed paths; harmful file not tested |
| 6 | High | R04 | Repeated expensive requests lack shared work limits | Source gap; cost and load not measured |
| 7 | High | R09 | Older resume links can trigger unrestricted downloads | Fetch behavior seen; attacker control unproven |
| 8 | High | R11 | AI scoring and applicant-data sharing need safeguards | Data flow seen; manipulation and provider policy unverified |
| 9 | Medium | R12 | Notification connections can stay open after login permission expires | Connection lifecycle seen; live behavior untested |
| 10 | Medium | R10 | Detailed internal errors may reach users or stored summaries | Error paths seen; secret disclosure needs testing |
| 11 | Medium | R06 | CAPTCHA checks are not fully tied to the intended site and action | Validation gap seen; misuse not demonstrated |
| 12 | Medium | R02 | Browser access rules allow arbitrary websites | Setting seen; account theft not demonstrated |
| 13 | Medium | R03 | Request limits depend on unverified proxy/IP assumptions | Deployment-dependent; forwarding misuse untested |
| 14 | Medium | R08 | Private document access needs a complete permissions check | Verification gap; no cross-user bypass proven |

The detailed sections below use the same order. Technical filenames and methods are retained where they are needed to verify a finding.

## R13 - Later fallback changes couple OTP/backup keys to other credentials

**Priority / status:** High operational review priority; source-confirmed change, not a return to a source-public secret. F03/F09 follow-up.

**Problem / evidence:** `backend/src/utils/otp.ts:4-21` accepts a dedicated secret when sufficiently long; otherwise, outside tests, it derives a value from `SUPABASE_SECRET_KEY` or `DATABASE_URL`. `backend/src/security/backup-crypto.ts:10-26` applies the same style of fallback to backup encryption. Test/Vitest mode throws instead. Backup key ID still defaults to `v1` (`:40-50`).

**Possible impact and conditions:** Rotating the master credential can silently change the derived backup key under the same key ID, making backups unreadable without the old derived key. A short explicit secret is silently replaced outside tests, concealing configuration mistakes. OTPs issued before such a rotation may stop verifying. Tests exercise stricter behavior than runtime. The public HMAC label alone does not expose the derived key because the master credential remains an input; no deployed credential compromise is claimed.

**Proposed solution:** Agree on explicit dedicated secrets or a documented stable derivation/version policy. Check configuration consistently across modes. Preserve key provenance, old key IDs and legacy recovery before any eventual change. For fallback-derived versioned backups, an explicit legacy raw secret alone does not necessarily address the same-ID key lookup: plan recovery against the actual format and key ID.

**Preserve:** Recovery of backups created before and after both the original patch and later upstream changes. Never rotate credentials or re-encrypt existing backups during this review.

**Acceptance tests / expected result:** Synthetic mode matrix covers missing/short secrets; synthetic master-key rotation demonstrates and then prevents recovery loss; all supported formats/key IDs decrypt with their intended retained keys. No live backups or credentials may be used. **Synthetic source-helper checks are recorded in the verification section; no fix is applied.**

## R14 - Published main no longer contains the security regression tests

**Priority / status:** High verification priority; confirmed test-distribution gap, not an exploit by itself. Original F12 follow-up.

**Problem / evidence:** `git ls-files backend/tests` returns no files on `1897420`. Git history records the tests in `32dffb8` and their removal in `5456427`. Current `.gitignore` excludes both `tests/` and `backend/tests/` plus common test extensions.

**Possible impact:** A fresh clone cannot reproduce the security suite, and later changes can diverge from its assumptions unnoticed. The preserved security worktree still has the old suite, but its result does not validate the new main.

**Proposed solution:** Restore maintainable security tests and narrow ignore exceptions on a future review branch, add compatible tests for current production-mode behavior, and wire them into CI. Use disposable data and mocks for external providers. Real cryptographic fixtures should complement verifier mocks without contacting production.

**Preserve:** Existing application build/runtime behavior and reproducible developer tests. No restored test is authored in this review-only phase.

**Acceptance tests / expected result:** A fresh clone runs the suite and CI detects unsafe auth/config changes. Add real signed-token fixtures, reset concurrency, file/parser limits and notification expiry/reconnection tests as appropriate. **Current-main regression suite could not be run because the files are absent.**

## R01 - Password-reset sessions are not atomically claimed

**Priority / status:** High review priority; source-confirmed ordering, concurrent reuse not reproduced. Original F09.

**Problem:** Two requests can both read a reset session as unused before either marks it used. The provider password update happens between these steps, so the current code does not reserve the token before doing privileged work.

**Evidence:** `backend/src/services/core/auth.service.ts:542` reads `isUsed:false`; `:561` updates the Supabase password; `:578` marks the session used. MFA recovery is different: `backend/src/services/core/mfa.service.ts:246` atomically updates only an unused code and checks `consumed.count === 1`.

**Possible impact and conditions:** An actor already holding a valid reset token may attempt simultaneous reuse. Final password/state ordering and exploitability need a controlled DB test; this is not unauthenticated password theft without a token. Recovery also sets local `accountStatus` to ACTIVE, so account eligibility should be rechecked before mutation.

**Proposed solution:** Claim an unexpired, unused session with a conditional update before provider mutation; require exactly one successful claimant. Define failure/retry handling across the external provider and local DB so it cannot reopen a token after a successful password change. Review registration OTP and invitation read/consume flows in the same focused pass.

**Preserve:** One normal reset, expired-token rejection, legitimate retries after a clearly failed provider call, and restricted-account policy. Existing `isUsed`/expiry fields may be sufficient; decide whether a reservation state is essential before proposing a migration.

**Acceptance tests / expected result:** Isolated concurrent requests sharing one synthetic token cause at most one provider mutation; subsequent replay fails. Cover expiry, inactive account, provider failure and DB failure. Use a disposable DB and provider mocks, never live accounts. **Not executed in this phase.**

## R05 - Some bypass flags remain usable in production

**Priority / status:** High review priority; source-confirmed switches, live values unknown. Original F08.

**Problem / evidence:** `backend/src/middleware/turnstile.middleware.ts:15` skips CAPTCHA for `DISABLE_CAPTCHA=true` or test mode. `backend/src/middleware/rate-limiter.middleware.ts:54,68` honors `DISABLE_RATE_LIMIT=true` without a production guard. Later upstream permits OTP bypass outside production (`auth.service.ts:26`) and MFA bypass outside production (`security/auth-policy.ts:22`). Production OTP/MFA guards remain positive controls.

**Possible impact and conditions:** A misconfigured public deployment could disable anti-abuse protections or run with development authentication behavior. Source switches do not prove the live deployment uses them.

**Proposed solution:** Validate runtime mode and flags centrally at startup. Fail clearly on forbidden production bypass combinations and isolate test behavior. Review production configuration privately using presence/boolean checks, without printing credentials.

**Preserve:** Automated mocks and deliberate local development flows; actual production MFA/OTP enforcement must remain mandatory.

**Acceptance tests / expected result:** A table of production/development/test modes and flags proves which bypasses are accepted; production rejects unsafe settings. **Configuration matrix not executed.**

## R07 - Uploaded bytes and parser workloads need stronger validation

**Priority / status:** High; source gap, hostile-file exploit untested. Original F10 and F11.

**Problem / evidence:** `backend/src/middleware/upload.middleware.ts:7-26` buffers up to 5 MiB and checks client-declared MIME type. It now allows PDF, Word, JPEG, PNG and WEBP. `backend/src/workers/resume.worker.ts:88-125` detects format using metadata/extension; `:233-276` invokes Word/PDF parsers and multimodal fallback. No content-signature check, expanded archive bound or parser work deadline was found in these paths. Admin backup uploads buffer up to 50 MiB; restoration uses synchronous decompression.

**Possible impact and conditions:** Mislabeled files, highly compressed documents, malformed parser inputs and simultaneous uploads can waste memory/CPU or provider budget. No parser code-execution vulnerability or confirmed decompression attack is asserted.

**Proposed solution:** Check file signatures/structure and allowed formats for each endpoint, constrain decompressed bytes/parser work, and bound concurrent buffering. Treat encrypted backup authentication and decrypted archive validation as separate controls. Isolate heavy parsing when needed.

**Preserve:** Recently added legitimate Word/WEBP/image and scanned-PDF workflows, private storage, UUID naming and required preview/download behavior. Do not silently remove supported document formats to make tests pass.

**Acceptance tests / expected result:** Synthetic mislabeled/truncated files are rejected; oversized/expansion-heavy inputs stop within bounds; valid supported fixtures parse successfully; excessive concurrency is contained. **Hostile-file tests not executed.**

## R04 - Authentication limits are process-local; costly routes lack explicit quotas

**Priority / status:** High; source gap, real abuse/cost not measured. Original F08 and F11.

**Problem / evidence:** `backend/src/middleware/rate-limiter.middleware.ts:49-70` configures no shared store. The inspected TA/admin routers have authentication/role checks but no operation-specific limiter for AI, ranking, analytics, exports or backups. Auth keys combine IP/email, so one key does not constitute a global user/IP/provider budget. Queue concurrency and export caps exist but are not total work or cost quotas.

**Possible impact and conditions:** Scale/restarts can split/reset counters. An authorized abusive or compromised account may consume expensive work, memory, DB capacity or paid API budget. Exact sustainable thresholds are unknown.

**Proposed solution:** Add deployment-appropriate shared limits and separate per-user, per-IP and expensive-operation budgets. Bound queue admission, payload sizes and concurrent work; return consistent 429 responses and retry metadata. Cancel timed-out Gemini work when supported rather than merely abandoning its response.

**Preserve:** Normal bursts, retry behavior, recruiter batch workflows and deterministic scoring/report output. Choose limits from a local workload baseline and business needs.

**Acceptance tests / expected result:** Synthetic requests across multiple process instances share limits; costly work is rejected before provider calls beyond the budget; failure/retry behavior is explicit. Use mocked providers and local fixtures. **No load or paid-call test executed.**

## R09 - Legacy resume fetching has no explicit destination, time or size policy

**Priority / status:** High investigation priority; source behavior confirmed, attacker-controlled URL path unproven. Original F10.

**Problem / evidence:** `backend/src/workers/resume.worker.ts:54-80` falls back to HTTP fetch, allows relative URLs to resolve locally, and reads the whole response via `arrayBuffer`. It has no explicit timeout, streamed-size cap or destination/redirect policy. Internal stored-document downloads are a separate supported path.

**Possible impact and conditions:** If an attacker-controlled legacy/import URL can reach this function, internal-service access or large/slow downloads may become possible. **SSRF is not confirmed** without that provenance and reachability evidence.

**Proposed solution:** Trace all writers/imports of `resumeUrl`; prefer stored-document references. For required legacy fetches, allow only approved destinations/protocols, validate each redirect and resolved address, and impose total time and byte limits.

**Preserve:** Legitimate existing/imported resumes and internal document references. Review existing URL formats before restricting them.

**Acceptance tests / expected result:** Local fake fetch responses cover redirects, private destinations, slow and oversized content, plus valid approved legacy data. Prove a caller can supply a URL before promoting the concern to an exploit finding. **No external fetching test executed.**

## R11 - AI input integrity and applicant-data transfers need review

**Priority / status:** High review priority; source trust boundary, manipulation/privacy impact unverified. Original F10.

**Problem / evidence:** `backend/src/utils/gemini.ts:79-108` combines untrusted resume text with evaluation instructions. New multimodal paths also send document content; `backend/src/services/scoring/embedding.service.ts:37` sends embedding input to Google. `backend/src/workers/resume.worker.ts:310-311` invokes score categorization after storing the model score. JSON structure checks and score clamping exist but do not establish evaluation integrity.

**Possible impact and conditions:** Resume instructions may influence scoring and downstream categorization. Applicant PII crosses a third-party boundary; consent, retention, geography and provider settings are unknown. This does not establish arbitrary code execution or a privacy-law violation.

**Proposed solution:** Treat resume content explicitly as data, validate structured outputs and provenance, and add review gates for consequential automated decisions. Define data minimization, applicant notice and permitted provider retention before changing transfers. Ensure fallback models follow the same policy.

**Preserve:** Useful resume extraction/ranking and staff decision workflows; do not remove functionality without a defined replacement.

**Acceptance tests / expected result:** Offline malicious-resume fixtures with mocked outputs cannot bypass score/schema/state rules; inspect what data would be sent without sending real resumes. Human-review and provider-policy decisions need owner input. **No real AI calls or policy verification executed.**

## R12 - Notification streams are authorized only when opened

**Priority / status:** Medium; source-confirmed lifecycle gap, runtime impact untested. Follow-up to patch stage 5.

**Problem / evidence:** `backend/src/routes/core/notification.routes.ts` authenticates the stream request. `backend/src/controllers/core/notification.controller.ts:12-39` then registers a listener and heartbeat until disconnection, with no token-expiry timer or account-state recheck. The frontend already uses Bearer headers (`frontend/src/hooks/useRealtimeNotifications.ts:55-65`) and captures that token once for the effect; it has no explicit refreshed-token/terminal-auth handling in the stream callbacks.

**Possible impact and conditions:** A connected stream can outlive token validity or account changes. Reconnection may reuse a stale token and repeatedly fail. Query-string token acceptance is already removed; that completed fix remains intact.

**Proposed solution:** Carry verified expiration into the stream policy, end/clean up streams at expiry and relevant revocation, and reconnect with the current valid token. Define handling for 401/403, network retry and polling fallback; bound retries rather than looping forever.

**Preserve:** Realtime toasts, unread counts, per-user isolation, heartbeat, reconnect after transient network loss and polling fallback.

**Acceptance tests / expected result:** Fake timers and mocked streams cover expiry, logout, account deactivation, token replacement, transient reconnect, terminal auth failure and listener/timer cleanup. The earlier README/PR expiration claim exceeded the inspected implementation; it should be corrected when documentation is next published. **No streaming integration test executed.**

## R10 - Internal errors can reach API responses and stored summaries

**Priority / status:** Medium; propagation confirmed, sensitive content untested. Original F10 and residual F07 log scope.

**Problem / evidence:** `backend/server.ts:109` returns `err.message`; multiple controllers also use provider messages. `backend/src/workers/resume.worker.ts:203,286` stores processing-error details in `aiSummary`. Mail redaction at `backend/src/utils/mailer.ts:16-20` covers selected token patterns; it is not a global log sanitizer.

**Possible impact and conditions:** Provider errors may disclose internal identifiers, URLs, infrastructure details or personal data if those values are present in the message. The source path exists; a sensitive disclosure has not been demonstrated on current main.

**Proposed solution:** Use explicit public error codes/messages, retain useful domain validation messages, and send detailed redacted diagnostic context to controlled logs. Apply targeted redaction at sensitive logging boundaries and avoid storing raw provider details in user-visible summaries.

**Preserve:** Form validation, permission feedback, retry behavior and operator diagnostics. Generic errors must not hide recoverable business failures.

**Acceptance tests / expected result:** Inject synthetic provider exceptions containing fake credentials/signed URLs/PII; public responses and summaries contain none of them, while safe logs retain a correlation ID. **Not executed.**

## R06 - Turnstile action and hostname checks are incomplete

**Priority / status:** Medium; source-confirmed validation gap, token misuse untested. Original F08.

**Problem / evidence:** `backend/src/middleware/turnstile.middleware.ts:78-111` reads an `action` but does not validate it. Hostname validation runs only when both configuration and a returned hostname exist; a missing hostname therefore skips that configured check. Missing secret and unsuccessful verification already fail closed.

**Possible impact and conditions:** Tokens may not be bound as tightly as intended to a specific frontend and login/registration/reset action. Widget setup and production values are unknown.

**Proposed solution:** Define expected action per route with corresponding widget actions, require the configured hostname check to pass, and handle missing claims explicitly. Establish compatible rollout configuration before tightening it.

**Preserve:** Normal CAPTCHA completion, approved previews, retry UI, timeout and provider-unavailable responses.

**Acceptance tests / expected result:** Mock verification responses with wrong/missing action or hostname fail; valid expected action/hostname succeeds. **No Cloudflare calls or dynamic tests executed.**

## R02 - CORS reflects arbitrary origins

**Priority / status:** Medium; source-confirmed configuration, conditional security impact. Original F08.

**Problem / evidence:** `backend/server.ts:16-17` uses `origin:true` and `credentials:true`, without a list of trusted frontend origins.

**Possible impact and conditions:** Unexpected websites can make CORS-authorized browser requests. They do not automatically obtain the victim's localStorage Bearer token; CORS alone is not evidence of account compromise. Risk changes if credentials become cookie-based or an attacker obtains a token.

**Proposed solution:** Configure exact intended origins for production and explicit development origins. Decide how approved Vercel previews are authorized. Permit appropriate non-browser requests without Origin; do not use an unrestricted domain suffix or global wildcard.

**Preserve:** Production frontend, approved preview environments, local development, OPTIONS preflight, Authorization and Turnstile headers, and notification streaming.

**Acceptance tests / expected result:** Approved origin/preflight succeeds, arbitrary origin gets no CORS permission, and legitimate non-browser clients still work. Confirm deployment origin values with the owner. **Not executed.**

## R03 - Proxy trust may misidentify the client IP

**Priority / status:** Medium; deployment-dependent risk. Original F08.

**Problem / evidence:** `backend/server.ts:12` trusts one proxy hop. `backend/src/middleware/rate-limiter.middleware.ts:25-42` uses `req.ip` in limiter keys.

**Possible impact and conditions:** A different proxy topology or direct access could attribute traffic to the wrong client or accept untrusted forwarded addresses. Current Heroku/Vercel routing, direct reachability and actual spoofing have not been tested.

**Proposed solution:** Document the real trusted ingress path, restrict direct backend exposure where appropriate, and set proxy trust for that topology. Avoid blindly trusting every forwarded address or copying a hop count from another environment.

**Preserve:** Shared-office clients, IPv4/IPv6 normalization, health checks and rate-limit fairness.

**Acceptance tests / expected result:** Synthetic trusted/untrusted forwarding chains yield the intended client identity and forged forwarding does not evade limits. Platform topology must be established before implementation. **Not executed.**

## R08 - Service-role storage access needs end-to-end assurance

**Priority / status:** Medium; verification gap, not a confirmed authorization bypass. Original F10.

**Problem / evidence:** `backend/src/utils/supabase.ts` deliberately uses privileged storage access. `backend/src/services/document/document.service.ts:53-107` checks document owner or TA/admin role before creating 60/300-second signed URLs. Those checks are positive controls. Existing bucket configuration, ACL/RLS and intended scope of staff access have not been queried.

**Possible impact and conditions:** A missed application ownership check or wrong public-bucket setting would matter because the backend is privileged. Global TA/admin access may be intended; no tenant/recruiter-isolation rule was supplied.

**Proposed solution:** Inventory every download/preview/resolve/export path, enforce its documented ownership policy, and verify bucket privacy and signed URL lifetimes. Resolve staff assignment scope with the owner before changing authorization.

**Preserve:** Authorized staff review, applicant self-access and valid expiring previews. Do not assume privileged SDK use is itself a vulnerability.

**Acceptance tests / expected result:** Cross-applicant access is denied across every path; authorized owner/staff cases work; deleted documents and expired links fail. Cloud settings require separately scoped read-only verification. **Not tested on current main.**

## Suggested implementation sequence for later approval

1. R13 + R14: establish backup/key compatibility and restore credible regression protection before touching security-critical behavior.
2. R01: prove and fix reset concurrency with failure-state handling.
3. R05 + R06: tighten production switches and CAPTCHA binding with compatible frontend/configuration changes.
4. R04 + R07 + R09: control expensive work and hostile input; establish URL provenance before any SSRF claim.
5. R12: finish stream expiration, revocation and reconnect behavior.
6. R02 + R03: constrain origins/proxy trust after confirming actual topology and preview needs.
7. R10 + R08 + R11: complete error/log boundaries, storage-access assurance and AI/data-governance decisions.

All stages require an isolated branch, focused compatibility tests and review before publishing. No database migration is presumed necessary; explain the need before any later migration work.

## Verification and handoff

- Local main was safely fast-forwarded to fetched GitHub main at `1897420`; both prior security commits are ancestors. No security branch was rebased or overwritten.
- New review consists of source tracing, tracked-file/history checks, and isolated synthetic helper checks. No current-main full test/lint/build success is claimed.
- **Six isolated checks passed** using extracted current-source OTP/backup secret-selection helpers and fake credentials. They confirm missing-secret test/runtime divergence, silent short-secret replacement, key changes after master rotation, dedicated-key stability, and synthetic AES-GCM recovery with the original derived key. This is evidence of the concern, not remediation; the full application and backup-format integration were not exercised. Reproduction helper: `check_remaining_security_helpers.cjs` alongside the downloadable report, outside the project.
- The preserved old security worktree passed 34 tests across 7 files before this update. Its tests use mocks; that result applies to `cf802e5` only.
- No provider call, email, seed, migration execution, database write, production scan or deployment occurred.
- Live configuration, cloud storage policy, actual production version and provider retention remain unverified. Source severity does not automatically describe deployed exploitability.
- Only these two review Markdown files, a README link and narrow documentation ignore-rule exceptions are published on `security/remaining-findings-review` for a draft pull request. No application code is changed by this documentation branch, and no merge into main is performed.
