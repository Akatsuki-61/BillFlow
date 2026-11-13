"use client";
import { MAX_BACKUP_BYTES } from "@/lib/backup-limits";

import { Dialog } from "@/components/ui/Dialog";

import { Button, PageHeader } from "@/components/ui/Workspace";

import React, {
  useState,
  useEffect,
  useEffectEvent,
  useMemo,
  Suspense,
} from "react";
import { IconCrossfade, MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { motion } from "motion/react";
import { SPRING_NAV_GLIDE } from "@/lib/motion";
import {
  User,
  Receipt,
  Database,
  Palette,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FolderOpen,
  Download,
  Upload,
  AlertTriangle,
  Save,
  Hash,
  Mail,
  Phone,
  Sun,
  Moon,
  Monitor,
  Lock,
  Plus,
  SlidersHorizontal,
  UsersRound,
  Pencil,
  Eye,
} from "lucide-react";
import { useSettings, useData } from "@/lib/data/DataProvider";
import type { UpdateSettingsInput, ExportDataPayload } from "@/types/settings";
import { useTheme } from "@/context/ThemeContext";
import { useProfiles } from "@/context/ProfileContext";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";
import { useSearchParams } from "next/navigation";
import type {
  Currency,
  InvoiceTemplateId,
  InvoiceWithClient,
} from "@/types/billing";
import { getCurrencySymbol } from "@/lib/format";
import type { AccentPreference } from "@/lib/theme";
import { profileStorageKey } from "@/lib/profile-scope";
import InvoiceDocumentSheet from "@/components/invoices/InvoiceDocumentSheet";

type SettingsTab = "profile" | "invoices" | "data" | "appearance";

const INVOICE_TEMPLATE_OPTIONS: Array<{
  id: InvoiceTemplateId;
  name: string;
  summary: string;
  surfaceLabel: string;
  color: string;
}> = [
  {
    id: "geometric-teal",
    name: "Geometric Teal",
    summary: "Teal & slate header on white",
    surfaceLabel: "Light",
    color: "#00A887",
  },
  {
    id: "executive-wave",
    name: "Executive Wave",
    summary: "Charcoal wave & amber table",
    surfaceLabel: "Light",
    color: "#EAA828",
  },
  {
    id: "scarlet-modern",
    name: "Scarlet Modern",
    summary: "Split red header & dotted rows",
    surfaceLabel: "Light",
    color: "#E5252A",
  },
  {
    id: "apex-orange",
    name: "Apex Orange",
    summary: "Orange header & grid table",
    surfaceLabel: "Light",
    color: "#F25C05",
  },
  {
    id: "noir-crimson",
    name: "Noir Crimson",
    summary: "Dark page with red pill rows",
    surfaceLabel: "Dark",
    color: "#D9383A",
  },
];

function InvoiceTemplateMiniPreview({
  templateId,
}: {
  templateId: InvoiceTemplateId;
}) {
  if (templateId === "geometric-teal") {
    return (
      <svg
        viewBox="0 0 180 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
        aria-hidden="true"
      >
        <rect width="180" height="232" fill="#FFFFFF" />
        {/* Top-left geometric ribbons */}
        <path
          d="M 74 0 L 112 0 L 76 58 L 38 58 Z"
          fill="#6B7685"
          fillOpacity="0.32"
        />
        <path d="M 0 0 L 23 0 L 0 38 Z" fill="#38414D" />
        <path d="M 23 0 L 48 0 L 0 80 L 0 38 Z" fill="#006758" />
        <path d="M 48 0 L 75 0 L 0 124 L 0 80 Z" fill="#00A887" />
        <path d="M 0 26 L 146 26 L 126 58 L 0 58 Z" fill="#5A6577" />
        <path d="M 0 26 L 134 26 L 114 58 L 0 58 Z" fill="#222831" />
        {/* Brand inside dark ribbon */}
        <rect
          x="12"
          y="36"
          width="11"
          height="11"
          rx="2.5"
          fill="#00A887"
          fillOpacity="0.9"
        />
        <rect x="28" y="37" width="54" height="4.5" rx="1.5" fill="#FFFFFF" />
        <rect x="28" y="44" width="38" height="3" rx="1" fill="#94A3B8" />
        {/* Right INVOICE heading & meta */}
        <rect x="122" y="16" width="44" height="7" rx="1.5" fill="#00A887" />
        <rect x="132" y="29" width="34" height="3" rx="1" fill="#64748B" />
        <rect x="136" y="35" width="30" height="3" rx="1" fill="#94A3B8" />
        <rect
          x="140"
          y="42"
          width="26"
          height="6"
          rx="3"
          fill="#00A887"
          fillOpacity="0.16"
        />
        {/* Table header */}
        <rect x="14" y="76" width="36" height="3.5" rx="1" fill="#00A887" />
        <rect x="116" y="76" width="16" height="3.5" rx="1" fill="#00A887" />
        <rect x="146" y="76" width="20" height="3.5" rx="1" fill="#00A887" />
        <line
          x1="14"
          y1="84"
          x2="166"
          y2="84"
          stroke="#00A887"
          strokeWidth="1.5"
        />
        {/* Table rows */}
        {[94, 110, 126].map((y, idx) => (
          <g key={y}>
            <rect
              x="14"
              y={y}
              width={idx === 1 ? 66 : 76}
              height="4"
              rx="1"
              fill="#1F262E"
            />
            <rect
              x="14"
              y={y + 6}
              width="46"
              height="2.5"
              rx="1"
              fill="#94A3B8"
            />
            <rect
              x="114"
              y={y + 1}
              width="18"
              height="3.5"
              rx="1"
              fill="#64748B"
            />
            <rect
              x="144"
              y={y + 1}
              width="22"
              height="4"
              rx="1"
              fill="#1F262E"
            />
            <line
              x1="14"
              y1={y + 12}
              x2="166"
              y2={y + 12}
              stroke="#E2E8F0"
              strokeWidth="1"
            />
          </g>
        ))}
        {/* Lower client + totals */}
        <rect x="14" y="150" width="28" height="3.5" rx="1" fill="#00A887" />
        <rect x="14" y="157" width="46" height="4" rx="1" fill="#1F262E" />
        <rect x="14" y="164" width="38" height="3" rx="1" fill="#94A3B8" />
        <rect x="112" y="150" width="22" height="3" rx="1" fill="#94A3B8" />
        <rect x="142" y="150" width="24" height="3.5" rx="1" fill="#1F262E" />
        <line
          x1="108"
          y1="160"
          x2="166"
          y2="160"
          stroke="#00A887"
          strokeWidth="1.5"
        />
        <rect x="108" y="166" width="20" height="5" rx="1" fill="#00A887" />
        <rect x="134" y="165" width="32" height="7" rx="1.5" fill="#00A887" />
        {/* Terms */}
        <rect x="14" y="192" width="32" height="3.5" rx="1" fill="#00A887" />
        <rect x="14" y="199" width="76" height="2.5" rx="1" fill="#94A3B8" />
        <rect x="14" y="204" width="60" height="2.5" rx="1" fill="#CBD5E1" />
        {/* Bottom-right geometric corner */}
        <path d="M 134 232 L 166 176 L 172 176 L 140 232 Z" fill="#5A6577" />
        <path
          d="M 140 232 L 172 176 L 180 176 L 180 188 L 152 232 Z"
          fill="#006758"
        />
        <path d="M 152 232 L 180 188 L 180 232 Z" fill="#00A887" />
      </svg>
    );
  }

  if (templateId === "executive-wave") {
    return (
      <svg
        viewBox="0 0 180 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
        aria-hidden="true"
      >
        <rect width="180" height="232" fill="#FFFFFF" />
        {/* Full-width wave header */}
        <path
          d="M 0 0 L 180 0 L 180 24 C 154 20, 128 18, 98 22 C 66 26, 34 32, 0 32 Z"
          fill="#23262B"
        />
        <path d="M 134 0 C 152 6, 166 10, 180 13 L 180 0 Z" fill="#383D46" />
        <path
          d="M 60 28 C 92 22, 124 19, 180 24 L 180 32 C 146 27, 108 25, 68 28 Z"
          fill="#8B8F96"
        />
        <path
          d="M 74 28 C 110 25, 146 27, 180 32 L 180 41 C 148 35, 114 29, 78 28 Z"
          fill="#CCD0D7"
        />
        {/* Header brand + contact */}
        <rect
          x="14"
          y="9"
          width="11"
          height="11"
          rx="2.5"
          fill="#EAA828"
          fillOpacity="0.25"
          stroke="#EAA828"
          strokeWidth="1"
        />
        <rect x="29" y="10" width="48" height="4" rx="1" fill="#FFFFFF" />
        <rect x="29" y="16" width="34" height="2.5" rx="1" fill="#EAA828" />
        <rect x="126" y="9" width="14" height="2.5" rx="1" fill="#EAA828" />
        <rect x="126" y="13" width="22" height="2.5" rx="1" fill="#E5E7EB" />
        {/* Client & Invoice meta */}
        <rect x="14" y="46" width="14" height="3" rx="1" fill="#64748B" />
        <rect x="14" y="52" width="48" height="4.5" rx="1" fill="#0F172A" />
        <rect x="14" y="59" width="38" height="3" rx="1" fill="#94A3B8" />
        <rect x="122" y="45" width="44" height="7" rx="1.5" fill="#0F172A" />
        <rect x="130" y="56" width="36" height="3" rx="1" fill="#64748B" />
        <rect x="136" y="62" width="30" height="3" rx="1" fill="#94A3B8" />
        {/* Split Amber + Charcoal Table Header */}
        <rect x="14" y="76" width="88" height="11" fill="#EAA828" />
        <rect x="102" y="76" width="64" height="11" fill="#20232A" />
        <rect x="20" y="80" width="38" height="3" rx="1" fill="#0F172A" />
        <rect x="110" y="80" width="16" height="3" rx="1" fill="#FFFFFF" />
        <rect x="142" y="80" width="18" height="3" rx="1" fill="#FFFFFF" />
        {/* Alternating striped rows */}
        {[87, 102, 117].map((y, idx) => (
          <g key={y}>
            <rect
              x="14"
              y={y}
              width="152"
              height="15"
              fill={idx % 2 === 1 ? "#F1F3F7" : "#FFFFFF"}
            />
            <rect
              x="20"
              y={y + 4}
              width={idx === 1 ? 58 : 68}
              height="3.5"
              rx="1"
              fill="#0F172A"
            />
            <rect
              x="20"
              y={y + 9}
              width="42"
              height="2.5"
              rx="1"
              fill="#94A3B8"
            />
            <rect
              x="110"
              y={y + 5}
              width="16"
              height="3.5"
              rx="1"
              fill="#475569"
            />
            <rect
              x="140"
              y={y + 5}
              width="20"
              height="4"
              rx="1"
              fill="#0F172A"
            />
          </g>
        ))}
        {/* Totals + Solid Amber Grand Total Bar */}
        <rect x="104" y="144" width="24" height="3" rx="1" fill="#64748B" />
        <rect x="142" y="144" width="24" height="3" rx="1" fill="#0F172A" />
        <rect x="104" y="151" width="20" height="3" rx="1" fill="#64748B" />
        <rect x="144" y="151" width="22" height="3" rx="1" fill="#0F172A" />
        <rect x="100" y="160" width="66" height="14" rx="2" fill="#EAA828" />
        <rect x="106" y="165" width="24" height="4" rx="1" fill="#0F172A" />
        <rect x="138" y="164.5" width="22" height="5" rx="1" fill="#0F172A" />
        {/* Footer */}
        <line
          x1="14"
          y1="202"
          x2="166"
          y2="202"
          stroke="#E2E8F0"
          strokeWidth="1"
        />
        <rect x="14" y="208" width="42" height="3.5" rx="1" fill="#0F172A" />
        <rect x="14" y="214" width="84" height="2.5" rx="1" fill="#94A3B8" />
      </svg>
    );
  }

  if (templateId === "scarlet-modern") {
    return (
      <svg
        viewBox="0 0 180 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
        aria-hidden="true"
      >
        <rect width="180" height="232" fill="#FFFFFF" />
        {/* Top split geometric header */}
        <polygon points="0,0 74,0 96,38 0,38" fill="#1E2229" />
        <polygon points="74,0 180,0 180,38 96,38" fill="#E5252A" />
        <rect x="12" y="12" width="12" height="12" rx="2.5" fill="#E5252A" />
        <rect x="28" y="13" width="38" height="4" rx="1" fill="#FFFFFF" />
        <rect x="28" y="19" width="28" height="2.5" rx="1" fill="#CBD5E1" />
        <rect x="124" y="10" width="42" height="6.5" rx="1.5" fill="#FFFFFF" />
        <rect
          x="132"
          y="20"
          width="34"
          height="2.5"
          rx="1"
          fill="#FFFFFF"
          fillOpacity="0.85"
        />
        <rect
          x="138"
          y="25"
          width="28"
          height="2.5"
          rx="1"
          fill="#FFFFFF"
          fillOpacity="0.75"
        />
        {/* Client header */}
        <rect x="14" y="48" width="26" height="3" rx="1" fill="#E5252A" />
        <rect x="14" y="54" width="50" height="4.5" rx="1" fill="#0F172A" />
        <rect x="14" y="61" width="38" height="2.5" rx="1" fill="#64748B" />
        {/* Split Crimson & Slate Table Header */}
        <rect x="14" y="73" width="88" height="11" fill="#E5252A" />
        <rect x="102" y="73" width="64" height="11" fill="#1E2229" />
        <rect x="20" y="77" width="42" height="3" rx="1" fill="#FFFFFF" />
        <rect x="110" y="77" width="16" height="3" rx="1" fill="#FFFFFF" />
        <rect x="142" y="77" width="18" height="3" rx="1" fill="#FFFFFF" />
        {/* Dotted table rows */}
        {[90, 106, 122].map((y, idx) => (
          <g key={y}>
            <rect
              x="20"
              y={y}
              width={idx === 1 ? 56 : 68}
              height="3.5"
              rx="1"
              fill="#0F172A"
            />
            <rect
              x="20"
              y={y + 5.5}
              width="42"
              height="2.5"
              rx="1"
              fill="#94A3B8"
            />
            <rect
              x="110"
              y={y + 1}
              width="16"
              height="3.5"
              rx="1"
              fill="#475569"
            />
            <rect
              x="140"
              y={y + 1}
              width="20"
              height="3.5"
              rx="1"
              fill="#0F172A"
            />
            <line
              x1="14"
              y1={y + 11.5}
              x2="166"
              y2={y + 11.5}
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          </g>
        ))}
        {/* Left big Total Due + Right breakdown */}
        <rect x="14" y="144" width="24" height="3" rx="1" fill="#475569" />
        <rect x="14" y="150" width="44" height="7" rx="1.5" fill="#E5252A" />
        <rect x="108" y="145" width="22" height="3" rx="1" fill="#64748B" />
        <rect x="142" y="145" width="24" height="3" rx="1" fill="#0F172A" />
        <rect x="108" y="152" width="18" height="3" rx="1" fill="#64748B" />
        <rect x="146" y="152" width="20" height="3" rx="1" fill="#0F172A" />
        {/* Full-width solid crimson grand total bar */}
        <rect x="14" y="166" width="152" height="13" rx="2" fill="#E5252A" />
        <rect x="20" y="170.5" width="22" height="4" rx="1" fill="#FFFFFF" />
        <rect x="134" y="170" width="26" height="5" rx="1" fill="#FFFFFF" />
        {/* Terms */}
        <rect x="14" y="190" width="34" height="3" rx="1" fill="#E5252A" />
        <rect x="14" y="196" width="82" height="2.5" rx="1" fill="#94A3B8" />
        {/* Bottom split geometric footer */}
        <polygon points="0,218 118,218 130,232 0,232" fill="#E5252A" />
        <polygon points="118,218 180,218 180,232 130,232" fill="#1E2229" />
        <rect
          x="14"
          y="223.5"
          width="36"
          height="3"
          rx="1"
          fill="#FFFFFF"
          fillOpacity="0.9"
        />
        <rect
          x="144"
          y="223.5"
          width="22"
          height="3"
          rx="1"
          fill="#94A3B8"
        />
      </svg>
    );
  }

  if (templateId === "apex-orange") {
    return (
      <svg
        viewBox="0 0 180 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
        aria-hidden="true"
      >
        <rect width="180" height="232" fill="#FFFFFF" />
        {/* Top diagonal apex header */}
        <polygon points="0,0 70,0 93,30 0,30" fill="#F25C05" />
        <polygon points="77,0 86,0 112,35 103,35" fill="#F25C05" />
        <polygon points="86,0 180,0 180,38 116,38" fill="#111315" />
        <rect
          x="12"
          y="9"
          width="10"
          height="10"
          rx="2"
          fill="#FFFFFF"
          fillOpacity="0.2"
        />
        <rect x="26" y="10" width="38" height="4" rx="1" fill="#FFFFFF" />
        <rect
          x="26"
          y="16"
          width="28"
          height="2.5"
          rx="1"
          fill="#FFEDD5"
        />
        <rect x="126" y="9" width="40" height="6" rx="1.5" fill="#FFFFFF" />
        <rect
          x="132"
          y="19"
          width="34"
          height="2.5"
          rx="1"
          fill="#FFFFFF"
          fillOpacity="0.85"
        />
        <rect
          x="138"
          y="24"
          width="28"
          height="2.5"
          rx="1"
          fill="#FFFFFF"
          fillOpacity="0.75"
        />
        {/* Client info */}
        <rect x="14" y="46" width="26" height="3" rx="1" fill="#F25C05" />
        <rect x="14" y="52" width="48" height="4.5" rx="1" fill="#0F172A" />
        <rect x="14" y="59" width="36" height="2.5" rx="1" fill="#64748B" />
        {/* Full Orange Table Header + Grid Table */}
        <rect x="14" y="72" width="152" height="11" fill="#F25C05" />
        <rect x="20" y="76" width="44" height="3" rx="1" fill="#FFFFFF" />
        <rect x="110" y="76" width="16" height="3" rx="1" fill="#FFFFFF" />
        <rect x="142" y="76" width="18" height="3" rx="1" fill="#FFFFFF" />
        {/* Bordered grid body */}
        <rect
          x="14"
          y="83"
          width="152"
          height="48"
          stroke="#CBD5E1"
          strokeWidth="1"
          fill="#FFFFFF"
        />
        <line
          x1="14"
          y1="99"
          x2="166"
          y2="99"
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        <line
          x1="14"
          y1="115"
          x2="166"
          y2="115"
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        <line
          x1="30"
          y1="83"
          x2="30"
          y2="131"
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        <line
          x1="104"
          y1="83"
          x2="104"
          y2="131"
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        <line
          x1="136"
          y1="83"
          x2="136"
          y2="131"
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        {[89, 105, 121].map((y, idx) => (
          <g key={y}>
            <rect x="19" y={y} width="6" height="3.5" rx="1" fill="#94A3B8" />
            <rect
              x="35"
              y={y}
              width={idx === 1 ? 48 : 58}
              height="3.5"
              rx="1"
              fill="#0F172A"
            />
            <rect
              x="110"
              y={y}
              width="18"
              height="3.5"
              rx="1"
              fill="#475569"
            />
            <rect
              x="142"
              y={y}
              width="18"
              height="3.5"
              rx="1"
              fill="#0F172A"
            />
          </g>
        ))}
        {/* Left numbered terms + Right orange total bar */}
        <rect x="14" y="144" width="32" height="3.5" rx="1" fill="#F25C05" />
        <rect x="14" y="151" width="66" height="2.5" rx="1" fill="#64748B" />
        <rect x="14" y="156" width="60" height="2.5" rx="1" fill="#94A3B8" />
        <rect x="14" y="166" width="48" height="3" rx="1" fill="#F25C05" />
        <rect x="104" y="144" width="22" height="3" rx="1" fill="#64748B" />
        <rect x="142" y="144" width="24" height="3" rx="1" fill="#0F172A" />
        <rect x="104" y="151" width="18" height="3" rx="1" fill="#64748B" />
        <rect x="146" y="151" width="20" height="3" rx="1" fill="#0F172A" />
        <rect x="102" y="160" width="64" height="14" rx="2" fill="#F25C05" />
        <rect x="108" y="165" width="20" height="4" rx="1" fill="#FFFFFF" />
        <rect x="138" y="164.5" width="22" height="5" rx="1" fill="#FFFFFF" />
        {/* Bottom angled orange footer */}
        <polygon points="0,218 112,218 124,232 0,232" fill="#F25C05" />
        <rect
          x="14"
          y="223.5"
          width="40"
          height="3"
          rx="1"
          fill="#FFFFFF"
          fillOpacity="0.9"
        />
        <rect
          x="144"
          y="223.5"
          width="22"
          height="3"
          rx="1"
          fill="#94A3B8"
        />
      </svg>
    );
  }

  // noir-crimson
  return (
    <svg
      viewBox="0 0 180 232"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full block"
      aria-hidden="true"
    >
      <rect width="180" height="232" fill="#111215" />
      {/* Centered brand + INVOICE title */}
      <circle
        cx="58"
        cy="15"
        r="2"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
      <circle
        cx="63"
        cy="15"
        r="2"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
      <circle
        cx="58"
        cy="20"
        r="2"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
      <circle
        cx="63"
        cy="20"
        r="2"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
      <rect x="70" y="13" width="52" height="4" rx="1" fill="#FFFFFF" />
      <rect x="70" y="19" width="38" height="2.5" rx="1" fill="#71717A" />
      <rect x="56" y="29" width="68" height="8" rx="1.5" fill="#FFFFFF" />
      {/* Chevrons & metadata */}
      <path
        d="M14 48L18 52L14 56 M20 48L24 52L20 56 M26 48L30 52L26 56"
        stroke="#D9383A"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="36" y="46" width="38" height="4" rx="1" fill="#FFFFFF" />
      <rect x="36" y="53" width="30" height="2.5" rx="1" fill="#71717A" />
      <line
        x1="88"
        y1="44"
        x2="88"
        y2="60"
        stroke="#D9383A"
        strokeOpacity="0.5"
        strokeWidth="1.2"
      />
      <rect x="96" y="46" width="16" height="3" rx="1" fill="#D9383A" />
      <rect x="116" y="46" width="24" height="3" rx="1" fill="#FFFFFF" />
      <rect x="96" y="52" width="16" height="3" rx="1" fill="#D9383A" />
      <rect x="116" y="52" width="22" height="3" rx="1" fill="#A1A1AA" />
      <path
        d="M166 48L162 52L166 56 M160 48L156 52L160 56 M154 48L150 52L154 56"
        stroke="#D9383A"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Capsule Table Header */}
      <rect
        x="14"
        y="68"
        width="152"
        height="13"
        rx="6.5"
        stroke="#D9383A"
        strokeWidth="1.2"
      />
      <rect x="22" y="73" width="44" height="3" rx="1" fill="#D4D4D8" />
      <rect x="134" y="70.5" width="28" height="8" rx="4" fill="#D9383A" />
      {/* Alternating Dark & Solid Crimson Pill Rows */}
      <rect x="22" y="88" width="60" height="3.5" rx="1" fill="#FFFFFF" />
      <rect x="138" y="88" width="20" height="3.5" rx="1" fill="#FFFFFF" />
      <rect x="14" y="98" width="152" height="14" rx="7" fill="#D9383A" />
      <rect x="22" y="103" width="66" height="4" rx="1" fill="#FFFFFF" />
      <rect x="136" y="103" width="22" height="4" rx="1" fill="#FFFFFF" />
      <rect x="22" y="118" width="54" height="3.5" rx="1" fill="#FFFFFF" />
      <rect x="138" y="118" width="20" height="3.5" rx="1" fill="#FFFFFF" />
      {/* Totals */}
      <rect x="104" y="136" width="22" height="3" rx="1" fill="#A1A1AA" />
      <rect x="142" y="136" width="24" height="3" rx="1" fill="#FFFFFF" />
      <line
        x1="104"
        y1="144"
        x2="166"
        y2="144"
        stroke="#D9383A"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <rect x="104" y="149" width="20" height="5" rx="1" fill="#D9383A" />
      <rect x="132" y="148" width="34" height="7" rx="1.5" fill="#D9383A" />
      {/* Stadium Terms Capsule */}
      <rect
        x="14"
        y="168"
        width="152"
        height="34"
        rx="14"
        stroke="#D9383A"
        strokeWidth="1.2"
      />
      <rect x="68" y="175" width="44" height="3.5" rx="1" fill="#D9383A" />
      <rect x="34" y="183" width="112" height="2.5" rx="1" fill="#71717A" />
      <rect x="46" y="189" width="88" height="2.5" rx="1" fill="#52525B" />
      {/* Solid Crimson Footer */}
      <rect x="0" y="218" width="180" height="14" fill="#D9383A" />
      <rect
        x="18"
        y="223.5"
        width="32"
        height="3"
        rx="1"
        fill="#FFFFFF"
        fillOpacity="0.9"
      />
      <rect
        x="74"
        y="223.5"
        width="32"
        height="3"
        rx="1"
        fill="#FFFFFF"
        fillOpacity="0.9"
      />
      <rect
        x="130"
        y="223.5"
        width="32"
        height="3"
        rx="1"
        fill="#FFFFFF"
        fillOpacity="0.9"
      />
    </svg>
  );
}

