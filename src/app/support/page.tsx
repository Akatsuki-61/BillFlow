"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  X,
  ChevronDown,
  ExternalLink,
  Folder,
  Database,
  Receipt,
  ClipboardList,
  GitFork,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  HardDrive,
  Bug,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { PageHeader, Button } from "@/components/ui/Workspace";
import { useData } from "@/lib/data/DataProvider";

interface FAQItem {
  id: string;
  category: "billing" | "tasks" | "outsourcing" | "data" | "troubleshooting";
  question: string;
  answer: string;
  actionText?: string;
  actionHref?: string;
}

const FAQ_DATABASE: FAQItem[] = [
  {
    id: "advance-payment",
    category: "billing",
    question: "How does the advance payment workflow work?",
    answer:
      "When creating an invoice for client work (like website development or AI consulting), you can specify a required deposit—typically 50% of the total amount. BillFlow shows the invoice total, advance due, and remaining balance separately. Once the client transfers the funds outside the app, open the invoice, record the payment with the attached transfer receipt, and the status transitions to Advance Paid.",
    actionText: "Open Invoices",
    actionHref: "/invoices",
  },
  {
    id: "pdf-export-location",
    category: "billing",
    question: "Where are invoice PDFs saved on my computer?",
    answer:
      "BillFlow generates clean, printable PDF invoices and saves them directly to your chosen local folder. By default, it exports to your system Downloads directory. You can view or change this destination at any time under Settings → Invoices.",
    actionText: "Configure PDF Folder",
    actionHref: "/settings?tab=invoices",
  },
  {
    id: "currencies-and-banking",
    category: "billing",
    question: "Can I manage multiple currencies and custom bank details?",
    answer:
      "Yes. You can set a global default currency (USD, LKR, or EUR) in Settings, or assign a specific currency to individual clients. Payment instructions—such as your local bank account, IBAN, Swift code, or transfer notes—are maintained in Settings and printed automatically on every exported PDF.",
    actionText: "Manage Payment Details",
    actionHref: "/settings?tab=profile",
  },
  {
    id: "auto-task-prompt",
    category: "tasks",
    question: "How does the automatic task prompt work?",
    answer:
      "When an invoice first reaches the Advance Paid status, BillFlow presents a prompt asking if you want to track the deliverables. You can confirm immediately with 'Yes', decline with 'No', or wait for the 5-second countdown to auto-create the tasks. Each line item (such as web development or consulting sessions) is converted into a linked task in the To Do column of your board.",
    actionText: "View Tasks Board",
    actionHref: "/tasks",
  },
  {
    id: "working-vs-elapsed-time",
    category: "tasks",
    question: "Why does BillFlow separate active working time from total elapsed time?",
    answer:
      "Calendar days do not equal active labor. BillFlow measures time spent actively in the 'In Progress' column separately from total calendar time. Time waiting in 'To Do' or pending client 'Review' does not inflate your recorded active hours, giving you an honest record of effort.",
    actionText: "Inspect Task Timing",
    actionHref: "/tasks",
  },
  {
    id: "delivery-links",
    category: "tasks",
    question: "How do I share deliverables with the client?",
    answer:
      "Store your client's preferred delivery destination—such as a GitHub repository URL, a staging preview link, or a shared Google Drive folder—directly on the client profile or on the task card. Both the invoice PDF and the task tile link directly to this URL so you never lose track of project files.",
    actionText: "Client Directory",
    actionHref: "/clients",
  },
  {
    id: "outsource-from-task",
    category: "outsourcing",
    question: "How do I outsource a deliverable directly from a task?",
    answer:
      "Open any task card on your Kanban board and choose 'Outsource task'. BillFlow opens the Outsourcing workspace with the deliverable description, client, and parent invoice pre-filled. Select a subcontractor vendor, agree on their contractor fee, and issue a work order.",
    actionText: "Outsourcing Workspace",
    actionHref: "/outsourcing",
  },
  {
    id: "contractor-costs-and-profit",
    category: "outsourcing",
    question: "How are subcontractor fees reflected in profit calculations?",
    answer:
      "Subcontractor fees are tracked as payables tied to the source job. Your net profit equals the client revenue minus the subcontractor fee and any logged operational expenses. BillFlow keeps subcontractor payables separate from general expenses so contractor payouts are never subtracted twice.",
    actionText: "View Financial Analytics",
    actionHref: "/analytics",
  },
  {
    id: "local-first-storage",
    category: "data",
    question: "Where is my data stored? Does BillFlow send data to cloud servers?",
    answer:
      "BillFlow is strictly local-first. All clients, invoices, tasks, work orders, and receipts reside on your computer inside an embedded SQLite database (billflow.db) located in your operating system's application support folder. Your business data never touches third-party cloud servers.",
    actionText: "Inspect Database Path",
    actionHref: "/settings?tab=data",
  },
  {
    id: "backups-and-restore",
    category: "data",
    question: "How do I back up my workspace or move to a new computer?",
    answer:
      "Head to Settings → Data and click 'Export Backup'. BillFlow produces a comprehensive JSON snapshot containing your settings, client records, invoices, line items, and vendor lists. You can import this snapshot on any other machine to restore your complete workspace.",
    actionText: "Export Backup Now",
    actionHref: "/settings?tab=data",
  },
  {
    id: "receipt-storage-policy",
    category: "data",
    question: "What happens to uploaded payment receipts and files?",
    answer:
      "When you attach a payment slip, bank receipt, or PDF confirmation, BillFlow makes a managed copy inside your application support directory. Receipts remain permanently accessible inside the app even if you move or delete the original downloaded file.",
    actionText: "Check Storage Settings",
    actionHref: "/settings?tab=data",
  },
  {
    id: "pdf-export-error",
    category: "troubleshooting",
    question: "What should I do if an invoice PDF fails to export?",
    answer:
      "Verify that your configured PDF directory exists and that BillFlow has write permissions for that folder. If an export fails, you can retry from the invoice details screen at any time without creating duplicate invoice numbers or re-entering data.",
    actionText: "Check PDF Destination",
    actionHref: "/settings?tab=invoices",
  },
  {
    id: "receipt-file-formats",
    category: "troubleshooting",
    question: "Which file formats are supported for payment attachments?",
    answer:
      "BillFlow supports PNG, JPG, JPEG, WebP images, and PDF documents up to 10MB per attachment. If an image preview looks blank, ensure the file is not corrupted and fits within the standard size limit.",
    actionText: "Browse Invoices",
    actionHref: "/invoices",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Topics" },
  { id: "billing", label: "Invoicing & Billing" },
  { id: "tasks", label: "Tasks & Delivery" },
  { id: "outsourcing", label: "Subcontracting" },
  { id: "data", label: "Data & Privacy" },
  { id: "troubleshooting", label: "Troubleshooting" },
] as const;

export default function SupportPage() {
  const {
    isElectron,
    settings,
    clients,
    invoices,
    tasks,
    vendors,
    getDbPath,
    revealDbFile,
    error,
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>("advance-payment");
  const [dbPath, setDbPath] = useState<string>("Loading path...");
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [revealSuccess, setRevealSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getDbPath()
      .then((path) => {
        if (isMounted) setDbPath(path);
      })
      .catch(() => {
        if (isMounted) setDbPath("Local application storage");
      });
    return () => {
      isMounted = false;
    };
  }, [getDbPath]);

  const filteredFAQs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return FAQ_DATABASE.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!query) return true;
      return (
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, selectedCategory]);

  const handleCopyDiagnostics = async () => {
    const payload = [
      "### BillFlow Workspace Diagnostics",
      `- Runtime Environment: ${isElectron ? "Desktop Native (Electron)" : "Browser Preview"}`,
      `- Platform: ${typeof window !== "undefined" ? window.navigator.platform : "macOS / Desktop"}`,
      `- Database Storage: ${dbPath}`,
      `- Active Clients: ${clients.length}`,
      `- Recorded Invoices: ${invoices.length}`,
      `- Kanban Tasks Tracked: ${tasks.length}`,
      `- Registered Subcontractors: ${vendors.length}`,
      `- Default Currency: ${settings?.defaultCurrency || "USD"}`,
      `- Timestamp: ${new Date().toISOString()}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      setCopiedDiag(true);
      setTimeout(() => setCopiedDiag(false), 2200);
    } catch {
      // Clipboard fallback
    }
  };

  const handleRevealDb = async () => {
    if (!isElectron) return;
    try {
      await revealDbFile();
      setRevealSuccess(true);
      setTimeout(() => setRevealSuccess(false), 2200);
    } catch {
      // Reveal failed
    }
  };

  const toggleAccordion = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="workspace-page motion-page max-w-6xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <PageHeader
        title="Help & Support"
        description="Workflow references, operating guides, troubleshooting, and local workspace diagnostics."
      >
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={handleCopyDiagnostics}
            className="flex items-center gap-2 text-xs font-medium"
            title="Copy technical details for reporting issues"
          >
            {copiedDiag ? (
              <>
                <Check className="w-3.5 h-3.5 text-content-emerald-600" />
                <span>Copied Details</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-content-neutral-500" />
                <span>Copy Diagnostics</span>
              </>
            )}
          </Button>

          <a
            href="https://github.com/Akatsuki-61/BillFlow/issues"
            target="_blank"
            rel="noreferrer"
            className="ui-button ui-button--primary text-xs font-semibold flex items-center gap-1.5"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Report Issue</span>
          </a>
        </div>
      </PageHeader>

      {/* Surface error if any */}
      {error && (
        <div
          role="alert"
          className="ui-card p-4 rounded-xl border border-line-rose-200 bg-surface-rose-50 text-content-rose-800 flex items-center gap-3 text-sm"
        >
          <AlertCircle className="w-5 h-5 text-content-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Search Box */}
      <div className="ui-card p-6 md:p-8 rounded-2xl border border-line-neutral-200/80 bg-surface shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-tinted border border-line-purple-200/60 text-[11px] font-semibold text-accent uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-accent" />
            <span>Freelance Knowledge Base</span>
          </div>

          <h2 className="font-newspaper text-2xl md:text-3xl font-normal text-content-neutral-900 tracking-tight leading-snug">
            How can we help your freelance workflow today?
          </h2>

          <p className="text-sm text-content-neutral-600 leading-relaxed">
            Search guides for client billing, deposit receipts, task tracking,
            subcontractor work orders, and local SQLite data management.
          </p>

          <div className="relative pt-1">
            <Search className="w-4 h-4 text-content-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides (e.g., advance payment, PDF folder, task timer, database)..."
              className="ui-field w-full pl-10 pr-10 border border-line-neutral-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-sm rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-neutral-400 hover:text-content-neutral-700 p-1 rounded-md"
                aria-label="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Subtle background decoration */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-accent/5 pointer-events-none blur-2xl" />
      </div>

      {/* Quick Access Workflow Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/invoices"
          className="ui-card p-5 rounded-xl border border-line-neutral-200/80 bg-surface hover:border-line-purple-300 hover:shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-surface-purple-50 flex items-center justify-center text-accent">
              <Receipt className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-neutral-900 group-hover:text-accent transition-colors">
                Invoices & PDF Export
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                Itemize software services, request 50% deposits, and save printable PDFs.
              </p>
            </div>
          </div>
          <div className="pt-4 flex items-center text-xs font-medium text-accent gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Open Invoices</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/tasks"
          className="ui-card p-5 rounded-xl border border-line-neutral-200/80 bg-surface hover:border-line-purple-300 hover:shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-surface-emerald-50 text-content-emerald-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-neutral-900 group-hover:text-content-emerald-700 transition-colors">
                Tasks & Delivery Links
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                Track deliverables on the Kanban board with GitHub or staging URLs.
              </p>
            </div>
          </div>
          <div className="pt-4 flex items-center text-xs font-medium text-content-emerald-600 gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>View Task Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/outsourcing"
          className="ui-card p-5 rounded-xl border border-line-neutral-200/80 bg-surface hover:border-line-purple-300 hover:shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-surface-blue-50 text-content-blue-700 flex items-center justify-center">
              <GitFork className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-neutral-900 group-hover:text-content-blue-800 transition-colors">
                Subcontractor Orders
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                Outsource deliverables to vendors with agreed contractor fees.
              </p>
            </div>
          </div>
          <div className="pt-4 flex items-center text-xs font-medium text-content-blue-700 gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Manage Outsourcing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/settings?tab=data"
          className="ui-card p-5 rounded-xl border border-line-neutral-200/80 bg-surface hover:border-line-purple-300 hover:shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-surface-amber-50 text-content-amber-700 flex items-center justify-center">
              <Database className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-neutral-900 group-hover:text-content-amber-800 transition-colors">
                Data & Backups
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                Local SQLite database, managed receipts, and JSON backup exports.
              </p>
            </div>
          </div>
          <div className="pt-4 flex items-center text-xs font-medium text-content-amber-700 gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Inspect Storage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Live Workspace Diagnostics Card */}
      <section className="ui-card p-6 rounded-2xl border border-line-neutral-200/80 bg-surface space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-surface-tinted text-accent">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-neutral-900">
                Workspace Diagnostics & Environment
              </h3>
              <p className="text-xs text-content-neutral-500 mt-0.5">
                Technical state of your active local database and desktop session.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isElectron && (
              <Button
                variant="secondary"
                size="small"
                onClick={handleRevealDb}
                className="text-xs flex items-center gap-1.5"
                title="Open SQLite database folder in Finder or Explorer"
              >
                <Folder className="w-3.5 h-3.5 text-content-neutral-500" />
                <span>{revealSuccess ? "Opened in Finder" : "Reveal Database"}</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="small"
              onClick={handleCopyDiagnostics}
              className="text-xs flex items-center gap-1.5"
            >
              {copiedDiag ? (
                <>
                  <Check className="w-3.5 h-3.5 text-content-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-content-neutral-500" />
                  <span>Copy Report</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-surface-tinted/50 border border-line-neutral-100 space-y-1">
            <span className="text-[11px] font-semibold text-content-neutral-500 uppercase tracking-wider block">
              Runtime
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-content-emerald-500" />
              <span className="text-xs font-semibold text-content-neutral-900">
                {isElectron ? "Desktop Native" : "Web Preview"}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-tinted/50 border border-line-neutral-100 space-y-1">
            <span className="text-[11px] font-semibold text-content-neutral-500 uppercase tracking-wider block">
              Records Tracked
            </span>
            <span className="text-xs font-semibold text-content-neutral-900">
              {clients.length} Clients • {invoices.length} Invoices
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-tinted/50 border border-line-neutral-100 space-y-1">
            <span className="text-[11px] font-semibold text-content-neutral-500 uppercase tracking-wider block">
              Tasks & Vendors
            </span>
            <span className="text-xs font-semibold text-content-neutral-900">
              {tasks.length} Tasks • {vendors.length} Vendors
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-tinted/50 border border-line-neutral-100 space-y-1">
            <span className="text-[11px] font-semibold text-content-neutral-500 uppercase tracking-wider block">
              Default Currency
            </span>
            <span className="text-xs font-semibold text-content-neutral-900 font-mono">
              {settings?.defaultCurrency || "USD"} ({settings?.invoicePrefix || "INV-"})
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-neutral-50/70 border border-line-neutral-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <Database className="w-4 h-4 text-accent shrink-0" />
            <span className="text-content-neutral-500 shrink-0">Database File:</span>
            <code className="font-mono text-content-neutral-800 truncate" title={dbPath}>
              {dbPath}
            </code>
          </div>
          <span className="text-[11px] text-content-neutral-500 shrink-0">
            Local SQLite • Embedded Storage
          </span>
        </div>
      </section>

      {/* Main Knowledge Base Section */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-content-neutral-900">
              Frequently Asked Questions & Workflow Reference
            </h3>
            <p className="text-xs text-content-neutral-500 mt-0.5">
              Select a category or search terms above to find detailed guidance.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? "bg-accent text-white"
                      : "bg-surface-tinted text-content-neutral-600 hover:text-content-neutral-900 hover:bg-surface-tinted/80"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {filteredFAQs.length === 0 ? (
            <div className="ui-card p-12 text-center rounded-2xl border border-dashed border-line-neutral-300 space-y-3">
              <HelpCircle className="w-8 h-8 text-content-neutral-400 mx-auto" />
              <h4 className="text-sm font-semibold text-content-neutral-800">
                No matching answers found
              </h4>
              <p className="text-xs text-content-neutral-500 max-w-sm mx-auto">
                No articles matched &ldquo;{searchQuery}&rdquo;. Try another term or
                switch categories.
              </p>
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
              >
                Reset Search Filters
              </Button>
            </div>
          ) : (
            filteredFAQs.map((faq) => {
              const isOpen = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`ui-card rounded-xl border transition-all ${
                    isOpen
                      ? "border-line-purple-300 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] bg-surface"
                      : "border-line-neutral-200/80 bg-surface hover:border-line-neutral-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full p-4.5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <span className="text-sm font-semibold text-content-neutral-900">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-content-neutral-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-accent" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4.5 pb-4.5 pt-1 border-t border-line-neutral-100/70 text-xs text-content-neutral-600 leading-relaxed space-y-3">
                      <p>{faq.answer}</p>
                      {faq.actionHref && (
                        <div className="pt-2">
                          <Link
                            href={faq.actionHref}
                            className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                          >
                            <span>{faq.actionText || "Learn more"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* External Project Resources and Repository */}
      <section className="ui-card p-6 md:p-8 rounded-2xl border border-line-neutral-200/80 bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h3 className="text-base font-semibold text-content-neutral-900">
              BillFlow Open-Source & Project Resources
            </h3>
          </div>
          <p className="text-xs text-content-neutral-600 leading-relaxed">
            Need setup instructions, developer documentation, or want to contribute?
            Check our GitHub repository or submit an issue directly to the team.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <a
            href="https://github.com/Akatsuki-61/BillFlow#readme"
            target="_blank"
            rel="noreferrer"
            className="ui-button ui-button--secondary text-xs font-semibold flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Project Guide</span>
            <ExternalLink className="w-3 h-3 text-content-neutral-400" />
          </a>

          <a
            href="https://github.com/Akatsuki-61/BillFlow/issues"
            target="_blank"
            rel="noreferrer"
            className="ui-button ui-button--primary text-xs font-semibold flex items-center gap-1.5"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Feedback & Issues</span>
            <ExternalLink className="w-3 h-3 text-white/80" />
          </a>
        </div>
      </section>
    </div>
  );
}
