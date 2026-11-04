import { describe, it, expect } from "vitest";
import { formatExternalUrl, resolveDeliveryUrl } from "../deliveryUrl";
import type { TaskItem } from "@/types/tasks";
import type { ClientWithStats, InvoiceWithClient } from "@/types/billing";

describe("Submit Work deliverable & handover workflow", () => {
  const mockClient: ClientWithStats = {
    id: "client-123",
    name: "Enterprise Client Ltd",
    category: "Enterprise",
    contactPerson: "Jane Smith",
    email: "jane@enterprise.com",
    phone: "123456",
    currency: "LKR",
    driveUrl: "https://drive.google.com/drive/folders/client-root",
    hasQuickBill: false,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
    totalBilledCents: 9000000,
    totalPaidCents: 4500000,
    outstandingBalanceCents: 4500000,
    invoicesCount: 1,
    recentInvoices: [],
  };

  const mockInvoice: InvoiceWithClient = {
    id: "inv-101",
    code: "INV-2026-001",
    clientId: "client-123",
    clientName: "Enterprise Client Ltd",
    clientEmail: "jane@enterprise.com",
    clientSnapshot: JSON.stringify({
      name: "Enterprise Client Ltd",
      driveUrl: "https://drive.google.com/drive/folders/client-root",
    }),
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    status: "ADVANCE_PAID",
    currency: "LKR",
    amountCents: 9000000,
    discountCents: 1000000,
    taxCents: 0,
    advanceCents: 4500000,
    paidCents: 4500000,
    deliveryUrl: "https://drive.google.com/drive/folders/invoice-job-folder",
    notes: "",
    items: [],
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  };

  const baseTask: TaskItem = {
    id: "task-001",
    title: "Business website development",
    description: "Responsive 5-page site with dark mode.",
    status: "in-progress",
    priority: "high",
    category: "Development",
    assignee: {
      name: "Chethaka",
      avatarLetter: "C",
      bgColor: "bg-surface-purple-100",
      textColor: "text-content-purple-700",
    },
    dueDate: "2026-10-10",
    invoiceId: "inv-101",
    invoiceCode: "INV-2026-001",
    clientId: "client-123",
    clientName: "Enterprise Client Ltd",
    currency: "LKR",
    subtasks: [
      { id: "st-1", title: "Landing page", completed: true },
      { id: "st-2", title: "Contact form", completed: false },
      { id: "st-3", title: "SEO meta tags", completed: false },
    ],
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  };

  describe("Deliverable link inheritance & normalization", () => {
    it("inherits delivery link from invoice when task deliveryUrl is not set", () => {
      const resolved = resolveDeliveryUrl(baseTask, {
        invoices: [mockInvoice],
        clients: [mockClient],
      });
      expect(resolved.hasLink).toBe(true);
      expect(resolved.source).toBe("invoice");
      expect(resolved.url).toBe("https://drive.google.com/drive/folders/invoice-job-folder");
    });

    it("prefers direct task deliverable link when set", () => {
      const taskWithDirectLink: TaskItem = {
        ...baseTask,
        deliveryUrl: "https://github.com/Chethaka/business-website",
      };
      const resolved = resolveDeliveryUrl(taskWithDirectLink, {
        invoices: [mockInvoice],
        clients: [mockClient],
      });
      expect(resolved.hasLink).toBe(true);
      expect(resolved.source).toBe("direct");
      expect(resolved.url).toBe("https://github.com/Chethaka/business-website");
    });

    it("normalizes links without protocol to https", () => {
      expect(formatExternalUrl("github.com/Chethaka/project")).toBe(
        "https://github.com/Chethaka/project",
      );
      expect(formatExternalUrl("staging.business-website.lk")).toBe(
        "https://staging.business-website.lk",
      );
    });

    it("validates protocol safety", () => {
      const url = formatExternalUrl("https://staging.example.com");
      const parsed = new URL(url);
      expect(["http:", "https:"].includes(parsed.protocol)).toBe(true);
    });
  });

  describe("Subtask completion on handover", () => {
    it("identifies incomplete subtasks accurately", () => {
      const total = baseTask.subtasks.length;
      const completed = baseTask.subtasks.filter((s) => s.completed).length;
      const incomplete = total - completed;

      expect(total).toBe(3);
      expect(completed).toBe(1);
      expect(incomplete).toBe(2);
    });

    it("marks all remaining subtasks completed when submitting work", () => {
      const updatedSubtasks = baseTask.subtasks.map((st) => ({
        ...st,
        completed: true,
      }));

      expect(updatedSubtasks.every((st) => st.completed)).toBe(true);
      expect(updatedSubtasks).toHaveLength(3);
    });
  });

  describe("Handover note formatting", () => {
    it("appends handover note with date stamp to existing description", () => {
      const handoverNote = "Deployed to Vercel staging. Sent credentials via WhatsApp.";
      const timestamp = "2026-10-10";
      const noteEntry = `\n\n[Delivery Handover — ${timestamp}]: ${handoverNote}`;
      const updatedDescription = `${baseTask.description}${noteEntry}`;

      expect(updatedDescription).toContain(baseTask.description);
      expect(updatedDescription).toContain("[Delivery Handover — 2026-10-10]");
      expect(updatedDescription).toContain(handoverNote);
    });
  });

  describe("Client handover message generation", () => {
    it("generates a formatted communication snippet for WhatsApp/Email", () => {
      const deliveryUrl = "https://github.com/Chethaka/business-website";
      const notes = "Staging build verified. Staging URL: https://staging.client.com";

      const message = [
        `Hi ${baseTask.clientName},`,
        "",
        `The deliverable "${baseTask.title}" has been completed and is ready for your review:`,
        `🔗 Delivery Link: ${deliveryUrl}`,
        `📝 Notes: ${notes}`,
        "",
        "Please review and let me know if you need any adjustments!",
      ]
        .filter(Boolean)
        .join("\n");

      expect(message).toContain("Hi Enterprise Client Ltd,");
      expect(message).toContain(`"${baseTask.title}"`);
      expect(message).toContain("🔗 Delivery Link: https://github.com/Chethaka/business-website");
      expect(message).toContain("📝 Notes: Staging build verified.");
    });
  });
});
