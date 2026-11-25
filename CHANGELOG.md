# Changelog

Notable changes between BillFlow desktop releases.

## v0.3.0 (2026-11-25) — Build 4

Major release introducing a redesigned Light/Dark desktop interface with custom accent themes, an offline on-device AI suite, proposals and recurring retainers, project profit tracking, profile-currency reporting, encrypted rolling backups, and guided first-run setup.

### What's New

- **Offline Local AI & Smart Capture (`Cmd/Ctrl+Shift+I`):**
  - Paste or drop a chat screenshot or message from WhatsApp, Slack, Signal, or email to automatically extract the client, deliverables, prices, due dates, and links, match your Service Catalog, and send them straight into a **New Invoice**, **Proposal / Quote**, or **Kanban Tasks**.
  - Dark-mode chat screenshots are automatically inverted and sharpened before offline OCR reads them.
  - **Bank Transfer Slip Auto-Reader:** Drop, select, or paste a payment slip in **Record Payment** to auto-fill the amount, date, and bank reference while flagging underpayments, overpayments, or currency mismatches.
  - **Expense Receipt Scanner:** Drop, select, or paste a receipt (or click **Scan Receipt**) in **Expenses** to auto-fill the merchant, date, total, and currency and automatically pick the right expense category.
  - **Two Local AI Tiers (`Settings → AI & Capture`):** Works completely offline out of the box with the built-in **Standard** tier (~25.6 MB bundled OCR + semantic model), plus an optional **Enhanced** local LLM (`Qwen2.5-0.5B-Instruct`) you can download, cancel, or delete anytime. Nothing leaves your computer.
- **Proposals, Recurring Retainers & Project Profit:**
  - **Proposals & Quotes:** Create numbered quotes (`QT-YYYY-NNN`), preview or export them using all five invoice templates, and convert approved proposals into invoices with one click.
  - **Recurring Retainers:** Schedule repeating invoices (weekly, monthly, quarterly, or yearly) with automatic invoice creation and PDF export.
  - **Project Margin (P&L) Drawer:** Check true net profit for any client or invoice (revenue minus subcontractor payouts, linked expenses, and tracked time) in both Accrual and Cash views.
  - **Morning Financial Digest & App Badge:** Optional daily summary notifications for overdue invoices, due tasks, and upcoming contractor payouts.
- **Profile Currency Reporting:**
  - Choose a primary reporting currency per profile to view combined totals across Overview, Analytics, and summaries using cached daily exchange rates, while preserving every invoice and expense's original currency.
- **Guided Setup, Encrypted Backups & Full Reset:**
  - Step-by-step first-run onboarding with optional password setup, optional desktop notifications, and optional Apple Calendar sync that resumes cleanly after a restart.
  - Password-protected AES-256-GCM encrypted backups (`.bfbackup`), automatic rolling backups, restore preflight checks, and startup SQLite integrity checks (`PRAGMA quick_check`).
  - Separate **Reset active profile** and **Reset entire app** options in **Settings → Backup & data**.
- **Desktop Workflow Upgrades:**
  - Remembers your window size and position across launches.
  - Added System Tray and macOS Dock quick actions (**New Invoice**, **Add Expense**, **Lock Workspace**), native OS drag-and-drop for receipts and logos, linked invoice selectors on Expenses, and 1-click WhatsApp handover in **Submit Work**.
  - Added an interactive guided workspace tour, keyboard shortcuts cheat sheet, and **Local AI & OCR** FAQs in Help & Support.

### Changed & Improved

- **Fresh Light & Dark Mode Desktop Redesign:**
  - Rebuilt the interface around a crisp card-and-bento layout with full Light Mode and Dark Mode parity, smooth circular theme-switch transitions, and **Profile Accent Presets** that theme primary buttons, active controls, focus rings, and toast notifications.
  - Rebuilt the **Overview** screen with a focused 5-card bento layout (`Payments`, `Gross Volume`, `Net Margin`, `Invoices`, `Clients`), a streamlined period selector (`Weekly`, `Monthly`, `Quarterly`, `Yearly`, `All Time`), and a smooth height-animated **Add widget** customizer drawer (`Undo`, `Reset`, `Full Analytics Catalog`).
  - Added **Elegant Sans** as a selectable workspace font alongside Inter.
- **Cleaner Page Layouts & Unified 3D Controls:**
  - Standardized page headers across every tab so titles and top-right buttons sit at the exact same height.
  - Made top KPI summary tiles more compact on **Invoices**, **Clients**, **Catalog**, **Expenses**, **Outsourcing**, and **Tasks** so your lists and Kanban board stay front and center.
  - Unified all non-primary buttons, dropdown pills, switches, and segmented toggles across the app with matching 3D keycap styling.
  - Replaced separate export controls with a single **Export** pop-up dialog on **Invoices** (CSV or Excel) and a single **Export Report** dialog on **Expenses** (PDF, Print, or CSV).
  - Updated top-bar hover animations with a natural ringing notification bell and magnifying-glass zoom on Search.
- **Performance & Packaging:**
  - Added 16 SQLite indexes, paginated large invoice registers, split large modals, and reduced Electron bundle size and memory usage.
  - Configured cross-platform **macOS Apple Silicon (`.dmg`, build 4)** and **Windows 64-bit (`.exe`)** packaging with bundled offline OCR/ML models and deep ad-hoc macOS signing after Electron fuses.

### Fixed

