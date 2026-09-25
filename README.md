# MEBS Inventory

Multi-site inventory, asset and equipment management system for a BPO operation.
Built with Next.js 14 (App Router), TypeScript, Tailwind CSS + shadcn/ui,
Prisma + PostgreSQL (Neon), Auth.js v5 and React Hook Form + Zod.

## Features

- **Assets** – register, edit, bulk-update, assign/return, transfer, dispose, warranty
  tracking, QR/printable labels and a dedicated scanner page (camera QR/barcode via
  `html5-qrcode`).
- **Consumable inventory** – stock items, bin locations, receiving (PO or direct),
  issues, consumption, adjustments, replenishment and low-stock/reorder reporting.
- **Transfers** – multi-line (assets + consumables) site-to-site transfers with
  approval, shipping, receiving and a full custody trail.
- **Assignments & clearance** – asset assignment to employees, returns, and an exit
  clearance workflow that blocks offboarding until equipment is returned.
- **Maintenance** – tickets, diagnosis, parts, costs and return-to-service flow.
- **People & organisation** – employees, users, roles, sites, facilities/locations,
  departments, cost centres and item categories.
- **Reports & audit** – ten report slugs with CSV export, plus a filterable audit
  trail of every mutation.
- **Self service** – employees see their own assigned assets (`/my`), request
  returns/repairs and receive notifications.
- **Search & diagnostics** – global search across the records a user may see, and an
  admin diagnostics page (health, counts, permission dump).

### Access control

Auth.js v5 credentials provider with JWT sessions. Every server action and page calls
`requirePermission(...)` from `src/lib/session.ts` — the UI only mirrors these rules.
45 permissions across 8 seeded roles (Super Admin, Inventory Admin, Site Admin,
Technician, Department Manager, Inventory Staff, Auditor, Employee). Site-scoped roles
only ever see their own sites (`siteScope()` Prisma helper). Users without
`dashboard.view` are redirected from `/dashboard` to `/my`.

## Getting started

```bash
npm install          # also runs `prisma generate` (postinstall)
cp .env.example .env.local   # fill in DATABASE_URL / DIRECT_URL / AUTH_SECRET
npm run db:migrate   # applies prisma/migrations (needs DATABASE_URL)
npm run db:seed      # demo sites, roles, users, assets, stock, tickets
npm run dev
```

Open http://localhost:3000.

### Seeded accounts

Password for every seeded user: `ChangeMe123!` (override with `SEED_PASSWORD`,
reset existing hashes with `SEED_RESET_PASSWORD=1`).

| Email | Role |
| --- | --- |
| `admin@mebs.local` | Super Admin (all 45 permissions) |
| `inventory.admin@mebs.local` | Inventory Administrator |
| `site.admin@mebs.local` | Site Administrator |
| `technician@mebs.local` | IT / Technician |
| `manager@mebs.local` | Department Manager |
| `staff@mebs.local` | Inventory Staff |
| `auditor@mebs.local` | Auditor |
| `employee@mebs.local` | Employee (self-service portal) |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (`tests/`) |
| `npm run smoke` | Boots `next start` and asserts routes/login/exports (`scripts/smoke.mjs`) |
| `npm run db:migrate` | Create/apply migrations during development |
| `npm run db:deploy` | Apply committed migrations (CI/Vercel) |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:reset` | Drop + recreate + reseed the database |

## Project layout

```
prisma/            schema.prisma, migrations/, seed.ts
src/
  actions/         server actions (auth + permission guarded, return ActionResult)
  app/(app)/       authenticated pages: dashboard, assets, inventory, transfers,
                   assignments, maintenance, suppliers, employees, reports, audit,
                   notifications, settings, admin, my, scan, labels, search
  app/(auth)/      login
  app/api/         auth, CSV export routes
  components/      ui/ (shadcn primitives), shared/, one folder per domain
  lib/             auth, permissions, session, errors, audit, logger, validations/
  generated/       prisma client (gitignored, rebuilt on npm install)
middleware.ts      Auth.js route protection (edge-safe config)
```

Conventions worth keeping:

- Zod schemas live in `src/lib/validations/*` — never inside `"use server"` files
  (Next only allows async function exports there).
- Server pages pass **serialisable props only** to client components (no functions),
  and dot-access nothing from `"use client"` modules.
- Errors: throw `AppError` (user-safe message + `errorId`); `handleActionError`
  converts Zod/Prisma errors into `ActionResult`.
- Audit every mutation with `recordAudit(...)` using the `AuditAction` enum values.

## Tests

`npm test` runs Vitest unit tests for the permission catalogue, formatting/CSV
utilities, query-string helpers, error handling and the Zod form schemas.
`npm run smoke` runs the end-to-end smoke checks against a production build
(admin routes, CSV exports, anonymous/employee redirects, empty server error log).

## Deploying

The repository ships with a Vercel + Neon guide below.

### Vercel + Neon

1. Push the repository to GitHub.
2. Create a Neon project and copy the **pooled** connection string (the one with
   `-pooler`) as `DATABASE_URL` and the **direct** one as `DIRECT_URL`.
3. In Vercel: *Add New Project* → import the repo. Framework preset: **Next.js**.
   Build command stays `npm run build`; `postinstall` already runs `prisma generate`.
4. Add the environment variables for Production (and Preview if you want it):
   - `DATABASE_URL`, `DIRECT_URL`
   - `AUTH_SECRET` — generate locally with `npx auth secret`
   - `NEXT_PUBLIC_APP_URL` — e.g. `https://inventory.vercel.app`
   - `NEXT_PUBLIC_APP_NAME` — display name
5. Apply migrations **once** from your machine against the production database:
   `npx prisma migrate deploy`, then `npm run db:seed` for demo data.
6. Deploy. Log in with a seeded account and change the passwords immediately.

> Neon's pooled endpoint is required on Vercel (serverless connections); the direct
> endpoint is only used by `prisma migrate` from your local machine.
