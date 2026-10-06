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

### Stage 2: Electron Shell, Local Database & Financial Integrity (Completed)
- Converted application into a native desktop app with Electron 44 and secure typed IPC (`window.billflow`).
- Added local SQLite database using `better-sqlite3` and Drizzle ORM.
- Removed hardcoded dummy data across all screens for a clean initial state.
- Connected Clients, Invoices, and Dashboard with live persistence:
  - **Add Client**: Persists to SQLite with email and currency validation.
  - **Quick Bill & Invoices**: Generates sequential invoice codes (`INV-YYYY-001`) linked to clients.
  - **Live Balances**: Client cards and ledger dynamically calculate total billed, total paid, and outstanding balance.
  - **Invoice Actions**: Marking an invoice `PAID`, `ADVANCE_PAID`, or `UNPAID` updates balances across views immediately.
  - **Relational Integrity**: Client deletion is blocked if linked invoices exist.
- **Financial Views: Actual Records, Currency/Period Filters, and Profit**:
  - **Single Consistent Aggregation Contract**: Unified financial summary contract across Electron IPC (`analytics:summary`), DataProvider, and Dashboard/Analytics widgets for billed revenue, cash collections, outstanding receivables, committed vendor costs, and paid outflows.
  - **Cash vs Accrual (Billed) Accounting Views**:
    - **Accrual (Billed)**: Evaluates performance based on total invoiced amount (`totalRevenueCents`) minus committed vendor costs (`totalOutsourcedCents`).
    - **Cash (Realized)**: Evaluates performance based strictly on actual cash collections received (`paidCents`) minus actual paid contractor outflows (`paidCostCents`).
  - **Loss Preservation & Negative Margins**:
    - Removed arbitrary zero-clamping (`Math.max(0, ...)`) across IPC calculations, monthly trend charts, and widget summaries.
    - Deficits and business losses are fully preserved as negative numbers, with negative margins and dedicated `Net Loss & Margin` styling with downward indicators.
    - Formats negative amounts correctly with currency symbols (e.g., `-$50.00` or `-Rs. 50.00`).
  - **Explicit Currency Isolation & Filtering**:
    - Financial views filter records strictly by currency code (e.g. `USD`, `LKR`, `EUR`) to prevent adding different currencies together into corrupted totals.
  - **Period Filtering**:
    - Accurately filters records by Month, Quarter, Year-to-Date, and All-Time based on invoice issue dates and vendor payment schedules.
- **Strict Financial Integrity & Truthful Metrics**:
  - **Zero Automatic Business Sample Seeding**: Seeding of business samples is strictly disabled outside an explicit demo mode (`BILLFLOW_DEMO_MODE=1` or `isDemoMode()`). The database and memory state always launch clean without synthetic records.
  - **Real Records & Explicit Unavailable States**: Replaced sample task cards and estimated cost/time/runway metrics with real database records or clearly marked unavailable indicators (`Unavailable` / `Time Untracked` / `No Tasks Recorded`) instead of fabricated dollar rates or artificial runway months.
  - **Accurate Collection Tracking**: Accounts for recorded deposit/advance payments (`paidCents`) alongside fully settled invoices.
  - **Net Profit**: Calculated truthfully as billed revenue minus actual subcontractor vendor payables.
  - **Realized Hourly Rate**: Derived strictly from actual background task active tracking (`tasks.activeMilliseconds`), reporting `Unavailable` when no time has been tracked.
  - **Cashflow Runway**: Derived from collected liquidity divided by actual vendor monthly burn, clearly differentiating self-funded status from unrecorded expense history.
- **Interactive Dashboard Customization & Undo Engine**:
  - **Quick Action Hover Toolbar**: Hover over any dashboard tile to instantly remove it (`X`), toggle size between standard (rectangle) and compact (square), or reorder left/right.
  - **Manage Widgets Modal**: Browse the full catalog with search and category filters to add or remove dashboard widgets in one click.
  - **15-Step Undo History**: Every widget addition, removal, reordering, or drag-and-drop drop operation snapshots the layout.
  - **Interactive Toast Notification**: Dispatches an immediate toast with a clickable "Undo" action button.
  - **Header & Shortcut Undo**: Revert changes with the header "Undo" button or standard keyboard shortcut `Cmd+Z` / `Ctrl+Z`.
