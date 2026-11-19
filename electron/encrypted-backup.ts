import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scryptSync,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { dialog, safeStorage } from "electron";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ipcMain } from "./security";
import { captureWorkspace } from "./workspace-session";
import { atomicWrite } from "./managed-files";
import {
  getActiveProfileId,
  getDatabaseHealth,
  getDatabasePath,
  getDb,
  getSqlite,
} from "./db";
import { settings } from "./db/schema";
import { exportWorkspace, importWorkspace } from "./backup";
import { getOrCreateSettings, updateSettings } from "./ipc/settings";
import { recordActivity } from "./workspace-activity";
import { formatError } from "./ipc/errors";
import { localDateKey } from "../src/lib/visual-metrics";
import { MAX_BACKUP_BYTES } from "../src/lib/backup-limits";
import type {
  ExportDataPayload,
  RollingBackupStatus,
} from "../src/types/settings";

const ENCRYPTED_FORMAT = "billflow-encrypted-backup" as const;
const ENCRYPTED_AAD = Buffer.from("billflow-encrypted-backup:v1", "utf8");
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 32 } as const;

let rollingFileSequence = 0;

export const backupPassphraseSchema = z
  .string()
  .min(8, "Use a passphrase of at least 8 characters.")
  .max(256, "Passphrase cannot exceed 256 characters.")
  .refine(
    (value) => value.trim().length > 0,
    "Passphrase cannot be blank or whitespace only.",
  );

const encryptedEnvelopeSchema = z
  .object({
    format: z.literal(ENCRYPTED_FORMAT),
    version: z.literal(1),
    compression: z.literal("gzip"),
    kdf: z.literal("scrypt"),
    kdfParams: z
      .object({
        N: z
          .number()
          .int()
          .refine((value) => value === 16384 || value === 65536),
        r: z.literal(8),
        p: z.literal(1),
        keyLen: z.literal(32),
      })
      .strict(),
    cipher: z.literal("aes-256-gcm"),
    salt: z.string().min(16),
    iv: z.string().min(12),
    authTag: z.string().min(16),
    ciphertext: z.string().min(1),
    createdAt: z.string().min(1),
  })
  .strict();

export function encryptBackupPayload(
  payload: ExportDataPayload,
  passphraseInput: string,
): Buffer {
  const passphrase = backupPassphraseSchema.parse(passphraseInput);
  const compressed = zlib.gzipSync(
    Buffer.from(JSON.stringify(payload), "utf8"),
  );
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, SCRYPT_PARAMS.keyLen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: 64 * 1024 * 1024,
  });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ENCRYPTED_AAD);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const envelope = {
    format: ENCRYPTED_FORMAT,
    version: 1 as const,
    compression: "gzip" as const,
    kdf: "scrypt" as const,
    kdfParams: { ...SCRYPT_PARAMS },
    cipher: "aes-256-gcm" as const,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    createdAt: new Date().toISOString(),
  };
  return Buffer.from(JSON.stringify(envelope), "utf8");
}

export function decryptBackupPayload(
  raw: Buffer,
  passphraseInput: string,
): ExportDataPayload {
  const passphrase = backupPassphraseSchema.parse(passphraseInput);
  if (!raw.length || raw.length > MAX_BACKUP_BYTES) {
    throw new Error("Encrypted backup exceeds the supported size limit.");
  }
  let parsedEnvelope: unknown;
  try {
    parsedEnvelope = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("Invalid encrypted backup file format.");
  }
  const envelope = encryptedEnvelopeSchema.parse(parsedEnvelope);
  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const authTag = Buffer.from(envelope.authTag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  if (salt.length < 16 || iv.length !== 12 || authTag.length !== 16) {
    throw new Error("Encrypted backup metadata is corrupted.");
  }

  let plaintextZip: Buffer;
  try {
    const key = scryptSync(passphrase, salt, envelope.kdfParams.keyLen, {
      N: envelope.kdfParams.N,
      r: envelope.kdfParams.r,
      p: envelope.kdfParams.p,
      maxmem: 128 * 1024 * 1024,
    });
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(ENCRYPTED_AAD);
    decipher.setAuthTag(authTag);
    plaintextZip = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  } catch {
    throw new Error(
      "Incorrect backup passphrase or corrupted encrypted backup file.",
    );
  }

  try {
    const uncompressed = zlib.gunzipSync(plaintextZip, {
      maxOutputLength: MAX_BACKUP_BYTES,
    });
    const data = JSON.parse(uncompressed.toString("utf8")) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid backup payload.");
    }
    return data as ExportDataPayload;
  } catch {
    throw new Error(
      "Incorrect backup passphrase or corrupted encrypted backup file.",
    );
  }
}

