# Admin Portal — Remediation Report (Prompt B)

**Date:** 2026-08-03
**Branch:** `security/admin-hardening`
**Scope:** remediation of findings A1–A8 from `ADMIN-PORTAL-SECURITY-REVIEW.md` (2026-08-02).

---

## Summary

| Task | Finding | Status |
|---|---|---|
| B1 | A4 — authorisation single-layer and opt-in | **Done.** All 38 authenticating routes wrapped at registration; enforced by a test that discovers routes at runtime; wired into CI. |
| B2 | A2 — audit trail not tamper-evident | **Finding corrected, real gap closed.** A2 was overstated; the genuine hole was TRUNCATE, now blocked in both environments. |
| B3 | A5, A6 — audit record quality | **Done.** `ip_address` populated from platform-set headers only; `session_id` now correlates. |
| B4 | A3 — API runs as table owner | **Design only, not applied.** Migration, rollback and a verification script are written; the grant set is a hypothesis until verified. |
| B5 | A1 — secrets in plaintext | **Blocked by SKU, verified.** Key Vault references are impossible on the Free tier. |
| B6 | A7 — rate limiting evadable | **Key fixed.** Now keyed on a platform-set address. Distribution deliberately not built. |
| — | A8 — no test coverage | **Partly addressed.** Jest never actually ran here; toolchain added, 16 tests now run in CI. |

---

## B1 — Authentication cannot be omitted

Every route registers `authLevel: 'anonymous'` with no platform-level gating, so the only control
was each handler calling `authenticateSuperAdmin()` on its first line. That was correct for 38 of
40 — but the failure mode is silent: one new handler that forgets is immediately internet-reachable,
unauthenticated, holding a database credential that bypasses row-level security.

`withSuperAdmin()` now applies authentication at registration. The 401 response is byte-for-byte
what the handlers returned. Handlers receive the verified caller as a third argument and no longer
write `auth.superAdminId!`.

**Behaviour preserved deliberately.** Some handlers called `checkRateLimit()` *before*
authenticating and some *after*. Wrapping naively would have flipped that for the first group,
changing which status an anonymous over-limit caller receives. A `rateLimitFirst` option keeps each
handler's original order rather than silently changing it.

**The control that makes it stick:** `tests/registrationGuard.test.ts` stubs `@azure/functions`,
imports every module in `src/functions`, and asserts every registered route is either wrapped or on
a small allowlist. Routes are discovered **at runtime, not from a list**, so an endpoint added
tomorrow is covered the day it is written.

Proven, not assumed — a temporary unwrapped route was registered and the suite failed by name:

```
× every registered route is either wrapped with withSuperAdmin or explicitly allowlisted
+   "GET/POST probe-leak [probeLeak]"
```

`/health` and `/ping` are allowlisted in code with stated reasons. The test also fails if the
allowlist grows beyond three entries or names a route that no longer exists — a growing allowlist
is how this kind of control dies quietly.

### B1.6 — Static Web Apps route gating: not available here

`routes` + `allowedRoles` gating keys off **SWA's own EasyAuth** `clientPrincipal`. This app
authenticates with MSAL against a separate Entra app registration and passes the token in
`X-Admin-Token`, precisely because the SWA proxy replaces `Authorization`. SWA has no visibility
into that token, so `allowedRoles` would reject every call rather than gate it.

A second platform layer is therefore only available by migrating to SWA EasyAuth — an
architectural change, not a configuration one. **No configuration is proposed, because none works.**

---

## B2 — Audit log: the finding was wrong, the gap was real

**Correction.** The review reported `super_admin_audit_log` as fully modifiable by the credential
that writes it. That was incorrect. It inspected `pg_trigger` and the privilege grants but never
`pg_rules`. Two `DO INSTEAD NOTHING` rewrite rules already existed:

```
super_admin_audit_log_no_update
super_admin_audit_log_no_delete
```

Verified in **both** environments: UPDATE and DELETE are silently discarded — row unchanged, count
unchanged. The compensating control was already largely in place.

**The genuine gap:** rules do not fire on `TRUNCATE`. A single statement would have erased the
entire audit trail. Migration 002 adds a statement-level `BEFORE TRUNCATE` trigger. Applied and
verified on pre-prod and production.

**Stated limits, so this is not over-trusted:**

