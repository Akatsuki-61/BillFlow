"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  ArrowLeft,
  Trash2,
  SlidersHorizontal,
  KeyRound,
  Hash,
  Type,
} from "lucide-react";
import { useProfiles } from "@/context/ProfileContext";
import {
  MAX_PROFILES,
  PROFILE_ROLE_LIST,
  PROFILE_ROLE_PRESETS,
  type ProfileRole,
  type ProfileAvatar,
  type UserProfile,
  type OnboardingProfileSlot,
} from "@/types/profiles";
import {
  ProfileAvatarTile,
  PROFILE_ACCENT_STYLES,
  PROFILE_AVATAR_ICONS,
} from "./ProfileAvatarTile";
import type { AccentPreference } from "@/lib/theme";
import type { Currency } from "@/types/billing";
import { useData } from "@/lib/data/DataProvider";

type InternalView = "select" | "unlock" | "form" | "onboarding";
type LockInputMode = "pin" | "alphanumeric";

const ACCENT_OPTIONS: AccentPreference[] = [
  "blue",
  "purple",
  "emerald",
  "rose",
  "amber",
  "indigo",
];

const AVATAR_OPTIONS: ProfileAvatar[] = [
  "code",
  "cpu",
  "terminal",
  "compass",
  "layers",
  "briefcase",
  "globe",
  "shield",
];

const CURRENCY_OPTIONS: Currency[] = ["USD", "LKR", "EUR", "GBP", "CAD"];

function createDefaultOnboardingSlots(
  defaultCurrency: Currency = "USD",
): Array<OnboardingProfileSlot & { enabled: boolean }> {
  return PROFILE_ROLE_LIST.map((preset) => ({
    enabled:
      preset.role === "software-engineering" ||
      preset.role === "ai-development" ||
      preset.role === "consulting",
    name: preset.defaultName,
    role: preset.role,
    subtitle: preset.label,
    avatar: preset.avatar,
    accent: preset.accent,
    defaultCurrency,
    invoicePrefix: preset.invoicePrefix,
    password: "",
    passwordHint: "",
    seedRoleCatalog: true,
  }));
}

