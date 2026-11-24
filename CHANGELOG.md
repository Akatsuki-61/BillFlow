# Changelog

Notable changes between BillFlow desktop releases.

## Unreleased (`Nipun` branch)

### Smart Capture (Two-Tier Local AI & Offline OCR)

- Added the global **Smart Capture** slide-over drawer (`Cmd/Ctrl+Shift+I`, top-bar Sparkles trigger, and Invoices header action) to paste screenshots or message text from WhatsApp, Slack, Signal, or email and auto-fill BillFlow's default **New Invoice** dialog.
- Added client-side screenshot preprocessing (`src/lib/image-preprocess.ts`) that detects dark-mode chat captures, auto-inverts them to dark-on-light text, upscales small screenshots, and enhances contrast before offline OCR.
- Implemented a bundled **Standard** offline AI tier (~25.6 MB total via `scripts/prepare-ai-models.mjs` into `extraResources`): `tesseract.js` LSTM OCR (`eng.traineddata.gz`), quantized `Xenova/all-MiniLM-L6-v2` ONNX embeddings for deliverable/chitchat filtering and semantic Service Catalog price matching, and deterministic extraction of clients, currencies, relative/absolute due dates, delivery URLs, inline quantities/prices, and notes.
- Implemented an optional **Enhanced** local LLM tier (`onnx-community/Qwen2.5-0.5B-Instruct` INT8 ONNX) managed in a new **Settings → AI & Capture** tab with one-click download, live progress bar, cancel, delete, idle RAM disposal, and automatic fallback to Standard.
- Configured cross-platform macOS ARM64 and Windows x64 Electron packaging (`electron-builder.yml` ASAR unpacking for `onnxruntime-node`/`tesseract.js`/`tesseract.js-core` and exclusion of unused `onnxruntime-web`, Linux, non-target architecture, and legacy Tesseract binaries) plus updated runtime third-party notices.

## v0.3.0 (2026-11-20)

### Setup and Settings

- Added an empty profile picker and guided first-run setup with one question at a time, a profile review, and an empty starter catalog.
- Made desktop notifications and Apple Calendar Automation optional during setup. BillFlow saves the profile first and resumes at permissions after reopening.
- Consolidated profile identity, avatar, accent, currency, and invoice prefix in Business profile. Improved spacing in Workspace interface and standardized the Local activity history disclosure.
- Added a full application reset that clears local profiles, records, managed files, and preferences before restarting at setup. Backup & data also retains a separate reset for the active profile.
- Removed the automatic Keychain check when opening Backup & data. Packaged macOS tests now use a mock Keychain and keep native notifications quiet.
- Simplified the macOS installer with larger native Finder icons and a clear drag-to-Applications layout.
- Set the second macOS package to build 2 and display its build number in About BillFlow.

### Billing and workspace operations

- Added profile-currency reporting with cached exchange rates and original amounts preserved on financial records.
- Added recurring retainers, proposals with one-click invoice conversion, a financial digest, and cash and accrual project-margin views.
- Added encrypted rolling backups, restore preflight and recovery checkpoints, startup SQLite integrity checks, and a retryable PDF export history.
- Improved offline PDF output, profile privacy, task-first outsourcing, window-state persistence, and dashboard performance.

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
