# Changelog

Notable changes between BillFlow desktop releases.

## v0.3.1 (2026-11-28)

Bug-fix and stability release fixing macOS local AI crashes, upgrading the offline AI engine with optional loopback Ollama, adding an in-app GitHub Releases updater, reworking Smart Capture results and inline pickers, stacking concurrent notification toasts vertically, polishing the Tasks board cards, smoothing page-to-page navigation, and adding staggered list animations on Outsourcing.

### What's New

- **In-App GitHub Releases Updater:**
  - Added a clickable version badge in the bottom-left corner of **Settings** and a native **BillFlow → Check for Updates...** entry in the macOS menu bar.
  - Built a dedicated update dialog (`UpdateDialog.tsx`) showing version status ("Your application is up to date" or available release notes), live download progress, and 1-click installer download and launch from GitHub Releases (`electron/updater.ts`, `UpdateContext.tsx`).
- **Upgraded Local AI Engine & Optional Loopback Ollama:**
  - Replaced the heavy `Qwen2.5-0.5B-Instruct` LLM with the fast, memory-safe **Enhanced Offline AI Pack** (`Xenova/bge-base-en-v1.5` + `Xenova/nli-deberta-v3-small`, ~270 MB) running in ~140ms with zero crashes on macOS Electron 44.
  - Added optional **Local Ollama** (`127.0.0.1` loopback only) support in **Settings → AI & Capture** and an inline AI engine switcher right in the **Smart Capture** drawer footer.

### Changed & Improved

- **Smart Capture Results & Workflow Rework:**
  - Reworked the entire extracted-results panel under **Destination** with BillFlow's 3D segmented controls, unclipped currency/price fields, and clean copy without em dashes.
  - Added an editable **Client** field (`"Add or select a client"`) with an inline Saved Clients picker, an editable **Due** date picker with automatic `"next week"` and `"next month"` phrase parsing, and per-deliverable **Service Catalog** pickers (`"Matched from catalog"` / `"From catalog"`).
  - Removed deliverable checkboxes and applied matched catalog item titles automatically instead of keeping raw extracted phrases.
- **Unified Vertical Notification Toast Stack:**
  - Upgraded the global toast system (`ToastContext.tsx`, `ToastBanner.tsx`) and migrated view-local fixed toast popups across Clients, Settings, Invoices, Outsourcing, Tasks, and Currency Feedback so simultaneous notifications stack vertically (newest on top, oldest on bottom) with independent auto-dismiss timers instead of overlapping.
- **Tasks Page Card Polish:**
  - Replaced the left vertical bar on invoice-linked Kanban cards with a subtle top hue tint wash that smoothly deepens across all tiles sharing the same invoice on hover.
  - Reworked task category tags into tactile 3D keycap badges matching BillFlow's button/toggle aesthetic across Kanban cards, List view, and the Task Detail modal.
  - Replaced text priority badges on Kanban cards with matching-height (`24px`) 3D **Flag** icon badges using a clear 3-color priority system (**Red** High/Urgent, **Blue** Medium, **Green** Low).
- **Smoother Page Transitions & Outsourcing List Animations:**
  - Eliminated the brief blank/dark background flash when switching routes by replacing `.motion-page`'s `opacity: 0` fade-in with a subtle `0.94 → 1` settle, serving proper `text/x-component` static RSC payloads (`index.txt`) for `?_rsc=` / `RSC: 1` requests in Electron's `app://` protocol handler, caching immutable `/_next/static/` bundles, and replacing jarring `<Suspense>` fallbacks on Catalog and Outsourcing.
  - Added one-by-one staggered row entrance animations (`listRowTransition`) to Outsourcing **Work Orders** and **Vendors** lists to match Expenses and Invoices while honoring `prefers-reduced-motion`.

### Fixed

- Fixed a fatal macOS Electron 44 `EXC_BREAKPOINT (SIGTRAP)` crash during ONNX Runtime `BFCArena::Extend` allocation by applying `SAFE_ONNX_SESSION_OPTIONS` (`enableCpuMemArena: false`, `enableMemPattern: false`) across local AI sessions.
- Fixed an infinite React effect and Electron IPC loop in `UpdateProvider` (`UpdateContext.tsx`) that caused excessive idle CPU usage and continuous root re-renders.
- Fixed Standard AI semantic catalog matching so close service descriptions resolve to the matching catalog item name and default rate.
- Expanded automated verification to **332 Vitest tests across 45 test files** (adding `electron/test/updater.test.ts` and expanded AI entity-parser, AI IPC, and menu tests).

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
