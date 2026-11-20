import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { closeDatabaseForTesting, getDatabaseHealth, getDb, initDatabase } from "../db";
import { exportWorkspace, importWorkspace, resetWorkspace } from "../backup";
import { listProfilesState, hashProfilePassword } from "../ipc/profiles";
import { listClientsWithStats } from "../ipc/clients";
import { getDashboardSummary } from "../ipc/dashboard";
import { getAnalyticsSummary } from "../ipc/analytics";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  getRollingBackupStatus,
  listRollingBackupFiles,
  runRollingEncryptedBackup,
  setRollingBackupPassphrase,
} from "../encrypted-backup";
import { getOrCreateSettings, updateSettings } from "../ipc/settings";
import {
  advanceScheduleDate,
  advanceSchedulePastDate,
} from "../recurring-schedule";
import {
  createRecurringRule,
  generateInvoiceForRule,
  listRecurringRules,
  runDueRecurringRules,
  toggleRecurringRule,
} from "../ipc/recurring";
import {
  computeFinancialDigest,
  maybeSendDailyDigest,
  syncAppBadgeCount,
} from "../digest";
import {
  buildQuotePdfPayload,
  convertQuoteToInvoice,
  createQuote,
  getNextQuoteCode,
  listQuotes,
  setQuoteStatus,
} from "../ipc/quotes";
import { buildInvoiceHtml } from "../pdf-generator";
import { lockProfileSession, unlockProfileSession } from "../workspace-session";
import { clients, tasks, userProfiles, vendors, workOrders } from "../db/schema";
import { eq } from "drizzle-orm";

function seedClient(input: {
  id: string;
  name: string;
  email: string;
  currency?: "USD" | "LKR" | "EUR" | "GBP" | "CAD";
}) {
  const now = new Date().toISOString();
  getDb()
    .insert(clients)
    .values({
      id: input.id,
      name: input.name,
      category: "Enterprise",
      contactPerson: input.name,
      email: input.email,
      currency: input.currency || "USD",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return { id: input.id, name: input.name };
}

const mockBadgeSet = vi.fn();
const mockKeychainAvailability = vi.fn(() => true);
const mockNotifications: Array<{ title: string; body: string }> = [];

vi.mock("electron", () => {
  class MockNotification {
    title: string;
    body: string;
    constructor(opts: { title: string; body: string }) {
      this.title = opts.title;
      this.body = opts.body;
    }
    on() {
      return this;
    }
    show() {
      mockNotifications.push({ title: this.title, body: this.body });
    }
    static isSupported() {
      return true;
    }
  }

  return {
    app: {
      setBadgeCount: (...args: unknown[]) => mockBadgeSet(...args),
      isPackaged: false,
      getPath: () => os.tmpdir(),
    },
    Notification: MockNotification,
    safeStorage: {
      isEncryptionAvailable: () => mockKeychainAvailability(),
      encryptString: (text: string) =>
        Buffer.from(`enc:${Buffer.from(text, "utf8").toString("base64")}`),
      decryptString: (buf: Buffer) => {
        const s = buf.toString("utf8");
        if (!s.startsWith("enc:")) throw new Error("bad keychain token");
        return Buffer.from(s.slice(4), "base64").toString("utf8");
      },
    },
    ipcMain: { handle: vi.fn(), on: vi.fn() },
    dialog: {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      showMessageBox: vi.fn(),
    },
    shell: { openPath: vi.fn(async () => ""), showItemInFolder: vi.fn() },
    clipboard: { writeText: vi.fn() },
  };
});

vi.mock("../pdf-generator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pdf-generator")>();
  return {
    ...actual,
    generateInvoiceHtmlPdfBuffer: vi.fn(async () => Buffer.from("%PDF-1.7-test")),
  };
});

