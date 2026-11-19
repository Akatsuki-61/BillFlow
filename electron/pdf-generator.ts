import { randomUUID } from "node:crypto";
import { escapeHtml } from "./pdf-templates/helpers";
import * as electron from "electron";
import {
  buildInvoiceHtmlGeometricTeal,
  buildInvoiceHtmlExecutiveWave,
  buildInvoiceHtmlScarletModern,
  buildInvoiceHtmlApexOrange,
  buildInvoiceHtmlNoirCrimson,
  InvoicePdfPayload,
  InvoicePdfItem,
  formatMoney,
} from "./pdf-templates";

export type { InvoicePdfPayload, InvoicePdfItem };
export {
  buildInvoiceHtmlGeometricTeal,
  buildInvoiceHtmlExecutiveWave,
  buildInvoiceHtmlScarletModern,
  buildInvoiceHtmlApexOrange,
  buildInvoiceHtmlNoirCrimson,
};

export interface WorkOrderPdfPayload {
  voucherNumber: string;
  scope: string;
  feeCents: number;
  items?: InvoicePdfItem[] | null;
  discountCents?: number;
  paidCents?: number;
  payoutDueDate?: string | null;
  paypalUrl?: string | null;
  stripeUrl?: string | null;
  currency: string;
  status: string;
  payoutStatus: string;
  dueDate?: string | null;
  completedAt?: string | null;
  paidAt?: string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
  vendor: {
    name: string;
    billingAddress?: string | null;
    service?: string;
    email?: string | null;
    phone?: string | null;
  };
  task?: {
    title?: string;
    category?: string;
  };
  parentInvoice?: {
    code?: string;
    clientName?: string;
  };
  business: {
    businessName?: string | null;
    professionalTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
  };
}

export function buildInvoiceHtml(data: InvoicePdfPayload): string {
  const builder =
    data.template === "executive-wave"
      ? buildInvoiceHtmlExecutiveWave
      : data.template === "scarlet-modern"
        ? buildInvoiceHtmlScarletModern
        : data.template === "apex-orange"
          ? buildInvoiceHtmlApexOrange
          : data.template === "noir-crimson"
            ? buildInvoiceHtmlNoirCrimson
            : buildInvoiceHtmlGeometricTeal;
  let html = builder(data);
  const signature = data.business.signatureData;
  const validSignature =
    signature &&
    /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(signature);
  const supplement = `<section class="invoice-supplement" style="position:relative;z-index:3;margin:20px 36px;break-inside:avoid;font-size:11px">
    ${data.template === "noir-crimson" && data.client.billingAddress ? `<p><strong>Billing address</strong><br>${escapeHtml(data.client.billingAddress)}</p>` : ""}
    ${data.template === "noir-crimson" && data.paymentUrl ? `<p><a style="color:inherit;text-decoration:underline" href="${escapeHtml(data.paymentUrl)}">Payment link: ${escapeHtml(data.paymentUrl)}</a></p>` : ""}
    ${validSignature ? `<div><img alt="Authorized signature" src="${signature}" style="display:block;width:144px;height:44px;background:#fff;border-radius:4px;padding:4px;object-fit:contain"><small>Authorized signature</small></div>` : ""}
  </section>`;
  if (
    validSignature ||
    (data.template === "noir-crimson" &&
      (data.client.billingAddress || data.paymentUrl))
  ) {
    const footer =
      /<div class="(?:footer-row|footer-container|footer-bar|footer-contact|contact-footer)[^"]*"/;
    html = footer.test(html)
      ? html.replace(footer, (match) => supplement + match)
      : html.replace("</body>", () => `${supplement}</body>`);
  }
  if (data.items.length >= 10)
    html = html.replace("<body>", () => '<body data-invoice-pagination="true">');
  const printStyle = `<style data-invoice-print>@media print {
    table { break-inside:auto; } thead { display:table-header-group; }
    tr, .table-row { break-inside:avoid; page-break-inside:avoid; }
    .totals, .totals-section, .totals-wrapper, .summary-section, .totals-grid, .summary-grid, .invoice-supplement { break-inside:avoid; }
    body[data-invoice-pagination] { height:auto !important; min-height:1122px; max-height:none !important; overflow:visible !important; display:block !important; }
    body[data-invoice-pagination] .body-content, body[data-invoice-pagination] .doc-content, body[data-invoice-pagination] .main-content, body[data-invoice-pagination] .content, body[data-invoice-pagination] .page { height:auto !important; min-height:0 !important; overflow:visible !important; display:block !important; }
    body[data-invoice-pagination] .bottom-right-svg, body[data-invoice-pagination] .bottom-decoration, body[data-invoice-pagination] .bottom-shape, body[data-invoice-pagination] .footer-svg { display:none !important; }
    body[data-invoice-pagination] .footer-row, body[data-invoice-pagination] .footer-container, body[data-invoice-pagination] .footer-bar, body[data-invoice-pagination] .footer-contact, body[data-invoice-pagination] .contact-footer, body[data-invoice-pagination] .footer-content { position:relative !important; bottom:auto !important; height:auto !important; margin-top:24px !important; break-inside:avoid; }
  }</style>`;
  return html.replace("</head>", () => `${printStyle}</head>`);
}

