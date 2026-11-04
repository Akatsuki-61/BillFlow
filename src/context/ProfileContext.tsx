"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  MAX_PROFILES,
  PROFILE_ROLE_PRESETS,
  type UserProfile,
  type CreateProfileInput,
  type UpdateProfileInput,
  type CompleteOnboardingInput,
  type ProfileListResponse,
} from "@/types/profiles";
import { useTheme } from "@/context/ThemeContext";
import { useData } from "@/lib/data/DataProvider";

export type ProfileModalMode = "select" | "manage" | "create" | "onboarding";

interface ProfileContextValue {
  profiles: UserProfile[];
  activeProfile: UserProfile;
  maxProfiles: number;
  needsOnboarding: boolean;
  isLoading: boolean;
  isGateOpen: boolean;
  isLocked: boolean;
  modalMode: ProfileModalMode;
  editingProfile: UserProfile | null;
  openProfileGate: (
    mode?: ProfileModalMode,
    profileToEdit?: UserProfile | null,
  ) => void;
  closeProfileGate: () => void;
  lockCurrentProfile: () => void;
  switchProfile: (id: string, password?: string) => Promise<void>;
  createProfile: (input: CreateProfileInput) => Promise<void>;
  updateProfile: (id: string, patch: UpdateProfileInput) => Promise<void>;
  deleteProfile: (id: string, password?: string) => Promise<void>;
  verifyPassword: (id: string, password: string) => Promise<boolean>;
  completeOnboarding: (input: CompleteOnboardingInput) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

const FALLBACK_DEFAULT_PROFILE: UserProfile = {
  id: "default",
  name: "Software Engineering",
  role: "software-engineering",
  subtitle: "Full-Stack & Systems",
  avatar: "code",
  accent: "blue",
  themePreference: "system",
  defaultCurrency: "USD",
  invoicePrefix: "SE-",
  hasPassword: false,
  passwordHint: null,
  isActive: true,
  isOnboarded: true,
  position: 0,
  lastActiveAt: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const BROWSER_PROFILES_KEY = "billflow_browser_profiles_v1";
const BROWSER_PASSWORDS_KEY = "billflow_browser_profile_passwords_v1";
const SESSION_UNLOCKED_KEY = "billflow_unlocked_profile_id";

function loadBrowserFallbackState(): ProfileListResponse {
  if (typeof window === "undefined") {
    return {
      profiles: [FALLBACK_DEFAULT_PROFILE],
      activeProfileId: "default",
      maxProfiles: MAX_PROFILES,
      needsOnboarding: false,
    };
  }
  try {
    const raw = localStorage.getItem(BROWSER_PROFILES_KEY);
    if (!raw) {
      const initial: UserProfile = {
        ...FALLBACK_DEFAULT_PROFILE,
        isOnboarded: false,
      };
      return {
        profiles: [initial],
        activeProfileId: "default",
        maxProfiles: MAX_PROFILES,
        needsOnboarding: true,
      };
    }
    const parsed = JSON.parse(raw) as ProfileListResponse;
    if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
      return parsed;
    }
  } catch {
    // Ignore storage read error
  }
  return {
    profiles: [FALLBACK_DEFAULT_PROFILE],
    activeProfileId: "default",
    maxProfiles: MAX_PROFILES,
    needsOnboarding: false,
  };
}

function saveBrowserFallbackState(state: ProfileListResponse) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BROWSER_PROFILES_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write error
  }
}