describe("Section 6 high-impact features", () => {
  let dir: string;
  let pdfDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifications.length = 0;
    closeDatabaseForTesting();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-section6-"));
    pdfDir = path.join(dir, "pdfs");
    fs.mkdirSync(pdfDir, { recursive: true });
    initDatabase(path.join(dir, "billflow.db"));
    listProfilesState();
    updateSettings({ pdfExportDirectory: pdfDir });
  });

  afterEach(() => {
    closeDatabaseForTesting();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads encrypted backup status without opening the OS Keychain", () => {
    expect(getRollingBackupStatus().hasPassphrase).toBe(false);
    expect(mockKeychainAvailability).not.toHaveBeenCalled();

    setRollingBackupPassphrase("vault-passphrase-99");
    expect(mockKeychainAvailability).toHaveBeenCalledOnce();
    mockKeychainAvailability.mockClear();
    expect(getRollingBackupStatus().hasPassphrase).toBe(true);
    expect(mockKeychainAvailability).not.toHaveBeenCalled();
  });

  it("runs PRAGMA quick_check on healthy DB and blocks startup on corrupt SQLite file", () => {
    expect(getDatabaseHealth().quickCheckOk).toBe(true);
    closeDatabaseForTesting();

    const corruptPath = path.join(dir, "corrupt.db");
    const db = new Database(corruptPath);
    db.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, val TEXT);");
    db.exec("INSERT INTO sample (val) VALUES ('abc');");
    db.close();

    // Corrupt B-tree header bytes beyond header size to trigger quick_check failure
    const bytes = fs.readFileSync(corruptPath);
    bytes.fill(0xff, 128, Math.min(bytes.length, 4096));
    fs.writeFileSync(corruptPath, bytes);

    expect(() => initDatabase(corruptPath)).toThrow(/quick_check|not a database|malformed/i);
  });

  it("encrypts/decrypts AES-256-GCM backups, rejects wrong passphrases/tampering, and rotates rolling snapshots", () => {
    const client = seedClient({
      id: "cli-enc-1",
      name: "Encrypted Client",
      email: "sam@encrypted.test",
      currency: "USD",
    });

    const exported = exportWorkspace();
    const cipherBuf = encryptBackupPayload(exported, "correct-horse-battery");
    const decrypted = decryptBackupPayload(cipherBuf, "correct-horse-battery");
    expect(decrypted.clients).toHaveLength(1);

    // Wrong passphrase rejected
    expect(() => decryptBackupPayload(cipherBuf, "wrong-passphrase-123")).toThrow(
      /Incorrect backup passphrase/i,
    );

    // Tampered ciphertext rejected via GCM auth tag
    const parsedEnv = JSON.parse(cipherBuf.toString("utf8"));
    const ct = Buffer.from(parsedEnv.ciphertext, "base64");
    ct[0] = ct[0] ^ 0xff;
    parsedEnv.ciphertext = ct.toString("base64");
    expect(() =>
      decryptBackupPayload(
        Buffer.from(JSON.stringify(parsedEnv), "utf8"),
        "correct-horse-battery",
      ),
    ).toThrow(/Incorrect backup passphrase/i);

    // Symlink directory rejection
    const realBackupDir = path.join(dir, "rolling-backups");
    fs.mkdirSync(realBackupDir, { recursive: true });
    const symlinkBackupDir = path.join(dir, "rolling-symlink");
    fs.symlinkSync(realBackupDir, symlinkBackupDir);
    updateSettings({ rollingBackupDirectory: symlinkBackupDir });
    setRollingBackupPassphrase("vault-passphrase-99");
    expect(() => runRollingEncryptedBackup({ force: true })).toThrow(
      /symbolic link/i,
    );

    // Valid directory + retention pruning (keep 2 of 4)
    updateSettings({
      rollingBackupEnabled: true,
      rollingBackupDirectory: realBackupDir,
      rollingBackupRetention: 2,
    });
    for (let i = 0; i < 4; i++) {
      const res = runRollingEncryptedBackup({ force: true });
      expect(res.ran).toBe(true);
    }
    const retained = listRollingBackupFiles(realBackupDir);
    expect(retained).toHaveLength(2);
    expect(getRollingBackupStatus().backupCount).toBe(2);

    // Restore from retained encrypted file
    const backupFileBytes = fs.readFileSync(retained[0].filePath);
    const restoredPayload = decryptBackupPayload(
      backupFileBytes,
      "vault-passphrase-99",
    );
    resetWorkspace();
    expect(listClientsWithStats()).toHaveLength(0);
    importWorkspace(restoredPayload, "replace");
    expect(listClientsWithStats().map((c) => c.id)).toContain(client.id);
  });

  it("clamps month-end recurring dates cleanly and runs due retainers atomically without duplicates", async () => {
    expect(advanceScheduleDate("2026-01-31", "monthly", 31)).toBe("2026-02-28");
    expect(advanceScheduleDate("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(advanceScheduleDate("2026-03-31", "monthly", 31)).toBe("2026-04-30");
    // Leap year check
    expect(advanceScheduleDate("2024-01-31", "monthly", 31)).toBe("2024-02-29");
    expect(advanceSchedulePastDate("2026-01-31", "2026-03-15", "monthly", 31)).toBe(
      "2026-03-31",
    );

    const client = seedClient({
      id: "cli-ret-1",
      name: "Retainer Co",
      email: "maya@retainer.test",
      currency: "USD",
    });

    const activeRule = createRecurringRule({
      clientId: client.id,
      title: "Platform SRE Retainer",
      cadence: "monthly",
      dayOfMonth: 15,
      currency: "USD",
      items: [
        {
          description: "Monthly SRE Maintenance",
          quantity: 1,
          unitPriceCents: 150000,
        },
      ],
      amountCents: 150000,
      dueDays: 7,
      autoStatus: "UNPAID",
      autoExportPdf: true,
      nextRunDate: "2026-11-15",
    });

    const pausedRule = createRecurringRule({
      clientId: client.id,
      title: "Paused Advisory",
      cadence: "monthly",
      currency: "USD",
      items: [{ description: "Advisory", quantity: 1, unitPriceCents: 50000 }],
      amountCents: 50000,
      dueDays: 14,
      autoStatus: "DRAFT",
      autoExportPdf: false,
      nextRunDate: "2026-11-01",
    });
    toggleRecurringRule(pausedRule.id, false);

    // First run on 2026-11-19 creates 1 invoice for activeRule and skips pausedRule
    const firstRun = await runDueRecurringRules("2026-11-19", {
      notify: true,
      autoExport: true,
    });
    expect(firstRun.generated).toHaveLength(1);
    expect(firstRun.generated[0].ruleId).toBe(activeRule.id);
    expect(firstRun.generated[0].pdfPath).toBeTruthy();
    expect(fs.existsSync(firstRun.generated[0].pdfPath!)).toBe(true);
    expect(mockNotifications).toHaveLength(1);

    const updatedRule = listRecurringRules().find((r) => r.id === activeRule.id)!;
    expect(updatedRule.nextRunDate).toBe("2026-12-15");
    expect(updatedRule.lastInvoiceId).toBe(firstRun.generated[0].invoiceId);

    // Second run same day is idempotent: generates 0 duplicates
    const secondRun = await runDueRecurringRules("2026-11-19", {
      notify: true,
      autoExport: false,
    });
    expect(secondRun.generated).toHaveLength(0);

    // Manual runNow works on demand
    const manualRun = await generateInvoiceForRule(pausedRule.id, {
      today: "2026-11-19",
      autoExport: false,
    });
    expect(manualRun.invoice.amountCents).toBe(50000);
  });

  it("computes morning digest + Dock badge count and enforces daily dedup and lock privacy", () => {
    const client = seedClient({
      id: "cli-dig-1",
      name: "Overdue Client",
      email: "lin@overdue.test",
      currency: "USD",
    });

    const db = getDb();
    const nowIso = new Date().toISOString();

    // Seed an overdue invoice via quote conversion + backdated due date
    const q = createQuote({
      clientId: client.id,
      items: [{ description: "Sprint 1", quantity: 1, unitPriceCents: 120000 }],
      amountCents: 120000,
      currency: "USD",
      issueDate: "2026-11-01",
    });
    convertQuoteToInvoice({
      quoteId: q.id,
      status: "UNPAID",
      dueDate: "2026-11-10",
    });

    // Seed 1 task due today
    db.insert(tasks)
      .values({
        id: "task-digest-today",
        title: "Ship release build",
        description: "",
        status: "todo",
        priority: "high",
        category: "Development",
        assignee: {
          name: "Me",
          avatarLetter: "M",
          bgColor: "#000",
          textColor: "#fff",
        },
        dueDate: "2026-11-19",
        currency: "USD",
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .run();

    // Seed 1 vendor & upcoming payout within 7 days
    db.insert(vendors)
      .values({
        id: "vnd-digest-1",
        name: "QA Contractor",
        service: "QA",
      })
      .run();
    db.insert(workOrders)
      .values({
        id: "wo-digest-1",
        vendorId: "vnd-digest-1",
        scope: "Regression pass",
        feeCents: 35000,
        currency: "USD",
        payoutDueDate: "2026-11-23",
        status: "done",
      })
      .run();

    const digest = computeFinancialDigest("2026-11-19");
    expect(digest.overdueInvoicesCount).toBe(1);
    expect(digest.tasksDueTodayCount).toBe(1);
    expect(digest.upcomingPayoutsCount).toBe(1);
    expect(digest.badgeCount).toBe(1);
    expect(digest.body).toContain("1 overdue invoice");
    expect(digest.body).toContain("1 task due today");
    expect(digest.body).toContain("1 vendor payout due within 7 days");

    // Unlocked sync updates Dock badge to 1
    expect(syncAppBadgeCount({ today: "2026-11-19" })).toBe(1);
    expect(mockBadgeSet).toHaveBeenLastCalledWith(1);

    // First daily digest fires OS notification
    const sent1 = maybeSendDailyDigest({ today: "2026-11-19" });
    expect(sent1.sent).toBe(true);
    expect(mockNotifications).toHaveLength(1);

    // Second call same day deduplicates cleanly
    const sent2 = maybeSendDailyDigest({ today: "2026-11-19" });
    expect(sent2.sent).toBe(false);
    expect(sent2.reason).toBe("ALREADY_SENT");

    // Locked password workspace clears Dock badge to 0 and blocks notification leak
    const pwd = hashProfilePassword("998877");
    getDb()
      .update(userProfiles)
      .set({ passwordHash: pwd.hash, passwordSalt: pwd.salt })
      .where(eq(userProfiles.id, "default"))
      .run();
    lockProfileSession();
    expect(syncAppBadgeCount({ today: "2026-11-19" })).toBe(0);
    expect(mockBadgeSet).toHaveBeenLastCalledWith(0);
    expect(maybeSendDailyDigest({ today: "2026-11-19", force: true }).reason).toBe(
      "LOCKED",
    );
    unlockProfileSession("default");
  });

  it("isolates quotes from AR & analytics, renders PROPOSAL across all 5 templates, and converts in 1 click without double-conversion", () => {
    const client = seedClient({
      id: "cli-prop-1",
      name: "Proposal Corp",
      email: "dana@proposal.test",
      currency: "USD",
    });

    const quote = createQuote({
      clientId: client.id,
      title: "Cloud Migration Proposal",
      items: [
        {
          description: "Infrastructure Assessment",
          quantity: 2,
          unitPriceCents: 100000,
        },
      ],
      discountCents: 20000,
      taxCents: 0,
      advanceCents: 90000,
      amountCents: 180000,
      currency: "USD",
      issueDate: "2026-11-19",
      validUntil: "2026-12-03",
      status: "SENT",
    });

    expect(quote.code).toMatch(/^QT-\d{4}-001$/);
    expect(getNextQuoteCode()).toMatch(/^QT-\d{4}-002$/);

    // Quotes MUST NOT pollute AR, dashboard, or analytics before conversion
    expect(getDashboardSummary().totalBilledByCurrency).toEqual({});
    expect(getAnalyticsSummary("all", "USD").totalRevenueCents).toBe(0);

    // All 5 PDF templates render PROPOSAL + Quote No.: + Valid Until:
    const templates = [
      "geometric-teal",
      "executive-wave",
      "scarlet-modern",
      "apex-orange",
      "noir-crimson",
    ] as const;
    for (const tmpl of templates) {
      const { payload } = buildQuotePdfPayload(quote.id, tmpl);
      const html = buildInvoiceHtml(payload);
      expect(html).toContain("PROPOSAL");
      expect(html).toContain("Quote No.:");
      expect(html).toContain("Valid Until:");
      expect(html).not.toContain(">INVOICE<");
    }

    setQuoteStatus(quote.id, "APPROVED");

    // 1-click conversion creates billable invoice and locks quote
    const converted = convertQuoteToInvoice({
      quoteId: quote.id,
      status: "UNPAID",
      dueDate: "2026-12-01",
    });
    expect(converted.quote.status).toBe("CONVERTED");
    expect(converted.quote.convertedInvoiceId).toBe(converted.invoice.id);
    expect(converted.invoice.amountCents).toBe(180000);
    expect(converted.invoice.advanceCents).toBe(90000);
    expect(converted.invoice.items).toHaveLength(1);
    expect(getDashboardSummary().totalBilledByCurrency.USD).toBe(180000);

    // Double conversion is blocked
    expect(() =>
      convertQuoteToInvoice({ quoteId: quote.id, status: "UNPAID" }),
    ).toThrow(/already been converted/i);

    // Export/import v2 backup preserves recurring rules, quotes, and quote items
    createRecurringRule({
      clientId: client.id,
      title: "Support Retainer",
      cadence: "monthly",
      currency: "USD",
      items: [{ description: "SLA", quantity: 1, unitPriceCents: 25000 }],
      amountCents: 25000,
      dueDays: 14,
      nextRunDate: "2026-12-01",
    });
    const backup = exportWorkspace();
    resetWorkspace();
    expect(listQuotes()).toHaveLength(0);
    expect(listRecurringRules()).toHaveLength(0);
    importWorkspace(backup, "replace");
    expect(listQuotes()).toHaveLength(1);
    expect(listRecurringRules()).toHaveLength(1);
  });

  it("persists and restores the Elegant Sans workspace typeface while rejecting unknown values", () => {
    const updated = updateSettings({ typeface: "elegant-sans" });
    expect(updated.typeface).toBe("elegant-sans");
    expect(getOrCreateSettings().typeface).toBe("elegant-sans");

    const backup = exportWorkspace();
    updateSettings({ typeface: "inter" });
    expect(getOrCreateSettings().typeface).toBe("inter");

    importWorkspace(backup, "replace");
    expect(getOrCreateSettings().typeface).toBe("elegant-sans");

    expect(() =>
      updateSettings({ typeface: "unknown-font" as never }),
    ).toThrow();
  });
});
