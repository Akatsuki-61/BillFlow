# Contributing to BillFlow

Guidelines for developers, contributors, and team members working on BillFlow.

---

## Academic & Engineering Context

BillFlow is developed as coursework for **EER4189 Software Design in Group** at The Open University of Sri Lanka (Group 61). The project follows strict software engineering practices: typed IPC boundaries, local-first SQLite persistence, automated test suites, and strict financial calculations.

For individual module assignments and sprint history, see [CONTRIBUTIONS.md](CONTRIBUTIONS.md).

---

## Git Workflow & Branching Strategy

The repository uses dedicated member branches alongside feature branches:

| Branch | Purpose |
| :--- | :--- |
| `main` | Production-ready releases. Protected branch. |
| `Nipun` | Architecture, Electron shell, database, invoicing, PDF export, analytics, tasks. |
| `Lahiru` | Navigation shell, clients, delivery links, expenses ledger. |
| `Binuka` | Outsourcing work orders, vendor payouts, financial metrics. |
| `Sandika` | Catalog management, bulk import, styling reconciliation. |

### Rules for Commits and Pull Requests

1. **Never push unverified code directly to `main`.** Always test on your working branch first.
2. **Follow Conventional Commits:**
   - `feat(scope): short description`
   - `fix(scope): short description`
   - `refactor(scope): short description`
   - `docs(scope): short description`
   - `test(scope): short description`
3. **Keep diffs focused.** Do not bundle unrelated refactors with bug fixes or new features.

---

## Local Development Setup

### Prerequisites

- **Node.js**: v22 LTS (check with `node -v` or use `nvm use`)
- **npm**: v10 or newer
- **Operating System**: macOS (Apple Silicon / Intel) or Windows 10/11

### Installation

```bash
# Clone repository
git clone https://github.com/Akatsuki-61/BillFlow.git
cd BillFlow

# Install dependencies (automatically rebuilds better-sqlite3 for Electron)
npm install
```

### Running the App

- **Desktop App (Recommended):**
  ```bash
  npm run dev:electron
  ```
  Runs Next.js in dev mode alongside the Electron runtime with hot-reload.

- **Browser Preview (Frontend Only):**
  ```bash
  npm run dev
  ```
  Available at `http://localhost:3000`. Uses an in-memory data provider fallback.

---

## Core Engineering Principles

Keep these rules in mind when modifying the codebase:

### 1. Local-First SQLite Persistence
- All business records (clients, invoices, line items, payments, tasks, vendors, work orders, expenses) must persist to `billflow.db` via Electron IPC.
- Do not store business records in `localStorage` or React state alone.
- Place schema definitions in `electron/db/schema.ts`. Generate migrations using `npm run db:generate`.
- Keep database operations transactional.

### 2. Financial Integrity
- Store currency amounts as integer minor units (`amountCents`) alongside an explicit currency code (`USD`, `LKR`, `EUR`).
- Never sum numbers across different currency codes. Filter or isolate by currency.
- Preserve business losses and negative margins. Do not clamp values to zero (`Math.max(0, ...)`).
- Distinguish cash collections from accrual totals. Recording an advance payment updates `paidCents` without marking an invoice fully paid.

### 3. Zero Synthetic Data Seeding
- The database launches clean. Do not auto-seed fake records or mock tasks on startup outside an explicit demo flag (`BILLFLOW_DEMO_MODE=1`).

---

## Pre-Commit Verification Checklist

Before pushing commits or opening a PR, run the full verification pipeline:

```bash
# 1. Type checking
npx tsc --noEmit

# 2. Linting
npm run lint

# 3. Unit and integration tests
npm test
```

All 86 tests must pass and compiler/linter output must be clean.

---

## Packaging Desktop Installers

- **macOS (Apple Silicon / M1+):**
  ```bash
  npm run build && npx electron-builder --mac --arm64
  ```
  Generates `release/BillFlow-0.1.0-arm64.dmg`.

- **macOS (Universal / All architectures):**
  ```bash
  npm run dist:mac
  ```

- **Windows (`.exe` NSIS installer):**
  ```bash
  npm run dist:win
  ```
  Generates `release/BillFlow Setup 0.1.0.exe`.

---

## Getting Help

- Review [AGENTS.md](AGENTS.md) for the 10-step freelance workflow and system contracts.
- Review [WORKFLOW_AUDIT.md](WORKFLOW_AUDIT.md) for database requirements and gap analysis.
- Review [CONTRIBUTIONS.md](CONTRIBUTIONS.md) for team module ownership.
