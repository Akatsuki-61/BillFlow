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
  Pencil,
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
} from "./ProfileAvatarTile";
import type { AccentPreference } from "@/lib/theme";
import type { Currency } from "@/types/billing";
import { useData } from "@/lib/data/DataProvider";

type InternalView = "select" | "unlock" | "form" | "onboarding";

const ACCENT_OPTIONS: AccentPreference[] = [
  "blue",
  "purple",
  "emerald",
  "rose",
  "amber",
  "indigo",
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
    subtitle: preset.subtitle,
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
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Unlock view state
  const [unlockTarget, setUnlockTarget] = useState<UserProfile | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const unlockInputRef = useRef<HTMLInputElement | null>(null);

  // Create / Edit form state
  const [formTargetId, setFormTargetId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<ProfileRole>("software-engineering");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formAvatar, setFormAvatar] = useState<ProfileAvatar>("code");
  const [formAccent, setFormAccent] = useState<AccentPreference>("blue");
  const [formCurrency, setFormCurrency] = useState<Currency>("USD");
  const [formInvoicePrefix, setFormInvoicePrefix] = useState("SE-");
  const [formSeedCatalog, setFormSeedCatalog] = useState(true);
  const [formEnablePassword, setFormEnablePassword] = useState(false);
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
    setShowFormPassword(false);

    if (profile) {
      setFormTargetId(profile.id);
      setFormName(profile.name);
      setFormRole(profile.role);
      setFormSubtitle(profile.subtitle);
      setFormAvatar(profile.avatar);
      setFormAccent(profile.accent);
      setFormCurrency(profile.defaultCurrency);
      setFormInvoicePrefix(profile.invoicePrefix);
      setFormSeedCatalog(false);
      setFormEnablePassword(profile.hasPassword);
    } else {
      const usedRoles = new Set(profiles.map((p) => p.role));
      const nextPreset =
        PROFILE_ROLE_LIST.find((p) => !usedRoles.has(p.role)) ??
        PROFILE_ROLE_PRESETS["ai-development"];

      setFormTargetId(null);
      setFormName(nextPreset.defaultName);
      setFormRole(nextPreset.role);
      setFormSubtitle(nextPreset.subtitle);
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
      const timer = setTimeout(() => unlockInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [view]);

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

  const handleTileClick = async (profile: UserProfile) => {
    setErrorMsg(null);
    if (isManageMode) {
      populateFormFromProfile(profile);
      setView("form");
      return;
    }

    if (profile.hasPassword) {
      setUnlockTarget(profile);
      setUnlockPassword("");
      setShowUnlockPassword(false);
      setView("unlock");
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

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockTarget) return;
    if (!unlockPassword.trim()) {
      setErrorMsg("Enter the password for this profile.");
      return;
    }
    try {
      setBusy(true);
      setErrorMsg(null);
      await switchProfile(unlockTarget.id, unlockPassword);
      setUnlockPassword("");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Incorrect password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleApplyRolePreset = (role: ProfileRole) => {
    const preset = PROFILE_ROLE_PRESETS[role];
    setFormRole(role);
    if (!formTargetId) {
      setFormName(preset.defaultName);
    }
    setFormSubtitle(preset.subtitle);
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

    const existingProfile = formTargetId
      ? profiles.find((p) => p.id === formTargetId)
      : null;

    try {
      setBusy(true);
      if (!formTargetId) {
        if (formEnablePassword && formNewPassword.trim().length < 4) {
          setErrorMsg("Password must be at least 4 characters.");
          setBusy(false);
          return;
        }
        await createProfile({
          name: trimmedName,
          role: formRole,
          subtitle:
            formSubtitle.trim() || PROFILE_ROLE_PRESETS[formRole].subtitle,
          avatar: formAvatar,
          accent: formAccent,
          defaultCurrency: formCurrency,
          invoicePrefix: formInvoicePrefix.trim() || "INV-",
          password: formEnablePassword ? formNewPassword.trim() : undefined,
          seedRoleCatalog: formSeedCatalog,
        });
      } else {
        let passwordPatch: string | null | undefined = undefined;
        if (!formEnablePassword && existingProfile?.hasPassword) {
          if (!formCurrentPassword.trim()) {
            setErrorMsg(
              "Enter the current password to remove the password lock.",
            );
            setBusy(false);
            return;
          }
          passwordPatch = null;
        } else if (formEnablePassword && formNewPassword.trim().length > 0) {
          if (formNewPassword.trim().length < 4) {
            setErrorMsg("New password must be at least 4 characters.");
            setBusy(false);
            return;
          }
          if (existingProfile?.hasPassword && !formCurrentPassword.trim()) {
            setErrorMsg("Enter the current password to set a new password.");
            setBusy(false);
            return;
          }
          passwordPatch = formNewPassword.trim();
        } else if (formEnablePassword && !existingProfile?.hasPassword) {
          setErrorMsg(
            "Enter a password (at least 4 characters) or turn off password lock.",
          );
          setBusy(false);
          return;
        }

        await updateProfile(formTargetId, {
          name: trimmedName,
          role: formRole,
          subtitle:
            formSubtitle.trim() || PROFILE_ROLE_PRESETS[formRole].subtitle,
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
      setErrorMsg("Enter this profile's password to confirm deletion.");
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
          `Password for "${slot.name}" must be at least 4 characters (or leave blank).`,
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
          subtitle: s.subtitle.trim() || PROFILE_ROLE_PRESETS[s.role].subtitle,
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Profiles"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLocked && !busy) {
          closeProfileGate();
        }
      }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-xs"
    >
      {/* VIEW 1: SIMPLE PROFILE SWITCHER */}
      {view === "select" && (
        <div className="w-full max-w-[680px] rounded-[24px] bg-surface border border-line-neutral-200 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.22)] p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-line-neutral-100">
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight text-content-neutral-950">
                {isManageMode ? "Manage Profiles" : "Switch Profile"}
              </h2>
              <p className="text-[13px] text-content-neutral-500 mt-0.5">
                {isManageMode
                  ? "Select a profile to edit its role, prefix, or password lock."
                  : `Choose a workspace profile (${profiles.length} of ${maxProfiles}).`}
              </p>
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={closeProfileGate}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-content-neutral-500 hover:text-content-neutral-900 hover:bg-surface-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Clean Profile Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6">
            {profiles.map((profile) => {
              const isCurrent = profile.id === activeProfile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleTileClick(profile)}
                  className={`group relative flex flex-col items-center text-center p-4 rounded-[18px] border transition-all cursor-pointer ${
                    isCurrent && !isManageMode
                      ? "bg-surface-neutral-100/90 border-content-neutral-900/35"
                      : "bg-surface-neutral-50/60 hover:bg-surface-neutral-100 border-line-neutral-200"
                  }`}
                >
                  <ProfileAvatarTile
                    avatar={profile.avatar}
                    accent={profile.accent}
                    size="md"
                    hasPassword={profile.hasPassword}
                    isActive={isCurrent && !isLocked}
                    isManageMode={isManageMode}
                  />

                  <span className="mt-3 text-[13.5px] font-semibold text-content-neutral-950 truncate max-w-full">
                    {profile.name}
                  </span>
                  <span className="text-[11.5px] text-content-neutral-500 truncate max-w-full mt-0.5">
                    {profile.subtitle}
                  </span>

                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10.5px] font-mono text-content-neutral-500 bg-surface px-2 py-0.5 rounded-md border border-line-neutral-200">
                      {profile.invoicePrefix} · {profile.defaultCurrency}
                    </span>
                  </div>

                  {isCurrent && !isManageMode && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}

            {profiles.length < maxProfiles && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  populateFormFromProfile(null);
                  setView("form");
                }}
                className="flex flex-col items-center justify-center text-center p-4 rounded-[18px] border border-dashed border-line-neutral-300 hover:border-content-neutral-500 hover:bg-surface-neutral-50 transition-colors cursor-pointer min-h-[148px]"
              >
                <div className="w-11 h-11 rounded-2xl bg-surface-neutral-100 flex items-center justify-center text-content-neutral-600">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="mt-3 text-[13px] font-semibold text-content-neutral-900">
                  Add Profile
                </span>
                <span className="text-[11px] text-content-neutral-500 mt-0.5">
                  {maxProfiles - profiles.length} left
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-line-neutral-100">
            <button
              type="button"
              onClick={() => {
                setStudioName(
                  settings?.businessName?.trim() || "Chethaka Lakshitha",
                );
                setView("onboarding");
              }}
              className="text-[12.5px] font-medium text-content-neutral-500 hover:text-content-neutral-900 cursor-pointer"
            >
              Role Setup Wizard
            </button>

            <button
              type="button"
              onClick={() => setIsManageMode((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] text-[12.5px] font-medium border border-line-neutral-200 bg-surface-neutral-50 hover:bg-surface-neutral-100 text-content-neutral-900 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              {isManageMode ? "Done" : "Edit Profiles"}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: PASSWORD UNLOCK */}
      {view === "unlock" && unlockTarget && (
        <div className="w-full max-w-[380px] rounded-[24px] bg-surface border border-line-neutral-200 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.22)] p-6 text-center">
          <div className="flex justify-start mb-2">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setView("select");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-content-neutral-500 hover:text-content-neutral-900 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          </div>

          <div className="flex flex-col items-center mb-5">
            <ProfileAvatarTile
              avatar={unlockTarget.avatar}
              accent={unlockTarget.accent}
              size="lg"
              hasPassword
            />
            <h2 className="text-[17px] font-semibold text-content-neutral-950 mt-3">
              {unlockTarget.name}
            </h2>
            <p className="text-xs text-content-neutral-500 mt-0.5">
              Enter password to unlock this profile
            </p>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-3.5 text-left">
            <div className="relative">
              <input
                ref={unlockInputRef}
                type={showUnlockPassword ? "text" : "password"}
                value={unlockPassword}
                onChange={(e) => {
                  setUnlockPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Password"
                className="ui-field w-full pr-9"
              />
              <button
                type="button"
                onClick={() => setShowUnlockPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-neutral-400 hover:text-content-neutral-800 cursor-pointer"
                aria-label={
                  showUnlockPassword ? "Hide password" : "Show password"
                }
              >
                {showUnlockPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="ui-button ui-button--primary ui-button--default w-full justify-center"
            >
              {busy ? "Unlocking..." : "Unlock Profile"}
            </button>
          </form>
        </div>
      )}

      {/* VIEW 3: CLEAN ADD / EDIT PROFILE FORM */}
      {view === "form" && (
        <div className="w-full max-w-[520px] rounded-[24px] bg-surface border border-line-neutral-200 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.22)] p-6">
          <div className="flex items-center justify-between pb-4 border-b border-line-neutral-100 mb-5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setView("select");
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-content-neutral-500 hover:text-content-neutral-900 hover:bg-surface-neutral-100 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-[17px] font-semibold text-content-neutral-950">
                {formTargetId ? "Edit Profile" : "New Profile"}
              </h2>
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={closeProfileGate}
                className="w-8 h-8 rounded-full flex items-center justify-center text-content-neutral-500 hover:text-content-neutral-900 hover:bg-surface-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSaveProfileForm} className="space-y-4">
            {/* Role Selector */}
            <div>
              <label className="block text-xs font-medium text-content-neutral-600 mb-1.5">
                Role Template
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROFILE_ROLE_LIST.map((preset) => {
                  const active = formRole === preset.role;
                  return (
                    <button
                      key={preset.role}
                      type="button"
                      onClick={() => handleApplyRolePreset(preset.role)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? "bg-surface-neutral-100 border-content-neutral-900 text-content-neutral-950"
                          : "bg-surface border-line-neutral-200 text-content-neutral-600 hover:bg-surface-neutral-50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-content-neutral-600 mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Software Engineering"
                  maxLength={60}
                  className="ui-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-neutral-600 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Full-Stack & Systems"
                  maxLength={80}
                  className="ui-field w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-content-neutral-600 mb-1">
                  Default Currency
                </label>
                <select
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value as Currency)}
                  className="ui-field w-full"
                >
                  {CURRENCY_OPTIONS.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-neutral-600 mb-1">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={formInvoicePrefix}
                  onChange={(e) => setFormInvoicePrefix(e.target.value)}
                  placeholder="SE-"
                  maxLength={12}
                  className="ui-field w-full font-mono"
                />
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <label className="block text-xs font-medium text-content-neutral-600 mb-1.5">
                Accent Color
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
                        selected ? "scale-110 ring-2 ring-content-neutral-900 ring-offset-2 ring-offset-surface" : "opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: st.swatch }}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Password Lock */}
            <div className="p-3.5 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2 text-xs font-medium text-content-neutral-900">
                  <Lock className="w-3.5 h-3.5 text-content-neutral-500" />
                  Password lock this profile
                </span>
                <input
                  type="checkbox"
                  checked={formEnablePassword}
                  onChange={(e) => setFormEnablePassword(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </label>

              {formTargetId &&
                profiles.find((p) => p.id === formTargetId)?.hasPassword && (
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={formCurrentPassword}
                    onChange={(e) => setFormCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="ui-field w-full text-xs"
                  />
                )}

              {formEnablePassword && (
                <div className="relative">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={formNewPassword}
                    onChange={(e) => setFormNewPassword(e.target.value)}
                    placeholder={
                      formTargetId &&
                      profiles.find((p) => p.id === formTargetId)?.hasPassword
                        ? "New password (leave blank to keep current)"
                        : "Password (at least 4 characters)"
                    }
                    className="ui-field w-full pr-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-neutral-400 hover:text-content-neutral-800 cursor-pointer"
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

            {errorMsg && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-line-neutral-100">
              {formTargetId && formTargetId !== "default" ? (
                !confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {profiles.find((p) => p.id === formTargetId)
                      ?.hasPassword && (
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Password"
                        className="ui-field !h-8 w-28 text-xs"
                      />
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeleteProfile()}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-medium cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                )
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setView("select")}
                  className="ui-button ui-button--secondary ui-button--small"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="ui-button ui-button--primary ui-button--small"
                >
                  {busy ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 4: SIMPLE SINGLE-CARD ROLE ONBOARDING */}
      {view === "onboarding" && (
        <div className="w-full max-w-[580px] rounded-[24px] bg-surface border border-line-neutral-200 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.22)] p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-line-neutral-100 mb-5">
            <div>
              <h2 className="text-[19px] font-semibold text-content-neutral-950">
                Set Up Role Profiles
              </h2>
              <p className="text-[13px] text-content-neutral-500 mt-0.5">
                Select the roles you want to keep in separate workspaces (up to 5).
              </p>
            </div>
            {!isLocked && (
              <button
                type="button"
                onClick={() => setView("select")}
                className="w-8 h-8 rounded-full flex items-center justify-center text-content-neutral-500 hover:text-content-neutral-900 hover:bg-surface-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-content-neutral-600 mb-1">
                  Your Name or Studio
                </label>
                <input
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder="Chethaka Lakshitha"
                  className="ui-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-neutral-600 mb-1">
                  Currency
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
                  className="ui-field w-full"
                >
                  {CURRENCY_OPTIONS.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
              {onboardingSlots.map((slot, idx) => (
                <div
                  key={slot.role}
                  className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                    slot.enabled
                      ? "bg-surface-neutral-50 border-line-neutral-200"
                      : "bg-surface border-line-neutral-100 opacity-60"
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOnboardingSlots((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, enabled: checked } : item,
                          ),
                        );
                      }}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <ProfileAvatarTile
                      avatar={slot.avatar}
                      accent={slot.accent}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-content-neutral-950 truncate">
                        {slot.name}
                      </div>
                      <div className="text-[11px] text-content-neutral-500 truncate">
                        {slot.subtitle} · {slot.invoicePrefix}
                      </div>
                    </div>
                  </label>

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
                      placeholder="Optional password"
                      className="ui-field !h-8 sm:w-44 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line-neutral-100">
              <button
                type="button"
                onClick={() => setView("select")}
                className="ui-button ui-button--secondary ui-button--small"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCompleteOnboarding()}
                className="ui-button ui-button--primary ui-button--small"
              >
                {busy
                  ? "Saving..."
                  : `Create ${enabledOnboardingSlots.length} Profile${
                      enabledOnboardingSlots.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
