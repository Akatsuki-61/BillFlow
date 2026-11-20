import { imageDataSchema } from "../validation";
import { atomicWrite } from "../managed-files";
import { finishDesktopSetup, getDesktopSetup } from "../desktop-setup";
import {
  initializeProfileSession,
  unlockProfileSession,
  lockProfileSession,
  isWorkspaceUnlocked,
} from "../workspace-session";
import { ipcMain } from "../security";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  getDb,
  getRootDb,
  getRootDatabasePath,
  getActiveProfileId,
  switchWorkspaceDatabase,
  deleteWorkspaceDatabaseFiles,
} from "../db";
import {
  userProfiles,
  appSetup,
  settings,
  clients,
  invoices,
  catalogItems,
  type UserProfileRow,
} from "../db/schema";
import { AppError, formatError } from "./errors";
import {
  MAX_PROFILES,
  PROFILE_ROLE_PRESETS,
  type ProfileRole,
  type ProfileAvatar,
  type UserProfile,
  type CreateProfileInput,
  type UpdateProfileInput,
  type CompleteOnboardingInput,
  type ProfileListResponse,
} from "../../src/types/profiles";
import type { AccentPreference, ThemePreference } from "../../src/lib/theme";
import type { Currency } from "../../src/types/billing";

const roleEnum = z.enum([
  "software-engineering",
  "ai-development",
  "consulting",
  "design",
  "general",
]);

const avatarEnum = z.enum([
  "code",
  "terminal",
  "compass",
  "layers",
  "briefcase",
  "cpu",
  "globe",
  "shield",
]);

const accentEnum = z.enum([
  "blue",
  "purple",
  "emerald",
  "amber",
  "rose",
  "indigo",
]);
const themeEnum = z.enum(["system", "light", "dark"]);
const currencyEnum = z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]);

const nonEmptyPasswordSchema = z
  .string()
  .min(4, "Password must be at least 4 characters.")
  .max(128)
  .refine(
    (val) => val.trim().length > 0,
    "Password cannot be whitespace only.",
  );

const createProfileSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required.").max(60),
  role: roleEnum.default("software-engineering"),
  subtitle: z.string().trim().max(80).optional(),
  avatar: avatarEnum.optional(),
  photoData: imageDataSchema,
  accent: accentEnum.optional(),
  themePreference: themeEnum.optional(),
  defaultCurrency: currencyEnum.optional(),
  invoicePrefix: z.string().trim().min(1).max(12).optional(),
  password: nonEmptyPasswordSchema.optional().or(z.literal("")),
  passwordHint: z.string().trim().max(80).optional(),
  seedRoleCatalog: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Profile name is required.")
    .max(60)
    .optional(),
  role: roleEnum.optional(),
  subtitle: z.string().trim().max(80).optional(),
  avatar: avatarEnum.optional(),
  photoData: imageDataSchema,
  accent: accentEnum.optional(),
  themePreference: themeEnum.optional(),
  defaultCurrency: currencyEnum.optional(),
  invoicePrefix: z.string().trim().min(1).max(12).optional(),
  password: z
    .union([nonEmptyPasswordSchema, z.literal(""), z.null()])
    .optional(),
  currentPassword: z.string().max(128).optional(),
  passwordHint: z.string().trim().max(80).nullable().optional(),
});

const onboardingSlotSchema = z.object({
  name: z.string().trim().min(1).max(60),
  role: roleEnum,
  subtitle: z.string().trim().max(80),
  avatar: avatarEnum,
  accent: accentEnum,
  defaultCurrency: currencyEnum,
  invoicePrefix: z.string().trim().min(1).max(12),
  password: nonEmptyPasswordSchema.optional().or(z.literal("")),
  passwordHint: z.string().trim().max(80).optional(),
  seedRoleCatalog: z.boolean().default(true),
});

const completeOnboardingSchema = z.object({
  studioName: z
    .string()
    .trim()
    .min(1, "Your name or studio name is required.")
    .max(80),
  email: z.string().trim().max(120).optional().default(""),
  defaultCurrency: currencyEnum.default("USD"),
  profiles: z.array(onboardingSlotSchema).min(1).max(MAX_PROFILES),
  guidedSetup: z.literal(true).optional(),
});

