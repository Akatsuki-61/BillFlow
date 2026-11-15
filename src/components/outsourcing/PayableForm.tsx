"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { PhoneField } from "@/components/ui/PhoneField";
import { Button } from "@/components/ui/Workspace";
import {
  useActiveCurrency,
  useVendors,
  useWorkOrders,
} from "@/lib/data/DataProvider";
import { formatCents } from "@/lib/format";
import { payableAmount } from "@/lib/payable-math";
import type { Currency } from "@/types/billing";
import type { PayableVendor, WorkOrderItem } from "@/types/outsourcing";

const toCents = (amount: string) => Math.round(Number(amount) * 100);

type Row = { id: string; description: string; quantity: string; price: string };
const blankVendor: PayableVendor = {
  name: "",
  service: "",
  email: "",
  phone: "",
  billingAddress: "",
};

export function PayableForm({
  order,
  onClose,
  onSave,
}: {
  order?: WorkOrderItem;
  onClose: () => void;
  onSave: (order: WorkOrderItem) => void;
}) {
  const { vendors } = useVendors();
  const { createWorkOrder, updateWorkOrder } = useWorkOrders();
  const { activeCurrency } = useActiveCurrency();
  const [vendorId, setVendorId] = useState(order?.vendorId ?? "");
  const [vendor, setVendor] = useState(order?.vendorSnapshot ?? blankVendor);
  const [scope, setScope] = useState(order?.scope ?? "");
  const [currency, setCurrency] = useState(order?.currency ?? activeCurrency);
  const [due, setDue] = useState(order?.payoutDueDate ?? "");
  const [paypal, setPaypal] = useState(order?.paypalUrl ?? "");
  const [stripe, setStripe] = useState(order?.stripeUrl ?? "");
  const [discount, setDiscount] = useState(
    ((order?.discountCents ?? 0) / 100).toFixed(2),
  );
  const [flatFee, setFlatFee] = useState(
    order ? (order.feeCents / 100).toFixed(2) : "",
  );
  const [useItems, setUseItems] = useState(
    Boolean(order?.items?.length) || !order,
  );
  const [rows, setRows] = useState<Row[]>(
    () =>
      order?.items?.map((item) => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: String(item.quantity),
        price: (item.unitPriceCents / 100).toFixed(2),
      })) ?? [{ id: "first", description: "", quantity: "1", price: "" }],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const items = rows.map((row) => ({
    description: row.description.trim(),
    quantity: Number(row.quantity),
    unitPriceCents: toCents(row.price),
  }));
  const discountCents = useItems ? toCents(discount) : 0;
  const total = (() => {
    try {
      return useItems ? payableAmount(items, discountCents) : toCents(flatFee);
    } catch {
      return null;
    }
  })();
  const editRow = (id: string, patch: Partial<Row>) =>
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const editVendor = (patch: Partial<PayableVendor>) =>
    setVendor((previous) => ({ ...previous, ...patch }));

  return (
    <Dialog onClose={onClose} width={760}>
      <form
        className="app-dialog-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const common = {
              scope,
              currency,
              payoutDueDate: due || null,
              items: useItems ? items : null,
              discountCents,
              feeCents: useItems
                ? payableAmount(items, discountCents)
                : toCents(flatFee),
              paypalUrl: paypal || null,
              stripeUrl: stripe || null,
            };
            const vendorSnapshot = {
              name: vendor.name.trim(),
              service: vendor.service?.trim() || null,
              phone: vendor.phone?.trim() || null,
              email: vendor.email?.trim() || null,
              billingAddress: vendor.billingAddress?.trim() || null,
            };
            const saved = order
              ? await updateWorkOrder(order.id, {
                  ...common,
                  ...(!order.vendorId && { vendorSnapshot }),
                })
              : await createWorkOrder({
                  ...common,
                  ...(vendorId ? { vendorId } : { vendorSnapshot }),
                });
            onSave(saved);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not save the payable.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="app-dialog-header">
          <h3>{order ? "Edit payable" : "New payable"}</h3>
        </div>
        <div className="app-dialog-body">
          <div className="app-dialog-section space-y-4 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium">
                <span>Description</span>
                <input
                  className="ui-field w-full"
                  required
                  maxLength={500}
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                />
              </label>
              {!order && (
                <label className="space-y-1 text-xs font-medium">
                  <span>Vendor</span>
                  <select
                    className="ui-field w-full"
                    value={vendorId}
                    onChange={(event) => setVendorId(event.target.value)}
                  >
                    <option value="">One-time vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {!vendorId && (
              <fieldset className="grid gap-3 rounded-lg border border-line-neutral-200 p-3 sm:grid-cols-2">
                <legend className="px-1 text-xs font-semibold">
                  One-time vendor details
                </legend>
                <label className="space-y-1 text-xs">
                  <span>Vendor name</span>
                  <input
                    className="ui-field w-full"
                    required
                    maxLength={120}
                    value={vendor.name}
                    onChange={(event) =>
                      editVendor({ name: event.target.value })
                    }
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span>Email</span>
                  <input
                    className="ui-field w-full"
                    type="email"
                    maxLength={120}
                    value={vendor.email ?? ""}
                    onChange={(event) =>
                      editVendor({ email: event.target.value })
                    }
                  />
                </label>
                <PhoneField
                  label="Vendor phone"
                  value={vendor.phone ?? ""}
                  onChange={(phone) => editVendor({ phone })}
                />
                <label className="space-y-1 text-xs">
                  <span>Billing address</span>
                  <textarea
                    className="ui-field w-full"
                    rows={2}
                    maxLength={1000}
                    value={vendor.billingAddress ?? ""}
                    onChange={(event) =>
                      editVendor({ billingAddress: event.target.value })
                    }
                  />
                </label>
              </fieldset>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span>Currency</span>
                <select
                  className="ui-field w-full"
                  value={currency}
                  disabled={Boolean(order?.payouts?.length)}
                  onChange={(event) =>
                    setCurrency(event.target.value as Currency)
                  }
                >
                  {["USD", "LKR", "EUR", "GBP", "CAD"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span>Scheduled payout date</span>
                <input
                  className="ui-field w-full"
                  type="date"
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs">
                <span>PayPal payment link</span>
                <input
                  className="ui-field w-full"
                  type="url"
                  placeholder="https://"
                  value={paypal}
                  onChange={(event) => setPaypal(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs">
                <span>Stripe payment link</span>
                <input
                  className="ui-field w-full"
                  type="url"
                  placeholder="https://"
                  value={stripe}
                  onChange={(event) => setStripe(event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 border-t border-line-neutral-200 pt-3 text-xs font-medium">
              <input
                type="checkbox"
                checked={useItems}
                onChange={(event) => setUseItems(event.target.checked)}
              />
              Itemize payable
            </label>
            {useItems ? (
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_auto] items-end gap-2"
                  >
                    <label className="space-y-1 text-xs">
                      <span>Item {index + 1}</span>
                      <input
                        className="ui-field w-full"
                        value={row.description}
                        required
                        maxLength={500}
                        onChange={(event) =>
                          editRow(row.id, { description: event.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>Quantity</span>
                      <input
                        className="ui-field w-full"
                        value={row.quantity}
                        type="number"
                        min="1"
                        step="1"
                        required
                        onChange={(event) =>
                          editRow(row.id, { quantity: event.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span>Unit price</span>
                      <input
                        className="ui-field w-full"
                        value={row.price}
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        onChange={(event) =>
                          editRow(row.id, { price: event.target.value })
                        }
                      />
                    </label>
                    <Button
                      variant="ghost"
                      size="small"
                      disabled={rows.length === 1}
                      onClick={() =>
                        setRows((previous) =>
                          previous.filter((item) => item.id !== row.id),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      setRows((previous) => [
                        ...previous,
                        {
                          id: crypto.randomUUID(),
                          description: "",
                          quantity: "1",
                          price: "",
                        },
                      ])
                    }
                  >
                    Add line item
                  </Button>
                  <label className="space-y-1 text-xs">
                    <span className="block">Discount ({currency})</span>
                    <input
                      className="ui-field w-32"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="block space-y-1 text-xs">
                <span className="block">Flat fee ({currency})</span>
                <input
                  className="ui-field w-40"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={flatFee}
                  onChange={(event) => setFlatFee(event.target.value)}
                />
              </label>
            )}
            <p className="text-sm font-semibold">
              Total {total === null ? "—" : formatCents(total, currency)}
            </p>
            {error && (
              <p role="alert" className="text-xs text-content-rose-700">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="app-dialog-footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={busy || total === null}
          >
            Save payable
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
