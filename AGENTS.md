<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BillFlow product workflow and demo priorities

## Purpose and scope

BillFlow is currently being developed for **Chethaka**, who does software freelancing: web development, custom software development, and AI consulting. It helps him manage a client job from the initial request through billing, payment, development, delivery, and profit tracking. The reference example is a client requesting **a business website and an AI consulting session to plan customer-support automation**. Examples throughout this document should reflect this software freelancing context.

The progress presentation is on **October 10, 2026**. The priority is one working, connected workflow that the team can demonstrate from start to finish. Build changes around this workflow instead of treating Invoices, Clients, Tasks, Outsourcing, Catalog, and Expenses as unrelated screens.

**This section describes the intended product behavior, not a claim that every feature is already implemented.** Check the current UI, types, database, and IPC handlers before assuming a capability exists. For example, the current invoice status type does not yet include an advance-paid state. Extend the underlying data and behavior when implementing that requirement; changing only a label is insufficient.

## The main loop in plain language

**Client request → invoice and PDF → advance payment → task tracking → do or outsource the work → deliver the finished work → collect the remaining payment → see the financial result.**

The client communicates with Chethaka outside BillFlow, such as through WhatsApp or email. BillFlow records and connects the work; he sends invoices and shares software deliverables or consulting documents using his usual tools.

### 1. Identify the client

The freelancer can start in either **Clients** or **Invoices**:

- In Clients, create a permanent client profile and then create an invoice for that client.
- In the invoice creation dialog, select an existing client or enter a new client's details directly.
- A new client entered during invoicing can remain temporary for that invoice. The freelancer can also choose to save those details as a permanent client, which then appears in Clients and can be selected for future invoices.

A temporary client must not require a permanent client profile just to issue an invoice. The invoice still needs to retain its client details. Saving that client permanently should connect the records without creating another invoice or losing the original details.

Client information includes the relevant name, contact details, and an optional delivery location, such as a source-code repository, website/staging URL, or Google Drive folder for software builds and documentation. The delivery link can be entered on the client profile or during invoice creation. An invoice can use the client's default link or a job-specific link.

### 2. Build the invoice from the requested work

In the same creation dialog, add the work as separate invoice line items. In the reference example, these are:

1. Business website development.
2. AI consulting session and customer-support automation recommendations.

Each item has an editable description, quantity, and price. The freelancer can add a discount, such as a first-time-client discount, and see the resulting total clearly.

Catalog provides reusable services and their default prices, such as **Business website development**, **Custom software development**, or **AI consulting session**. Selecting **Business website development** from Catalog should fill the invoice item and price automatically. The freelancer can customize its name or price for this job without changing the original catalog entry.

The dialog also includes an advance/deposit requirement. For the demo, the freelancer requests **50% of the final invoice total** before starting work. Show the invoice total, advance due, and remaining balance separately. Requesting an advance does not mean the advance has been received.

### 3. Save the invoice and export a real PDF

Creating the invoice must save its details and generate an actual PDF invoice. The PDF includes:

- The freelancer's business/profile details and the client's details.
- Invoice number, dates, currency, and itemized services/prices.
- Discount and applicable tax, if used, with a clear final total.
- The required advance, payments already recorded, and remaining amount due.
- Payment instructions, including the bank or other payment details entered in Settings.
- Relevant job notes and the delivery folder link, when provided.

Automatically export the PDF to a folder the freelancer can configure in **Settings**. The Downloads folder is a reasonable default. Make the saved file easy to find and allow exporting it again. If PDF export fails after the invoice is saved, show the failure and allow retrying without creating a duplicate invoice.

One usable invoice template is sufficient for the October 10 demo. Additional templates are a later extension.

The freelancer sends the PDF to the client outside the app. The client approves the price and pays the agreed advance.

### 4. Record the advance and its receipt

After receiving the money, the freelancer opens the invoice and records the advance payment. They can attach the receipt or payment confirmation the client sent, such as an image or PDF, to that invoice/payment record.

The app must support an **Advance paid** state and show the actual amount received and remaining balance. A status change must stay consistent with the recorded payment amount; it cannot simply relabel an unpaid invoice. Partial payment below the required advance must not incorrectly show that the required advance has been paid. Payment attachments must remain available after restarting the app.

This is a manual bookkeeping workflow. Automatic WhatsApp ingestion, bank verification, and payment-provider integrations are not required for this demo.

### 5. Offer task tracking automatically

When the invoice first reaches the **Advance paid** state, show a prompt such as **“Do you want to track this work?”** with Yes and No choices.

- **Yes:** Create the linked tasks and open the task board.
- **No:** Keep the payment recorded, but do not create tasks or navigate away.
- **No response:** Show a visible **five-second countdown**, then take the Yes action automatically. Five seconds is the initial implementation choice within the requested three-to-five-second range.

