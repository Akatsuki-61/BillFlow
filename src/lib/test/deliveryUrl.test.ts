import { describe, it, expect } from "vitest";
import { formatExternalUrl, resolveDeliveryUrl } from "../deliveryUrl";
import type { ClientWithStats, InvoiceWithClient } from "@/types/billing";
import type { TaskItem } from "@/types/tasks";
import type { WorkOrderItem } from "@/types/outsourcing";

describe("deliveryUrl utility", () => {
  describe("formatExternalUrl", () => {
    it("returns empty string for null, undefined, or empty values", () => {
      expect(formatExternalUrl(null)).toBe("");
      expect(formatExternalUrl(undefined)).toBe("");
      expect(formatExternalUrl("   ")).toBe("");
    });

    it("preserves URLs with explicit http, https, or mailto protocols", () => {
      expect(formatExternalUrl("https://github.com/Chethaka/project")).toBe("https://github.com/Chethaka/project");
      expect(formatExternalUrl("http://localhost:3000")).toBe("http://localhost:3000");
      expect(formatExternalUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
    });

    it("automatically prepends https:// if protocol is missing", () => {
      expect(formatExternalUrl("github.com/Chethaka/project")).toBe("https://github.com/Chethaka/project");
      expect(formatExternalUrl("drive.google.com/drive/folders/123")).toBe("https://drive.google.com/drive/folders/123");
    });
  });

  describe("resolveDeliveryUrl", () => {
    const mockClient: ClientWithStats = {
      id: "client-1",
      name: "Acme Corp",
      category: "Enterprise",
      contactPerson: "Acme Contact",
      email: "contact@acme.com",
      phone: "123",
      currency: "LKR",
      driveUrl: "https://drive.google.com/drive/folders/acme-default",
      hasQuickBill: false,
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
      totalBilledCents: 100000,
      totalPaidCents: 50000,
      outstandingBalanceCents: 50000,
      invoicesCount: 1,
      recentInvoices: [],
    };

    const mockInvoice: InvoiceWithClient = {
      id: "inv-1",
      code: "INV-001",
      clientId: "client-1",
      clientName: "Acme Corp",
      clientEmail: "contact@acme.com",
      clientSnapshot: JSON.stringify({ name: "Acme Corp", driveUrl: "https://drive.google.com/drive/folders/acme-default" }),
      issueDate: "2026-10-01",
      dueDate: "2026-10-15",
      status: "ADVANCE_PAID",
      currency: "LKR",
      amountCents: 100000,
      discountCents: 0,
      taxCents: 0,
      advanceCents: 50000,
      paidCents: 50000,
      deliveryUrl: "https://github.com/Chethaka/acme-website-repo",
      notes: "",
      items: [],
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    };

    const mockTask: TaskItem = {
      id: "task-1",
      title: "Develop Business Website",
      description: "Website development task",
      status: "in-progress",
      priority: "high",
      category: "Development",
      assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "#000", textColor: "#fff" },
      dueDate: "2026-10-10",
      subtasks: [],
      invoiceId: "inv-1",
      clientId: "client-1",
      clientName: "Acme Corp",
      deliveryUrl: "https://staging.acme.lk",
      currency: "LKR",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    };

    const mockWorkOrder: WorkOrderItem = {
      id: "wo-1",
      vendorId: "vendor-1",
      vendorName: "Subcontractor Dev",
      taskId: "task-1",
      invoiceId: "inv-1",
      scope: "Build landing page",
      feeCents: 3000000,
      status: "in-progress",
      deliveryUrl: null,
      currency: "LKR",
      createdAt: "2026-10-01",
    };

    it("resolves direct delivery URL first when present", () => {
      const resolved = resolveDeliveryUrl(
        { deliveryUrl: mockTask.deliveryUrl },
        { tasks: [mockTask], invoices: [mockInvoice], clients: [mockClient] }
      );
      expect(resolved.hasLink).toBe(true);
      expect(resolved.url).toBe("https://staging.acme.lk");
      expect(resolved.source).toBe("direct");
    });

    it("falls back to task delivery URL when work order lacks a direct URL", () => {
      const resolved = resolveDeliveryUrl(
        { taskId: mockWorkOrder.taskId },
        { tasks: [mockTask], invoices: [mockInvoice], clients: [mockClient] }
      );
      expect(resolved.hasLink).toBe(true);
      expect(resolved.url).toBe("https://staging.acme.lk");
      expect(resolved.source).toBe("task");
    });

    it("falls back to invoice delivery URL when task lacks a direct URL", () => {
      const taskNoUrl = { ...mockTask, deliveryUrl: null };
      const resolved = resolveDeliveryUrl(
        { taskId: taskNoUrl.id, invoiceId: taskNoUrl.invoiceId },
        { tasks: [taskNoUrl], invoices: [mockInvoice], clients: [mockClient] }
      );
      expect(resolved.hasLink).toBe(true);
      expect(resolved.url).toBe("https://github.com/Chethaka/acme-website-repo");
      expect(resolved.source).toBe("invoice");
    });

    it("falls back to client driveUrl when invoice and task lack direct URLs", () => {
      const invNoUrl = { ...mockInvoice, deliveryUrl: null };
      const taskNoUrl = { ...mockTask, deliveryUrl: null };
      const resolved = resolveDeliveryUrl(
        { taskId: taskNoUrl.id, invoiceId: taskNoUrl.invoiceId, clientId: taskNoUrl.clientId },
        { tasks: [taskNoUrl], invoices: [invNoUrl], clients: [mockClient] }
      );
      expect(resolved.hasLink).toBe(true);
      expect(resolved.url).toBe("https://drive.google.com/drive/folders/acme-default");
      expect(resolved.source).toBe("client");
    });

    it("returns hasLink: false when no delivery URL exists anywhere in hierarchy", () => {
      const clientNoUrl = { ...mockClient, driveUrl: null };
      const invNoUrl = { ...mockInvoice, deliveryUrl: null, clientSnapshot: null };
      const taskNoUrl = { ...mockTask, deliveryUrl: null };
      const resolved = resolveDeliveryUrl(
        { taskId: taskNoUrl.id, invoiceId: taskNoUrl.invoiceId, clientId: taskNoUrl.clientId },
        { tasks: [taskNoUrl], invoices: [invNoUrl], clients: [clientNoUrl] }
      );
      expect(resolved.hasLink).toBe(false);
      expect(resolved.url).toBe("");
      expect(resolved.source).toBe("none");
    });
  });
});
