<div align="center">
  <img src="build/icon.png" alt="BillFlow" width="88" />
  <h1>BillFlow</h1>
  <p>Local-first desktop workspace for client billing, task execution, subcontractor payouts, and profit tracking.</p>
  <p>
    <a href="package.json"><img src="https://img.shields.io/badge/Version-0.3.1-111827.svg" alt="Version 0.3.1" /></a>
    <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-44.11-47848F.svg" alt="Electron 44.11" /></a>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16.4-000000.svg" alt="Next.js 16.4" /></a>
    <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-WAL-003B57.svg" alt="SQLite WAL" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6.svg" alt="TypeScript 5" /></a>
  </p>
</div>

Independent software developers and technical consultants often manage client agreements in docs, tasks on a Kanban board, payments in spreadsheets, and contractor briefs in chat. BillFlow keeps clients, itemized invoices, deliverables, vendor payouts, receipts, and per-currency cashflow inside one desktop application on macOS and Windows.

All records, payment receipts, and backups live on disk in a local SQLite database without cloud accounts, telemetry, or remote servers.

## How the billing and delivery loop works

```mermaid
flowchart LR
  Client["Client & Service Catalog"] --> Invoice["Itemized Invoice & Offline PDF"]
  Invoice -->|"Deposit recorded"| Tasks["Linked Kanban, List & Calendar"]
  Tasks -->|"Completed unbilled work"| Invoice
  Tasks -->|"Subcontractor delegation"| Vendor["Payable Voucher (VND-INV) & Payout"]
  Tasks --> Handoff["Deliverable Handoff & Balance Collection"]
  Vendor --> Ledger["Per-Currency Profit Ledger"]
  Handoff --> Ledger
```

Recording a client deposit (`ADVANCE_PAID`) opens a 5-second prompt to turn invoice line items into Kanban cards without retyping scope. Unbilled tasks marked `Done` also import directly into a new invoice individually or in batches, and sibling cards from the same invoice highlight together on hover.

## Product capabilities

### Client directory and reusable service catalog

Save permanent clients with default currencies (`USD`, `LKR`, `EUR`, `GBP`, `CAD`), contact details, and delivery destinations such as Google Drive folders or code repositories. For one-off work, enter temporary client details straight into the invoice editor without polluting the directory. Maintain fixed-fee or hourly rate cards in the service catalog and import or export rows via CSV or Excel workbooks.

### Itemized invoicing, proposals, recurring retainers, and offline PDF templates

Build multi-currency invoices, **Proposals & Quotes** (`QT-YYYY-NNN` with 1-click conversion to invoices), and scheduled **Recurring Retainers** using catalog items, custom discounts, taxes, and upfront deposit rules. Generate and save PDF files locally via Electron `printToPDF` and `pdf-lib` with bundled typography and an optional uploaded business logo. Five selectable invoice layouts are included offline:

- `Geometric Teal`: teal and slate angled header on a white sheet
- `Executive Wave`: charcoal curved ribbon header with amber summary styling
- `Scarlet Modern`: split red header and dotted item rows
- `Apex Orange`: orange diagonal header and bordered table grid
- `Noir Crimson`: dark invoice sheet with crimson capsule rows

Dispatch invoices or overdue reminders through prefilled `wa.me` WhatsApp links or email drafts, inspect past-due accounts receivable aging (`1-15`, `16-30`, `31-60`, `60+` days), and export active registers or aging reports to RFC 4180 CSV or Excel formats from a unified **Export** dialog.

### Smart Capture & Local AI Suite (on-device AI and offline OCR)

BillFlow ships a unified on-device AI suite built on one shared local runtime so client messages, bank transfer slips, and expense receipts never leave your computer:

