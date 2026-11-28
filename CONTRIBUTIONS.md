# BillFlow: Team Contribution & Engineering Log

This document records the individual module ownership, development timeline, and code contributions of the BillFlow engineering team (Akatsuki) for evaluation and academic auditing under IEEE Std 830-1998 and CMMI-DEV Level 2/3 guidelines.

---

## Team Summary & Module Ownership

| Member | GitHub Username | Branch | Core Responsibilities & Modules |
| :--- | :--- | :--- | :--- |
| **Nipun Yatawara** | `nipunyatawara-dev` | `Nipun` | Project architecture, Electron desktop runtime, SQLite database & Drizzle ORM migrations, multi-profile workspaces & PIN/password locks, task-to-invoice & batch invoicing engine, synchronized Kanban hover highlights & top-tint/3D tag polish, on-device Local AI/OCR Smart Capture (`tesseract.js` + `all-MiniLM-L6-v2` + Enhanced Offline AI Pack `bge-base-en-v1.5`/`nli-deberta-v3-small` + optional loopback Ollama), in-app GitHub Releases updater, unified vertical toast stack, Settings 5-column invoice template gallery, Elegant Sans workspace typeface, profile reporting currencies & cached exchange rates, guided onboarding & chart pipeline upgrades, Home widget curation & guided workspace tour, Electron IPC/profile/financial security hardening, bundle/SQLite/RAM optimizations, window-state & Tray/Dock quick actions, native OS drag-and-drop, startup `PRAGMA quick_check` & rolling AES-256-GCM encrypted backups, recurring retainers, morning financial digest & app badge count, proposals/quotes workflow, client & invoice Project Margin (P&L) drawer, DMG packaging artwork, and automated testing (Vitest + Playwright E2E). |
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

