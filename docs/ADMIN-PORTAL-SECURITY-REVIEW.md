# Admin Portal — Security Review

**System:** `reportalign-admin` — `execsponsor-admin-portal` (pre-prod) and `execsponsor-prod-admin-portal` (prod)
**Date:** 2026-08-02
**Trigger:** Finding 9 of the backend RLS hardening review — the admin API connects to the database as the table-owning, RLS-bypassing role, so none of the controls verified in that engagement apply to it.
**Changes made:** none. This is a read-only review.

**Scope caveat:** this reviews the admin API's authentication, authorisation, data access and secret handling from source and Azure configuration. It is not a penetration test, and it does not cover the front-end bundle, dependency supply chain, or the Entra ID tenant configuration itself.

---

## Summary

The parts that are easy to get wrong are, for the most part, **right**. Authentication uses Entra ID tokens verified against Microsoft's published signing keys with correct issuer and audience checks, followed by an active-status check in `super_administrators`. Of 40 registered routes, **38 authenticate**; the two that do not are `/health` and `/ping`, which return a literal status and nothing else. Every one of the **17 mutating routes writes an audit record**. There is **no SQL injection surface** — the dynamic query fragments use hard-coded identifier allowlists with parameterised values.

The problems are concentrated in three places: **secrets are stored in plaintext**, the **audit trail can be erased by the thing it audits**, and **authorisation is single-layer and opt-in**, guarding a component that holds the most privileged database credentials in the estate.

---

## Findings

### A1 — Production secrets stored in plaintext application settings (High)

Both Static Web Apps hold `DB_PASSWORD` and `ENTRA_API_CLIENT_SECRET` as **plaintext application settings**. Neither environment uses a single Key Vault reference (`@Microsoft.KeyVault(...)`) — verified: **0 of 11 settings** in each.

This matters more here than it usually would, because `DB_PASSWORD` is the credential for the **table-owning, RLS-bypassing** database role. Anyone able to read the resource's configuration — via the portal, the CLI, an automation identity, or a support session — obtains unrestricted access to every tenant's data in that environment.

**These values were exposed during this review**: a routine `az staticwebapp appsettings list` printed them in full to the session transcript. That is the finding demonstrating itself.

**Recommended:**
1. **Rotate now** — the production `starkchowder2` database password and the Entra API client secret. Treat them as compromised; it is the cheap assumption.
2. Move both to Key Vault references so the values never appear in configuration output.
3. Restrict who holds configuration-read rights on these resources.

### A2 — The audit trail is not tamper-evident (Medium)

`super_admin_audit_log` is the compensating control for an application that bypasses row-level security: it is the only record of what a super administrator did. It is currently modifiable by the same credential that writes it.

| Check | Result |
|---|---|
| Triggers preventing modification | **None** |
| Privileges held by the writing role | `INSERT, SELECT, UPDATE, DELETE, TRUNCATE` |
| Table owner | the same role the API connects as |

So a compromised credential — or a malicious administrator — can delete or rewrite their own history. The trail provides accountability against *accident*, not against *intent*, which is the case it exists for.

**Recommended:** make it append-only. A `BEFORE UPDATE OR DELETE` trigger that raises an exception is the practical option, since revoking privileges from the table owner is ineffective (an owner can re-grant). Consider also shipping audit records to an external sink the database credential cannot reach.

### A3 — The API runs with far more privilege than it needs (Medium)

Confirmed in both environments:

| Environment | Database role | Consequence |
|---|---|---|
| Pre-prod | `reportalignadmin` | Bypasses RLS; owns all 203 tables |
| Production | `starkchowder2` | Bypasses RLS; owns all 202 tables |

Cross-tenant read access is legitimate for an administration tool. **Schema modification, table truncation and object ownership are not.** As configured, a defect in this API is not bounded by the database in any way — it can drop tables, not merely read rows.

