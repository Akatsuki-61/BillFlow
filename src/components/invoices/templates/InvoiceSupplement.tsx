import Image from "next/image";
import { formatExternalUrl, openExternalLink } from "@/lib/deliveryUrl";
import type { InvoiceTemplateProps } from "./types";

export function InvoiceSupplement({
  invoice,
  client,
  settings,
}: Pick<InvoiceTemplateProps, "invoice" | "client" | "settings">) {
  const billingAddress = invoice.clientBillingAddress || client?.billingAddress;
  const safePaymentUrl = formatExternalUrl(invoice.paymentUrl);
  if (!safePaymentUrl && !settings?.signatureData && !billingAddress)
    return null;
  return (
    <div className="mt-3 flex flex-wrap items-end justify-between gap-4 text-xs">
      <div className="space-y-2">
        {billingAddress && (
          <p className="max-w-xs whitespace-pre-line">
            <strong>Billing address</strong>
            <br />
            {billingAddress}
          </p>
        )}
        {safePaymentUrl && (
          <a
            className="font-semibold underline"
            href={safePaymentUrl}
            onClick={(event) => openExternalLink(safePaymentUrl, event)}
          >
            Pay online
          </a>
        )}
      </div>
      {settings?.signatureData && (
        <figure className="shrink-0">
          <Image
            src={settings.signatureData}
            alt="Invoice signature"
            width={144}
            height={44}
            unoptimized
            className="h-11 w-36 rounded bg-white object-contain"
          />
          <figcaption className="mt-1 text-[10px]">
            Authorized signature
          </figcaption>
        </figure>
      )}
    </div>
  );
}