const PDF_IDLE_DESTROY_MS = 30_000;
const PDF_RENDER_TIMEOUT_MS = 20_000;
const PDF_CSP_HEADER =
  "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; script-src 'none'";

let pooledPdfWindow: electron.BrowserWindow | null = null;
let idleDestroyTimer: ReturnType<typeof setTimeout> | null = null;
let pdfRenderQueue: Promise<unknown> = Promise.resolve();
let pdfSession: electron.Session | null = null;
let pdfProtocolRegistered = false;
const pendingHtmlDocs = new Map<string, string>();

function clearIdleDestroyTimer() {
  if (idleDestroyTimer) {
    clearTimeout(idleDestroyTimer);
    idleDestroyTimer = null;
  }
}

function scheduleIdleDestroy() {
  clearIdleDestroyTimer();
  idleDestroyTimer = setTimeout(() => {
    idleDestroyTimer = null;
    if (pooledPdfWindow && !pooledPdfWindow.isDestroyed()) {
      pooledPdfWindow.destroy();
    }
    pooledPdfWindow = null;
  }, PDF_IDLE_DESTROY_MS);
}

function resetPooledPdfWindow() {
  clearIdleDestroyTimer();
  if (pooledPdfWindow && !pooledPdfWindow.isDestroyed()) {
    pooledPdfWindow.destroy();
  }
  pooledPdfWindow = null;
}

export function destroyPdfWindowPool() {
  pendingHtmlDocs.clear();
  resetPooledPdfWindow();
}

function ensurePdfSession(): electron.Session {
  if (!pdfSession) {
    pdfSession = electron.session.fromPartition("billflow-pdf-render", {
      cache: false,
    });
  }
  if (!pdfProtocolRegistered) {
    pdfProtocolRegistered = true;
    pdfSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*", "file://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    pdfSession.protocol.handle("billflow-pdf", (req) => {
      try {
        const url = new URL(req.url);
        if (url.hostname !== "render") {
          return new Response("Not found", { status: 404 });
        }
        const token = url.pathname.replace(/^\/+/, "");
        const html = pendingHtmlDocs.get(token);
        if (!html) {
          return new Response("Not found", { status: 404 });
        }
        pendingHtmlDocs.delete(token);
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": PDF_CSP_HEADER,
          },
        });
      } catch {
        return new Response("Bad request", { status: 400 });
      }
    });
  }
  return pdfSession;
}

function getOrCreatePdfWindow(): electron.BrowserWindow {
  if (pooledPdfWindow && !pooledPdfWindow.isDestroyed()) {
    return pooledPdfWindow;
  }
  const activeSession = ensurePdfSession();
  const win = new electron.BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: {
      session: activeSession,
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("billflow-pdf://render/")) {
      event.preventDefault();
    }
  });
  win.webContents.on("render-process-gone", () => {
    if (pooledPdfWindow === win) pooledPdfWindow = null;
  });
  win.on("closed", () => {
    if (pooledPdfWindow === win) pooledPdfWindow = null;
  });
  pooledPdfWindow = win;
  return win;
}

function withRenderTimeout<T>(task: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for PDF generation."));
    }, PDF_RENDER_TIMEOUT_MS);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function renderPdfWithPooledWindow(
  document: string,
  margins: number,
): Promise<Buffer> {
  clearIdleDestroyTimer();
  const token = randomUUID();
  const html = document.replace(
    "<head>",
    `<head><meta http-equiv="Content-Security-Policy" content="${PDF_CSP_HEADER}">`,
  );
  pendingHtmlDocs.set(token, html);
  try {
    const win = getOrCreatePdfWindow();
    return await withRenderTimeout(
      (async () => {
        await win.loadURL(`billflow-pdf://render/${token}`);
        await win.webContents.executeJavaScript(
          `Promise.all([document.fonts.ready, ...Array.from(document.images, image => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload=resolve; image.onerror=resolve; }))]).then(() => true)`,
        );
        await win.webContents.executeJavaScript(
          `if (document.querySelector("[data-invoice-print]") && (document.body.scrollHeight > 1124 || document.body.dataset.invoicePagination)) {
            document.body.dataset.invoicePagination = "true";
            const continuation = document.createElement("style");
            continuation.textContent = "@page { margin:12mm 0; } @page:first { margin:0; }";
            document.head.append(continuation);
          } true`,
        );
        const pdfBytes = await win.webContents.printToPDF({
          printBackground: true,
          displayHeaderFooter: margins > 0,
          headerTemplate: "<span></span>",
          footerTemplate:
            '<div style="width:100%;text-align:center;font:9px sans-serif;color:#435665"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          pageSize: "A4",
          margins: {
            top: margins,
            bottom: margins,
            left: margins,
            right: margins,
          },
        });
        return Buffer.from(pdfBytes);
      })(),
    );
  } catch (error) {
    resetPooledPdfWindow();
    throw error;
  } finally {
    pendingHtmlDocs.delete(token);
    if (pooledPdfWindow && !pooledPdfWindow.isDestroyed()) {
      scheduleIdleDestroy();
    }
  }
}

