# BillFlow — Local-First Freelance Invoicing & Task Execution Workspace

> **Academic Coursework:** EER4189 Software Design in Group — The Open University of Sri Lanka (OUSL)  
> **Group:** Group 61  
> **Industry Partner / Client:** Mr. Chethaka Lakshitha (Full-Stack AI Engineer & Consultant)  
> **Specification Standard:** IEEE 830-1998 / ISO/IEC/IEEE 29148  
> **UI Prototype Reference:** [BillFlow - Design 2.0 (Figma)](https://www.figma.com/design/GtcnOoTxEvm0dRJj5FXzwY/BillFlow---Design-2.0?node-id=0-1&t=s5FMp98PXvy2LO9v-1)  

---

## Overview

**BillFlow** is a modern, local-first web application designed for independent technical freelancers and consultants. It unifies catalog rate cards, multi-currency invoicing, deliverable execution, subcontractor vendor payout tracking, and real-time financial analytics into a single fast workspace.

---

## Languages Used

1. **TypeScript (`.ts`, `.tsx`)**
   - Main programming language for all application logic, React components, state management, and strict data type definitions.
2. **JavaScript (ES Modules / Node.js)**
   - Used for Next.js build workflows, configuration files, and package scripts.
3. **HTML5 / JSX**
   - Provides semantic document structure, interactive modal dialogs, and embedded SVG graphics (charts and gauges).
4. **CSS3**
   - Applied via **Tailwind CSS v4** (`globals.css`) for theme variables, custom typography utilities, gradients, and layout design.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router with Turbopack) |
| **Frontend Library** | React 19 |
| **Primary Language** | TypeScript 5 (Strict Mode) |
| **Styling Engine** | Tailwind CSS v4 |
| **Typography** | Newsreader & Inter (via `next/font/google`) |
| **Iconography** | Font Awesome & Lucide React |

---

## Two-Font Typography System

BillFlow strictly adheres to a clean two-font typography architecture:

1. **Newsreader** (*"Newspaper"* Editorial Serif):
   - Applied to the brand logo (**"BillFlow"**), page titles, section titles, and key financial metrics (`$142,850`, `94.2%`, `86%`, `$42,850.00`).
2. **Inter** (Modern Sans-Serif):
   - Applied to all UI controls, body text, buttons, table entries, filter tabs, and status badges across the system.

No other font families are loaded, maintaining lightweight performance and consistent editorial branding.

---

## Key Features & Modules

### 1. Analytics Dashboard (`/analytics`)
Rebuilt directly from the Figma Design 2.0 wireframe:
- **Net Profit Card:** Highlights net profit with a growth trend indicator (`+12.4%`), detailed calculation modal, and subtle background watermark.
- **Paid Ratio Card:** High-contrast dark gradient card (`#0c0d12` to `#1f1733`) showing payment collection efficiency (`94.2%`) with a purple progress bar and breakdown figures (`$482k` collected / `$512k` billed).
- **Revenue vs Expenses Chart:** Multi-month bar chart (January – June) comparing gross revenue against operating expenses with hover states and a 0–2.0M scale.
- **Billing Alerts:** Highlights overdue invoices with actionable alert badges, quick one-click payment reminder triggers, and an expandable alert viewer.
- **Collection Rate Indicator:** Circular SVG donut progress gauge (`86%`) showing on-time client settlements.
- **Timeframe Filters:** Segmented control (`Month`, `Quarter`, `Year`) and interactive quarter selector dropdown (`Q3 2023`).

### 2. Client Directory & Ledger (`/clients`)
- Comprehensive client profiles with contact details, default billing currency, and Google Drive deliverables links.
- Instant Quick Bill modal and invoice transaction histories.

### 3. Outsourcing & Vendor Directory (`/outsourcing`)
- Subcontractor payout tracking with payment status indicators and payment run summaries.

### 4. Expense Tracking & Task Management (`/expenses`, `/tasks`, `/todo`)
- Categorized expense logging, delivery task boards, and daily freelancer todo workflows.

---

## Design System & Color Tokens

- **Main Canvas:** `#faf9f5` (warm cream linen)
- **Card Containers:** `#eaeae5` with subtle border `#deded8`
- **Dark Accent Card:** Linear gradient from `#0c0d12` to `#1f1733`
- **Brand Purple:** `#7133f5`
- **Alert Highlights:** `#fee2e2` / `#ef4444`
- **Success & Growth:** `#d6eddb` / `#15803d`

---

## Project Structure

```text
src/
├── app/
│   ├── analytics/
│   │   └── page.tsx                   # Dedicated /analytics route
│   ├── clients/
│   │   └── page.tsx                   # Client directory & billing ledger
│   ├── expenses/
│   │   └── page.tsx                   # Expense management
│   ├── outsourcing/
│   │   └── page.tsx                   # Vendor payout directory
│   ├── tasks/
│   │   └── page.tsx                   # Task board
│   ├── todo/
│   │   └── page.tsx                   # Daily todo workflow
│   ├── globals.css                    # Theme variables & typography definitions
│   ├── layout.tsx                     # Main app layout with navigation sidebar
│   └── page.tsx                       # Root redirect to primary view
├── components/
│   ├── analytics/
│   │   └── AnalyticsView.tsx          # Analytics dashboard matching Figma wireframe
│   ├── outsourcing/
│   │   └── OutsourcingView.tsx        # Vendor directory and payout tracking UI
│   └── Sidebar.tsx                    # Two-font navigation sidebar
└── types/
    ├── analytics.ts                   # Financial and billing alert interfaces
    ├── outsourcing.ts                 # Vendor payout and invoice models
    └── tasks.ts                       # Task management types
```

---

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Development Server

```bash
npm run dev
```

Open [http://localhost:3000/analytics](http://localhost:3000/analytics) in your browser.

### 3. Production Build & Linting

```bash
# Check TypeScript and ESLint
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```