- The UPDATE/DELETE trigger in migration 002 is **dead code** while the rules exist — the rules
  rewrite the statement before any row-level trigger runs.
- None of it defends the table against its own **owner**, who can `DISABLE TRIGGER` and write
  freely. The verification script demonstrates this explicitly rather than leaving it implied.
- The rules discard writes **silently**. A trigger would raise. Swapping rules for triggers is the
  better design and PostgreSQL recommends it, but it changes behaviour for any caller relying on
  the silent no-op — presented as a decision, not taken unilaterally.

**B2.5 — external sink (assessment only, as instructed).** Shipping audit records to a sink the
database credential cannot reach is the only thing that defends against the owner. Azure Monitor
via `DiagnosticSettings`, or an append-only blob container with immutability policy, are both
viable. Rough effort: 1–2 days including retention and access policy. **Not implemented.**

---

## B3 — Audit records that can actually be used in an incident

**`ip_address` (A5)** — the column existed and was never written. Attribution to an account but not
an origin is the first thing missing in an investigation.

The address is now taken **only from headers the platform sets and overwrites**. What is
deliberately not used, and why:

- `x-client-ip` / `client-ip` — pure client input, no platform involvement.
- `x-forwarded-for[0]` — equally untrustworthy. A caller sends `X-Forwarded-For: 1.2.3.4`, the
  infrastructure **appends** the observed address after it, so element `[0]` is the attacker's
  value. **The old rate limiter read exactly that**, which is why A7 was evadable.

Preference order: `x-azure-clientip`, then `x-azure-socketip` (both set by Front Door on ingress),
then the **last** element of `x-forwarded-for` — the nearest trusted hop. Ports are stripped, since
Azure appends the client port and Postgres `inet` rejects `1.2.3.4:56789` — the same defect that
once broke login on the main backend.

> **Not verified by observation.** Which of these headers Static Web Apps actually delivers to a
> managed function was taken from documented Front Door behaviour, not confirmed against the live
> platform. The code logs which headers were present when none is trustworthy, so the first real
> request settles it.

**`session_id` (A6)** — was `crypto.randomUUID()` per record, so every action appeared to belong to
a different session and the column could not group anything. Now the Entra `sid` claim, falling
back to a hash of `sub` + `auth_time` (stable across token refresh within one sign-in), and **null**
when neither is available. A null that admits ignorance is worth more than a random value that lies.

**B3.3 — no backfill.** Existing records keep their random `session_id` and null `ip_address`. The
discontinuity is noted in the migration.

---

## B4 — Least-privilege database role (DESIGN ONLY — NOT APPLIED)

Today the API connects as the table owner: `reportalignadmin` (pre-prod, 204 tables) and
`starkchowder2` (prod, 202 tables), both `BYPASSRLS`. Cross-tenant reads are legitimate for an
administration tool; **schema modification, truncation and ownership are not**.

`003_admin_api_least_privilege_role.sql` designs `execsponsor_admin_api`: not the owner, not the
migration role, no DDL, no TRUNCATE, with `BYPASSRLS` granted **explicitly** so cross-tenant reach
is a visible decision rather than a side effect of reusing the owner account.

**The grant set is a hypothesis, and here is why that matters.**
`scripts/enumerate-db-operations.js` derives it from the SQL in `src/`. Its first pass pairs quotes
to find literals — and a stray apostrophe in a prose comment (*"each handler's order"*) shifted that
pairing and silently swallowed the SQL after it. Three real writes went missing:

```
super_administrators : UPDATE
organization_users   : UPDATE
users                : UPDATE
```

Every one would have become a runtime failure **after cutover, in production, on the login path**.
A second raw-text sweep now cross-checks the first and surfaced exactly those three.

That is precisely why this stays design-only. `scripts/verify-admin-role-privileges.js` connects
against the role and reports MISSING (outage) and EXCESS (over-permission) in both directions,
checks the role owns nothing, and refuses to pass if it is superuser or lacks BYPASSRLS.
**Run it clean before pointing any environment at this role.**

Coverage: 23 tables — 7 read-only, 16 with writes. `super_admin_audit_log` gets `SELECT, INSERT`
only, consistent with migration 002. `ALTER DEFAULT PRIVILEGES` grants `SELECT` on future tables so
a later migration does not silently break the role, while a new table must justify write access.

---

## B5 — Secrets: blocked by the SKU, and that is a verified fact

