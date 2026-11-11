<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BillFlow — Full System Specification & Agent Operational Guide

## 1. Purpose and System Scope

BillFlow is a local-first desktop workspace designed for software freelancers and consultants (built for client **Chethaka**). It unifies the entire client engagement cycle into a cohesive operational pipeline:
- **Service Catalog & Rate Cards**: Reusable service offerings (fixed-fee and hourly rates).
- **Client Directory**: Contact metadata, WhatsApp numbers, currency preferences, and delivery repository/folder links.
- **Itemized Invoicing & PDF Compilation**: Multi-currency invoices (USD, LKR, EUR), upfront deposit math, discount/tax calculations, and local vector PDF generation via `pdf-lib`.
- **Multi-Channel Dispatch**: 1-click WhatsApp URI links (`https://wa.me/`) with pre-filled payment summaries and native email dispatch.
- **Task Management & Synchronized Kanban**: 4-stage visual execution board (`To Do`, `In Progress`, `Under Review`, `Done`) with two-way task-to-invoice conversion and synchronized hover highlighting for cards sharing an invoice.
- **Task Outsourcing & Vendor Ledger**: 1-click task delegation, payable invoice vouchers (`VND-INV-xxxx`), WhatsApp contractor dispatch, and automated ledger expense logging on payout settlement.
- **Deliverable Submission Workflow**: Automatic Google Drive and repository handoff prompts upon moving cards to `Done`, with client delivery status tracking.
- **Operational Expense (OPEX) Tracker**: Expense logging with category presets (Software, AI APIs, Hosting, Hardware) and receipt attachment persistence.
- **Financial Analytics & True Net Profit Engine**: Automated financial aggregation and real-time Net Profit math:
  $$\text{Net Profit} = \text{Gross Invoiced Revenue} - (\text{OPEX} + \text{Outsourced Vendor Payouts})$$
- **Multi-Profile Workspaces & Security**: Up to 5 isolated local user profiles with role-based starter catalogs (Software Engineering, AI Development, Consulting), optional PIN/password protection, and active workspace switching.
- **Local Calendar Integration**: Two-way synchronization with local macOS Calendar (`.ics`), event management, and milestone deadline tracking.

---

## 2. Core Workflows & Direct-Work Loops

BillFlow is built around interconnected workflows rather than isolated screens. Every agent and contributor must preserve these direct-work connections:

### Workflow A: The Primary Direct-Work Loop
1. **Identify Client**: Select an existing client from the directory or create a temporary/permanent client in the invoice dialog.
2. **Itemize Invoice**: Add service line items manually or pull rate cards directly from the Catalog. Specify payment terms (default Net 7 Days) and require an upfront deposit (e.g., 50%).
3. **Compile & Export PDF**: Save the invoice record and compile a vector PDF using `pdf-lib` without external server requests. Store the PDF in the user-configured export directory.
4. **Dispatch via WhatsApp / Email**: Use 1-click shortcuts to open a pre-filled WhatsApp message or email draft with invoice totals, due dates, bank instructions, and advance requirements.
5. **Record Advance Payment**: Record receipt of the advance payment and attach the client's transfer receipt. The invoice moves to `ADVANCE_PAID`.
6. **Task Tracking Prompt**: Upon recording the advance payment, an automatic prompt (`AdvanceTrackingPrompt`) offers to convert invoice deliverables into Kanban tasks (5-second countdown with Yes/No actions).
7. **Execute or Outsource**: Move tasks through `In Progress` and `Under Review`, or delegate deliverables to external contractors via Workflow C.
8. **Submit Finished Work**: Dragging a deliverable to `Done` triggers the Submit Work modal (`SubmitWorkModal.tsx`), opening the client's Google Drive or repository and updating the delivery status.
9. **Collect Remaining Balance & Check Profit**: Record the final settlement payment (invoice moves to `PAID`). The true net profit appears in the financial dashboard.

### Workflow B: Task-First & Batch Invoicing Loop
1. **Direct Task Execution**: A freelancer creates deliverables directly on the Kanban board or Calendar.
2. **Deliverable Completion**: Tasks are completed and moved to `Done`.
3. **Batch / Single Task Invoicing**:
   - In `InvoicesView.tsx`, click **"Import Completed Tasks"** to review unbilled completed tasks filtered by client, configure unit rates, and populate invoice line items with one click.
   - On the Kanban board (`TasksView.tsx`), select completed cards in the "Done" column and trigger **"Batch Invoice Completed"** to jump into invoicing.
4. **Task Linking**: Saving the invoice updates all imported tasks with `invoiceId` and `invoiceCode`, linking the deliverables permanently.
5. **Synchronized Card Highlighting**: Cards linked to an invoice show a subtle invoice reference indicator. Hovering over any card illuminates all other cards sharing that same invoice with a synchronized glow ring.

### Workflow C: Subcontractor Outsourcing Loop
1. **Outsource Trigger**: Click **Outsource Task** on any Kanban card to open the delegation modal with scope, client, and deliverable specifications pre-filled.
2. **Work Order & Payable Voucher**: Select a contractor, set the agreed payout fee and target deadline, and generate a dedicated payable voucher (`VND-INV-xxxx`).
3. **1-Click Contractor WhatsApp Dispatch**: Generate a structured delegation brief and open WhatsApp (`https://wa.me/<vendor_phone>`) with one click.
4. **Deliverable Review & Settlement**: When the contractor delivers the work, review the files, mark the outsourcing status `Done`, and mark the payout `Paid`.
5. **Automated Ledger Posting**: Marking an outsourcing voucher `Paid` automatically records a `Vendor Payout Expense` entry in the financial ledger, deducting the fee from the net profit calculation.

