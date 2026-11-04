import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { closeDatabaseForTesting, initDatabase } from "../db";

let directory: string;
beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-branch-upgrade-"));
});
afterEach(() => {
  closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("member branch database upgrades", () => {
  it.each(["main", "Nipun", "Binuka"])("upgrades %s databases without losing records or skipping either feature", branch => {
    const source = path.resolve("drizzle");
    const legacyFolder = path.join(directory, "drizzle");
    fs.cpSync(source, legacyFolder, { recursive: true });
    const journalPath = path.join(legacyFolder, "meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 8);
    if (branch !== "main") {
      const tag = branch === "Nipun" ? "0008_user_profiles" : "0008_calendar_events";
      journal.entries.push({ idx: 8, version: "6", when: 1791250000000, tag, breakpoints: true });
      if (branch === "Binuka") {
        fs.copyFileSync(path.join(source, "0009_calendar_events.sql"), path.join(legacyFolder, `${tag}.sql`));
      }
    }
    fs.writeFileSync(journalPath, JSON.stringify(journal));
    const databasePath = path.join(directory, "billflow.db");
    const legacy = new Database(databasePath);
    migrate(drizzle(legacy), { migrationsFolder: legacyFolder });
    legacy.prepare("INSERT INTO clients (id, name, contact_person, email) VALUES (?, ?, ?, ?)").run("client", "Website client", "Client", "client@example.com");
    if (branch === "Binuka") {
      legacy.exec("INSERT INTO calendar_events (id, title, start_date, client_id) VALUES ('event', 'Website review', '2026-11-10', 'client')");
    }
    if (branch === "Nipun") {
      legacy.exec("INSERT INTO user_profiles (id, name) VALUES ('default', 'Chethaka')");
    }
    legacy.close();

    for (let attempt = 0; attempt < 2; attempt++) {
      const { sqlite } = initDatabase(databasePath);
      expect(sqlite.prepare("SELECT name FROM clients WHERE id='client'").get()).toEqual({ name: "Website client" });
      expect(sqlite.prepare("SELECT COUNT(*) AS n FROM user_profiles").get()).toEqual({ n: branch === "Nipun" ? 1 : 0 });
      expect(sqlite.prepare("SELECT COUNT(*) AS n FROM calendar_events").get()).toEqual({ n: branch === "Binuka" ? 1 : 0 });
      expect(sqlite.pragma("foreign_key_check")).toEqual([]);
      closeDatabaseForTesting();
    }
  });
});
