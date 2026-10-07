# BillFlow — Team Contribution & Engineering Log

This document records the individual module ownership, development timeline, and code contributions of the BillFlow engineering team (Akatsuki) for evaluation and auditing.

---

## Team Summary & Module Ownership

| Member | GitHub Username | Branch | Core Responsibilities & Modules |
| :--- | :--- | :--- | :--- |
| **Nipun Yatawara** | `nipunyatawara-dev` | `Nipun` | Project architecture, Electron desktop shell, SQLite database & Drizzle ORM migrations, Dashboard customization engine & widgets, itemized Invoices & PDF export, Kanban task workflow, theme engine, and domain ECharts analytics. |
| **GVSL-Lahiru** | `GVSL-Lahiru` | `Lahiru` | Initial application layout, sidebar navigation, Clients profiles & delivery URL defaults, Expenses breakdown ledger with receipt persistence, and multi-view delivery link integrations. |
| **Binuka Reshan** | `Binukareshane` | `Binuka` | Outsourcing UI and work order lifecycles, Analytics views, subcontractor payout management, and global currency synchronization across widgets. |
| **Sandika** | `Sandika-2003` | `Sandika` | Catalog management, CSV/Excel bulk item import and template guides, initial invoice UI styling, and SQLite migration naming reconciliation. |

---

## Detailed Member Contributions

### 1. Nipun Yatawara (`nipunyatawara-dev`)
**Primary Branch:** `Nipun`

- **Project Foundation & Desktop Shell:**
  - Initialized project scaffolding, Next.js configuration, TypeScript setup, and linting rules.
  - Converted the web application into an Electron desktop runtime (`electron/main.ts`, `electron/preload.ts`).
  - Added native title bar controls, custom window framing, and application tray support.
- **Database & Persistence Layer:**
  - Designed the primary SQLite relational schema using Drizzle ORM (`electron/db/schema.ts`, `electron/db/index.ts`).
  - Implemented transactional IPC handlers for clients, invoices, invoice line items, payments, tasks, vendors, and work orders.
  - Built SQLite migration pipelines and fallback in-memory data providers (`src/lib/data/DataProvider.tsx`).
- **Billing & Invoicing Workflow:**
  - Implemented itemized invoice line items, advance payment tracking (50% deposit state), and payment receipt records.
  - Built vector PDF invoice generation using PDFKit in Electron (`electron/pdf-generator.ts`).
- **Task Tracking & Kanban Board:**
  - Built the sprint Kanban board (`/tasks`) with To Do, In Progress, Review, and Done statuses.
  - Implemented the automatic advance tracking prompt with 5-second countdown to convert paid invoices into sprint tasks.
- **Widgets & Domain Analytics:**
  - Architected the drag-and-drop dashboard widget system and customizable grid layouts.
  - Integrated and adapted 6 Apache ECharts visual components to freelance metrics (turnaround velocity percentiles, retainer revenue yields, capacity benchmarks, and timeline brushes).
- **Branding & Design Polish:**
  - Integrated official BillFlow brand marks, vector assets, and light/dark theme styling (`src/app/theme.css`).

---

### 2. GVSL-Lahiru (`GVSL-Lahiru`)
**Primary Branch:** `Lahiru`

- **Layout & Application Shell:**
  - Built the responsive sidebar navigation, shared page layout containers, and application navigation structure.
- **Expenses Ledger & Receipts:**
  - Implemented the persistent SQLite expenses ledger (`electron/ipc/expenses.ts`, `src/app/expenses/page.tsx`).
  - Supported business expense logging with merchants, categories, dates, tax deductible flags, and payment receipt attachments.
- **Client Profiles & Delivery Integration:**
  - Built client profile management with company details, contacts, and delivery location defaults (`src/app/clients/page.tsx`).
  - Added delivery link resolution across clients, invoices, sprint tasks, and outsourcing work orders (`src/lib/deliveryUrl.ts`).
  - Connected the expenses ledger with work order payouts and dashboard financial summaries.

---

### 3. Binuka Reshan (`Binukareshane`)
**Primary Branch:** `Binuka`

