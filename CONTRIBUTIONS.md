# BillFlow — Team Contribution & Engineering Log

This document records the individual module ownership, development timeline, and code contributions of the BillFlow engineering team (Akatsuki) for evaluation and academic auditing under IEEE Std 830-1998 and CMMI-DEV Level 2/3 guidelines.

---

## Team Summary & Module Ownership

| Member | GitHub Username | Branch | Core Responsibilities & Modules |
| :--- | :--- | :--- | :--- |
| **Nipun Yatawara** | `nipunyatawara-dev` | `Nipun` | Project architecture, Electron desktop runtime, SQLite database & Drizzle ORM migrations, Multi-profile workspace system & PIN/password locks, Task-to-invoice workflow & batch invoicing engine, synchronized Kanban hover highlights, spring motion animations, and test engineering. |
| **GVSL-Lahiru** | `GVSL-Lahiru` | `Lahiru` | Lead Quality Assurance & exploratory bug hunting, deliverable handoff workflow (Submit Work modal & Google Drive link integration), Overdue invoices summary engine (AR aging 0-7, 8-14, 15+ days), CSV data export engine, and top navigation bar polish. |
| **Binuka Reshan** | `Binukareshane` | `Binuka` | Task outsourcing engine & contractor payable vouchers (`VND-INV-xxxx`), WhatsApp contractor task dispatch, auto-posting paid contractor jobs to expense ledger, 3-tab AR aging template table, and Excel workbook (`.xlsx`) export engine. |
| **Sandika** | `Sandika-2003` | `Sandika` | Catalog management & bulk CSV/Excel import, UI Rework integration (PR #6), invoice preview document sheet (`InvoiceDocumentSheet.tsx`) with PDF export, macOS Calendar two-way `.ics` sync engine, and task trash delete microinteractions. |

---

## Detailed Member Contributions

### 1. Nipun Yatawara (`nipunyatawara-dev`)
**Primary Branch:** `Nipun`

- **Project Foundation & Desktop Shell:**
  - Initialized project scaffolding, Next.js App Router configuration, TypeScript strict typing, and linting rules.
  - Architected the Electron desktop shell (`electron/main.ts`, `electron/preload.ts`) with custom window framing, title bar controls, and application tray support.
- **Database & Persistence Layer:**
  - Designed the primary SQLite relational schema using Drizzle ORM (`electron/db/schema.ts`, `electron/db/index.ts`).
  - Implemented transactional IPC handlers for clients, invoices, invoice line items, payments, tasks, vendors, work orders, user profiles, and calendar events.
  - Built SQLite migration pipelines and fallback data providers (`src/lib/data/DataProvider.tsx`).
- **Billing & Invoicing Workflow:**
  - Implemented itemized invoice line items, upfront deposit math (50% advance state), and payment receipt records.
  - Built vector PDF invoice generation using `pdf-lib` in Electron (`electron/pdf-generator.ts`).
- **Task Tracking & Kanban Board:**
  - Built the sprint Kanban board (`/tasks`) supporting To Do, In Progress, Review, and Done statuses.
  - Implemented the automatic advance tracking prompt (`AdvanceTrackingPrompt.tsx`) with 5-second countdown to convert paid invoices into sprint tasks.
- **Task-to-Invoice Workflow & Batch Invoicing (Post-Oct 08):**
  - Built the bidirectional task-to-invoice workflow (`task-to-invoice-workflow.test.ts`, `InvoicesView.tsx`, `TasksView.tsx`).
  - Added the "Import Completed Tasks" dialog in the invoice builder, allowing freelancers to convert finished deliverables into invoice line items with configurable rates.
  - Added the "Batch Invoice Completed" mode in the Kanban board, enabling multi-card selection and 1-click invoice generation.
  - Implemented synchronized Kanban card hover cross-highlighting: hovering over any card illuminates all other cards sharing the same invoice ID with a unified color glow ring.
- **Multi-Profile Workspaces & Security (Post-Oct 08):**
  - Architected the multi-profile workspace engine (`src/types/profiles.ts`, `src/context/ProfileContext.tsx`, `src/components/profiles/ProfileGateModal.tsx`).
  - Built role-based onboarding supporting up to 5 local profiles with starter catalogs (Software Engineering, AI Development, Consulting).
  - Implemented PIN and password protection for profiles with security hint recovery and active profile switching.
- **Microinteractions & Spring Physics (Post-Oct 08):**
  - Built cross-platform spring physics animations using Motion (`src/lib/motion.ts`), live widget drag-and-drop customization, and navbar profile avatar polish (`e4d150d`).
- **Testing & Quality Engineering:**
  - Authored automated test suites across SQLite foreign key integrity, multi-profile limits, and task-to-invoice workflows, expanding test coverage to 26 test suites and 168 tests.

---

### 2. GVSL-Lahiru (`GVSL-Lahiru`)
**Primary Branch:** `Lahiru`

- **Lead Quality Assurance & Exploratory Bug Hunting:**
  - Conducted end-to-end exploratory testing across desktop releases, uncovering and documenting 17 critical user-facing defects post-v0.1.0.
  - Verified z-index modal hierarchies, database foreign key constraints, and navigation route retention.
- **Deliverable Submission Workflow (Post-Oct 08):**
  - Implemented the deliverable handoff workflow (`src/components/tasks/SubmitWorkModal.tsx`, `e794e22`, `7453c2e`).
  - Added drop interception when dragging task cards to `Done`, prompting the client's Google Drive delivery URL with a 1-click external link button.
  - Added deliverable submission confirmation, marking the task as submitted and updating the parent invoice status to `Finished / Submitted`.
- **Overdue Invoices Summary & Financial Aging (Post-Oct 08):**
  - Built the Overdue Invoices Summary engine and modal (`src/components/invoices/OverdueSummaryDialog.tsx`, `e552b05`, `1e7116c`).
  - Grouped unpaid invoices into aging buckets (Current 0-7 days, Overdue 8-14 days, Critical 15+ days) with overdue warning badges.
- **Data Export Engine (Post-Oct 08):**
  - Implemented tabular CSV ledger export functionality for Invoices, Expenses, and Outsourcing records (`src/lib/csv-export.ts`).
- **Application Shell & UI Polish:**
  - Implemented initial responsive sidebar navigation, clients profile directory, and persistent SQLite expenses ledger (`electron/ipc/expenses.ts`, `src/app/expenses/page.tsx`).
  - Resolved top navigation bar drag-and-drop glitches and dropdown menu appearance collisions (PR #5, `f0ceef3`).

---

### 3. Binuka Reshan (`Binukareshane`)
**Primary Branch:** `Binuka`

- **Task Outsourcing Engine & Payable Vouchers (Post-Oct 08):**
  - Built the complete outsourcing module (`src/app/outsourcing/page.tsx`, `src/components/outsourcing/OutsourcingView.tsx`, `aeb93db`, `6f3cda3`).
  - Created payable work order generation linked directly to Kanban deliverable cards and client invoices.
  - Implemented PDF payable voucher export (`VND-INV-xxxx`) containing contractor details, task specifications, agreed payout amounts, and deadlines.
  - Implemented 1-click contractor assignment dispatch via WhatsApp (`https://wa.me/`).
- **Automated Ledger Posting & Net Profit Integrity (Post-Oct 08):**
  - Connected contractor payout settlements directly to the financial ledger: marking an outsourcing voucher `Paid` automatically records a `Vendor Payout Expense` entry, preventing duplicate deductions and ensuring accurate net profit calculations.
- **AR Aging Template & Excel Workbook Engine (Post-Oct 08):**
  - Designed the professional 3-tab Accounts Receivable (AR) aging template table (`1dbb46f`).
  - Built the CSV-to-Excel workbook (`.xlsx`) generation engine and format selector (Excel, TSV, CSV) for accounting exports (`9e6098a`, `b95585b`).
- **Analytics & Currency Synchronization:**
  - Implemented executive metrics, gross revenue tracking, and global currency synchronization across dashboard widgets.

---

### 4. Sandika (`Sandika-2003`)
**Primary Branch:** `Sandika`

- **Service Catalog & Bulk Import:**
  - Developed the master service and product catalog (`src/app/catalog/page.tsx`, `src/components/catalog/CatalogView.tsx`) supporting hourly and fixed-fee rates.
  - Built the bulk CSV and Excel import parser (`src/lib/catalog-import.ts`) with downloadable starter templates and in-app instructions.
- **UI Rework Integration (Post-Oct 08):**
  - Coordinated the UI Rework branch (PR #6, `3db5ae9`), standardizing typography, layout containers, and design tokens across the application.
- **Invoice Document Preview Sheet (Post-Oct 08):**
  - Built the authentic invoice document preview sheet (`src/components/invoices/InvoiceDocumentSheet.tsx`, `cfc3c3f`), featuring geometric header art, invoice metadata grids, PDF export triggers, and WhatsApp/Email share links.
- **macOS Calendar Sync & Microinteractions (Post-Oct 08):**
  - Integrated the sprint Kanban board with local calendar scheduling (`src/components/tasks/TaskCalendarView.tsx`, `359971b`).
  - Implemented the two-way local macOS Calendar (`.ics`) synchronization engine (`src/lib/local-calendar.ts`, `a744187`, `2e8ec09`).
  - Built the event creation modal (`EventModal.tsx`) with date and time pickers, task manager bar, and calendar filter controls (`b8c4116`).
  - Designed playful microinteractions for task deletion, including hover-shake and click-press animations for trash icons (`9301bae`, `a4b6e51`).

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
| **Oct 07** | Nipun | `main` | Initial desktop release v0.1.0 packaging (`40f538d`). |
| **Oct 08** | Lahiru | `Lahiru` | Systematic exploratory QA audit of desktop v0.1.0, logging 17 critical user-facing bugs. |
| **Oct 08** | Nipun | `Nipun` | Bug resolution across all 17 defects (`c47fb18`), modal z-index re-stacking, and v0.1.1 desktop release. |
| **Oct 08** | Nipun | `Nipun` | Unclip invoice actions menu, interactive advance tracking status pill, and test suite expansion (`7c45210`). |
| **Oct 08** | Nipun | `Nipun` / `main` | Production release v0.1.2: receipt attachments, modal draft restore, catalog table layout, interactive status pills, and deletion FK integrity (`c3b273a`). |
| **Oct 08** | Nipun | `main` | Windows installer NSIS customization: desktop shortcut toggle option on finish screen (`b132a34`). |
| **Oct 14** | Sandika | `UI-Rework` | UI Rework: top navigation bar, modernized layout containers, and unified design tokens (`4f950ac`, PR #6). |
| **Oct 17** | Lahiru | `Lahiru` | Top navigation bar drag-and-drop fix, widget repositioning, and dropdown styling (PR #5, `f0ceef3`). |
| **Nov 04** | Binuka | `Binuka` | Outsourcing PDF vouchers (`VND-INV-xxxx`) and WhatsApp contractor task delegation (`aeb93db`). |
| **Nov 04** | Nipun | `Nipun` | Multi-profile workspace system, PIN/password locks, and role onboarding (`f5cd25c`). |
| **Nov 04** | Lahiru | `Lahiru` | Task handover workflow: Submit Work modal and Google Drive delivery linking (`e794e22`). |
| **Nov 04** | All Members | `main` | Integration merge of member feature branches (`dca67eb`, `fb9368b`, `6f3cda3`, `7453c2e`). |
| **Nov 05** | Lahiru | `Lahiru` | Overdue invoices summary dialog and CSV transaction data export engine (`e552b05`). |
| **Nov 05** | Binuka | `Binuka` | Professional 3-tab AR aging table and Excel (`.xlsx`) export engine (`1dbb46f`, `9e6098a`). |
| **Nov 06** | Sandika | `Sandika` | Exact invoice preview sheet (`InvoiceDocumentSheet.tsx`) and calendar embed (`cfc3c3f`). |
| **Nov 06** | Sandika | `Sandika` | macOS Calendar two-way `.ics` synchronization engine and task event modals (`a744187`, `b8c4116`). |
| **Nov 07** | Sandika | `Sandika` | Trash icon shake/press animations, month selector, and custom scrollbar (`9301bae`, `2e8ec09`). |
| **Nov 08** | Nipun | `Nipun` | Cross-platform spring animations, live widget drag-and-drop, and navbar avatar polish (`e4d150d`). |
| **Nov 08** | All Members | `main` | Production merge of member feature upgrades into `main` (`848d07e`). |
| **Nov 09** | Nipun | `Nipun` | Task-to-Invoice workflow, batch invoicing dialog, and synchronized Kanban hover highlights (`62f8520`). |

---

## Test & Build Verification

The integrated system is tested and verified through automated test suites and production packaging:
- **Test Framework:** Vitest runner (`vitest run`).
- **Total Test Suites:** 26 test files passed.
- **Total Unit & Integration Tests:** 168 tests passed (100% pass rate).
- **Type Checking:** `npx tsc --noEmit` compiles cleanly with zero errors.
- **Linter:** `npm run lint` passes cleanly with zero errors.
- **Desktop Packaging:**
  - macOS Apple Silicon (M1+): `release/BillFlow-0.1.2-arm64.dmg` verified and built.
  - macOS Intel: `release/BillFlow-0.1.2.dmg` verified and built.
  - Windows: `release/BillFlow Setup 0.1.2.exe` NSIS installer verified and built.

For the product overview and freelance workflow specification, see [README.md](README.md).
