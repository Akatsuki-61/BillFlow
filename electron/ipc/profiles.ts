import { ipcMain } from "electron";
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

const accentEnum = z.enum(["blue", "purple", "emerald", "amber", "rose", "indigo"]);
const themeEnum = z.enum(["system", "light", "dark"]);
const currencyEnum = z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]);

const createProfileSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required.").max(60),
  role: roleEnum.default("software-engineering"),
  subtitle: z.string().trim().max(80).optional(),
  avatar: avatarEnum.optional(),
  accent: accentEnum.optional(),
  themePreference: themeEnum.optional(),
  defaultCurrency: currencyEnum.optional(),
  invoicePrefix: z.string().trim().min(1).max(12).optional(),
  password: z.string().min(4, "Password must be at least 4 characters.").max(128).optional().or(z.literal("")),
  passwordHint: z.string().trim().max(80).optional(),
  seedRoleCatalog: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required.").max(60).optional(),
  role: roleEnum.optional(),
  subtitle: z.string().trim().max(80).optional(),
  avatar: avatarEnum.optional(),
  accent: accentEnum.optional(),
  themePreference: themeEnum.optional(),
  defaultCurrency: currencyEnum.optional(),
  invoicePrefix: z.string().trim().min(1).max(12).optional(),
  password: z
    .union([
      z.string().min(4, "Password must be at least 4 characters.").max(128),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  currentPassword: z.string().optional(),
  passwordHint: z.string().trim().max(80).nullable().optional(),
  isOnboarded: z.boolean().optional(),
});

const onboardingSlotSchema = z.object({
  name: z.string().trim().min(1).max(60),
  role: roleEnum,
  subtitle: z.string().trim().max(80),
  avatar: avatarEnum,
  accent: accentEnum,
  defaultCurrency: currencyEnum,
  invoicePrefix: z.string().trim().min(1).max(12),
  password: z.string().min(4, "Password must be at least 4 characters.").max(128).optional().or(z.literal("")),
  passwordHint: z.string().trim().max(80).optional(),
  seedRoleCatalog: z.boolean().default(true),
});

const completeOnboardingSchema = z.object({
  studioName: z.string().trim().min(1, "Your name or studio name is required.").max(80),
  email: z.string().trim().max(120).optional().default(""),
  defaultCurrency: currencyEnum.default("USD"),
  profiles: z.array(onboardingSlotSchema).min(1).max(MAX_PROFILES),
});

