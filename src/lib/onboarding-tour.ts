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

export type TourStatus = "completed" | "dismissed";

const tourKey = (profileId: string) =>
  `billflow_tour_completed_v1_${profileId || "default"}`;

function resolveStorage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function getTourStatus(
  profileId: string,
  storage?: Pick<Storage, "getItem"> | null,
): TourStatus | null {
  try {
    const local = storage === undefined ? resolveStorage() : storage;
    const saved = local?.getItem(tourKey(profileId));
    if (saved === "1") return "completed";
    if (saved === "dismissed") return "dismissed";

    // The old checklist included the tour invitation. Honor its dismissal.
    const legacyDismissal = `billflow_quickstart_dismissed_v1_${profileId || "default"}`;
    return local?.getItem(legacyDismissal) === "1" ? "dismissed" : null;
  } catch {
    return null;
  }
}

export function saveTourStatus(
  profileId: string,
  status: TourStatus,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  try {
    const local = storage === undefined ? resolveStorage() : storage;
    local?.setItem(tourKey(profileId), status === "completed" ? "1" : status);
  } catch {
    // Storage unavailable. The current workspace session still updates.
  }
}
