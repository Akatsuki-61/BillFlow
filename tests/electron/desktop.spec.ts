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
const executable = process.env.BILLFLOW_APP_PATH!;
async function launch() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== "ELECTRON_RUN_AS_NODE" && value !== undefined,
    ),
  ) as Record<string, string>;
  app = await electron.launch({
    executablePath: executable,
    // Keep isolated macOS test builds out of the user's login Keychain.
    args: process.platform === "darwin" ? ["--use-mock-keychain"] : [],
    env: {
      ...env,
      BILLFLOW_USER_DATA: directory,
      BILLFLOW_VERIFY_HIDDEN: "1",
      BILLFLOW_DISABLE_NATIVE_CALENDAR: "1",
      BILLFLOW_DISABLE_RATE_FETCH: "1",
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
  fs.writeFileSync(
    path.join(directory, "exchange-rates.json"),
    JSON.stringify({
      base: "USD",
      rates: { USD: 1, LKR: 300, EUR: 0.9, GBP: 0.75, CAD: 1.4 },
      provider: "ExchangeRate-API",
      updatedAt: new Date().toISOString(),
      nextUpdateAt: new Date(Date.now() + 86400000).toISOString(),
      fetchedAt: new Date().toISOString(),
    }),
  );
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

test("workspace operations connect search, alerts, ledgers, forecast, PDFs and backups", async ({}, testInfo) => {
  const fixtures = await page.evaluate(async (pdfExportDirectory) => {
    const api = window.billflow!;
    const created = await api.profiles.create({
      name: "Operations QA",
      role: "consulting",
      seedRoleCatalog: false,
    });
    const profile = created.profiles.find(
      (item) => item.name === "Operations QA",
    )!;
    await api.profiles.switch(profile.id);
    await api.settings.update({ pdfExportDirectory });
    const today = new Intl.DateTimeFormat("sv-SE").format(new Date());
    const client = await api.clients.create({
      name: "Statement Client & Partners",
      email: "statement@example.invalid",
      currency: "USD",
    });
    const invoice = await api.invoices.create({
      clientId: client.id,
      code: "OPS-USD",
      title: "Quarterly assessment",
      amountCents: 12345,
      currency: "USD",
      dueDate: today,
    });
    const second = await api.invoices.create({
      clientId: client.id,
      code: "OPS-EUR",
      title: "Service assessment",
      amountCents: 5000,
      currency: "EUR",
      dueDate: today,
    });
    const task = await api.tasks.create({
      id: crypto.randomUUID(),
      clientId: client.id,
      title: "Deadline review",
      dueDate: today,
      currency: "USD",
      description: "Review the assessment",
      status: "todo",
      priority: "high",
      category: "Development",
      subtasks: [],
      assignee: {
        name: "QA",
        avatarLetter: "Q",
        bgColor: "blue",
        textColor: "white",
      },
    });
    const vendor = await api.vendors.create({
      name: "Statement Vendor",
      service: "Consulting",
    });
    const order = await api.workOrders.create({
      vendorId: vendor.id,
      taskId: task.id,
      invoiceId: invoice.id,
      scope: "Deliver assessment",
      feeCents: 8000,
      currency: "USD",
      payoutDueDate: today,
    });
    const { payment } = await api.invoices.recordPayment({
      invoiceId: invoice.id,
      amountCents: 12345,
    });
    const corrected = await api.invoices.correctPayment({
      invoiceId: invoice.id,
      paymentId: payment.id,
      reason: "Transfer amount corrected",
      replacement: {
        amountCents: 2345,
        receivedAt: today,
        reference: "BANK-1",
      },
    });
    await api.workOrders.recordPayout({
      workOrderId: order.id,
      amountCents: 2000,
      paidAt: today,
    });
    const partial = await api.workOrders.recordPayout({
      workOrderId: order.id,
      amountCents: 3000,
      paidAt: today,
    });
    await api.expenses.create({
      merchant: "QA Expense",
      category: "SOFTWARE",
      amountCents: 300,
      currency: "USD",
      incurredAt: today,
    });
    await api.catalog.create({
      title: "QA Catalog",
      sku: "QA-TEST",
      category: "Design",
      price: "10.00",
    });
    return { client, invoice, second, task, vendor, order: partial, corrected };
  }, directory);
  expect(fixtures.corrected.paidCents).toBe(2345);
  expect(fixtures.order.remainingPayoutCents).toBe(3000);
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();

  const search = async (query: string) => {
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox", {
      name: "Search workspace records and actions",
    });
    await input.fill(query);
    return input;
  };
  const catalog = await search("QA Catalog");
  await expect(page.getByRole("option", { name: /QA Catalog/ })).toBeVisible();
  await catalog.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Edit Catalog Item" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  const expenses = await search("QA Expense");
  await expenses.press("Enter");
  await expect(page.getByText("Showing selected expense")).toBeVisible();

  const shortcut = await search("");
  await shortcut.press("Alt+3");
  await expect(
    page.getByRole("heading", { name: "Create New Deliverable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Workspace notifications" }).click();
  await expect(page.getByText("Task due today")).toBeVisible();
  await page
    .getByRole("link", { name: /Statement Vendor.*Deadline review/ })
    .click();
  await expect(page.getByText("$30.00 remaining")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cashflow forecast" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Next 30 days by currency" })
      .getByRole("row", { name: /USD.*155\.56.*30\.00/ }),
  ).toBeVisible();

  const exportDir = path.join(directory, "exports");
  fs.mkdirSync(exportDir);
  fs.writeFileSync(
    path.join(exportDir, "Invoice-OPS-USD.pdf"),
    "existing file",
  );
  await app.evaluate(({ dialog }, folder) => {
    Object.assign(dialog, {
      showOpenDialog: async () => ({ canceled: false, filePaths: [folder] }),
    });
  }, exportDir);
  const exported = await page.evaluate(
    (ids) => window.billflow!.invoices.exportBatch(ids),
    [fixtures.invoice.id, fixtures.second.id],
  );
  expect(exported.filePaths).toHaveLength(2);
  expect(
    fs.readFileSync(path.join(exportDir, "Invoice-OPS-USD.pdf"), "utf8"),
  ).toBe("existing file");
  for (const filePath of exported.filePaths)
    expect(
      (await PDFDocument.load(fs.readFileSync(filePath))).getPageCount(),
    ).toBeGreaterThan(0);
  await app.evaluate(({ clipboard }) => {
    let text = "";
    Object.assign(clipboard, {
      writeText: (value: string) => {
        text = value;
      },
      readText: () => text,
    });
  });
  const prepared = await page.evaluate(
    (id) => window.billflow!.invoices.prepareShare(id),
    fixtures.invoice.id,
  );
  expect(fs.existsSync(prepared.filePath)).toBe(true);
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain(
    "OPS-USD",
  );

  const saveTo = (destination: string) =>
    app.evaluate(({ dialog }, filePath) => {
      Object.assign(dialog, {
        showSaveDialog: async () => ({ canceled: false, filePath }),
      });
    }, destination);
  const statementPaths = [
    path.join(exportDir, "client.pdf"),
    path.join(exportDir, "vendor.pdf"),
  ];
  await saveTo(statementPaths[0]);
  await search("Statement Client");
  await page
    .getByRole("option", {
      name: "Statement Client & Partners Client",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Export Statement PDF" }).click();
  await expect.poll(() => fs.existsSync(statementPaths[0])).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await saveTo(statementPaths[1]);
  await search("Statement Vendor");
  await page
    .getByRole("option", { name: "Statement Vendor Vendor", exact: true })
    .click();
  await page.getByRole("button", { name: "Export Statement PDF" }).click();
  await expect.poll(() => fs.existsSync(statementPaths[1])).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  for (const [index, filePath] of statementPaths.entries()) {
    expect(
      (await PDFDocument.load(fs.readFileSync(filePath))).getPageCount(),
    ).toBeGreaterThan(0);
    await testInfo.attach(index ? "vendor-statement" : "client-statement", {
      path: filePath,
      contentType: "application/pdf",
    });
  }

  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select invoice OPS-EUR" }).check();
  await page
    .getByRole("button", { name: "Move to Trash", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move to Trash", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Select invoice OPS-EUR" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Trash is empty.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select invoice OPS-EUR" }),
  ).toBeVisible();

  const backupPath = path.join(exportDir, "backup.json");
  await saveTo(backupPath);
  const settings = await search("backup restore");
  await expect(
    page.getByRole("option", { name: "Backup & data Settings", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await settings.press("Enter");
  await page.getByRole("button", { name: "Save Backup" }).click();
  await expect(page.getByText("Backup is up to date.")).toBeVisible();
  expect(fs.existsSync(backupPath)).toBe(true);
  await page.evaluate(() =>
    window.billflow!.settings.update({ businessName: "Changed Studio" }),
  );
  await expect(
    page.getByText("Workspace changed since this backup."),
  ).toBeVisible();
});

test("customizes profiles and connects invoice stages, standalone payables and task undo", async ({}, testInfo) => {
  page.setDefaultTimeout(10_000);
  const created = await page.evaluate(async (pdfExportDirectory) => {
    const api = window.billflow!;
    const response = await api.profiles.create({
      name: "Extension QA",
      role: "general",
      seedRoleCatalog: false,
    });
    const profile = response.profiles.find(
      (row) => row.name === "Extension QA",
    )!;
    await api.profiles.switch(profile.id);
    await api.settings.update({ pdfExportDirectory, defaultCurrency: "USD" });
    const client = await api.clients.create({
      name: "Extension Client",
      email: "client@example.invalid",
      phone: "+94771234567",
      whatsappPhone: "+94711234567",
      currency: "USD",
      relationshipNotes: "Prefers monthly updates",
      billingAddress: "123 Test Lane",
    });
    const invoices = await Promise.all(
      ["EXT-01", "EXT-02"].map((code) =>
        api.invoices.create({
          clientId: client.id,
          code,
          currency: "USD",
          amountCents: 10000,
          workflowStage: "DELIVERED",
          paymentUrl: "https://example.invalid/pay",
          items: [
            {
              description: "Design review",
              unitPriceCents: 10000,
              quantity: 1,
            },
          ],
        }),
      ),
    );
    const tasks = await Promise.all(
      ["Proofread work", "Check handover"].map((title) =>
        api.tasks.create({
          id: crypto.randomUUID(),
          clientId: client.id,
          title,
          status: "todo",
          priority: "high",
          currency: "USD",
          description: "",
          dueDate: "",
          category: "Development",
          subtasks: [],
          assignee: {
            name: "QA",
            avatarLetter: "Q",
            bgColor: "blue",
            textColor: "white",
          },
        }),
      ),
    );
    return { profileId: profile.id, invoices, tasks };
  }, directory);
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();

  const openSettings = async (name: string) => {
    await page.keyboard.press("Control+k");
    const search = page.getByRole("combobox", {
      name: "Search workspace records and actions",
    });
    await search.fill(name);
    await page.getByRole("option", { name: `${name} Settings`, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
  };
  await openSettings("Business profile");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#14786b";
    context.fillRect(0, 0, 48, 48);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles({
    name: "profile-fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(
    page.getByRole("img", { name: "Extension QA avatar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          window
            .billflow!.profiles.list()
            .then((state) =>
              Boolean(
                state.profiles.find((profile) => profile.id === id)?.photoData,
              ),
            ),
        created.profileId,
      ),
    )
    .toBe(true);

  await openSettings("Appearance");
  await page
    .getByRole("combobox", { name: "Typeface", exact: true })
    .selectOption("nunito");
  await page.getByLabel("Layout density").selectOption("compact");
  await page.getByLabel("Notification placement").selectOption("top-left");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-typeface",
    "nunito",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-workspace-density",
    "compact",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-notification-placement",
    "top-left",
  );

  await openSettings("Invoice defaults");
  await page
    .getByLabel("Default delivery destination")
    .fill("https://example.invalid/deliverables");
  const canvas = page.getByLabel("Draw invoice signature");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 40, bounds.y + 35);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 140, bounds.y + 55, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Use drawing" }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .billflow!.settings.get()
          .then((row) => Boolean(row.signatureData)),
      ),
    )
    .toBe(true);

  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select invoice EXT-01" }).check();
  await page.getByRole("checkbox", { name: "Select invoice EXT-02" }).check();
  await page
    .getByRole("button", { name: "Change status", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Payment status", exact: true })
    .selectOption("PAID");
  await page.getByRole("button", { name: "Apply status" }).click();
  const invoices = await page.evaluate(() => window.billflow!.invoices.list());
  expect(
    invoices.every(
      (row) => row.status === "PAID" && row.workflowStage === "DELIVERED",
    ),
  ).toBe(true);

  const drafts = await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(shell, {
      openExternal: async (url: string) => {
        opened.push(url);
      },
      showItemInFolder: () => {},
      billflowDraftFixtures: opened,
    });
    return opened.length;
  });
  expect(drafts).toBe(0);
  await page
    .getByRole("button", { name: "View invoice design EXT-01" })
    .first()
    .click();
  await expect(
    page.getByRole("img", { name: "Invoice signature" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pay online", exact: true }),
  ).toBeVisible();
  for (const name of ["WhatsApp Desktop", "WhatsApp Web", "SMS draft"]) {
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("button", { name }).click();
    await expect
      .poll(() =>
        app.evaluate(
          ({ shell }) =>
            (shell as typeof shell & { billflowDraftFixtures: string[] })
              .billflowDraftFixtures.length,
        ),
      )
      .toBeGreaterThanOrEqual(
        ["WhatsApp Desktop", "WhatsApp Web", "SMS draft"].indexOf(name) + 1,
      );
  }
  const opened = await app.evaluate(
    ({ shell }) =>
      (shell as typeof shell & { billflowDraftFixtures: string[] })
        .billflowDraftFixtures,
  );
  expect(opened[0]).toMatch(/^whatsapp:\/\/send\?/);
  expect(opened[1]).toMatch(/^https:\/\/web\.whatsapp\.com\/send\?/);
  expect(new URL(opened[0]).searchParams.get("phone")).toBe("94711234567");
  expect(opened[2]).toMatch(/^sms:\+94771234567\?/);
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("link", { name: "Outsourcing", exact: true }).click();
  await page.getByRole("button", { name: "New Payable", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("Adapter order");
  await page.getByLabel("Vendor name").fill("One-time Fixture Vendor");
  await page.getByLabel("Vendor phone country code").selectOption("LK");
  await page.getByLabel("Vendor phone", { exact: true }).fill("0771234567");
  await page.getByLabel("Billing address").fill("7 Supplier Road");
  await page
    .getByLabel("PayPal payment link")
    .fill("https://www.paypal.com/example");
  await page
    .getByLabel("Stripe payment link")
    .fill("https://buy.stripe.com/example");
  await page.getByLabel("Item 1").fill("USB-C adapters");
  await page.getByLabel("Quantity").fill("3");
  await page.getByLabel("Unit price").fill("12.00");
  await page.getByLabel("Discount (USD)").fill("2.00");
  await page.getByRole("button", { name: "Save payable" }).click();
  await expect(page.getByText("$34.00 remaining")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open PayPal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Stripe" })).toBeVisible();
  const payable = await page.evaluate(() =>
    window.billflow!.workOrders.list().then((items) => items[0]),
  );
  expect(payable).toMatchObject({
    vendorId: null,
    invoiceId: null,
    taskId: null,
    vendorPhone: "+94771234567",
    feeCents: 3400,
  });
  const voucher = await page.evaluate(
    (id) => window.billflow!.workOrders.exportPdf(id),
    payable.id,
  );
  expect(
    (await PDFDocument.load(fs.readFileSync(voucher.filePath))).getPageCount(),
  ).toBeGreaterThan(0);
  await testInfo.attach("itemized-payable", {
    path: voucher.filePath,
    contentType: "application/pdf",
  });
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Select tasks" }).click();
  for (const task of created.tasks)
    await page
      .getByRole("checkbox", { name: `Select task ${task.title}` })
      .check();
  await page.getByRole("button", { name: "Delete selected (2)" }).click();
  await expect(
    page.getByRole("heading", { name: "Proofread work", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo task deletion" }).click();
  await expect(
    page.getByRole("heading", { name: "Proofread work", exact: true }),
  ).toBeVisible();

  const csvPath = path.join(directory, "workspace-extension.csv");
  await app.evaluate(({ dialog }, filePath) => {
    Object.assign(dialog, {
      showSaveDialog: async () => ({ canceled: false, filePath }),
    });
  }, csvPath);
  await openSettings("Backup & data");
  await page.getByRole("button", { name: "Export Workspace CSV" }).click();
  await expect.poll(() => fs.existsSync(csvPath)).toBe(true);
  const csv = fs.readFileSync(csvPath, "utf8");
  expect(csv).toContain("record_type");
  expect(csv).toContain("USB-C adapters");
  expect(csv).toContain("Prefers monthly updates");
});
