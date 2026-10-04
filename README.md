# BillFlow — Local-First Freelance Invoicing & Task Execution Workspace

> **Academic Coursework:** EER4189 Software Design in Group — The Open University of Sri Lanka (OUSL)  
> **Group:** Group 61  
> **Industry Partner / Client:** Mr. Chethaka Lakshitha (Full-Stack AI Engineer & Consultant)  
> **Specification Standard:** IEEE 830-1998 / ISO/IEC/IEEE 29148  
> **UI Prototype Reference:** [BillFlow - Design 2.0 (Figma)](https://www.figma.com/design/GtcnOoTxEvm0dRJj5FXzwY/BillFlow---Design-2.0?node-id=0-1&t=s5FMp98PXvy2LO9v-1)  

---

## Overview

**BillFlow** is a modern, local-first desktop application designed for independent technical freelancers and consultants. It unifies client accounts, catalog rate cards, multi-currency invoicing, deliverable execution, subcontractor vendor payout tracking, and real-time financial analytics into a single fast workspace.

The application runs as a native desktop application powered by **Electron** with a persistent local **SQLite database**, while supporting dual platforms (**Windows** and **macOS**).

---

## Architecture & Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Desktop Shell** | Electron 44 | Secure context isolation, sandbox enabled, typed IPC bridge (`window.billflow`) |
| **Local Database** | SQLite (`better-sqlite3`) + Drizzle ORM | High-performance WAL mode, foreign key constraints, migration runner |
| **Frontend Framework** | Next.js 16 (Turbopack) | Statically exported (`output: 'export'`) with zero server dependency in production |
| **UI Library** | React 19 | Client-rendered with responsive hooks and instant state feedback |
| **Language** | TypeScript 5 (Strict Mode) | Full type safety across main process, IPC, schema, and React renderer |
| **Styling Engine** | Tailwind CSS v4 | Editorial typography pairing, multi-layered neutral depth shadows |
| **Validation** | Zod 4 | Strict input sanitization for client and invoice creation |
| **Testing** | Vitest 5 | Unit tests verifying SQLite persistence, stats computation, and IPC logic |

---

## Key Modules & Interconnections

### 1. Clients Ledger (`/clients`)
- **Add Client Modal:** Clean modal dialog with email validation, category tags, contact role, and default billing currency.
- **Client Ledger & Quick Bill:** Create invoices directly from the client's card with automatic currency matching.
- **Computed Financial Totals:** Real-time calculation of total billed, total paid, outstanding balance, and invoice count.
- **Invoice Protection:** Client records cannot be deleted if linked invoices exist (`CLIENT_HAS_INVOICES`).

### 2. Multi-Currency Invoices (`/invoices`)
- **Client Association:** Invoices link directly to registered clients via dropdown selection (no free-text entry).
- **Automated Sequence Generation:** Invoices receive sequentially incremented identifiers (`INV-YYYY-001`, `INV-YYYY-002`, etc.).
- **Live Status Management:** Mark invoices as `DRAFT`, `UNPAID`, `PAID`, or `OVERDUE`. Marking an invoice as paid updates client balance and executive dashboard immediately.
- **Direct Ledger Navigation:** Clicking a client in the invoice list immediately opens their filtered ledger.

### 3. Executive Dashboard (`/`)
- **Live Business KPIs:** Real-time computation of gross revenue, pending receivables, and active client count across all currencies.
- **Recent Invoices Stream:** Displays latest issued invoices with instant navigation to invoice details.

---

## Local Database Storage

BillFlow saves all records locally on the user's machine without requiring an external cloud server:

- **Windows:** `%APPDATA%\BillFlow\billflow.db` (e.g. `C:\Users\<User>\AppData\Roaming\BillFlow\billflow.db`)
- **macOS:** `~/Library/Application Support/BillFlow/billflow.db`
- **Development Fallback:** `./.billflow-dev/billflow.db`

The application launches with a **clean blank slate** (no hardcoded mock data). You can add test clients and invoices directly through the UI.

---

## Prerequisites

- **Node.js:** v22.x LTS (pinned in `.nvmrc`)
- **npm:** v10.x or higher
- **Operating System:** Windows 10/11 (x64) or macOS 12+ (Apple Silicon or Intel)

---

## Getting Started

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/Akatsuki-61/BillFlow.git
cd BillFlow

# Install dependencies and build native SQLite binaries for Electron
npm install
```

### 2. Run Desktop App (Development Mode)

Starts the Next.js development server and Electron with hot-reloading:

```bash
npm run dev:electron
```

### 3. Run Web Preview (Browser Only)

Runs the application inside the browser with an in-memory repository fallback:

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Testing

Run unit tests for database schema, validation, and IPC logic:

```bash
npm test
```

Run TypeScript compilation check:

```bash
npx tsc --noEmit
```

Build production static assets and Electron main process:

```bash
npm run build
```

---

## Building Desktop Installers

### For Windows (`.exe` NSIS Installer)
From a Windows machine (or via GitHub Actions):
```bash
npm run dist:win
```
The installer will be generated in `release/BillFlow Setup 0.1.0.exe`.

### For macOS (`.dmg` Installer)
From a macOS machine:
```bash
npm run dist:mac
```
The DMG image will be generated in `release/BillFlow-0.1.0.dmg`.

---

## Evaluation Guide (For Lecturer & Reviewers on Windows)

1. **Option A: Running Pre-Built Installer (`.exe`)**
   - Download the generated `BillFlow Setup 0.1.0.exe` from GitHub Releases / the release folder.
   - Run the installer. If Windows SmartScreen appears (common for unsigned student projects), click **More info** -> **Run anyway**.
   - Launch BillFlow from the desktop shortcut or Start Menu.
   - The application opens cleanly to an empty workspace.
   - Go to **Clients** -> click **Add Client** -> enter client details (e.g. *Stark Enterprises*, `billing@stark.com`, USD).
   - Click **Quick Bill** on the client card or navigate to **Invoices** -> click **New Invoice** -> create an invoice for `$1,500.00`.
   - Observe the live metrics update on the client card, invoice table, and main dashboard.

2. **Option B: Running from Source on Windows**
   ```powershell
   git clone https://github.com/Akatsuki-61/BillFlow.git
   cd BillFlow
   npm install
   npm run dev:electron
   ```

---

## Project Structure

```text
├── electron/
│   ├── db/
│   │   ├── index.ts                   # SQLite connection, WAL mode, migration runner
│   │   └── schema.ts                  # Drizzle ORM schema (clients, invoices)
│   ├── ipc/
│   │   ├── clients.ts                 # Client CRUD and financial stats handlers
│   │   ├── invoices.ts                # Invoice CRUD and code generation handlers
│   │   ├── dashboard.ts               # Executive metrics aggregation handlers
│   │   └── errors.ts                  # Structured IPC error formatting
│   ├── main.ts                        # Electron window lifecycle & app:// protocol
│   ├── preload.ts                     # Context bridge exposing window.billflow
│   ├── validation.ts                  # Zod validation schemas
│   └── test/
│       └── db.test.ts                 # Vitest database & IPC tests
├── drizzle/                           # SQL migration files
├── src/
│   ├── app/
│   │   ├── clients/page.tsx           # Client ledger & Quick Bill
│   │   ├── invoices/page.tsx          # Multi-currency invoice management
│   │   ├── page.tsx                   # Main executive dashboard
│   │   └── layout.tsx                 # Root layout with DataProvider
│   ├── lib/
│   │   ├── data/
│   │   │   └── DataProvider.tsx       # React Context bridging IPC & in-memory fallback
│   │   └── format.ts                  # Currency & date formatters
│   └── types/
│       ├── billing.ts                 # Unified client & invoice interfaces
│       └── billflow-api.d.ts          # Window.billflow TypeScript declarations
├── build/                             # App icons (.ico, .icns, .png, .svg)
├── electron-builder.yml               # Packaging configuration for Windows & macOS
└── .github/workflows/release.yml      # CI/CD workflow building Windows & Mac binaries
```
