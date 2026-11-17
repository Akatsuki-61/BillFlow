# BillFlow: Team Contribution & Engineering Log

This document records the individual module ownership, development timeline, and code contributions of the BillFlow engineering team (Akatsuki) for evaluation and academic auditing under IEEE Std 830-1998 and CMMI-DEV Level 2/3 guidelines.

---

## Team Summary & Module Ownership

| Member | GitHub Username | Branch | Core Responsibilities & Modules |
| :--- | :--- | :--- | :--- |
| **Nipun Yatawara** | `nipunyatawara-dev` | `Nipun` | Project architecture, Electron desktop runtime, SQLite database & Drizzle ORM migrations, multi-profile workspaces & PIN/password locks, task-to-invoice & batch invoicing engine, synchronized Kanban hover highlights, Settings 5-column invoice template gallery, profile reporting currencies & cached exchange rates, application-wide correctness/accessibility/PDF fixes, Electron IPC/profile/financial security hardening, motion transitions, DMG packaging artwork, and automated testing (Vitest + Playwright E2E). |
| **GVSL-Lahiru** | `GVSL-Lahiru` | `Lahiru` | Lead Quality Assurance & exploratory bug hunting, deliverable handoff workflow (`SubmitWorkModal` & Google Drive/repo delivery links), overdue invoices summary engine (AR aging: `Current`, `1-15 Days`, `16-30 Days`, `31-60 Days`, `60+ Days`), RFC 4180 CSV data export engine, and top navigation bar polish. |
| **Binuka Reshan** | `Binukareshane` | `Binuka` | Task outsourcing engine & contractor payable vouchers (`VND-INV-xxxx`), WhatsApp contractor task dispatch, auto-posting settled payouts to expense ledger, 3-tab AR aging template table, Excel workbook (`.xlsx`) export engine, and background macOS Calendar `.ics` synchronization with live sync status badges. |
| **Sandika** | `Sandika-2003` | `Sandika` | Catalog management & bulk CSV/Excel import, UI Rework integration (`PR #6`), interactive invoice preview sheet (`InvoiceDocumentSheet.tsx`), five modular offline HTML/PDF invoice templates (`Geometric Teal`, `Executive Wave`, `Scarlet Modern`, `Apex Orange`, `Noir Crimson`), local calendar embedding & `.ics` sync, and task trash delete microinteractions. |

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
- **Security Hardening, Template Gallery & v0.2.0 Release (Nov 12-13):**
  - Added the 5-column miniature invoice template preview gallery and custom logo settings flow (`51cccca`).
  - Hardened Electron IPC origin checks, per-profile SQLite/passcode isolation, filesystem symlink guards (`lstatSync`) and atomic file writes (`atomicWrite`), shell-free calendar process checks (`execFileSync`), URL scheme filtering in `formatExternalUrl`, and financial/migration integrity (`fc1953a`).
  - Resolved lint errors, fixed legacy backup imports and PDF page margins, created Retina macOS DMG installer artwork (`scripts/generate-dmg-background.mjs`), fixed macOS `startViewTransition` trigger origins (`7f2feb7`, `bf66017`), overhauled `README.md` (`98b68da`), added `CHANGELOG.md`, and tagged desktop release `v0.2.0` (`bab6fdb`, `bf66017`).
- **Testing & Quality Engineering:**
  - Authored automated tests covering SQLite foreign keys, multi-profile limits, task-to-invoice workflows, and Electron IPC/path security (`electron/test/security-integrity.test.ts`), expanding Vitest coverage to `27` test files and `210` unit/integration tests, alongside `3` Playwright packaged Electron end-to-end tests (`tests/electron/desktop.spec.ts`).
