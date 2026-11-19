"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  MAX_PROFILES,
  type UserProfile,
  type CreateProfileInput,
  type UpdateProfileInput,
  type CompleteOnboardingInput,
  type ProfileListResponse,
} from "@/types/profiles";
import { useTheme } from "@/context/ThemeContext";
import { useDataRefresh } from "@/lib/data/DataProvider";

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
  photoData: null,
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

const SESSION_UNLOCKED_KEY = "billflow_unlocked_profile_id";

function requireProfilesApi() {
  const api = typeof window !== "undefined" ? window.billflow?.profiles : undefined;
  if (!api) {
    throw new Error("Open the BillFlow desktop app to manage profiles.");
  }
  return api;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { setAccent, setPreference } = useTheme();
  const refreshData = useDataRefresh();

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
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(
    null,
  );

  useEffect(() => {
    const changed = (event: Event) => {
      const response = (event as CustomEvent<ProfileListResponse>).detail;
      if (response.activeProfileId === activeProfileId)
        setProfiles(response.profiles);
    };
    window.addEventListener("billflow:profile-appearance-changed", changed);
    return () =>
      window.removeEventListener(
        "billflow:profile-appearance-changed",
        changed,
      );
  }, [activeProfileId]);
  const initialBootHandledRef = useRef(false);
  const lastDispatchedProfileIdRef = useRef<string | null>(null);

  const applyProfileVisuals = useCallback(
    (profile: UserProfile, transition = false) => {
      setAccent(profile.accent, { transition, persistProfile: false });
      if (profile.themePreference) {
        setPreference(profile.themePreference, {
          transition,
          persistProfile: false,
        });
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("billflow_active_profile_scope", profile.id);
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
    (res: ProfileListResponse, isInitialBoot = false, forceVisuals = false) => {
      setProfiles(res.profiles);
      setActiveProfileId(res.activeProfileId);
      setMaxProfiles(res.maxProfiles || MAX_PROFILES);
      setNeedsOnboarding(res.needsOnboarding);

      const active =
        res.profiles.find((p) => p.id === res.activeProfileId) ??
        res.profiles[0] ??
        FALLBACK_DEFAULT_PROFILE;

      if (
        isInitialBoot ||
        forceVisuals ||
        lastDispatchedProfileIdRef.current !== active.id
      ) {
        lastDispatchedProfileIdRef.current = active.id;
        applyProfileVisuals(active, !isInitialBoot);
      }
      if (res.isLocked) {
        setIsLocked(true);
        setIsGateOpen(true);
        setModalMode("select");
      }

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
        if (res.isLocked ?? (active.hasPassword && unlockedId !== active.id)) {
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
      const api =
        typeof window !== "undefined" ? window.billflow?.profiles : undefined;
      if (!api) return;
      const res = await api.list();
      applyResponse(res, !initialBootHandledRef.current);
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
    if (window.billflow?.profiles)
      void window.billflow.profiles.lock().catch(console.error);
    lastDispatchedProfileIdRef.current = null;
    window.dispatchEvent(new Event("billflow:workspace-locked"));
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
    }
    setIsLocked(true);
    setModalMode("select");
    setEditingProfile(null);
    setIsGateOpen(true);
  }, []);

  useEffect(() => {
    return window.billflow?.onWorkspaceLocked?.(lockCurrentProfile);
  }, [lockCurrentProfile]);

  const verifyPassword = useCallback(
    async (id: string, password: string): Promise<boolean> => {
      const result = await requireProfilesApi().verifyPassword(id, password);
      return result.valid;
    },
    [],
  );

  const switchProfile = useCallback(
    async (id: string, password?: string) => {
      const res = await requireProfilesApi().switch(id, password);
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, id);
      setIsLocked(false);
      setIsGateOpen(false);
      setEditingProfile(null);
      applyResponse(res, false, true);
      await refreshData();
    },
    [applyResponse, refreshData],
  );

  const createProfile = useCallback(
    async (input: CreateProfileInput) => {
      const res = await requireProfilesApi().create(input);
      applyResponse(res, false);
    },
    [applyResponse],
  );

  const updateProfile = useCallback(
    async (id: string, patch: UpdateProfileInput) => {
      const res = await requireProfilesApi().update(id, patch);
      applyResponse(res, false);
      const updatedActive = res.profiles.find(
        (p) => p.id === res.activeProfileId,
      );
      if (updatedActive && id === res.activeProfileId) {
        if (patch.accent !== undefined) {
          setAccent(updatedActive.accent, { transition: true });
        }
        if (patch.themePreference !== undefined) {
          setPreference(updatedActive.themePreference, {
            transition: true,
          });
        }
      }
      if (
        patch.role !== undefined ||
        patch.subtitle !== undefined ||
        patch.defaultCurrency !== undefined ||
        patch.invoicePrefix !== undefined
      ) {
        await refreshData();
      }
    },
    [applyResponse, refreshData, setAccent, setPreference],
  );

  const deleteProfile = useCallback(
    async (id: string, password?: string) => {
      const res = await requireProfilesApi().remove(id, password);
      applyResponse(res, false);
    },
    [applyResponse],
  );

  const completeOnboarding = useCallback(
    async (input: CompleteOnboardingInput) => {
      const res = await requireProfilesApi().completeOnboarding(input);
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, res.activeProfileId);
      setIsLocked(false);
      setIsGateOpen(false);
      setEditingProfile(null);
      applyResponse(res, false, true);
      await refreshData();
    },
    [applyResponse, refreshData],
  );

  const activeProfile = useMemo(
    () =>
      profiles.find((p) => p.id === activeProfileId) ??
      profiles[0] ??
      FALLBACK_DEFAULT_PROFILE,
    [profiles, activeProfileId],
  );

  const contextValue = useMemo<ProfileContextValue>(
    () => ({
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
    }),
    [
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
    ],
  );

  return (
    <ProfileContext.Provider value={contextValue}>
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