export function isSafeStorageAvailable(): boolean {
  try {
    return Boolean(
      safeStorage &&
      typeof safeStorage.isEncryptionAvailable === "function" &&
      safeStorage.isEncryptionAvailable(),
    );
  } catch {
    return false;
  }
}

function rollingKeyFilePath(): string {
  return `${getDatabasePath()}.rolling-backup.key`;
}

export function hasRollingBackupPassphrase(): boolean {
  const keyFile = rollingKeyFilePath();
  if (!fs.existsSync(keyFile)) return false;
  try {
    const stat = fs.lstatSync(keyFile);
    return !stat.isSymbolicLink() && stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

export function setRollingBackupPassphrase(passphraseInput: string): void {
  const passphrase = backupPassphraseSchema.parse(passphraseInput);
  if (!isSafeStorageAvailable()) {
    throw new Error(
      "OS keychain encryption is unavailable in this environment.",
    );
  }
  const protectedBytes = safeStorage.encryptString(passphrase);
  atomicWrite(rollingKeyFilePath(), protectedBytes.toString("base64"), 0o600);
}

export function clearRollingBackupPassphrase(): void {
  fs.rmSync(rollingKeyFilePath(), { force: true });
}

export function loadRollingBackupPassphrase(): string | null {
  const keyFile = rollingKeyFilePath();
  if (!fs.existsSync(keyFile) || !isSafeStorageAvailable()) return null;
  const stat = fs.lstatSync(keyFile);
  if (stat.isSymbolicLink() || !stat.isFile()) return null;
  const encoded = fs.readFileSync(keyFile, "utf8").trim();
  if (!encoded) return null;
  const value = safeStorage.decryptString(Buffer.from(encoded, "base64"));
  return value || null;
}

export function assertValidBackupDirectory(directory: string): string {
  if (!path.isAbsolute(directory)) {
    throw new Error("Choose an absolute encrypted backup folder.");
  }
  if (!fs.existsSync(directory)) {
    throw new Error(
      "Encrypted backup folder is missing. Choose another folder in Settings.",
    );
  }
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(
      "Encrypted backup folder must be a real directory, not a symbolic link.",
    );
  }
  fs.accessSync(directory, fs.constants.W_OK);
  return directory;
}

function rollingAutoFilePrefix(profileId: string): string {
  const safeProfile = profileId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `billflow-auto-${safeProfile}-`;
}

export function listRollingBackupFiles(
  directory: string,
  profileId = getActiveProfileId(),
): Array<{ filePath: string; fileName: string; mtimeMs: number }> {
  if (!fs.existsSync(directory)) return [];
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) return [];
  const prefix = rollingAutoFilePrefix(profileId);
  const files: Array<{ filePath: string; fileName: string; mtimeMs: number }> =
    [];
  for (const name of fs.readdirSync(directory)) {
    if (!name.startsWith(prefix) || !name.endsWith(".bfbackup")) continue;
    const filePath = path.join(directory, name);
    try {
      const entryStat = fs.lstatSync(filePath);
      if (entryStat.isSymbolicLink() || !entryStat.isFile()) continue;
      files.push({ filePath, fileName: name, mtimeMs: entryStat.mtimeMs });
    } catch {
      // Ignore entries disappearing concurrently
    }
  }
  files.sort((a, b) => b.fileName.localeCompare(a.fileName));
  return files;
}

