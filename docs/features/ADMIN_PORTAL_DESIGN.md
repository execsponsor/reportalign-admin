# ExecSponsor Super Admin Portal — Design Document

**Version:** 1.0
**Date:** 28 March 2026
**Author:** Mark Evans / Claude Code
**Status:** Phase 1 — In Progress

---

## 1. Purpose

Replace the Python CLI super admin tool (`super_admin_cli.py`) with a web-based portal for managing ExecSponsor organisations, users, subscriptions, and system operations. The portal provides the same 60+ operations in a modern web interface, authenticated via Azure Entra ID (SSO).

### Why

- The CLI requires direct database access and Python installed locally
- No access control beyond "you have the connection string"
- No multi-user collaboration — one person at a time
- No audit trail for who accessed the CLI (only what they did inside it)
- Can't be used from mobile or shared easily
- Entra ID provides SSO + MFA without managing another credential set

---

## 2. Architecture

```
┌──────────────────────────────┐
│  Azure Static Web App        │
│  React + TypeScript + Vite   │
│  Entra ID SSO auth           │
│  Dark indigo/slate theme     │
│                              │
│  agreeable-pebble-0fae66c03  │
│  .1.azurestaticapps.net      │
└──────────┬───────────────────┘
           │ HTTPS
           ▼
┌──────────────────────────────┐
│  Azure Functions (Node.js)   │
│  Consumption plan            │
│  execsponsor-admin-api       │
│  .azurewebsites.net          │
│                              │
│  HTTP triggers, Zod schemas  │
│  Entra ID token verification │
│  Audit logging on all ops    │
└──────────┬───────────────────┘
           │ PostgreSQL (SSL)
           ▼
┌──────────────────────────────┐
│  Azure PostgreSQL            │
│  reportalign-postgresql      │
│  .postgres.database.azure.com│
│                              │
│  Same DB as main ExecSponsor │
│  Shared tables, no duplication│
└──────────────────────────────┘
```

---

## 3. Azure Resources

| Resource | Name | Type | Plan | Location | Est. Cost |
|----------|------|------|------|----------|-----------|
| Storage Account | `execsponsoradminstor` | StorageV2 | Standard LRS | UK South | ~$0.10/mo |
| Function App | `execsponsor-admin-api` | Azure Functions | Consumption | UK South | $0-2/mo |
| Static Web App | `execsponsor-admin-swa` | Static Web Apps | Free | West Europe | $0/mo |
| App Registration | ExecSponsor Admin Portal | Entra ID | — | — | $0/mo |
| **Total** | | | | | **~$0-5/mo** |

### Resource IDs

- **Subscription:** `b0ec156f-d3ec-406f-a6e8-21e7193b3624`
- **Resource Group:** `reportalign-rg`
- **Entra Tenant:** `4887df12-664a-442e-8f2f-ef2cc99a69d8`
- **App Registration Client ID:** `c303da83-4258-45fa-a7fc-8edd00e87c1f`
- **SWA Default Hostname:** `agreeable-pebble-0fae66c03.1.azurestaticapps.net`
- **Function App Hostname:** `execsponsor-admin-api.azurewebsites.net`

### Database Access

The Function App's outbound IPs are whitelisted in the PostgreSQL firewall:
- `85.210.177.241` (AdminFuncApp1)
- `20.90.193.243` (AdminFuncApp2)
- `51.11.29.85` (AdminFuncApp3)

---

## 4. Authentication Flow

```
1. User navigates to admin portal URL
2. SWA config redirects unauthenticated users to /.auth/login/aad
3. Azure Entra ID login page (with MFA if configured)
4. On success, SWA receives JWT token
5. Frontend sends token in Authorization header to API
6. Azure Function:
   a. Verifies JWT against Entra ID JWKS endpoint
   b. Extracts email from token claims (preferred_username / email / upn)
   c. Queries super_administrators table: email must exist + is_active = true
   d. If not a super admin → 403 Forbidden
   e. Updates last_login timestamp
   f. Returns authenticated context (superAdminId, userId, email)
7. All API responses include audit logging
```

### Super Admin Access Levels

| Level | Description | Enforcement |
|-------|-------------|-------------|
| `full_access` | All operations | No restrictions |
| `limited_access` | Read + user management | No destructive org operations |
| `read_only` | View only | No mutations |