- **Application Audit Upgrades, Security, Size/RAM Optimizations & Desktop Tweaks (Nov 19):**
  - **Onboarding, UX & chart pipeline fixes (`36f6c95`..`4f21c39`, `c4ac2a1`):** Built the non-blocking interactive workspace tour, Quick Start checklist bar, and keyboard shortcuts reference dialog. Added invoice duplication drafts, payment summary copy, quick task stage advance, unified chart data pipelines (`src/lib/widgets/chartData.ts`), split oversized invoice/outsourcing/settings modals, removed stale hardcoded client references, and fixed pre-merge regressions on `Nipun`.
  - **Security & pre-merge regression hardening (`c4ac2a1`):** Hardened Electron IPC origin/unlock/protocol checks, secondary-profile task assignee lookups, tour layering and route matching under trailing slashes, dashboard metric spans, overdue invoice tracking, and `KeyboardShortcutsModal` lock gating (`electron/test/security-integrity.test.ts` expanded to `54` tests).
  - **Data integrity & desktop lifecycle fixes:** Fixed `promoteInvoiceClient` task linking, subcontractor work-order and vendor balance synchronization, `invoices:update` validation guards, passwordless vs. passworded profile lock recovery, pure UTC DST due-date math, SQLite `busy_timeout = 5000` and clean shutdown, Next.js `error.tsx`/`global-error.tsx` boundaries, renderer crash recovery, Windows/Linux `TitleBar` sizing, and dropped-byte receipt validation (`electron/test/section3-integrity.test.ts`, `9` tests).
  - **Bundle size, SQLite & RAM optimizations:** Extracted the Node `pdf-lib` fallback (`electron/pdf-fallback.ts`) and moved invoice PDF rendering to a pooled ephemeral offscreen window (reducing `dist-electron/main.js` from `1,228 KB` to `824 KB` on disk). Added 16 SQLite indexes (`0015_performance_indexes.sql`), `synchronous = NORMAL`, `temp_store = MEMORY`, single-invoice `getInvoiceWithClient` lookups, snapshot query deduplication, disk-backed opaque-token backup preflight/import, `<LazyMotion>` async `domMax` loading, local `inter-latin.woff2` font bundling, a 10-context domain split in `DataProvider`, zero-copy `reportingRecords`, shrunk `build/icon.png` (`952 KB` to `72 KB`), and DOM/GPU compositor cleanups (`electron/test/section4-optimizations.test.ts`, `7` tests).
  - **High-ROI desktop workflow tweaks:** Added display-clamped `window-state.json` persistence (`electron/window-state.ts`), Tray and macOS Dock quick actions (**New Invoice**, **Add Expense**, **Lock Workspace**), native OS file drag-and-drop via `webUtils.getPathForFile` in `electron/preload.ts` for receipts, logos/photos, and backups, a shared `ToastProvider` replacing `window.alert()`, an Expenses **Linked Invoice / Project** selector with linked CSV column and receipt drops, 1-click WhatsApp handover in `SubmitWorkModal`, OS-aware shortcut hints (`src/lib/platform-shortcuts.ts`), a top-level `Board | List | Calendar` toggle on `/tasks`, and updated runtime notices (`electron/test/section5-desktop-tweaks.test.ts` and `src/lib/test/platform-shortcuts.test.ts`, `8` tests).
  - **Section 6 desktop workflows & automation (Nov 19, work timer skipped per client scope):**
    - **Startup `PRAGMA quick_check` & rolling encrypted backups:** Added startup SQLite quick integrity verification (`assertDatabaseQuickCheck`, `getDatabaseHealth` in `electron/db/index.ts`), gzip + AES-256-GCM (`scrypt`) `.bfbackup` export, `safeStorage` keychain passphrase helpers, symlink-guarded rotating local/cloud-folder backups (`runRollingEncryptedBackup`), and staged restore verification (`electron/encrypted-backup.ts`, `src/components/settings/EncryptedBackupCard.tsx`).
    - **Recurring retainers & morning financial digest:** Added calendar cadence scheduling with month-end clamping (`electron/recurring-schedule.ts`), transactional invoice creation (`createInvoiceInTx`), auto PDF export, and local timers/OS alerts (`electron/ipc/recurring.ts`, `src/components/invoices/RecurringRulesTab.tsx`). Added once-per-day morning briefing alerts for overdue invoices, due tasks, and 7-day vendor payouts alongside `app.setBadgeCount()` and tray tooltip sync (`electron/digest.ts`, `src/app/settings/page.tsx`).
    - **Proposals/Quotes workflow & Project Margin (P&L) drawer:** Added isolated `quotes` and `quote_items` tables (`0016_section6_workflows.sql`), `QT-YYYY-NNN` numbering, `PROPOSAL` support across all five PDF and React templates, live preview, and 1-click transactional `convertQuoteToInvoice` (`electron/ipc/quotes.ts`, `src/components/invoices/QuotesTab.tsx`). Built client and invoice P&L analysis combining revenue, vendor work orders, expenses, and tracked task time with Accrual/Cash switching (`src/lib/project-margin.ts`, `src/components/analytics/ProjectMarginDrawer.tsx`, `electron/test/section6-features.test.ts`, `src/lib/test/project-margin.test.ts`).

- **Settings, Full Reset & Guided Onboarding (Nov 20):**
  - Consolidated workspace identity, avatar and accent controls, currency, and invoice prefix under Business profile. Reworked Workspace interface spacing and the Local activity history disclosure (`cd7d3d8`).
  - Added separate active-profile and full-application resets. The full reset queues cleanup before the next database startup, removes managed data across profiles, and restarts BillFlow at the first-run picker (`electron/application-reset.ts`).
  - Replaced the first-launch role setup with an empty picker, one question at a time, and a profile review. Added optional notifications and Apple Calendar Automation after profile creation. A persisted setup checkpoint lets BillFlow resume at permissions after a restart (`0017_guided_setup.sql`, `FirstRunOnboarding.tsx`, `electron/desktop-setup.ts`).
  - Prepared `v0.3.0` by synchronizing package metadata, installer artwork, desktop build paths, and release notes. Added packaged coverage for keyboard navigation, retaining profile data and permission choices through a restart, and continuing after an unavailable permission.
  - Added the **Elegant Sans** workspace typeface (`Regular`, `Medium`, `Bold`, and `Condensed Bold` weights in `public/fonts/elegant-sans-*.ttf`), registered in `src/app/globals.css`, selectable in Settings -> Appearance, validated in `electron/validation.ts`, and tested in `electron/test/section6-features.test.ts` and `tests/electron/desktop.spec.ts`.
  - Added an optional password setup step in `FirstRunOnboarding.tsx` and verified restart lock behavior with pending permissions preserved (`electron/test/profiles.test.ts`), alongside keyboard-accessible profile icon radio tiles in `WorkspaceProfileFields.tsx`.
  - Removed `WorkflowQuickStartBar`, unpinned `Workspace Insights` from the default Home dashboard while restricting Home widget pinning via `canPinToDashboard` and `DASHBOARD_WIDGET_CATALOG` (`widgetDefinitions.ts`, `widgetStorage.ts`, `AnalyticsView.tsx`, `Sidebar.tsx`, `src/app/page.tsx`), and reworked `WorkspaceTour.tsx` and `src/lib/onboarding-tour.ts` with an inline Home tour invitation, persisted `completed` and `dismissed` state, route-synced steps, and step heading focus. Bumped the macOS build number to `3` (`bundleVersion` in `electron-builder.yml`).