Cancel the countdown when the freelancer makes a choice. Do not trigger it merely because an invoice was created or an advance was requested. Reopening an invoice, retrying an action, or editing an already recorded payment must not create duplicate tasks.

Treat each service deliverable as a linked task: the example invoice creates **two tasks**, one for website development and one for the AI consulting session and its recommendations. Both belong to the same invoice and client. This lets the freelancer complete or outsource the two deliverables independently.

Use the existing **Tasks** page at `/tasks`; `/todo` currently redirects there. Newly created tasks start in **To do / Not started** (`todo`). Do not create a second task board just because this workflow also calls it the to-do page.

### 6. Track development and consulting work without cluttering the board

The freelancer moves each task through the Kanban board. Existing task states are `todo`, `in-progress`, `review`, and `done`; use them consistently. Work awaiting client review can use Review, and completed work can move to Done.

Record task creation, start, status changes, and completion timestamps in the background. The freelancer can open a task to see its linked invoice/client, scope, delivery link, progress, and timing details. Keep the main tile focused on the work instead of displaying every timestamp or statistic.

Distinguish total elapsed time from time spent in the In progress state. Time waiting in To do or Review should not be presented as active working time. These background measurements describe the recorded workflow, not a guarantee of exact hands-on labor hours.

### 7. Deliver the work through the client's chosen location

Chethaka shares the completed website or software through the agreed delivery link and provides the AI consulting recommendations as a document. Depending on the job, delivery can mean sharing a website/staging URL, a source-code repository, or software builds and documentation in the client's Google Drive folder. He sends the relevant links to the client using his usual communication channel.

Make that location accessible from the client, invoice, and linked task so the freelancer does not have to re-enter or search for it repeatedly. Store job-specific delivery information with the job rather than overwriting every future job's default client link.

Automatic deployments, repository integrations, and Google Drive uploads are not required for the first loop. Saving and opening the delivery links is sufficient.

### 8. Optionally outsource a task from its tile

A Kanban task offers an **Outsource task** action. It opens **Outsourcing** with a creation dialog already filled with the task, its scope, the client, and the source invoice.

The freelancer can select an existing subcontractor or create a new subcontractor/vendor during this flow, similar to selecting or creating a client during invoicing. For example, Chethaka can outsource website development to another developer while doing the AI consulting himself. The subcontractor is the person doing the outsourced work, not the customer who owes Chethaka money.

Create an outsourcing work order/payable invoice with the agreed scope, vendor, delivery date, currency, and contractor fee. The freelancer keeps the difference between the client's charge and the contractor's fee, subject to other expenses. Keep the outsourcing record linked to the original task and client invoice.

When the contractor returns the website code or software build, Chethaka reviews it, updates the linked task's progress, and shares the approved output through the client's agreed delivery location. Record contractor completion and payout separately: receiving completed work does not automatically mean the contractor has been paid. Outsourcing is a cost/payable, not additional client revenue.

### 9. Finish the job and settle the balance

After delivering the work and getting the client's approval, the freelancer records the remaining payment and can attach its receipt. The invoice becomes fully paid only when recorded payments cover the amount due.

Completing a task must not automatically mark the client invoice paid. Likewise, receiving an advance must not mark the work completed. Development/delivery progress and payment progress are separate, connected facts.

### 10. Include expenses in the financial picture

Expenses remains a general expense tracker. The freelancer can record business expenses throughout the month, with their amounts and dates, and attach supporting records where supported.

Client revenue, contractor costs, and other expenses feed the financial views. Show billed amounts, actual collections, outstanding balances, costs, and profit consistently. Do not count the advance and remaining payment as additional revenue on top of the invoice, or subtract the same contractor payout twice through Outsourcing and Expenses. Keep different currencies separate unless an explicit conversion is available.

## October 10 demonstration and acceptance criteria

The essential demo path is the direct-work loop: create/select a client → create an itemized invoice → save/export the PDF → record an advance and receipt → accept task tracking → complete the linked work → open the delivery link → record the final payment. Demonstrate outsourcing as a branch of that same loop when available; it should reuse the linked job rather than start a disconnected workflow.

A concrete example for Chethaka in **LKR** (illustrative amounts, not his actual rates):

| Step | Example |
| --- | --- |
| Services | Business website development: 80,000; AI consulting session and recommendations: 20,000 |
| Discount | 10,000 first-time-client discount; no tax in this example |
| Final invoice | 90,000 |
| Required advance | 50% = 45,000 |
| Advance recorded | 45,000 received, receipt attached; 45,000 still due |
| Task tracking | Website development and AI consulting tasks appear in To do, linked to this invoice |
| Optional outsourcing | Website development outsourced to another developer for 30,000, linked to the same task/invoice |
| Delivery | Website/source-code link and AI consulting recommendations shared through the saved delivery location |
| Final payment | Remaining 45,000 received; invoice fully paid |
| Expense and profit | Other expense: 5,000; after a 30,000 contractor cost, job profit is 55,000 |

