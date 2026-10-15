# Corrective patch baseline

- Target: `MEGS-security-surgical-auth-hardening`, HEAD `8f89185d936454b1466e1d2a1e73e1513f701484`.
- Working tree: clean before this patch. Separate `MEGS` copy is untouched.
- Creator baseline: `189742008300427dedff2c9bb9fdb7a5057499f9`; no later creator commits or uncommitted work exist in this checkout.
- Prior patch: `8f89185` adds Redis startup/revocation/counters, production bypass rejection, and shared AI quotas (20/user/hour, 120/IP/hour, 200/global/hour).
- Existing production guards already required staff MFA and disallowed OTP bypass at `1897420`; `8f89185` additionally rejected all bypass flags at startup. This requested corrective patch removes the hosted-demo restriction for the three specified switches.
- Existing creator switches: `DISABLE_MFA`, `DISABLE_OTP`, `DISABLE_RATE_LIMIT`. No administrator runtime switch UI or settings endpoint existed in this checkout.
- Backend baseline: 28 test files, 186 tests passed before edits.
- Manuscript: PDF pages 47 and 57-60 describe React/Tailwind, Node/Express, PostgreSQL, Gemini, Bcrypt/JWT, and Nodemailer; retain existing Prisma and Supabase.

This patch must be additive and targeted. It does not deploy, migrate a hosted database, merge, or publish.

## Developer-switch rollback reference, 14 October 2026

Main HEAD `1897420` and its middleware history were inspected read-only. Its rate switch reads `process.env.DISABLE_RATE_LIMIT === "true"`; the target restores that developer-owned behavior for Heroku while retaining shared PostgreSQL enforcement. Main has no administrator switch panel/API. Only the newly introduced administrator setting implementation was removed; Redis removal, resume-count removal, provider retries and existing authentication/file controls remain. Production MFA/OTP guards were not restored because hosted demo flags must remain usable.