- **Two-Tier Local AI & Smart Invoice Capture (Nov 25, `a191b0c`..`49dc97f`):**
  - **Bundled Standard Offline AI & OCR:** Built the main-process OCR and semantic extraction pipeline (`electron/ai/ocr.ts`, `electron/ai/semantic-standard.ts`, `electron/ai/entity-parser.ts`, `electron/ai/transformers-loader.ts`) combining offline `tesseract.js` LSTM OCR (`eng.traineddata.gz`), quantized `Xenova/all-MiniLM-L6-v2` ONNX sentence embeddings (~25.6 MB total via cross-platform `scripts/prepare-ai-models.mjs`), zero-shot deliverable vs. chitchat filtering, semantic Service Catalog price matching, client directory fuzzy matching, and deterministic parsing of relative/absolute due dates, currencies, delivery URLs, and inline quantities/prices.
  - **Optional Enhanced Local LLM Tier:** Added on-demand `onnx-community/Qwen2.5-0.5B-Instruct` (INT8 ONNX) management (`electron/ai/config.ts`, `electron/ai/llm-enhanced.ts`, `electron/ipc/ai.ts`) stored in `userData/models/` (shared across profiles, excluded from backups) with atomic pinned HTTPS downloads, live IPC progress events, cancel/delete controls, 5-minute idle memory disposal, and automatic fallback to Standard.
  - **Smart Capture Drawer, Invoice Auto-Fill & AI Settings:** Built the slide-over `SmartCaptureDrawer.tsx`, `AiCaptureContext.tsx` (`Cmd/Ctrl+Shift+I` shortcut, top-bar trigger, and Invoices button), HTML5 canvas dark-mode screenshot auto-inversion/upscaling preprocessor (`src/lib/image-preprocess.ts`), 1-click pre-fill handoff into `InvoicesView.tsx`'s default New Invoice modal, and the **Settings → AI & Capture** tab (`src/components/settings/AiSettingsPanel.tsx`).
  - **Bank Slip Auto-Reader, Expense Receipt Scanner & Intent-Aware Routing:** Added `electron/ai/document-parsers.ts`, non-consuming staged capability-token reads (`peekStagedAttachmentBytes` in `electron/ipc/files.ts`), `ai:scanPaymentSlip` (auto-filling Record Payment amount, date, reference, and detecting advance/balance/currency mismatches on pick, drop, or paste), `ai:scanExpenseReceipt` (auto-filling merchant, description, total, currency, date, and MiniLM neural OPEX category in Expenses), and zero-shot capture intent routing across **New Invoice**, **Proposal / Quote** (`QuotesTab.tsx`), and direct **Kanban Tasks** creation (`SmartCaptureDrawer.tsx`, `electron/test/ai-document-scanners.test.ts`).
  - **Cross-Platform macOS ARM64 & Windows x64 Packaging:** Configured `electron-builder.yml` `extraResources` (`assets/ai-models`), ASAR unpacking (`onnxruntime-node`, `tesseract.js`, `tesseract.js-core`), platform-specific binary exclusions (`onnxruntime-web`, Linux, non-target arches, duplicate macOS dylib, non-LSTM Tesseract cores), and updated `scripts/generate-runtime-notices.mjs`. Added unit and offline OCR/MiniLM integration suites (`electron/test/ai-entity-parser.test.ts`, `electron/test/ai-ipc.test.ts`, `electron/test/ai-document-scanners.test.ts`).