**Recommended:** a dedicated `execsponsor_admin_api` role that is *not* the table owner and *not* the migration role. Grant `SELECT` broadly, and `INSERT/UPDATE/DELETE` only on the tables it genuinely writes. If cross-tenant reads are required, grant `BYPASSRLS` explicitly — so the privilege is a deliberate, visible decision rather than a side effect of reusing the owner account.

### A4 — Authorisation is single-layer and opt-in (Medium)

Every route is registered `authLevel: 'anonymous'`, and the Static Web App configuration has no `routes`/`allowedRoles` gating for `/api/*`. The **only** control is each handler remembering to call `authenticateSuperAdmin()` on its first line.

That is currently done correctly — 38 of 40, with the two exceptions harmless. But the failure mode is severe and silent: **one new handler that omits the call is immediately internet-reachable, unauthenticated, holding owner-level database credentials.** Nothing in the build or the platform would catch it.

**Recommended:** make the secure path the default rather than a convention. A wrapper applied at registration —

```ts
app.http('listOrganizations', { …, handler: withSuperAdmin(listOrganizations) });
```

— means authentication cannot be forgotten, only deliberately removed. A test that enumerates registrations and asserts every route is wrapped (the sweep written for this review does exactly that) would make regressions fail the build.

### A5 — Source IP is never recorded (Low)

`super_admin_audit_log` has an `ip_address` column; `logAuditAction()` does not populate it. Administrative actions are therefore attributable to an account but not to an origin, which is the first thing anyone asks during an incident.

### A6 — `session_id` cannot correlate a session (Low)

Each audit record stores a freshly generated random identifier, so every action appears to belong to a different session. The column cannot group a sequence of actions, which is what it appears to promise.

### A7 — Rate limiting is bypassable and non-shared (Low)

The limiter (100 requests/minute, mutating methods only) keys on `x-forwarded-for` / `x-client-ip` / `client-ip` — **client-supplied headers** — so a caller can rotate the value and evade it. It is also an in-process `Map`, so each Function App instance counts separately and all counters reset on restart. This sits behind Entra authentication, so it is a secondary control, but it should not be relied on.

### A8 — Effectively no test coverage (Low)

One test file (`caseTransform.test.ts`) for the most privileged component in the estate. There is no test asserting that routes authenticate, that audit records are written, or that mutating endpoints behave.

---

## What is working well

- **Token verification is correct.** Entra ID tokens are validated against the tenant's published JWKS with issuer and audience checked — not merely decoded, which is the common mistake.
- **Authorisation is checked against live state**, not just the token: `super_administrators` must contain the caller and be active, so revocation takes effect immediately rather than at token expiry. This is notably stronger than the main backend, where membership is not re-checked (Finding 3 of the RLS review).
- **Audit coverage of mutations is complete** — all 17 mutating routes log before/after values and a reason.
- **No SQL injection surface.** Dynamic `UPDATE … SET` clauses build identifiers from hard-coded allowlists and pass values as parameters; dynamic `WHERE` fragments are constant strings with placeholders. The one interpolation with no parameter array (`dateFilter`) is selected from fixed literals and never contains user input.
- **Prod/pre-prod separation was fixed deliberately** (`ADM-H1`), and each environment now points at its own database.

---

## Recommended order of work

1. **Rotate the exposed secrets** (A1) — today.
2. **Move secrets to Key Vault references** (A1).
3. **Make the audit log append-only** (A2) — it is the control everything else leans on.
4. **Wrap handlers so authentication cannot be omitted**, and add the enumeration test (A4, A8).
5. **Introduce a least-privilege admin database role** (A3) — the largest change, and the one that bounds the blast radius of everything above.
6. Populate `ip_address`, fix `session_id`, and treat rate limiting as advisory (A5–A7).

---

## Relationship to the backend RLS review

That engagement verified that the main application cannot cross tenant boundaries — measured, not asserted: 102 endpoints probed with zero data leaks, and the database itself refusing foreign rows addressed by primary key. **None of that applies to this component.** The admin portal bypasses those controls by design, which is defensible; what is not yet defensible is that it does so with the *owner* credential, with an *erasable* audit trail, and with secrets stored in the clear.