- **Intent-Aware Smart Capture (`Cmd/Ctrl+Shift+I`):** Paste a screenshot (`Cmd/Ctrl+V` or drag-and-drop) or copied text from WhatsApp, Slack, Signal, or email. Dark-mode chat screenshots are automatically inverted and upscaled before OCR. Zero-shot neural intent detection classifies whether the message is best routed to **New Invoice**, **Proposal / Quote**, or directly to **Kanban Tasks** (with 1-click override), pre-filling clients, deliverables, relative or absolute due dates (`"next week"`, `"next month"`, etc.), currencies, delivery URLs, and semantically matched **Service Catalog** names and unit prices—with inline Client, Service Catalog, and Due Date pickers plus an inline AI engine switcher right inside the drawer.
- **Bank Transfer Slip Auto-Reader (Record Payment):** Dropping, selecting, or pasting a client's bank transfer slip screenshot automatically extracts the transferred amount, payment date, bank name, and reference/transaction ID, and flags underpayment, overpayment, or currency mismatches against the invoice's expected advance or remaining balance.
- **Expense Receipt Scanner (Expenses):** Dropping, selecting, or pasting a receipt screenshot (or clicking **Scan Receipt**) extracts the merchant, date, amount, currency, and description while classifying the expense into BillFlow's OPEX categories (`SOFTWARE`, `AI INFRASTRUCTURE`, `HOSTING`, `TRAVEL`, `MEALS`, `OFFICE`, `HARDWARE`) using bundled `all-MiniLM-L6-v2` neural embeddings.
- **Configurable Local AI Engines in Settings → AI & Capture (and the Smart Capture footer):**
  - **Standard (Built-in Offline Default, ~25.6 MB bundled):** `tesseract.js` LSTM OCR (`eng.traineddata.gz`) + quantized `Xenova/all-MiniLM-L6-v2` sentence embeddings + deterministic document/entity parsers.
  - **Enhanced Offline AI Pack (~270 MB on-demand):** Downloads quantized `Xenova/bge-base-en-v1.5` (semantic matching) + `Xenova/nli-deberta-v3-small` (zero-shot intent/deliverable classification) once into `userData/models/` with live progress, cancel, delete, automatic idle RAM disposal, and safe ONNX memory options (`enableCpuMemArena: false`).
  - **Local Ollama (Optional, `127.0.0.1` only):** Connects exclusively to a loopback Ollama daemon if you prefer to run your own local model for structured extraction, with automatic fallback to offline tiers.

### Task board, local calendar, and deliverable handoff

Switch between Kanban (`To Do`, `In Progress`, `Under Review`, `Done`), List, and Calendar views. Invoice-linked Kanban cards share a soft top hue wash that deepens across sibling tiles on hover, paired with 3D keycap category tags and compact 3-color priority flag badges (**Red** High/Urgent, **Blue** Medium, **Green** Low). Active work time accumulates in the background on cards, and Calendar view supports drag-and-drop rescheduling alongside two-way local macOS Calendar `.ics` synchronization on desktop. Dragging a deliverable card to `Done` opens the Submit Work modal with direct links to that client's repository, staging URL, or Drive folder.

### Subcontractor outsourcing and automated payout ledger

Delegate any Kanban card to an external vendor with prefilled scope, client references, delivery URLs, payout fees, and deadlines. Export payable work orders (`VND-INV-xxxx`) offline via `pdf-lib` and send formatted briefs over WhatsApp. Deliverable approval and vendor settlement remain separate states; marking a voucher `Paid` records an operational payout entry in the expense ledger automatically.

### Operational expenses, receipt vault, and project profit

Log business expenses with custom merchant icons, linked invoices, recurring flags, and SHA-256 content-addressed receipt attachments (`PNG`, `JPG`, `PDF`) opened through the OS viewer, or export formatted **PDF**, **Print**, and **CSV** reports from a single **Export Report** dialog. Financial summaries, **Project Margin (P&L)** drawers, and Apache ECharts visualizations report totals in your chosen profile reporting currency (using cached daily exchange rates while preserving original amounts) and calculate true net profit (`gross invoiced revenue - operational expenses - settled vendor payouts`).

### Multi-profile workspaces, themes, and encrypted backups

Start with one profile through guided first-run setup and choose whether to enable desktop notifications and Apple Calendar sync. Create up to 5 isolated local workspaces, switch seamlessly between **Light Mode** and **Dark Mode** with customizable **Profile Accent Presets** and selectable **Inter** or **Elegant Sans** typography, and protect each profile with an optional PIN or password enforced in Electron's main process.

Export or restore standard JSON or password-protected AES-256-GCM **encrypted rolling backups** (`.bfbackup`), including tasks, schedules, and managed receipts, with startup SQLite integrity verification (`PRAGMA quick_check`). **Settings → Backup & data** supports clearing the active profile's records or clearing the full application and returning to first-run setup. Check for new GitHub Releases directly from the version button in the bottom-left of **Settings** or from the macOS menu bar (**BillFlow → Check for Updates...**), with built-in release notes, download progress, and installer launch.

## System architecture