export function getRollingBackupStatus(): RollingBackupStatus {
  const current = getOrCreateSettings();
  const health = getDatabaseHealth();
  const directory = current.rollingBackupDirectory ?? null;
  let backupCount = 0;
  if (directory) {
    try {
      backupCount = listRollingBackupFiles(directory).length;
    } catch {
      backupCount = 0;
    }
  }
  return {
    enabled: Boolean(current.rollingBackupEnabled),
    directory,
    retention: current.rollingBackupRetention ?? 10,
    intervalHours: current.rollingBackupIntervalHours ?? 24,
    lastRunAt: current.rollingBackupLastAt ?? null,
    hasPassphrase: hasRollingBackupPassphrase(),
    safeStorageAvailable: isSafeStorageAvailable(),
    backupCount,
    dbQuickCheckOk: health.quickCheckOk,
    dbCheckedAt: health.checkedAt,
  };
}

function formatAutoTimestamp(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const seq = String(++rollingFileSequence % 1000).padStart(3, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}-${ms}${seq}`;
}

export function runRollingEncryptedBackup(options?: {
  force?: boolean;
  passphraseOverride?: string;
}): {
  ran: boolean;
  reason?: string;
  filePath?: string;
  prunedCount?: number;
} {
  const current = getOrCreateSettings();
  const force = Boolean(options?.force);

  if (!force) {
    if (!current.rollingBackupEnabled) {
      return { ran: false, reason: "DISABLED" };
    }
    if (!current.rollingBackupDirectory) {
      return { ran: false, reason: "NO_DIRECTORY" };
    }
    const lastMs = current.rollingBackupLastAt
      ? Date.parse(current.rollingBackupLastAt)
      : NaN;
    const intervalMs = Math.max(1, current.rollingBackupIntervalHours ?? 24) * 3600_000;
    if (Number.isFinite(lastMs) && Date.now() - lastMs < intervalMs) {
      return { ran: false, reason: "NOT_DUE" };
    }
  }

  if (!current.rollingBackupDirectory) {
    throw new Error("Choose a rolling backup folder in Settings first.");
  }
  const directory = assertValidBackupDirectory(current.rollingBackupDirectory);
  const passphrase =
    options?.passphraseOverride || loadRollingBackupPassphrase();
  if (!passphrase) {
    if (!force) return { ran: false, reason: "NO_PASSPHRASE" };
    throw new Error(
      "Save a rolling backup passphrase before running an encrypted backup.",
    );
  }

  const profileId = getActiveProfileId();
  const now = new Date();
  const fileName = `${rollingAutoFilePrefix(profileId)}${formatAutoTimestamp(now)}.bfbackup`;
  const destination = path.join(directory, fileName);
  const payload = exportWorkspace();
  const encrypted = encryptBackupPayload(payload, passphrase);
  atomicWrite(destination, encrypted, 0o600);

  const retention = Math.max(1, Math.min(100, current.rollingBackupRetention ?? 10));
  const allFiles = listRollingBackupFiles(directory, profileId);
  let prunedCount = 0;
  for (const stale of allFiles.slice(retention)) {
    fs.rmSync(stale.filePath, { force: true });
    prunedCount++;
  }

  const nowIso = now.toISOString();
  getDb()
    .update(settings)
    .set({ rollingBackupLastAt: nowIso })
    .where(eq(settings.id, "default"))
    .run();

  const stateRow = getSqlite()
    .prepare("SELECT revision FROM workspace_backup_state WHERE id = 1")
    .get() as { revision: number } | undefined;
  if (stateRow) {
    getSqlite()
      .prepare(
        "UPDATE workspace_backup_state SET backup_revision = ?, last_backup_at = ? WHERE id = 1",
      )
      .run(stateRow.revision, nowIso);
  }

  recordActivity({
    kind: "backup-encrypted",
    recordId: fileName,
    label: "Encrypted Backup",
    detail: `Saved rolling encrypted backup ${fileName}`.slice(0, 500),
  });

  return { ran: true, filePath: destination, prunedCount };
}

interface EncryptedSelection {
  sender: Electron.WebContents;
  workspace: ReturnType<typeof captureWorkspace>;
  filePath: string;
  expires: number;
}
const encryptedSelections = new Map<string, EncryptedSelection>();
const observedEncryptedSenders = new WeakSet<Electron.WebContents>();

function expireEncryptedSelectionsOnNavigation(sender: Electron.WebContents) {
  if (observedEncryptedSenders.has(sender)) return;
  observedEncryptedSenders.add(sender);
  const revoke = () => {
    for (const [token, entry] of encryptedSelections) {
      if (entry.sender === sender) encryptedSelections.delete(token);
    }
  };
  sender.on("did-start-navigation", (event) => {
    if (event.isMainFrame) revoke();
  });
  sender.once("destroyed", revoke);
}

function readEncryptedFileBytes(filePath: string): Buffer {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("Encrypted backup must be a regular .bfbackup file.");
  }
  if (stat.size <= 0 || stat.size > MAX_BACKUP_BYTES) {
    throw new Error("Encrypted backup must be smaller than 150 MB.");
  }
  return fs.readFileSync(filePath);
}

function resolveEncryptedSelection(
  sender: Electron.WebContents,
  tokenInput: string,
): EncryptedSelection {
  const token = z.string().uuid().parse(tokenInput);
  const entry = encryptedSelections.get(token);
  if (!entry || entry.sender !== sender || entry.expires < Date.now()) {
    throw new Error("Choose the encrypted backup file again before continuing.");
  }
  entry.workspace.assertCurrent();
  return entry;
}

const configureRollingBackupSchema = z.object({
  enabled: z.boolean().optional(),
  directory: z
    .string()
    .max(4096)
    .refine((value) => path.isAbsolute(value), "Choose an absolute folder")
    .nullable()
    .optional(),
  retention: z.number().int().min(1).max(100).optional(),
  intervalHours: z.number().int().min(1).max(720).optional(),
  passphrase: backupPassphraseSchema.optional(),
  clearPassphrase: z.boolean().optional(),
});

export function registerEncryptedBackupHandlers(
  broadcastDataChanged: () => void,
) {
  ipcMain.handle(
    "settings:saveEncryptedBackup",
    async (_event, passphrase: string) => {
      try {
        const parsedPassphrase = backupPassphraseSchema.parse(passphrase);
        const workspace = captureWorkspace();
        const result = await dialog.showSaveDialog({
          title: "Save Encrypted Workspace Backup",
          defaultPath: `billflow-backup-${localDateKey()}.bfbackup`,
          filters: [
            { name: "BillFlow Encrypted Backup", extensions: ["bfbackup"] },
          ],
        });
        workspace.assertCurrent();
        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true };
        }
        const payload = exportWorkspace();
        const encrypted = encryptBackupPayload(payload, parsedPassphrase);
        atomicWrite(result.filePath, encrypted, 0o600);
        const stateRow = getSqlite()
          .prepare("SELECT revision FROM workspace_backup_state WHERE id = 1")
          .get() as { revision: number } | undefined;
        if (stateRow) {
          getSqlite()
            .prepare(
              "UPDATE workspace_backup_state SET backup_revision = ?, last_backup_at = ? WHERE id = 1",
            )
            .run(stateRow.revision, new Date().toISOString());
        }
        broadcastDataChanged();
        return { success: true, filePath: result.filePath };
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("settings:chooseRollingBackupDirectory", async () => {
    try {
      const workspace = captureWorkspace();
      const result = await dialog.showOpenDialog({
        title: "Choose Rolling Encrypted Backup Folder",
        properties: ["openDirectory", "createDirectory"],
      });
      workspace.assertCurrent();
      if (result.canceled || !result.filePaths[0]) return null;
      return assertValidBackupDirectory(result.filePaths[0]);
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("settings:getRollingBackupStatus", () => {
    try {
      return getRollingBackupStatus();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "settings:configureRollingBackup",
    (_event, input: unknown) => {
      try {
        const parsed = configureRollingBackupSchema.parse(input);
        if (parsed.directory) {
          assertValidBackupDirectory(parsed.directory);
        }
        if (parsed.clearPassphrase) {
          clearRollingBackupPassphrase();
        }
        if (parsed.passphrase) {
          setRollingBackupPassphrase(parsed.passphrase);
        }
        const patch: Record<string, unknown> = {};
        if (parsed.enabled !== undefined)
          patch.rollingBackupEnabled = parsed.enabled;
        if (parsed.directory !== undefined)
          patch.rollingBackupDirectory = parsed.directory;
        if (parsed.retention !== undefined)
          patch.rollingBackupRetention = parsed.retention;
        if (parsed.intervalHours !== undefined)
          patch.rollingBackupIntervalHours = parsed.intervalHours;
        if (Object.keys(patch).length > 0) {
          updateSettings(patch);
        }
        broadcastDataChanged();
        return getRollingBackupStatus();
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "settings:runRollingBackupNow",
    (_event, passphraseOverride?: string) => {
      try {
        const parsedPassphrase = passphraseOverride
          ? backupPassphraseSchema.parse(passphraseOverride)
          : undefined;
        const result = runRollingEncryptedBackup({
          force: true,
          passphraseOverride: parsedPassphrase,
        });
        broadcastDataChanged();
        return { ...result, status: getRollingBackupStatus() };
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("settings:chooseEncryptedBackupFile", async (event) => {
    try {
      const workspace = captureWorkspace();
      expireEncryptedSelectionsOnNavigation(event.sender);
      const result = await dialog.showOpenDialog({
        title: "Choose Encrypted BillFlow Backup",
        properties: ["openFile"],
        filters: [
          { name: "BillFlow Encrypted Backup", extensions: ["bfbackup"] },
        ],
      });
      workspace.assertCurrent();
      const filePath = result.filePaths[0];
      if (result.canceled || !filePath) {
        return { canceled: true as const };
      }
      readEncryptedFileBytes(filePath);
      for (const [key, entry] of encryptedSelections) {
        if (entry.expires < Date.now()) encryptedSelections.delete(key);
      }
      if (encryptedSelections.size >= 8) {
        encryptedSelections.delete(encryptedSelections.keys().next().value!);
      }
      const token = randomUUID();
      encryptedSelections.set(token, {
        sender: event.sender,
        workspace,
        filePath,
        expires: Date.now() + 10 * 60 * 1000,
      });
      const stat = fs.statSync(filePath);
      return {
        canceled: false as const,
        token,
        fileName: path.basename(filePath),
        fileSize: stat.size,
      };
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "settings:preflightEncryptedBackup",
    (
      event,
      token: string,
      passphrase: string,
      mode?: "replace" | "merge",
    ) => {
      try {
        const parsedMode = z.enum(["replace", "merge"]).parse(mode || "replace");
        const selection = resolveEncryptedSelection(event.sender, token);
        const bytes = readEncryptedFileBytes(selection.filePath);
        const payload = decryptBackupPayload(bytes, passphrase);
        const preview = importWorkspace(payload, parsedMode, true);
        return {
          ...preview,
          exportedAt: String(payload.exportedAt || ""),
          receiptsCount: Array.isArray(payload.files)
            ? payload.files.length
            : 0,
        };
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "settings:restoreEncryptedBackup",
    (
      event,
      token: string,
      passphrase: string,
      mode?: "replace" | "merge",
    ) => {
      try {
        const parsedMode = z.enum(["replace", "merge"]).parse(mode || "replace");
        const parsedToken = z.string().uuid().parse(token);
        const selection = resolveEncryptedSelection(event.sender, parsedToken);
        const bytes = readEncryptedFileBytes(selection.filePath);
        const payload = decryptBackupPayload(bytes, passphrase);
        const res = importWorkspace(payload, parsedMode);
        encryptedSelections.delete(parsedToken);
        broadcastDataChanged();
        return res;
      } catch (err) {
        throw formatError(err);
      }
    },
  );
}
