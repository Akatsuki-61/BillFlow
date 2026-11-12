export interface InvoiceAmounts {
  amountCents: number;
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  items?: readonly { quantity: number; unitPriceCents: number }[];
}
export function validateInvoiceAmounts(input: InvoiceAmounts): number {
  const {
    amountCents,
    discountCents = 0,
    taxCents = 0,
    advanceCents = 0,
    items,
  } = input;
  if (
    ![amountCents, discountCents, taxCents, advanceCents].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    )
  )
    throw new Error(
      "Invoice amounts must be non-negative safe integer minor units.",
    );
  if (advanceCents > amountCents)
    throw new Error("Advance cannot exceed the invoice total.");
  if (items?.length) {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0,
    );
    if (
      !Number.isSafeInteger(subtotal) ||
      subtotal < discountCents ||
      !Number.isSafeInteger(subtotal - discountCents + taxCents)
    )
      throw new Error("Invoice subtotal or discount is invalid.");
    if (amountCents !== subtotal - discountCents + taxCents)
      throw new Error(
        "Invoice total does not match its line items, discount and tax.",
      );
  }
  return amountCents;
}
