"use client";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState } from "react";
import {
  UserPlus,
  MoreVertical,
  User,
  Mail,
  Phone,
  Clock,
  Zap,
  FolderClosed,
  ExternalLink,
  X,
  CheckCircle2,
  Trash2,
  Building,
} from "lucide-react";

interface ClientRecord {
  id: string;
  name: string;
  category: "Enterprise" | "Startup" | "Agency" | string;
  contactPerson: string;
  contactRole?: string;
  email: string;
  phone?: string;
  currency: "USD" | "LKR" | "EUR";
  driveUrl?: string;
  avatarType: "apex" | "nexus" | "vanguard" | "custom";
  customAvatarLetter?: string;
  hasQuickBill: boolean;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  invoicesCount: number;
  recentInvoices?: {
    id: string;
    date: string;
    amount: number;
    status: "Paid" | "Partial Paid" | "Sent" | "Draft";
  }[];
}

const initialClients: ClientRecord[] = [
  {
    id: "cli-1",
    name: "Apex Architecture",
    category: "Enterprise",
    contactPerson: "Sarah Jenkins",
    contactRole: "Director",
    email: "sarah.j@apexarch.com",
    phone: "+1 (555) 284-9102",
    currency: "USD",
    driveUrl: "https://drive.google.com/drive/folders/apex-architecture",
    avatarType: "apex",
    hasQuickBill: true,
    totalBilled: 14500,
    totalPaid: 12000,
    outstandingBalance: 2500,
    invoicesCount: 6,
    recentInvoices: [
      { id: "INV-2023-089", date: "Oct 15, 2023", amount: 4500, status: "Paid" },
      { id: "INV-2023-094", date: "Oct 28, 2023", amount: 2500, status: "Sent" },
    ],
  },
  {
    id: "cli-2",
    name: "Nexus Tech",
    category: "Startup",
    contactPerson: "David Chen",
    contactRole: "CEO",
    email: "d.chen@nexus.io",
    phone: "+1 (555) 892-3314",
    currency: "USD",
    driveUrl: "https://drive.google.com/drive/folders/nexus-tech",
    avatarType: "nexus",
    hasQuickBill: true,
    totalBilled: 8900,
    totalPaid: 8900,
    outstandingBalance: 0,
    invoicesCount: 4,
    recentInvoices: [
      { id: "INV-2023-078", date: "Sep 12, 2023", amount: 3200, status: "Paid" },
      { id: "INV-2023-084", date: "Oct 02, 2023", amount: 5700, status: "Paid" },
    ],
  },
  {
    id: "cli-3",
    name: "Vanguard Media",
    category: "Agency",
    contactPerson: "Elena Rostova",
    email: "elena@vanguard.co",
    currency: "EUR",
    driveUrl: "https://drive.google.com/drive/folders/vanguard-media",
    avatarType: "vanguard",
    hasQuickBill: false,
    totalBilled: 6200,
    totalPaid: 4200,
    outstandingBalance: 2000,
    invoicesCount: 3,
    recentInvoices: [
      { id: "INV-2023-066", date: "Aug 19, 2023", amount: 2200, status: "Paid" },
      { id: "INV-2023-075", date: "Oct 10, 2023", amount: 2000, status: "Partial Paid" },
    ],
  },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>(initialClients);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<ClientRecord | null>(null);
  const [selectedClientForBill, setSelectedClientForBill] = useState<ClientRecord | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // New Client Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "Enterprise",
    contactPerson: "",
    contactRole: "",
    email: "",
    phone: "",
    currency: "USD" as "USD" | "LKR" | "EUR",
    driveUrl: "",
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3200);
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    const newClient: ClientRecord = {
      id: `cli-${Date.now()}`,
      name: formData.name,
      category: formData.category,
      contactPerson: formData.contactPerson || formData.name,
      contactRole: formData.contactRole || undefined,
      email: formData.email,
      phone: formData.phone || undefined,
      currency: formData.currency,
      driveUrl: formData.driveUrl || undefined,
      avatarType: "custom",
      customAvatarLetter: formData.name.charAt(0).toUpperCase(),
      hasQuickBill: true,
      totalBilled: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      invoicesCount: 0,
      recentInvoices: [],
    };

    setClients([newClient, ...clients]);
    setIsAddModalOpen(false);
    setFormData({
      name: "",
      category: "Enterprise",
      contactPerson: "",
      contactRole: "",
      email: "",
      phone: "",
      currency: "USD",
      driveUrl: "",
    });
    showToast(`Client "${newClient.name}" added successfully!`);
  };

  const handleDeleteClient = (id: string, name: string) => {
    setClients(clients.filter((c) => c.id !== id));
    setActiveMenuId(null);
    showToast(`Client "${name}" removed from directory.`);
  };

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8 motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface kind="toast" className="fixed top-6 right-6 z-50 bg-neutral-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-neutral-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Header Section matching Figma reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-[42px] font-serif font-normal text-neutral-900 tracking-tight leading-none">
            Clients
          </h1>
          <p className="text-sm text-neutral-500 mt-2 font-normal">
            Manage your client relationships and billing history.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="group inline-flex items-center gap-2.5 px-4 py-2.5 bg-white border border-neutral-200/90 rounded-xl text-sm font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <UserPlus
              className="w-4 h-4 text-neutral-700 transition-transform duration-200 ease-out group-hover:scale-105 group-hover:-translate-y-px group-hover:text-[#7c3aed]"
              strokeWidth={2}
            />
          </div>
          <span>Add Client</span>
        </button>
      </div>

      {/* Client Cards Grid matching 3-column reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <div
            key={client.id}
            className="motion-card relative bg-[#ececf0] hover:bg-[#eaeaf0] transition-colors rounded-2xl p-5 border border-neutral-200/60 shadow-xs flex flex-col justify-between group"
          >
            {/* Top Bar: Avatar, Title, Category, Menu */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  {/* Distinct Client Logo Avatar */}
                  {client.avatarType === "apex" && (
                    <div className="w-12 h-12 rounded-full bg-white flex flex-col items-center justify-center shadow-xs border border-neutral-100 shrink-0 text-center leading-none p-1.5 transition-transform duration-300 group-hover:scale-105">
                      <span className="text-[13px] font-extrabold tracking-tighter text-neutral-900">
                        AA
                      </span>
                      <span className="text-[6px] tracking-tight text-neutral-400 font-semibold uppercase mt-0.5">
                        Architects
                      </span>
                    </div>
                  )}

                  {client.avatarType === "nexus" && (
                    <div className="w-12 h-12 rounded-full bg-[#f3efff] border border-[#e5dcfc] flex items-center justify-center shadow-xs shrink-0 transition-transform duration-300 group-hover:scale-105">
                      <svg
                        className="w-6 h-6 text-[#7c3aed] transition-transform duration-300 group-hover:rotate-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 4l16 8-16 8V4z" />
                      </svg>
                    </div>
                  )}

                  {client.avatarType === "vanguard" && (
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs border border-neutral-100 shrink-0 transition-transform duration-300 group-hover:scale-105">
                      <span className="font-serif text-xl font-normal text-neutral-600">
                        V
                      </span>
                    </div>
                  )}

                  {client.avatarType === "custom" && (
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs border border-neutral-100 shrink-0 transition-transform duration-300 group-hover:scale-105">
                      <span className="text-lg font-bold text-[#7c3aed]">
                        {client.customAvatarLetter || client.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  <div>
                    <h2 className="text-[17px] font-semibold text-neutral-900 tracking-tight leading-snug">
                      {client.name}
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-normal mt-0.5">
                      <FolderClosed className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{client.category}</span>
                    </div>
                  </div>
                </div>

                {/* 3-dots Context Menu Button */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setActiveMenuId(activeMenuId === client.id ? null : client.id)
                    }
                    className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
                    aria-label="Client options"
                    aria-expanded={activeMenuId === client.id}
                  >
                    <MoreVertical className="w-4 h-4 transition-transform duration-200 hover:rotate-6 hover:text-neutral-900" />
                  </button>

                  {/* Dropdown Menu */}
                  <MotionPresence>
                    {activeMenuId === client.id && (
                      <MotionSurface kind="menu" className="absolute right-0 top-7 w-44 bg-white rounded-xl shadow-lg border border-neutral-200/80 py-1.5 z-20 text-xs font-medium text-neutral-700">
                        {client.driveUrl && (
                          <a
                            href={client.driveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3.5 py-2 hover:bg-neutral-50 text-neutral-700 hover:text-[#7c3aed] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                            Google Drive
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setSelectedClientForHistory(client);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-neutral-50 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5 text-neutral-400" />
                          View Ledger
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id, client.name)}
                          className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          Remove Client
                        </button>
                      </MotionSurface>
                    )}
                  </MotionPresence>
                </div>
              </div>

              {/* Inner White Box with Client Contact Info */}
              <div className="bg-white rounded-xl p-4 my-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] border border-neutral-200/50 space-y-2 text-xs text-neutral-600">
                {/* Contact Person */}
                <div className="flex items-center gap-2.5 group/item">
                  <User className="w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 group-hover/item:scale-105 group-hover/item:text-[#7c3aed]" />
                  <span className="truncate font-medium text-neutral-700">
                    {client.contactPerson}
                    {client.contactRole && (
                      <span className="text-neutral-500 font-normal ml-1">
                        ({client.contactRole})
                      </span>
                    )}
                  </span>
                </div>

                {/* Email Address */}
                <div className="flex items-center gap-2.5 group/item">
                  <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 group-hover/item:scale-105 group-hover/item:text-[#7c3aed]" />
                  <a
                    href={`mailto:${client.email}`}
                    className={`truncate transition-colors ${
                      client.id === "cli-1" || client.id === "cli-2"
                        ? "text-[#7c3aed] font-medium hover:underline"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    {client.email}
                  </a>
                </div>

                {/* Phone Number */}
                {client.phone && (
                  <div className="flex items-center gap-2.5 group/item">
                    <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 group-hover/item:scale-105 group-hover/item:text-[#7c3aed]" />
                    <span className="text-neutral-600 font-mono text-[11px]">
                      {client.phone}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Card Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setSelectedClientForHistory(client)}
                className="group/btn inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 transition-colors py-1 px-1 cursor-pointer outline-none"
              >
                <Clock className="w-3.5 h-3.5 text-neutral-500 transition-transform duration-300 group-hover/btn:rotate-6 group-hover/btn:text-[#7c3aed]" />
                <span>View History</span>
              </button>

              {client.hasQuickBill ? (
                <button
                  onClick={() => setSelectedClientForBill(client)}
                  className="group/btn inline-flex items-center justify-center gap-1.5 bg-[#6941C6] hover:bg-[#5b32be] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer leading-tight"
                >
                  <Zap className="w-3.5 h-3.5 fill-white text-white transition-transform duration-200 group-hover/btn:scale-105 group-hover/btn:rotate-6 shrink-0" />
                  <div className="text-left leading-none">
                    <span className="block text-[11px] leading-tight font-bold tracking-tight">
                      Quick
                    </span>
                    <span className="block text-[11px] leading-tight font-bold tracking-tight">
                      Bill
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setSelectedClientForHistory(client)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg shadow-xs hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  info
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Client Modal (SRS REQ-CLI 01 / UC-02) */}
      <MotionPresence>
        {isAddModalOpen && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <MotionSurface kind="panel" className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Add New Client Profile
                    </h3>
                    <p className="text-xs text-neutral-400">
                      UC-02: Manage Client Directory
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddClient} className="p-6 space-y-4 text-xs font-medium text-neutral-700">
                <div>
                  <label className="block mb-1.5 text-neutral-700 font-semibold">
                    Client Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fintech Labs Inc."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 focus:border-[#7c3aed]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 bg-white"
                    >
                      <option value="Enterprise">Enterprise</option>
                      <option value="Startup">Startup</option>
                      <option value="Agency">Agency</option>
                      <option value="SaaS">SaaS</option>
                      <option value="E-Commerce">E-Commerce</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Default Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currency: e.target.value as "USD" | "LKR" | "EUR",
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 bg-white"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex Rivera"
                      value={formData.contactPerson}
                      onChange={(e) =>
                        setFormData({ ...formData, contactPerson: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Contact Role / Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Product Lead"
                      value={formData.contactRole}
                      onChange={(e) =>
                        setFormData({ ...formData, contactRole: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="alex@fintechlabs.io"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      WhatsApp / Phone (E.164)
                    </label>
                    <input
                      type="text"
                      placeholder="+1 415 555 2671"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-neutral-700 font-semibold">
                    Google Drive Deliverables URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={formData.driveUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, driveUrl: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
                  >
                    Save Client Profile
                  </button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Client History & Details Modal (SRS REQ-CLI 02) */}
      <MotionPresence>
        {selectedClientForHistory && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <MotionSurface kind="panel" className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
                <div>
                  <span className="text-xs font-semibold text-[#7c3aed] uppercase tracking-wider">
                    Client Ledger & History
                  </span>
                  <h3 className="text-xl font-serif font-bold text-neutral-900">
                    {selectedClientForHistory.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedClientForHistory(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Financial Metrics Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#f8f8fa] p-4 rounded-xl border border-neutral-200/60">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Total Billed
                    </span>
                    <span className="text-2xl font-serif font-semibold text-neutral-900 mt-1 block">
                      ${selectedClientForHistory.totalBilled.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#f8f8fa] p-4 rounded-xl border border-neutral-200/60">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Total Paid
                    </span>
                    <span className="text-2xl font-serif font-semibold text-emerald-600 mt-1 block">
                      ${selectedClientForHistory.totalPaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#f8f8fa] p-4 rounded-xl border border-neutral-200/60">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Outstanding Balance
                    </span>
                    <span className="text-2xl font-serif font-semibold text-amber-600 mt-1 block">
                      ${selectedClientForHistory.outstandingBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Client Info & Drive Folder */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-neutral-50 rounded-xl border border-neutral-100 text-xs text-neutral-600">
                  <div className="flex items-center gap-4">
                    <span>
                      <strong>Contact:</strong> {selectedClientForHistory.contactPerson}
                    </span>
                    <span>
                      <strong>Email:</strong> {selectedClientForHistory.email}
                    </span>
                  </div>
                  {selectedClientForHistory.driveUrl && (
                    <a
                      href={selectedClientForHistory.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[#7c3aed] font-medium hover:underline"
                    >
                      <FolderClosed className="w-4 h-4" />
                      <span>Open Deliverables Folder</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Invoices Table */}
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 mb-3">
                    Recent Invoices & Payment Status
                  </h4>
                  <div className="border border-neutral-200/70 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider border-b border-neutral-200/70">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Invoice ID</th>
                          <th className="py-2.5 px-4 font-semibold">Issue Date</th>
                          <th className="py-2.5 px-4 font-semibold">Amount</th>
                          <th className="py-2.5 px-4 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {selectedClientForHistory.recentInvoices &&
                        selectedClientForHistory.recentInvoices.length > 0 ? (
                          selectedClientForHistory.recentInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-neutral-50/50">
                              <td className="py-3 px-4 font-mono font-medium text-neutral-800">
                                {inv.id}
                              </td>
                              <td className="py-3 px-4 text-neutral-500">{inv.date}</td>
                              <td className="py-3 px-4 font-semibold text-neutral-900">
                                ${inv.amount.toLocaleString()}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    inv.status === "Paid"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : inv.status === "Partial Paid"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-neutral-400">
                              No invoices generated for this client yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
                <button
                  onClick={() => setSelectedClientForHistory(null)}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors"
                >
                  Close Ledger
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Quick Bill Modal (SRS UC-03) */}
      <MotionPresence>
        {selectedClientForBill && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <MotionSurface kind="panel" className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center">
                    <Zap className="w-4 h-4 fill-[#7c3aed]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Instant Quick Bill
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Issuing to: {selectedClientForBill.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClientForBill(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium text-neutral-700">
                <div>
                  <label className="block mb-1.5 text-neutral-700 font-semibold">
                    Service Deliverable Title
                  </label>
                  <input
                    type="text"
                    defaultValue="Full-Stack Development Sprint & AI Integration"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Amount ({selectedClientForBill.currency})
                    </label>
                    <input
                      type="number"
                      defaultValue={1500}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Payment Terms
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="Net 7 Days (Default)"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-100/70 text-sm text-neutral-600"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="deposit"
                      defaultChecked
                      className="w-4 h-4 text-[#7c3aed] rounded-sm focus:ring-[#7c3aed]"
                    />
                    <label htmlFor="deposit" className="text-xs font-medium text-neutral-700">
                      Require 50% Upfront Deposit
                    </label>
                  </div>
                  <span className="text-xs font-semibold text-[#7c3aed]">
                    Deposit: \$750.00
                  </span>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setSelectedClientForBill(null)}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientForBill(null);
                      showToast(`Quick Bill draft generated for ${selectedClientForBill.name}!`);
                    }}
                    className="px-5 py-2.5 bg-[#6941C6] hover:bg-[#5b32be] text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    Generate & Send Invoice
                  </button>
                </div>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