(Access levels are tracked in `super_administrators.access_level` but not yet enforced in the portal — planned for Phase 2.)

---

## 5. Visual Design

### Theme: Dark Indigo/Slate

The admin portal uses a **dark theme** distinct from the main ExecSponsor app's light navy/green theme. This makes it immediately obvious when a user is in the admin portal.

| Element | Color | Tailwind Class |
|---------|-------|---------------|
| Background | `#0f172a` (slate-900) | `bg-admin-bg` |
| Surface/Cards | `#1e293b` (slate-800) | `bg-admin-surface` |
| Card hover | `#334155` (slate-700) | `bg-admin-card` |
| Borders | `#475569` (slate-600) | `border-admin-border` |
| Primary text | `#e2e8f0` (slate-200) | `text-admin-text` |
| Muted text | `#94a3b8` (slate-400) | `text-admin-muted` |
| Accent | `#6366f1` (indigo-500) | `bg-admin-accent` |
| Accent hover | `#818cf8` (indigo-400) | `bg-admin-accent-hover` |
| Success | `#22c55e` (green-500) | `text-admin-success` |
| Warning | `#f59e0b` (amber-500) | `text-admin-warning` |
| Danger | `#ef4444` (red-500) | `text-admin-danger` |

### Branding

- Shield icon in sidebar header
- "ExecSponsor" title with pulsing "ADMIN PORTAL" subtitle in indigo
- Active nav items have indigo background with glow shadow
- Custom dark scrollbars
- Fonts: Inter (UI), JetBrains Mono (code/IDs)

---

## 6. Project Structure

```
execsponsor-admin/                  (GitHub: execsponsor/reportalign-admin)
├── api/                            Azure Functions backend
│   ├── src/
│   │   ├── functions/
│   │   │   ├── organizations.ts    Org CRUD + provisioning
│   │   │   ├── users.ts           User CRUD + password management
│   │   │   ├── platformStats.ts   Dashboard statistics
│   │   │   ├── auditLog.ts        Audit log viewer
│   │   │   ├── superAdmins.ts     (planned) Super admin management
│   │   │   ├── gdpr.ts            (Phase 2) GDPR export/erasure
│   │   │   ├── broadcasts.ts     (Phase 2) System broadcasts
│   │   │   └── maintenance.ts    (Phase 2) Maintenance windows
│   │   ├── middleware/
│   │   │   └── auth.ts            Entra ID verification + audit
│   │   ├── services/              (planned) Business logic layer
│   │   └── utils/
│   │       ├── database.ts        PostgreSQL pool
│   │       ├── validation.ts      Zod schemas
│   │       └── crypto.ts          bcrypt, SHA256, password gen
│   ├── host.json
│   ├── local.settings.json        (gitignored)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                       React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/
│   │   │       └── AdminLayout.tsx Dark sidebar + content area
│   │   ├── hooks/                  (planned) React Query hooks
│   │   ├── lib/                    (planned) API client, MSAL config
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── OrganizationsPage.tsx
│   │   │   ├── OrganizationDetailPage.tsx
│   │   │   ├── UsersPage.tsx
│   │   │   ├── UserDetailPage.tsx
│   │   │   └── AuditLogPage.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── staticwebapp.config.json    SWA auth + routing config
│   ├── tailwind.config.ts          Admin dark theme
│   ├── vite.config.ts
│   └── package.json
│
├── .github/workflows/
│   └── deploy-admin.yml            (planned) CI/CD
├── docs/features/
│   └── ADMIN_PORTAL_DESIGN.md      This document
├── .gitignore
└── README.md
```

---

## 7. API Endpoints

### Phase 1 (MVP) — Implemented

| Method | Route | Description | Status |
|--------|-------|-------------|--------|
| GET | `/api/platform-stats` | Dashboard statistics | Scaffolded |
| GET | `/api/organizations` | List orgs (search, filter, pagination) | Scaffolded |
| GET | `/api/organizations/{id}` | View org details | Scaffolded |
| POST | `/api/organizations` | Create org with full provisioning | Scaffolded |
| PATCH | `/api/organizations/{id}` | Update org (status, tier, active) | Scaffolded |
| GET | `/api/users` | List all users (search, pagination) | Scaffolded |
| GET | `/api/users/{id}` | View user details + orgs + programmes | Scaffolded |
| POST | `/api/users` | Create user in org | Scaffolded |
| POST | `/api/users/{id}/unlock` | Unlock locked account | Scaffolded |
| POST | `/api/users/{id}/reset-password` | Reset password | Scaffolded |
| POST | `/api/users/{id}/deactivate` | Deactivate user | Scaffolded |
| POST | `/api/users/{id}/reactivate` | Reactivate user | Scaffolded |
| GET | `/api/audit-log` | View audit log (filters, pagination) | Scaffolded |

