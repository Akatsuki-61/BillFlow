export interface TourStep {
  id: string;
  title: string;
  body: string;
  route: string;
  targetSelector: string;
  shortcutHint?: string;
}

export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    id: "overview",
    title: "Connected Profit & Cashflow Loop",
    body: "Net profit subtracts operating expenses and settled subcontractor payouts from gross invoiced revenue, separated per currency.",
    route: "/",
    targetSelector: "[data-tour='nav-dashboard']",
    shortcutHint: "Cmd+1",
  },
  {
    id: "invoices",
    title: "Itemized Invoicing & Advance Deposits",
    body: "Pull rate cards from Catalog, set a deposit rule (such as 50%), and compile offline vector PDFs ready for WhatsApp or email dispatch.",
    route: "/invoices",
    targetSelector: "[data-tour='nav-invoices']",
    shortcutHint: "Cmd+2",
  },
  {
    id: "tasks",
    title: "Auto-Generated Kanban & Batch Billing",
    body: "Recording an advance deposit triggers a 5-second prompt to turn invoice items into Kanban cards. You can also batch-invoice completed Done cards.",
    route: "/tasks",
    targetSelector: "[data-tour='nav-tasks']",
    shortcutHint: "Cmd+7",
  },
  {
    id: "outsourcing",
    title: "Contractor Vouchers & Ledger Sync",
    body: "Delegate any Kanban task to a vendor with a VND-INV voucher. Marking the payout Paid logs the contractor cost in your profit ledger automatically.",
    route: "/outsourcing",
    targetSelector: "[data-tour='nav-outsourcing']",
    shortcutHint: "Cmd+6",
  },
  {
    id: "shortcuts",
    title: "Command Palette & Multi-Profile Workspaces",
    body: "Jump anywhere with Cmd+K, open quick creators with Alt+1..7 inside search, or press Cmd+/ anytime to view all keyboard shortcuts.",
    route: "/",
    targetSelector: "[data-tour='cmd-search']",
    shortcutHint: "Cmd+K",
  },
];

export interface QuickStartStep {
  id: "profile" | "client-or-catalog" | "invoice" | "task";
  label: string;
  href: string;
  done: boolean;
}

export function getQuickStartProgress(input: {
  businessName?: string | null;
  clientsCount: number;
  catalogCount: number;
  invoicesCount: number;
  tasksCount: number;
}): {
  steps: QuickStartStep[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
} {
  const steps: QuickStartStep[] = [
    {
      id: "profile",
      label: "Studio profile & payment info",
      href: "/settings?section=profile",
      done: Boolean(input.businessName && input.businessName.trim().length > 0),
    },
    {
      id: "client-or-catalog",
      label: "Add first client or rate card",
      href: input.clientsCount > 0 ? "/catalog?create=1" : "/clients?create=1",
      done: input.clientsCount > 0 || input.catalogCount > 0,
    },
    {
      id: "invoice",
      label: "Create first invoice",
      href: "/invoices?new=1",
      done: input.invoicesCount > 0,
    },
    {
      id: "task",
      label: "Track a sprint deliverable",
      href: "/tasks?create=1",
      done: input.tasksCount > 0,
    },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    isComplete: completedCount === steps.length,
  };
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;
type RemoveStorage = Pick<Storage, "removeItem">;

const tourKey = (profileId: string) =>
  `billflow_tour_completed_v1_${profileId || "default"}`;
const quickStartKey = (profileId: string) =>
  `billflow_quickstart_dismissed_v1_${profileId || "default"}`;

function resolveStorage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function isTourCompleted(
  profileId: string,
  storage: ReadStorage | null = resolveStorage(),
): boolean {
  try {
    return storage?.getItem(tourKey(profileId)) === "1";
  } catch {
    return false;
  }
}

export function markTourCompleted(
  profileId: string,
  storage: WriteStorage | null = resolveStorage(),
): void {
  try {
    storage?.setItem(tourKey(profileId), "1");
  } catch {
    // Storage unavailable
  }
}

export function resetTourCompleted(
  profileId: string,
  storage: RemoveStorage | null = resolveStorage(),
): void {
  try {
    storage?.removeItem(tourKey(profileId));
  } catch {
    // Storage unavailable
  }
}

export function isQuickStartDismissed(
  profileId: string,
  storage: ReadStorage | null = resolveStorage(),
): boolean {
  try {
    return storage?.getItem(quickStartKey(profileId)) === "1";
  } catch {
    return false;
  }
}

export function dismissQuickStart(
  profileId: string,
  storage: WriteStorage | null = resolveStorage(),
): void {
  try {
    storage?.setItem(quickStartKey(profileId), "1");
  } catch {
    // Storage unavailable
  }
}