- **Zentra-Inspired Desktop Redesign, Unified 3D Keycaps & v0.3.0 (Build 4) Release (Nov 25, `6293b6c`..`d19eb85`):**
  - **Light/Dark/Accent System & 5-Card Overview Bento:** Redesigned the application shell and Overview dashboard with full Light Mode and Dark Mode parity, Profile Accent-driven primary buttons and notification toasts, 5-card bento layout (`Payments`, `Gross Volume`, `Net Margin`, `Invoices`, `Clients`), simplified `Weekly | Monthly | Quarterly | Yearly | All Time` selector, and DPI-independent percentage view-transition origin coordinates for macOS Retina displays (`src/app/theme.css`, `src/app/globals.css`, `src/lib/motion.ts`, `src/components/dashboard/ZentraCharts.tsx`).
  - **Uniform Headers, Compact KPI Strips & Unified Export Modals:** Standardized page header heights across all workspace routes, introduced compact `.kpi-strip` summary rows across `Invoices`, `Clients`, `Catalog`, `Expenses`, `Outsourcing`, and `Tasks`, consolidated Invoices CSV/Excel export into a single `Export` dialog, and consolidated Expenses export/print into a single `Export Report` dialog (PDF via `pdf-lib`, Print, CSV).
  - **Unified 3D Keycap Controls & Overview Customizer Polish:** Created shared `--ui-keycap-*` tokens aligning all non-primary buttons, circular icon buttons, dropdown pills, switches, and segmented toggles identically with active toggle highlights in both Light and Dark modes, replaced top-bar icon hover tilts with ringing bell and magnifying-glass zoom animations, fixed the Overview widget customizer height-animated open/close collapse, removed the duplicate `Done` button, reordered panel actions (`Undo` → `Reset` → `Full Analytics Catalog`), and bumped macOS `bundleVersion` to `4` (`v0.3.0`, build `4`).