### Workflow D: Multi-Profile Workspace System
1. **Role Onboarding**: First launch presents a setup wizard configuring the studio name, default currency, and starter profiles for Software Engineering, AI Development, and Consulting.
2. **Profile Isolation**: Up to 5 profiles exist in the local SQLite database. Each profile maintains its own role catalog, accent colors, theme preference, and default currency.
3. **PIN & Password Protection**: Profiles can be protected with a local PIN or alphanumeric password with recovery hints.

---

## 3. System Architecture & Technical Stack

```
┌─────────────────────────────────────────────────────────────┐
│                 Electron Desktop Runtime                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │     Renderer Process (Next.js 16 + React 19 + TS)     │  │
│  │                                                       │  │
│  │  • App Router Views: /invoices, /tasks, /clients,     │  │
│  │    /catalog, /outsourcing, /expenses, /settings       │  │
│  │  • State Management: DataProvider.tsx, ProfileContext │  │
│  │  • UI System: Tailwind CSS v4, Motion (spring physics)│  │
│  │  • Data Visualization: Apache ECharts & Recharts      │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ IPC Bridge                   │
│                              │ (window.billflow via preload)│
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │         Main Process (Node.js + Electron Core)         │  │
│  │                                                       │  │
│  │  • IPC Controllers: invoices, tasks, clients,         │  │
│  │    expenses, vendors, profiles, backup, calendar      │  │
│  │  • Persistence: SQLite 3 via better-sqlite3 + Drizzle │  │
│  │  • PDF Engine: pdf-lib (vector PDF generation)        │  │
│  │  • File Storage: userData/receipts and backups        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- **Runtime**: Node.js LTS (v20/v22), Electron 44, Next.js 16 (App Router), React 19, TypeScript 5.
- **Embedded Database**: Local SQLite 3 (`billflow.db`) inside Electron `app.getPath("userData")`. Managed with Drizzle ORM schemas (`electron/db/schema.ts`) and versioned migrations in `drizzle/`.
- **IPC Interface**: Typed bridge exposed via `electron/preload.ts` and declared in `src/types/billflow-api.d.ts`. All handlers validate payloads using Zod schemas (`electron/validation.ts`, `electron/workflow-validation.ts`).
- **Data Integrity**: Financial figures are stored as integer minor units (cents) with an explicit currency token. Foreign keys maintain referential integrity with cascade rules.

---

## 4. Academic Milestones & Delivery Schedule

* **Final Project Deadline:** December 1, 2026
* **Evaluation Standard:** IEEE Std 830-1998 SRS & CMMI-DEV Level 2/3 peer review standards.

| Milestone | Target Date | Scope & Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Milestone 1** | Oct 02, 2026 | Client requirements gathering, problem analysis, and 9-page UI scaffolding. | Completed |
| **Milestone 2** | Oct 07, 2026 | Electron desktop shell, SQLite database, Drizzle migrations, and Progress Review. | Completed |
| **Milestone 3** | Oct 08, 2026 | Direct-work loop, itemized invoices, vector PDF generator, and production release v0.1.2. | Completed |
| **Milestone 4** | Nov 02, 2026 | Full UI overhaul, top navigation bar, macOS Calendar sync, and multi-profile workspaces. | Completed |
| **Milestone 5** | Nov 10, 2026 | Task-to-invoice conversion, batch invoicing, and synchronized Kanban hover highlights. | Completed |
| **Milestone 6** | Nov 18, 2026 | Invoice PDF templates, custom business logo uploader, and profile settings polish. | In Progress |
| **Milestone 7** | Nov 22, 2026 | Automated Playwright end-to-end test suite covering the full user lifecycle. | Scheduled |
| **Milestone 8** | Nov 26, 2026 | Final Project Report, DSRS updates, Requirements Traceability Matrix (RTM), and appendices. | Scheduled |
| **Milestone 9** | Nov 30, 2026 | Production Windows (`.exe`) and Mac (`.dmg`) installers, client sign-off, and viva demo. | Scheduled |

---

## 5. Development Guidelines for Contributors & AI Agents

1. **Local-First & Privacy Invariant:**
   - All client contact details, financial records, and deliverables must remain strictly on the user's local disk.
   - Zero external tracking or cloud telemetry. The application binds exclusively to `127.0.0.1`.
2. **Preserve Connected Data Loops:**
   - Never implement a screen in isolation. Verify how changes affect preceding and succeeding stages in the direct-work loop.
   - When updating invoices, preserve recorded payments and client snapshots.
   - When updating tasks, maintain foreign keys to parent invoices and work orders.
3. **Atomic Writes & Safe Persistence:**
   - Use database transactions for multi-entity operations (e.g. creating an invoice from multiple tasks or settling a vendor payout with an expense entry).
   - Use temporary staging files and atomic renames for file exports and backups.
4. **UI Standards & Accessibility:**
   - Adhere to the design system in `src/app/theme.css` and `src/app/globals.css`.
   - Maintain full light and dark mode compatibility with WCAG AA contrast ratios (4.5:1 text, 3:1 controls).
   - Use spring physics for microinteractions (`src/lib/motion.ts`) and respect `prefers-reduced-motion`.
5. **Verification Before Committing:**
   - Always run `npm test` before pushing changes. All test suites must pass 100%.
   - Run `npx tsc --noEmit` and resolve all TypeScript compiler diagnostics.
   - Use conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `merge:`).
