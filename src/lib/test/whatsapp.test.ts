import { describe, it, expect } from "vitest";
import {
  normalizeWhatsAppPhone,
  buildContractorWhatsAppMessage,
  generateWhatsAppLink,
  createWhatsAppPayloadFromWorkOrder,
  generateInvoiceWhatsAppLink,
  generateInvoiceEmailLink,
  buildOverduePaymentReminderMessage,
  generateWhatsAppReminderLink,
} from "../whatsapp";
import type { WorkOrderItem } from "@/types/outsourcing";

describe("Contractor WhatsApp Integration", () => {
  it("normalizes phone numbers to standard international digits", () => {
    expect(normalizeWhatsAppPhone("+94 77 123 4567")).toBe("94771234567");
    expect(normalizeWhatsAppPhone("0771234567")).toBe("94771234567");
    expect(normalizeWhatsAppPhone("+1 (555) 234-5678")).toBe("15552345678");
    expect(normalizeWhatsAppPhone("")).toBe("");
    expect(normalizeWhatsAppPhone(null)).toBe("");
  });

  it("builds a structured, human-readable WhatsApp message", () => {
    const message = buildContractorWhatsAppMessage({
      contractorName: "Sarah Jenkins",
      contractorPhone: "+94771234567",
      taskTitle: "Frontend Dashboard Implementation",
      scope: "Implement responsive Kanban board with drag-and-drop",
      feeFormatted: "Rs. 45,000.00",
      dueDate: "2026-11-15",
      deliveryUrl: "https://github.com/acme/project",
      invoiceCode: "INV-2026-001",
      clientName: "Acme Corp",
      voucherNumber: "WO1234AB",
      freelancerName: "Chethaka",
    });

    expect(message).toContain("Hi Sarah Jenkins, here are the details for your assigned deliverable:");
    expect(message).toContain("*Deliverable:* Frontend Dashboard Implementation");
    expect(message).toContain("*Scope of Work:* Implement responsive Kanban board with drag-and-drop");
    expect(message).toContain("*Agreed Fee:* Rs. 45,000.00");
    expect(message).toContain("*Target Deadline:* 2026-11-15");
    expect(message).toContain("*Deliverable URL / Repository:* https://github.com/acme/project");
    expect(message).toContain("Voucher #WO1234AB");
    expect(message).toContain("Acme Corp");
    expect(message).toContain("— Chethaka");
  });

  it("generates wa.me link with encoded text", () => {
    const link = generateWhatsAppLink({
      contractorName: "Dev",
      contractorPhone: "+94 77 999 8888",
      taskTitle: "API Service",
      scope: "Build auth endpoint",
      feeFormatted: "$500.00",
      voucherNumber: "V123",
    });

    expect(link.startsWith("https://wa.me/94779998888?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Hi Dev");
    expect(decodeURIComponent(link)).toContain("$500.00");
  });

  it("creates payload accurately from a WorkOrderItem", () => {
    const dummyWo: WorkOrderItem = {
      id: "wo-9876543210abcdef",
      vendorId: "v-1",
      vendorName: "Kasun Silva",
      vendorPhone: "0712345678",
      taskId: "t-1",
      taskTitle: "Database Migration",
      invoiceId: "inv-1",
      invoiceCode: "INV-100",
      clientName: "Global Tech",
      scope: "Migrate SQLite schema",
      feeCents: 3000000,
      currency: "LKR",
      dueDate: "2026-11-20",
      status: "todo",
      deliveryUrl: "https://drive.google.com/drive/folders/test",
    };

    const payload = createWhatsAppPayloadFromWorkOrder(dummyWo, "Chethaka");
    expect(payload.contractorName).toBe("Kasun Silva");
    expect(payload.contractorPhone).toBe("0712345678");
    expect(payload.feeFormatted).toBe("Rs. 30,000.00");
    expect(payload.voucherNumber).toBe("10ABCDEF");
    expect(payload.freelancerName).toBe("Chethaka");
  });

  it("builds and encodes invoice WhatsApp message and link", () => {
    const link = generateInvoiceWhatsAppLink({
      clientName: "Alice Cooper",
      clientPhone: "0771234567",
      invoiceCode: "SE-2026-002",
      totalFormatted: "$1,500.00",
      advanceFormatted: "$750.00",
      balanceFormatted: "$1,500.00",
      dueDate: "2026-11-11",
      deliveryUrl: "https://github.com/client/repo",
      paymentDetails: "Commercial Bank A/C 12345678",
      businessName: "Chethaka Lakshitha",
    });

    expect(link.startsWith("https://wa.me/94771234567?text=")).toBe(true);
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain("Hi Alice Cooper");
    expect(decoded).toContain("SE-2026-002");
    expect(decoded).toContain("$1,500.00");
    expect(decoded).toContain("$750.00");
    expect(decoded).toContain("Commercial Bank A/C 12345678");
  });

  it("generates mailto link for invoice", () => {
    const mailto = generateInvoiceEmailLink({
      clientEmail: "alice@example.com",
      clientName: "Alice",
      invoiceCode: "INV-500",
      totalFormatted: "$800.00",
      balanceFormatted: "$800.00",
      businessName: "Studio X",
    });

    expect(mailto.startsWith("mailto:alice@example.com?subject=")).toBe(true);
    const decoded = decodeURIComponent(mailto);
    expect(decoded).toContain("Invoice INV-500 from Studio X");
    expect(decoded).toContain("Total Amount: $800.00");
  });

  describe("Overdue Invoice WhatsApp Reminder Integration", () => {
    it("builds polite, professional payment reminder message with all invoice parameters", () => {
      const msg = buildOverduePaymentReminderMessage({
        clientName: "Nimal Perera",
        clientPhone: "+94 77 123 4567",
        invoiceCode: "INV-2026-001",
        amountDueFormatted: "Rs. 45,000.00",
        dueDate: "2026-10-15",
        daysOverdue: 21,
        freelancerName: "Chethaka",
        deliveryUrl: "https://staging.lankaretail.lk",
        paymentInstructions: "Commercial Bank A/C 12345678",
      });

      expect(msg).toContain("Hi Nimal Perera");
      expect(msg).toContain("*INV-2026-001*");
      expect(msg).toContain("21 days past due");
      expect(msg).toContain("*Outstanding Balance Due:* Rs. 45,000.00");
      expect(msg).toContain("https://staging.lankaretail.lk");
      expect(msg).toContain("Commercial Bank A/C 12345678");
      expect(msg).toContain("— Chethaka");
    });

    it("generates wa.me link with normalized client phone number", () => {
      const link = generateWhatsAppReminderLink({
        clientName: "Alice",
        clientPhone: "0771234567",
        invoiceCode: "INV-500",
        amountDueFormatted: "$1,200.00",
        daysOverdue: 10,
      });

      expect(link.startsWith("https://wa.me/94771234567?text=")).toBe(true);
      expect(decodeURIComponent(link)).toContain("INV-500");
      expect(decodeURIComponent(link)).toContain("$1,200.00");
    });
  });
});