const SCRYPT_OPTIONS = {
  N: 65536,
  r: 8,
  p: 1,
  maxmem: 128 * 1024 * 1024,
} as const;

export function hashProfilePassword(password: string): {
  hash: string;
  salt: string;
} {
  const isPin = /^\d{4}$/.test(password);
  const rawSalt = crypto.randomBytes(16).toString("hex");
  const salt = `${isPin ? "pin2" : "pwd2"}:${rawSalt}`;
  const hash = crypto
    .scryptSync(password, salt, 64, SCRYPT_OPTIONS)
    .toString("hex");
  return { hash, salt };
}

type LockoutRecord = { count: number; retryAt: number };
const memoryLockouts = new Map<string, LockoutRecord>();

function lockoutFilePath(): string | null {
  try {
    return path.join(
      path.dirname(getRootDatabasePath()),
      "profile-lockout.json",
    );
  } catch {
    return null;
  }
}

function readLockoutMap(): Record<string, LockoutRecord> {
  const file = lockoutFilePath();
  if (!file) return Object.fromEntries(memoryLockouts);
  try {
    if (!fs.existsSync(file) || fs.statSync(file).size > 64 * 1024) return {};
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed as Record<string, LockoutRecord>;
  } catch {
    return {};
  }
}

function writeLockoutMap(map: Record<string, LockoutRecord>) {
  const file = lockoutFilePath();
  if (!file) {
    memoryLockouts.clear();
    for (const [key, value] of Object.entries(map)) {
      memoryLockouts.set(key, value);
    }
    return;
  }
  try {
    atomicWrite(file, JSON.stringify(map), 0o600);
  } catch {
    // Non-fatal in read-only environments
  }
}

function recordFailedAttempt(
  map: Record<string, LockoutRecord>,
  saltKey: string,
  attempt: LockoutRecord | undefined,
) {
  const count = (attempt?.count || 0) + 1;
  const delayMs =
    count >= 5 ? Math.min(15 * 60 * 1000, 60_000 * 2 ** (count - 5)) : 0;
  map[saltKey] = {
    count,
    retryAt: delayMs > 0 ? Date.now() + delayMs : 0,
  };
  writeLockoutMap(map);
}

export function verifyProfilePasswordHash(
  password: string,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined,
): boolean {
  if (!storedHash || !storedSalt) return true;
  const saltKey = crypto.createHash("sha256").update(storedSalt).digest("hex");
  const lockouts = readLockoutMap();
  const attempt = lockouts[saltKey];
  if (attempt && Date.now() < attempt.retryAt)
    throw new AppError(
      "TRY_LATER",
      "Too many attempts. Try again later.",
    );
  if (!password || password.length > 128) {
    recordFailedAttempt(lockouts, saltKey, attempt);
    return false;
  }
  try {
    const useHardenedScrypt =
      storedSalt.startsWith("pin2:") || storedSalt.startsWith("pwd2:");
    const derived = useHardenedScrypt
      ? crypto.scryptSync(password, storedSalt, 64, SCRYPT_OPTIONS)
      : crypto.scryptSync(password, storedSalt, 64);
    const expected = Buffer.from(storedHash, "hex");
    if (derived.length !== expected.length) return false;
    const valid = crypto.timingSafeEqual(derived, expected);
    if (valid) {
      if (attempt) {
        delete lockouts[saltKey];
        writeLockoutMap(lockouts);
      }
    } else {
      recordFailedAttempt(lockouts, saltKey, attempt);
    }
    return valid;
  } catch {
    return false;
  }
}