export function hashProfilePassword(password: string): { hash: string; salt: string } {
  const isPin = /^\d{4}$/.test(password);
  const rawSalt = crypto.randomBytes(16).toString("hex");
  const salt = `${isPin ? "pin" : "pwd"}:${rawSalt}`;
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyProfilePasswordHash(
  password: string,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined,
): boolean {
  if (!storedHash || !storedSalt) return true;
  if (!password) return false;
  try {
    const derived = crypto.scryptSync(password, storedSalt, 64);
    const expected = Buffer.from(storedHash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function mapProfileRow(row: UserProfileRow): UserProfile {
  const hasPassword = Boolean(row.passwordHash && row.passwordSalt);
  const lockType = !hasPassword
    ? null
    : row.passwordSalt?.startsWith("pin:")
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

function syncProfilesJsonMirror(profiles: UserProfile[], activeProfileId: string) {
  try {
    const rootDir = path.dirname(getRootDatabasePath());
    const mirrorPath = path.join(rootDir, "profiles.json");
    const tempPath = `${mirrorPath}.tmp`;
    const payload = {
      version: 1,
      maxProfiles: MAX_PROFILES,
      activeProfileId,
      updatedAt: new Date().toISOString(),
      profiles,
    };
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tempPath, mirrorPath);
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
  const existingClients = rootDb.select({ id: clients.id }).from(clients).limit(1).all();
  const existingInvoices = rootDb.select({ id: invoices.id }).from(invoices).limit(1).all();

  const hasExistingWorkspaceData =
    existingClients.length > 0 ||
    existingInvoices.length > 0 ||
    Boolean(existingSetting?.businessName && existingSetting.businessName.trim().length > 0);

  const now = new Date().toISOString();
  const preset = PROFILE_ROLE_PRESETS["software-engineering"];

  rootDb
    .insert(userProfiles)
    .values({
      id: "default",
      name:
        existingSetting?.businessName?.trim() ||
        preset.defaultName,
      role: "software-engineering",
      subtitle:
        existingSetting?.professionalTitle?.trim() ||
        preset.subtitle,
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

  const profiles = rows.map(mapProfileRow);
  syncProfilesJsonMirror(profiles, activeRow.id);

  const needsOnboarding = rows.length === 1 && !rows[0].isOnboarded;

  return {
    profiles,
    activeProfileId: activeRow.id,
    maxProfiles: MAX_PROFILES,
    needsOnboarding,
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

  const preset = PROFILE_ROLE_PRESETS[value.role] ?? PROFILE_ROLE_PRESETS["general"];
  const id = `prof-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const rawPassword = value.password?.trim() || "";
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

export function updateProfile(id: string, patch: UpdateProfileInput): ProfileListResponse {
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

  let passwordHash = existing.passwordHash;
  let passwordSalt = existing.passwordSalt;
  let passwordHint =
    value.passwordHint !== undefined ? value.passwordHint : existing.passwordHint;

  if (value.password !== undefined) {
    if (existing.passwordHash && existing.passwordSalt) {
      if (
        !verifyProfilePasswordHash(
          value.currentPassword ?? "",
          existing.passwordHash,
          existing.passwordSalt,
        )
      ) {
        throw new AppError("INVALID_PASSWORD", "Current password is incorrect.");
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
  const nextCurrency = (value.defaultCurrency ?? existing.defaultCurrency) as Currency;
  const nextPrefix = value.invoicePrefix ?? existing.invoicePrefix;
  const now = new Date().toISOString();

  rootDb
    .update(userProfiles)
    .set({
      name: value.name ?? existing.name,
      role: nextRole,
      subtitle: nextSubtitle,
      avatar: value.avatar ?? existing.avatar,
      accent: value.accent ?? existing.accent,
      themePreference: value.themePreference ?? existing.themePreference,
      defaultCurrency: nextCurrency,
      invoicePrefix: nextPrefix,
      passwordHash,
      passwordSalt,
      passwordHint,
      isOnboarded: value.isOnboarded ?? existing.isOnboarded,
      updatedAt: now,
    })
    .where(eq(userProfiles.id, id))
    .run();

  provisionProfileWorkspace({
    profileId: id,
    professionalTitle: nextSubtitle,
    defaultCurrency: nextCurrency,
    invoicePrefix: nextPrefix,
    role: nextRole,
    seedRoleCatalog: false,
  });

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

export function switchProfile(id: string, password?: string): ProfileListResponse {
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

export function deleteProfile(id: string, password?: string): ProfileListResponse {
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
  ensureDefaultProfile();
  const value = completeOnboardingSchema.parse(input);
  const rootDb = getRootDb();
  const now = new Date().toISOString();

  const existingRows = rootDb
    .select()
    .from(userProfiles)
    .orderBy(asc(userProfiles.position), asc(userProfiles.createdAt))
    .all();

  const primarySlot = value.profiles[0];
  const primaryPass = primarySlot.password?.trim() || "";
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
    const rawPass = slot.password?.trim() || "";
    const creds = rawPass ? hashProfilePassword(rawPass) : { hash: null, salt: null };
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
  return listProfilesState();
}

export function registerProfileHandlers(broadcast: () => void) {
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

  ipcMain.handle(
    "profiles:switch",
    (_event, id: string, password?: string) => {
      try {
        const result = switchProfile(id, password);
        broadcast();
        return result;
      } catch (error) {
        throw formatError(error);
      }
    },
  );

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

  ipcMain.handle(
    "profiles:remove",
    (_event, id: string, password?: string) => {
      try {
        const result = deleteProfile(id, password);
        broadcast();
        return result;
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle(
    "profiles:completeOnboarding",
    (_event, input: CompleteOnboardingInput) => {
      try {
        const result = completeProfileOnboarding(input);
        broadcast();
        return result;
      } catch (error) {
        throw formatError(error);
      }
    },
  );
}
