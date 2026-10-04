# BillFlow

> Invoicing, rate cards, and financial execution workspace for solo freelancers, software consultants, and small business owners.  
> Academic Coursework: **EER4189 Software Design in Group** — The Open University of Sri Lanka (Group 61).

---

## How to Run

### 1. Prerequisites
- **Node.js**: v22 LTS (specified in `.nvmrc`)
- **npm**: v10 or newer
- **OS**: Windows 10/11 or macOS 12+

### 2. Setup
Clone the repository and install dependencies:
```bash
git clone https://github.com/Akatsuki-61/BillFlow.git
cd BillFlow
npm install
```
> `npm install` automatically compiles native SQLite binaries for Electron via `electron-builder install-app-deps`.

### 3. Run the Desktop Application
Start Next.js and Electron with hot reload:
```bash
npm run dev:electron
```

### 4. Run in Browser Preview (Optional)
If you only want to test the web frontend in a browser:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). This mode uses an in-memory repository fallback.

### 5. Run Unit Tests
Verify database schema validation, invoice code generation, and financial calculations:
```bash
npm test
```

### 6. Build Packaged Installers
- **Windows (`.exe` installer)**:
  ```bash
  npm run dist:win
  ```
  Generates `release/BillFlow Setup 0.1.0.exe`.
- **macOS (`.dmg` installer)**:
  ```bash
  npm run dist:mac
  ```
  Generates `release/BillFlow-0.1.0.dmg`.

---

## Local Database Details

BillFlow saves all records locally in an SQLite database using WAL mode and foreign keys:

- **Windows**: `%APPDATA%\BillFlow\billflow.db`
- **macOS**: `~/Library/Application Support/BillFlow/billflow.db`
- **Development**: `./.billflow-dev/billflow.db`

The app launches with a **blank slate** (no dummy data). Test by clicking **Add Client** on the Clients page, then create an invoice through **Quick Bill** or the Invoices page.

---

## Development Progress & Roadmap

### Stage 1: UI & Interaction System (Completed)
- Designed and built all 8 primary application views:
  - Dashboard (`/`)
  - Clients Ledger (`/clients`)
  - Invoices (`/invoices`)
  - Expenses (`/expenses`)
  - Tasks / Kanban (`/tasks`)
  - Catalog Rate Cards (`/catalog`)
  - Outsource Vendor Payouts (`/outsourcing`)
  - Analytics (`/analytics`)
- Applied unified editorial typography (Newsreader serif + Inter sans-serif).
- Added multi-layered neutral elevation shadows and accessible microinteractions.

### Stage 2: Electron Shell & Local Database (Completed)
- Converted application into a native desktop app with Electron 44 and secure typed IPC (`window.billflow`).
- Added local SQLite database using `better-sqlite3` and Drizzle ORM.
- Removed hardcoded dummy data across all screens for a clean initial state.
- Connected Clients, Invoices, and Dashboard with live persistence:
  - **Add Client**: Persists to SQLite with email and currency validation.
  - **Quick Bill & Invoices**: Generates sequential invoice codes (`INV-YYYY-001`) linked to clients.
  - **Live Balances**: Client cards and ledger dynamically calculate total billed, total paid, and outstanding balance.
  - **Invoice Actions**: Marking an invoice `PAID` or `UNPAID` updates balances across views immediately.
  - **Relational Integrity**: Client deletion is blocked if linked invoices exist.
- Added cross-platform packaging with `electron-builder` and automated GitHub Actions release builds.

### Stage 3: Upcoming Development (Roadmap)
- [ ] **Persist Remaining Modules in SQLite**:
  - Connect Expenses tracking to local database.
  - Connect Tasks and Kanban deliverables board to local database.
  - Connect Catalog service items and hourly rate cards to local database.
  - Connect Subcontractor vendor profiles and payouts to local database.
- [ ] **Invoice PDF Export & Print**:
  - Generate printable PDF invoice sheets directly from the desktop shell.
- [ ] **Data Backup & Restore**:
  - Export and import full workspace data via JSON and SQLite database backups.
- [ ] **Currency Conversion**:
  - Add offline currency exchange rates to aggregate mixed currency totals on the dashboard.
