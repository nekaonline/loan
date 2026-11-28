# AGENTS.md — Project memory for AI assistants

> **Read this file first.** It is the persistent memory of this project: what it is, how it is
> built, the business rules, how to run/test it, known gotchas and the full change history.
> **Keep it up to date**: whenever you change behavior, add a line to *Change history* and fix
> any section that became wrong. The user (owner: `nekaonline`, speaks **Persian/Farsi**) relies on
> this file when a chat session ends. Reply to the user in Persian.

---

## 1. What the product is

Web app for the **Qarz-al-Hasaneh (interest-free loan) fund of Bu-Ali Sina Hospital, Sari, Iran**
(«صندوق قرض‌الحسنه بیمارستان بوعلی سینا ساری»). Staff manage members, loans, installments,
guarantors, fund cash, reports, SMS reminders, users and backups. Members can check their own
status on a public page.

- UI language: **Persian, RTL**. All dates shown in **Jalali (Solar Hijri)**, Iran time zone.
- Money: **Rial**, stored as `numeric(15,2)` strings.
- Deployed by the user **on a Windows PC in the hospital LAN**, opened from other PCs via
  `http://<server-ip>:3000` (plain http, no reverse proxy). Keep LAN/http compatibility in mind.

## 2. Tech stack

| Part | Choice |
|---|---|
| Framework | **Next.js 16.2 (App Router, Turbopack)**, React 19, TypeScript strict |
| DB | **PostgreSQL** via `pg` Pool + **Drizzle ORM 0.45** (`src/db`) |
| Styling | Tailwind CSS 4 + custom classes in `src/app/globals.css` (`form-input`, `btn`, `card`, …) |
| Auth | JWT (`jose`, HS256, 8h) in httpOnly cookie `auth_token`; passwords `bcryptjs` (12 rounds) |
| Dates | `date-fns-jalali` (helpers in `src/lib/utils.ts`) |
| Charts / export | `recharts`, `xlsx` (client-side Excel), browser print → PDF, `qrcode` (receipts) |
| Tests | `node:test` via `tsx` (`tests/*.test.ts`) + API smoke test `scripts/smoke-test.mjs` |

Path alias: `@/*` → `src/*`.

## 3. Repository layout

```
src/
  app/
    layout.tsx            RTL <html lang="fa">, metadata
    page.tsx              THE whole staff SPA: login screen + sidebar + page switcher (client component)
    inquiry/page.tsx      public member self-inquiry page (/inquiry)
    receipt/[code]/page.tsx public receipt page with QR (/receipt/RC-...)
    api/**/route.ts       REST API (see §6)
    globals.css
  components/             one component per sidebar page (Dashboard, Members, Loans, Installments,
                          Debtors, Fund, Guarantors, MemberInquiry, Reports, SmsPanel, Users,
                          Settings, Backup) + Sidebar, JalaliDatePicker, ReceiptViewer
  db/index.ts             pg Pool (connectionTimeoutMillis 10s) + drizzle instance; throws if no DATABASE_URL
  db/schema.ts            Drizzle schema (source of truth for tables)
  lib/
    auth.ts               JWT create/verify, getSession(), hash/verify password
    utils.ts              Jalali/ISO date helpers, number formatting, code generators, installment math
    policy.ts             loan caps from settings (getLoanPolicy, maxAmountForRole)
    schema-setup.ts       ensureSchema(): idempotent CREATE IF NOT EXISTS for tables added after v1
    backup.ts             build / validate / restore / snapshot backups
    sms.ts                sendSms (kavenegar | melipayamak | generic) + sendInstallmentReminders
    schedulers.ts         hourly tick: auto SMS reminders + auto backups (started from instrumentation.ts)
    public-lookup.ts      member inquiry + receipt lookup for public pages
    rate-limit.ts         in-memory limiter for public endpoints (key = x-forwarded-for, set by Next)
    uploads.ts            attachment storage in ./uploads (PDF/JPG/PNG/WEBP, max 5 MB)
    export.ts             client-side Excel export helper
  instrumentation.ts      starts schedulers on the Node runtime
scripts/smoke-test.mjs    end-to-end API test (100 checks) — DESTRUCTIVE, test DB only
tests/core.test.ts        unit tests (dates, policy, rate limit, backup validation)
next.config.ts            allowedDevOrigins for LAN (see §8)
drizzle.config.ts         reads DATABASE_URL from .env.local/.env (fallback postgres:123@127.0.0.1/loan_db)
.env.example              documented env vars
README.md                 Persian install/run/LAN guide for the user
```