function mapProfileRow(row: UserProfileRow): UserProfile {
  const hasPassword = Boolean(row.passwordHash && row.passwordSalt);
  const lockType = !hasPassword
    ? null
    : row.passwordSalt?.startsWith("pin:") ||
        row.passwordSalt?.startsWith("pin2:")
      ? "pin"
      : "password";

  const role = (row.role as ProfileRole) || "software-engineering";
  const parsedAvatar = avatarEnum.safeParse(row.avatar);
  const avatar: ProfileAvatar = parsedAvatar.success
    ? parsedAvatar.data
    : PROFILE_ROLE_PRESETS[role]?.avatar || "cpu";

  return {
    id: row.id,
    name: row.name,
    role,
    subtitle: row.subtitle,
    avatar,
    photoData: row.photoData,
    accent: (row.accent as AccentPreference) || "blue",
    themePreference: (row.themePreference as ThemePreference) || "system",
    defaultCurrency: (row.defaultCurrency as Currency) || "USD",
    invoicePrefix: row.invoicePrefix || "SE-",
    hasPassword,
    lockType,
    passwordHint: row.passwordHint ?? null,
    isActive: Boolean(row.isActive),
    isOnboarded: Boolean(row.isOnboarded),
    position: row.position,
    lastActiveAt: row.lastActiveAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const lastMirroredProfileSnapshotByPath = new Map<string, string>();

function syncProfilesJsonMirror(
  profiles: UserProfile[],
  activeProfileId: string,
) {
  try {
    const rootDir = path.dirname(getRootDatabasePath());
    const mirrorPath = path.join(rootDir, "profiles.json");
    const mirroredProfiles = profiles.map(
      ({ photoData: _photoData, ...rest }) => {
        void _photoData;
        return rest;
      },
    );
    const fingerprint = JSON.stringify({
      activeProfileId,
      profiles: mirroredProfiles,
    });
    if (
      lastMirroredProfileSnapshotByPath.get(mirrorPath) === fingerprint &&
      fs.existsSync(mirrorPath)
    ) {
      return;
    }
    const payload = {
      version: 1,
      maxProfiles: MAX_PROFILES,
      activeProfileId,
      updatedAt: new Date().toISOString(),
      profiles: mirroredProfiles,
    };
    atomicWrite(mirrorPath, JSON.stringify(payload, null, 2), 0o600);
    lastMirroredProfileSnapshotByPath.set(mirrorPath, fingerprint);
  } catch {
    // Non-fatal if directory is read-only during isolated unit tests
  }
}

function provisionProfileWorkspace(options: {
  profileId: string;
  businessName?: string;
  professionalTitle: string;
  email?: string;
  defaultCurrency: Currency;
  invoicePrefix: string;
  role: ProfileRole;
  seedRoleCatalog?: boolean;
}) {
  const prevProfileId = getActiveProfileId();
  try {
    switchWorkspaceDatabase(options.profileId);
    const db = getDb();
    const now = new Date().toISOString();
    const existingSetting = db
      .select()
      .from(settings)
      .where(eq(settings.id, "default"))
      .get();

    if (!existingSetting) {
      db.insert(settings)
        .values({
          id: "default",
          businessName: options.businessName ?? "",
          professionalTitle: options.professionalTitle,
          email: options.email ?? "",
          defaultCurrency: options.defaultCurrency,
          invoicePrefix: options.invoicePrefix,
          updatedAt: now,
        })
        .run();
    } else {
      db.update(settings)
        .set({
          ...(options.businessName !== undefined
            ? { businessName: options.businessName }
            : {}),
          professionalTitle: options.professionalTitle,
          ...(options.email !== undefined && options.email !== ""
            ? { email: options.email }
            : {}),
          defaultCurrency: options.defaultCurrency,
          invoicePrefix: options.invoicePrefix,
          updatedAt: now,
        })
        .where(eq(settings.id, "default"))
        .run();
    }

    if (options.seedRoleCatalog) {
      const preset = PROFILE_ROLE_PRESETS[options.role];
      if (preset) {
        for (const item of preset.starterCatalog) {
          const existingSku = db
            .select()
            .from(catalogItems)
            .where(eq(catalogItems.sku, item.sku))
            .get();
          if (!existingSku) {
            db.insert(catalogItems)
              .values({
                id: crypto.randomUUID(),
                title: item.title,
                category: item.category,
                sku: item.sku,
                description: item.description,
                priceCents: item.priceCents,
                currency: options.defaultCurrency,
                unit: item.unit,
                iconType: item.iconType,
                createdAt: now,
                updatedAt: now,
              })
              .run();
          }
        }
      }
    }
  } finally {
    if (getActiveProfileId() !== prevProfileId) {
      switchWorkspaceDatabase(prevProfileId);
    }
  }
}

export function ensureDefaultProfile(): void {
  const rootDb = getRootDb();
  const existingRows = rootDb
    .select()
    .from(userProfiles)
    .orderBy(asc(userProfiles.position), asc(userProfiles.createdAt))
    .all();

  if (existingRows.length > 0) {
    const active = existingRows.find((row) => row.isActive) ?? existingRows[0];
    if (!active.isActive) {
      rootDb
        .update(userProfiles)
        .set({ isActive: true })
        .where(eq(userProfiles.id, active.id))
        .run();
    }
    return;
  }

  const existingSetting = rootDb
    .select()
    .from(settings)
    .where(eq(settings.id, "default"))
    .get();
  const existingClients = rootDb
    .select({ id: clients.id })
    .from(clients)
    .limit(1)
    .all();
  const existingInvoices = rootDb
    .select({ id: invoices.id })
    .from(invoices)
    .limit(1)
    .all();

  const hasExistingWorkspaceData =
    existingClients.length > 0 ||
    existingInvoices.length > 0 ||
    Boolean(
      existingSetting?.businessName &&
      existingSetting.businessName.trim().length > 0,
    );

  const now = new Date().toISOString();
  const preset = PROFILE_ROLE_PRESETS["software-engineering"];

  rootDb
    .insert(userProfiles)
    .values({
      id: "default",
      name: existingSetting?.businessName?.trim() || preset.defaultName,
      role: "software-engineering",
      subtitle: existingSetting?.professionalTitle?.trim() || preset.subtitle,
      avatar: preset.avatar,
      accent: preset.accent,
      themePreference: "system",
      defaultCurrency: (existingSetting?.defaultCurrency as Currency) || "USD",
      invoicePrefix: existingSetting?.invoicePrefix || preset.invoicePrefix,
      passwordHash: null,
      passwordSalt: null,
      passwordHint: null,
      isActive: true,
      isOnboarded: hasExistingWorkspaceData,
      position: 0,
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function listProfilesState(): ProfileListResponse {
  ensureDefaultProfile();
  const rootDb = getRootDb();
  const rows = rootDb
    .select()
    .from(userProfiles)
    .orderBy(asc(userProfiles.position), asc(userProfiles.createdAt))
    .all();

  const activeRow = rows.find((row) => row.isActive) ?? rows[0];
  if (getActiveProfileId() !== activeRow.id) {
    switchWorkspaceDatabase(activeRow.id);
  }

  initializeProfileSession(activeRow.id, Boolean(activeRow.passwordHash));
  const profiles = rows.map(mapProfileRow);
  syncProfilesJsonMirror(profiles, activeRow.id);

  const needsOnboarding =
    rows.length === 1 && !rows[0].isOnboarded && !rows[0].passwordHash;

  return {
    profiles,
    activeProfileId: activeRow.id,
    maxProfiles: MAX_PROFILES,
    needsOnboarding,
    desktopSetup: getDesktopSetup(),
    isLocked: !isWorkspaceUnlocked(),
  };
}

export function createProfile(input: CreateProfileInput): ProfileListResponse {
  ensureDefaultProfile();
  const value = createProfileSchema.parse(input);
  const rootDb = getRootDb();
  const existingRows = rootDb
    .select()
    .from(userProfiles)
    .orderBy(asc(userProfiles.position), asc(userProfiles.createdAt))
    .all();

  if (existingRows.length >= MAX_PROFILES) {
    throw new AppError(
      "MAX_PROFILES_REACHED",
      `BillFlow supports up to ${MAX_PROFILES} profiles. Remove an unused profile before adding another.`,
    );
  }

  const preset =
    PROFILE_ROLE_PRESETS[value.role] ?? PROFILE_ROLE_PRESETS["general"];
  const id = `prof-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const rawPassword = value.password || "";
  const passwordCredentials = rawPassword
    ? hashProfilePassword(rawPassword)
    : { hash: null, salt: null };

  const rootSettings = rootDb
    .select()
    .from(settings)
    .where(eq(settings.id, "default"))
    .get();

  const subtitle = value.subtitle?.trim() || preset.subtitle;
  const avatar = value.avatar || preset.avatar;
  const accent = value.accent || preset.accent;
  const themePreference = value.themePreference || "system";
  const defaultCurrency =
    value.defaultCurrency ||
    (rootSettings?.defaultCurrency as Currency) ||
    "USD";
  const invoicePrefix = value.invoicePrefix?.trim() || preset.invoicePrefix;
  const nextPosition =
    existingRows.reduce((max, r) => Math.max(max, r.position), -1) + 1;

  rootDb
    .insert(userProfiles)
    .values({
      id,
      name: value.name,
      role: value.role,
      subtitle,
      avatar,
      photoData: value.photoData,
      accent,
      themePreference,
      defaultCurrency,
      invoicePrefix,
      passwordHash: passwordCredentials.hash,
      passwordSalt: passwordCredentials.salt,
      passwordHint: rawPassword ? value.passwordHint?.trim() || null : null,
      isActive: false,
      isOnboarded: true,
      position: nextPosition,
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Mark primary profile as onboarded once user creates profiles
  rootDb
    .update(userProfiles)
    .set({ isOnboarded: true })
    .where(eq(userProfiles.id, "default"))
    .run();

  provisionProfileWorkspace({
    profileId: id,
    businessName: rootSettings?.businessName || value.name,
    professionalTitle: subtitle,
    email: rootSettings?.email || "",
    defaultCurrency,
    invoicePrefix,
    role: value.role,
    seedRoleCatalog: value.seedRoleCatalog ?? true,
  });

  return listProfilesState();
}

export function updateProfile(
  id: string,
  patch: UpdateProfileInput,
): ProfileListResponse {
  z.string().min(1).parse(id);
  ensureDefaultProfile();
  const value = updateProfileSchema.parse(patch);
  const rootDb = getRootDb();

  const existing = rootDb
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, id))
    .get();

  if (!existing) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  let passwordVerified = false;
  if (
    id !== getActiveProfileId() &&
    existing.passwordHash
  ) {
    if (
      !verifyProfilePasswordHash(
        value.currentPassword || "",
        existing.passwordHash,
        existing.passwordSalt,
      )
    ) {
      throw new AppError(
        "INVALID_PASSWORD",
        "Current password is incorrect. Unlock this profile before changing its settings.",
      );
    }
    passwordVerified = true;
  }
  let passwordHash = existing.passwordHash;
  let passwordSalt = existing.passwordSalt;
  let passwordHint =
    value.passwordHint !== undefined
      ? value.passwordHint
      : existing.passwordHint;

  if (value.password !== undefined) {
    if (existing.passwordHash && existing.passwordSalt && !passwordVerified) {
      if (
        !verifyProfilePasswordHash(
          value.currentPassword ?? "",
          existing.passwordHash,
          existing.passwordSalt,
        )
      ) {
        throw new AppError(
          "INVALID_PASSWORD",
          "Current password is incorrect.",
        );
      }
    }

    if (value.password === null || value.password === "") {
      passwordHash = null;
      passwordSalt = null;
      passwordHint = null;
    } else {
      const creds = hashProfilePassword(value.password);
      passwordHash = creds.hash;
      passwordSalt = creds.salt;
    }
  }

  const nextRole = (value.role ?? existing.role) as ProfileRole;
  const nextSubtitle = value.subtitle ?? existing.subtitle;
  const nextCurrency = (value.defaultCurrency ??
    existing.defaultCurrency) as Currency;
  const nextPrefix = value.invoicePrefix ?? existing.invoicePrefix;
  const now = new Date().toISOString();

  rootDb
    .update(userProfiles)
    .set({
      name: value.name ?? existing.name,
      role: nextRole,
      subtitle: nextSubtitle,
      avatar: value.avatar ?? existing.avatar,
      photoData:
        value.photoData === undefined ? existing.photoData : value.photoData,
      accent: value.accent ?? existing.accent,
      themePreference: value.themePreference ?? existing.themePreference,
      defaultCurrency: nextCurrency,
      invoicePrefix: nextPrefix,
      passwordHash,
      passwordSalt,
      passwordHint,
      isOnboarded: existing.isOnboarded,
      updatedAt: now,
    })
    .where(eq(userProfiles.id, id))
    .run();

  if (
    value.subtitle !== undefined ||
    value.defaultCurrency !== undefined ||
    value.invoicePrefix !== undefined
  ) {
    provisionProfileWorkspace({
      profileId: id,
      professionalTitle: nextSubtitle,
      defaultCurrency: nextCurrency,
      invoicePrefix: nextPrefix,
      role: nextRole,
      seedRoleCatalog: false,
    });
  }

  return listProfilesState();
}

export function verifyProfilePassword(
  id: string,
  password: string,
): { valid: boolean } {
  z.string().min(1).parse(id);
  ensureDefaultProfile();
  const rootDb = getRootDb();
  const existing = rootDb
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, id))
    .get();

  if (!existing) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  const valid = verifyProfilePasswordHash(
    password,
    existing.passwordHash,
    existing.passwordSalt,
  );
  return { valid };
}

export function switchProfile(
  id: string,
  password?: string,
): ProfileListResponse {
  z.string().min(1).parse(id);
  ensureDefaultProfile();
  const rootDb = getRootDb();
  const target = rootDb
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, id))
    .get();

  if (!target) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  if (target.passwordHash && target.passwordSalt) {
    const isValid = verifyProfilePasswordHash(
      password ?? "",
      target.passwordHash,
      target.passwordSalt,
    );
    if (!isValid) {
      throw new AppError(
        "INVALID_PASSWORD",
        "Incorrect password for this profile.",
      );
    }
  }

  switchWorkspaceDatabase(target.id);
  unlockProfileSession(target.id);

  // Ensure settings row exists in the switched workspace database
  const activeDb = getDb();
  const now = new Date().toISOString();
  const existingSetting = activeDb
    .select()
    .from(settings)
    .where(eq(settings.id, "default"))
    .get();

  if (!existingSetting) {
    const rootSetting = rootDb
      .select()
      .from(settings)
      .where(eq(settings.id, "default"))
      .get();
    activeDb
      .insert(settings)
      .values({
        id: "default",
        businessName: rootSetting?.businessName || target.name,
        professionalTitle: target.subtitle,
        email: rootSetting?.email || "",
        defaultCurrency: (target.defaultCurrency as Currency) || "USD",
        invoicePrefix: target.invoicePrefix || "INV-",
        updatedAt: now,
      })
      .run();
  }

  rootDb.transaction((tx) => {
    tx.update(userProfiles).set({ isActive: false }).run();
    tx.update(userProfiles)
      .set({
        isActive: true,
        lastActiveAt: now,
        updatedAt: now,
      })
      .where(eq(userProfiles.id, target.id))
      .run();
  });

  return listProfilesState();
}

export function deleteProfile(
  id: string,
  password?: string,
): ProfileListResponse {
  z.string().min(1).parse(id);
  ensureDefaultProfile();
  const rootDb = getRootDb();
  const rows = rootDb
    .select()
    .from(userProfiles)
    .orderBy(asc(userProfiles.position), asc(userProfiles.createdAt))
    .all();

  if (rows.length <= 1) {
    throw new AppError(
      "LAST_PROFILE",
      "At least one profile must remain in BillFlow.",
    );
  }

  if (id === "default") {
    throw new AppError(
      "PRIMARY_PROFILE",
      "The primary studio profile cannot be deleted. You can rename it or change its role instead.",
    );
  }

  const target = rows.find((r) => r.id === id);
  if (!target) {
    throw new AppError("NOT_FOUND", "Profile not found.");
  }

  if (target.passwordHash && target.passwordSalt) {
    const isValid = verifyProfilePasswordHash(
      password ?? "",
      target.passwordHash,
      target.passwordSalt,
    );
    if (!isValid) {
      throw new AppError(
        "INVALID_PASSWORD",
        "Incorrect password. Enter this profile's password to delete it.",
      );
    }
  }

  const wasActive = target.isActive || getActiveProfileId() === id;
  if (wasActive) {
    switchWorkspaceDatabase("default");
  }

  rootDb.transaction((tx) => {
    tx.delete(userProfiles).where(eq(userProfiles.id, id)).run();
    if (wasActive) {
      tx.update(userProfiles)
        .set({ isActive: true, lastActiveAt: new Date().toISOString() })
        .where(eq(userProfiles.id, "default"))
        .run();
    }
  });

  deleteWorkspaceDatabaseFiles(id);

  return listProfilesState();
}

export function completeProfileOnboarding(
  input: CompleteOnboardingInput,
): ProfileListResponse {
  const created: string[] = [];
  const previousProfileId = getActiveProfileId();
  try {
    return getRootDb().transaction(() =>
      completeOnboardingTransaction(input, created),
    );
  } catch (error) {
    if (created.length > 0 || getActiveProfileId() !== previousProfileId) {
      try {
        switchWorkspaceDatabase(previousProfileId);
      } catch {
        // Keep the original error if rollback switch fails
      }
    }
    for (const id of created) deleteWorkspaceDatabaseFiles(id);
    throw error;
  }
}
function completeOnboardingTransaction(
  input: CompleteOnboardingInput,
  created: string[],
): ProfileListResponse {
  ensureDefaultProfile();
  const rootDb = getRootDb();
  const existingRows = rootDb
    .select()
    .from(userProfiles)
    .orderBy(asc(userProfiles.position), asc(userProfiles.createdAt))
    .all();

  if (
    existingRows.length !== 1 ||
    existingRows[0].isOnboarded ||
    existingRows.some((r) => Boolean(r.passwordHash))
  )
    throw new AppError(
      "ALREADY_ONBOARDED",
      "Onboarding has already been completed. Use profile settings to make changes.",
    );

  const value = completeOnboardingSchema.parse(input);
  const now = new Date().toISOString();

  const primarySlot = value.profiles[0];
  const primaryPass = primarySlot.password || "";
  const primaryCreds = primaryPass
    ? hashProfilePassword(primaryPass)
    : { hash: null, salt: null };

  rootDb
    .update(userProfiles)
    .set({
      name: primarySlot.name,
      role: primarySlot.role,
      subtitle: primarySlot.subtitle,
      avatar: primarySlot.avatar,
      accent: primarySlot.accent,
      defaultCurrency: primarySlot.defaultCurrency || value.defaultCurrency,
      invoicePrefix: primarySlot.invoicePrefix,
      ...(primaryPass
        ? {
            passwordHash: primaryCreds.hash,
            passwordSalt: primaryCreds.salt,
            passwordHint: primarySlot.passwordHint?.trim() || null,
          }
        : {}),
      isActive: true,
      isOnboarded: true,
      position: 0,
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(userProfiles.id, "default"))
    .run();

  provisionProfileWorkspace({
    profileId: "default",
    businessName: value.studioName,
    professionalTitle: primarySlot.subtitle,
    email: value.email,
    defaultCurrency: primarySlot.defaultCurrency || value.defaultCurrency,
    invoicePrefix: primarySlot.invoicePrefix,
    role: primarySlot.role,
    seedRoleCatalog: primarySlot.seedRoleCatalog,
  });

  let currentTotal = existingRows.length;
  const secondaryExisting = existingRows.filter((r) => r.id !== "default");

  for (let i = 1; i < value.profiles.length; i++) {
    const slot = value.profiles[i];
    const rawPass = slot.password || "";
    const creds = rawPass
      ? hashProfilePassword(rawPass)
      : { hash: null, salt: null };
    const matchedExisting = secondaryExisting[i - 1];

    if (matchedExisting) {
      rootDb
        .update(userProfiles)
        .set({
          name: slot.name,
          role: slot.role,
          subtitle: slot.subtitle,
          avatar: slot.avatar,
          accent: slot.accent,
          defaultCurrency: slot.defaultCurrency || value.defaultCurrency,
          invoicePrefix: slot.invoicePrefix,
          ...(rawPass
            ? {
                passwordHash: creds.hash,
                passwordSalt: creds.salt,
                passwordHint: slot.passwordHint?.trim() || null,
              }
            : {}),
          isOnboarded: true,
          position: i,
          updatedAt: now,
        })
        .where(eq(userProfiles.id, matchedExisting.id))
        .run();

      provisionProfileWorkspace({
        profileId: matchedExisting.id,
        businessName: value.studioName,
        professionalTitle: slot.subtitle,
        email: value.email,
        defaultCurrency: slot.defaultCurrency || value.defaultCurrency,
        invoicePrefix: slot.invoicePrefix,
        role: slot.role,
        seedRoleCatalog: slot.seedRoleCatalog,
      });
    } else if (currentTotal < MAX_PROFILES) {
      const newId = `prof-${crypto.randomUUID().slice(0, 8)}`;
      created.push(newId);
      currentTotal += 1;

      rootDb
        .insert(userProfiles)
        .values({
          id: newId,
          name: slot.name,
          role: slot.role,
          subtitle: slot.subtitle,
          avatar: slot.avatar,
          accent: slot.accent,
          themePreference: "system",
          defaultCurrency: slot.defaultCurrency || value.defaultCurrency,
          invoicePrefix: slot.invoicePrefix,
          passwordHash: creds.hash,
          passwordSalt: creds.salt,
          passwordHint: rawPass ? slot.passwordHint?.trim() || null : null,
          isActive: false,
          isOnboarded: true,
          position: i,
          lastActiveAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      provisionProfileWorkspace({
        profileId: newId,
        businessName: value.studioName,
        professionalTitle: slot.subtitle,
        email: value.email,
        defaultCurrency: slot.defaultCurrency || value.defaultCurrency,
        invoicePrefix: slot.invoicePrefix,
        role: slot.role,
        seedRoleCatalog: slot.seedRoleCatalog,
      });
    }
  }

  switchWorkspaceDatabase("default");
  if (value.guidedSetup) rootDb.insert(appSetup).values({ id: 1 }).run();
  unlockProfileSession("default");
  return listProfilesState();
}

export function registerProfileHandlers(
  broadcast: () => void,
  onWorkspaceUnlocked?: () => void,
) {
  ipcMain.handle("profiles:lock", () => {
    lockProfileSession();
    broadcast();
    return { success: true };
  });
  ipcMain.handle("profiles:list", () => {
    try {
      return listProfilesState();
    } catch (error) {
      throw formatError(error);
    }
  });

  ipcMain.handle("profiles:create", (_event, input: CreateProfileInput) => {
    try {
      const result = createProfile(input);
      broadcast();
      return result;
    } catch (error) {
      throw formatError(error);
    }
  });

  ipcMain.handle(
    "profiles:update",
    (_event, id: string, patch: UpdateProfileInput) => {
      try {
        const result = updateProfile(id, patch);
        broadcast();
        return result;
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle("profiles:switch", (_event, id: string, password?: string) => {
    try {
      const result = switchProfile(id, password);
      broadcast();
      onWorkspaceUnlocked?.();
      return result;
    } catch (error) {
      throw formatError(error);
    }
  });

  ipcMain.handle(
    "profiles:verifyPassword",
    (_event, id: string, password: string) => {
      try {
        return verifyProfilePassword(id, password);
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle("profiles:remove", (_event, id: string, password?: string) => {
    try {
      const result = deleteProfile(id, password);
      broadcast();
      return result;
    } catch (error) {
      throw formatError(error);
    }
  });

  ipcMain.handle(
    "profiles:completeOnboarding",
    (_event, input: CompleteOnboardingInput) => {
      try {
        const result = completeProfileOnboarding(input);
        broadcast();
        if (!result.desktopSetup?.permissionsPending) onWorkspaceUnlocked?.();
        return result;
      } catch (error) {
        throw formatError(error);
      }
    },
  );
  ipcMain.handle("profiles:finishSetup", () => {
    finishDesktopSetup();
    const result = listProfilesState();
    onWorkspaceUnlocked?.();
    return result;
  });
}