- Fixed 25+ Windows and macOS QA bugs covering window sizing, date/time pickers, scrollbars, profile avatars, accent consistency, and Analytics Cashflow Forecast table alignment.
- Fixed the macOS Retina Light/Dark circular transition starting near the top notch instead of from the clicked theme button.
- Fixed the Overview widget customizer close animation lag/snap and removed the duplicate `Done` button inside the customizer drawer.
- Fixed dark-mode button underside borders appearing cut off by applying uniform full-perimeter rims and balanced elevation shadows.
- Fixed multi-currency overdue totals, mixed-currency profit calculations, PDF page-break handling across all five templates, local calendar date-boundary sync, and unsolicited macOS Keychain prompts when opening Backup & data.
- Hardened draft privacy (profile-isolated IPC storage), automatic workspace locking on sleep/screen lock, and expanded automated verification to **322 Vitest tests (44 files)** plus packaged Electron E2E coverage.

## v0.2.0 (2026-11-13)

### Workspaces and authentication

- Added multi-profile local workspaces (up to 5 isolated profiles per installation) with onboarding presets for Software Engineering, AI Development, and Consulting.
- Enforced optional 4-digit PIN and alphanumeric password locks inside the Electron main process, with per-profile SQLite databases, receipt vaults, catalogs, and schedules.
- Added 5-column miniature invoice template previews and custom business logo uploads inside Settings.

### Invoicing, PDF templates, and receivables

- Added five offline vector/HTML invoice templates rendered via Electron `printToPDF`: `Geometric Teal`, `Executive Wave`, `Scarlet Modern`, `Apex Orange`, and dark-surface `Noir Crimson`.
- Replaced multi-button template toggles inside `InvoiceDocumentSheet` with a trigger-anchored template selector dropdown and concise WhatsApp/email sharing summaries.
- Built the two-way task-to-invoice flow so unbilled completed tasks import into invoices individually or in batches, linking Kanban cards (`invoiceCode`) with synchronized hover highlights.
- Added the past-due Overdue Summary view with accounts receivable aging buckets (`1-15`, `16-30`, `31-60`, `60+` days), WhatsApp/Email reminders, and RFC 4180 CSV plus Excel workbook (`.xlsx`) exports.

### Tasks, calendar sync, outsourcing, and handoff

- Embedded Kanban (`To Do`, `In Progress`, `Under Review`, `Done`), List, and Calendar views together inside Tasks with scheduled times, event types, month navigation, and drag-and-drop rescheduling.
- Added two-way macOS Calendar (`.ics`) background synchronization for task creates, updates, and deletions without bringing the Apple Calendar app to the foreground.
- Added the Submit Work handoff modal when dragging tasks to `Done`, opening saved client repository or Google Drive URLs.
- Added offline `pdf-lib` subcontractor payable vouchers (`VND-INV-xxxx`), 1-click `wa.me` delegation briefs, and automatic expense ledger entries when contractor payouts settle.

### UI, motion, and macOS packaging

- Redesigned navigation, dashboard widget layout, modals, expense merchant brand SVGs, and circular `startViewTransition` light/dark/accent reveals with safe Promise cancellation handling.
- Standardized UI motion tokens: `150-250ms` dropdown entrances, ~20% shorter exits, non-bouncy `ease-in-out` easing, `0.97` button press scale, `0.95` trigger-anchored popovers, `12%` horizontal stretch on switch knobs, `30ms` row staggers, `40ms` detail settle delays, blurred-scale icon crossfades, confirmation pulses, shared `layoutId` transitions, and drag boundary rubberbanding.
- Fixed macOS `startViewTransition` and first-open popover/modal origin bugs by binding global `pointerdown`/`click`/`keydown` trigger tracking at app boot instead of inside `MotionSurface`, passing explicit trigger refs from theme/accent buttons, suppressing boot-time transitions during initial profile load, extending `triggerOrigin` fallback to `kind="menu"` surfaces, centering un-triggered fallbacks (`50% 50%`), excluding `[data-motion-surface]`/`tabindex="-1"` dialog containers, and adding `initial={false}` guards on `<AnimatePresence>` menus.
- Disabled `-webkit-app-region: drag` across dialogs, backdrops, and motion surfaces so modal headers and buttons stay interactive inside Electron frameless windows.
- Added `dist:mac:arm64`, updated `dist:mac`, and generated clean white Retina installer artwork (`660x440` `@1x` / `1320x880` `@2x`) for the macOS Apple Silicon DMG.
- Overhauled the product `README.md`, expanded system documentation in `AGENTS.md`, and added `CHANGELOG.md`.

### Security, reliability, and performance

- Expanded main-process Zod validation across all 5 invoice templates and IPC vendor/client operations, and guarded malformed JSON invoice snapshots with fallback to live client and profile records.
- Replaced shell-invoked calendar process checks with `execFileSync`, added `lstatSync` symlink rejection and `atomicWrite` across PDF/attachment IPC handlers, and blocked `javascript:`, `vbscript:`, and `data:` URLs in `formatExternalUrl`.
- Cached invoice template logo base64 reads, indexed backup `invoice_items` restores with `Map`, fixed legacy backup imports and PDF page margins, and expanded automated checks to `210` Vitest tests (`27` files) plus `3` packaged Electron end-to-end tests.

## v0.1.2

Bug-fix release covering interactive status-pill payment entry, in-modal receipt attachments, automatic creation-modal draft saving and restore, structured Catalog table filtering, transactional entity deletion integrity, and topmost toast alerts.
