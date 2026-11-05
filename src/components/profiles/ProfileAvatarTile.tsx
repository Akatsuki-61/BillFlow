"use client";

import React from "react";
import {
  Code2,
  Terminal,
  Compass,
  Layers,
  Briefcase,
  Cpu,
  Globe,
  Shield,
  Lock,
  Pencil,
} from "lucide-react";
import type { ProfileAvatar } from "@/types/profiles";
import type { AccentPreference } from "@/lib/theme";

export const PROFILE_ACCENT_STYLES: Record<
  AccentPreference,
  {
    bg: string;
    border: string;
    ring: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    swatch: string;
    patternStroke: string;
    glow: string;
    label: string;
  }
> = {
  blue: {
    bg: "linear-gradient(155deg, #1E40AF 0%, #1D4ED8 48%, #0F172A 100%)",
    border: "rgba(96, 165, 250, 0.36)",
    ring: "rgba(59, 130, 246, 0.45)",
    iconColor: "#EFF6FF",
    badgeBg: "rgba(37, 99, 235, 0.14)",
    badgeText: "#60A5FA",
    swatch: "#2563EB",
    patternStroke: "rgba(191, 219, 254, 0.18)",
    glow: "rgba(37, 99, 235, 0.32)",
    label: "Cobalt",
  },
  purple: {
    bg: "linear-gradient(155deg, #5B21B6 0%, #6D28D9 48%, #1E1B4B 100%)",
    border: "rgba(196, 181, 253, 0.36)",
    ring: "rgba(139, 92, 246, 0.45)",
    iconColor: "#F5F3FF",
    badgeBg: "rgba(124, 58, 237, 0.14)",
    badgeText: "#A78BFA",
    swatch: "#7C3AED",
    patternStroke: "rgba(221, 214, 254, 0.18)",
    glow: "rgba(124, 58, 237, 0.32)",
    label: "Violet",
  },
  emerald: {
    bg: "linear-gradient(155deg, #065F46 0%, #047857 48%, #06281E 100%)",
    border: "rgba(110, 231, 183, 0.36)",
    ring: "rgba(16, 185, 129, 0.45)",
    iconColor: "#ECFDF5",
    badgeBg: "rgba(5, 150, 105, 0.14)",
    badgeText: "#34D399",
    swatch: "#059669",
    patternStroke: "rgba(167, 243, 208, 0.18)",
    glow: "rgba(5, 150, 105, 0.32)",
    label: "Emerald",
  },
  rose: {
    bg: "linear-gradient(155deg, #9F1239 0%, #BE123C 48%, #2A0A18 100%)",
    border: "rgba(253, 164, 175, 0.36)",
    ring: "rgba(244, 63, 94, 0.45)",
    iconColor: "#FFF1F2",
    badgeBg: "rgba(225, 29, 72, 0.14)",
    badgeText: "#FB7185",
    swatch: "#E11D48",
    patternStroke: "rgba(254, 205, 211, 0.18)",
    glow: "rgba(225, 29, 72, 0.32)",
    label: "Crimson",
  },
  amber: {
    bg: "linear-gradient(155deg, #92400E 0%, #B45309 48%, #271306 100%)",
    border: "rgba(252, 211, 77, 0.36)",
    ring: "rgba(245, 158, 11, 0.45)",
    iconColor: "#FFFBEB",
    badgeBg: "rgba(217, 119, 6, 0.14)",
    badgeText: "#FBBF24",
    swatch: "#D97706",
    patternStroke: "rgba(253, 230, 138, 0.18)",
    glow: "rgba(217, 119, 6, 0.32)",
    label: "Amber",
  },
  indigo: {
    bg: "linear-gradient(155deg, #312E81 0%, #4338CA 48%, #0F1026 100%)",
    border: "rgba(165, 180, 252, 0.36)",
    ring: "rgba(99, 102, 241, 0.45)",
    iconColor: "#EEF2FF",
    badgeBg: "rgba(79, 70, 229, 0.14)",
    badgeText: "#818CF8",
    swatch: "#4F46E5",
    patternStroke: "rgba(199, 210, 254, 0.18)",
    glow: "rgba(79, 70, 229, 0.32)",
    label: "Indigo",
  },
};

export const PROFILE_AVATAR_ICONS: Record<
  ProfileAvatar,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  code: Code2,
  terminal: Terminal,
  compass: Compass,
  layers: Layers,
  briefcase: Briefcase,
  cpu: Cpu,
  globe: Globe,
  shield: Shield,
};