export async function generateInvoiceHtmlPdfBuffer(
  data: InvoicePdfPayload,
): Promise<Buffer> {
  if (!electron?.BrowserWindow) return generateInvoicePdfBuffer(data);
  return printLocalPdf(buildInvoiceHtml(data));
}

export async function printLocalPdf(
  document: string,
  margins = 0,
): Promise<Buffer> {
  const run = pdfRenderQueue.then(() =>
    renderPdfWithPooledWindow(document, margins),
  );
  pdfRenderQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function generateInvoicePdfBuffer(
  data: InvoicePdfPayload,
): Promise<Buffer> {
  if (electron?.BrowserWindow) {
    return printLocalPdf(buildInvoiceHtml(data));
  }
  const { generateInvoicePdfBufferFallback } = await import("./pdf-fallback");
  return generateInvoicePdfBufferFallback(data);
}

function payableVoucherHtml(data: WorkOrderPdfPayload) {
  const money = (amount: number) =>
    escapeHtml(formatMoney(amount, data.currency));
  const paid = data.paidCents ?? 0;
  const rows = (data.items ?? []).map(
    (item) => `
    <tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td>
    <td>${money(item.unitPriceCents)}</td><td>${money(item.quantity * item.unitPriceCents)}</td></tr>`,
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Vendor Payable</title>
  <style>
    body{font:10pt system-ui,sans-serif;color:#172d3e;margin:0}
    header{border-top:5px solid #14786b;border-bottom:1px solid #bdcfcc;padding:16px 0;margin-bottom:22px}
    h1{font-size:24pt;margin:4px 0}h2{font-size:13pt;margin:22px 0 8px;break-after:avoid}
    p{margin:4px 0;overflow-wrap:anywhere}
    table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
    tr{break-inside:avoid}thead{display:table-header-group}
    td,th{border-bottom:1px solid #d8e2e3;padding:7px 9px;text-align:right;white-space:nowrap}
    td:first-child,th:first-child{text-align:left;white-space:normal;overflow-wrap:anywhere}
    th{background:#eaf3f1;color:#174b44}
    .address{white-space:pre-line}.totals{text-align:right;margin-top:15px;break-inside:avoid}
  </style></head><body>
  <header><p>${escapeHtml(data.business.businessName || "BillFlow")}</p>
    <h1>Vendor payable</h1><p>VND-INV-${escapeHtml(data.voucherNumber)}</p>
  </header>
  <h2>${escapeHtml(data.vendor.name)}</h2>
  ${data.vendor.billingAddress ? `<p class="address">${escapeHtml(data.vendor.billingAddress)}</p>` : ""}
  ${data.vendor.email ? `<p>${escapeHtml(data.vendor.email)}</p>` : ""}
  ${data.parentInvoice?.code ? `<p>Client invoice ${escapeHtml(data.parentInvoice.code)}</p>` : ""}
  ${data.payoutDueDate ? `<p>Scheduled payout ${escapeHtml(data.payoutDueDate)}</p>` : ""}
  <h2>${escapeHtml(data.scope)}</h2>
  ${
    rows.length
      ? `<table><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead>
    <tbody>${rows.join("")}</tbody></table>`
      : ""
  }
  <div class="totals">
    ${data.discountCents ? `<p>Discount ${money(data.discountCents)}</p>` : ""}
    <p>Agreed fee ${money(data.feeCents)}</p>
    <p>Paid ${money(paid)}</p>
    <p><strong>Outstanding ${money(Math.max(0, data.feeCents - paid))}</strong></p>
  </div>
  ${data.paypalUrl ? `<p><a href="${escapeHtml(data.paypalUrl)}">PayPal</a></p>` : ""}
  ${data.stripeUrl ? `<p><a href="${escapeHtml(data.stripeUrl)}">Stripe</a></p>` : ""}
  </body></html>`;
}

export async function generateWorkOrderPdfBuffer(
  data: WorkOrderPdfPayload,
): Promise<Buffer> {
  if (electron?.BrowserWindow)
    return printLocalPdf(payableVoucherHtml(data), 0.55);
  const { generateWorkOrderPdfFallback } = await import("./pdf-fallback");
  return generateWorkOrderPdfFallback(data);
}
