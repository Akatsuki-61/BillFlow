import type { ClientWithStats, InvoiceWithClient } from "@/types/billing";
import type { TaskItem } from "@/types/tasks";
import type { WorkOrderItem } from "@/types/outsourcing";

/**
 * Normalizes and formats an external URL.
 * Automatically prepends 'https://' if no protocol is present.
 */
export function formatExternalUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (/^(https?:\/\/|mailto:|file:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  // Prepend https:// if protocol is missing
  return `https://${trimmed}`;
}

/**
 * Opens an external URL safely in a new browser tab or via Electron handler.
 */
export function openExternalLink(url?: string | null, e?: React.MouseEvent): void {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  const formatted = formatExternalUrl(url);
  if (!formatted) return;

  if (typeof window !== "undefined") {
    window.open(formatted, "_blank", "noopener,noreferrer");
  }
}

export interface ResolvedDeliveryLink {
  url: string;
  formattedUrl: string;
  source: "direct" | "task" | "invoice" | "client" | "none";
  label: string;
  hasLink: boolean;
}

/**
 * Resolves job delivery link across views with fallback chain:
 * Target Direct URL -> Task URL -> Invoice URL -> Client Drive URL
 */
export function resolveDeliveryUrl(
  entity: {
    deliveryUrl?: string | null;
    driveUrl?: string | null;
    taskId?: string | null;
    invoiceId?: string | null;
    clientId?: string | null;
  },
  context?: {
    clients?: ClientWithStats[];
    invoices?: InvoiceWithClient[];
    tasks?: TaskItem[];
    workOrders?: WorkOrderItem[];
  }
): ResolvedDeliveryLink {
  // 1. Direct entity deliveryUrl or driveUrl (for Client)
  if (entity.deliveryUrl && entity.deliveryUrl.trim()) {
    const raw = entity.deliveryUrl.trim();
    return {
      url: raw,
      formattedUrl: formatExternalUrl(raw),
      source: "direct",
      label: "Deliverable Link",
      hasLink: true,
    };
  }

  if (entity.driveUrl && entity.driveUrl.trim()) {
    const raw = entity.driveUrl.trim();
    return {
      url: raw,
      formattedUrl: formatExternalUrl(raw),
      source: "client",
      label: "Client Drive Folder",
      hasLink: true,
    };
  }

  // 2. Task lookup (if entity is Work Order linked to a Task)
  if (entity.taskId && context?.tasks) {
    const linkedTask = context.tasks.find((t) => t.id === entity.taskId);
    if (linkedTask?.deliveryUrl && linkedTask.deliveryUrl.trim()) {
      const raw = linkedTask.deliveryUrl.trim();
      return {
        url: raw,
        formattedUrl: formatExternalUrl(raw),
        source: "task",
        label: "Sprint Task Link",
        hasLink: true,
      };
    }
  }

  // 3. Invoice lookup (if entity is Task or Work Order linked to an Invoice)
  const invId =
    entity.invoiceId ||
    (entity.taskId &&
      context?.tasks?.find((t) => t.id === entity.taskId)?.invoiceId);
  if (invId && context?.invoices) {
    const linkedInvoice = context.invoices.find((i) => i.id === invId);
    if (linkedInvoice?.deliveryUrl && linkedInvoice.deliveryUrl.trim()) {
      const raw = linkedInvoice.deliveryUrl.trim();
      return {
        url: raw,
        formattedUrl: formatExternalUrl(raw),
        source: "invoice",
        label: "Invoice Delivery Link",
        hasLink: true,
      };
    }
    // Check if linked invoice has embedded client driveUrl
    if (
      linkedInvoice?.client?.driveUrl &&
      linkedInvoice.client.driveUrl.trim()
    ) {
      const raw = linkedInvoice.client.driveUrl.trim();
      return {
        url: raw,
        formattedUrl: formatExternalUrl(raw),
        source: "client",
        label: "Client Drive Folder",
        hasLink: true,
      };
    }
  }

  // 4. Client lookup (by clientId)
  const clId =
    entity.clientId ||
    (invId && context?.invoices?.find((i) => i.id === invId)?.clientId) ||
    (entity.taskId &&
      context?.tasks?.find((t) => t.id === entity.taskId)?.clientId);

  if (clId && context?.clients) {
    const linkedClient = context.clients.find((c) => c.id === clId);
    if (linkedClient?.driveUrl && linkedClient.driveUrl.trim()) {
      const raw = linkedClient.driveUrl.trim();
      return {
        url: raw,
        formattedUrl: formatExternalUrl(raw),
        source: "client",
        label: "Client Drive Folder",
        hasLink: true,
      };
    }
  }

  return {
    url: "",
    formattedUrl: "",
    source: "none",
    label: "No Delivery Link",
    hasLink: false,
  };
}