function getBrowserPasswords(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BROWSER_PASSWORDS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function setBrowserPasswords(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BROWSER_PASSWORDS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage write error
  }
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { setAccent, setPreference } = useTheme();
  const { refresh: refreshData } = useData();

  const [profiles, setProfiles] = useState<UserProfile[]>([
    FALLBACK_DEFAULT_PROFILE,
  ]);
  const [activeProfileId, setActiveProfileId] = useState<string>("default");
  const [maxProfiles, setMaxProfiles] = useState<number>(MAX_PROFILES);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGateOpen, setIsGateOpen] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ProfileModalMode>("select");
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);

  const initialBootHandledRef = useRef(false);

  const applyProfileVisuals = useCallback(
    (profile: UserProfile) => {
      setAccent(profile.accent);
      if (profile.themePreference) {
        setPreference(profile.themePreference);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("billflow:profile-switched", {
            detail: { profileId: profile.id },
          }),
        );
      }
    },
    [setAccent, setPreference],
  );

  const applyResponse = useCallback(
    (res: ProfileListResponse, isInitialBoot = false) => {
      setProfiles(res.profiles);
      setActiveProfileId(res.activeProfileId);
      setMaxProfiles(res.maxProfiles || MAX_PROFILES);
      setNeedsOnboarding(res.needsOnboarding);

      const active =
        res.profiles.find((p) => p.id === res.activeProfileId) ??
        res.profiles[0] ??
        FALLBACK_DEFAULT_PROFILE;

      applyProfileVisuals(active);

      if (isInitialBoot && !initialBootHandledRef.current) {
        initialBootHandledRef.current = true;
        if (res.needsOnboarding) {
          setModalMode("onboarding");
          setIsGateOpen(true);
          setIsLocked(false);
          return;
        }
        const unlockedId =
          typeof window !== "undefined"
            ? sessionStorage.getItem(SESSION_UNLOCKED_KEY)
            : null;
        if (active.hasPassword && unlockedId !== active.id) {
          setIsLocked(true);
          setModalMode("select");
          setIsGateOpen(true);
        }
      }
    },
    [applyProfileVisuals],
  );

  const refreshProfiles = useCallback(async () => {
    try {
      const api = typeof window !== "undefined" ? window.billflow : undefined;
      if (api?.profiles) {
        const res = await api.profiles.list();
        applyResponse(res, !initialBootHandledRef.current);
      } else {
        const res = loadBrowserFallbackState();
        applyResponse(res, !initialBootHandledRef.current);
      }
    } catch (error) {
      console.error("[ProfileContext] Failed to load profiles:", error);
    } finally {
      setIsLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const openProfileGate = useCallback(
    (
      mode: ProfileModalMode = "select",
      profileToEdit: UserProfile | null = null,
    ) => {
      setModalMode(mode);
      setEditingProfile(profileToEdit);
      setIsGateOpen(true);
    },
    [],
  );

  const closeProfileGate = useCallback(() => {
    if (isLocked) return;
    setIsGateOpen(false);
    setEditingProfile(null);
  }, [isLocked]);

  const lockCurrentProfile = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
    }
    setIsLocked(true);
    setModalMode("select");
    setEditingProfile(null);
    setIsGateOpen(true);
  }, []);

  const verifyPassword = useCallback(
    async (id: string, password: string): Promise<boolean> => {
      const api = typeof window !== "undefined" ? window.billflow : undefined;
      if (api?.profiles) {
        const result = await api.profiles.verifyPassword(id, password);
        return result.valid;
      }
      const map = getBrowserPasswords();
      return !map[id] || map[id] === password;
    },
    [],
  );

  const switchProfile = useCallback(
    async (id: string, password?: string) => {
      const api = typeof window !== "undefined" ? window.billflow : undefined;
      if (api?.profiles) {
        const res = await api.profiles.switch(id, password);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SESSION_UNLOCKED_KEY, id);
        }
        setIsLocked(false);
        setIsGateOpen(false);
        setEditingProfile(null);
        applyResponse(res, false);
        await refreshData();
        return;
      }

      // Browser preview fallback
      const current = loadBrowserFallbackState();
      const target = current.profiles.find((p) => p.id === id);
      if (!target) throw new Error("Profile not found.");
      const passwords = getBrowserPasswords();
      if (target.hasPassword && passwords[id] && passwords[id] !== password) {
        throw new Error("Incorrect password for this profile.");
      }
      const now = new Date().toISOString();
      const updatedProfiles = current.profiles.map((p) => ({
        ...p,
        isActive: p.id === id,
        lastActiveAt: p.id === id ? now : p.lastActiveAt,
      }));
      const nextState: ProfileListResponse = {
        ...current,
        profiles: updatedProfiles,
        activeProfileId: id,
      };
      saveBrowserFallbackState(nextState);
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, id);
      setIsLocked(false);
      setIsGateOpen(false);
      setEditingProfile(null);
      applyResponse(nextState, false);
    },
    [applyResponse, refreshData],
  );

  const createProfile = useCallback(
    async (input: CreateProfileInput) => {
      const api = typeof window !== "undefined" ? window.billflow : undefined;
      if (api?.profiles) {
        const res = await api.profiles.create(input);
        applyResponse(res, false);
        await refreshData();
        return;
      }

      const current = loadBrowserFallbackState();
      if (current.profiles.length >= MAX_PROFILES) {
        throw new Error(`BillFlow supports up to ${MAX_PROFILES} profiles.`);
      }
      const preset =
        PROFILE_ROLE_PRESETS[input.role] ?? PROFILE_ROLE_PRESETS["general"];
      const now = new Date().toISOString();
      const newId = `prof-${Math.random().toString(36).slice(2, 10)}`;
      const rawPassword = input.password?.trim() || "";
      if (rawPassword) {
        const passwords = getBrowserPasswords();
        passwords[newId] = rawPassword;
        setBrowserPasswords(passwords);
      }
      const created: UserProfile = {
        id: newId,
        name: input.name.trim(),
        role: input.role,
        subtitle: input.subtitle?.trim() || preset.subtitle,
        avatar: input.avatar || preset.avatar,
        accent: input.accent || preset.accent,
        themePreference: input.themePreference || "system",
        defaultCurrency: input.defaultCurrency || "USD",
        invoicePrefix: input.invoicePrefix?.trim() || preset.invoicePrefix,
        hasPassword: Boolean(rawPassword),
        passwordHint: rawPassword ? input.passwordHint?.trim() || null : null,
        isActive: false,
        isOnboarded: true,
        position: current.profiles.length,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const nextState: ProfileListResponse = {
        profiles: [
          ...current.profiles.map((p) => ({ ...p, isOnboarded: true })),
          created,
        ],
        activeProfileId: current.activeProfileId,
        maxProfiles: MAX_PROFILES,
        needsOnboarding: false,
      };
      saveBrowserFallbackState(nextState);
      applyResponse(nextState, false);
    },
    [applyResponse, refreshData],
  );

  const updateProfile = useCallback(
    async (id: string, patch: UpdateProfileInput) => {
      const api = typeof window !== "undefined" ? window.billflow : undefined;
      if (api?.profiles) {
        const res = await api.profiles.update(id, patch);
        applyResponse(res, false);
        await refreshData();
        return;
      }

      const current = loadBrowserFallbackState();
      const passwords = getBrowserPasswords();
      if (patch.password !== undefined) {
        if (passwords[id] && patch.currentPassword !== undefined) {
          if (passwords[id] !== patch.currentPassword) {
            throw new Error("Current password is incorrect.");
          }
        }
        if (patch.password === null || patch.password === "") {
          delete passwords[id];
        } else {
          passwords[id] = patch.password;
        }
        setBrowserPasswords(passwords);
      }

      const now = new Date().toISOString();
      const updated = current.profiles.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          name: patch.name ?? p.name,
          role: patch.role ?? p.role,
          subtitle: patch.subtitle ?? p.subtitle,
          avatar: patch.avatar ?? p.avatar,
          accent: patch.accent ?? p.accent,
          themePreference: patch.themePreference ?? p.themePreference,
          defaultCurrency: patch.defaultCurrency ?? p.defaultCurrency,
          invoicePrefix: patch.invoicePrefix ?? p.invoicePrefix,
          hasPassword: Boolean(passwords[id]),
          passwordHint:
            patch.password === null || patch.password === ""
              ? null
              : patch.passwordHint !== undefined
                ? patch.passwordHint
                : p.passwordHint,
          isOnboarded: patch.isOnboarded ?? p.isOnboarded,
          updatedAt: now,
        };
      });
      const nextState: ProfileListResponse = {
        ...current,
        profiles: updated,
      };
      saveBrowserFallbackState(nextState);
      applyResponse(nextState, false);
    },
    [applyResponse, refreshData],
  );

  const deleteProfile = useCallback(
    async (id: string, password?: string) => {
      const api = typeof window !== "undefined" ? window.billflow : undefined;
      if (api?.profiles) {
        const res = await api.profiles.remove(id, password);
        applyResponse(res, false);
        await refreshData();
        return;
      }

      const current = loadBrowserFallbackState();
      if (current.profiles.length <= 1) {
        throw new Error("At least one profile must remain in BillFlow.");
      }
      if (id === "default") {
        throw new Error("The primary studio profile cannot be deleted.");
      }
      const passwords = getBrowserPasswords();
      if (passwords[id] && passwords[id] !== password) {
        throw new Error("Incorrect password.");
      }
      delete passwords[id];
      setBrowserPasswords(passwords);
      const remaining = current.profiles.filter((p) => p.id !== id);
      const nextActiveId =
        current.activeProfileId === id ? "default" : current.activeProfileId;
      const nextState: ProfileListResponse = {
        profiles: remaining.map((p) => ({
          ...p,
          isActive: p.id === nextActiveId,
        })),
        activeProfileId: nextActiveId,
        maxProfiles: MAX_PROFILES,
        needsOnboarding: false,
      };
      saveBrowserFallbackState(nextState);
      applyResponse(nextState, false);
    },
    [applyResponse, refreshData],
  );

  const completeOnboarding = useCallback(
    async (input: CompleteOnboardingInput) => {
      const api = typeof window !== "undefined" ? window.billflow : undefined;
      if (api?.profiles) {
        const res = await api.profiles.completeOnboarding(input);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SESSION_UNLOCKED_KEY, res.activeProfileId);
        }
        setIsLocked(false);
        setIsGateOpen(false);
        setEditingProfile(null);
        applyResponse(res, false);
        await refreshData();
        return;
      }

      const now = new Date().toISOString();
      const passwords = getBrowserPasswords();
      const createdProfiles: UserProfile[] = input.profiles
        .slice(0, MAX_PROFILES)
        .map((slot, index) => {
          const id =
            index === 0
              ? "default"
              : `prof-${Math.random().toString(36).slice(2, 10)}`;
          const rawPass = slot.password?.trim() || "";
          if (rawPass) {
            passwords[id] = rawPass;
          }
          return {
            id,
            name: slot.name,
            role: slot.role,
            subtitle: slot.subtitle,
            avatar: slot.avatar,
            accent: slot.accent,
            themePreference: "system",
            defaultCurrency: slot.defaultCurrency || input.defaultCurrency,
            invoicePrefix: slot.invoicePrefix,
            hasPassword: Boolean(rawPass),
            passwordHint: rawPass ? slot.passwordHint?.trim() || null : null,
            isActive: index === 0,
            isOnboarded: true,
            position: index,
            lastActiveAt: now,
            createdAt: now,
            updatedAt: now,
          };
        });
      setBrowserPasswords(passwords);
      const nextState: ProfileListResponse = {
        profiles: createdProfiles,
        activeProfileId: "default",
        maxProfiles: MAX_PROFILES,
        needsOnboarding: false,
      };
      saveBrowserFallbackState(nextState);
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, "default");
      setIsLocked(false);
      setIsGateOpen(false);
      setEditingProfile(null);
      applyResponse(nextState, false);
    },
    [applyResponse, refreshData],
  );

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ??
    profiles[0] ??
    FALLBACK_DEFAULT_PROFILE;

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        maxProfiles,
        needsOnboarding,
        isLoading,
        isGateOpen,
        isLocked,
        modalMode,
        editingProfile,
        openProfileGate,
        closeProfileGate,
        lockCurrentProfile,
        switchProfile,
        createProfile,
        updateProfile,
        deleteProfile,
        verifyPassword,
        completeOnboarding,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfiles must be used within a ProfileProvider");
  }
  return ctx;
}
