import type { PayableItem } from "../types/outsourcing";

export function payableAmount(items: PayableItem[], discountCents = 0) {
  let subtotal = 0;
  for (const item of items) {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      !Number.isSafeInteger(item.unitPriceCents) ||
      item.unitPriceCents < 0
    )
      throw new Error("Use a positive whole quantity and a valid unit price.");
    subtotal += item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(subtotal))
      throw new Error("Payable subtotal is too large.");
  }
  if (
    !Number.isSafeInteger(discountCents) ||
    discountCents < 0 ||
    discountCents > subtotal
  )
    throw new Error("Discount must be between zero and the subtotal.");
  return subtotal - discountCents;
}
