import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { closeDatabaseForTesting, initDatabase, migrateDatabase } from "../db";

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

it("preserves linked work orders, payouts, receipts and export paths when adding standalone payables", () => {
  const legacyFolder = path.join(directory, "drizzle");
  fs.cpSync(path.resolve("drizzle"), legacyFolder, { recursive: true });
  const journalPath = path.join(legacyFolder, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.filter(
    (entry: { idx: number }) => entry.idx <= 11,
  );
  fs.writeFileSync(journalPath, JSON.stringify(journal));

  const databasePath = path.join(directory, "billflow.db");
  const oldDb = new Database(databasePath);
  oldDb.pragma("foreign_keys = ON");
  migrateDatabase(oldDb, legacyFolder);
  oldDb.exec(`
    INSERT INTO clients (id,name,contact_person,email) VALUES ('c','Client','Test','test@example.invalid');
    INSERT INTO invoices (id,code,client_id,amount_cents,currency,issue_date)
      VALUES ('i','LEGACY-1','c',8000,'USD','2026-11-15');
    INSERT INTO tasks (id,invoice_id,client_id,title,assignee,currency,created_at,updated_at)
      VALUES ('t','i','c','Delivery','{}','USD','2026-11-15','2026-11-15');
    INSERT INTO vendors (id,name,service) VALUES ('v','Supplier','Studio services');
    INSERT INTO work_orders (id,vendor_id,task_id,invoice_id,scope,fee_cents,currency)
      VALUES ('w','v','t','i','Delivery',4000,'USD');
    INSERT INTO vendor_payouts (id,work_order_id,amount_cents,currency,paid_at,request_id)
      VALUES ('p','w',1000,'USD','2026-11-15','legacy-payout');
    INSERT INTO attachments (id,payout_id,original_name,stored_name,mime_type,size_bytes,sha256,created_at)
      VALUES ('a','p','slip.pdf','slip.pdf','application/pdf',100,'legacy-fixture','2026-11-15');
    INSERT INTO work_order_pdf_exports VALUES ('w','/tmp/legacy.pdf','2026-11-15');
  `);
  oldDb.close();

  const { sqlite } = initDatabase(databasePath);
  expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  expect(
    sqlite
      .prepare(
        `SELECT v.vendor_id, v.task_id, v.invoice_id, p.amount_cents, a.original_name, pdf.file_path
     FROM work_orders v JOIN vendor_payouts p ON p.work_order_id = v.id
     JOIN attachments a ON a.payout_id = p.id JOIN work_order_pdf_exports pdf ON pdf.work_order_id = v.id`,
      )
      .get(),
  ).toEqual({
    vendor_id: "v",
    task_id: "t",
    invoice_id: "i",
    amount_cents: 1000,
    original_name: "slip.pdf",
    file_path: "/tmp/legacy.pdf",
  });
});
