"use client";

import {
  Button,
  PageHeader,
  MetricCard,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState } from "react";
import {
  Upload,
  Plus,
  Search,
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
} from "lucide-react";

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

const initialCatalogItems: CatalogItem[] = [];

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
  const [selectedCategory, setSelectedCategory] =
    useState<Category>("All Items");
  const [catalogItems, setCatalogItems] =
    useState<CatalogItem[]>(initialCatalogItems);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modals state
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);

  // New Item Form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<
    "Development" | "Design" | "Consulting" | "Licensing"
  >("Development");
  const [newSku, setNewSku] = useState("DEV-002");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState("LKR");
  const [newUnit, setNewUnit] = useState("/ Hourly");
  const [newDescription, setNewDescription] = useState("");

  // Edit Item Form state
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<
    "Development" | "Design" | "Consulting" | "Licensing"
  >("Development");
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

    const iconTypeMap: Record<
      string,
      "code" | "design" | "cloud" | "consulting"
    > = {
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
      description:
        newDescription.trim() || "Standard product/service unit description.",
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

    const iconTypeMap: Record<
      string,
      "code" | "design" | "cloud" | "consulting"
    > = {
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
      }),
    );

    setEditingItem(null);
  };

  const handleConfirmDelete = () => {
    if (deletingItem) {
      setCatalogItems((prev) =>
        prev.filter((item) => item.id !== deletingItem.id),
      );
      setDeletingItem(null);
      setOpenMenuId(null);
    }
  };

  const renderIcon = (type: CatalogItem["iconType"]) => {
    switch (type) {
      case "code":
        return <Code2 className="w-5 h-5 text-neutral-700" strokeWidth={1.8} />;
      case "design":
        return (
          <Pencil className="w-4.5 h-4.5 text-neutral-700" strokeWidth={1.8} />
        );
      case "cloud":
        return <Cloud className="w-5 h-5 text-neutral-700" strokeWidth={1.8} />;
      case "consulting":
      default:
        return (
          <Briefcase className="w-5 h-5 text-neutral-700" strokeWidth={1.8} />
        );
    }
  };

  return (
    <div className="workspace-page motion-page">
      {/* Top Header */}
      <PageHeader
        title="Catalog"
        description="Manage standardized products, services, and pricing units."
      >
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setShowBulkImportModal(true)}
          >
            <Upload className="w-4 h-4 text-neutral-700" strokeWidth={1.8} />
            <span>Bulk Import</span>
          </Button>

          <Button
            variant="primary"
            type="button"
            onClick={() => setShowNewItemModal(true)}
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={2.4} />
            <span>New Item</span>
          </Button>
        </div>
      </PageHeader>

      {/* Main Split Layout: Left Controls + Right Catalog Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Search, Categories, Total Items Card) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Search & Categories Box */}
          <div className="ui-card p-5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog..."
                className="ui-field w-full pl-9 pr-3.5 border border-neutral-200/70 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
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
                    <Button
                      variant={isActive ? "primary" : "secondary"}
                      size="small"
                      aria-pressed={isActive}
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Total Items Metric Card */}
          <MetricCard
            label="Total Items"
            value={catalogItems.length}
            footer="services and products"
          />
        </div>

        {/* Right Column (Catalog List Container) */}
        <div className="ui-card lg:col-span-8 p-6 md:p-8 flex flex-col justify-between min-h-[360px]">
          <div>
            {/* Header Labels */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-300/60 text-[11px] font-bold tracking-wider text-neutral-500 uppercase">
              <span>Item Details</span>
              <span>Unit / Price</span>
            </div>

            {/* Catalog Items Rows */}
            <div className="divide-y divide-neutral-300/60">
              {filteredItems.length === 0 ? (
                <EmptyState
                  title={
                    catalogItems.length === 0
                      ? "No catalog items yet"
                      : "No matching items"
                  }
                  description={
                    catalogItems.length === 0
                      ? "Add your services and products to keep pricing consistent across invoices."
                      : "Try another category or search term."
                  }
                >
                  {catalogItems.length === 0 && (
                    <Button
                      variant="primary"
                      onClick={() => setShowNewItemModal(true)}
                    >
                      <Plus />
                      New Item
                    </Button>
                  )}
                </EmptyState>
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
                            setOpenMenuId(
                              openMenuId === item.id ? null : item.id,
                            )
                          }
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            openMenuId === item.id
                              ? "bg-neutral-300/70 text-neutral-900"
                              : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-300/50"
                          }`}
                          aria-label={`Options for ${item.title}`}
                          aria-expanded={openMenuId === item.id}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        <MotionPresence>
                          {openMenuId === item.id && (
                            <MotionSurface kind="group">
                              {/* Backdrop */}
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setOpenMenuId(null)}
                              />

                              <MotionSurface
                                kind="menu"
                                className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-neutral-200/90 py-1.5 z-40 text-left text-xs font-medium"
                              >
                                <Button
                                  variant="ghost"
                                  type="button"
                                  onClick={() => handleOpenEdit(item)}
                                  className="w-full"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                                  <span>Edit Item</span>
                                </Button>

                                <div className="my-1 border-t border-neutral-100" />

                                <Button
                                  variant="danger"
                                  type="button"
                                  onClick={() => {
                                    setDeletingItem(item);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Delete Item</span>
                                </Button>
                              </MotionSurface>
                            </MotionSurface>
                          )}
                        </MotionPresence>
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
              Showing {filteredItems.length} of {catalogItems.length} items
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                type="button"

                disabled
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                type="button"

                disabled
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      <MotionPresence>
        {editingItem && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <MotionSurface onDismiss={() => setEditingItem(null)}
              kind="panel"
              className="bg-white w-full max-w-lg rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 font-sans"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Edit Catalog Item
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Update item specifications, price, currency, or description.
                  </p>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setEditingItem(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
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
                    className="ui-field w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
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
                          e.target.value as
                            | "Development"
                            | "Design"
                            | "Consulting"
                            | "Licensing",
                        )
                      }
                      className="ui-field w-full px-3 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                    >
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Licensing">Licensing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      SKU Code{" "}
                      <span className="normal-case font-normal text-neutral-400">
                        (Stock Keeping Unit)
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editSku}
                      onChange={(e) => setEditSku(e.target.value)}
                      className="ui-field w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
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
                      className="ui-field w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value)}
                      className="ui-field w-full px-3 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
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
                      className="ui-field w-full px-3 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
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
                    className="ui-field ui-textarea w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setEditingItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Save Changes
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Delete Item Confirmation Modal */}
      <MotionPresence>
        {deletingItem && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <MotionSurface onDismiss={() => setDeletingItem(null)}
              kind="panel"
              className="bg-white w-full max-w-md rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 font-sans"
            >
              <div className="flex items-center gap-3 text-red-600 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    Delete Catalog Item?
                  </h3>
                  <p className="text-xs text-neutral-500">
                    This action will permanently remove this item from your
                    catalog.
                  </p>
                </div>
              </div>

              <p className="text-sm text-neutral-600 mt-2">
                Are you sure you want to delete{" "}
                <strong className="text-neutral-900">
                  {deletingItem.title}
                </strong>{" "}
                ({deletingItem.sku}) valued at{" "}
                <strong className="text-neutral-900">
                  {deletingItem.price} {deletingItem.unit}
                </strong>
                ?
              </p>

              <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-neutral-100">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setDeletingItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  onClick={handleConfirmDelete}
                >
                  Delete Item
                </Button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* New Item Modal */}
      <MotionPresence>
        {showNewItemModal && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <MotionSurface onDismiss={() => setShowNewItemModal(false)}
              kind="panel"
              className="bg-white w-full max-w-lg rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 font-sans"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    New Catalog Item
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Define a standardized product, service, or pricing unit.
                  </p>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
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
                    className="ui-field w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
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
                          e.target.value as
                            | "Development"
                            | "Design"
                            | "Consulting"
                            | "Licensing",
                        )
                      }
                      className="ui-field w-full px-3 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                    >
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Licensing">Licensing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      SKU Code{" "}
                      <span className="normal-case font-normal text-neutral-400">
                        (Stock Keeping Unit)
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newSku}
                      onChange={(e) => setNewSku(e.target.value)}
                      placeholder="e.g. DEV-001"
                      className="ui-field w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
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
                      className="ui-field w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value)}
                      className="ui-field w-full px-3 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
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
                      className="ui-field w-full px-3 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
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
                    className="ui-field ui-textarea w-full px-3.5 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setShowNewItemModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Create Item
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Bulk Import Modal */}
      <MotionPresence>
        {showBulkImportModal && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <MotionSurface onDismiss={() => setShowBulkImportModal(false)}
              kind="panel"
              className="bg-white w-full max-w-md rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 font-sans"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                <h3 className="text-lg font-semibold text-neutral-900">
                  Bulk Import Items
                </h3>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
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

              <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-neutral-100">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                >
                  Import
                </Button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