- **Outsourcing: Completion, Delivery and Payouts Separately**:
  - **Independent Contractor Work vs Payout Lifecycles**: Strict separation between deliverable progress (`todo` [Assigned] → `in-progress` [In Progress] → `review` [Under Review] → `done` [Completed]) and financial settlement (`PENDING` vs `PAID`). Approving or completing contractor work never marks a payout settled, and recording or removing a payout never alters contractor deliverable progress.
  - **Deliverable URL & Handover Notes Retention**: Captures contractor deliverable URLs (code repositories, staging URLs, Google Drive build folders) and review handover notes directly on `work_orders` in local SQLite (`notes` column, versioned migration `0006_work_order_notes.sql`).
  - **Contractor Review Workflow & Sprint Task Sync**: A dedicated review modal allows reviewing deliverables, updating work status, recording feedback/handover notes, and optionally synchronizing completion and delivery URL back to the original sprint task (`tasks.deliveryUrl`, `tasks.status: 'done'`, `tasks.completedAt`).
  - **Payout Settlement & Receipt Attachment Ledger**: Detailed statement voucher ledger for tracking payouts (`vendor_payouts`). Supports attaching payment receipts (`attachments` table with `payoutId` foreign key), viewing uploaded slips, and opening receipts directly in the default system viewer, with clean cascading deletion if a payout is removed.
- **Outsourcing: Reusable Vendors & Linked Work Orders**:
  - **Separation of Profiles vs Work Orders**: Separated reusable vendor directory profiles (`vendors`) from per-job payable work orders (`work_orders`) and contractor payouts (`vendor_payouts`).
  - **Full Relational Integrity**: Persists source task (`taskId`), client invoice (`invoiceId`), client account (`clientId`), scope of work, explicit currency code (`USD`, `LKR`, `EUR`), agreed contractor fee in minor units (`feeCents`), milestone due dates, and deliverable repository/drive URLs in local SQLite.
  - **Deep-Link Prefill from Kanban Tasks**: Seamlessly prefills the work order modal with task ID, title, scope, linked invoice, client, and deliverable URL directly when initiating outsourcing from a Kanban task tile.
  - **Inline Subcontractor Registration**: Allows selecting an existing reusable vendor profile or registering a new subcontractor on the fly without breaking the invoice/job creation flow.
  - **Bi-directional Task Synchronization**: Automatically updates the linked task in `tasks` (`isOutsourced = true`, `outsourcedVendor`, `outsourceBudgetCents`, `currency`), reflecting external delegation status on the sprint board.
- **Global Currency Synchronization & Dynamic Settings Selection**:
  - **User-Configured Default Currency**: Users can pick their primary business currency (`USD`, `EUR`, `LKR`, `GBP`, `CAD`) under **Settings → Default Currency**.
  - **Instant System-Wide Synchronization**: Changing the currency in Settings immediately propagates via Electron IPC and updates the global `activeCurrency` state across all pages (Dashboard, Invoices, Clients, Tasks, Outsourcing, Catalog, Expenses, Analytics) without requiring an app restart or page refresh.
  - **Dynamic Modal & Form Defaults**: New invoice creation, client billing currency, catalog rate cards, task budget limits, and expense logging modals automatically default to the selected system currency.
  - **Visual Header Currency Indicators**: Prominent status badges (`Currency: LKR (Rs.)`, `Currency: USD ($)`) on page headers give clear visual feedback of the active system currency and symbol.
  - **Deterministic Hierarchy**: `getSystemCurrency()` prioritizes the user's configured Settings currency first, then falls back to existing invoice currencies, then defaults to USD.
- Added cross-platform packaging with `electron-builder` and automated GitHub Actions release builds.

### Stage 3: Upcoming Development (Roadmap)
- [ ] **Persist Remaining Modules in SQLite**:
  - Connect Expenses tracking to local database.
- [ ] **Currency Conversion**:
  - Add offline currency exchange rates to aggregate mixed currency totals on the dashboard.

### Appearance

Choose **Light**, **Dark**, or **System** under **Settings → Appearance**. Changes apply immediately and save on this device. System follows operating system appearance changes. The desktop app also themes native window controls; printed output retains light document colors.
