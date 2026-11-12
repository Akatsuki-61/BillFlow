"use client";
import { profileStorageKey } from "@/lib/profile-scope";

import { useState, useEffect, useRef } from "react";
import {
  Printer,
  CreditCard,
  Download,
  Share2,
  Mail,
  MessageSquare,
  Check,
  ChevronDown,
  LayoutTemplate,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import { AnimatePresence, motion } from "motion/react";
import { SPRING_MENU_POPOVER, EXIT_MENU_POPOVER } from "@/lib/motion";
import { formatCents, formatDateDisplay } from "@/lib/format";
import type {
  InvoiceWithClient,
  InvoiceTemplateId,
  NewInvoiceInput,
} from "@/types/billing";
import { useSettings, useClients, useInvoices } from "@/lib/data/DataProvider";
import { resolveDeliveryUrl, openExternalLink } from "@/lib/deliveryUrl";
import {
  generateInvoiceWhatsAppLink,
  generateInvoiceEmailLink,
} from "@/lib/whatsapp";
import {
  GeometricTealTemplate,
  ExecutiveWaveTemplate,
  ScarletModernTemplate,
  ApexOrangeTemplate,
  NoirCrimsonTemplate,
} from "./templates";

interface InvoiceDocumentSheetProps {
  invoice: InvoiceWithClient;
  onClose: () => void;
  onOpenPdf?: () => void;
  onRecordPayment?: () => void;
}

const TEMPLATES: Array<{
  id: InvoiceTemplateId;
  name: string;
  badge: string;
  color: string;
  description: string;
}> = [
  {
    id: "geometric-teal",
    name: "Geometric Teal",
    badge: "Template 1",
    color: "#00A887",
    description: "Modern teal ribbons & dark slate header",
  },
  {
    id: "executive-wave",
    name: "Executive Wave",
    badge: "Template 2",
    color: "#EAA828",
    description: "Charcoal wave header & golden amber accents",
  },
  {
    id: "scarlet-modern",
    name: "Scarlet Modern",
    badge: "Template 3",
    color: "#E5252A",
    description: "Crimson red & dark slate geometric header with dotted rows",
  },
  {
    id: "apex-orange",
    name: "Apex Orange",
    badge: "Template 4",
    color: "#F25C05",
    description:
      "Tangerine diagonal header, full orange table with grid borders & numbered terms",
  },
  {
    id: "noir-crimson",
    name: "Noir Crimson",
    badge: "Template 5",
    color: "#D9383A",
    description: "Dark obsidian canvas with crimson capsules & chevron accents",
  },
];

export default function InvoiceDocumentSheet({
  invoice,
  onClose,
  onOpenPdf,
  onRecordPayment,
}: InvoiceDocumentSheetProps) {
  const { settings: currentSettings } = useSettings();
  const settings = (() => {
    try {
      return invoice.businessSnapshot
        ? ({
            ...currentSettings,
            ...JSON.parse(invoice.businessSnapshot),
          } as typeof currentSettings)
        : currentSettings;
    } catch {
      return currentSettings;
    }
  })();
  const { clients } = useClients();
  const { saveInvoicePdfAs } = useInvoices();

  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplateId>(
    () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(
          profileStorageKey("billflow_invoice_template"),
        );
        if (
          stored === "geometric-teal" ||
          stored === "executive-wave" ||
          stored === "scarlet-modern" ||
          stored === "apex-orange" ||
          stored === "noir-crimson"
        ) {
          return stored;
        }
      }
      return settings?.defaultInvoiceTemplate || "geometric-teal";
    },
  );

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const handleSelectTemplate = (templateId: InvoiceTemplateId) => {
    setSelectedTemplate(templateId);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        profileStorageKey("billflow_invoice_template"),
        templateId,
      );
    }
  };

  const businessName = settings?.businessName || "CHETHAKA LAKSHITHA";
  const professionalTitle =
    settings?.professionalTitle || "SOFTWARE FREELANCING & CONSULTING";

  const paidCents =
    invoice.payments && invoice.payments.length > 0
      ? invoice.payments.reduce((sum, p) => sum + p.amountCents, 0)
      : invoice.paidCents || 0;

  const balanceDueCents = Math.max(0, invoice.amountCents - paidCents);

  const delivery = resolveDeliveryUrl(invoice, { clients });
  const client = clients.find((c) => c.id === invoice.clientId);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        shareDropdownRef.current &&
        !shareDropdownRef.current.contains(e.target as Node)
      ) {
        setIsShareOpen(false);
      }
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(e.target as Node)
      ) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isTemplateDropdownOpen) {
          e.preventDefault();
          setIsTemplateDropdownOpen(false);
          return;
        }
        if (isShareOpen) {
          e.preventDefault();
          setIsShareOpen(false);
          return;
        }
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isTemplateDropdownOpen, isShareOpen]);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdfAs = async () => {
    setIsSavingPdf(true);
    setSavedNotice(null);
    try {
      const draft: NewInvoiceInput | undefined =
        invoice.id === "draft-preview"
          ? {
              ...(invoice.clientId
                ? { clientId: invoice.clientId }
                : {
                    newClient: {
                      name: invoice.clientName,
                      email: invoice.clientEmail || "draft@billflow.local",
                      currency: invoice.currency,
                    },
                  }),
              code: invoice.code,
              currency: invoice.currency,
              amountCents: invoice.amountCents,
              items: invoice.items || [],
              discountCents: invoice.discountCents,
              taxCents: invoice.taxCents,
              advanceCents: invoice.advanceCents,
              issueDate: invoice.issueDate.slice(0, 10),
              dueDate: invoice.dueDate?.slice(0, 10),
              deliveryUrl: invoice.deliveryUrl,
              notes: invoice.notes,
              status: "DRAFT",
            }
          : undefined;
      if (window.billflow?.invoices?.savePdfAs) {
        const result = await window.billflow.invoices.savePdfAs(
          invoice.id,
          selectedTemplate,
          draft,
        );
        if (result.success && result.filePath) {
          const fileName =
            result.filePath.split(/[\\/]/).pop() || "invoice.pdf";
          setSavedNotice(`Saved: ${fileName}`);
          setTimeout(() => setSavedNotice(null), 4500);
          return;
        }
      } else if (saveInvoicePdfAs) {
        const result = await saveInvoicePdfAs(
          invoice.id,
          selectedTemplate,
          draft,
        );
        if (result.success && result.filePath) {
          const fileName =
            result.filePath.split(/[\\/]/).pop() || "invoice.pdf";
          setSavedNotice(`Saved: ${fileName}`);
          setTimeout(() => setSavedNotice(null), 4500);
          return;
        }
      }

      if (onOpenPdf) {
        onOpenPdf();
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Failed to save PDF:", err);
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setIsShareOpen(false);
    setSavedNotice("Preparing invoice PDF...");

    let pdfExported = false;
    try {
      if (
        window.billflow?.invoices?.exportPdf &&
        invoice.id !== "sample-preview" &&
        invoice.id !== "draft-preview"
      ) {
        await window.billflow.invoices.exportPdf(invoice.id, selectedTemplate);
        if (window.billflow?.files?.openInvoicePdf) {
          await window.billflow.files.openInvoicePdf(invoice.id, true);
          pdfExported = true;
        }
      }
    } catch (err) {
      console.warn("Could not auto-reveal exported PDF:", err);
    }

    const link = generateInvoiceWhatsAppLink({
      clientName: invoice.clientName,
      clientPhone: client?.phone,
      invoiceCode: invoice.code,
      totalFormatted: formatCents(invoice.amountCents, invoice.currency),
      advanceFormatted: invoice.advanceCents
        ? formatCents(invoice.advanceCents, invoice.currency)
        : null,
      balanceFormatted: formatCents(balanceDueCents, invoice.currency),
      dueDate: invoice.dueDate ? formatDateDisplay(invoice.dueDate) : null,
      deliveryUrl: delivery.hasLink ? delivery.formattedUrl : null,
      paymentDetails: settings?.paymentDetails,
      businessName,
    });
    openExternalLink(link);
    setSavedNotice(
      pdfExported
        ? "Invoice PDF ready in Explorer to attach in WhatsApp!"
        : "WhatsApp opened with invoice message!",
    );
    setTimeout(() => setSavedNotice(null), 5000);
  };

  const handleShareEmail = async () => {
    setIsShareOpen(false);
    setSavedNotice("Preparing invoice PDF...");

    let pdfExported = false;
    try {
      if (
        window.billflow?.invoices?.exportPdf &&
        invoice.id !== "sample-preview" &&
        invoice.id !== "draft-preview"
      ) {
        await window.billflow.invoices.exportPdf(invoice.id, selectedTemplate);
        if (window.billflow?.files?.openInvoicePdf) {
          await window.billflow.files.openInvoicePdf(invoice.id, true);
          pdfExported = true;
        }
      }
    } catch (err) {
      console.warn("Could not auto-reveal exported PDF:", err);
    }

    const link = generateInvoiceEmailLink({
      clientEmail: invoice.clientEmail,
      clientName: invoice.clientName,
      invoiceCode: invoice.code,
      totalFormatted: formatCents(invoice.amountCents, invoice.currency),
      advanceFormatted: invoice.advanceCents
        ? formatCents(invoice.advanceCents, invoice.currency)
        : null,
      balanceFormatted: formatCents(balanceDueCents, invoice.currency),
      dueDate: invoice.dueDate ? formatDateDisplay(invoice.dueDate) : null,
      deliveryUrl: delivery.hasLink ? delivery.formattedUrl : null,
      paymentDetails: settings?.paymentDetails,
      businessName,
    });
    window.open(link);
    setSavedNotice(
      pdfExported
        ? "Invoice PDF ready in Explorer to attach to your email!"
        : "Email draft opened with invoice message!",
    );
    setTimeout(() => setSavedNotice(null), 5000);
  };

  return (
    <Dialog onClose={onClose} width={880}>
      {/* 1. DIALOG HEADER WITH TEMPLATE PICKER */}
      <div className="app-dialog-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3>Invoice Preview</h3>
          <p className="flex items-center gap-2 mt-1 text-xs">
            <span className="font-bold text-accent">{invoice.code}</span>
            <span className="text-content-neutral-300 dark:text-neutral-600">
              •
            </span>
            <span className="font-medium text-content-neutral-600 dark:text-neutral-300">
              {invoice.clientName}
            </span>
            <span className="text-content-neutral-300 dark:text-neutral-600">
              •
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
              {invoice.status.replace("_", " ")}
            </span>
          </p>
        </div>

        {/* Template Dropdown Picker */}
        <div className="relative mr-10" ref={templateDropdownRef}>
          <button
            type="button"
            onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-neutral-100 hover:bg-surface-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 border border-line-neutral-200 dark:border-white/10 text-xs font-semibold text-content-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer shadow-sm select-none"
            aria-expanded={isTemplateDropdownOpen}
            aria-haspopup="listbox"
            title="Choose invoice design template"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-accent opacity-90" />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              style={{
                backgroundColor:
                  selectedTemplate === "noir-crimson"
                    ? "#D9383A"
                    : selectedTemplate === "apex-orange"
                      ? "#F25C05"
                      : selectedTemplate === "scarlet-modern"
                        ? "#E5252A"
                        : selectedTemplate === "executive-wave"
                          ? "#EAA828"
                          : "#00A887",
              }}
            />
            <span className="font-bold">
              {selectedTemplate === "noir-crimson"
                ? "Noir Crimson"
                : selectedTemplate === "apex-orange"
                  ? "Apex Orange"
                  : selectedTemplate === "scarlet-modern"
                    ? "Scarlet Modern"
                    : selectedTemplate === "executive-wave"
                      ? "Executive Wave"
                      : "Geometric Teal"}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-content-neutral-400 transition-transform duration-200 ${
                isTemplateDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Popover */}
          {isTemplateDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-surface border border-line-neutral-200 dark:border-white/10 shadow-2xl p-1.5 z-[150] text-content-neutral-900 dark:text-white animate-in fade-in-50 zoom-in-95">
              <div className="px-2.5 py-1 text-[10px] font-bold text-content-neutral-400 uppercase tracking-wider">
                Invoice Template
              </div>
              {TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      handleSelectTemplate(tmpl.id);
                      setIsTemplateDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-accent/10 text-accent font-bold"
                        : "hover:bg-surface-neutral-50 dark:hover:bg-white/10 text-content-neutral-800 dark:text-neutral-200 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: tmpl.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <span>{tmpl.name}</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-content-neutral-500 dark:text-neutral-400">
                            {tmpl.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-content-neutral-400 font-normal truncate mt-0.5">
                          {tmpl.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. DIALOG BODY (Hosting Document Sheet) */}
      <div className="app-dialog-body flex justify-center py-4 bg-surface-neutral-50 dark:bg-black/20 rounded-xl overflow-y-auto">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .invoice-sheet-font {
                font-family: 'Nunito', 'Plus Jakarta Sans', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif;
              }
            `,
          }}
        />

        {selectedTemplate === "noir-crimson" ? (
          <NoirCrimsonTemplate
            invoice={invoice}
            client={client}
            clients={clients}
            settings={settings}
            delivery={delivery}
            businessName={businessName}
            professionalTitle={professionalTitle}
            openExternalLink={openExternalLink}
            formatMoney={formatCents}
            formatDate={formatDateDisplay}
          />
        ) : selectedTemplate === "apex-orange" ? (
          <ApexOrangeTemplate
            invoice={invoice}
            client={client}
            clients={clients}
            settings={settings}
            delivery={delivery}
            businessName={businessName}
            professionalTitle={professionalTitle}
            openExternalLink={openExternalLink}
            formatMoney={formatCents}
            formatDate={formatDateDisplay}
          />
        ) : selectedTemplate === "scarlet-modern" ? (
          <ScarletModernTemplate
            invoice={invoice}
            client={client}
            clients={clients}
            settings={settings}
            delivery={delivery}
            businessName={businessName}
            professionalTitle={professionalTitle}
            openExternalLink={openExternalLink}
            formatMoney={formatCents}
            formatDate={formatDateDisplay}
          />
        ) : selectedTemplate === "executive-wave" ? (
          <ExecutiveWaveTemplate
            invoice={invoice}
            client={client}
            clients={clients}
            settings={settings}
            delivery={delivery}
            businessName={businessName}
            professionalTitle={professionalTitle}
            openExternalLink={openExternalLink}
            formatMoney={formatCents}
            formatDate={formatDateDisplay}
          />
        ) : (
          <GeometricTealTemplate
            invoice={invoice}
            client={client}
            clients={clients}
            settings={settings}
            delivery={delivery}
            businessName={businessName}
            professionalTitle={professionalTitle}
            openExternalLink={openExternalLink}
            formatMoney={formatCents}
            formatDate={formatDateDisplay}
          />
        )}
      </div>

      {/* 3. DIALOG FOOTER */}
      <div className="app-dialog-footer">
        <div className="mr-auto flex items-center gap-2">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-fadeIn">
              <Check className="w-4 h-4" />
              <span>{savedNotice}</span>
            </span>
          )}
        </div>

        <Button
          variant="secondary"
          type="button"
          onClick={handlePrint}
          title="Print this invoice document"
        >
          <Printer className="w-4 h-4" />
          <span>Print</span>
        </Button>

        {/* Share Button & Dropdown */}
        <div className="relative" ref={shareDropdownRef}>
          <Button
            variant="secondary"
            type="button"
            aria-expanded={isShareOpen}
            onClick={() => setIsShareOpen(!isShareOpen)}
            title="Share invoice PDF via WhatsApp or Email"
          >
            <Share2 className="w-4 h-4 text-sky-500" />
            <span>Share</span>
            <ChevronDown
              className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${
                isShareOpen ? "rotate-180" : ""
              }`}
            />
          </Button>

          <AnimatePresence initial={false}>
            {isShareOpen && (
              <motion.div
                key="invoice-share-dropdown"
                initial={{ opacity: 0, scaleX: 0.95, scaleY: 0.86, y: 6 }}
                animate={{
                  opacity: 1,
                  scaleX: 1,
                  scaleY: 1,
                  y: 0,
                  transition: SPRING_MENU_POPOVER,
                }}
                exit={{
                  opacity: 0,
                  scaleX: 0.96,
                  scaleY: 0.9,
                  y: 4,
                  transition: EXIT_MENU_POPOVER,
                }}
                style={{ transformOrigin: "bottom right" }}
                className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-surface border border-line-neutral-200 dark:border-white/10 shadow-2xl p-1.5 z-[150] text-content-neutral-900 dark:text-white"
              >
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-neutral-50 dark:hover:bg-white/10 text-left transition-colors cursor-pointer text-xs font-semibold"
                >
                  <div className="w-6 h-6 rounded-md bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold">WhatsApp</div>
                    <div className="text-[10px] text-content-neutral-400 font-normal">
                      Share invoice PDF &amp; brief
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleShareEmail}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-neutral-50 dark:hover:bg-white/10 text-left transition-colors cursor-pointer text-xs font-semibold mt-1"
                >
                  <div className="w-6 h-6 rounded-md bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold">Email</div>
                    <div className="text-[10px] text-content-neutral-400 font-normal">
                      Draft email with PDF attached
                    </div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {onRecordPayment && invoice.status !== "PAID" && (
          <Button variant="secondary" type="button" onClick={onRecordPayment}>
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <span>Record Payment</span>
          </Button>
        )}

        <Button
          variant="primary"
          type="button"
          onClick={handleSavePdfAs}
          disabled={isSavingPdf}
          title="Choose folder location and save invoice as PDF"
        >
          <Download className="w-4 h-4" />
          <span>{isSavingPdf ? "Saving PDF..." : "Save as PDF"}</span>
        </Button>
      </div>
    </Dialog>
  );
}