- **Profile Reporting Currency & Application Audit Fixes (Nov 17, `44b6dfb`):**
  - **Currency reporting:** Made the Settings primary currency profile-specific and converted Home, Analytics, invoice/expense/client/catalog/outsourcing summaries, forecasts, notifications and overdue executive exports into that currency. Preserved original invoice, expense, work-order, payment and catalog currencies; amount displays show the original foreign amount alongside the converted amount. Catalog insertion converts the selected service price into the invoice currency without relabelling existing lines, and task fees respect their selected currency. Added deterministic integer-cent conversion and weighted multi-currency client balances.
  - **Public exchange rates & feedback:** Added a bounded, validated main-process request to the public USD exchange-rate endpoint, daily atomic caching, offline cached-rate use, request deadlines and retry throttling. No client or financial records are transmitted. Missing rates block incomplete financial aggregates and converted exports. Kept rate dates, refresh controls and provider attribution in Settings; replaced the global rate banner with a short dismissible toast and discreet provider credit on applicable views.
  - **Profile privacy & release security:** Moved all six sensitive form drafts behind profile-authorized IPC with private atomic files, quarantined legacy unowned browser drafts, rejected stale-profile draft/activity writes, and cleared workspace UI when protected profiles lock. Added lock-on-screen-lock/suspend behavior, persisted each profile's theme/accent, and hardened production Electron fuses. Separated the instrumentation-enabled test package from the hardened production package.
  - **Financial integrity & practical performance:** Unified monthly profit with recorded contractor payouts, including standalone payables, and corrected mixed-currency overdue totals and exports. Rejected new/corrected invoice overpayments and reductions below active receipts, and detected changed expense retry payloads. Paginated the invoice register in groups of 50, bounded SQLite hydration queries to 500 IDs, and skipped unnecessary advance-tracking qualification. Allowed task-first outsourcing before invoicing and linked its work orders transactionally when the completed task is later invoiced (`0013_task_first_outsourcing.sql`).
  - **PDF consistency & export recovery:** Aligned native exports with preview signatures, billing addresses, payment links and supplied content; removed invented template filler. Routed Unicode contractor vouchers through the native HTML printer, preserved save cancellation without opening a fallback, and exposed failures. Reworked long-document print flow, repeated table headings and row-break behavior across all five templates. Added local queued/saved/failed export history with destinations, retry and export-folder recovery actions.
  - **Calendar & date correctness:** Preserved local date-only values, assigned payment/monthly buckets using local timestamp dates, and fixed native all-day events to end on the next day. Added stable calendar/occurrence identities, complete-field updates, bounded successful-snapshot deletion reconciliation, and fallback when the native SQLite calendar schema cannot be read. Kept locally created events and events outside the fully read window intact.
  - **Workspace recovery & directory lifecycle:** Added restore preflight record/currency/receipt/conflict summaries, merge validation in a sandbox, and an atomic pre-replace recovery checkpoint; synchronized restored profile currency/prefix metadata. Added per-profile local reminder/delivery history that records draft requests without claiming a message was sent. Added client/vendor archiving while preserving historical foreign keys, snapshots, invoices and ledgers (`0014_workspace_activity.sql`).
  - **Accessibility & visual quality:** Improved light-theme contrast, associated visible labels with controls, named selects, isolated modal backgrounds with `inert`, and maintained keyboard focus containment/restoration. Removed invalid title-bar ARIA, used compact chart values with full accessible values, fixed narrow-card wrapping/singular labels, and reset main-content scroll when navigating between screens.
  - **Regression & native verification:** Expanded coverage to `31` Vitest files / `242` passing tests and `6` packaged Electron scenarios across `desktop.spec.ts` and `currency-audit.spec.ts`. Tested populated migrations, currency/offline/financial edge cases, protected/public profile draft isolation, native locks, cancellation and all five 30-item PDF templates plus a Japanese voucher. Inspected eight main screens in light and dark mode at the minimum window size, scanned those screens and client dialogs with axe-core, and checked modal keyboard isolation. Verified matching QA/production application payloads, production fuse settings, ad-hoc code signing and native startup of the hardened macOS app. The temporary audit Markdown stayed local and was removed without being committed.

The earlier test counts above describe their original milestone; the current verification results are listed below. The November 17 pass did not exercise Windows runtime behavior, VoiceOver, real messaging dispatch or live macOS Calendar service round trips; calendar reconciliation was checked with native SQLite fixtures and generated helper tests.

---

### 2. GVSL-Lahiru (`GVSL-Lahiru`)
**Primary Branch:** `Lahiru`

- **Lead Quality Assurance & Exploratory Bug Hunting:**
  - Conducted end-to-end exploratory testing across desktop releases, uncovering and documenting 17 critical user-facing defects post-v0.1.0.
  - Conducted Windows and cross-surface QA testing on `v0.2.0` (Nov 15), identifying 18 additional UI, theme, and input bugs covering full-screen window sizing, accent-adaptive scrollbars, default Home widget row height and link clickability, invoice table corner radii, overdue export hover contrast, CSV/Excel toggle accent states, event badge swatch visibility, Choose/Edit Profile top-bar button clicks, Work Order due date picker support, click-anywhere date picker opening, and custom time selector scroll visibility.
  - Reported 7 additional UI and UX bugs during post-`v0.2.0` QA (Nov 17): the Expenses Export Report file download vs. Print Report split, hardcoded green on Invoices template/eye triggers and CSV/Excel export controls (including the Overdue Summary dialog), misaligned Analytics Cashflow Forecast 3-column cards/tables with header highlights bleeding into data rows, missing Settings workspace profile photo upload/remove confirmation toasts, and missing avatar photos in the profile popover.
  - Verified z-index modal hierarchies, database foreign key constraints, and navigation route retention.
