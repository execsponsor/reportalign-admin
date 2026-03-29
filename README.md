# ExecSponsor Super Admin Portal

Web-based super admin portal for managing ExecSponsor organisations, users, subscriptions, and system operations. Replaces the Python CLI tool with a modern web interface.

## Architecture

- **Frontend**: React + TypeScript + Vite + shadcn/ui (Azure Static Web Apps)
- **API**: Azure Functions (Node.js/TypeScript, Consumption plan)
- **Auth**: Azure Entra ID (SSO with MFA)
- **Database**: Existing Azure PostgreSQL (shared with main ExecSponsor app)

## Project Structure

```
execsponsor-admin/
├── api/                    # Azure Functions backend
│   ├── src/functions/      # HTTP trigger functions
│   ├── src/middleware/     # Auth, audit logging
│   ├── src/services/       # Business logic
│   └── src/utils/          # Database, validation, crypto
├── frontend/               # React frontend
│   └── src/                # Components, hooks, pages
└── .github/workflows/      # CI/CD
```

## Capabilities

### Phase 1 (MVP)
- Organisation CRUD with full provisioning
- User management (create, deactivate, unlock, reset password)
- Super admin management
- Audit log viewer with filters and CSV export
- Platform statistics dashboard

### Phase 2 (Planned)
- GDPR data export/erasure
- System broadcasts
- Maintenance windows
- Advanced reporting

## Development

### API (Azure Functions)

```bash
cd api
npm install
npm run build
func start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment

Deployed via GitHub Actions to Azure Static Web Apps with integrated Azure Functions.

## Cost

Estimated $0-5/month on Azure consumption plan (2-3 super admin users).
