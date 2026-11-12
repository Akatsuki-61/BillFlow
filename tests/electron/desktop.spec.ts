import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

function listAsarEntries(archivePath: string): string[] {
  const fd = fs.openSync(archivePath, "r");
  try {
    const preHeader = Buffer.alloc(16);
    fs.readSync(fd, preHeader, 0, 16, 0);
    const jsonSize = preHeader.readUInt32LE(12);
    const jsonBuffer = Buffer.alloc(jsonSize);
    fs.readSync(fd, jsonBuffer, 0, jsonSize, 16);
    const header = JSON.parse(jsonBuffer.toString("utf8")) as {
      files?: Record<string, unknown>;
    };
    const entries: string[] = [];
    const walk = (node: { files?: Record<string, unknown> }, prefix = "") => {
      if (!node.files) return;
      for (const [name, child] of Object.entries(node.files)) {
        const current = `${prefix}/${name}`;
        entries.push(current);
        if (child && typeof child === "object" && "files" in child) {
          walk(child as { files?: Record<string, unknown> }, current);
        }
      }
    };
    walk(header);
    return entries;
  } finally {
    fs.closeSync(fd);
  }
}

let app: ElectronApplication, page: Page, directory: string;
test.describe.configure({ mode: "serial" });
const executable =
  process.env.BILLFLOW_APP_PATH ||
  path.resolve(
    "release/preview-0.2.0/mac-arm64/BillFlow.app/Contents/MacOS/BillFlow",
  );