Acceptance means records and links survive an app restart, not just that a toast or sample card appears. The PDF must exist on disk, the receipt must be reopenable, financial amounts must agree across screens, and repeated actions must not create duplicate clients, invoices, payments, or tasks. The No choice in the tracking prompt must also work.

## Guidance for contributors and AI agents

- Preserve this workflow when working on an individual page. Check how the change affects the previous and next steps, shared types, local persistence, and financial calculations.
- Prefer existing routes, components, and data/IPC conventions. Connect screens using stable record IDs, not only matching names or copied display text.
- Preserve the invoice's issued client details, line items, and agreed prices when a reusable client profile or catalog service later changes.
- Keep the app local-first. Persist the records and attachments needed for the desktop demonstration; an in-memory preview alone does not complete the workflow.
- Keep both light and dark mode working, including new dialogs and controls. Appearance settings belong under **Settings → Appearance**.
- For development conventions, branching strategy (`main`, `Nipun`, `Lahiru`, `Binuka`, `Sandika`), and pre-commit test checklists, see [CONTRIBUTING.md](CONTRIBUTING.md).
- For module ownership breakdown, team responsibilities, and merged sprint timelines, see [CONTRIBUTIONS.md](CONTRIBUTIONS.md).
- For product overview, tech stack details, and packaging commands, see [README.md](README.md).
- For the upcoming demo, prioritize completing the connected direct-work loop over unrelated features or visual-only placeholders. Additional invoice templates and the reverse **task first → create invoice** workflow are future work, not prerequisites for this first loop.
- Do not treat this document as an instruction to implement every feature in every task. Use it as shared product context, implement the assigned scope, and report missing connections honestly.

## Brand identity

Use Lahiru's BillFlow V1 logo exports as the current brand identity. Original assets and usage notes are in `assets/brand/`; generated assets are in `public/brand/` and `build/`. Use the colored mark on light surfaces, the white mark on dark surfaces, and the app-shaped icon for desktop/browser icons. Preserve the supplied artwork and use `npm run brand:generate` to regenerate the required sizes and formats.

## Desktop persistence and current implementation gaps

All workflow business records must survive page navigation and an app restart through the **existing SQLite database**. Do not assume a page is persistent because it has a creation dialog or success toast.

- Use the existing flow: page → `src/lib/data/DataProvider.tsx` → `window.billflow` in `electron/preload.ts` → validated Electron IPC → Drizzle/`better-sqlite3` in `electron/db/`. Keep database and filesystem access in the main process.
- The desktop database is `billflow.db` under Electron's `app.getPath("userData")`. Extend `electron/db/schema.ts` and add versioned migrations under `drizzle/`; update validation, shared types, preload/API types, IPC registration and DataProvider together. Do not create a second disconnected database.
- Store money as integer minor units with an explicit currency. Use stable IDs and foreign keys for invoice/items/payments/tasks/vendors/work orders/expenses. Related writes must be transactional; repeated submissions and automatic task creation must be idempotent at the database level.
- Persist attachment metadata in SQLite and copy receipt files into an app-managed userData directory. A filename, boolean, original external file path, or temporary preview is insufficient. Files must reopen after restart and travel with complete backups/restores.
- Record individual payments rather than using a status toggle to invent the amount received. Compute paid totals, advance eligibility and remaining balances consistently. Invoice edits must preserve actual recorded payments and issued client/item/business details.
- Keep component state for transient UI. Browser preview storage is not desktop SQLite persistence and must not be used as evidence that the desktop demo is complete. Appearance's existing local preference file and widget UI preferences can stay separate from business records.

**Audited baseline, October 6, 2026:** fetched `main` at `54f7649` has SQLite-backed Clients, basic Invoices, Settings and Vendors. Tasks, Catalog and Expenses currently use page-local state. Invoice items, individual payments, receipts, advance-paid/task-generation behavior and automatic invoice PDF export are not implemented. Outsourcing prefill is navigation context, not a persisted task/invoice relationship. Backup currently omits Vendors; financial views still contain sample/estimated values. These are dated findings, not permanent limitations: recheck the implementation before making changes or reporting readiness.

Read [the workflow readiness audit](WORKFLOW_AUDIT.md) for page-specific gaps, evidence, data-model requirements, implementation order and restart acceptance checks. For October 10, first complete itemized invoice/PDF → recorded advance/receipt → persistent linked tasks → delivery → final payment; then complete the linked outsourcing branch and truthful expense/profit views. Keep the demo's financial result consistent with actual stored records throughout.
