"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Plus,
  Search,
  TrendingUp,
  Code2,
  Pencil,
  Cloud,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  MoreHorizontal,
  Trash2,
  Info,
  Download,
  Copy,
  Check,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { useCatalog, useClients, useInvoices, useData } from "@/lib/data/DataProvider";
import { Button, PageHeader } from "@/components/ui/Workspace";
import type {
  CatalogItem,
  CatalogIconType,
  Currency,
} from "@/types/billing";
import "./catalog.css";
import { parseCatalogCsv } from "@/lib/catalog-import";

const getCurrencyPrefix = (currency: string) => {
  switch (currency.toUpperCase()) {
    case "LKR":
      return "Rs. ";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "USD":
    case "CAD":
    default:
      return "$";
  }
};

const formatPriceWithCurrency = (priceStr: string, currency: string) => {
  const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, "") || "0");
  const prefix = getCurrencyPrefix(currency);
  return `${prefix}${numericPrice.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const categoryList = [
  "All Items",
  "Development",
  "Design",
  "Consulting",
  "Licensing",
] as const;

type Category = (typeof categoryList)[number];

export default function CatalogView() {
  const {
    catalogItems,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    bulkImportCatalogItems,
  } = useCatalog();
  const { clients } = useClients();
  const { createInvoice } = useInvoices();
  const { activeCurrency, settings } = useData();

  const [saving,setSaving] = useState(false);
  const createRequest = useRef<string | null>(null);
  const invoiceRequest = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("All Items");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Notifications / Toast
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3600);
  };

  // Modals state
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showImportInfoModal, setShowImportInfoModal] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<"table" | "csv" | "excel">("table");
  const [copied, setCopied] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);

  // Quick Create Invoice from Catalog Item State
  const [quickInvoiceItem, setQuickInvoiceItem] = useState<CatalogItem | null>(null);
  const [invoiceClientId, setInvoiceClientId] = useState<string>("");
  const [invoiceAmount, setInvoiceAmount] = useState<string>("");
  const [invoiceCurrency, setInvoiceCurrency] = useState<string>(settings?.defaultCurrency || activeCurrency || "LKR");
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadSampleCSV = () => {
    const csvContent =
      `title,category,sku,price,currency,unit,description\n` +
      `"Full-Stack Web Application","Development","DEV-FS-01",250000.00,"LKR","sprint","Complete Next.js, Node.js and SQLite development sprint"\n` +
      `"Brand Identity & Design System","Design","DSGN-UI-02",95000.00,"LKR","package","Logo system, Figma UI kit, and typography standards"\n` +
      `"Cloud Infrastructure Assessment","Consulting","CONS-AUD-03",60000.00,"LKR","audit","Security, Docker deployment, and database performance review"\n` +
      `"Enterprise Software License","Licensing","LIC-PRO-04",350000.00,"LKR","year","Multi-seat business software license with ongoing updates"`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "billflow-catalog-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copySampleCSV = () => {
    const csvText =
      `title,category,sku,price,currency,unit,description\n` +
      `"Full-Stack Web Application","Development","DEV-FS-01",250000.00,"LKR","sprint","Complete Next.js, Node.js and SQLite development sprint"\n` +
      `"Brand Identity & Design System","Design","DSGN-UI-02",95000.00,"LKR","package","Logo system, Figma UI kit, and typography standards"\n` +
      `"Cloud Infrastructure Assessment","Consulting","CONS-AUD-03",60000.00,"LKR","audit","Security, Docker deployment, and database performance review"\n` +
      `"Enterprise Software License","Licensing","LIC-PRO-04",350000.00,"LKR","year","Multi-seat business software license with ongoing updates"`;

    void navigator.clipboard.writeText(csvText).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>showToast("Could not copy CSV. Download the template instead.","error"));
  };

  // New Item Form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<"Development" | "Design" | "Consulting" | "Licensing">("Development");
  const [newSku, setNewSku] = useState("DEV-002");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState(settings?.defaultCurrency || activeCurrency || "LKR");
  const [newUnit, setNewUnit] = useState("/ Hourly");
  const [newDescription, setNewDescription] = useState("");

  // Edit Item Form state
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<"Development" | "Design" | "Consulting" | "Licensing">("Development");
  const [editSku, setEditSku] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState("LKR");
  const [editUnit, setEditUnit] = useState("/ Hourly");
  const [editDescription, setEditDescription] = useState("");

  const filteredItems = catalogItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "All Items" || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoryCounts: Record<string, number> = {
    "All Items": catalogItems.length,
    Development: catalogItems.filter((i) => i.category === "Development").length,
    Design: catalogItems.filter((i) => i.category === "Design").length,
    Consulting: catalogItems.filter((i) => i.category === "Consulting").length,
    Licensing: catalogItems.filter((i) => i.category === "Licensing").length,
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawPrice = newPrice.trim();

    const iconTypeMap: Record<string, CatalogIconType> = {
      Development: "code",
      Design: "design",
      Licensing: "cloud",
      Consulting: "consulting",
    };

    if(saving)return; setSaving(true);
    createRequest.current ||= crypto.randomUUID();
    try {
      await createCatalogItem({
        requestId:createRequest.current,
        title: newTitle.trim() || "New Catalog Item",
        category: newCategory,
        sku: newSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        description: newDescription.trim() || "",
        price: rawPrice,
        currency: newCurrency as Currency,
        unit: newUnit,
        iconType: iconTypeMap[newCategory] || "code",
      });
      createRequest.current=null;
      showToast("Catalog item created successfully!");
    } catch (err) {
      console.error("Failed to create catalog item:", err);
      showToast(err instanceof Error ? err.message : "Failed to create catalog item", "error");
      return;
    } finally {setSaving(false);}

    setShowNewItemModal(false);

    // Reset Form
    setNewTitle("");
    setNewSku(`SKU-0${catalogItems.length + 50}`);
    setNewPrice("");
    setNewDescription("");
    setNewCurrency(settings?.defaultCurrency || activeCurrency || "LKR");
  };

  const handleOpenEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditSku(item.sku);
    setEditPrice(item.price.replace(/[^0-9.]/g, ""));
    setEditCurrency(item.currency || "LKR");
    setEditUnit(item.unit);
    setEditDescription(item.description);
    setOpenMenuId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const rawPrice = editPrice.trim();

    const iconTypeMap: Record<string, CatalogIconType> = {
      Development: "code",
      Design: "design",
      Licensing: "cloud",
      Consulting: "consulting",
    };

    if(saving)return;setSaving(true);
    try {
      await updateCatalogItem(editingItem.id, {
        title: editTitle.trim() || editingItem.title,
        category: editCategory,
        sku: editSku.trim() || editingItem.sku,
        price: rawPrice,
        currency: editCurrency as Currency,
        unit: editUnit,
        description: editDescription.trim() || editingItem.description,
        iconType: iconTypeMap[editCategory] || editingItem.iconType,
      });
      showToast("Catalog item updated successfully!");
    } catch (err) {
      console.error("Failed to update item:", err);
      showToast(err instanceof Error ? err.message : "Failed to update item", "error");
      return;
    } finally {setSaving(false);}

    setEditingItem(null);
  };

  const handleConfirmDelete = async () => {
    if (deletingItem) {
      try {
        await deleteCatalogItem(deletingItem.id);
        showToast("Catalog item deleted successfully!");
      } catch (err) {
        console.error("Failed to delete item:", err);
        showToast(err instanceof Error ? err.message : "Failed to delete item", "error");
        return;
      }
      setDeletingItem(null);
      setOpenMenuId(null);
    }
  };

  const handleOpenCreateInvoice = (item: CatalogItem) => {
    invoiceRequest.current=null;
    setQuickInvoiceItem(item);
    setInvoiceAmount(item.price.replace(/[^0-9.]/g, ""));
    setInvoiceCurrency(item.currency || "LKR");
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setInvoiceDueDate(d.toISOString().split("T")[0]);
    if (clients.length > 0) {
      setInvoiceClientId(clients[0].id);
    } else {
      setInvoiceClientId("");
    }
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInvoiceItem) return;
    if (!invoiceClientId) {
      alert("Please select a client or create one on the Clients page.");
      return;
    }

    const numericAmount = parseFloat(invoiceAmount.replace(/[^0-9.]/g, "") || "0");
    const amountCents = Math.round(numericAmount * 100);

    if(saving)return;setSaving(true);
    invoiceRequest.current ||= crypto.randomUUID();
    try {
      await createInvoice({
        requestId:invoiceRequest.current,
        clientId: invoiceClientId,
        catalogItemId: quickInvoiceItem.id,
        title: quickInvoiceItem.title,
        amountCents,
        currency: invoiceCurrency as Currency,
        dueDate: invoiceDueDate || null,
        status: "UNPAID",
      });
      showToast(`Invoice created for "${quickInvoiceItem.title}"!`);
      setQuickInvoiceItem(null);
    } catch (err) {
      console.error("Failed to create invoice from catalog item:", err);
      showToast(err instanceof Error ? err.message : "Failed to create invoice", "error");
    } finally {setSaving(false);}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; e.target.value="";
    if(!file || saving)return;
    setSaving(true);
    try {
      if(!file.name.toLowerCase().endsWith(".csv"))throw new Error("Export Excel as CSV, then select the CSV file.");
      if(file.size>5*1024*1024)throw new Error("CSV files must be under 5 MB.");
      const items=parseCatalogCsv(await file.text());
      const count=await bulkImportCatalogItems(items);
      showToast(`Imported ${count} new items; identical existing SKUs were skipped.`);
      setShowBulkImportModal(false);
    }catch(error){showToast(error instanceof Error ? error.message : "Could not import Catalog items.","error");} finally {setSaving(false);}
  };

  const renderIcon = (type: CatalogItem["iconType"]) => {
    switch (type) {
      case "code":
        return <Code2 className="w-5 h-5 text-content-neutral-700" strokeWidth={1.8} />;
      case "design":
        return <Pencil className="w-4.5 h-4.5 text-content-neutral-700" strokeWidth={1.8} />;
      case "cloud":
        return <Cloud className="w-5 h-5 text-content-neutral-700" strokeWidth={1.8} />;
      case "consulting":
      default:
        return <Briefcase className="w-5 h-5 text-content-neutral-700" strokeWidth={1.8} />;
    }
  };

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-14 right-6 z-50 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border ${
            notification.type === "error"
              ? "bg-surface-rose-950 border-line-rose-800 text-content-rose-100"
              : "bg-surface-neutral-900 border-line-neutral-700 text-white"
          }`}
        >
          {notification.type === "error" ? (
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-content-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header */}
      <PageHeader
        title="Catalog"
        description="Manage standardized products, services, and pricing units."
      >
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-xl shadow-xs">
            <Button
              variant="secondary"
              onClick={() => setShowBulkImportModal(true)}
              className="rounded-r-none border-r-0 gap-2"
            >
              <Upload className="w-4 h-4" strokeWidth={1.8} />
              <span>Bulk Import</span>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowImportInfoModal(true)}
              title="Bulk Import File Format Guide (CSV & Excel)"
              className="rounded-l-none"
            >
              <Info className="w-4 h-4" strokeWidth={2} />
            </Button>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              createRequest.current = null;
              setShowNewItemModal(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.2} />
            <span>New Item</span>
          </Button>
        </div>
      </PageHeader>

      {/* Main Split Layout: Left Controls + Right Catalog Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Search, Categories, Total Items Card) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Search & Categories Box */}
          <div className="bg-surface rounded-2xl border border-line-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-content-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-surface-neutral-50 rounded-xl border border-line-neutral-200/70 text-sm text-content-neutral-900 placeholder:text-content-neutral-400 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 transition-all"
              />
            </div>

            {/* Categories Section */}
            <div className="mt-5">
              <span className="block text-[11px] font-bold tracking-wider text-content-neutral-400 uppercase mb-3">
                Categories
              </span>
              <div className="flex flex-wrap gap-2">
                {categoryList.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-accent-solid text-white font-semibold shadow-xs"
                          : "bg-surface border border-line-neutral-200/80 text-content-neutral-700 font-medium hover:bg-surface-neutral-50 hover:text-content-neutral-900"
                      }`}
                    >
                      {category} <span className="opacity-70 font-normal">({categoryCounts[category]})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Total Items Metric Card */}
          <div className="relative overflow-hidden bg-surface rounded-2xl border border-line-neutral-200/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="catalog-items-glow" />
            <span className="block text-[11px] font-bold tracking-wider text-content-neutral-400 uppercase mb-2">
              Total Items
            </span>
            <div className="text-4xl md:text-[42px] font-bold text-content-neutral-900 tracking-tight leading-none">
              {catalogItems.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-normal mt-4">
              <TrendingUp className="w-4 h-4 text-content-emerald-600" strokeWidth={2.2} />
              <span className="font-bold text-content-emerald-600">Active</span>
              <span className="text-content-neutral-500">items in catalog</span>
            </div>
          </div>
        </div>

        {/* Right Column (Catalog List Container) */}
        <div className="lg:col-span-8 bg-canvas rounded-3xl border border-line-neutral-300/60 p-6 md:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[540px]">
          <div>
            {/* Header Labels */}
            <div className="flex items-center justify-between pb-3.5 border-b border-line-neutral-300/60 text-[11px] font-bold tracking-wider text-content-neutral-500 uppercase">
              <span>Item Details</span>
              <span>Unit / Price</span>
            </div>

            {/* Catalog Items Rows */}
            <div className="divide-y divide-line-neutral-300/60">
              {filteredItems.length === 0 ? (
                <div className="py-16 text-center text-sm text-content-neutral-500">
                  No catalog items found matching your criteria.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div key={item.id} className="py-5 flex items-start gap-4">
                    {/* Left Icon Badge */}
                    <div className="w-10 h-10 rounded-xl bg-surface/90 border border-line-neutral-300/70 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      {renderIcon(item.iconType)}
                    </div>

                    {/* Middle Details & Description */}
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-base md:text-[17px] font-bold text-content-neutral-900 leading-snug tracking-tight">
                        {item.title}
                      </h3>

                      {/* Category Badge & SKU */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface/90 border border-line-neutral-300/80 text-content-neutral-600">
                          {item.category}
                        </span>
                        <span className="text-xs text-content-neutral-500 font-medium">
                          SKU: {item.sku}
                        </span>
                      </div>

                      {/* Description Box */}
                      <div className="mt-3 px-3.5 py-2.5 bg-surface/85 rounded-xl border border-line-neutral-300/80 text-xs text-content-neutral-700 leading-relaxed font-normal shadow-2xs">
                        {item.description}
                      </div>
                    </div>

                    {/* Right Price, Unit & 3-Dots Menu */}
                    <div className="flex items-start gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-lg md:text-xl font-bold text-content-neutral-900 tracking-tight leading-none">
                          {formatPriceWithCurrency(item.price, item.currency)}
                        </div>
                        <div className="text-xs text-content-neutral-500 font-medium mt-1">
                          {item.unit}
                        </div>
                      </div>

                      {/* 3-Dots Action Button & Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(openMenuId === item.id ? null : item.id)
                          }
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            openMenuId === item.id
                              ? "bg-surface-neutral-300/70 text-content-neutral-900"
                              : "text-content-neutral-400 hover:text-content-neutral-700 hover:bg-surface-neutral-300/50"
                          }`}
                          aria-label={`Options for ${item.title}`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === item.id && (
                          <>
                            {/* Backdrop */}
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenMenuId(null)}
                            />

                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-surface rounded-2xl shadow-xl border border-line-neutral-200/90 py-1.5 z-40 text-left text-xs animate-in fade-in zoom-in-95 duration-100 font-medium">
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenCreateInvoice(item);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-content-neutral-700 hover:text-content-purple-700 hover:bg-surface-purple-50/60 transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-content-purple-600" />
                                <span>Create Invoice</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-content-neutral-700 hover:text-content-neutral-900 hover:bg-surface-neutral-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-content-neutral-500" />
                                <span>Edit Item</span>
                              </button>

                              <div className="my-1 border-t border-line-neutral-100" />

                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingItem(item);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-surface-rose-50/80 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Delete Item</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer & Pagination */}
          <div className="pt-6 mt-4 border-t border-line-neutral-300/60 flex items-center justify-between text-xs text-content-neutral-500">
            <div>
              Showing {filteredItems.length === 0 ? 0 : 1}-{filteredItems.length} of {catalogItems.length} items
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="w-7 h-7 rounded-lg bg-surface-neutral-200/80 hover:bg-surface-neutral-300 text-content-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                className="w-7 h-7 rounded-lg bg-surface-neutral-200/80 hover:bg-surface-neutral-300 text-content-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl border border-line-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-line-neutral-100">
              <div>
                <h3 className="text-lg font-semibold text-content-neutral-900">
                  Edit Catalog Item
                </h3>
                <p className="text-xs text-content-neutral-400 mt-0.5">
                  Update item specifications, price, currency, or description.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-content-neutral-400 hover:text-content-neutral-600 p-1.5 rounded-lg hover:bg-surface-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                  Item Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) =>
                      setEditCategory(
                        e.target.value as "Development" | "Design" | "Consulting" | "Licensing"
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Licensing">Licensing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    SKU Code <span className="normal-case font-normal text-content-neutral-400">(Stock Keeping Unit)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    <option value="LKR">LKR (Rs. Sri Lankan Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                    <option value="EUR">EUR (€ Euro)</option>
                    <option value="GBP">GBP (£ British Pound)</option>
                    <option value="CAD">CAD ($ Canadian Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Pricing Unit
                  </label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    <option value="/ Hourly">/ Hourly</option>
                    <option value="/ Daily">/ Daily</option>
                    <option value="/ Unit">/ Unit</option>
                    <option value="/ Monthly">/ Monthly</option>
                    <option value="/ Project">/ Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                  Item Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-sm text-content-neutral-600 hover:bg-surface-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-line-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
              <div className="w-10 h-10 rounded-full bg-surface-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-content-neutral-900">
                  Delete Catalog Item?
                </h3>
                <p className="text-xs text-content-neutral-500">
                  This action will permanently remove this item from your catalog.
                </p>
              </div>
            </div>

            <p className="text-sm text-content-neutral-600 mt-2">
              Are you sure you want to delete <strong className="text-content-neutral-900">{deletingItem.title}</strong> ({deletingItem.sku}) valued at <strong className="text-content-neutral-900">{deletingItem.price} {deletingItem.unit}</strong>?
            </p>

            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-line-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-sm text-content-neutral-600 hover:bg-surface-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving} onClick={handleConfirmDelete}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Item Modal */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl border border-line-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-line-neutral-100">
              <div>
                <h3 className="text-lg font-semibold text-content-neutral-900">
                  New Catalog Item
                </h3>
                <p className="text-xs text-content-neutral-400 mt-0.5">
                  Define a standardized product, service, or pricing unit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewItemModal(false)}
                className="text-content-neutral-400 hover:text-content-neutral-600 p-1.5 rounded-lg hover:bg-surface-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                  Item Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Development"
                  className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) =>
                      setNewCategory(
                        e.target.value as "Development" | "Design" | "Consulting" | "Licensing"
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Licensing">Licensing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    SKU Code <span className="normal-case font-normal text-content-neutral-400">(Stock Keeping Unit)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="e.g. DEV-001"
                    className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="45000.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as Currency)}
                    className="w-full px-3 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    <option value="LKR">LKR (Rs. Sri Lankan Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                    <option value="EUR">EUR (€ Euro)</option>
                    <option value="GBP">GBP (£ British Pound)</option>
                    <option value="CAD">CAD ($ Canadian Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Pricing Unit
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    <option value="/ Hourly">/ Hourly</option>
                    <option value="/ Daily">/ Daily</option>
                    <option value="/ Unit">/ Unit</option>
                    <option value="/ Monthly">/ Monthly</option>
                    <option value="/ Project">/ Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                  Item Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the scope, deliverables, or specifications of this item..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-4 py-2 text-sm text-content-neutral-600 hover:bg-surface-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Create Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-line-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-line-neutral-100">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-content-neutral-900">
                  Bulk Import Items
                </h3>
                <button
                  type="button"
                  onClick={() => setShowImportInfoModal(true)}
                  title="View CSV / Excel format guide"
                  className="p-1 text-content-neutral-400 hover:text-content-purple-600 hover:bg-surface-purple-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="text-content-neutral-400 hover:text-content-neutral-600 p-1.5 rounded-lg hover:bg-surface-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 p-8 border-2 border-dashed border-line-neutral-200 rounded-2xl text-center hover:border-line-purple-400 hover:bg-surface-purple-50/20 transition-all cursor-pointer group"
            >
              <FileSpreadsheet className="w-10 h-10 text-content-neutral-400 group-hover:text-content-purple-600 mx-auto mb-2 transition-colors" />
              <p className="text-sm font-semibold text-content-neutral-800 group-hover:text-content-purple-700 transition-colors">
                Upload CSV or Excel file
              </p>
              <p className="text-xs text-content-neutral-400 mt-1">
                Drag and drop your catalog spreadsheet here or click to browse
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between px-1 text-xs text-content-neutral-500">
              <span>Supports CSV; export Excel sheets as CSV first.</span>
              <button
                type="button"
                onClick={() => setShowImportInfoModal(true)}
                className="text-content-purple-600 hover:text-content-purple-700 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
              >
                <Info className="w-3.5 h-3.5" />
                <span>File Format Guide & Template</span>
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-line-neutral-100">
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="px-4 py-2 text-sm text-content-neutral-600 hover:bg-surface-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Choose File to Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Invoice for Catalog Item Modal */}
      {quickInvoiceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl border border-line-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-line-neutral-100">
              <div>
                <h3 className="text-lg font-semibold text-content-neutral-900">
                  Create Invoice from Catalog Item
                </h3>
                <p className="text-xs text-content-neutral-400 mt-0.5">
                  Generate a draft invoice linked to this standardized service/product.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickInvoiceItem(null)}
                className="text-content-neutral-400 hover:text-content-neutral-600 p-1.5 rounded-lg hover:bg-surface-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="mt-5 space-y-4">
              {/* Item Summary Info Box */}
              <div className="p-3.5 bg-surface-neutral-50 rounded-xl border border-line-neutral-200/80 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface border border-line-neutral-200 flex items-center justify-center shrink-0">
                  {renderIcon(quickInvoiceItem.iconType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-content-neutral-900 truncate">
                    {quickInvoiceItem.title}
                  </div>
                  <div className="text-xs text-content-neutral-500 flex items-center gap-2 mt-0.5">
                    <span>SKU: {quickInvoiceItem.sku}</span>
                    <span>•</span>
                    <span className="font-medium text-content-neutral-700">
                      Standard: {formatPriceWithCurrency(quickInvoiceItem.price, quickInvoiceItem.currency)} {quickInvoiceItem.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Client Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                    Billed Client <span className="text-content-purple-600">*</span>
                  </label>
                  <a
                    href="/clients"
                    className="text-xs text-content-purple-600 hover:text-content-purple-700 hover:underline"
                  >
                    + Manage Clients
                  </a>
                </div>
                {clients.length === 0 ? (
                  <div className="p-3 bg-surface-amber-50 border border-line-amber-200 rounded-xl text-xs text-content-amber-800">
                    No clients found. Please add a client first to create invoices.
                  </div>
                ) : (
                  <select
                    required
                    value={invoiceClientId}
                    onChange={(e) => setInvoiceClientId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.category ? `(${c.category})` : ""} {c.email ? `• ${c.email}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Price and Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Invoice Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={invoiceCurrency}
                    onChange={(e) => setInvoiceCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 bg-surface focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600 cursor-pointer"
                  >
                    <option value="LKR">LKR (Rs. Sri Lankan Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                    <option value="EUR">EUR (€ Euro)</option>
                    <option value="GBP">GBP (£ British Pound)</option>
                    <option value="CAD">CAD ($ Canadian Dollar)</option>
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-line-neutral-200 text-sm text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-line-purple-500/20 focus:border-line-purple-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100">
                <button
                  type="button"
                  onClick={() => setQuickInvoiceItem(null)}
                  className="px-4 py-2 text-sm text-content-neutral-600 hover:bg-surface-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving || clients.length === 0}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Information / Guide Modal */}
      {showImportInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="import-guide-modal animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-line-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-purple-50 text-content-purple-600 flex items-center justify-center border border-line-purple-100 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-content-neutral-900">
                    Bulk Import File Format Guide
                  </h3>
                  <p className="text-xs text-content-neutral-500 mt-0.5">
                    How to structure CSV files, including sheets exported from Excel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportInfoModal(false)}
                className="text-content-neutral-400 hover:text-content-neutral-600 p-1.5 rounded-lg hover:bg-surface-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Tabs */}
            <div className="mt-4">
              <div className="import-guide-tab-bar">
                <button
                  type="button"
                  onClick={() => setActiveGuideTab("table")}
                  className={`import-guide-tab ${activeGuideTab === "table" ? "import-guide-tab-active" : ""}`}
                >
                  Column Structure & Rules
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGuideTab("csv")}
                  className={`import-guide-tab ${activeGuideTab === "csv" ? "import-guide-tab-active" : ""}`}
                >
                  Sample CSV Format
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGuideTab("excel")}
                  className={`import-guide-tab ${activeGuideTab === "excel" ? "import-guide-tab-active" : ""}`}
                >
                  Excel → CSV Guidelines
                </button>
              </div>
            </div>

            {/* Tab 1: Column Structure & Rules */}
            {activeGuideTab === "table" && (
              <div className="mt-5 space-y-4">
                <div className="overflow-x-auto rounded-xl border border-line-neutral-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface-neutral-50 border-b border-line-neutral-200 text-content-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">Column Name</th>
                        <th className="py-2.5 px-3">Required</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Example Values</th>
                        <th className="py-2.5 px-3">Description & Valid Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-neutral-100 text-content-neutral-700">
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-content-neutral-900 bg-surface-neutral-50/50">title</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-emerald-100 text-content-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-content-neutral-500">Text</td>
                        <td className="py-2.5 px-3 font-medium text-content-neutral-900">Full-Stack Sprint</td>
                        <td className="py-2.5 px-3 text-content-neutral-600">The product or service name displayed in catalog.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-content-neutral-900 bg-surface-neutral-50/50">category</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-emerald-100 text-content-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-content-neutral-500">Option</td>
                        <td className="py-2.5 px-3 font-medium text-content-purple-700">Development</td>
                        <td className="py-2.5 px-3 text-content-neutral-600">
                          Must be one of: <strong className="text-content-neutral-900">Development</strong>, <strong className="text-content-neutral-900">Design</strong>, <strong className="text-content-neutral-900">Consulting</strong>, <strong className="text-content-neutral-900">Licensing</strong>.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-content-neutral-900 bg-surface-neutral-50/50">sku</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-emerald-100 text-content-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-content-neutral-500">Text</td>
                        <td className="py-2.5 px-3 font-mono text-content-neutral-800">DEV-FS-01</td>
                        <td className="py-2.5 px-3 text-content-neutral-600">
                          Stock Keeping Unit code (unique product code identifier).
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-content-neutral-900 bg-surface-neutral-50/50">price</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-emerald-100 text-content-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-content-neutral-500">Number</td>
                        <td className="py-2.5 px-3 font-semibold text-content-neutral-900">250000.00</td>
                        <td className="py-2.5 px-3 text-content-neutral-600">
                          Plain numeric amount. Do not include currency symbols ($ or Rs.).
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-content-neutral-900 bg-surface-neutral-50/50">currency</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-neutral-100 text-content-neutral-600">
                            OPTIONAL
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-content-neutral-500">Code (3-letter)</td>
                        <td className="py-2.5 px-3 font-medium text-content-neutral-900">LKR</td>
                        <td className="py-2.5 px-3 text-content-neutral-600">
                          Currency code: <strong className="text-content-neutral-900">LKR</strong> (Sri Lankan Rupees), <strong className="text-content-neutral-900">USD</strong>, <strong className="text-content-neutral-900">EUR</strong>, <strong className="text-content-neutral-900">GBP</strong>, <strong className="text-content-neutral-900">CAD</strong>. Defaults to LKR.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-content-neutral-900 bg-surface-neutral-50/50">unit</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-neutral-100 text-content-neutral-600">
                            OPTIONAL
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-content-neutral-500">Text</td>
                        <td className="py-2.5 px-3 font-medium text-content-neutral-900">sprint</td>
                        <td className="py-2.5 px-3 text-content-neutral-600">
                          e.g. <span className="font-mono">/ Hourly</span>, <span className="font-mono">package</span>, <span className="font-mono">sprint</span>, <span className="font-mono">month</span>, <span className="font-mono">license</span>. Defaults to / Hourly.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-content-neutral-900 bg-surface-neutral-50/50">description</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-neutral-100 text-content-neutral-600">
                            OPTIONAL
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-content-neutral-500">Text</td>
                        <td className="py-2.5 px-3 text-content-neutral-700">Scope deliverable details...</td>
                        <td className="py-2.5 px-3 text-content-neutral-600">
                          Detailed description of the deliverables and scope.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-3.5 bg-surface-purple-50/70 border border-line-purple-200/80 rounded-xl text-xs text-content-purple-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-content-purple-600 shrink-0" />
                    Important Header Row Requirement
                  </p>
                  <p className="text-content-purple-800">
                    Row 1 of your spreadsheet must contain the exact column names above (in any case). Data rows start immediately on Row 2.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Sample CSV Format */}
            {activeGuideTab === "csv" && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-content-neutral-700">
                    Raw CSV Text Example (.csv)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copySampleCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-neutral-200 text-xs font-medium text-content-neutral-700 hover:bg-surface-neutral-50 transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-content-emerald-600" />
                          <span className="text-content-emerald-700 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-content-neutral-500" />
                          <span>Copy CSV</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={downloadSampleCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Sample CSV Template</span>
                    </button>
                  </div>
                </div>

                <pre className="import-guide-code-box">
{`title,category,sku,price,currency,unit,description
"Full-Stack Web Application","Development","DEV-FS-01",250000.00,"LKR","sprint","Complete Next.js, Node.js and SQLite development sprint"
"Brand Identity & Design System","Design","DSGN-UI-02",95000.00,"LKR","package","Logo system, Figma UI kit, and typography standards"
"Cloud Infrastructure Assessment","Consulting","CONS-AUD-03",60000.00,"LKR","audit","Security, Docker deployment, and database performance review"
"Enterprise Software License","Licensing","LIC-PRO-04",350000.00,"LKR","year","Multi-seat business software license with ongoing updates"`}
                </pre>

                <div className="p-3 bg-surface-neutral-50 border border-line-neutral-200 rounded-xl text-xs text-content-neutral-600 space-y-1">
                  <p className="font-semibold text-content-neutral-800">CSV Formatting Best Practices:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-content-neutral-600">
                    <li>Wrap text containing commas or special characters in double quotation marks <code className="bg-surface-neutral-200 px-1 py-0.5 rounded">&quot;...&quot;</code>.</li>
                    <li>Ensure UTF-8 encoding so international symbols and characters preserve cleanly.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 3: Excel → CSV Guidelines */}
            {activeGuideTab === "excel" && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/60 space-y-2">
                    <span className="text-xs font-bold text-content-neutral-900 uppercase tracking-wider block">
                      Excel Spreadsheet Layout — Save as CSV (UTF-8) before importing
                    </span>
                    <ul className="text-xs text-content-neutral-600 space-y-1.5">
                      <li>• <strong>Column A:</strong> <span className="font-mono text-content-neutral-800">title</span> (Product or service name)</li>
                      <li>• <strong>Column B:</strong> <span className="font-mono text-content-neutral-800">category</span> (Development, Design, Consulting, Licensing)</li>
                      <li>• <strong>Column C:</strong> <span className="font-mono text-content-neutral-800">sku</span> (Unique code, e.g. DEV-001)</li>
                      <li>• <strong>Column D:</strong> <span className="font-mono text-content-neutral-800">price</span> (Numeric value only)</li>
                      <li>• <strong>Column E:</strong> <span className="font-mono text-content-neutral-800">currency</span> (LKR, USD, EUR, GBP, CAD)</li>
                      <li>• <strong>Column F:</strong> <span className="font-mono text-content-neutral-800">unit</span> (/ Hourly, sprint, package, etc.)</li>
                      <li>• <strong>Column G:</strong> <span className="font-mono text-content-neutral-800">description</span> (Detailed scope)</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/60 space-y-2">
                    <span className="text-xs font-bold text-content-neutral-900 uppercase tracking-wider block">
                      Do&apos;s and Don&apos;ts in Excel
                    </span>
                    <ul className="text-xs space-y-1.5 text-content-neutral-600">
                      <li className="text-content-emerald-700">✓ <strong>DO</strong> format the Price column as General or Number.</li>
                      <li className="text-content-emerald-700">✓ <strong>DO</strong> start your data on row 2 right after headers.</li>
                      <li className="text-content-rose-700">✗ <strong>DO NOT</strong> type currency signs like &quot;Rs.&quot; or &quot;$&quot; inside the Price cell.</li>
                      <li className="text-content-rose-700">✗ <strong>DO NOT</strong> merge cells or leave empty rows between items.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-5 mt-6 border-t border-line-neutral-100">
              <button
                type="button"
                onClick={() => setShowImportInfoModal(false)}
                className="px-5 py-2 text-xs font-semibold text-content-neutral-700 bg-surface-neutral-100 hover:bg-surface-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Got it, Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