async function launch() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== "ELECTRON_RUN_AS_NODE" && value !== undefined,
    ),
  ) as Record<string, string>;
  app = await electron.launch({
    executablePath: executable,
    env: {
      ...env,
      BILLFLOW_USER_DATA: directory,
      BILLFLOW_VERIFY_HIDDEN: "1",
      BILLFLOW_DISABLE_NATIVE_CALENDAR: "1",
    },
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.billflow?.profiles));
}
test.beforeAll(async () => {
  if (!fs.existsSync(executable))
    throw new Error(
      "Build the local test app first, or set BILLFLOW_APP_PATH to its executable.",
    );
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-desktop-e2e-"));
  await launch();
});
test.afterAll(async () => {
  await app?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
test("installed app preserves both billing loops, offline PDFs, profiles and backups", async () => {
  await page.evaluate(async () => {
    await window.billflow!.profiles.completeOnboarding({
      studioName: "Desktop Test Studio",
      defaultCurrency: "USD",
      profiles: [
        {
          name: "Engineering",
          role: "software-engineering",
          subtitle: "Development",
          avatar: "code",
          accent: "blue",
          defaultCurrency: "USD",
          invoicePrefix: "TEST-",
          password: "1234",
          seedRoleCatalog: false,
        },
      ],
    });
  });
  // Setup uses the real IPC API; reload so the onboarding form's local UI state resets.
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await page.evaluate(
    async (destination) =>
      window.billflow!.settings.update({ pdfExportDirectory: destination }),
    directory,
  );
  const client = await page.evaluate(() =>
    window.billflow!.clients.create({
      name: "Desktop Client",
      email: "client@example.invalid",
      currency: "USD",
    }),
  );
  await page.evaluate(() =>
    window.billflow!.catalog.create({
      title: "Desktop Service",
      category: "Development",
      sku: "DESKTOP-SERVICE",
      price: "100.00",
      currency: "USD",
      unit: "project",
    }),
  );
  await page.getByRole("link", { name: "Catalog", exact: true }).click();
  await expect(
    page.getByText("Desktop Service", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "New Task", exact: true }).click();
  await page
    .getByPlaceholder("e.g. Production Database Migration")
    .fill("Task-first delivery");
  await page.getByRole("button", { name: "Create Deliverable" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.billflow!.tasks.list().then((rows) => rows.length),
      ),
    )
    .toBe(1);
  const taskInvoice = await page.evaluate(async (clientId) => {
    const task = (await window.billflow!.tasks.list())[0];
    await window.billflow!.tasks.update(task.id, {
      status: "done",
      clientId,
      currency: "USD",
    });
    return window.billflow!.invoices.create({
      clientId,
      code: "TASK-001",
      currency: "USD",
      amountCents: 10000,
      items: [
        {
          description: task.title,
          quantity: 1,
          unitPriceCents: 10000,
          sourceTaskId: task.id,
        },
      ],
    });
  }, client.id);
  expect(taskInvoice.items).toHaveLength(1);
  const invoice = await page.evaluate(
    async (clientId) =>
      window.billflow!.invoices.create({
        clientId,
        code: "DIRECT-001",
        currency: "USD",
        amountCents: 100000,
        advanceCents: 50000,
        items: [
          { description: "Website", quantity: 1, unitPriceCents: 80000 },
          { description: "Consulting", quantity: 1, unitPriceCents: 20000 },
        ],
      }),
    client.id,
  );
  const profit = await page.evaluate(async (invoiceId) => {
    const advance = await window.billflow!.invoices.recordPayment({
      invoiceId,
      amountCents: 50000,
    });
    const tracked = await window.billflow!.tracking.decide(invoiceId, "yes");
    await window.billflow!.tasks.update(tracked.taskIds[0], {
      status: "in-progress",
    });
    const vendor = await window.billflow!.vendors.create({
      name: "Desktop Contractor",
      service: "Development",
    });
    const order = await window.billflow!.workOrders.create({
      vendorId: vendor.id,
      taskId: tracked.taskIds[0],
      invoiceId,
      scope: "Frontend delivery",
      feeCents: 30000,
      currency: "USD",
    });
    await window.billflow!.workOrders.review({
      workOrderId: order.id,
      status: "done",
      updateTask: true,
      deliveryUrl: "https://example.invalid/delivery",
    });
    await window.billflow!.workOrders.recordPayout({
      workOrderId: order.id,
      amountCents: 25000,
    });
    await window.billflow!.invoices.recordPayment({
      invoiceId,
      amountCents: 50000,
    });
    const task = (await window.billflow!.tasks.list()).find(
      (row) => row.id === tracked.taskIds[0],
    )!;
    return {
      task,
      paymentId: advance.payment.id,
      summary: await window.billflow!.analytics.summary("all", "USD"),
    };
  }, invoice.id);
  expect(profit.task.activeSince).toBeNull();
  expect(profit.summary.netProfitCents).toBe(85000);
  const receipt = path.join(directory, "receipt.png");
  fs.writeFileSync(
    receipt,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  await app.evaluate(({ dialog }, selected) => {
    Object.assign(dialog, {
      showOpenDialog: async () => ({ canceled: false, filePaths: [selected] }),
    });
  }, receipt);
  await page.evaluate(async (paymentId) => {
    const selection = await window.billflow!.attachments.chooseFile!();
    if (!selection) throw new Error("Expected picker selection");
    await window.billflow!.attachments.select(
      { type: "payment", id: paymentId },
      "desktop-receipt",
      selection.path,
    );
  }, profit.paymentId);
  fs.rmSync(receipt);
  const pdf = await page.evaluate(
    (id) => window.billflow!.invoices.exportPdf(id),
    invoice.id,
  );
  expect(fs.readFileSync(pdf.filePath).subarray(0, 5).toString()).toBe("%PDF-");
  expect(
    (await PDFDocument.load(fs.readFileSync(pdf.filePath))).getPageCount(),
  ).toBeGreaterThan(0);
  // Network requests are blocked in the packaged app; PDF fonts are bundled.
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => /^https?:/.test(entry.name)),
    ),
  ).toBe(false);
  const backup = await page.evaluate(() => window.billflow!.settings.export());
  expect(backup.records!.invoices).toHaveLength(2);
  expect(backup.files).toHaveLength(1);
  const second = await page.evaluate(async () => {
    const result = await window.billflow!.profiles.create({
      name: "Consulting",
      role: "consulting",
      seedRoleCatalog: false,
    });
    const profile = result.profiles.find((p) => p.id !== "default")!;
    await window.billflow!.profiles.switch(profile.id);
    return profile;
  });
  expect(
    await page.evaluate(() => window.billflow!.invoices.list()),
  ).toHaveLength(0);
  await page.evaluate((data) => window.billflow!.settings.import(data), backup);
  expect(
    await page.evaluate(() => window.billflow!.invoices.list()),
  ).toHaveLength(2);
  expect(
    await page.evaluate(
      (paymentId) =>
        window
          .billflow!.attachments.list({ type: "payment", id: paymentId })
          .then((rows) => rows.length),
      profit.paymentId,
    ),
  ).toBe(1);
  await page.evaluate(() =>
    window.billflow!.profiles.switch("default", "1234"),
  );
  await page.evaluate(() => window.billflow!.profiles.lock());
  expect(
    await page.evaluate(() =>
      window.billflow!.settings.export().then(
        () => false,
        () => true,
      ),
    ),
  ).toBe(true);
  await app.close();
  await launch();
  expect(
    (await page.evaluate(() => window.billflow!.profiles.list())).isLocked,
  ).toBe(true);
  await page.evaluate(() =>
    window.billflow!.profiles.switch("default", "1234"),
  );
  expect(
    await page.evaluate(() => window.billflow!.invoices.list()),
  ).toHaveLength(2);
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  expect(second.id).not.toBe("default");
});
test("installed bridge rejects a foreign window and hostile navigation", async () => {
  await app.evaluate(({ shell }) =>
    Object.assign(shell, { openExternal: async () => {} }),
  );
  const message = await app.evaluate(async ({ BrowserWindow }) => {
    const foreign = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    });
    try {
      await foreign.loadURL("data:text/html,<h1>Foreign fixture</h1>");
      return await foreign.webContents.executeJavaScript(
        'require("electron").ipcRenderer.invoke("settings:export").then(()=>"ALLOWED",error=>error.message)',
      );
    } finally {
      foreign.destroy();
    }
  });
  expect(message).toContain("UNTRUSTED_SENDER");
  await page.evaluate(() => {
    location.href = "https://example.invalid/localhost:3000";
  });
  await expect
    .poll(() => page.evaluate(() => location.href))
    .toMatch(/^app:\/\/billflow/);
  expect(
    await page.evaluate(() =>
      window.billflow!.invoices.list().then((rows) => rows.length),
    ),
  ).toBe(2);
});