Both admin portals hold `DB_PASSWORD` and `ENTRA_API_CLIENT_SECRET` as plaintext application
settings. The instruction was to verify rather than assume whether Key Vault references work here.

**They do not, and the reason is concrete:**

| Resource | SKU | Managed identity |
|---|---|---|
| `execsponsor-admin-portal` | **Free** | **None** |
| `execsponsor-prod-admin-portal` | **Free** | **None** |

A Key Vault reference authenticates to Key Vault **as a managed identity**. Static Web Apps
supports managed identity only on the **Standard** plan. On Free, there is no identity to grant
access with, so `@Microsoft.KeyVault(...)` cannot resolve. This is not a configuration oversight —
it is unavailable at this tier.

**Options, in order of preference:**

1. **Upgrade both to Standard** (~$9/month each), enable system-assigned identity, grant it
   `Key Vault Secrets User`, convert both settings to references. Smallest change that actually
   fixes it, and a prerequisite for options 2 and 3.
2. **Entra ID authentication to PostgreSQL** with that managed identity — removes `DB_PASSWORD`
   from existence rather than hiding it. A credential that does not exist cannot be printed into a
   transcript. Still requires Standard.
3. **Move the API to a linked Function App**, which supports identity and Key Vault references on
   consumption pricing. Larger change; note pre-prod already calls a standalone Function App while
   prod uses the SWA's own managed functions, so the two environments differ here already.
4. **Interim, regardless of the above:** restrict who holds configuration-read rights on these
   resources, and rotate both values.

**B5.3 — repository history is clean.** gitleaks over all 100 commits found two hits, both
`${{ secrets.* }}` workflow references, not literals. **Neither secret has ever been committed.**

---

## B6 — Rate limiting

Now keyed on the same platform-set address as the audit log, so rotating a spoofed header no longer
yields a fresh bucket. Tested, including the specific evasion the old code allowed.

**Limitation left in place and documented in code:** the store is an in-process `Map`, so each
Function App instance counts separately and counters reset on restart. Under scale-out the
effective limit is *(instances × 100)* per minute. Acceptable only because this sits behind Entra
authentication as a secondary control. Distributed rate limiting was **not** built, per instruction
and proportion.

---

## A8 — Test coverage

The repo had a `test` script but **no jest, no ts-jest and no config**. `npm test` pulled a
transient jest via npx and could not parse the one TypeScript test that existed. That suite had
never run.

Now: jest + ts-jest configured, 3 suites / 16 tests, running as a blocking CI check
(`.github/workflows/api-tests.yml`).

> `npm run lint` is still broken — it invokes eslint, which is not a dependency, so it fails on any
> clean checkout. It is deliberately **not** in the CI workflow, because adding it would make every
> PR red for an unrelated reason. Installing and configuring eslint here is worth doing separately.

---

## Status of findings A1–A8

| # | Finding | Severity | Status |
|---|---|---|---|
| A1 | Secrets in plaintext app settings | High | **Blocked** — Free SKU cannot use Key Vault references. Options above. Rotation still outstanding. |
| A2 | Audit trail not tamper-evident | Medium | **Corrected + fixed.** Rules already blocked UPDATE/DELETE; TRUNCATE hole closed in both environments. |
| A3 | API runs as table owner | Medium | **Designed, not applied.** Verification script must pass first. |
| A4 | Authorisation single-layer and opt-in | Medium | **Fixed** and enforced by a runtime-discovery test in CI. |
| A5 | Source IP never recorded | Low | **Fixed** — platform-set headers only. |
| A6 | `session_id` cannot correlate | Low | **Fixed** — Entra `sid`, or null rather than a lie. |
| A7 | Rate limiting evadable | Low | **Key fixed.** Non-shared counter documented, not built. |
| A8 | Effectively no test coverage | Low | **Partly fixed** — jest now runs at all; 16 tests in CI. |

---

## Outstanding, and who owns it

1. **Rotate** the production database password and the Entra API client secret. Still the only
   time-sensitive item, and still outside what I can do.
2. **Decide on the SWA Standard upgrade** — it gates every real fix for A1.
3. **Sign off the B4 role design**, then run the verification script before any cutover.
4. **Decide rules-versus-triggers** on the audit log.
5. **Nothing here is deployed.** Migration 002 is applied to both databases; the application code
   changes sit unpushed on `security/admin-hardening`.
