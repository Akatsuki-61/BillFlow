"use client";

import type { InvoiceTemplateId } from "@/types/billing";

export function InvoiceTemplateMiniPreview({
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
        <rect x="144" y="223.5" width="22" height="3" rx="1" fill="#94A3B8" />
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
        <rect x="26" y="16" width="28" height="2.5" rx="1" fill="#FFEDD5" />
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
            <rect x="110" y={y} width="18" height="3.5" rx="1" fill="#475569" />
            <rect x="142" y={y} width="18" height="3.5" rx="1" fill="#0F172A" />
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
        <rect x="144" y="223.5" width="22" height="3" rx="1" fill="#94A3B8" />
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
      <circle cx="58" cy="15" r="2" stroke="#FFFFFF" strokeWidth="1.2" />
      <circle cx="63" cy="15" r="2" stroke="#FFFFFF" strokeWidth="1.2" />
      <circle cx="58" cy="20" r="2" stroke="#FFFFFF" strokeWidth="1.2" />
      <circle cx="63" cy="20" r="2" stroke="#FFFFFF" strokeWidth="1.2" />
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
