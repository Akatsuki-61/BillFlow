"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import "./catalog.css";

export interface CatalogItem {
  id: string;
  title: string;
  category: "Development" | "Design" | "Consulting" | "Licensing";
  sku: string;
  description: string;
  price: string;
  currency: string;
  unit: string;
  iconType: "code" | "design" | "cloud" | "consulting";
}

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

const initialCatalogItems: CatalogItem[] = [
  {
    id: "1",
    title: "Senior Full-Stack Development",
    category: "Development",
    sku: "DEV-001",
    description:
      "Architecture design, API implementation, and frontend React development.",
    price: "Rs. 45,000.00",
    currency: "LKR",
    unit: "/ Hourly",
    iconType: "code",
  },
  {
    id: "2",
    title: "UI/UX Design Sprint",
    category: "Design",
    sku: "DES-042",
    description:
      "Comprehensive wireframing, high-fidelity prototyping, and user testing sessions.",
    price: "Rs. 360,000.00",
    currency: "LKR",
    unit: "/ Daily",
    iconType: "design",
  },
  {
    id: "3",
    title: "Enterprise Server License",
    category: "Licensing",
    sku: "LIC-991",
    description:
      "Annual license for self-hosted enterprise infrastructure deployment.",
    price: "Rs. 1,500,000.00",
    currency: "LKR",
    unit: "/ Unit",
    iconType: "cloud",
  },
];

const categoryList = [
  "All Items",
  "Development",
  "Design",
  "Consulting",
  "Licensing",
] as const;

type Category = (typeof categoryList)[number];