### Phase 1 — Planned

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/organizations/{id}/suspend` | Suspend org |
| POST | `/api/organizations/{id}/activate` | Activate org |
| POST | `/api/organizations/{id}/initialize` | Initialize org defaults |
| DELETE | `/api/organizations/{id}` | Soft delete org |
| GET | `/api/super-admins` | List super admins |
| POST | `/api/super-admins` | Create super admin |
| DELETE | `/api/super-admins/{id}` | Revoke super admin access |
| PATCH | `/api/users/{id}/role` | Update user role/access level |

### Phase 2 — GDPR, Broadcasts, Maintenance

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/gdpr/export/{userId}` | Export all user data (JSON) |
| POST | `/api/gdpr/erase/{userId}` | Anonymize + soft delete user data |
| GET | `/api/gdpr/retention-status` | View retention policy status |
| POST | `/api/gdpr/retention-cleanup` | Run retention cleanup (dry-run option) |
| POST | `/api/broadcasts` | Create system broadcast |
| GET | `/api/broadcasts` | List broadcasts |
| PATCH | `/api/broadcasts/{id}` | Update broadcast |
| DELETE | `/api/broadcasts/{id}` | Delete broadcast |
| GET | `/api/broadcasts/{id}/analytics` | View broadcast reach/engagement |
| POST | `/api/maintenance` | Schedule maintenance window |
| POST | `/api/maintenance/{id}/activate` | Activate maintenance mode |
| POST | `/api/maintenance/{id}/end` | End maintenance |
| POST | `/api/maintenance/{id}/extend` | Extend maintenance duration |
| POST | `/api/maintenance/bypass-token` | Generate bypass token |
| GET | `/api/system/health` | System health check |
| GET | `/api/system/database-stats` | Database table sizes + row counts |
| GET | `/api/system/subscriptions` | Subscription tier overview |

### Phase 3 — Monitoring & Alerts

| Method | Route | Description |
|--------|-------|-------------|
| Timer | — | Scheduled retention cleanup |
| Timer | — | Subscription expiry checks |
| Timer | — | System health monitoring |
| — | — | Email alerts via Azure Communication Services |

---

## 8. Organization Provisioning

When a new organization is created, the following are set up in a single transaction:

1. **Organization record** — name, subdomain, type, subscription tier/limits, brand color
2. **Organization settings** — terminology, RAG definitions, outcome framework, fiscal year
3. **Portfolio grouping config** — defaults to disabled
4. **Admin user** — new or reuse existing, bcrypt password + SHA256 email hash
5. **Organization-user link** — administrator access level
6. **Workflow steps** (5):
   - Draft (initial) → In Review → Submitted → Approved (terminal) / Rejected (terminal)
7. **Workflow transitions** (7):
   - Draft → In Review (Owner, Contributor)
   - Draft → Submitted (Owner, Contributor)
   - In Review → Draft (Executive, Owner)
   - In Review → Submitted (Owner, Contributor)
   - Submitted → Approved (Executive)
   - Submitted → Rejected (Executive)
   - Submitted → In Review / Request Changes (Executive)
8. **Report templates** — Status Report (default) + Executive Brief

The admin password is shown once and cannot be retrieved later.

---

## 9. Database Tables Accessed

### Read/Write (mutations)

| Table | Operations |
|-------|-----------|
| `organizations` | CRUD, status changes, soft delete |
| `users` | CRUD, lock/unlock, password reset |
| `organization_users` | Link users to orgs, update access level |
| `organization_settings` | Create defaults on org provisioning |
| `portfolio_grouping_config` | Create defaults on org provisioning |
| `workflow_steps` | Create default workflow on provisioning |
| `workflow_transitions` | Create default transitions on provisioning |
| `super_administrators` | CRUD, login tracking |
| `super_admin_audit_log` | INSERT on every operation |
| `programme_team_members` | Read for user detail |

