import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { initDatabase, closeDatabaseForTesting } from "../db";
import {
  listProfilesState,
  createProfile,
  updateProfile,
  switchProfile,
  verifyProfilePassword,
  deleteProfile,
  completeProfileOnboarding,
} from "../ipc/profiles";
import { listExpenses, createExpense } from "../ipc/expenses";
import { listCatalogItems } from "../ipc/catalog";
import { getOrCreateSettings, updateSettings } from "../ipc/settings";
import { createInvoice, recordPayment } from "../ipc/invoices";
import { decideTracking, listTasks } from "../ipc/tasks";
import { lockProfileSession } from "../workspace-session";

let directory: string;
let databasePath: string;

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-profiles-test-"));
  databasePath = path.join(directory, "billflow.db");
  initDatabase(databasePath);
});

afterEach(() => {
  closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("Netflix-Style Multi-Profile Engine, Password Locks & Role Onboarding", () => {
  it("initializes a fresh workspace with onboarding required and mirrors profiles.json on disk", () => {
    const initial = listProfilesState();
    expect(initial.profiles).toHaveLength(1);
    expect(initial.activeProfileId).toBe("default");
    expect(initial.maxProfiles).toBe(5);
    expect(initial.needsOnboarding).toBe(true);

    const jsonMirrorPath = path.join(directory, "profiles.json");
    expect(fs.existsSync(jsonMirrorPath)).toBe(true);
    const mirror = JSON.parse(fs.readFileSync(jsonMirrorPath, "utf8"));
    expect(mirror.maxProfiles).toBe(5);
    expect(mirror.profiles).toHaveLength(1);
  });

  it("locks a protected first-run profile after a restart and preserves pending permissions", () => {
    const password = "test-workspace-password";
    const onboarded = completeProfileOnboarding({
      studioName: "Rivera Studio",
      defaultCurrency: "USD",
      guidedSetup: true,
      profiles: [
        {
          name: "Alex Rivera",
          role: "general",
          subtitle: "",
          avatar: "globe",
          accent: "blue",
          defaultCurrency: "USD",
          invoicePrefix: "INV-",
          password,
          seedRoleCatalog: false,
        },
      ],
    });
    expect(onboarded.profiles[0]).toMatchObject({
      hasPassword: true,
      lockType: "password",
    });
    expect(onboarded.isLocked).toBe(false);

    closeDatabaseForTesting();
    lockProfileSession();
    initDatabase(databasePath);
    expect(listProfilesState()).toMatchObject({
      isLocked: true,
      needsOnboarding: false,
      desktopSetup: { permissionsPending: true },
    });
    expect(() => switchProfile("default")).toThrow(/Incorrect password/);
    expect(switchProfile("default", password)).toMatchObject({
      isLocked: false,
      desktopSetup: { permissionsPending: true },
    });
  });

  it("completes role onboarding for Software Engineering, AI Development, and Consulting with isolated catalogs", () => {
    const onboarded = completeProfileOnboarding({
      studioName: "Chethaka Lakshitha",
      email: "chethaka@billflow.local",
      defaultCurrency: "USD",
      profiles: [
        {
          name: "Software Engineering",
          role: "software-engineering",
          subtitle: "Full-Stack & Systems",
          avatar: "code",
          accent: "blue",
          defaultCurrency: "USD",
          invoicePrefix: "SE-",
          seedRoleCatalog: true,
        },
        {
          name: "AI Development",
          role: "ai-development",
          subtitle: "LLMs, Agents & ML Pipelines",
          avatar: "cpu",
          accent: "purple",
          defaultCurrency: "USD",
          invoicePrefix: "AI-",
          password: "ai-secret-password",
          passwordHint: "AI Lab Key",
          seedRoleCatalog: true,
        },
        {
          name: "Technical Consulting",
          role: "consulting",
          subtitle: "Architecture & Strategy Advisory",
          avatar: "compass",
          accent: "emerald",
          defaultCurrency: "USD",
          invoicePrefix: "CON-",
          seedRoleCatalog: true,
        },
      ],
    });

    expect(onboarded.needsOnboarding).toBe(false);
    expect(onboarded.profiles).toHaveLength(3);
    expect(onboarded.activeProfileId).toBe("default");

    const seProfile = onboarded.profiles[0];
    const aiProfile = onboarded.profiles[1];
    const conProfile = onboarded.profiles[2];

    expect(seProfile.hasPassword).toBe(false);
    expect(aiProfile.hasPassword).toBe(true);
    expect(aiProfile.passwordHint).toBe("AI Lab Key");
    expect(conProfile.hasPassword).toBe(false);

    // Verify Software Engineering catalog items & settings in active ("default") workspace
    const seSettings = getOrCreateSettings();
    expect(seSettings.businessName).toBe("Chethaka Lakshitha");
    expect(seSettings.invoicePrefix).toBe("SE-");
    const seCatalog = listCatalogItems();
    expect(seCatalog.some((item) => item.sku.startsWith("SE-"))).toBe(true);
    expect(seCatalog.some((item) => item.sku.startsWith("AI-"))).toBe(false);

    // Record an expense in Software Engineering profile
    createExpense({
      merchant: "GitHub Enterprise",
      description: "Engineering CI/CD runners",
      category: "SOFTWARE",
      amountCents: 4500,
      currency: "USD",
      incurredAt: "2026-11-01",
      deductible: true,
    });
    expect(listExpenses()).toHaveLength(1);

    // Switching to locked AI Development profile without password must fail
    expect(() => switchProfile(aiProfile.id)).toThrow(/Incorrect password/);
    expect(() => switchProfile(aiProfile.id, "wrong-pass")).toThrow(
      /Incorrect password/,
    );

    // Verify password helper
    expect(verifyProfilePassword(aiProfile.id, "wrong-pass").valid).toBe(false);
    expect(
      verifyProfilePassword(aiProfile.id, "ai-secret-password").valid,
    ).toBe(true);

    // Switch to AI Development profile with valid password
    const afterSwitchAi = switchProfile(aiProfile.id, "ai-secret-password");
    expect(afterSwitchAi.activeProfileId).toBe(aiProfile.id);

    // AI Development workspace has its own isolated SQLite database:
    // 0 expenses from Software Engineering, and AI- prefixed settings & catalog
    expect(listExpenses()).toHaveLength(0);
    const aiSettings = getOrCreateSettings();
    expect(aiSettings.invoicePrefix).toBe("AI-");
    const aiCatalog = listCatalogItems();
    expect(aiCatalog.some((item) => item.sku.startsWith("AI-"))).toBe(true);
    expect(aiCatalog.some((item) => item.sku.startsWith("SE-"))).toBe(false);

    // Switch back to Software Engineering and confirm its expense is intact
    switchProfile("default");
    expect(listExpenses()).toHaveLength(1);
    expect(listExpenses()[0].merchant).toBe("GitHub Enterprise");
  });

  it("enforces the 5-profile maximum limit and supports password updates and removal", () => {
    // Default is profile #1; create 4 more profiles to reach MAX_PROFILES = 5
    createProfile({ name: "AI Lab", role: "ai-development" });
    createProfile({ name: "Consulting", role: "consulting" });
    createProfile({ name: "Design Systems", role: "design" });
    const stateAtFive = createProfile({
      name: "Operations",
      role: "general",
      password: "ops-password",
    });

    expect(stateAtFive.profiles).toHaveLength(5);

    // Attempting to create a 6th profile must fail
    expect(() =>
      createProfile({ name: "Sixth Overflow Profile", role: "general" }),
    ).toThrow(/up to 5 profiles/);

    const opsProfile = stateAtFive.profiles.find(
      (p) => p.name === "Operations",
    )!;
    expect(opsProfile.hasPassword).toBe(true);

    expect(() => updateProfile(opsProfile.id, { password: null })).toThrow(
      /Current password is incorrect/,
    );
    expect(() => updateProfile(opsProfile.id, { password: "replacement" })).toThrow(
      /Current password is incorrect/,
    );

    // Updating password with wrong currentPassword fails
    expect(() =>
      updateProfile(opsProfile.id, {
        currentPassword: "wrong",
        password: "new-ops-password",
      }),
    ).toThrow(/Current password is incorrect/);

    // Updating password with valid currentPassword succeeds
    updateProfile(opsProfile.id, {
      currentPassword: "ops-password",
      password: "new-ops-password",
    });
    expect(verifyProfilePassword(opsProfile.id, "ops-password").valid).toBe(
      false,
    );
    expect(
      verifyProfilePassword(opsProfile.id, "new-ops-password").valid,
    ).toBe(true);

    // Removing password lock
    const afterRemoveLock = updateProfile(opsProfile.id, {
      currentPassword: "new-ops-password",
      password: null,
    });
    const unlockedOps = afterRemoveLock.profiles.find(
      (p) => p.id === opsProfile.id,
    )!;
    expect(unlockedOps.hasPassword).toBe(false);

    // Deleting a secondary profile frees up a slot
    const afterDelete = deleteProfile(opsProfile.id);
    expect(afterDelete.profiles).toHaveLength(4);
  });

  it("resolves secondary profile name from root DB for auto-created invoice task assignees", () => {
    const onboarded = completeProfileOnboarding({
      studioName: "Studio Umbrella",
      email: "studio@billflow.local",
      defaultCurrency: "USD",
      profiles: [
        {
          name: "Software Engineering",
          role: "software-engineering",
          subtitle: "Full-Stack",
          avatar: "code",
          accent: "blue",
          defaultCurrency: "USD",
          invoicePrefix: "SE-",
          seedRoleCatalog: false,
        },
        {
          name: "AI Development",
          role: "ai-development",
          subtitle: "ML & Agents",
          avatar: "cpu",
          accent: "purple",
          defaultCurrency: "USD",
          invoicePrefix: "AI-",
          seedRoleCatalog: false,
        },
      ],
    });

    const aiProfile = onboarded.profiles.find((p) => p.name === "AI Development")!;
    switchProfile(aiProfile.id);
    updateSettings({ businessName: "" });

    const created = createInvoice({
      newClient: {
        name: "Northwind AI",
        email: "ai@northwind.test",
        currency: "USD",
        contactPerson: "Sam",
      },
      items: [
        {
          description: "Deploy retrieval pipeline",
          quantity: 1,
          unitPriceCents: 100000,
        },
      ],
      amountCents: 100000,
      advanceCents: 50000,
      currency: "USD",
    });

    recordPayment({
      invoiceId: created.id,
      amountCents: 50000,
      currency: "USD",
      reference: "ADV-AI-01",
      requestId: crypto.randomUUID(),
    });

    const tracking = decideTracking(created.id, "yes");
    expect(tracking.taskIds).toHaveLength(1);
    const createdTasks = listTasks();
    expect(createdTasks[0].assignee.name).toBe("AI Development");
  });
});