- **Local AI Stability Overhaul, In-App Updater, Smart Capture UX, Toast Stack & Tasks Polish (Nov 25–27, `7c3fc2c`..`7f88f3c`):**
  - **macOS ONNX Crash Fix & Enhanced Offline AI Pack + Loopback Ollama (`7c3fc2c`):** Resolved the macOS Electron 44 `SIGTRAP` 2 GiB `BFCArena` crash via `SAFE_ONNX_SESSION_OPTIONS` (`enableCpuMemArena: false`, `enableMemPattern: false`), replaced `Qwen2.5-0.5B-Instruct` with the fast Enhanced Offline AI Pack (`Xenova/bge-base-en-v1.5` + `Xenova/nli-deberta-v3-small`, ~270 MB), added optional loopback-only Ollama support (`electron/ai/ollama.ts`), fixed Standard AI semantic catalog matching, and added an inline AI engine switcher in the Smart Capture footer.
  - **In-App GitHub Releases Updater (`7c3fc2c`):** Implemented GitHub Releases version checking, installer downloading, and launch (`electron/updater.ts`, `src/context/UpdateContext.tsx`, `src/components/ui/UpdateDialog.tsx`), wired to the bottom-left version button in Settings (`src/app/settings/page.tsx`) and `BillFlow → Check for Updates...` in the macOS application menu (`electron/menu.ts`), covered by `electron/test/updater.test.ts` and `electron/test/menu_and_charts.test.ts`.
  - **Smart Capture Extracted Results Rework (`3df835b`, `83790c5`):** Reworked the entire results panel under **Destination** in `SmartCaptureDrawer.tsx` and `smart-capture.css` with 3D segmented toggles, inline editable Client and Saved Clients picker, editable Due Date with `"next week"` / `"next month"` parsing, per-row Service Catalog pickers with automatic catalog-name application, removal of deliverable checkboxes, and em-dash copy cleanup.
  - **Unified Vertical Toast Stack (`86c82c3`):** Upgraded `ToastContext.tsx`, `ToastBanner.tsx`, and `.bf-toast-stack` in `src/app/globals.css` so concurrent toasts stack vertically (newest on top, oldest at bottom) with independent auto-dismiss, migrating all view-local fixed toast banners across Clients, Settings, Invoices, Outsourcing, Tasks, and Currency Feedback.
  - **Tasks Card Visual Rework (`7f88f3c`):** Replaced the left vertical accent bar on invoice-linked Kanban cards with a subtle top hue wash (`.task-invoice-tint`) that deepens across sibling cards on hover, reworked task category badges into 3D keycaps (`.task-category-tag`), and replaced priority text tags on Kanban cards with matching-height `24px` 3D 3-color `Flag` icon badges (`Red` High/Urgent, `Blue` Medium, `Green` Low) consistently across Kanban, List, and Detail views.
  - **Smooth Route Navigation, Outsourcing List Stagger & Idle CPU Fix (`aa61012`, `636a27b`):** Eliminated the brief blank-canvas flash on page switches by switching `.motion-page` from `opacity: 0` to a `0.94 → 1` micro-settle (`src/app/globals.css`), pre-warming top-level nav routes on idle (`src/components/layout/Sidebar.tsx`), caching immutable `/_next/static/` bundles in Electron's `app://` protocol handler (`electron/main.ts`), replacing jarring Suspense fallbacks on Catalog and Outsourcing, adding `listRowTransition` one-by-one staggered entrance animations to Outsourcing **Work Orders** and **Vendors** rows (`src/components/outsourcing/OutsourcingView.tsx`), and resolving an infinite IPC/re-render loop in `UpdateProvider` (`src/context/UpdateContext.tsx`) that spiked idle CPU usage.

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
| **Nov 19** | Nipun | `Nipun` | Added onboarding tour, Quick Start bar, shortcuts modal, modal refactoring, chart pipeline fixes, pre-merge regression fixes, and IPC/profile security tests (`36f6c95`..`c4ac2a1`). |
| **Nov 19** | Nipun | `Nipun` / `main` | Completed application audit Sections 3, 4, and 5: lifecycle and financial integrity fixes, SQLite indexes/pragmas and query deduplication, bundle/RAM optimizations, persistent window bounds, Tray/Dock quick actions, native OS drag-and-drop, shared Toast provider, Expenses project links, SubmitWork WhatsApp dispatch, OS shortcut labels, and `/tasks` Calendar view toggle. |
| **Nov 19** | Nipun | `main` / Members | Merged `Nipun` into `main` and fast-forwarded `Nipun`, `Binuka`, `Lahiru`, and `Sandika` to match `main` (`f599529`); `UI-Rework` remains frozen at `3db5ae9` and excluded from synchronization. |
| **Nov 19** | Nipun | `Nipun` | Implemented Section 6 workflows (excluding the work timer): SQLite startup `quick_check`, rolling AES-256-GCM encrypted backups, recurring retainers, morning financial digest & app badge sync, proposals/quotes with 1-click invoice conversion (`0016_section6_workflows.sql`), and client/invoice Project Margin (P&L) drawer. |
| **Nov 19** | Nipun | `main` / Members | Integrated Section 6 workflows from `Nipun` into `main` and fast-forwarded `Nipun`, `Binuka`, `Lahiru`, and `Sandika` to match `main`; `UI-Rework` stays frozen at `3db5ae9` and excluded from synchronization. |
| **Nov 20** | Nipun | `Nipun` | Consolidated Settings, added a full app reset, and implemented guided onboarding with optional desktop permissions that resume after restart. Prepared the `v0.3.0` Apple Silicon installer and updated the changelog. |
| **Nov 20** | Nipun | `Nipun` | Added the Elegant Sans workspace typeface (`Regular`, `Medium`, `Bold`, `Condensed Bold`), added optional password setup to first-run onboarding, converted Settings profile icons to radio tiles, removed `WorkflowQuickStartBar` and default `Workspace Insights` from Home, reworked the guided `WorkspaceTour`, and bumped the macOS build number to 3. |
| **Nov 25** | Nipun | `Nipun` | Implemented the **Two-Tier Local AI Suite** (Intent-Aware Smart Capture routing to Invoice/Quote/Tasks, Bank Transfer Slip Auto-Reader with mismatch alerts, Expense Receipt Scanner with MiniLM neural OPEX classification, dark-mode screenshot preprocessor, **Settings → AI & Capture** tier controls, in-app Support FAQs, and macOS ARM64 + Windows x64 ONNX/OCR packaging) alongside Ledger overview widgets (`04ce29d`..`fd1b9e1`). |
| **Nov 25** | Nipun | `main` / Members | Integrated `Nipun` (Ledger overview widgets and Two-Tier Local AI Suite) into `main` and fast-forwarded `Nipun`, `Binuka`, `Lahiru`, and `Sandika` to match `main`; `UI-Rework` remains frozen at `3db5ae9` and excluded from synchronization. |
| **Nov 25** | Nipun | `Nipun` / `main` | Completed the Zentra-inspired Light/Dark/Accent redesign, compact KPI strips across 6 tabs, unified Invoices & Expenses export modals, unified 3D keycap buttons & toggles, macOS Retina theme-wipe fix, smooth Overview widget customizer collapse, and `v0.3.0` (Build 4) release preparation (`6293b6c`..`d19eb85`); synced `main`, `Nipun`, `Binuka`, `Lahiru`, and `Sandika` while keeping `UI-Rework` frozen at `3db5ae9`. |
| **Nov 26** | Nipun | `Nipun` | Fixed macOS Electron 44 ONNX `SIGTRAP` crash, upgraded local AI to the Enhanced Offline AI Pack (`bge-base-en-v1.5` + `nli-deberta-v3-small`) + optional loopback Ollama, added the in-app GitHub Releases updater (Settings version button & macOS menu bar), reworked Smart Capture results with inline Client/Catalog/Due Date pickers, unified concurrent notification toasts into a vertical stack, and reworked Tasks card invoice top tint, 3D category tags, and 3-color priority flag icons (`7c3fc2c`..`7f88f3c`). |
| **Nov 27** | Nipun | `main` / Members | Merged `Nipun` into `main` via fast-forward (`7f88f3c`), updated `README.md`, `CHANGELOG.md`, `CONTRIBUTIONS.md`, and `AGENTS.md`, and fast-forwarded `Nipun`, `Binuka`, `Lahiru`, and `Sandika` to `main` while keeping `UI-Rework` frozen at `3db5ae9`. |
| **Nov 28** | Nipun | `main` / `Nipun` | Eliminated blank route-switch flashes (non-zero `.motion-page` settle, idle route prefetching, immutable static protocol caching, clean Suspense fallbacks), added staggered `listRowTransition` animations to Outsourcing Work Orders & Vendors (`aa61012`), prepared `v0.3.1` (`bundleVersion` `5`), fast-forwarded `Nipun` to `main`, refreshed the `v0.3.1` GitHub release draft, and rebuilt the signed macOS Apple Silicon `.dmg` (`UI-Rework` untouched at `3db5ae9`). |

