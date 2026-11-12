# BillFlow

> Local-first invoicing, project execution, and profit management for software freelancers, independent developers, and technical consultants.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-44.11-47848F.svg)](https://www.electronjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57.svg)](https://www.sqlite.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F.svg)](https://orm.drizzle.team/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-Vitest%20%2B%20Playwright-success.svg)](https://vitest.dev/)

---

> [!NOTE]
> **Academic Project Notice**: BillFlow was created as academic coursework for **EER4189 Software Design in Group** at The Open University of Sri Lanka (Group 61). While fulfilling academic requirements, the application is engineered as a production desktop tool for freelance software engineering practice.

---

## What is BillFlow?

Freelancers often split work across disconnected tools: chat apps for client messages, spreadsheets for billing, generic Kanban boards for development, and personal banking apps for expenses. Important details slip through the cracks—delivery links get lost, deposits remain untracked, and real job margins stay hidden.

BillFlow unifies this entire operational lifecycle in one native desktop app. All business data stays on your machine in a local SQLite database with zero cloud lock-in.

```
Client Request ──> Itemized Invoice ──> Vector PDF ──> Advance Payment
       │
       └──> Automated Task Board ──> Outsource Work ──> Delivery URL ──> Final Settlement
```

---

## The 10-Step Freelance Lifecycle

BillFlow models the real-world flow of independent software consulting and development:

### 1. Client Management & Delivery Endpoints

Create permanent client profiles or enter temporary clients directly during invoicing without cluttering your address book. Store repository URLs, staging links, or Google Drive folder targets per client or per job.

### 2. Itemized Invoicing & Reusable Catalog

Build invoices with line items, quantities, and rates. Pull standard rates from your service Catalog (e.g., _Business Website Development_, _AI Consulting Session_), apply client discounts, and require custom deposits (such as a 50% advance).

### 3. Vector PDF Generation

Generate and export clean, branded invoice PDFs locally. Exports include line items, discounts, tax rates, required deposits, bank payment instructions, job notes, and deliverable links. Configurable save paths default to your Downloads folder.

### 4. Advance Tracking & Digital Receipts

Record deposit collections against an invoice. Attach client payment receipts (PNG, JPG, PDF) directly to the payment record. Files are copied into managed application storage and reopen through your system viewer.

### 5. Automatic Task Generation

When an invoice status switches to `ADVANCE_PAID`, BillFlow displays an automatic tracking prompt with a 5-second countdown. Confirming converts invoice deliverables directly into linked Kanban tasks—no manual re-entry required.

### 6. Focused Kanban Execution & Local Calendar Integration

- **Tri-View Task Management**: Seamlessly switch between **Kanban Board**, **List View**, and **Calendar View** on `/tasks` or via `/calendar`.
- **Sprint Kanban & Background Timing**: Move tasks through `To Do`, `In Progress`, `Review`, and `Done`. Active working duration tracks in the background, keeping cards clean while recording delivery velocity.
- **Local Calendar & User Events Engine**: Track sprint task due dates alongside user local events (client meetings, AI consulting sessions, project milestones, deliverable reviews, and deadlines) with local SQLite persistence.
- **Interactive Drag-and-Drop Rescheduling**: Drag tasks between calendar dates to reschedule deadlines on the fly.
- **Direct Relational Linking**: Link calendar events directly to client accounts and sprint Kanban deliverables, with location/meeting link shortcuts.
- **Quick Day Scheduling**: Click any day cell or hover to quickly schedule a task or event for that specific day.

### 7. Deliverable Handoff

Access code repositories, staging URLs, or documentation folders directly from client cards, invoices, and sprint tasks. Deliver work to clients through your chosen channel without re-entering URLs.

### 8. Subcontractor Outsourcing

Delegate tasks directly from Kanban cards. BillFlow prefills a work order with the task scope, linked client, invoice, and deliverable repository. Subcontractor deliverable reviews and financial payouts stay strictly separate so you never pay a vendor before approving the build.

- **Offline Vector PDF Vouchers**: Export formal work order vouchers directly to your configured directory via `pdf-lib` and Electron IPC.
- **Direct WhatsApp Task Dispatch**: Send clean, structured task delegation briefs to subcontractors directly via WhatsApp web/desktop intent links (`wa.me`) with automatic phone number normalization.

### 9. Final Payment Settlement & Accounts Receivable Aging

Log the remaining milestone payment and attach final receipts. An invoice is marked fully paid only when total collections cover the complete balance.

- **Overdue Summary & Aging Analysis**: Access actionable past-due breakdowns categorized into aging tiers (`1-15`, `16-30`, `31-60`, `60+` days) with delinquency statistics, affected client accounts, and 1-click WhatsApp or Email payment reminder dispatches.
- **RFC 4180 CSV Data Export**: Export active register views, selected invoice sets, or dedicated accounts receivable delinquency reports to RFC 4180-compliant CSV format with automated balance totals.

### 10. Financial Truth & Net Profit

Review accurate financial summaries with no artificial zero-clamping or synthetic data. Compare accrual billing against realized cashflow, isolate numbers by currency (`USD`, `LKR`, `EUR`), and subtract subcontractor costs and recorded business expenses to view true net margins.

---

## Tech Stack & Architecture

| Layer                  | Technology                                 | Details                                                                      |
| :--------------------- | :----------------------------------------- | :--------------------------------------------------------------------------- |
| **Desktop Shell**      | Electron 44                                | Context-isolated preload bridge, native window framing, tray controls.       |
| **Frontend Framework** | Next.js 16 (App Router)                    | React 19, Turbopack, static exports (`output: 'export'`).                    |
| **Styling & Motion**   | Tailwind CSS v4, Motion                    | Newsreader serif + Inter typography, layered neutral shadows.                |
| **Database & ORM**     | SQLite 3 via `better-sqlite3`, Drizzle ORM | WAL mode, foreign key cascades, versioned schema migrations.                 |
| **Analytics & Charts** | Apache ECharts 6                           | Freelance turnaround velocity, retainer yields, capacity benchmarks.         |
| **Document Engine**    | Electron `printToPDF` + `pdf-lib`          | Offline invoice templates with bundled fonts and vector contractor vouchers. |
| **Test Suite**         | Vitest + Playwright                        | Unit, database, security, and packaged Electron workflow coverage.           |

### Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│             Next.js 16 Frontend (React 19)             │
│   Dashboard │ Clients │ Invoices │ Tasks │ Outsourcing  │
└───────────────────────────┬────────────────────────────┘
                            │ window.billflow
┌───────────────────────────▼────────────────────────────┐
│         Electron Context Bridge (electron/preload.ts)   │
└───────────────────────────┬────────────────────────────┘
                            │ Validated IPC
┌───────────────────────────▼────────────────────────────┐
│            Electron Main Process (electron/main.ts)    │
│  IPC Handlers │ PDF Generator │ File Attachment Store   │
└───────────────────────────┬────────────────────────────┘
                            │ Drizzle ORM
┌───────────────────────────▼────────────────────────────┐
│      SQLite Database (billflow.db in App userData)     │
│   WAL Mode │ Strict Foreign Keys │ Versioned Migrations│
└────────────────────────────────────────────────────────┘
```

---

## Installation & Running Locally

### Prerequisites

- **Node.js**: v22 LTS (specified in `.nvmrc`)
- **npm**: v10 or newer
- **Operating System**: macOS (Apple Silicon or Intel) or Windows 10/11

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Akatsuki-61/BillFlow.git
cd BillFlow
npm install
```

> **Note**: `npm install` automatically compiles native `better-sqlite3` bindings for Electron via `electron-builder install-app-deps`.

### 2. Run Desktop Application (Recommended)

```bash
npm run dev:electron
```

Starts the Next.js development server on loopback and the Electron shell with hot-reload. `npm start` launches the built static desktop app after `npm run build`; it does not run a Next.js production server.

### 3. Run Web Preview (Frontend Only)

```bash
npm run dev
```

Opens at `http://127.0.0.1:3000`. Uses an in-memory data provider fallback.

### 4. Run Test Suite & Linting

```bash
# Run unit and integration tests
npm test

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

---

## Local macOS test build

```bash
npm run pack:mac
```

Open `release/preview-0.2.0/mac-arm64/BillFlow.app` locally. This creates an ad-hoc signed Apple Silicon application without publishing a release or creating a DMG. The app bundles its renderer, fonts, and native runtime; recipients do not need npm or a dev server. Developer ID signing, notarization and installer testing remain separate distribution steps.

```bash
BILLFLOW_APP_PATH="$PWD/release/preview-0.2.0/mac-arm64/BillFlow.app/Contents/MacOS/BillFlow" npm run test:desktop
```

The desktop suite creates temporary profiles, disables native Calendar synchronization, exercises the real packaged bridge and PDF engine, and removes its fixtures. Keep real Calendar integration as an explicit manual OS test.

Renderer libraries are build dependencies. Drizzle, Zod and pdf-lib are bundled into the main process; only native SQLite and its runtime dependency closure are shipped as npm modules. The scoped tool overrides in `package.json` patch esbuild/minimatch advisories and are covered by tests, lint, the production build, and local app packaging. Recheck `npm audit` when updating them.

## Packaging Desktop Installers

Create standalone desktop packages using `electron-builder`:

### macOS (Apple Silicon / M1, M2, M3, M4)

```bash
npm run dist:mac:arm64
```

Outputs: `release/BillFlow-0.2.0-arm64.dmg`

### macOS (Universal / All Architectures)

```bash
npm run dist:mac
```

Outputs: `release/BillFlow-0.2.0-arm64.dmg` and `release/BillFlow-0.1.0.dmg`

### Windows (NSIS Installer)

```bash
npm run dist:win
```

Outputs: `release/BillFlow Setup 0.2.0.exe`

---

## Database & File Storage

All application data is stored locally:

| OS              | Database File Path                                   |
| :-------------- | :--------------------------------------------------- |
| **macOS**       | `~/Library/Application Support/BillFlow/billflow.db` |
| **Windows**     | `%APPDATA%\BillFlow\billflow.db`                     |
| **Development** | `./.billflow-dev/billflow.db`                        |

- **Receipt Attachments**: Copied into `userData/attachments/` with content-addressed SHA-256 naming.
- **Profiles**: Secondary workspaces live in `userData/profiles/<profile-id>/` with isolated databases, receipts and task schedules. Password unlock state is enforced by the main process.
- **Upgrades**: Pending schema upgrades create a consistent `billflow.db.before-upgrade-*.bak` recovery snapshot.
- **Backups**: Version 2 backups include scheduled task times and receipt bytes. Export and restore share 150 MiB file and 100 MiB receipt limits; generated PDF paths are regenerated locally.
- **Invoice PDFs**: Automatically exported to your configured folder (defaults to Downloads).
- **Appearance Settings**: Persisted in `appearance.json` (`Light`, `Dark`, or `System`).

---

## Development & Contributing

Guidelines for team members and contributors collaborating on BillFlow:

### Branching Strategy

| Branch    | Focus Area & Primary Contributor                                                                       |
| :-------- | :----------------------------------------------------------------------------------------------------- |
| `main`    | Production-ready releases. Protected branch.                                                           |
| `Nipun`   | Architecture, Electron shell, database, invoicing, PDF export, analytics, tasks.                       |
| `Lahiru`  | Navigation shell, clients directory, delivery link resolution, expenses ledger, lead QA & bug hunting. |
| `Binuka`  | Outsourcing work orders, contractor payouts, currency synchronization.                                 |
| `Sandika` | Service catalog, CSV/Excel import, invoice styling reconciliation.                                     |

> **Rule**: Never push directly to `main`. Always work on your assigned branch or a dedicated feature branch and test thoroughly before merging.

### Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature or user-facing capability
- `fix:` bug fix or calculation correction
- `refactor:` internal restructuring with no functional change
- `docs:` documentation updates
- `test:` test coverage additions

### Core Engineering Principles

1. **Local-First SQLite Persistence**: All business data (clients, invoices, line items, payments, tasks, vendors, work orders, expenses) persists to `billflow.db` via Electron IPC and Drizzle ORM. Never store core business data in `localStorage` or component state alone.
2. **Financial Integrity**: Store currency amounts as integer minor units (`amountCents`) with an explicit currency code (`USD`, `LKR`, `EUR`). Never sum across differing currencies. Fully preserve business losses and negative margins.
3. **Zero Synthetic Seeding**: The database launches clean. Test fixtures are created only in disposable test workspaces; normal startup never seeds fake business records.

### Pre-Commit Checklist

Run the verification suite before committing:

```bash
npx tsc --noEmit    # Type checking
npm run lint        # Code style & linting
npm test            # 168 unit and integration tests (26 suites)
```

For the complete module ownership breakdown, detailed sprint timeline, and development history, see **[CONTRIBUTIONS.md](CONTRIBUTIONS.md)**.

---

## Team & Project Credits

BillFlow is designed and built by the **Akatsuki** engineering team:

| Contributor        | GitHub                                                     | Primary Modules                                                                                                                                                           |
| :----------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Nipun Yatawara** | [@nipunyatawara-dev](https://github.com/nipunyatawara-dev) | Architecture, Electron runtime, SQLite/Drizzle layer, Multi-profile workspaces & password locks, Task-to-Invoice workflow, synchronized card highlighting, spring motion. |
| **GVSL-Lahiru**    | [@GVSL-Lahiru](https://github.com/GVSL-Lahiru)             | Lead QA & bug hunting, Deliverable handoff workflow (Submit Work modal), Overdue invoices summary engine (AR aging), CSV data export.                                     |
| **Binuka Reshan**  | [@Binukareshane](https://github.com/Binukareshane)         | Task outsourcing engine & payable vouchers (`VND-INV-xxxx`), WhatsApp contractor dispatch, automated ledger expense posting, Excel workbook export.                       |
| **Sandika**        | [@Sandika-2003](https://github.com/Sandika-2003)           | Service Catalog management, bulk CSV/Excel import, UI Rework integration, invoice preview sheet (`InvoiceDocumentSheet.tsx`), macOS Calendar two-way `.ics` sync.         |

For the complete module ownership breakdown, detailed sprint timeline, and git history, see **[CONTRIBUTIONS.md](CONTRIBUTIONS.md)**.

---

## License

This project is developed for educational and professional demonstration purposes under the coursework curriculum of The Open University of Sri Lanka.
