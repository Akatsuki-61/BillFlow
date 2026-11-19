import type { InvoiceWithClient, Client } from "@/types/billing";
import type { AppSettings } from "@/types/settings";
import type { ResolvedDeliveryLink } from "@/lib/deliveryUrl";

export type DocumentKind = "invoice" | "quote";

export function getTemplateDocumentLabels(documentKind?: DocumentKind) {
  const isQuote = documentKind === "quote";
  return {
    isQuote,
    title: isQuote ? "PROPOSAL" : "INVOICE",
    codeLabel: isQuote ? "Quote No.:" : "Invoice No.:",
    dueDateLabel: isQuote ? "Valid Until:" : "Due Date:",
    recipientHeading: isQuote ? "Prepared for:" : "Invoice to:",
    recipientHeadingUpper: isQuote ? "PREPARED FOR:" : "INVOICE TO:",
    recipientToPrefix: isQuote ? "Prepared for:" : "To:",
    totalLabel: isQuote ? "Estimated Total:" : "Total:",
    grandTotalLabel: isQuote ? "Estimated Total" : "Grand Total",
  };
}

export interface InvoiceTemplateProps {
  invoice: InvoiceWithClient;
  client?: Client;
  clients: Client[];
  settings: AppSettings | null;
  delivery: ResolvedDeliveryLink;
  businessName: string;
  professionalTitle: string;
  documentKind?: DocumentKind;
  openExternalLink: (url: string) => void;
  formatMoney: (cents: number, currency: string) => string;
  formatDate: (dateStr: string) => string;
}