---

## Test & Build Verification

The November 28 `v0.3.1` release preparation on `main` passed the following verification checks:

- **Vitest:** **332 passing tests across 45 test files**, including SQLite integrity/security (`54` tests), task-to-invoice workflows, Section 6 workflows (quotes, recurring retainers, project margin, encrypted backups), GitHub Releases updater & macOS menu bar tests (`electron/test/updater.test.ts`, `electron/test/menu_and_charts.test.ts`), and real offline `tesseract.js` PNG OCR + ONNX semantic extraction (`electron/test/ai-entity-parser.test.ts`, `electron/test/ai-ipc.test.ts`, `electron/test/ai-document-scanners.test.ts`).
- **TypeScript & Lint:** `npx tsc --noEmit` (0 errors) and `npx eslint src/ electron/` (0 errors, 0 warnings).
- **Cross-Platform Installers Verified:**
  - **macOS Apple Silicon (`.dmg`):** `BillFlow-0.3.1-arm64.dmg` (`CFBundleShortVersionString = 0.3.1`, `CFBundleVersion = 5`, verified via `codesign --verify --deep --strict`).
  - **Windows 64-bit (`.exe`):** `BillFlow Setup 0.3.0.exe` verified on Windows (`v0.3.1` pending Windows build).
- **Earlier Milestone Checks:** On November 20, Playwright passed **7 packaged Electron desktop scenarios** on macOS Apple Silicon covering keyboard navigation, guided onboarding restart resume, and unavailable permission fallback. The November 19 build was also verified with isolated app data for project margins, proposal conversion, recurring invoice generation, financial digest, and encrypted backups.

For the product overview and freelance workflow specification, see [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md).