export default function CatalogView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("All Items");
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(initialCatalogItems);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modals state
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showImportInfoModal, setShowImportInfoModal] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<"table" | "csv" | "excel">("table");
  const [copied, setCopied] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);

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

    navigator.clipboard.writeText(csvText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // New Item Form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<"Development" | "Design" | "Consulting" | "Licensing">("Development");
  const [newSku, setNewSku] = useState("DEV-002");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState("LKR");
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

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedPrice = formatPriceWithCurrency(newPrice, newCurrency);

    const iconTypeMap: Record<string, "code" | "design" | "cloud" | "consulting"> = {
      Development: "code",
      Design: "design",
      Licensing: "cloud",
      Consulting: "consulting",
    };

    const newItem: CatalogItem = {
      id: Date.now().toString(),
      title: newTitle.trim() || "New Catalog Item",
      category: newCategory,
      sku: newSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      description: newDescription.trim() || "Standard product/service unit description.",
      price: formattedPrice,
      currency: newCurrency,
      unit: newUnit,
      iconType: iconTypeMap[newCategory] || "code",
    };

    setCatalogItems([newItem, ...catalogItems]);
    setShowNewItemModal(false);

    // Reset Form
    setNewTitle("");
    setNewSku(`SKU-0${catalogItems.length + 50}`);
    setNewPrice("");
    setNewDescription("");
    setNewCurrency("LKR");
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

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const formattedPrice = formatPriceWithCurrency(editPrice, editCurrency);

    const iconTypeMap: Record<string, "code" | "design" | "cloud" | "consulting"> = {
      Development: "code",
      Design: "design",
      Licensing: "cloud",
      Consulting: "consulting",
    };

    setCatalogItems((prev) =>
      prev.map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            title: editTitle.trim() || item.title,
            category: editCategory,
            sku: editSku.trim() || item.sku,
            price: formattedPrice,
            currency: editCurrency,
            unit: editUnit,
            description: editDescription.trim() || item.description,
            iconType: iconTypeMap[editCategory] || item.iconType,
          };
        }
        return item;
      })
    );

    setEditingItem(null);
  };

  const handleConfirmDelete = () => {
    if (deletingItem) {
      setCatalogItems((prev) => prev.filter((item) => item.id !== deletingItem.id));
      setDeletingItem(null);
      setOpenMenuId(null);
    }
  };

  const renderIcon = (type: CatalogItem["iconType"]) => {
    switch (type) {
      case "code":
        return <Code2 className="w-5 h-5 text-neutral-700" strokeWidth={1.8} />;
      case "design":
        return <Pencil className="w-4.5 h-4.5 text-neutral-700" strokeWidth={1.8} />;
      case "cloud":
        return <Cloud className="w-5 h-5 text-neutral-700" strokeWidth={1.8} />;
      case "consulting":
      default:
        return <Briefcase className="w-5 h-5 text-neutral-700" strokeWidth={1.8} />;
    }
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto px-8 py-8 md:px-12 md:py-10 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="font-serif-heading text-4xl md:text-[46px] font-normal tracking-tight text-neutral-900 leading-tight">
            Catalog
          </h1>
          <p className="text-neutral-500 text-sm md:text-[15px] mt-1.5 font-normal">
            Manage standardized products, services, and pricing units.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] rounded-xl">
            <button
              type="button"
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-l-xl text-neutral-800 text-[13px] font-medium hover:bg-neutral-50 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-neutral-700" strokeWidth={1.8} />
              <span>Bulk Import</span>
            </button>
            <button
              type="button"
              onClick={() => setShowImportInfoModal(true)}
              title="Bulk Import File Format Guide (CSV & Excel)"
              className="flex items-center justify-center px-2.5 py-2.5 bg-white border-y border-r border-neutral-200/90 hover:border-neutral-300 rounded-r-xl text-neutral-500 hover:text-purple-600 hover:bg-purple-50/50 transition-all cursor-pointer group"
            >
              <Info className="w-4 h-4 text-neutral-500 group-hover:text-purple-600 transition-colors" strokeWidth={2} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNewItemModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-[13px] font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={2.4} />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Controls + Right Catalog Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Search, Categories, Total Items Card) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Search & Categories Box */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#F8F9FA] rounded-xl border border-neutral-200/70 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
              />
            </div>

            {/* Categories Section */}
            <div className="mt-5">
              <span className="block text-[11px] font-bold tracking-wider text-neutral-400 uppercase mb-3">
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
                          ? "bg-neutral-950 text-white font-semibold shadow-xs"
                          : "bg-white border border-neutral-200/80 text-neutral-700 font-medium hover:bg-neutral-50 hover:text-neutral-900"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Total Items Metric Card */}
          <div className="relative overflow-hidden bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="catalog-items-glow" />
            <span className="block text-[11px] font-bold tracking-wider text-neutral-400 uppercase mb-2">
              Total Items
            </span>
            <div className="text-4xl md:text-[42px] font-bold text-neutral-900 tracking-tight leading-none">
              {139 + catalogItems.length}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-normal mt-4">
              <TrendingUp className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              <span className="font-bold text-emerald-600">+12</span>
              <span className="text-neutral-500">this month</span>
            </div>
          </div>
        </div>

        {/* Right Column (Catalog List Container) */}
        <div className="lg:col-span-8 bg-[#EAE8E3]/85 rounded-3xl border border-neutral-300/60 p-6 md:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[540px]">
          <div>
            {/* Header Labels */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-300/60 text-[11px] font-bold tracking-wider text-neutral-500 uppercase">
              <span>Item Details</span>
              <span>Unit / Price</span>
            </div>

            {/* Catalog Items Rows */}
            <div className="divide-y divide-neutral-300/60">
              {filteredItems.length === 0 ? (
                <div className="py-16 text-center text-sm text-neutral-500">
                  No catalog items found matching your criteria.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div key={item.id} className="py-5 flex items-start gap-4">
                    {/* Left Icon Badge */}
                    <div className="w-10 h-10 rounded-xl bg-white/90 border border-neutral-300/70 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      {renderIcon(item.iconType)}
                    </div>

                    {/* Middle Details & Description */}
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-base md:text-[17px] font-bold text-neutral-900 leading-snug tracking-tight">
                        {item.title}
                      </h3>

                      {/* Category Badge & SKU */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/90 border border-neutral-300/80 text-neutral-600">
                          {item.category}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">
                          SKU: {item.sku}
                        </span>
                      </div>

                      {/* Description Box */}
                      <div className="mt-3 px-3.5 py-2.5 bg-white/85 rounded-xl border border-neutral-300/80 text-xs text-neutral-700 leading-relaxed font-normal shadow-2xs">
                        {item.description}
                      </div>
                    </div>

                    {/* Right Price, Unit & 3-Dots Menu */}
                    <div className="flex items-start gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-lg md:text-xl font-bold text-neutral-900 tracking-tight leading-none">
                          {item.price}
                        </div>
                        <div className="text-xs text-neutral-500 font-medium mt-1">
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
                              ? "bg-neutral-300/70 text-neutral-900"
                              : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-300/50"
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

                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-neutral-200/90 py-1.5 z-40 text-left text-xs animate-in fade-in zoom-in-95 duration-100 font-medium">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                                <span>Edit Item</span>
                              </button>

                              <div className="my-1 border-t border-neutral-100" />

                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingItem(item);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 hover:bg-red-50/80 transition-colors cursor-pointer"
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
          <div className="pt-6 mt-4 border-t border-neutral-300/60 flex items-center justify-between text-xs text-neutral-500">
            <div>
              Showing 1-{filteredItems.length} of {139 + catalogItems.length} items
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="w-7 h-7 rounded-lg bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                className="w-7 h-7 rounded-lg bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
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
          <div className="bg-white w-full max-w-lg rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Edit Catalog Item
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Update item specifications, price, currency, or description.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Item Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) =>
                      setEditCategory(
                        e.target.value as "Development" | "Design" | "Consulting" | "Licensing"
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Licensing">Licensing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    SKU Code <span className="normal-case font-normal text-neutral-400">(Stock Keeping Unit)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    <option value="LKR">LKR (Rs. Sri Lankan Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                    <option value="EUR">EUR (€ Euro)</option>
                    <option value="GBP">GBP (£ British Pound)</option>
                    <option value="CAD">CAD ($ Canadian Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Pricing Unit
                  </label>
                  <select
                    value={editUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Item Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
          <div className="bg-white w-full max-w-md rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Delete Catalog Item?
                </h3>
                <p className="text-xs text-neutral-500">
                  This action will permanently remove this item from your catalog.
                </p>
              </div>
            </div>

            <p className="text-sm text-neutral-600 mt-2">
              Are you sure you want to delete <strong className="text-neutral-900">{deletingItem.title}</strong> ({deletingItem.sku}) valued at <strong className="text-neutral-900">{deletingItem.price} {deletingItem.unit}</strong>?
            </p>

            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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
          <div className="bg-white w-full max-w-lg rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  New Catalog Item
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Define a standardized product, service, or pricing unit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewItemModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Item Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Development"
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) =>
                      setNewCategory(
                        e.target.value as "Development" | "Design" | "Consulting" | "Licensing"
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Licensing">Licensing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    SKU Code <span className="normal-case font-normal text-neutral-400">(Stock Keeping Unit)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="e.g. DEV-001"
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="45000.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    <option value="LKR">LKR (Rs. Sri Lankan Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                    <option value="EUR">EUR (€ Euro)</option>
                    <option value="GBP">GBP (£ British Pound)</option>
                    <option value="CAD">CAD ($ Canadian Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Pricing Unit
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Item Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the scope, deliverables, or specifications of this item..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
          <div className="bg-white w-full max-w-md rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-neutral-900">
                  Bulk Import Items
                </h3>
                <button
                  type="button"
                  onClick={() => setShowImportInfoModal(true)}
                  title="View CSV / Excel format guide"
                  className="p-1 text-neutral-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-8 border-2 border-dashed border-neutral-200 rounded-2xl text-center hover:border-purple-400 transition-colors cursor-pointer">
              <FileSpreadsheet className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-neutral-800">
                Upload CSV or Excel file
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Drag and drop your catalog spreadsheet here or click to browse
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between px-1 text-xs text-neutral-500">
              <span>Supports .csv and .xlsx files</span>
              <button
                type="button"
                onClick={() => setShowImportInfoModal(true)}
                className="text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
              >
                <Info className="w-3.5 h-3.5" />
                <span>File Format Guide & Template</span>
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Information / Guide Modal */}
      {showImportInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="import-guide-modal animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">
                    Bulk Import File Format Guide
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    How to structure your CSV or Excel (.xlsx) file to import catalog items correctly.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportInfoModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
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
                  Excel (.xlsx) Guidelines
                </button>
              </div>
            </div>

            {/* Tab 1: Column Structure & Rules */}
            {activeGuideTab === "table" && (
              <div className="mt-5 space-y-4">
                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">Column Name</th>
                        <th className="py-2.5 px-3">Required</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Example Values</th>
                        <th className="py-2.5 px-3">Description & Valid Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 bg-neutral-50/50">title</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">Text</td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900">Full-Stack Sprint</td>
                        <td className="py-2.5 px-3 text-neutral-600">The product or service name displayed in catalog.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 bg-neutral-50/50">category</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">Option</td>
                        <td className="py-2.5 px-3 font-medium text-purple-700">Development</td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          Must be one of: <strong className="text-neutral-900">Development</strong>, <strong className="text-neutral-900">Design</strong>, <strong className="text-neutral-900">Consulting</strong>, <strong className="text-neutral-900">Licensing</strong>.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 bg-neutral-50/50">sku</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">Text</td>
                        <td className="py-2.5 px-3 font-mono text-neutral-800">DEV-FS-01</td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          Stock Keeping Unit code (unique product code identifier).
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 bg-neutral-50/50">price</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            REQUIRED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">Number</td>
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">250000.00</td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          Plain numeric amount. Do not include currency symbols ($ or Rs.).
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 bg-neutral-50/50">currency</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600">
                            OPTIONAL
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">Code (3-letter)</td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900">LKR</td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          Currency code: <strong className="text-neutral-900">LKR</strong> (Sri Lankan Rupees), <strong className="text-neutral-900">USD</strong>, <strong className="text-neutral-900">EUR</strong>, <strong className="text-neutral-900">GBP</strong>, <strong className="text-neutral-900">CAD</strong>. Defaults to LKR.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 bg-neutral-50/50">unit</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600">
                            OPTIONAL
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">Text</td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900">sprint</td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          e.g. <span className="font-mono">/ Hourly</span>, <span className="font-mono">package</span>, <span className="font-mono">sprint</span>, <span className="font-mono">month</span>, <span className="font-mono">license</span>. Defaults to / Hourly.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 bg-neutral-50/50">description</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600">
                            OPTIONAL
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500">Text</td>
                        <td className="py-2.5 px-3 text-neutral-700">Scope deliverable details...</td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          Detailed description of the deliverables and scope.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-3.5 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs text-purple-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-purple-600 shrink-0" />
                    Important Header Row Requirement
                  </p>
                  <p className="text-purple-800">
                    Row 1 of your spreadsheet must contain the exact column names above (in any case). Data rows start immediately on Row 2.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Sample CSV Format */}
            {activeGuideTab === "csv" && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700">
                    Raw CSV Text Example (.csv)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copySampleCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neutral-500" />
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

                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 space-y-1">
                  <p className="font-semibold text-neutral-800">CSV Formatting Best Practices:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-neutral-600">
                    <li>Wrap text containing commas or special characters in double quotation marks <code className="bg-neutral-200 px-1 py-0.5 rounded">&quot;...&quot;</code>.</li>
                    <li>Ensure UTF-8 encoding so international symbols and characters preserve cleanly.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 3: Excel (.xlsx) Guidelines */}
            {activeGuideTab === "excel" && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-2">
                    <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider block">
                      Excel Spreadsheet Layout
                    </span>
                    <ul className="text-xs text-neutral-600 space-y-1.5">
                      <li>• <strong>Column A:</strong> <span className="font-mono text-neutral-800">title</span> (Product or service name)</li>
                      <li>• <strong>Column B:</strong> <span className="font-mono text-neutral-800">category</span> (Development, Design, Consulting, Licensing)</li>
                      <li>• <strong>Column C:</strong> <span className="font-mono text-neutral-800">sku</span> (Unique code, e.g. DEV-001)</li>
                      <li>• <strong>Column D:</strong> <span className="font-mono text-neutral-800">price</span> (Numeric value only)</li>
                      <li>• <strong>Column E:</strong> <span className="font-mono text-neutral-800">currency</span> (LKR, USD, EUR, GBP, CAD)</li>
                      <li>• <strong>Column F:</strong> <span className="font-mono text-neutral-800">unit</span> (/ Hourly, sprint, package, etc.)</li>
                      <li>• <strong>Column G:</strong> <span className="font-mono text-neutral-800">description</span> (Detailed scope)</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-2">
                    <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider block">
                      Do&apos;s and Don&apos;ts in Excel
                    </span>
                    <ul className="text-xs space-y-1.5 text-neutral-600">
                      <li className="text-emerald-700">✓ <strong>DO</strong> format the Price column as General or Number.</li>
                      <li className="text-emerald-700">✓ <strong>DO</strong> start your data on row 2 right after headers.</li>
                      <li className="text-rose-700">✗ <strong>DO NOT</strong> type currency signs like &quot;Rs.&quot; or &quot;$&quot; inside the Price cell.</li>
                      <li className="text-rose-700">✗ <strong>DO NOT</strong> merge cells or leave empty rows between items.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-5 mt-6 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowImportInfoModal(false)}
                className="px-5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
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