const ACCENT_OPTIONS: Array<{
  id: AccentPreference;
  name: string;
  description: string;
  color: string;
}> = [
  { id: "purple", name: "Purple", description: "Default", color: "#7c3aed" },
  { id: "blue", name: "Blue", description: "Ocean", color: "#2563eb" },
  { id: "emerald", name: "Emerald", description: "Forest", color: "#059669" },
  { id: "rose", name: "Rose", description: "Ruby", color: "#e11d48" },
  { id: "amber", name: "Amber", description: "Bronze", color: "#d97706" },
  { id: "indigo", name: "Indigo", description: "Midnight", color: "#4f46e5" },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: SettingsTab = [
    "profile",
    "invoices",
    "data",
    "appearance",
  ].includes(requestedTab || "")
    ? (requestedTab as SettingsTab)
    : "profile";
  const { workflow, isElectron, error: dataError } = useData();
  const { preference, setPreference, accent, setAccent, ready } = useTheme();
  const {
    profiles,
    activeProfile,
    maxProfiles,
    openProfileGate,
    lockCurrentProfile,
    switchProfile,
  } = useProfiles();
  const {
    settings,
    isLoading,
    updateSettings,
    getDbPath,
    revealDbFile,
    exportData,
    importData,
    resetData,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [previousRequestedTab, setPreviousRequestedTab] =
    useState(requestedTab);
  if (previousRequestedTab !== requestedTab) {
    setPreviousRequestedTab(requestedTab);
    setActiveTab(initialTab);
  }
  const [dbPath, setDbPath] = useState<string>("");
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Form State
  const [formState, setFormState] = useState<UpdateSettingsInput>({
    businessName: "",
    professionalTitle: "",
    email: "",
    phone: "",
    website: "",
    taxId: "",
    address: "",
    paymentDetails: "",
    defaultCurrency: "USD",
    invoicePrefix: "INV-",
    nextInvoiceSeq: 1,
    defaultDueDays: 14,
    defaultTaxRate: 0,
    defaultNotes: "",
    defaultInvoiceTemplate: "geometric-teal",
    dateFormat: "YYYY-MM-DD",
    currencyDisplay: "symbol",
    pdfExportDirectory: null,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImport, setParsedImport] = useState<ExportDataPayload | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] =
    useState<InvoiceTemplateId | null>(null);

  // Reset the draft when newly loaded or saved settings replace the source.
  const [previousSettings, setPreviousSettings] =
    useState<typeof settings>(null);
  if (previousSettings !== settings) {
    setPreviousSettings(settings);
    if (settings) {
      setFormState({
        businessName: settings.businessName || "",
        professionalTitle: settings.professionalTitle || "",
        email: settings.email || "",
        phone: settings.phone || "",
        website: settings.website || "",
        taxId: settings.taxId || "",
        address: settings.address || "",
        paymentDetails: settings.paymentDetails || "",
        defaultCurrency: settings.defaultCurrency || "USD",
        invoicePrefix: settings.invoicePrefix || "INV-",
        nextInvoiceSeq: settings.nextInvoiceSeq || 1,
        defaultDueDays: settings.defaultDueDays ?? 14,
        defaultTaxRate: settings.defaultTaxRate ?? 0,
        defaultNotes: settings.defaultNotes || "",
        defaultInvoiceTemplate:
          settings.defaultInvoiceTemplate || "geometric-teal",
        dateFormat: settings.dateFormat || "YYYY-MM-DD",
        currencyDisplay: settings.currencyDisplay || "symbol",
        pdfExportDirectory: settings.pdfExportDirectory || null,
      });
    }
  }

  // Load live DB path (re-evaluate when active profile changes)
  useEffect(() => {
    getDbPath()
      .then(setDbPath)
      .catch(() => setDbPath("Local database file"));
  }, [getDbPath, activeProfile.id]);

  // Determine dirty state
  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      (formState.businessName ?? "") !== (settings.businessName ?? "") ||
      (formState.professionalTitle ?? "") !==
        (settings.professionalTitle ?? "") ||
      (formState.email ?? "") !== (settings.email ?? "") ||
      (formState.phone ?? "") !== (settings.phone ?? "") ||
      (formState.website ?? "") !== (settings.website ?? "") ||
      (formState.taxId ?? "") !== (settings.taxId ?? "") ||
      (formState.address ?? "") !== (settings.address ?? "") ||
      (formState.paymentDetails ?? "") !== (settings.paymentDetails ?? "") ||
      formState.defaultCurrency !== settings.defaultCurrency ||
      (formState.invoicePrefix ?? "") !== (settings.invoicePrefix ?? "") ||
      formState.nextInvoiceSeq !== settings.nextInvoiceSeq ||
      formState.defaultDueDays !== settings.defaultDueDays ||
      formState.defaultTaxRate !== settings.defaultTaxRate ||
      (formState.defaultNotes ?? "") !== (settings.defaultNotes ?? "") ||
      (formState.defaultInvoiceTemplate || "geometric-teal") !==
        (settings.defaultInvoiceTemplate || "geometric-teal") ||
      formState.dateFormat !== settings.dateFormat ||
      formState.currencyDisplay !== settings.currencyDisplay ||
      (formState.pdfExportDirectory || null) !==
        (settings.pdfExportDirectory || null)
    );
  }, [formState, settings]);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3200);
  };

  const handleCopyPath = () => {
    if (!dbPath) return;
    navigator.clipboard.writeText(dbPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
    showToast("File path copied to clipboard", "success");
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormErrors({});

    // Validate email if provided
    if (formState.email && formState.email.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) {
        setFormErrors({ email: "Please enter a valid email address." });
        showToast("Please enter a valid email address.", "error");
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateSettings(formState);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          profileStorageKey("billflow_invoice_template"),
          formState.defaultInvoiceTemplate || "geometric-teal",
        );
      }
      showToast("Profile and settings saved.", "success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save settings.";
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectInvoiceTemplate = async (templateId: InvoiceTemplateId) => {
    setFormState((prev) => ({
      ...prev,
      defaultInvoiceTemplate: templateId,
    }));
    if (typeof window !== "undefined") {
      localStorage.setItem(
        profileStorageKey("billflow_invoice_template"),
        templateId,
      );
    }
    try {
      await updateSettings({
        ...formState,
        defaultInvoiceTemplate: templateId,
      });
      const label =
        INVOICE_TEMPLATE_OPTIONS.find((t) => t.id === templateId)?.name ||
        templateId;
      showToast(`Default invoice template set to ${label}.`, "success");
    } catch {
      // Keep draft selection in formState so user can save manually
    }
  };

  const saveFromShortcut = useEffectEvent(() => {
    if (isDirty && !isSaving) void handleSave();
  });

  // Keyboard shortcut Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFromShortcut();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleExportJson = async () => {
    try {
      const payload = await exportData();
      const jsonString = URL.createObjectURL(
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
      const downloadAnchor = document.createElement("a");
      const dateTag = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute(
        "download",
        `billflow-backup-${dateTag}.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(jsonString), 1000);
      showToast("Backup saved to your computer.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export data.";
      showToast(msg, "error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsedImport(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setImportError("Backup must be smaller than 150 MB.");
      return;
    }
    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid backup file format.");
        }
        if (
          parsed.version !== "2" ||
          !parsed.records ||
          !Array.isArray(parsed.files)
        )
          throw new Error("Choose a complete version 2 workflow backup.");
        if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.invoices)) {
          throw new Error("Backup file does not contain clients or invoices.");
        }
        setParsedImport(parsed as ExportDataPayload);
      } catch (err: unknown) {
        setImportError(
          err instanceof Error ? err.message : "Failed to read backup file.",
        );
        setParsedImport(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedImport) return;
    setIsImporting(true);
    try {
      const res = await importData(parsedImport);
      showToast(
        `Restored ${res.importedClients} clients and ${res.importedInvoices} invoices.`,
        "success",
      );
      setIsImportModalOpen(false);
      setImportFile(null);
      setParsedImport(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to restore backup.";
      showToast(msg, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmReset = async () => {
    if (resetConfirmation !== "DELETE ALL DATA") return;
    setIsResetting(true);
    try {
      await resetData();
      showToast(
        "Business records and managed receipts cleared. Profile and appearance kept.",
        "success",
      );
      setIsResetModalOpen(false);
      setResetConfirmation("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reset workspace.";
      showToast(msg, "error");
    } finally {
      setIsResetting(false);
    }
  };

  // Preview generated invoice code
  const previewInvoiceCode = useMemo(() => {
    const year = new Date().getFullYear();
    const prefix = formState.invoicePrefix || "INV-";
    const activePrefix = prefix.includes("{YYYY}")
      ? prefix.replace("{YYYY}", String(year))
      : prefix.endsWith("-")
        ? `${prefix}${year}-`
        : `${prefix}-${year}-`;
    const seq = formState.nextInvoiceSeq || 1;
    return `${activePrefix}${String(seq).padStart(3, "0")}`;
  }, [formState.invoicePrefix, formState.nextInvoiceSeq]);

  const samplePreviewInvoice = useMemo<InvoiceWithClient>(() => {
    const currency = (formState.defaultCurrency || "USD") as Currency;
    const items = [
      {
        id: "sample-item-1",
        invoiceId: "sample-preview",
        description: "Full-Stack Feature Architecture & Implementation",
        quantity: 1,
        unitPriceCents: 180000,
        position: 0,
      },
      {
        id: "sample-item-2",
        invoiceId: "sample-preview",
        description: "API Integration & Automated Test Suite",
        quantity: 1,
        unitPriceCents: 60000,
        position: 1,
      },
    ];
    const subtotalCents = 240000;
    const taxRate = formState.defaultTaxRate ?? 0;
    const taxCents = Math.round((subtotalCents * taxRate) / 100);
    const amountCents = subtotalCents + taxCents;
    const dueDays = formState.defaultDueDays ?? 14;
    const today = new Date();
    const dueDate = new Date(
      today.getTime() + dueDays * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    return {
      id: "sample-preview",
      clientId: "sample-client",
      clientName: "Northstar Digital Labs",
      clientEmail: "billing@northstar.example",
      code: previewInvoiceCode,
      currency,
      amountCents,
      taxCents,
      discountCents: 0,
      advanceCents: Math.round(amountCents * 0.5),
      paidCents: 0,
      status: "UNPAID",
      issueDate: today.toISOString().slice(0, 10),
      dueDate,
      notes:
        formState.defaultNotes ||
        "Payment is due within the agreed timeframe. Thank you for working together.",
      businessSnapshot: JSON.stringify({
        businessName: formState.businessName || "CHETHAKA LAKSHITHA",
        professionalTitle:
          formState.professionalTitle || "SOFTWARE FREELANCING & CONSULTING",
        email: formState.email || "contact@chethaka.dev",
        phone: formState.phone || "+94 77 123 4567",
        website: formState.website || "www.chethaka.dev",
        taxId: formState.taxId || "",
        address: formState.address || "Colombo, Sri Lanka",
        paymentDetails: formState.paymentDetails || "",
      }),
      items,
      payments: [],
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    };
  }, [
    formState.defaultCurrency,
    formState.defaultTaxRate,
    formState.defaultDueDays,
    formState.defaultNotes,
    formState.businessName,
    formState.professionalTitle,
    formState.email,
    formState.phone,
    formState.website,
    formState.taxId,
    formState.address,
    formState.paymentDetails,
    previewInvoiceCode,
  ]);

  // Initial letter for the avatar
  const avatarLetter = (
    formState.businessName?.trim().charAt(0) || "Y"
  ).toUpperCase();

  return (
    <div className="workspace-page settings-page motion-page max-w-none">
      {dataError && (
        <p role="alert" className="ui-card p-4 text-content-red-700">
          {dataError}
        </p>
      )}
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <div className="fixed top-14 right-6 z-[9999] pointer-events-none">
            <MotionSurface
              kind="toast"
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-[0px_4px_12px_rgba(0,0,0,0.08)] pointer-events-auto ${
                notification.type === "success"
                  ? "bg-surface text-content-emerald-800 border-line-emerald-200"
                  : "bg-surface text-content-rose-800 border-line-rose-200"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-content-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-content-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </MotionSurface>
          </div>
        )}
      </MotionPresence>

      {/* Header */}
      <PageHeader
        title="Settings"
        description="A workspace that works your way."
      >
        {isDirty && activeTab !== "appearance" && (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-amber-50 text-content-amber-800 border border-line-amber-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-surface-amber-500 animate-pulse" />
              Unsaved changes
            </span>
            <Button
              variant="primary"
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save (Cmd+S)"}
            </Button>
          </div>
        )}
      </PageHeader>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <p className="settings-nav-label">YOUR WORKSPACE</p>
          <nav aria-label="Settings section">
            {(
              [
                {
                  id: "profile",
                  title: "Business profile",
                  detail: "Identity & payment details",
                  icon: User,
                },
                {
                  id: "invoices",
                  title: "Invoice preferences",
                  detail: "Defaults, numbering & PDFs",
                  icon: Receipt,
                },
                {
                  id: "appearance",
                  title: "Appearance",
                  detail: "Theme & accent color",
                  icon: Palette,
                },
                {
                  id: "data",
                  title: "Backup & data",
                  detail: "Storage, export & restore",
                  icon: Database,
                },
              ] as const
            ).map(({ id, title, detail, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    setActiveTab(id);
                    document.querySelector("main.workspace-scroll")?.scrollTo({
                      top: 0,
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    });
                  }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="settings-nav-active-pill"
                      transition={SPRING_NAV_GLIDE}
                      className="settings-nav-active-pill"
                    />
                  )}
                  <span className="settings-nav-icon relative z-10">
                    <Icon size={19} />
                  </span>
                  <span className="relative z-10">
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="settings-local-note">
            <Database size={16} />
            <span>
              {isElectron ? "Stored on this device" : "Browser preview"}
              <small>
                {isElectron
                  ? "Your work stays with you."
                  : "Desktop storage is available in the app."}
              </small>
            </span>
          </div>
        </aside>
        {/* Main Content Area */}
        <div className="workspace-form settings-content w-full max-w-none">
          <div key={activeTab} className="settings-section-heading">
            <span className="settings-nav-label">
              {activeTab === "profile"
                ? "MAKE IT YOURS"
                : activeTab === "invoices"
                  ? "BILLING ESSENTIALS"
                  : activeTab === "appearance"
                    ? "YOUR LOOK & FEEL"
                    : "KEEP IT SAFE"}
            </span>
            <h2>
              {activeTab === "profile"
                ? "Business profile"
                : activeTab === "invoices"
                  ? "Invoice preferences"
                  : activeTab === "appearance"
                    ? "Appearance"
                    : "Backup & data"}
            </h2>
            <p>
              {activeTab === "profile"
                ? "The details your clients see on every invoice."
                : activeTab === "invoices"
                  ? "Set up the starting point for your next invoice."
                  : activeTab === "appearance"
                    ? "Choose the palette that feels right for your workspace."
                    : "Keep a complete copy of your records and receipts."}
            </p>
          </div>
          {activeTab === "appearance" ? (
            <div className="settings-section space-y-6">
              <section
                className="ui-card p-5 flex flex-wrap items-center justify-between gap-4"
                aria-labelledby="appearance-heading"
              >
                <div>
                  <h2
                    id="appearance-heading"
                    className="text-base font-semibold text-content-neutral-900"
                  >
                    Color theme
                  </h2>
                  <p className="text-sm text-content-neutral-500 mt-1">
                    Choose a theme. System follows your device’s appearance.
                  </p>
                  <p
                    className="text-xs text-content-neutral-500 mt-1"
                    role="status"
                  >
                    Changes save automatically on this device.
                  </p>
                </div>
                {ready && (
                  <div
                    className="theme-options"
                    role="group"
                    aria-label="Color theme"
                  >
                    {(
                      [
                        { value: "light", label: "Light", icon: Sun },
                        { value: "dark", label: "Dark", icon: Moon },
                        { value: "system", label: "System", icon: Monitor },
                      ] as const
                    ).map(({ value, label, icon: Icon }) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={preference === value}
                        onClick={() => setPreference(value)}
                      >
                        <div
                          className={`theme-preview theme-preview--${value}`}
                          aria-hidden="true"
                        >
                          <span />
                          <div>
                            <i />
                            <i />
                            <i />
                          </div>
                        </div>
                        <span>
                          <Icon size={14} />
                          {label}
                          {preference === value && <Check size={14} />}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section
                className="ui-card p-5 space-y-4"
                aria-labelledby="accent-heading"
              >
                <div>
                  <h2
                    id="accent-heading"
                    className="text-base font-semibold text-content-neutral-900"
                  >
                    Accent color
                  </h2>
                  <p className="text-sm text-content-neutral-500 mt-1">
                    Select your highlight color for buttons, navigation links,
                    badges, and metrics.
                  </p>
                  <p
                    className="text-xs text-content-neutral-500 mt-1"
                    role="status"
                  >
                    Updates instantly across light and dark modes.
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-labelledby="accent-heading"
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1"
                >
                  {ACCENT_OPTIONS.map((option) => {
                    const isSelected = accent === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${option.name} accent color (${option.description})`}
                        onClick={() => setAccent(option.id)}
                        className={`group relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isSelected
                            ? "bg-accent-soft/40 border-accent shadow-xs ring-1 ring-accent/40"
                            : "bg-surface border-line-neutral-200/80 hover:border-line-neutral-300 hover:bg-surface-neutral-50/70"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                          style={{ backgroundColor: option.color }}
                        >
                          {isSelected && (
                            <Check className="w-4 h-4 text-white stroke-[2.5]" />
                          )}
                        </div>
                        <span className="mt-2 text-xs font-semibold text-content-neutral-900">
                          {option.name}
                        </span>
                        <span className="text-[11px] text-content-neutral-500">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : isLoading ? (
            <div className="bg-surface rounded-2xl border border-line-neutral-200/80 p-8 space-y-6 animate-pulse">
              <div className="h-6 w-36 bg-surface-neutral-200 rounded-md" />
              <div className="h-10 w-full bg-surface-neutral-100 rounded-lg" />
              <div className="h-10 w-full bg-surface-neutral-100 rounded-lg" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="settings-section space-y-6">
              {/* TAB 1: MY PROFILE */}
              {activeTab === "profile" && (
                <div className="settings-section space-y-6">
                  {/* Role Profiles & Password Locks Card */}
                  <div className="ui-card p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-content-neutral-900">
                            Role Profiles & Password Locks
                          </h2>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-neutral-100 text-content-neutral-700">
                            {profiles.length} / {maxProfiles} Profiles
                          </span>
                        </div>
                        <p className="text-xs text-content-neutral-500 mt-0.5 max-w-[65ch]">
                          Keep Software Engineering, AI Development, and
                          Technical Consulting in separate workspaces. Each
                          profile has its own SQLite ledger, invoice sequence,
                          and optional password lock.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProfileGate("onboarding")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-line-neutral-200 bg-surface hover:bg-surface-neutral-100 text-content-neutral-800 cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-content-neutral-500" />
                          Role Setup Wizard
                        </button>
                        <button
                          type="button"
                          onClick={() => openProfileGate("select")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-line-neutral-200 bg-surface hover:bg-surface-neutral-100 text-content-neutral-800 cursor-pointer"
                        >
                          <UsersRound className="w-3.5 h-3.5" />
                          Switch Profile Screen
                        </button>
                        {profiles.length < maxProfiles && (
                          <button
                            type="button"
                            onClick={() => openProfileGate("create")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent-solid text-white hover:opacity-95 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Profile
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {profiles.map((prof) => {
                        const isCurrent = prof.id === activeProfile.id;
                        return (
                          <div
                            key={prof.id}
                            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                              isCurrent
                                ? "bg-surface-neutral-50 border-content-neutral-900/30 ring-1 ring-content-neutral-900/15"
                                : "bg-surface border-line-neutral-200"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <ProfileAvatarTile
                                avatar={prof.avatar}
                                accent={prof.accent}
                                size="sm"
                                hasPassword={prof.hasPassword}
                                isActive={isCurrent}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-content-neutral-900 truncate">
                                    {prof.name}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-content-neutral-500 truncate">
                                  {prof.subtitle}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] font-mono text-content-neutral-600 bg-surface-neutral-100 px-1.5 py-0.5 rounded">
                                    {prof.invoicePrefix} ·{" "}
                                    {prof.defaultCurrency}
                                  </span>
                                  <span className="text-[10px] text-content-neutral-500">
                                    {prof.hasPassword
                                      ? "Password Locked"
                                      : "Unlocked"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (prof.hasPassword) {
                                      openProfileGate("select");
                                    } else {
                                      void switchProfile(prof.id);
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-surface-neutral-100 hover:bg-surface-neutral-200 text-content-neutral-800 cursor-pointer"
                                >
                                  Use
                                </button>
                              )}
                              {isCurrent && prof.hasPassword && (
                                <button
                                  type="button"
                                  onClick={lockCurrentProfile}
                                  title="Lock this profile now"
                                  className="p-1.5 rounded-lg hover:bg-surface-neutral-100 text-content-neutral-600 cursor-pointer"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openProfileGate("manage", prof)}
                                title="Edit profile & password lock"
                                className="p-1.5 rounded-lg hover:bg-surface-neutral-100 text-content-neutral-600 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Preview Card */}
                  <div className="ui-card from-surface-purple-50/70 to-surface-neutral-50 border-line-purple-200/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent-solid text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
                        {avatarLetter}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-content-neutral-900 text-base">
                            {formState.businessName?.trim() || "Your Name"}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-purple-100 text-content-purple-800">
                            Appears on Invoices
                          </span>
                        </div>
                        <p className="text-xs text-content-neutral-500 mt-0.5">
                          {formState.professionalTitle?.trim() ||
                            "Freelance Specialist / Sole Proprietor"}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-content-neutral-500 mt-1.5">
                          {formState.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-content-neutral-400" />
                              {formState.email}
                            </span>
                          )}
                          {formState.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-content-neutral-400" />
                              {formState.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Basic Personal Info */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Your Details
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Enter your name and contact details. These will appear
                        at the top of every invoice you send to clients.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-your-name-or-studio-name"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Your Name or Studio Name
                        </label>
                        <input
                          id="settings-your-name-or-studio-name"
                          type="text"
                          value={formState.businessName || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              businessName: e.target.value,
                            })
                          }
                          placeholder="e.g. Chethaka or Chethaka Studio"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="settings-what-do-you-do-title"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          What do you do? (Title)
                        </label>
                        <input
                          id="settings-what-do-you-do-title"
                          type="text"
                          value={formState.professionalTitle || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              professionalTitle: e.target.value,
                            })
                          }
                          placeholder="e.g. Software Developer & AI Consultant"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="settings-email-address"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Email Address
                        </label>
                        <input
                          id="settings-email-address"
                          type="email"
                          value={formState.email || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              email: e.target.value,
                            })
                          }
                          placeholder="alex@example.com"
                          className={`ui-field w-full px-3.5 py-2 text-sm bg-surface-neutral-50/50 border rounded-xl focus:bg-surface outline-none transition-colors ${
                            formErrors.email
                              ? "border-line-rose-400 focus:ring-line-rose-400"
                              : "border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent"
                          }`}
                        />
                        {formErrors.email && (
                          <p className="text-xs text-content-rose-600 mt-1">
                            {formErrors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                          Phone Number{" "}
                          <span className="text-content-neutral-400 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <input
                          type="tel"
                          value={formState.phone || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+1 (555) 000-0000"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                          Website or Portfolio{" "}
                          <span className="text-content-neutral-400 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={formState.website || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              website: e.target.value,
                            })
                          }
                          placeholder="https://yourportfolio.com"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address & Tax Number */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Address & Tax Information
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Optional details if you want your physical location or
                        tax registration number printed on invoices.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-your-address-or-city"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Your Address or City
                        </label>
                        <textarea
                          id="settings-your-address-or-city"
                          rows={3}
                          value={formState.address || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              address: e.target.value,
                            })
                          }
                          placeholder="123 Innovation Way&#10;San Francisco, CA 94105"
                          className="ui-field ui-textarea w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors resize-none leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                          Tax / Business Number{" "}
                          <span className="text-content-neutral-400 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={formState.taxId || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              taxId: e.target.value,
                            })
                          }
                          placeholder="e.g. VAT or Tax ID number"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                        <p className="text-[11px] text-content-neutral-400 mt-1.5 leading-relaxed">
                          Leave blank if you are not registered for VAT or sales
                          tax.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Where Clients Send Payment */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        How Clients Pay You
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Add your bank details, Wise link, or PayPal address.
                        These instructions will be printed at the bottom of your
                        invoices.
                      </p>
                    </div>

                    <div>
                      <textarea
                        rows={4}
                        value={formState.paymentDetails || ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            paymentDetails: e.target.value,
                          })
                        }
                        placeholder={
                          "Bank: Chase / Wise&#10;Account Name: Alex Carter&#10;Account No: 1234 5678 9012&#10;PayPal or Wise Tag: alex@example.com"
                        }
                        className="ui-field ui-textarea w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors resize-none font-mono leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INVOICES */}
              {activeTab === "invoices" && (
                <div className="settings-section space-y-6">
                  {/* Default Invoice Template */}
                  <div className="ui-card p-6 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-content-neutral-900">
                          Default Invoice Design Template
                        </h2>
                        <p className="text-xs text-content-neutral-500 mt-0.5">
                          Pick the page layout used for invoice previews and
                          exported PDFs.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setPreviewTemplateId(
                            formState.defaultInvoiceTemplate ||
                              "geometric-teal",
                          )
                        }
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview template
                      </Button>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Default Invoice Design Template"
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5"
                    >
                      {INVOICE_TEMPLATE_OPTIONS.map((tmpl) => {
                        const isSelected =
                          (formState.defaultInvoiceTemplate ||
                            "geometric-teal") === tmpl.id;
                        return (
                          <div
                            key={tmpl.id}
                            className={`group relative flex flex-col rounded-xl border transition-all duration-150 ${
                              isSelected
                                ? "border-accent bg-accent/[0.04] ring-2 ring-accent/20"
                                : "border-line-neutral-200 dark:border-white/10 hover:border-line-neutral-300 dark:hover:border-white/20 bg-surface"
                            }`}
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() =>
                                void handleSelectInvoiceTemplate(tmpl.id)
                              }
                              className="flex flex-col flex-1 text-left p-3 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              {/* Miniature A4 Sheet Preview */}
                              <div className="relative w-full aspect-[180/232] rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-white shadow-[0px_2px_6px_rgba(0,0,0,0.08)] mb-3 transition-transform duration-200 group-hover:scale-[1.01]">
                                <InvoiceTemplateMiniPreview
                                  templateId={tmpl.id}
                                />
                              </div>

                              {/* Template Title & Summary */}
                              <div className="flex items-center gap-2 min-w-0 mb-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: tmpl.color }}
                                />
                                <span className="text-xs font-semibold text-content-neutral-900 truncate">
                                  {tmpl.name}
                                </span>
                              </div>

                              <p className="text-[11px] text-content-neutral-500 leading-snug mb-3">
                                {tmpl.summary}
                              </p>

                              {/* Status Footer */}
                              <div className="mt-auto pt-2.5 border-t border-line-neutral-200/60 dark:border-white/10 flex items-center justify-between gap-1.5">
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Active default</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-content-neutral-400 group-hover:text-content-neutral-700 transition-colors">
                                    Set as default
                                  </span>
                                )}
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-500">
                                  {tmpl.surfaceLabel}
                                </span>
                              </div>
                            </button>

                            {/* Quick Full-Size Preview Trigger */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTemplateId(tmpl.id);
                              }}
                              title={`Preview ${tmpl.name}`}
                              aria-label={`Preview ${tmpl.name} template`}
                              className="absolute top-5 right-5 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-neutral-900/80 text-white backdrop-blur-sm border border-white/15 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-neutral-900 transition-opacity cursor-pointer shadow-sm"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Invoice PDF Folder */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Invoice PDF Folder
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Choose where exported invoice PDFs are saved on your
                        computer.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200/80">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FolderOpen className="w-4 h-4 text-content-neutral-400 shrink-0" />
                        <span className="text-xs font-mono text-content-neutral-700 truncate">
                          {formState.pdfExportDirectory ||
                            "Downloads (default)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!isElectron || isSaving}
                          onClick={async () => {
                            try {
                              const folder =
                                await workflow.files.selectPdfDirectory();
                              if (folder)
                                setFormState((previous) => ({
                                  ...previous,
                                  pdfExportDirectory: folder,
                                }));
                            } catch (error) {
                              showToast(
                                error instanceof Error
                                  ? error.message
                                  : "Could not select folder",
                                "error",
                              );
                            }
                          }}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Choose folder
                        </Button>
                        {formState.pdfExportDirectory && (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={isSaving}
                            onClick={() =>
                              setFormState((previous) => ({
                                ...previous,
                                pdfExportDirectory: null,
                              }))
                            }
                          >
                            Reset to Downloads
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Currency & Payment Due */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Currency &amp; Payment Terms
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Choose the currency for new invoices and workspace
                        financial summaries. Existing records keep their
                        original currencies.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-content-neutral-700">
                            Default Currency
                          </label>
                          <span className="text-[11px] font-semibold text-accent">
                            Active: {formState.defaultCurrency || "USD"} (
                            {getCurrencySymbol(
                              formState.defaultCurrency || "USD",
                            ).trim()}
                            )
                          </span>
                        </div>
                        <select
                          value={formState.defaultCurrency || "USD"}
                          onChange={async (e) => {
                            const newCurrency = e.target.value as Currency;
                            setFormState((prev) => ({
                              ...prev,
                              defaultCurrency: newCurrency,
                            }));
                            try {
                              await updateSettings({
                                defaultCurrency: newCurrency,
                              });
                              showToast(
                                `System currency updated to ${newCurrency} (${getCurrencySymbol(newCurrency).trim()}). All pages now use this currency.`,
                                "success",
                              );
                            } catch (err: unknown) {
                              const msg =
                                err instanceof Error
                                  ? err.message
                                  : "Failed to update currency";
                              showToast(msg, "error");
                            }
                          }}
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        >
                          <option value="USD">USD ($ - US Dollar)</option>
                          <option value="EUR">EUR (€ - Euro)</option>
                          <option value="LKR">
                            LKR (Rs. - Sri Lanka Rupee)
                          </option>
                          <option value="GBP">GBP (£ - British Pound)</option>
                          <option value="CAD">
                            CAD (CA$ - Canadian Dollar)
                          </option>
                        </select>
                        <p className="text-[11px] text-content-neutral-400 mt-1">
                          Amounts in different currencies are kept separate; no
                          conversion is applied.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="settings-payment-due-within"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Payment Due Within
                        </label>
                        <select
                          id="settings-payment-due-within"
                          value={String(formState.defaultDueDays ?? 14)}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              defaultDueDays: parseInt(e.target.value, 10),
                            })
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        >
                          <option value="0">Due on Receipt (Immediate)</option>
                          <option value="7">7 Days</option>
                          <option value="14">14 Days (Recommended)</option>
                          <option value="30">30 Days</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="settings-default-tax-rate"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Default Tax Rate (%)
                        </label>
                        <div className="relative">
                          <input
                            id="settings-default-tax-rate"
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={formState.defaultTaxRate ?? 0}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                defaultTaxRate: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                          />
                          <span className="absolute right-3.5 top-2 text-sm text-content-neutral-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Numbers */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Invoice Numbering
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        BillFlow automatically generates unique, sequential
                        numbers for each invoice.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-invoice-prefix"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Invoice Prefix
                        </label>
                        <input
                          id="settings-invoice-prefix"
                          type="text"
                          value={formState.invoicePrefix || "INV-"}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              invoicePrefix: e.target.value,
                            })
                          }
                          placeholder="INV-"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors font-mono"
                        />
                        <p className="text-[11px] text-content-neutral-400 mt-1">
                          Default is{" "}
                          <code className="font-mono text-content-neutral-600">
                            INV-
                          </code>
                          .
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="settings-next-number"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Next Number
                        </label>
                        <input
                          id="settings-next-number"
                          type="number"
                          min="1"
                          value={formState.nextInvoiceSeq || 1}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              nextInvoiceSeq: Math.max(
                                1,
                                parseInt(e.target.value, 10) || 1,
                              ),
                            })
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors font-mono"
                        />
                        <p className="text-[11px] text-content-neutral-400 mt-1">
                          Change this if you want to start from a specific
                          number.
                        </p>
                      </div>
                    </div>

                    {/* Visual Preview */}
                    <div className="p-4 rounded-xl bg-surface-purple-50/60 border border-line-purple-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-accent" />
                        <span className="text-xs font-medium text-content-purple-950">
                          Your next invoice will be:
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-accent px-3 py-1 bg-surface rounded-lg border border-line-purple-200 shadow-xs">
                        {previewInvoiceCode}
                      </span>
                    </div>
                  </div>

                  {/* Default Note */}
                  <div className="ui-card p-6 space-y-3">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Default Note to Clients
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Friendly text included at the bottom of all your
                        invoices.
                      </p>
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={formState.defaultNotes || ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            defaultNotes: e.target.value,
                          })
                        }
                        placeholder="Thank you for your business! Please reach out if you have any questions regarding this invoice."
                        className="ui-field ui-textarea w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: BACKUP & DATA */}
              {activeTab === "data" && (
                <div className="settings-section space-y-6">
                  {/* Local Storage Card */}
                  <div className="ui-card p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-content-neutral-900">
                          Offline & Private Storage
                        </h2>
                        <p className="text-xs text-content-neutral-500 mt-0.5">
                          {isElectron
                            ? "Your business records and receipts are stored on this computer in the BillFlow app."
                            : "You are viewing the browser preview. Open the desktop app to manage its SQLite database and complete backups."}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-surface-emerald-500" />
                        {isElectron ? "Saved Locally" : "Browser Preview"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium text-content-neutral-400 block uppercase tracking-wider">
                          Database File Location
                        </span>
                        <code className="text-xs font-mono text-content-neutral-800 block truncate mt-0.5">
                          {dbPath || "Loading database path..."}
                        </code>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron}
                          onClick={handleCopyPath}
                        >
                          <IconCrossfade
                            iconKey={copiedPath ? "copied" : "copy"}
                            className="w-3.5 h-3.5"
                          >
                            {copiedPath ? (
                              <Check className="w-3.5 h-3.5 text-content-emerald-600 success-confirm-pulse rounded-full" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-content-neutral-500" />
                            )}
                          </IconCrossfade>
                          {copiedPath ? "Copied" : "Copy Path"}
                        </Button>

                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron}
                          onClick={() => revealDbFile()}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Open Folder
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Backup & Restore */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Backup & Restore
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Save a copy of your records or restore from an earlier
                        backup file.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-line-neutral-200 flex flex-col justify-between gap-3 bg-surface-neutral-50/30">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-content-neutral-900">
                            <Download className="w-4 h-4 text-accent" />
                            Download Backup File
                          </div>
                          <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                            Saves all workflow records, profile settings and
                            receipt files into one complete backup.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron}
                          onClick={handleExportJson}
                          className="w-full"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save Backup
                        </Button>
                      </div>

                      <div className="p-4 rounded-xl border border-line-neutral-200 flex flex-col justify-between gap-3 bg-surface-neutral-50/30">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-content-neutral-900">
                            <Upload className="w-4 h-4 text-accent" />
                            Restore from Backup
                          </div>
                          <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                            Replace business records and profile settings with a
                            complete backup, including managed receipts.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron}
                          onClick={() => {
                            setImportFile(null);
                            setParsedImport(null);
                            setImportError(null);
                            setIsImportModalOpen(true);
                          }}
                          className="w-full"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Choose File to Restore
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Reset Data */}
                  <div className="ui-card p-6 space-y-4 ui-card--danger">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-surface-rose-50 text-content-rose-600 shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-content-rose-950">
                          Start Over (Clear Data)
                        </h2>
                        <p className="text-xs text-content-rose-700 mt-0.5 leading-relaxed">
                          Need a blank slate? This deletes all business records
                          and managed receipts. Profile and appearance settings
                          are kept.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="danger"
                        type="button"
                        onClick={() => {
                          setResetConfirmation("");
                          setIsResetModalOpen(true);
                        }}
                      >
                        Clear All Records
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Save Bar */}
              <MotionPresence>
                {isDirty && (
                  <div className="sticky bottom-6 z-20">
                    <MotionSurface
                      kind="panel"
                      className="bg-surface/95 backdrop-blur-md border border-line-neutral-200/90 rounded-2xl p-4 shadow-[0px_12px_24px_-6px_rgba(0,0,0,0.1),0px_0px_0px_1px_rgba(0,0,0,0.06)] flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent-solid animate-pulse" />
                        <span className="text-xs font-medium text-content-neutral-800">
                          You have unsaved changes
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => {
                            if (settings) {
                              setFormState({
                                businessName: settings.businessName || "",
                                professionalTitle:
                                  settings.professionalTitle || "",
                                email: settings.email || "",
                                phone: settings.phone || "",
                                website: settings.website || "",
                                taxId: settings.taxId || "",
                                address: settings.address || "",
                                paymentDetails: settings.paymentDetails || "",
                                defaultCurrency:
                                  settings.defaultCurrency || "USD",
                                invoicePrefix: settings.invoicePrefix || "INV-",
                                nextInvoiceSeq: settings.nextInvoiceSeq || 1,
                                defaultDueDays: settings.defaultDueDays ?? 14,
                                defaultTaxRate: settings.defaultTaxRate ?? 0,
                                defaultNotes: settings.defaultNotes || "",
                                defaultInvoiceTemplate:
                                  settings.defaultInvoiceTemplate ||
                                  "geometric-teal",
                                dateFormat: settings.dateFormat || "YYYY-MM-DD",
                                currencyDisplay:
                                  settings.currencyDisplay || "symbol",
                                pdfExportDirectory:
                                  settings.pdfExportDirectory || null,
                              });
                              setFormErrors({});
                            }
                          }}
                        >
                          Discard
                        </Button>

                        <Button
                          variant="primary"
                          type="submit"
                          disabled={isSaving}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </MotionSurface>
                  </div>
                )}
              </MotionPresence>
            </form>
          )}
        </div>
      </div>

      {/* RESTORE MODAL */}
      <MotionPresence>
        {isImportModalOpen && (
          <Dialog onClose={() => setIsImportModalOpen(false)} width={560}>
            <div className="app-dialog-header app-dialog-header--stack">
              <h3 className="text-base font-semibold text-content-neutral-900">
                Restore Data from Backup
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1">
                Select a complete backup. Restoring replaces all business
                records and profile settings with the backup contents.
              </p>
            </div>
            <div className="app-dialog-body">
              <div className="space-y-3">
                <label className="block border-2 border-dashed border-line-neutral-200 hover:border-accent rounded-xl p-5 text-center cursor-pointer transition-colors bg-surface-neutral-50/50">
                  <Upload className="w-5 h-5 text-content-neutral-400 mx-auto mb-1.5" />
                  <span className="text-xs font-medium text-content-neutral-700 block">
                    {importFile ? importFile.name : "Select backup .json file"}
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {importError && (
                  <div className="p-3 rounded-xl bg-surface-rose-50 border border-line-rose-200 text-xs text-content-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {parsedImport && (
                  <div className="p-3.5 rounded-xl bg-surface-purple-50 border border-line-purple-100 text-xs text-content-purple-950 space-y-1">
                    <div className="font-semibold text-accent">
                      File Verified
                    </div>
                    <div className="text-content-neutral-700">
                      Contains{" "}
                      <strong>
                        {parsedImport.clients?.length || 0} clients
                      </strong>{" "}
                      and{" "}
                      <strong>
                        {parsedImport.invoices?.length || 0} invoices
                      </strong>
                      .
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="app-dialog-footer">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                disabled={!parsedImport || isImporting}
                onClick={handleConfirmImport}
              >
                {isImporting ? "Restoring..." : "Restore Data"}
              </Button>
            </div>
          </Dialog>
        )}
      </MotionPresence>

      {/* RESET CONFIRMATION MODAL */}
      <MotionPresence>
        {isResetModalOpen && (
          <Dialog onClose={() => setIsResetModalOpen(false)} width={460}>
            <div className="app-dialog-header">
              <div className="p-2 rounded-xl bg-surface-rose-50 text-content-rose-600 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-content-rose-950">
                  Clear all records?
                </h3>
                <p className="text-xs text-content-rose-700 mt-1 leading-relaxed">
                  This will delete all business records and managed receipts.
                  Profile and appearance settings are kept. This cannot be
                  undone.
                </p>
              </div>
            </div>
            <div className="app-dialog-body">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-content-neutral-700">
                  Type{" "}
                  <span className="font-mono font-bold text-content-rose-600">
                    DELETE ALL DATA
                  </span>{" "}
                  to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="DELETE ALL DATA"
                  className="ui-field w-full px-3 border border-line-neutral-200 font-mono focus:border-line-rose-500 focus:ring-1 focus:ring-line-rose-500 outline-none transition-colors"
                />
              </div>
            </div>
            <div className="app-dialog-footer">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsResetModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                disabled={
                  resetConfirmation !== "DELETE ALL DATA" || isResetting
                }
                onClick={handleConfirmReset}
              >
                {isResetting ? "Clearing..." : "Clear Business Data"}
              </Button>
            </div>
          </Dialog>
        )}
      </MotionPresence>

      {/* FULL-SIZE INVOICE TEMPLATE PREVIEW MODAL */}
      {previewTemplateId && (
        <InvoiceDocumentSheet
          invoice={samplePreviewInvoice}
          initialTemplate={previewTemplateId}
          onSelectTemplate={(id) => void handleSelectInvoiceTemplate(id)}
          onClose={() => setPreviewTemplateId(null)}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="workspace-page settings-page motion-page max-w-none">
          <div className="h-10 w-48 bg-surface-neutral-200 rounded-xl" />
          <div className="h-10 w-72 bg-surface-neutral-200 rounded-xl" />
          <div className="h-64 bg-surface-neutral-200 rounded-2xl" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
