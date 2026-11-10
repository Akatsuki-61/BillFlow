import type { InvoiceWithClient, Client } from "@/types/billing";
import type { AppSettings } from "@/types/settings";
import type { ResolvedDeliveryLink } from "@/lib/deliveryUrl";

export interface InvoiceTemplateProps {
  invoice: InvoiceWithClient;
  client?: Client;
  clients: Client[];
  settings: AppSettings | null;
  delivery: ResolvedDeliveryLink;
  businessName: string;
  professionalTitle: string;
  openExternalLink: (url: string) => void;
  formatMoney: (cents: number, currency: string) => string;
  formatDate: (dateStr: string) => string;
}