### Read Only

| Table | Purpose |
|-------|---------|
| `programmes` | Count for org/platform stats |
| `reports` | Count for platform stats |
| `risks_issues` | Count for platform stats |
| `actions` | Count for platform stats |

---

## 10. Audit Logging

Every API operation logs to `super_admin_audit_log` with:

| Field | Description |
|-------|-------------|
| `id` | UUID |
| `super_admin_id` | Who performed the action |
| `action_type` | e.g., CREATE_ORGANIZATION, RESET_PASSWORD |
| `target_type` | e.g., organization, user |
| `target_id` | UUID of affected entity |
| `before_value` | JSON snapshot before change |
| `after_value` | JSON snapshot after change |
| `reason` | Business reason (optional) |
| `ip_address` | Requester IP |
| `session_id` | UUID per browser session |
| `created_at` | Timestamp |

Action types:
- `CREATE_ORGANIZATION`, `UPDATE_ORGANIZATION`, `SUSPEND_ORGANIZATION`, `ACTIVATE_ORGANIZATION`, `DELETE_ORGANIZATION`
- `CREATE_USER`, `DEACTIVATE_USER`, `REACTIVATE_USER`, `UNLOCK_ACCOUNT`, `UPDATE_USER_ROLE`
- `RESET_PASSWORD`, `FORCE_PASSWORD_CHANGE`
- `CREATE_SUPER_ADMIN`, `REVOKE_SUPER_ADMIN`
- `GDPR_EXPORT_USER_DATA`, `GDPR_ERASE_USER_DATA`
- `BROADCAST_CREATED`, `BROADCAST_UPDATED`, `BROADCAST_DELETED`
- `MAINTENANCE_SCHEDULED`, `MAINTENANCE_ACTIVATED`, `MAINTENANCE_ENDED`

---

## 11. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Authentication | Entra ID SSO with MFA (configured in tenant) |
| Authorization | `super_administrators` table check on every request |
| SQL injection | Parameterized queries throughout (pg `$1, $2` syntax) |
| Password storage | bcrypt with 12 salt rounds |
| Email lookup | SHA256 email_hash for silent verification |
| Audit trail | Immutable INSERT-only audit log |
| Network | HTTPS only, CORS restricted to SWA origin |
| Database | SSL required, IP-whitelisted for Function App |
| Secrets | DB password in Function App config (plan: migrate to Key Vault reference) |

---

## 12. CLI to Web Mapping

| CLI Menu | Web Page | Status |
|----------|----------|--------|
| 1. Organization Management | `/organizations` | Phase 1 |
| 2. User Management | `/users` | Phase 1 |
| 3. Password Management | `/users/:id` (actions) | Phase 1 |
| 4. System Operations | `/` (dashboard) | Phase 1 |
| 5. View Audit Log | `/audit-log` | Phase 1 |
| 6. Organization Reports | `/organizations/:id` | Phase 1 |
| 7. GDPR & Data Subject Rights | `/gdpr` | Phase 2 |
| 8. System Broadcasts & Maintenance | `/broadcasts`, `/maintenance` | Phase 2 |

---

## 13. Remaining Work

### Phase 1 Completion

- [ ] CI/CD workflow (GitHub Actions → Azure SWA)
- [ ] MSAL config in frontend for Entra ID login
- [ ] React Query hooks for all API endpoints
- [ ] Wire dashboard to `/api/platform-stats`
- [ ] Wire organizations page to `/api/organizations`
- [ ] Wire users page to `/api/users`
- [ ] Wire audit log to `/api/audit-log`
- [ ] Organization creation wizard (multi-step form)
- [ ] User detail page with action buttons (unlock, reset, deactivate)
- [ ] Organization detail page with status controls
- [ ] Super admin management page
- [ ] CSV export for audit log
- [ ] Deploy and test end-to-end

### Phase 2

- [ ] GDPR pages (export, erase, retention)
- [ ] System broadcasts (create, list, analytics)
- [ ] Maintenance windows (schedule, activate, end)
- [ ] Access level enforcement (read_only, limited_access)
- [ ] Feature flag management per org

### Phase 3

- [ ] Timer triggers for scheduled tasks
- [ ] Email alerts for critical events
- [ ] Real-time dashboard updates
- [ ] Database health monitoring page
- [ ] Subscription management with billing integration