- **Outsourcing Module:**
  - Built the initial Outsourcing view (`src/app/outsourcing/page.tsx`, `src/components/outsourcing/OutsourcingView.tsx`).
  - Designed payable work orders linked to sprint tasks and client invoices.
  - Implemented vendor management, agreed contractor fees, and payout status tracking (Pending vs. Settled).
- **Analytics & Financial Integrity:**
  - Built the initial Analytics overview dashboard (`src/app/analytics/page.tsx`).
  - Added financial calculation checks to ensure contractor payouts and expenses do not double-deduct from profit metrics.
  - Implemented global currency synchronization across metric widgets.

---

### 4. Sandika (`Sandika-2003`)
**Primary Branch:** `Sandika`

- **Service Catalog Management:**
  - Developed the reusable service and product catalog (`src/app/catalog/page.tsx`, `src/components/CatalogView.tsx`).
  - Supported hourly, flat-rate, and milestone-based pricing units.
- **Bulk Import Engine:**
  - Implemented CSV and Excel bulk import functionality for catalog items (`src/lib/catalog-import.ts`).
  - Added an in-app import guide with downloadable sample CSV/Excel template files.
- **Invoicing UI & Database Synchronization:**
  - Built early Invoices UI layouts and extracted styling to modular CSS files.
  - Added SQLite synchronization for catalog entries and reconciled migration metadata.

---

## Timeline of Merged Sprints (Chronological)

| Date | Contributor | Branch / Action | Milestone Description |
| :--- | :--- | :--- | :--- |
| **Sep 29** | Nipun | `main` | Initial repository structure and Next.js project scaffold. |
| **Sep 30** | Lahiru | `Lahiru` | Application layout, sidebar navigation, initial clients and expenses views. |
| **Sep 30** | Binuka | `Binuka` | Outsourcing user interface and vendor voucher cards. |
| **Oct 01** | Sandika | `Sandika` | Invoices and Catalog pages with LKR currency support. |
| **Oct 01** | Nipun | `Nipun` | Kanban board with task status transitions and outsourcing triggers. |
| **Oct 01** | Binuka | `Binuka` | Analytics dashboard interface and initial metrics. |
| **Oct 03** | Nipun | `Nipun` | Executive summary dashboard with customizable widgets and trajectory charts. |
| **Oct 04** | Nipun | `Nipun` | Electron desktop wrapper, local SQLite database integration, shared UI tokens. |
| **Oct 04** | Nipun | `Nipun` | Widget grid layout customizer, sidebar drag-and-drop, and settings screen. |
| **Oct 05** | Sandika | `Sandika` | Bulk catalog import engine, CSV guide, and dedicated stylesheet extraction. |
| **Oct 05** | Nipun | `Nipun` | Theme engine supporting dark and light mode switching. |
| **Oct 05** | Binuka | `Binuka` | Backend synchronization for outsourcing vouchers, analytics, and invoice links. |
| **Oct 05** | Sandika | `Sandika` | Migration naming cleanup and SQLite sync for catalog entries. |
| **Oct 06** | Nipun | `Nipun` | BillFlow branding identity, vector assets, and tray integration. |
| **Oct 06** | Nipun | `Nipun` | Managed file uploads for receipts, database validation, and support diagnostics. |
| **Oct 06** | Nipun | `Nipun` | Itemized invoice lines, vector PDF generation, and advance payment tracking. |
| **Oct 06** | Binuka | `Binuka` | Dashboard customization engine, outsourcing lifecycles, and currency alignment. |
| **Oct 06** | Lahiru | `Lahiru` | Persistent SQLite expenses ledger and receipt attachment support. |
| **Oct 07** | Lahiru | `Lahiru` | Client profile editing, delivery defaults, and multi-view link resolution. |
| **Oct 07** | Nipun | `Nipun` | UI consistency polish, catalog layout standardization, and navigation cleanups. |
| **Oct 07** | Nipun | `Nipun` | ECharts domain adaptation, container rendering fixes, and unified seed data. |

---

## Test & Build Verification

The integrated system is tested and verified through automated test suites:
- **Test Framework:** Vitest runner (`vitest run`).
- **Total Test Suites:** 12 files passed.
- **Total Unit & Integration Tests:** 86 tests passed.
- **Type Checking:** `npx tsc --noEmit` compiles cleanly with zero errors.
- **Linter:** `npm run lint` passes cleanly with zero errors.
