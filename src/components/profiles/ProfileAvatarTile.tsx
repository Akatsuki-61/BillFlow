"use client";

import React from "react";
import {
  Code2,
  Sparkles,
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
    label: string;
  }
> = {
  blue: {
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(37, 99, 235, 0.28)",
    ring: "rgba(37, 99, 235, 0.25)",
    iconColor: "#3B82F6",
    badgeBg: "rgba(37, 99, 235, 0.12)",
    badgeText: "#2563EB",
    swatch: "#2563EB",
    patternStroke: "rgba(37, 99, 235, 0.14)",
    label: "Blue",
  },
  purple: {
    bg: "rgba(124, 58, 237, 0.12)",
    border: "rgba(124, 58, 237, 0.28)",
    ring: "rgba(124, 58, 237, 0.25)",
    iconColor: "#8B5CF6",
    badgeBg: "rgba(124, 58, 237, 0.12)",
    badgeText: "#7C3AED",
    swatch: "#7C3AED",
    patternStroke: "rgba(124, 58, 237, 0.14)",
    label: "Purple",
  },
  emerald: {
    bg: "rgba(5, 150, 105, 0.12)",
    border: "rgba(5, 150, 105, 0.28)",
    ring: "rgba(5, 150, 105, 0.25)",
    iconColor: "#10B981",
    badgeBg: "rgba(5, 150, 105, 0.12)",
    badgeText: "#059669",
    swatch: "#059669",
    patternStroke: "rgba(5, 150, 105, 0.14)",
    label: "Emerald",
  },
  rose: {
    bg: "rgba(225, 29, 72, 0.12)",
    border: "rgba(225, 29, 72, 0.28)",
    ring: "rgba(225, 29, 72, 0.25)",
    iconColor: "#F43F5E",
    badgeBg: "rgba(225, 29, 72, 0.12)",
    badgeText: "#E11D48",
    swatch: "#E11D48",
    patternStroke: "rgba(225, 29, 72, 0.14)",
    label: "Rose",
  },
  amber: {
    bg: "rgba(217, 119, 6, 0.12)",
    border: "rgba(217, 119, 6, 0.28)",
    ring: "rgba(217, 119, 6, 0.25)",
    iconColor: "#F59E0B",
    badgeBg: "rgba(217, 119, 6, 0.12)",
    badgeText: "#D97706",
    swatch: "#D97706",
    patternStroke: "rgba(217, 119, 6, 0.14)",
    label: "Amber",
  },
  indigo: {
    bg: "rgba(79, 70, 229, 0.12)",
    border: "rgba(79, 70, 229, 0.28)",
    ring: "rgba(79, 70, 229, 0.25)",
    iconColor: "#6366F1",
    badgeBg: "rgba(79, 70, 229, 0.12)",
    badgeText: "#4F46E5",
    swatch: "#4F46E5",
    patternStroke: "rgba(79, 70, 229, 0.14)",
    label: "Indigo",
  },
};

export const PROFILE_AVATAR_ICONS: Record<
  ProfileAvatar,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  code: Code2,
  sparkles: Sparkles,
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
  className?: string;
}

const SIZE_MAP = {
  xs: {
    box: "w-7 h-7 rounded-full",
    icon: "w-3.5 h-3.5",
    badge: "w-3.5 h-3.5 -bottom-0.5 -right-0.5",
    badgeIcon: "w-2 h-2",
  },
  sm: {
    box: "w-9 h-9 rounded-full",
    icon: "w-4 h-4",
    badge: "w-4 h-4 -bottom-0.5 -right-0.5",
    badgeIcon: "w-2.5 h-2.5",
  },
  md: {
    box: "w-11 h-11 rounded-2xl",
    icon: "w-5 h-5",
    badge: "w-4.5 h-4.5 -bottom-0.5 -right-0.5",
    badgeIcon: "w-2.5 h-2.5",
  },
  lg: {
    box: "w-16 h-16 rounded-2xl",
    icon: "w-7 h-7",
    badge: "w-5 h-5 -bottom-1 -right-1",
    badgeIcon: "w-2.5 h-2.5",
  },
  xl: {
    box: "w-20 h-20 rounded-[20px]",
    icon: "w-8 h-8",
    badge: "w-6 h-6 -bottom-1 -right-1",
    badgeIcon: "w-3 h-3",
  },
};

export function ProfileAvatarTile({
  avatar,
  accent,
  size = "md",
  hasPassword = false,
  isActive = false,
  isManageMode = false,
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
        className={`${sizeSpec.box} relative overflow-hidden flex items-center justify-center transition-all duration-150 border`}
        style={{
          backgroundColor: style.bg,
          borderColor: isActive ? style.swatch : style.border,
          color: style.iconColor,
        }}
      >
        <Icon className={sizeSpec.icon} strokeWidth={1.9} />

        {isManageMode && (
          <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
            <Pencil className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {hasPassword && !isManageMode && (
        <span
          title="Password protected"
          className={`${sizeSpec.badge} absolute z-20 rounded-full bg-surface border border-line-neutral-200 text-content-neutral-700 flex items-center justify-center shadow-xs`}
        >
          <Lock className={sizeSpec.badgeIcon} strokeWidth={2.2} />
        </span>
      )}
    </div>
  );
}