- **Deliverable Submission Workflow (Post-Oct 08):**
  - Implemented the deliverable handoff workflow (`src/components/tasks/SubmitWorkModal.tsx`, `e794e22`, `7453c2e`).
  - Added drop interception when dragging task cards to `Done`, prompting the client's Google Drive delivery URL with a 1-click external link button.
  - Added deliverable submission confirmation, marking the task as submitted and updating the parent invoice status to `Finished / Submitted`.
- **Overdue Invoices Summary & Financial Aging (Post-Oct 08):**
  - Built the Overdue Invoices Summary engine and modal (`src/components/invoices/OverdueSummaryDialog.tsx`, `e552b05`, `1e7116c`).
  - Grouped unpaid invoices into aging buckets (`Current`, `1-15 Days`, `16-30 Days`, `31-60 Days`, `60+ Days`) with overdue warning badges and WhatsApp/Email reminder shortcuts.
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
- **Background Calendar Sync & Status Badges (Nov 08-09):**
  - Optimized calendar sync performance with silent `isMacCalendarAppRunning()` checks so local `.ics` updates sync without opening the Apple Calendar window (`2d69ece`, `dcbf1c1`, `80a1c8b`).
  - Connected task edits, reschedules, and deletions to background sync and redesigned the Calendar & Schedule header icon, live sync ping indicator, and animated update badges (`4cde5bf`, `a302ef4`, `62a8ee3`, `bad410c`, `4f6bad3`).

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
- **Modular Invoice Templates & Preview Refinement (Nov 11):**
  - Extracted and modularized `electron/pdf-templates/` and `src/components/invoices/templates/`, replacing `SL.` with `No.` (`d316fd9`) and aligning `Invoice No.` metadata across templates (`aebec78`).
  - Implemented and refined five offline HTML/PDF templates: `Geometric Teal`, `Executive Wave` (`4d90e1e`, `7eeb4da`, `f380fc6`, `3ff9da2`), `Scarlet Modern` (`5d11c59`), `Apex Orange` (`65206e0`, `a860938`), and dark-surface `Noir Crimson` (`bbac2ca`).
  - Replaced template toggle buttons with a selector dropdown (`0e5c6b7`), removed signature/payment footer sections across all templates (`0b17f54`), disabled modal drag-region capture (`aa38503`), and streamlined PDF preview closing and WhatsApp/Email PDF sharing (`4bf374a`).

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
| **Nov 09** | Nipun | `Nipun` | Task-to-Invoice workflow, batch invoicing dialog, and synchronized Kanban hover highlights (`62f8520`), plus `AGENTS.md` and `CONTRIBUTIONS.md` updates (`6c59bb4`). |
| **Nov 09** | Binuka | `Binuka` / `main` | Silent background macOS Calendar `.ics` sync, auto-sync on task edits/deletes, and Calendar & Schedule live sync badges (`2d69ece`..`4f6bad3`, merged via `80a1c8b`). |
| **Nov 11** | Sandika | `Sandika` | Modular HTML/PDF invoice template architecture (`d316fd9`), `Executive Wave`, `Scarlet Modern`, `Apex Orange`, and `Noir Crimson` templates (`4d90e1e`..`bbac2ca`), selector dropdown (`0e5c6b7`), footer cleanup (`0b17f54`), and modal/preview fixes (`4bf374a`, `aa38503`). |
| **Nov 12** | Nipun | `Nipun` | ESLint cleanup, legacy backup import & PDF margin fixes, `v0.2.0` bump (`bab6fdb`), and IPC/profile/financial/filesystem security hardening + Playwright Electron E2E suite (`fc1953a`). |
| **Nov 13** | Nipun | `Nipun` / `main` | Settings 5-column miniature template preview gallery (`51cccca`), unified UI motion & macOS trigger origin fixes (`7f2feb7`, `0fd3e47`), `README.md` overhaul (`98b68da`), Retina DMG background artwork, `CHANGELOG.md`, and production release `v0.2.0` (`bf66017`). |
| **Nov 15** | Lahiru | `Lahiru` | Post-`v0.2.0` Windows and desktop QA pass uncovering 18 UI, theme, profile-gate, widget-layout, invoice toggle/table, and date/time picker bugs (all 18 resolved across CSS tokens, `ProfileGateModal`, `WidgetRenderer`, `OverdueSummaryDialog`, `InputPickerEnhancer`, and `TimePickerInput`). |
| **Nov 17** | Lahiru / Nipun | `Nipun` / `main` | Post-`v0.2.0` QA follow-up fixing 7 UI/UX bugs: Expenses `Export Report` CSV download vs. `Print Report` split, Settings accent color consistency on Invoices and Overdue Summary controls, Analytics Cashflow Forecast 3-column alignment and header highlight containment, Settings workspace photo upload/remove toasts, and profile popover avatar photo rendering (`expenses/page.tsx`, `InvoicesView.tsx`, `OverdueSummaryDialog.tsx`, `CashflowForecast.tsx`, `analytics.css`, `settings/page.tsx`, `Sidebar.tsx`, `ProfileAvatarTile.tsx`, `ProfileGateModal.tsx`, `ProfileContext.tsx`). |
| **Nov 17** | Nipun | `Nipun` / `main` | Profile-specific primary reporting currency, validated/cached public exchange rates, original foreign-currency amounts, correct mixed-currency summaries/exports and catalog conversion, plus a dismissible currency toast (`44b6dfb`). |
| **Nov 17** | Nipun | `Nipun` / `main` | Application audit fixes across draft privacy, screen locks, release fuses, payments, monthly profit, task-first outsourcing, PDF pagination/Unicode/signatures, calendar reconciliation, accessibility and practical pagination; restore preflight/checkpoints, archive/history/export retry; migrations `0013`/`0014`, `242` Vitest tests and `6` packaged Electron tests (`44b6dfb`). |
| **Nov 17** | Nipun | `Nipun` / `main` | Updated the contribution log and branch synchronization instructions: `Nipun`, `Sandika`, `Lahiru` and `Binuka` share the integrated `main` history; `UI-Rework` is frozen and explicitly excluded from all synchronization pushes. |