The staff UI is **not** routed per page: `src/app/page.tsx` keeps `currentPage` in state and renders
the matching component. Sidebar hides `users` and `backup` for `viewer`.

## 4. Data model (`src/db/schema.ts`)

Enums: `user_role` (admin, manager, viewer) · `loan_status` (pending, approved, active, paid, rejected) ·
`installment_status` (pending, paid, overdue) · `transaction_type` (deposit, withdrawal,
loan_disbursement, installment_payment, fee, other) · `sms_log_status` (sent, failed, pending).

| Table | Notes |
|---|---|
| `users` | username unique, role, isActive, lastLogin |
| `members` | memberCode `M…` unique, nationalId unique, phone, department, joinDate (date), legacy guarantor text fields + `guarantor_id` FK |
| `guarantors` | nationalId unique; can back many loans |
| `guarantorships` | guarantor ↔ loan (+memberId) history |
| `loans` | loanCode `L…` unique, amount, interestRate, installmentCount, installmentAmount, totalPayable, paidAmount, remainingAmount, status, request/approval/disbursement/firstInstallment dates |
| `installments` | per loan; installmentNo, dueDate, amount, principal/interest split, paidAmount, paidDate, status, receiptNo |
| `fund_transactions` | signed amounts (disbursement stored **negative**); balance = SUM(amount); `loan_id` has no FK |
| `settings` | key/value (see §5.6) |
| `sms_logs`, `sms_reminder_logs` | every SMS attempt; reminder log prevents duplicate same-day reminders |
| `attachments` | loan documents; file on disk `uploads/<uuid>.<ext>` |
| `backups` | stored JSON snapshots (content text, sha256 checksum, source manual/auto) |
| `report_templates` | saved report filters (JSON text) |
| `audit_logs` | table exists, currently unused |

**Dates are stored as Gregorian ISO `YYYY-MM-DD`** (`date` columns) and only rendered as Jalali.

### Creating / upgrading the schema
- Fresh DB: `npm run db:push` (drizzle-kit, creates all 14 tables). **Required once.**
- `POST /api/init` (called on every page load) runs `ensureSchema()` (adds post-v1 tables/columns),
  creates `admin/admin123` if there are no users, and inserts missing default settings.
- If base tables are missing, `/api/init` returns a clear Persian error telling the user to run
  `npm run db:push`; the login screen shows it.

## 5. Business rules

### 5.1 Roles
- **admin (مدیر)**: everything. Only role for users, settings write, backups, deletes.
- **manager (کارشناس)**: create/edit members, guarantors, loans, payments, fund transactions, SMS, templates. Subject to loan caps.
- **viewer (مشاهده‌گر)**: read-only (all write APIs return 403). Sensitive settings (`*password*`, `*api_key*`) masked as `***` for non-admins.

### 5.2 Loan lifecycle
`pending` → (approve) `approved` → (disburse) `active` → (all installments paid) `paid`; or `rejected`.
- Create: amount > 0, installmentCount ≥ 1. Cap = `max_loan_amount` for admin,
  `min(max_loan_amount, max_loan_amount_manager)` for others. Non-admins also limited by
  `max_active_loans_per_member` (counts pending+approved+active).
- Installment math (`calculateInstallments`): 0% → `ceil(principal/n)`, total = principal;
  otherwise annuity with monthly rate = rate/100/12, amounts `ceil`ed.
- Disburse (only from `approved`): sets disbursement/first installment dates (default: today / +1 Jalali month),
  generates `n` installments on the **same Jalali day each month** (`addJalaliMonthsISO`),
  inserts a negative `loan_disbursement` fund transaction.
- Delete (admin): not allowed for `active`; removes attachments (+files), guarantorships,
  reminder logs, installments in one transaction.

### 5.3 Payments & receipts
`POST /api/installments/:id/pay` — rejects already-paid and non-positive amounts; receiptNo defaults to
`RC-<jalaliYYYYMMDD>-<installmentId>-<4 random>`; updates loan paid/remaining/status; inserts
`installment_payment` fund transaction. Public receipt page `/receipt/<receiptNo>` shows it with QR.

### 5.4 Public inquiry
`/inquiry` (and sidebar «استعلام عضو»): national ID + full phone **or last 4 digits** → member loans and
installments. Rate-limited: inquiry 10 / 10 min, receipt 30 / 10 min per client IP.

