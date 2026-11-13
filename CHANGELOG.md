# Changelog

Notable changes between BillFlow desktop releases.

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
