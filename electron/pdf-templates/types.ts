export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface InvoicePdfPayload {
  code: string;
  issueDate: string;
  dueDate?: string | null;
  currency: string;
  status: string;
  template?: "geometric-teal" | "executive-wave" | "scarlet-modern" | string;
  items: InvoicePdfItem[];
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  amountCents: number;
  paidCents?: number;
  deliveryUrl?: string | null;
  notes?: string | null;
  client: {
    name: string;
    email?: string;
    contactPerson?: string;
    phone?: string;
    driveUrl?: string | null;
  };
  business: {
    businessName?: string | null;
    professionalTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    taxId?: string | null;
    paymentDetails?: string | null;
  };
}