interface ProfileAvatarTileProps {
  avatar: ProfileAvatar;
  accent: AccentPreference;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  hasPassword?: boolean;
  isActive?: boolean;
  isManageMode?: boolean;
  interactiveHover?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: {
    box: "w-7 h-7 rounded-lg",
    icon: "w-3.5 h-3.5",
    badge: "w-3.5 h-3.5 -bottom-0.5 -right-0.5",
    badgeIcon: "w-2 h-2",
    pencilCircle: "w-5 h-5",
    pencilIcon: "w-2.5 h-2.5",
  },
  sm: {
    box: "w-9 h-9 rounded-xl",
    icon: "w-4 h-4",
    badge: "w-4 h-4 -bottom-0.5 -right-0.5",
    badgeIcon: "w-2.5 h-2.5",
    pencilCircle: "w-6 h-6",
    pencilIcon: "w-3 h-3",
  },
  md: {
    box: "w-12 h-12 rounded-2xl",
    icon: "w-5 h-5",
    badge: "w-4.5 h-4.5 -bottom-0.5 -right-0.5",
    badgeIcon: "w-2.5 h-2.5",
    pencilCircle: "w-7 h-7",
    pencilIcon: "w-3.5 h-3.5",
  },
  lg: {
    box: "w-28 h-28 rounded-[16px]",
    icon: "w-11 h-11",
    badge: "w-6 h-6 -bottom-1 -right-1",
    badgeIcon: "w-3 h-3",
    pencilCircle: "w-10 h-10",
    pencilIcon: "w-4 h-4",
  },
  xl: {
    box: "w-32 h-32 sm:w-36 sm:h-36 rounded-[16px]",
    icon: "w-13 h-13 sm:w-14 sm:h-14",
    badge: "w-6 h-6 -bottom-1 -right-1",
    badgeIcon: "w-3 h-3",
    pencilCircle: "w-12 h-12",
    pencilIcon: "w-5 h-5",
  },
};

export function ProfileAvatarTile({
  avatar,
  accent,
  size = "md",
  hasPassword = false,
  isActive = false,
  isManageMode = false,
  interactiveHover = false,
  className = "",
}: ProfileAvatarTileProps) {
  const style = PROFILE_ACCENT_STYLES[accent] ?? PROFILE_ACCENT_STYLES.blue;
  const Icon = PROFILE_AVATAR_ICONS[avatar] ?? Code2;
  const sizeSpec = SIZE_MAP[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
    >
      <div
        className={`${sizeSpec.box} relative overflow-hidden flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_12px_28px_-8px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.12)_inset] ${
          interactiveHover
            ? "group-hover:ring-[3px] group-hover:ring-white group-focus-visible:ring-[3px] group-focus-visible:ring-white"
            : ""
        }`}
        style={{
          background: style.bg,
          boxShadow: isActive
            ? `0 0 0 2px #090A0F, 0 0 0 4px #FFFFFF, 0 18px 36px -8px ${style.glow}`
            : undefined,
        }}
      >
        {/* Subtle studio geometric contours */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="84"
            cy="16"
            r="36"
            stroke={style.patternStroke}
            strokeWidth="1.2"
          />
          <circle
            cx="84"
            cy="16"
            r="56"
            stroke={style.patternStroke}
            strokeWidth="0.9"
          />
          <path
            d="M-10 82 Q 42 62, 110 88"
            stroke={style.patternStroke}
            strokeWidth="1.2"
          />
          <rect
            x="0"
            y="0"
            width="100"
            height="46"
            fill="url(#netflix-tile-sheen)"
            opacity="0.16"
          />
          <defs>
            <linearGradient id="netflix-tile-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div
          className="relative z-10 flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
          style={{ color: style.iconColor }}
        >
          <Icon className={sizeSpec.icon} strokeWidth={1.75} />
        </div>

        {/* Netflix Manage Profiles Pencil Overlay */}
        {isManageMode && (
          <div className="absolute inset-0 z-20 bg-black/55 backdrop-blur-[1px] flex items-center justify-center transition-opacity duration-150">
            <div
              className={`${sizeSpec.pencilCircle} rounded-full border-2 border-white/85 bg-black/35 flex items-center justify-center text-white`}
            >
              <Pencil className={sizeSpec.pencilIcon} strokeWidth={2} />
            </div>
          </div>
        )}
      </div>

      {hasPassword && !isManageMode && (size === "xs" || size === "sm") && (
        <span
          title="Passcode locked"
          className={`${sizeSpec.badge} absolute z-20 rounded-full bg-zinc-900 text-zinc-200 border border-white/20 flex items-center justify-center shadow-xs`}
        >
          <Lock className={sizeSpec.badgeIcon} strokeWidth={2.2} />
        </span>
      )}
    </div>
  );
}