export function ProfileGateModal() {
  const {
    profiles,
    activeProfile,
    maxProfiles,
    isGateOpen,
    isLocked,
    modalMode,
    editingProfile,
    closeProfileGate,
    switchProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    completeOnboarding,
  } = useProfiles();
  const { settings } = useData();

  const [view, setView] = useState<InternalView>("select");
  const [isManageMode, setIsManageMode] = useState(false);
  const [hoveredAccent, setHoveredAccent] = useState<AccentPreference | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Unlock view state
  const [unlockTarget, setUnlockTarget] = useState<UserProfile | null>(null);
  const [unlockMode, setUnlockMode] = useState<LockInputMode>("pin");
  const [unlockPinDigits, setUnlockPinDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
  ]);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const unlockPinRefs = useRef<Array<HTMLInputElement | null>>([
    null,
    null,
    null,
    null,
  ]);
  const unlockInputRef = useRef<HTMLInputElement | null>(null);

  // Create / Edit form state
  const [formTargetId, setFormTargetId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<ProfileRole>("software-engineering");
  const [formCustomRoleText, setFormCustomRoleText] = useState("");
  const [formAvatar, setFormAvatar] = useState<ProfileAvatar>("code");
  const [formAccent, setFormAccent] = useState<AccentPreference>("blue");
  const [formCurrency, setFormCurrency] = useState<Currency>("USD");
  const [formInvoicePrefix, setFormInvoicePrefix] = useState("SE-");
  const [formSeedCatalog, setFormSeedCatalog] = useState(true);

  // Passcode Lock state (supports 4-digit PIN or alphanumeric password)
  const [formEnablePassword, setFormEnablePassword] = useState(false);
  const [formLockMode, setFormLockMode] = useState<LockInputMode>("pin");
  const [formPinDigits, setFormPinDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
  ]);
  const formPinRefs = useRef<Array<HTMLInputElement | null>>([
    null,
    null,
    null,
    null,
  ]);
  const [formCurrentPassword, setFormCurrentPassword] = useState("");
  const [formNewPassword, setFormNewPassword] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // Onboarding state
  const [studioName, setStudioName] = useState("Chethaka Lakshitha");
  const [studioCurrency, setStudioCurrency] = useState<Currency>("USD");
  const [onboardingSlots, setOnboardingSlots] = useState<
    Array<OnboardingProfileSlot & { enabled: boolean }>
  >(() => createDefaultOnboardingSlots("USD"));

  const populateFormFromProfile = (profile: UserProfile | null) => {
    setErrorMsg(null);
    setConfirmDelete(false);
    setDeletePassword("");
    setFormCurrentPassword("");
    setFormNewPassword("");
    setFormPinDigits(["", "", "", ""]);
    setShowFormPassword(false);

    if (profile) {
      setFormTargetId(profile.id);
      setFormName(profile.name);
      setFormRole(profile.role);
      setFormCustomRoleText(profile.subtitle);
      setFormAvatar(profile.avatar);
      setFormAccent(profile.accent);
      setFormCurrency(profile.defaultCurrency);
      setFormInvoicePrefix(profile.invoicePrefix);
      setFormSeedCatalog(false);
      setFormEnablePassword(profile.hasPassword);
      setFormLockMode(profile.lockType === "password" ? "alphanumeric" : "pin");
    } else {
      const usedRoles = new Set(profiles.map((p) => p.role));
      const nextPreset =
        PROFILE_ROLE_LIST.find((p) => !usedRoles.has(p.role)) ??
        PROFILE_ROLE_PRESETS["ai-development"];

      setFormTargetId(null);
      setFormName(nextPreset.defaultName);
      setFormRole(nextPreset.role);
      setFormCustomRoleText(nextPreset.label);
      setFormAvatar(nextPreset.avatar);
      setFormAccent(nextPreset.accent);
      setFormCurrency(
        (settings?.defaultCurrency as Currency) ||
          activeProfile.defaultCurrency ||
          "USD",
      );
      setFormInvoicePrefix(nextPreset.invoicePrefix);
      setFormSeedCatalog(true);
      setFormEnablePassword(false);
      setFormLockMode("pin");
    }
  };

  // Sync modalMode when modal opens or mode changes
  const syncSignature = `${isGateOpen}:${modalMode}:${editingProfile?.id ?? ""}:${isLocked}`;
  const [prevSyncSignature, setPrevSyncSignature] = useState("");
  if (syncSignature !== prevSyncSignature) {
    setPrevSyncSignature(syncSignature);
    if (isGateOpen) {
      setErrorMsg(null);
      setBusy(false);

      if (modalMode === "onboarding") {
        setStudioName(settings?.businessName?.trim() || "Chethaka Lakshitha");
        const initialCurr =
          (settings?.defaultCurrency as Currency) || "USD";
        setStudioCurrency(initialCurr);
        setOnboardingSlots(createDefaultOnboardingSlots(initialCurr));
        setView("onboarding");
      } else if (modalMode === "create") {
        populateFormFromProfile(null);
        setView("form");
      } else if (modalMode === "manage") {
        if (editingProfile) {
          populateFormFromProfile(editingProfile);
          setView("form");
        } else {
          setIsManageMode(true);
          setView("select");
        }
      } else {
        setIsManageMode(false);
        if (isLocked && activeProfile.hasPassword && profiles.length === 1) {
          setUnlockTarget(activeProfile);
          setUnlockMode(
            activeProfile.lockType === "password" ? "alphanumeric" : "pin",
          );
          setUnlockPinDigits(["", "", "", ""]);
          setUnlockPassword("");
          setView("unlock");
        } else {
          setView("select");
        }
      }
    }
  }

  useEffect(() => {
    if (view === "unlock") {
      const timer = setTimeout(() => {
        if (unlockMode === "pin") {
          unlockPinRefs.current[0]?.focus();
        } else {
          unlockInputRef.current?.focus();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [view, unlockMode]);

  useEffect(() => {
    if (!isGateOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLocked && !busy) {
        if (view === "unlock" || view === "form") {
          setView("select");
          setErrorMsg(null);
        } else {
          closeProfileGate();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGateOpen, isLocked, busy, view, closeProfileGate]);

  if (!isGateOpen) return null;

  const openUnlockForProfile = (profile: UserProfile) => {
    setUnlockTarget(profile);
    setUnlockMode(profile.lockType === "password" ? "alphanumeric" : "pin");
    setUnlockPinDigits(["", "", "", ""]);
    setUnlockPassword("");
    setShowUnlockPassword(false);
    setView("unlock");
  };

  const handleTileClick = async (profile: UserProfile) => {
    setErrorMsg(null);
    if (isManageMode) {
      populateFormFromProfile(profile);
      setView("form");
      return;
    }

    if (profile.hasPassword) {
      openUnlockForProfile(profile);
      return;
    }

    try {
      setBusy(true);
      await switchProfile(profile.id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not switch profile.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitUnlockPasscode = async (code: string) => {
    if (!unlockTarget) return;
    if (!code.trim()) {
      setErrorMsg("Enter your passcode to unlock this profile.");
      return;
    }
    try {
      setBusy(true);
      setErrorMsg(null);
      await switchProfile(unlockTarget.id, code);
      setUnlockPassword("");
      setUnlockPinDigits(["", "", "", ""]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Incorrect passcode. Try again.",
      );
      if (unlockMode === "pin") {
        setUnlockPinDigits(["", "", "", ""]);
        setTimeout(() => unlockPinRefs.current[0]?.focus(), 40);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUnlockFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code =
      unlockMode === "pin" ? unlockPinDigits.join("") : unlockPassword;
    await submitUnlockPasscode(code);
  };

  const handleUnlockPinDigitChange = (index: number, rawValue: string) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const nextDigits = [...unlockPinDigits];
    nextDigits[index] = digit;
    setUnlockPinDigits(nextDigits);
    if (errorMsg) setErrorMsg(null);

    if (digit && index < 3) {
      unlockPinRefs.current[index + 1]?.focus();
    }

    if (digit && index === 3 && nextDigits.every((d) => d.length === 1)) {
      void submitUnlockPasscode(nextDigits.join(""));
    }
  };

  const handleUnlockPinKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !unlockPinDigits[index] && index > 0) {
      unlockPinRefs.current[index - 1]?.focus();
    }
  };

  const handleFormPinDigitChange = (index: number, rawValue: string) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const nextDigits = [...formPinDigits];
    nextDigits[index] = digit;
    setFormPinDigits(nextDigits);
    if (errorMsg) setErrorMsg(null);

    if (digit && index < 3) {
      formPinRefs.current[index + 1]?.focus();
    }
  };

  const handleFormPinKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !formPinDigits[index] && index > 0) {
      formPinRefs.current[index - 1]?.focus();
    }
  };

  const handleApplyRolePreset = (role: ProfileRole) => {
    const preset = PROFILE_ROLE_PRESETS[role];
    setFormRole(role);
    setFormName(preset.defaultName);
    setFormCustomRoleText(preset.label);
    setFormAvatar(preset.avatar);
    setFormAccent(preset.accent);
    setFormInvoicePrefix(preset.invoicePrefix);
  };

  const handleSaveProfileForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setErrorMsg("Profile name is required.");
      return;
    }

    const roleSubtitle =
      formCustomRoleText.trim() || PROFILE_ROLE_PRESETS[formRole].label;
    const existingProfile = formTargetId
      ? profiles.find((p) => p.id === formTargetId)
      : null;

    const resolvedNewSecret =
      formLockMode === "pin" ? formPinDigits.join("") : formNewPassword.trim();

    try {
      setBusy(true);
      if (!formTargetId) {
        if (formEnablePassword) {
          if (formLockMode === "pin" && !/^\d{4}$/.test(resolvedNewSecret)) {
            setErrorMsg("Enter all 4 numbers for your 4-digit PIN.");
            setBusy(false);
            return;
          }
          if (
            formLockMode === "alphanumeric" &&
            resolvedNewSecret.length < 4
          ) {
            setErrorMsg(
              "Passcode must be at least 4 characters (letters or numbers).",
            );
            setBusy(false);
            return;
          }
        }

        await createProfile({
          name: trimmedName,
          role: formRole,
          subtitle: roleSubtitle,
          avatar: formAvatar,
          accent: formAccent,
          defaultCurrency: formCurrency,
          invoicePrefix: formInvoicePrefix.trim() || "INV-",
          password: formEnablePassword ? resolvedNewSecret : undefined,
          seedRoleCatalog: formSeedCatalog,
        });
      } else {
        let passwordPatch: string | null | undefined = undefined;
        if (!formEnablePassword && existingProfile?.hasPassword) {
          if (!formCurrentPassword.trim()) {
            setErrorMsg(
              "Enter the current passcode to remove the profile lock.",
            );
            setBusy(false);
            return;
          }
          passwordPatch = null;
        } else if (formEnablePassword && resolvedNewSecret.length > 0) {
          if (formLockMode === "pin" && !/^\d{4}$/.test(resolvedNewSecret)) {
            setErrorMsg("Enter all 4 numbers for your new 4-digit PIN.");
            setBusy(false);
            return;
          }
          if (
            formLockMode === "alphanumeric" &&
            resolvedNewSecret.length < 4
          ) {
            setErrorMsg("New passcode must be at least 4 characters.");
            setBusy(false);
            return;
          }
          if (existingProfile?.hasPassword && !formCurrentPassword.trim()) {
            setErrorMsg("Enter your current passcode to set a new one.");
            setBusy(false);
            return;
          }
          passwordPatch = resolvedNewSecret;
        } else if (formEnablePassword && !existingProfile?.hasPassword) {
          setErrorMsg(
            formLockMode === "pin"
              ? "Enter a 4-digit PIN or turn off profile lock."
              : "Enter a passcode (at least 4 characters) or turn off profile lock.",
          );
          setBusy(false);
          return;
        }

        await updateProfile(formTargetId, {
          name: trimmedName,
          role: formRole,
          subtitle: roleSubtitle,
          avatar: formAvatar,
          accent: formAccent,
          defaultCurrency: formCurrency,
          invoicePrefix: formInvoicePrefix.trim() || "INV-",
          ...(passwordPatch !== undefined ? { password: passwordPatch } : {}),
          ...(existingProfile?.hasPassword && formCurrentPassword.trim()
            ? { currentPassword: formCurrentPassword.trim() }
            : {}),
        });
      }

      setView("select");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not save profile.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!formTargetId) return;
    const existingProfile = profiles.find((p) => p.id === formTargetId);
    if (existingProfile?.hasPassword && !deletePassword.trim()) {
      setErrorMsg("Enter this profile's passcode to confirm deletion.");
      return;
    }
    try {
      setBusy(true);
      setErrorMsg(null);
      await deleteProfile(formTargetId, deletePassword.trim() || undefined);
      setConfirmDelete(false);
      setView("select");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not delete profile.",
      );
    } finally {
      setBusy(false);
    }
  };

  const enabledOnboardingSlots = onboardingSlots.filter((s) => s.enabled);

  const handleCompleteOnboarding = async () => {
    setErrorMsg(null);
    if (!studioName.trim()) {
      setErrorMsg("Please enter your name or studio name.");
      return;
    }
    if (enabledOnboardingSlots.length === 0) {
      setErrorMsg("Select at least one role profile to continue.");
      return;
    }
    for (const slot of enabledOnboardingSlots) {
      if (
        slot.password &&
        slot.password.trim().length > 0 &&
        slot.password.trim().length < 4
      ) {
        setErrorMsg(
          `Passcode for "${slot.name}" must be at least 4 characters or digits (or leave blank).`,
        );
        return;
      }
    }

    try {
      setBusy(true);
      await completeOnboarding({
        studioName: studioName.trim(),
        email: settings?.email?.trim() || "",
        defaultCurrency: studioCurrency,
        profiles: enabledOnboardingSlots.slice(0, MAX_PROFILES).map((s) => ({
          name: s.name.trim() || PROFILE_ROLE_PRESETS[s.role].defaultName,
          role: s.role,
          subtitle: s.subtitle.trim() || PROFILE_ROLE_PRESETS[s.role].label,
          avatar: s.avatar,
          accent: s.accent,
          defaultCurrency: studioCurrency,
          invoicePrefix:
            s.invoicePrefix.trim() ||
            PROFILE_ROLE_PRESETS[s.role].invoicePrefix,
          password: s.password?.trim() || undefined,
          seedRoleCatalog: s.seedRoleCatalog,
        })),
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to complete onboarding.",
      );
    } finally {
      setBusy(false);
    }
  };

  const ambientAccent =
    view === "form"
      ? formAccent
      : view === "unlock" && unlockTarget
        ? unlockTarget.accent
        : hoveredAccent || activeProfile.accent;
  const ambientStyle =
    PROFILE_ACCENT_STYLES[ambientAccent] ?? PROFILE_ACCENT_STYLES.blue;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BillFlow Profiles"
      className="fixed inset-0 z-[120] flex flex-col overflow-y-auto select-none text-white"
      style={{
        backgroundColor: "rgba(8, 9, 13, 0.985)",
        backdropFilter: "blur(64px) saturate(140%)",
        WebkitBackdropFilter: "blur(64px) saturate(140%)",
      }}
    >
      {/* Subtle Ambient Radial Glow that responds to active/hovered profile */}
      <div
        className="pointer-events-none fixed inset-0 transition-all duration-500"
        style={{
          background: `radial-gradient(650px circle at 50% 28%, ${ambientStyle.glow}, transparent 72%)`,
          opacity: 0.45,
        }}
      />

      {/* Minimal Top Bar */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 pt-8 pb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {view !== "select" && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setView("select");
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Profiles
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {view === "select" && (
            <button
              type="button"
              onClick={() => {
                setStudioName(
                  settings?.businessName?.trim() || "Chethaka Lakshitha",
                );
                setView("onboarding");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-300" />
              Role Setup
            </button>
          )}

          {!isLocked && (
            <button
              type="button"
              onClick={closeProfileGate}
              aria-label="Close profile screen"
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          VIEW 1: AUTHENTIC NETFLIX PROFILE SWITCHER
         ===================================================================== */}
      {view === "select" && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
          <h1 className="text-3xl sm:text-5xl font-medium tracking-tight text-white mb-3">
            {isManageMode ? "Manage Profiles:" : "Who’s working?"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mb-10 sm:mb-14">
            {isManageMode
              ? "Select a profile to customize its role, invoice prefix, or passcode lock."
              : "Select your role workspace to load its isolated clients, invoices, and ledger."}
          </p>

          {errorMsg && (
            <div className="mb-8 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Netflix Horizontal Profile Row */}
          <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-9 max-w-5xl mb-12 sm:mb-16">
            {profiles.map((profile) => {
              const isCurrent = profile.id === activeProfile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={busy}
                  onMouseEnter={() => setHoveredAccent(profile.accent)}
                  onMouseLeave={() => setHoveredAccent(null)}
                  onClick={() => void handleTileClick(profile)}
                  className="group flex flex-col items-center w-32 sm:w-36 focus:outline-none cursor-pointer"
                >
                  <div className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]">
                    <ProfileAvatarTile
                      avatar={profile.avatar}
                      accent={profile.accent}
                      size="xl"
                      hasPassword={profile.hasPassword}
                      isActive={isCurrent && !isLocked && !isManageMode}
                      isManageMode={isManageMode}
                      interactiveHover
                    />
                  </div>

                  <span className="mt-3.5 text-sm sm:text-[16px] font-normal text-zinc-400 group-hover:text-white transition-colors truncate max-w-full">
                    {profile.name}
                  </span>

                  <span className="text-[11.5px] text-zinc-500 group-hover:text-zinc-400 transition-colors truncate max-w-full mt-0.5">
                    {profile.subtitle}
                  </span>

                  {/* Netflix-style centered padlock icon below locked profiles */}
                  <div className="h-5 flex items-center justify-center mt-1.5">
                    {profile.hasPassword ? (
                      <Lock
                        className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors"
                        strokeWidth={2}
                      />
                    ) : isCurrent && !isLocked ? (
                      <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-400/90">
                        Active
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}

            {/* Netflix "Add Profile" Tile */}
            {profiles.length < maxProfiles && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  populateFormFromProfile(null);
                  setView("form");
                }}
                className="group flex flex-col items-center w-32 sm:w-36 focus:outline-none cursor-pointer"
              >
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[16px] bg-white/[0.03] group-hover:bg-white/[0.12] border border-white/10 group-hover:border-white flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]">
                  <div className="w-14 h-14 rounded-full bg-white/[0.06] group-hover:bg-white/20 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                    <Plus className="w-8 h-8" strokeWidth={1.8} />
                  </div>
                </div>
                <span className="mt-3.5 text-sm sm:text-[16px] font-normal text-zinc-400 group-hover:text-white transition-colors">
                  Add Profile
                </span>
                <span className="text-[11.5px] text-zinc-600 mt-0.5">
                  {maxProfiles - profiles.length} left
                </span>
              </button>
            )}
          </div>

          {/* Iconic Netflix Bottom Action Button */}
          <div>
            <button
              type="button"
              onClick={() => setIsManageMode((prev) => !prev)}
              className={`px-7 py-2.5 text-xs sm:text-[13px] tracking-[0.18em] uppercase transition-all cursor-pointer ${
                isManageMode
                  ? "bg-white text-zinc-950 font-bold hover:bg-zinc-200 rounded-md"
                  : "bg-transparent border border-zinc-500/80 hover:border-white text-zinc-400 hover:text-white font-medium rounded-md"
              }`}
            >
              {isManageMode ? "Done" : "Manage Profiles"}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: NETFLIX PROFILE LOCK / PASSCODE UNLOCK STAGE
         ===================================================================== */}
      {view === "unlock" && unlockTarget && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 text-center max-w-lg mx-auto w-full">
          <ProfileAvatarTile
            avatar={unlockTarget.avatar}
            accent={unlockTarget.accent}
            size="lg"
            hasPassword
          />

          <div className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
            {unlockTarget.name} · {unlockTarget.subtitle}
          </div>

          <h2 className="text-2xl sm:text-3xl font-medium text-white mt-3 mb-2">
            Profile Lock is currently on.
          </h2>
          <p className="text-sm text-zinc-400 mb-8">
            {unlockMode === "pin"
              ? "Enter your 4-digit PIN to access this workspace."
              : "Enter your passcode to access this workspace."}
          </p>

          <form onSubmit={handleUnlockFormSubmit} className="w-full space-y-6">
            {unlockMode === "pin" ? (
              <div className="flex items-center justify-center gap-3.5">
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      unlockPinRefs.current[idx] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={unlockPinDigits[idx]}
                    onChange={(e) =>
                      handleUnlockPinDigitChange(idx, e.target.value)
                    }
                    onKeyDown={(e) => handleUnlockPinKeyDown(idx, e)}
                    aria-label={`PIN digit ${idx + 1}`}
                    className="w-14 h-16 sm:w-16 sm:h-18 rounded-xl bg-white/[0.05] border-2 border-white/20 focus:border-white focus:bg-white/[0.09] text-center text-2xl font-mono text-white outline-none transition-all"
                  />
                ))}
              </div>
            ) : (
              <div className="relative max-w-xs mx-auto">
                <input
                  ref={unlockInputRef}
                  type={showUnlockPassword ? "text" : "password"}
                  value={unlockPassword}
                  onChange={(e) => {
                    setUnlockPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter letters or numbers"
                  className="w-full h-12 pl-4 pr-11 rounded-xl bg-white/[0.06] border border-white/20 focus:border-white text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  {showUnlockPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium max-w-xs mx-auto">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col items-center gap-3 pt-2">
              {unlockMode === "alphanumeric" && (
                <button
                  type="submit"
                  disabled={busy}
                  className="px-8 py-2.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs uppercase tracking-[0.14em] hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  {busy ? "Unlocking..." : "Unlock Profile"}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setUnlockMode((prev) =>
                    prev === "pin" ? "alphanumeric" : "pin",
                  );
                }}
                className="text-xs text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                {unlockMode === "pin"
                  ? "Use alphanumeric password instead"
                  : "Use 4-digit PIN pad instead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          VIEW 3: PREMIUM EDITORIAL PROFILE CREATOR / EDITOR
         ===================================================================== */}
      {view === "form" && (
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-6">
          <div className="w-full max-w-3xl">
            <div className="border-b border-white/10 pb-5 mb-7">
              <h1 className="text-2xl sm:text-4xl font-medium tracking-tight text-white">
                {formTargetId ? "Edit Profile" : "Add Profile"}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
                Each profile runs an isolated workspace with its own clients,
                invoices, catalog, and ledger.
              </p>
            </div>

            <form onSubmit={handleSaveProfileForm}>
              <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-8 items-start">
                {/* Left Column: Live Netflix Tile Preview & Style Controls */}
                <div className="flex flex-col items-center md:items-start space-y-5">
                  <div className="flex flex-col items-center">
                    <ProfileAvatarTile
                      avatar={formAvatar}
                      accent={formAccent}
                      size="xl"
                      hasPassword={formEnablePassword}
                    />
                    <span className="mt-3 text-sm font-medium text-white truncate max-w-[160px]">
                      {formName.trim() || "Profile Name"}
                    </span>
                    <span className="text-xs text-zinc-400 truncate max-w-[160px]">
                      {formCustomRoleText.trim() || "Custom Role"}
                    </span>
                  </div>

                  {/* Accent Swatches */}
                  <div className="w-full">
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
                      Profile Color
                    </label>
                    <div className="flex items-center gap-2">
                      {ACCENT_OPTIONS.map((acc) => {
                        const st = PROFILE_ACCENT_STYLES[acc];
                        const selected = formAccent === acc;
                        return (
                          <button
                            key={acc}
                            type="button"
                            onClick={() => setFormAccent(acc)}
                            title={st.label}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                              selected
                                ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#08090D]"
                                : "opacity-70 hover:opacity-100"
                            }`}
                            style={{ background: st.bg }}
                          >
                            {selected && (
                              <Check className="w-3.5 h-3.5 text-white" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Emblem Picker */}
                  <div className="w-full">
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
                      Emblem
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {AVATAR_OPTIONS.map((av) => {
                        const IconComp = PROFILE_AVATAR_ICONS[av];
                        const selected = formAvatar === av;
                        return (
                          <button
                            key={av}
                            type="button"
                            onClick={() => setFormAvatar(av)}
                            className={`h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                              selected
                                ? "bg-white text-zinc-950 border-white"
                                : "bg-white/[0.04] text-zinc-400 border-white/10 hover:bg-white/[0.1] hover:text-white"
                            }`}
                          >
                            <IconComp className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Role Templates, Custom Role Input, & Passcode Lock */}
                <div className="space-y-5">
                  {/* Optional Quick-Fill Templates */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        Quick-Fill Role Templates (Optional)
                      </label>
                      <span className="text-[11px] text-zinc-500">
                        Click a preset or type your own below
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PROFILE_ROLE_LIST.map((preset) => {
                        const active =
                          formRole === preset.role &&
                          formCustomRoleText === preset.label;
                        return (
                          <button
                            key={preset.role}
                            type="button"
                            onClick={() => handleApplyRolePreset(preset.role)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              active
                                ? "bg-white text-zinc-950 border-white"
                                : "bg-white/[0.04] border-white/10 text-zinc-300 hover:bg-white/[0.1] hover:text-white"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Profile Name & Custom Role Text Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Profile Name
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Chethaka — AI"
                        maxLength={60}
                        className="w-full h-11 px-3.5 rounded-xl bg-white/[0.05] border border-white/15 focus:border-white text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Role / Specialization (Type any role)
                      </label>
                      <input
                        type="text"
                        value={formCustomRoleText}
                        onChange={(e) => setFormCustomRoleText(e.target.value)}
                        placeholder="e.g. AI Development, Technical Consulting..."
                        maxLength={80}
                        className="w-full h-11 px-3.5 rounded-xl bg-white/[0.05] border border-white/15 focus:border-white text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Currency & Invoice Prefix */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Default Currency
                      </label>
                      <select
                        value={formCurrency}
                        onChange={(e) =>
                          setFormCurrency(e.target.value as Currency)
                        }
                        className="w-full h-11 px-3.5 rounded-xl bg-[#12141C] border border-white/15 focus:border-white text-sm text-white outline-none transition-colors"
                      >
                        {CURRENCY_OPTIONS.map((curr) => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Invoice Prefix
                      </label>
                      <input
                        type="text"
                        value={formInvoicePrefix}
                        onChange={(e) => setFormInvoicePrefix(e.target.value)}
                        placeholder="SE-"
                        maxLength={12}
                        className="w-full h-11 px-3.5 rounded-xl bg-white/[0.05] border border-white/15 focus:border-white text-sm font-mono text-white outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Passcode Lock Card (4-Digit PIN OR Alphanumeric Password) */}
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <KeyRound className="w-4 h-4 text-amber-400" />
                        <div>
                          <div className="text-xs font-semibold text-white">
                            Profile Passcode Lock
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            Lock this profile with a 4-digit PIN or a password
                            (letters & numbers).
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formEnablePassword}
                        onChange={(e) =>
                          setFormEnablePassword(e.target.checked)
                        }
                        className="w-4 h-4 accent-white rounded cursor-pointer"
                      />
                    </label>

                    {formTargetId &&
                      profiles.find((p) => p.id === formTargetId)
                        ?.hasPassword && (
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                            Current Passcode
                          </label>
                          <input
                            type={showFormPassword ? "text" : "password"}
                            value={formCurrentPassword}
                            onChange={(e) =>
                              setFormCurrentPassword(e.target.value)
                            }
                            placeholder="Enter current PIN or password"
                            className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/15 focus:border-white text-xs text-white outline-none"
                          />
                        </div>
                      )}

                    {formEnablePassword && (
                      <div className="space-y-3 pt-1">
                        {/* Mode Toggle: 4-Digit PIN vs Letters & Numbers */}
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
                          <button
                            type="button"
                            onClick={() => setFormLockMode("pin")}
                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              formLockMode === "pin"
                                ? "bg-white text-zinc-950"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            <Hash className="w-3.5 h-3.5" />
                            4-Digit PIN
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormLockMode("alphanumeric")}
                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              formLockMode === "alphanumeric"
                                ? "bg-white text-zinc-950"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            <Type className="w-3.5 h-3.5" />
                            Letters & Numbers
                          </button>
                        </div>

                        {formLockMode === "pin" ? (
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-2">
                              Enter 4 numbers
                            </label>
                            <div className="flex items-center gap-2.5">
                              {[0, 1, 2, 3].map((idx) => (
                                <input
                                  key={idx}
                                  ref={(el) => {
                                    formPinRefs.current[idx] = el;
                                  }}
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={1}
                                  value={formPinDigits[idx]}
                                  onChange={(e) =>
                                    handleFormPinDigitChange(
                                      idx,
                                      e.target.value,
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleFormPinKeyDown(idx, e)
                                  }
                                  placeholder="•"
                                  className="w-12 h-12 rounded-xl bg-black/50 border border-white/20 focus:border-white text-center text-lg font-mono text-white outline-none"
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type={showFormPassword ? "text" : "password"}
                              value={formNewPassword}
                              onChange={(e) =>
                                setFormNewPassword(e.target.value)
                              }
                              placeholder="Enter letters & numbers (min 4 chars)"
                              className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-black/50 border border-white/20 focus:border-white text-xs text-white placeholder:text-zinc-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowFormPassword((prev) => !prev)
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                            >
                              {showFormPassword ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {errorMsg && (
                    <div className="px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium">
                      {errorMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* Netflix-Style Editorial Footer Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-7 py-2.5 rounded-md bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-bold text-xs sm:text-[13px] tracking-[0.14em] uppercase transition-colors cursor-pointer"
                  >
                    {busy ? "Saving..." : "Save Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setView("select");
                    }}
                    className="px-6 py-2.5 rounded-md border border-zinc-500 hover:border-white text-zinc-400 hover:text-white font-medium text-xs sm:text-[13px] tracking-[0.14em] uppercase transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {formTargetId && formTargetId !== "default" && (
                  <div>
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-zinc-700 hover:border-rose-500 text-zinc-400 hover:text-rose-400 text-xs font-medium tracking-[0.12em] uppercase transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Profile
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {profiles.find((p) => p.id === formTargetId)
                          ?.hasPassword && (
                          <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder="Passcode"
                            className="h-9 px-3 rounded-md bg-black/50 border border-rose-500/50 text-xs text-white w-28 outline-none"
                          />
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDeleteProfile()}
                          className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 4: FULL-SCREEN ROLE ONBOARDING SETUP
         ===================================================================== */}
      {view === "onboarding" && (
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-6">
          <div className="w-full max-w-2xl">
            <div className="border-b border-white/10 pb-5 mb-6">
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
                Set Up Your Role Workspaces
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Customize your roles, profile names, and optional 4-digit PINs
                or passcodes (up to 5 profiles).
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Your Name or Studio Name
                  </label>
                  <input
                    type="text"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    placeholder="Chethaka Lakshitha"
                    className="w-full h-11 px-3.5 rounded-xl bg-white/[0.05] border border-white/15 focus:border-white text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Default Currency
                  </label>
                  <select
                    value={studioCurrency}
                    onChange={(e) => {
                      const curr = e.target.value as Currency;
                      setStudioCurrency(curr);
                      setOnboardingSlots((prev) =>
                        prev.map((s) => ({ ...s, defaultCurrency: curr })),
                      );
                    }}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#12141C] border border-white/15 focus:border-white text-sm text-white outline-none"
                  >
                    {CURRENCY_OPTIONS.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {onboardingSlots.map((slot, idx) => (
                  <div
                    key={slot.role}
                    className={`p-3.5 rounded-2xl border transition-colors ${
                      slot.enabled
                        ? "bg-white/[0.05] border-white/20"
                        : "bg-white/[0.015] border-white/5 opacity-55"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setOnboardingSlots((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, enabled: checked }
                                  : item,
                              ),
                            );
                          }}
                          className="w-4 h-4 accent-white rounded cursor-pointer"
                        />
                        <ProfileAvatarTile
                          avatar={slot.avatar}
                          accent={slot.accent}
                          size="sm"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                          <input
                            type="text"
                            value={slot.name}
                            disabled={!slot.enabled}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOnboardingSlots((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, name: val } : item,
                                ),
                              );
                            }}
                            placeholder="Profile Name"
                            className="h-9 px-2.5 rounded-lg bg-black/40 border border-white/10 focus:border-white text-xs font-medium text-white outline-none"
                          />
                          <input
                            type="text"
                            value={slot.subtitle}
                            disabled={!slot.enabled}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOnboardingSlots((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, subtitle: val }
                                    : item,
                                ),
                              );
                            }}
                            placeholder="Custom Role Title"
                            className="h-9 px-2.5 rounded-lg bg-black/40 border border-white/10 focus:border-white text-xs text-zinc-300 outline-none"
                          />
                        </div>
                      </div>

                      {slot.enabled && (
                        <input
                          type="password"
                          value={slot.password || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardingSlots((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, password: val } : item,
                              ),
                            );
                          }}
                          placeholder="4-digit PIN or password"
                          className="h-9 px-3 rounded-lg bg-black/40 border border-white/15 focus:border-white text-xs text-white placeholder:text-zinc-500 sm:w-44 outline-none"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setView("select")}
                  className="px-6 py-2.5 rounded-md border border-zinc-500 hover:border-white text-zinc-400 hover:text-white text-xs font-medium tracking-[0.14em] uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCompleteOnboarding()}
                  className="px-7 py-2.5 rounded-md bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-bold text-xs tracking-[0.14em] uppercase transition-colors cursor-pointer"
                >
                  {busy
                    ? "Creating..."
                    : `Create ${enabledOnboardingSlots.length} Profile${
                        enabledOnboardingSlots.length === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