### 5.5 SMS
Providers: `kavenegar` (apikey header, `${apiUrl}/sms/send.json`), `melipayamak` (username/password,
`${apiUrl}/send/simple`), generic (POST JSON with Bearer). Without config → logged as failed, API returns
`{success:false}`. Reminders: pending installments due within `sms_reminder_days`; one per installment
per day unless `force`. Template placeholders: `{name} {installment_no} {amount} {due_date}`.

### 5.6 Settings keys (defaults inserted by `/api/init`)
`fund_name, fund_manager, default_interest_rate(4), default_installment_count(12), max_loan_amount(100,000,000),
max_loan_amount_manager(50,000,000), max_active_loans_per_member(1), sms_provider(kavenegar), sms_api_url,
sms_api_key, sms_sender, sms_reminder_days(3), sms_installment_template,
sms_auto_reminder(false), backup_auto_enabled(false), backup_interval_hours(24), backup_retention_count(10),
hospital_name, hospital_address, hospital_phone`.
Optional (no default row, saved from Settings page for melipayamak): `sms_username, sms_password`.

### 5.7 Backups
JSON payload version `1.1` with members, loans, installments, fundTransactions, settings, users (no
passwords), guarantors, guarantorships, attachments (metadata only — files in `uploads/` are NOT
included), reportTemplates. Dry-run validation before restore. Restore = delete + upsert inside one
transaction (users are not restored/deleted). Snapshots stored in `backups` table, retention enforced.
Scheduler checks hourly (first check 1h after server start).

## 6. API reference (all JSON; auth via cookie unless marked public)

| Method & path | Who | Purpose |
|---|---|---|
| GET `/api/health` | public | DB ping |
| POST `/api/init` | public | schema upgrade + default admin/settings |
| POST `/api/auth/login` · POST `/api/auth/logout` · GET `/api/auth/me` | public / any | session |
| GET/POST `/api/users`, PUT/DELETE `/api/users/:id` | admin (PUT self allowed) | users |
| GET/POST `/api/members`, GET/PUT/DELETE `/api/members/:id` | read any · write ≠viewer · delete admin (soft-delete if member has loans) | members (`?search&page&limit&active`) |
| GET/POST `/api/guarantors`, GET/PUT/DELETE `/api/guarantors/:id` | read any · write ≠viewer | guarantors |
| GET/POST `/api/loans`, GET/PUT/DELETE `/api/loans/:id` | PUT body `action: approve|disburse|reject` or general edit | loans (GET list ignores filters; paginated `page&limit`) |
| GET/POST/DELETE `/api/loans/:id/guarantors` (`?id=` for delete) | write ≠viewer | link guarantors |
| GET `/api/installments` (`?status&memberId&loanId&overdue=true`) · POST `/api/installments/:id/pay` | pay ≠viewer | installments |
| GET/POST `/api/attachments` (`?loanId`, multipart `file, loanId, category, description`), GET/DELETE `/api/attachments/:id` | write ≠viewer | documents |
| GET/POST `/api/fund` | write ≠viewer | transactions + balance |
| GET `/api/dashboard` | any | dashboard stats |
| GET `/api/reports/debtors` · GET `/api/reports/management?from&to` (Jalali or ISO) | any | reports |
| GET/POST/DELETE `/api/reports/templates` | write ≠viewer | saved report filters |
| POST `/api/sms/send` (`{phone,message}` or `{action:"send_reminders",force}`) · GET `/api/sms/logs` | send ≠viewer | SMS |
| GET/POST `/api/settings` | write admin | settings map |
| GET `/api/backup` (download) · POST `/api/backup` (restore, or `dryRun:true`) | admin | file backup |
| GET/POST/DELETE `/api/backups` · GET/POST `/api/backups/:id` (`{dryRun}`) | admin | stored snapshots |
| POST `/api/public/inquiry` · GET `/api/public/receipt/:code` | public, rate-limited | self-service |

Date inputs accept Gregorian ISO **or** Jalali (`1403/06/10`, `1403-06-10`, Persian digits) through
`normalizeDateInput`.