---

## Test & Build Verification

Current verification for the November 17 `v0.2.0` workspace/currency changes:
- **Unit & Integration Framework:** Vitest (`vitest run`).
- **Vitest Results:** `31` test files passed, `242` tests passed (100% pass rate).
- **Desktop End-to-End Tests:** `6` passing Playwright Electron scenarios across `tests/electron/desktop.spec.ts` and `tests/electron/currency-audit.spec.ts`, covering both billing loops, currency reporting, catalog conversion, offline PDFs, multi-profile backups/drafts, screen locks, customization, bridge origin checks and packaged runtime payload validation.
- **Type Checking:** `npx tsc --noEmit` compiles cleanly with zero errors.
- **Linter:** `npm run lint` passes cleanly with zero errors.
- **Production Build:** `npm run build` completes for the static renderer and Electron bundles.
- **Desktop Packaging & Visual Checks:**
  - macOS Apple Silicon (arm64): rebuilt/ad-hoc signed the hardened production app (`release/preview-0.2.0/mac-arm64/BillFlow.app`) and separately built the test app (`npm run pack:mac:test`, `release/test-0.2.0/mac-arm64/BillFlow.app`). The six native scenarios use the test app; the hardened app was independently launched and its signature/fuses checked. No Developer ID/notarization is claimed.
  - Inspected eight main screens in both themes at 1100×700, with passing sampled axe-core rules on those screens and both client dialogs. Verified focus containment/background isolation. Exported and inspected all five distinct 30-item invoice PDFs with no missing item markers, plus a Unicode contractor voucher.
  - Existing `v0.2.0` macOS DMG and Windows NSIS artifacts belong to earlier packaging runs. They were not rebuilt or runtime-verified for the November 17 currency/audit changes; Windows and live OS Calendar round trips remain untested for this batch.
  - Previous `v0.1.2` installers remain in `release/` (`BillFlow-0.1.2-arm64.dmg` and `BillFlow-0.1.2.dmg`); the Intel macOS `0.2.0` `.dmg` has not yet been packaged locally.

For the product overview and freelance workflow specification, see [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).
