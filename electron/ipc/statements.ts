import { dialog } from "electron";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { clients, vendors } from "../db/schema";
import { atomicWrite } from "../managed-files";
import { printLocalPdf } from "../pdf-generator";
import { escapeHtml } from "../pdf-templates/helpers";
import { ipcMain } from "../security";
import { captureWorkspace } from "../workspace-session";
import { recordId } from "../workflow-validation";
import { localDateKey } from "../../src/lib/visual-metrics";
import { listInvoicesWithClient } from "./invoices";
import { listWorkOrders } from "./workOrders";
import { getOrCreateSettings } from "./settings";
import { AppError, formatError } from "./errors";

type StatementRow = {
  code: string;
  date: string;
  description: string;
  currency: string;
  amount: number;
  paid: number;
  balance: number;
  payments: Array<{ date: string; amount: number; reference?: string }>;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function statementHtml(
  recipient: string,
  business: string,
  kind: "Client" | "Vendor",
  records: StatementRow[],
) {
  const totals = new Map<
    string,
    { amount: number; paid: number; balance: number }
  >();
  for (const record of records) {
    const total = totals.get(record.currency) ?? {
      amount: 0,
      paid: 0,
      balance: 0,
    };
    total.amount += record.amount;
    total.paid += record.paid;
    total.balance += record.balance;
    totals.set(record.currency, total);
  }
  const heading = kind === "Client" ? "Invoices" : "Work orders";
  const paymentHeading =
    kind === "Client" ? "Payments received" : "Payouts recorded";
  const table = (headers: string[], rows: string[][], numericColumns = 0) => {
    if (!rows.length) return '<p class="empty">No records.</p>';
    const alignment = (index: number) =>
      index >= headers.length - numericColumns ? ' class="number"' : "";
    return `<table><thead><tr>${headers.map((h, index) => `<th scope="col"${alignment(index)}>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td${alignment(index)}>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };
  const ordered = [...records].sort(
    (a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${kind} statement</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;color:#14293b;font:10pt system-ui,sans-serif;-webkit-print-color-adjust:exact}
      header{border-top:5px solid #14786b;padding:20px 0 14px;margin-bottom:22px;border-bottom:1px solid #cfdcda}
      h1{font-size:26pt;margin:4px 0 8px;line-height:1.1}
      h2{font-size:13pt;margin:22px 0 8px;break-after:avoid}
      p{margin:3px 0;color:#435665;overflow-wrap:anywhere}
      table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
      thead{display:table-header-group}
      tr{break-inside:avoid}
      th,td{padding:7px 8px;text-align:left;vertical-align:top;border-bottom:1px solid #d8e2e3;overflow-wrap:anywhere}
      th{background:#eaf3f1;color:#174b44;font-size:9pt}
      .number{text-align:right;white-space:nowrap}
      .empty{font-style:italic}
    </style></head><body>
    <header><p>${escapeHtml(business || "BillFlow")}</p><h1>${kind} statement</h1>
    <p><strong>${escapeHtml(recipient)}</strong></p><p>As of ${localDateKey()}</p></header>
    <h2>Balances by currency</h2>
    ${table(
      [
        "Currency",
        kind === "Client" ? "Invoiced" : "Agreed fees",
        "Paid",
        "Outstanding",
      ],
      [...totals]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, total]) => [
          currency,
          money(total.amount),
          money(total.paid),
          money(total.balance),
        ]),
      3,
    )}
    <h2>${heading}</h2>
    ${table(
      [
        "Reference",
        kind === "Client" ? "Issue date" : "Payout due",
        "Description",
        "Currency",
        "Amount",
        "Paid",
        "Balance",
      ],
      ordered.map((r) => [
        r.code,
        r.date,
        r.description,
        r.currency,
        money(r.amount),
        money(r.paid),
        money(r.balance),
      ]),
      3,
    )}
    <h2>${paymentHeading}</h2>
    ${table(
      ["Reference", "Payment date", "Payment reference", "Currency", "Amount"],
      ordered.flatMap((record) =>
        record.payments.map((p) => [
          record.code,
          p.date,
          p.reference || "",
          record.currency,
          money(p.amount),
        ]),
      ),
      1,
    )}
    </body></html>`;
}

async function exportStatement(kind: "Client" | "Vendor", input: string) {
  const id = recordId.parse(input);
  const workspace = captureWorkspace();
  const { name, rows, business } = getDb().transaction((tx) => {
    const business = getOrCreateSettings().businessName;
    if (kind === "Client") {
      const client = tx.select().from(clients).where(eq(clients.id, id)).get();
      if (!client) throw new AppError("NOT_FOUND", "Client not found.");
      const rows = listInvoicesWithClient(id)
        .filter((i) => i.status !== "DRAFT")
        .map((i): StatementRow => ({
          code: i.code,
          date: i.issueDate.slice(0, 10),
          description: i.title || "",
          currency: i.currency,
          amount: i.amountCents,
          paid: i.paidCents,
          balance: Math.max(0, i.amountCents - i.paidCents),
          payments: (i.payments ?? [])
            .filter((p) => !p.correction)
            .map((p) => ({
              date: p.receivedAt.slice(0, 10),
              amount: p.amountCents,
              reference: p.reference,
            })),
        }));
      return { name: client.name, rows, business };
    }
    const vendor = tx.select().from(vendors).where(eq(vendors.id, id)).get();
    if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.");
    const rows = listWorkOrders({ vendorId: id }).map(
      (order): StatementRow => ({
        code: `VND-INV-${order.id.slice(-8).toUpperCase()}`,
        date: order.payoutDueDate ?? "",
        description: order.taskTitle || order.scope,
        currency: order.currency,
        amount: order.feeCents,
        paid: order.payoutAmountCents ?? 0,
        balance: order.remainingPayoutCents ?? order.feeCents,
        payments: (order.payouts ?? [])
          .filter((p) => !p.voidedAt)
          .map((p) => ({ date: p.paidAt.slice(0, 10), amount: p.amountCents })),
      }),
    );
    return { name: vendor.name, rows, business };
  });

  const result = await dialog.showSaveDialog({
    title: `Save ${kind} Statement`,
    defaultPath: `${kind}-Statement-${name.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 70)}.pdf`,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  });
  workspace.assertCurrent();
  if (result.canceled || !result.filePath)
    return { success: false, canceled: true };
  const pdf = await printLocalPdf(
    statementHtml(name, business, kind, rows),
    0.55,
  );
  workspace.assertCurrent();
  atomicWrite(result.filePath, pdf);
  return { success: true, filePath: result.filePath };
}

export function registerStatementHandlers() {
  for (const [channel, kind] of [
    ["clients:statement", "Client"],
    ["vendors:statement", "Vendor"],
  ] as const) {
    ipcMain.handle(channel, async (_event, id: string) => {
      try {
        return await exportStatement(kind, id);
      } catch (error) {
        throw formatError(error);
      }
    });
  }
}