## 7. Running & testing

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL, JWT_SECRET
npm run db:push                   # create tables (fresh DB)
npm run dev                       # dev on 0.0.0.0:3000
npm run build && npm start        # production on 0.0.0.0:3000 (build needs DATABASE_URL set)
npm test                          # unit tests (5)
npm run typecheck
BASE_URL=http://localhost:3000 npm run smoke   # 100 API checks — TEST DB ONLY (creates/deletes/restores)
```

`npm run lint` currently reports **11 pre-existing issues** (react-hooks `set-state-in-effect` /
`immutability` in components, a few unused vars). They are not regressions; don't panic about them.

### Testing in the Arena sandbox (no Postgres/browser preinstalled, apt blocked)
- Postgres: `npm i embedded-postgres` in `/tmp/pg`, start with a small script
  (`new EmbeddedPostgres({databaseDir:'/tmp/pg/data',user:'postgres',password:'123',port:5432})`), then create
  `loan_db` **with `encoding 'UTF8' template template0`** (default cluster is SQL_ASCII).
- Browser: `npm i @sparticuz/chromium puppeteer-core` in `/tmp/br`; run with env
  `AWS_EXECUTION_ENV=AWS_Lambda_nodejs22.x AWS_LAMBDA_JS_RUNTIME=nodejs22.x` so it unpacks the bundled
  libnss. Copy `vazirmatn` TTFs into `/tmp/fonts/fonts/` or Persian text renders blank in screenshots.
- Simulate a LAN client by opening the sandbox IP (`hostname -I`, e.g. `http://169.254.0.21:3000`)
  instead of localhost.

## 8. Known gotchas (read before debugging)

1. **LAN + `next dev` stuck on «در حال بارگذاری...»**: Next 16 blocks dev resources (HMR websocket,
   chunks) for non-localhost origins → client never hydrates. Fixed via `allowedDevOrigins` in
   `next.config.ts` (private ranges `192.168.*.*`, `10.*.*.*`, `172.*.*.*`, `*.local`, this PC's
   hostname/IPs, plus `ALLOWED_DEV_ORIGINS` env). Wildcard `*` matches one DNS label.
2. **LAN + production login lost on refresh**: cookie was `secure` whenever `NODE_ENV=production`; browsers
   drop Secure cookies on `http://192.168…`. Now Secure only if request is https (`x-forwarded-proto` /
   URL) or `COOKIE_SECURE=true`.
3. Windows Firewall must allow TCP 3000 on the server (README has the PowerShell command).
4. Fresh DB needs `npm run db:push`; `ensureSchema()` alone can't create base tables.
5. `src/db/index.ts` throws at import if `DATABASE_URL` is missing → `next build` also needs it.
6. JSX text: write the real ZWNJ character («‌»), never the escape `\u200c` (renders literally in JSX text).
7. Schedulers run in-process (one per server process); first tick after 1 hour.
8. Rate limiter is in-memory (resets on restart; per process).
9. `/api/loans` GET ignores `search/status/memberId` params (UI only paginates).
10. Backups don't contain attachment files — back up the `uploads/` folder separately.
11. `JWT_SECRET` falls back to a hard-coded string if unset — production should set it.

## 9. Change history

| Date | Ref | Change |
|---|---|---|
| — | `d888318`…`977650f` | Initial project uploaded by the user (members, loans, installments, fund, SMS, users, settings, backup). |
| 2026-11-24 | PR #1 `4ef538e` | Jalali dates everywhere (`date-fns-jalali`, JalaliDatePicker, ISO storage), management reports with Excel/PDF export. |
| 2026-11-28 | PR #2 `369d669` | Applied patch from a lost session (`01a20bdb-…patch`, generated against `977650f`, superset of PR #1): guarantors, public inquiry, receipts + QR, attachments, stored/auto backups with retention & dry-run, loan caps per role & active-loan limit, SMS reminder dedupe, report templates & date filters, rate limiting, `ensureSchema`, schedulers, unit tests. |
| 2026-11-28 | PR #3 | LAN fixes (allowedDevOrigins, http-safe cookie, `-H 0.0.0.0` scripts, DB connect timeout, clear init/DB errors on login screen, 20 s load timeout); fixed loan delete failing when loan had attachments/guarantors; fixed literal `\u200c` on Backup page; `normalizeDateInput` treats `1403-06-10` as Jalali; `drizzle.config.ts` reads env + `npm run db:push`; added `scripts/smoke-test.mjs` (100 checks), `.env.example`, Persian README, this AGENTS.md. |

## 10. Working agreements with the user

- Communicate in Persian; explain simply (user is not a deep developer).
- Work on the Arena branch you are given, open a PR to `main`; the user merges.
- Always run: `npm run typecheck`, `npm test`, `npm run build` (with DATABASE_URL), and ideally the smoke
  test + a browser pass over all 13 sidebar pages from a non-localhost URL before declaring done.
- Never run the smoke test against the user's real database.
- Update this file (§9 at minimum) with every change.
