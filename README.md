# BillFlow — Local-First Freelance Invoicing & Task Execution Workspace

> **Academic Coursework:** EER4189 Software Design in Group — The Open University of Sri Lanka (OUSL)  
> **Group:** Group 61  
> **Industry Partner / Client:** Mr. Chethaka Lakshitha (Full-Stack AI Engineer & Consultant)  
> **Specification Standard:** IEEE 830-1998 / ISO/IEC/IEEE 29148  
> **UI Prototype Reference:** [BillFlow - Design 2.0 (Figma)](https://www.figma.com/design/GtcnOoTxEvm0dRJj5FXzwY/BillFlow---Design-2.0?node-id=0-1&t=s5FMp98PXvy2LO9v-1)  

---

## Overview

**BillFlow** is an offline-first, local-first web application designed for independent technical freelancers and consultants. It eliminates fragmented chat notes, manual spreadsheets, and expensive recurring SaaS tools by unifying catalog rate cards, multi-currency invoicing, deliverable execution, and sub-contractor outsourcing with vendor payout tracking.

---

## Module 6: Outsourcing & Vendor Directory UI

This module implements the **Outsourcing Frontend UI** strictly aligned with the official [BillFlow - Design 2.0 Figma Wireframe](https://www.figma.com/design/GtcnOoTxEvm0dRJj5FXzwY/BillFlow---Design-2.0?node-id=0-1&t=s5FMp98PXvy2LO9v-1).

### Key Highlights & Features:

- **Figma Design 2.0 Color & Layout Fidelity:**
  - **Main Canvas:** Warm cream/linen tone (`#faf9f5`) matching Figma artboard canvas.
  - **Sidebar Navigation:** Soft neutral background (`#f4f4f0`) with border (`#e5e5e0`), vibrant brand purple circle (`#7133f5`), serif brand title, and active tab pill in soft warm gray (`#eae8ed`).
  - **Two-Font System Architecture:**
    - **1. Headings, Brand & Metric Figures:** **Newsreader** ("Newspaper" serif font style) exclusively applied to brand logo **"BillFlow"**, page title **"Outsourcing"**, and KPI financial figures (**`$42,850.00`**, **`14`**, **`Oct 15`**).
    - **2. All Other Web System Typography:** **Inter** sans-serif font applied to all body text, subtitles, table rows, navigation items, buttons, status badges, and interactive forms. No other fonts are loaded or used in the application.
  - **Metric Summary Cards (`#eaeae5`):**
    - **Total Outstanding Payables**: `$42,850.00` (in authentic Newspaper font style)
    - **Active Vendors**: `14` (in Newspaper font style with pastel mint green crescent `#d6eddb`)
    - **Next Payout Run**: `Oct 15` (in Newspaper font style with pastel lavender crescent `#e2e0e4`)
  - **Header Actions:** Clean bordered buttons for `+ Add Client` and `Log Expense`.
- **Vendor Directory Table:**
  - Integrated `#eaeae5` container header with `#faf9f5` row cards.
  - Itemized rows for sub-contractor services (Studio ArchiType, DevOps Nexus, ClearCopy Legal).
  - Accurate status badges: `PENDING` (`#eaeae5`) and `PAID` (`#d6eddb` mint badge with emerald text).
  - Action buttons matching wireframe: purple solid download buttons (`#7133f5`) for pending vouchers, and clean outlined download button for settled vendors.
- **Font Awesome Integration ([fontawesome.com](https://fontawesome.com/)):**
  - All navigation and view icons powered by official Font Awesome vector icons (`faTableCellsLarge`, `faFileInvoice`, `faUserGroup`, `faShapes`, `faMoneyBillWave`, `faUserGear`, `faClipboardCheck`, `faSquarePollVertical`, `faGear`, `faCircleQuestion`, `faUserPlus`, `faReceipt`, `faDownload`, `faSliders`, `faCode`, `faFileLines`, etc.).
- **Controlled Navigation Workflow:**
  - In the navigation bar, **only the `Outsourcing` button is active and functional on click**, focusing the workflow strictly on the Outsourcing module while keeping other module tabs non-clickable.
- **Codebase Documentation:**
  - Every component and function includes concise, clear comments describing its UI purpose and layout structure.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Frontend Library** | React 19 |
| **Language** | TypeScript 5 (Strict Mode) |
| **Styling** | Tailwind CSS v4 |
| **Color Tokens** | `#faf9f5` (Canvas), `#f4f4f0` (Sidebar), `#eaeae5` (Cards), `#7133f5` (Purple) |
| **Typography** | Newsreader (Headings / Newspaper style), Inter (Body & UI) |
| **Iconography** | Font Awesome ([fontawesome.com](https://fontawesome.com/)) |

---

## Project Structure

```text
src/
├── app/
│   ├── globals.css                    # Color variables, Google fonts & Tailwind CSS v4 root
│   ├── layout.tsx                     # Root application layout with navigation sidebar
│   ├── page.tsx                       # Root view displaying Outsourcing UI
│   └── outsourcing/
│       └── page.tsx                   # Dedicated /outsourcing route
├── components/
│   ├── Sidebar.tsx                    # Font Awesome sidebar with selective click control & wireframe colors
│   └── outsourcing/
│       └── OutsourcingView.tsx        # Pure frontend Outsourcing & Vendor Directory UI with wireframe colors
└── types/
    └── outsourcing.ts                 # TypeScript interfaces and models
```

---

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Development Server

Start the local Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/outsourcing](http://localhost:3000/outsourcing) in your browser.

### 3. Production Build & Linting

```bash
# Verify ESLint rules
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```

---

## Recommended Git Commit

```bash
git add .
git commit -m "feat(outsourcing): implement two-font system with Newsreader headings and Inter body UI"
```