| Layer | Stack | Role |
| :--- | :--- | :--- |
| Desktop shell | Electron 44 | Context-isolated `window.billflow` preload bridge, persistent window bounds, Tray/Dock quick actions, native drag-and-drop, in-app GitHub Releases updater |
| Interface | Next.js 16 (App Router), React 19 | Static bundle (`output: 'export'`) loaded from loopback static protocol in packaged builds |
| Styling and motion | Tailwind CSS v4, Motion | Light/Dark surface tokens, Profile Accent presets, unified 3D keycap controls, vertical notification toast stack, Inter & Elegant Sans typography, reduced-motion support |
| Database and validation | SQLite (`better-sqlite3`), Drizzle ORM, Zod | WAL journal mode, foreign-key cascades, versioned schema migrations, schema-checked IPC payloads |
| Documents and analytics | `pdf-lib`, Electron `printToPDF`, Apache ECharts 6 | Local PDF invoices and contractor vouchers, multi-currency financial and turnaround charts |
| Local AI and OCR | `tesseract.js`, `@huggingface/transformers`, `onnxruntime-node` | Offline LSTM screenshot OCR, bundled `all-MiniLM-L6-v2` semantic catalog matching, optional Enhanced Offline AI Pack (`bge-base-en-v1.5` + `nli-deberta-v3-small`) and optional loopback Ollama (`127.0.0.1`) |
| Testing | Vitest, Playwright | Database integrity, security, offline PDF generation, updater, local OCR/AI pipeline, and packaged Electron end-to-end tests |

## Running from source

### Prerequisites

- Node.js `v22` LTS (`.nvmrc` specifies `22`; `package.json` supports `>=22 <27`)
- npm `v10` or newer
- macOS (Apple Silicon or Intel) or Windows 10/11

### Setup and launch

```bash
git clone https://github.com/Akatsuki-61/BillFlow.git
cd BillFlow
npm install
```

`npm install` runs `electron-builder install-app-deps` automatically to align native `better-sqlite3` bindings with Electron 44.

Launch the desktop app in development mode (Next.js dev server bound to `127.0.0.1` plus Electron shell with live watch; automatically fetches the ~25.6 MB bundled Standard OCR + MiniLM models into `assets/ai-models/` on first run):

```bash
npm run dev:electron
```

You can also pre-fetch the bundled Standard AI models independently at any time with `npm run ai:prepare-models`.

Build the static renderer and main-process bundle, then start the packaged local desktop entrypoint without a Next.js server:

```bash
npm run build
npm start
```

If you only want the browser preview using the in-memory fallback provider at `http://127.0.0.1:3000`:

```bash
npm run dev
```

## Verification and packaging

Use these commands to check types, lint, and run the Vitest suite.

```bash
npx tsc --noEmit
npm run lint
npm test
```

Run `npm run pack:mac` to build an ad-hoc signed Apple Silicon preview at `release/preview-<version>/mac-arm64/BillFlow.app`.

The Playwright workflow builds the test app at `release/test-<version>/mac-arm64/BillFlow.app` before running the suite.

```bash
npm run pack:mac:test
npm run test:desktop
```

Create distributable installers into `release/`:

```bash
npm run dist:mac:arm64   # macOS Apple Silicon (.dmg)
npm run dist:mac         # macOS arm64 + x64 (.dmg)
npm run dist:win         # Windows x64 NSIS setup (.exe)
```

## Local data storage

| Environment | Database location |
| :--- | :--- |
| macOS packaged app | `~/Library/Application Support/BillFlow/billflow.db` |
| Windows packaged app | `%APPDATA%\BillFlow\billflow.db` |
| Development (`npm run dev:electron`) | `./.billflow-dev/billflow.db` |

Additional local files stay in the same `userData` directory: SHA-256 receipt attachments under `attachments/`, isolated secondary workspaces under `profiles/<profile-id>/`, theme state in `appearance.json`, local AI tier preference in `ai-config.json`, optional Enhanced Offline AI Pack weights under `models/` (shared across profiles and excluded from profile backups), and automatic `billflow.db.before-upgrade-*.bak` recovery copies created ahead of pending Drizzle migrations. Generated PDFs export to the folder configured in Settings (defaulting to Downloads).

## Project background and credits

BillFlow was originally developed for **EER4189 Software Design in Group** (Group 61) at The Open University of Sri Lanka and is maintained by team Akatsuki-61. See [CONTRIBUTIONS.md](CONTRIBUTIONS.md) for the full module breakdown and development history.

| Contributor | GitHub | Area |
| :--- | :--- | :--- |
| Nipun Yatawara | [@nipunyatawara-dev](https://github.com/nipunyatawara-dev) | Architecture, Electron shell, SQLite/Drizzle schema, multi-profile workspaces, task-to-invoice flow, local AI/OCR Smart Capture, in-app GitHub Releases updater, motion tokens |
| GVSL-Lahiru | [@GVSL-Lahiru](https://github.com/GVSL-Lahiru) | Lead QA, deliverable handoff workflow, overdue aging summaries, CSV exports, navigation polish |
| Binuka Reshan | [@Binukareshane](https://github.com/Binukareshane) | Subcontractor outsourcing engine, payable vouchers (`VND-INV-xxxx`), WhatsApp dispatch, ledger expense posting, Excel exports |
| Sandika | [@Sandika-2003](https://github.com/Sandika-2003) | Service catalog, bulk CSV/Excel imports, UI integration, invoice sheet preview, macOS Calendar `.ics` sync |
