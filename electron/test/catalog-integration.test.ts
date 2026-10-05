import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";
vi.mock("electron",()=>({app:undefined,ipcMain:{handle:vi.fn()},shell:{showItemInFolder:vi.fn()}}));
import {initDatabase,closeDatabaseForTesting,getDb} from "../db";
import {clients,invoices,catalogItems,vendors} from "../db/schema";
import {createCatalogItem,updateCatalogItem,removeCatalogItem,bulkImportCatalogItems,listCatalogItems} from "../ipc/catalog";
import {createInvoice} from "../ipc/invoices";
import {exportWorkspace,importWorkspace,resetWorkspace,updateSettings} from "../ipc/settings";
import {parseCatalogCsv} from "../../src/lib/catalog-import";
import {eq} from "drizzle-orm";
const item={title:"Website development",category:"Development" as const,sku:"WEB-01",price:"80000.25",currency:"LKR" as const,unit:"/ Project",description:"Website, including staging"};
let folder:string;let dbPath:string;
beforeEach(()=>{closeDatabaseForTesting();folder=fs.mkdtempSync(path.join(os.tmpdir(),"billflow-catalog-"));dbPath=path.join(folder,"billflow.db");});
afterEach(()=>{closeDatabaseForTesting();fs.rmSync(folder,{recursive:true,force:true});});
function start(){return initDatabase(dbPath);}
function legacy(kind:"main"|"Sandika") {
  const sql=new Database(dbPath);
  sql.exec("CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,hash text NOT NULL,created_at numeric)");
  const journal=JSON.parse(fs.readFileSync("drizzle/meta/_journal.json","utf8")).entries;
  for(const idx of kind==="main" ? [0,1,2] : [0,1,3]) {
    const entry=journal[idx];sql.exec(fs.readFileSync(`drizzle/${entry.tag}.sql`,"utf8"));
    sql.prepare("INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)").run("legacy",entry.when);
  }
  sql.prepare("INSERT INTO clients (id,name,contact_person,email,currency) VALUES ('existing-client','Existing client','Chethaka','existing@example.com','LKR')").run();
  sql.prepare("INSERT INTO invoices(id,code,client_id,amount_cents,currency,issue_date) VALUES ('existing-invoice','INV-EXISTING','existing-client',9000000,'LKR','2026-10-06')").run();
  return sql;
}
describe("Catalog integration and migrations",()=>{
  it("fresh profiles contain no invented business records",()=>{const {db}=start();for(const table of [clients,invoices,vendors,catalogItems])expect(db.select().from(table).all()).toHaveLength(0);});
  it("upgrades a populated main profile without losing clients, invoices or vendors",()=>{
    const sql=legacy("main");sql.exec("INSERT INTO vendors(id,name,service,balance_cents) VALUES ('existing-vendor','Developer','Website',3000000)");sql.close();
    const {db}=start();expect(db.select().from(clients).all()).toHaveLength(1);expect(db.select().from(invoices).all()[0].amountCents).toBe(9000000);expect(db.select().from(vendors).all()[0].balanceCents).toBe(3000000);
    closeDatabaseForTesting();expect(start().db.select().from(invoices).all()).toHaveLength(1);
  });
  it("upgrades the Sandika migration history, repairs skipped Vendors and preserves Catalog links",()=>{
    const sql=legacy("Sandika");sql.exec("INSERT INTO catalog_items(id,title,sku,price) VALUES ('legacy-catalog','Website','WEB-OLD','80000.25'); UPDATE invoices SET catalog_item_id='legacy-catalog'");sql.close();
    const {db,sqlite}=start();expect(listCatalogItems()[0].priceCents).toBe(8000025);expect(db.select().from(invoices).all()[0].catalogItemId).toBe("legacy-catalog");expect(db.select().from(vendors).all()).toHaveLength(0);expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });
  it("rejects invalid legacy prices before changing the database",()=>{
    const sql=legacy("Sandika");sql.exec("INSERT INTO catalog_items(id,title,sku,price) VALUES ('bad','Invalid','BAD','not money')");sql.close();expect(()=>start()).toThrow(/invalid price/);expect(()=>getDb()).toThrow(/writes are disabled/);
    const check=new Database(dbPath);expect(check.prepare("SELECT price FROM catalog_items WHERE id='bad'").get()).toEqual({price:"not money"});check.close();
  });
  it("missing migrations block business writes",()=>{expect(()=>initDatabase(dbPath,path.join(folder,"missing"))).toThrow(/upgrade failed/);expect(()=>getDb()).toThrow(/writes are disabled/);});
  it("persists cents, edits, and identical creation retries across restart",()=>{
    start();const input={...item,requestId:crypto.randomUUID()};const saved=createCatalogItem(input);expect(saved.priceCents).toBe(8000025);expect(createCatalogItem(input).id).toBe(saved.id);expect(()=>createCatalogItem({...input,price:"1.00"})).toThrow(/different details/);
    updateCatalogItem(saved.id,{price:"90000.75"});closeDatabaseForTesting();start();expect(listCatalogItems()).toHaveLength(1);expect(listCatalogItems()[0].price).toBe("90000.75");
  });
  it("rejects invalid money and rolls back an entire conflicting import",()=>{
    start();for(const price of ["-1","1.001","NaN","1e3","900719925474099100"])expect(()=>createCatalogItem({...item,price})).toThrow();
    createCatalogItem(item);expect(()=>bulkImportCatalogItems([{...item,sku:"NEW"},{...item,price:"1"}])).toThrow(/different details/);expect(listCatalogItems()).toHaveLength(1);
    expect(bulkImportCatalogItems([item]).count).toBe(0);expect(()=>bulkImportCatalogItems([item,item])).toThrow(/repeated SKUs/);
  });
  it("creates client and invoice atomically, retries once, and preserves customized invoice after Catalog edits/deletion",()=>{
    start();const catalog=createCatalogItem(item);const input={requestId:crypto.randomUUID(),newClient:{name:"Website client",email:"website@example.com",currency:"LKR" as const},catalogItemId:catalog.id,title:"Custom website scope",amountCents:7500000,currency:"LKR" as const,status:"UNPAID" as const};
    const saved=createInvoice(input);expect(createInvoice(input).id).toBe(saved.id);expect(getDb().select().from(clients).all()).toHaveLength(1);
    updateCatalogItem(catalog.id,{price:"1.00",title:"Different service"});removeCatalogItem(catalog.id);const issued=getDb().select().from(invoices).where(eq(invoices.id,saved.id)).get()!;expect(issued.amountCents).toBe(7500000);expect(issued.title).toBe("Custom website scope");expect(issued.catalogItemId).toBeNull();
  });
  it("a failed invoice creation does not leave a duplicate new client",()=>{
    start();const details={newClient:{name:"Client",email:"client@example.com",currency:"LKR" as const},amountCents:100,currency:"LKR" as const,code:"SAME"};createInvoice(details);
    expect(()=>createInvoice({...details,requestId:crypto.randomUUID()})).toThrow();expect(getDb().select().from(clients).all()).toHaveLength(1);
  });
  it("backs up Catalog, Vendors and source links, restores repeatedly and resets without reseeding",()=>{
    start();const catalog=createCatalogItem(item);const invoice=createInvoice({newClient:{name:"Client",email:"client@example.com",currency:"LKR"},catalogItemId:catalog.id,amountCents:8000025,currency:"LKR"});
    getDb().insert(vendors).values({id:"vendor",name:"Developer",service:"Website",linkedClientId:invoice.clientId,balanceCents:3000000}).run();updateSettings({businessName:"Chethaka",defaultTaxRate:12.5});
    const backup=exportWorkspace();resetWorkspace();expect(listCatalogItems()).toHaveLength(0);importWorkspace(backup);importWorkspace(backup);closeDatabaseForTesting();start();expect(listCatalogItems()).toHaveLength(1);expect(getDb().select().from(vendors).all()).toHaveLength(1);expect(getDb().select().from(invoices).all()[0].catalogItemId).toBe(catalog.id);
    resetWorkspace();closeDatabaseForTesting();start();expect(listCatalogItems()).toHaveLength(0);expect(exportWorkspace().settings.businessName).toBe("Chethaka");
  });
  it("failed restore rolls back settings and Catalog writes",()=>{
    start();createCatalogItem(item);updateSettings({businessName:"Original"});const backup=exportWorkspace();backup.settings.businessName="Changed";backup.catalogItems!.push({...backup.catalogItems![0] as object,id:"different-id"});
    expect(()=>importWorkspace(backup)).toThrow();expect(exportWorkspace().settings.businessName).toBe("Original");expect(listCatalogItems()).toHaveLength(1);
  });
  it("accepts reordered CSV headers, quoted commas/newlines and escapes; rejects malformed rows",()=>{
    const parsed=parseCatalogCsv('sku,title,description,price,category,currency\nWEB,"Website, build","Includes ""review""\nand staging",80000.25,Development,LKR');expect(parsed[0].title).toBe("Website, build");expect(parsed[0].description).toBe('Includes "review"\nand staging');expect(parsed[0].price).toBe("80000.25");
    expect(()=>parseCatalogCsv('title,category,sku,price\n"Unclosed,Development,WEB,1')).toThrow(/unclosed/);expect(()=>parseCatalogCsv('title,category,sku,price\nOne,Development,WEB')).toThrow(/columns/);
  });
});