test("installed payload contains only the desktop runtime and target native binary", async () => {
  const runtime = await app.evaluate(() => ({
    resources: process.resourcesPath,
    platform: process.platform,
    arch: process.arch,
  }));
  const archive = path.join(runtime.resources, "app.asar");
  const files = listAsarEntries(archive);
  expect([...new Set(files.map((file) => file.split("/")[1]))].sort()).toEqual([
    "dist-electron",
    "node_modules",
    "out",
    "package.json",
  ]);
  expect(files.filter((file) => file.endsWith(".node"))).toEqual([
    `/node_modules/better-sqlite3/prebuilds/${runtime.platform}-${runtime.arch}.node`,
  ]);
  expect(
    files.some((file) =>
      /^\/node_modules\/(next|@next|echarts|lucide-react|sharp|@img|node-addon-api)(\/|$)/.test(
        file,
      ),
    ),
  ).toBe(false);
  expect(files.some((file) => /\.(map|db|db-wal|db-shm)$/.test(file))).toBe(
    false,
  );
  expect(files).toContain("/out/fonts/nunito.woff2");
  expect(files).toContain("/dist-electron/preload.js");
  expect(
    fs.existsSync(
      path.join(runtime.resources, "drizzle/0010_workspace_integrity.sql"),
    ),
  ).toBe(true);
  expect(
    fs.existsSync(path.join(runtime.resources, "THIRD_PARTY_NOTICES.txt")),
  ).toBe(true);
});
