import {
  test,
  expect,
  _electron,
  type ElectronApplication,
} from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
const evidence = path.resolve("release/audit-fixed-2026-11-17");
let app: ElectronApplication;
let directory: string;
test.afterAll(async () => {
  await app?.close();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});
test("reports foreign records in profile currency and preserves privacy, documents and locks", async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-currency-e2e-"));
  fs.mkdirSync(evidence, { recursive: true });
  const rates = {
    base: "USD",
    rates: { USD: 1, LKR: 300.125, EUR: 0.9, GBP: 0.75, CAD: 1.4 },
    provider: "ExchangeRate-API",
    updatedAt: new Date().toISOString(),
    nextUpdateAt: new Date(Date.now() + 86400000).toISOString(),
    fetchedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(directory, "exchange-rates.json"),
    JSON.stringify(rates),
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== "ELECTRON_RUN_AS_NODE" && value !== undefined,
    ),
  ) as Record<string, string>;
  app = await _electron.launch({
    executablePath:
      process.env.BILLFLOW_APP_PATH ||
      path.resolve(
        "release/test-0.2.0/mac-arm64/BillFlow.app/Contents/MacOS/BillFlow",
      ),
    env: {
      ...env,
      BILLFLOW_USER_DATA: directory,
      BILLFLOW_DISABLE_NATIVE_CALENDAR: "1",
      BILLFLOW_DISABLE_RATE_FETCH: "1",
      BILLFLOW_VERIFY_HIDDEN: "1",
    },
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!window.billflow);
  const fixture = await page.evaluate(async (folder) => {
    const api = window.billflow!;
    const profiles = await api.profiles.completeOnboarding({
      studioName: "Currency QA Studio",
      defaultCurrency: "LKR",
      profiles: [
        {
          name: "Primary QA",
          role: "consulting",
          subtitle: "QA",
          avatar: "code",
          accent: "blue",
          defaultCurrency: "LKR",
          invoicePrefix: "QA-",
          password: "2468",
          seedRoleCatalog: false,
        },
      ],
    });
    const signature = document.createElement("canvas");
    signature.width = 180;
    signature.height = 60;
    const ink = signature.getContext("2d")!;
    ink.strokeStyle = "#111";
    ink.lineWidth = 3;
    ink.beginPath();
    ink.moveTo(10, 40);
    ink.bezierCurveTo(65, 2, 25, 65, 95, 20);
    ink.bezierCurveTo(50, 60, 120, 30, 165, 40);
    ink.stroke();
    await api.settings.update({
      defaultCurrency: "LKR",
      pdfExportDirectory: folder,
      signatureData: signature.toDataURL("image/png"),
    });
    const client = await api.clients.create({
      name: "Currency Client",
      email: "client@example.invalid",
      currency: "USD",
      billingAddress: "10 Client Road",
    });
    const invoice = await api.invoices.create({
      clientId: client.id,
      code: "QA-USD",
      title: "Website",
      currency: "USD",
      amountCents: 20000,
    });
    await api.invoices.recordPayment({
      invoiceId: invoice.id,
      amountCents: 20000,
    });
    await api.expenses.create({
      merchant: "Global subscription",
      description: "Foreign subscription",
      category: "SOFTWARE",
      amountCents: 2000,
      currency: "USD",
      incurredAt: new Intl.DateTimeFormat("sv-SE").format(new Date()),
    });
    const catalog = await api.catalog.create({
      title: "Foreign catalog service",
      category: "Development",
      sku: "QA-CATALOG",
      price: "20.00",
      currency: "USD",
      unit: "project",
    });
    return {
      profileId: profiles.activeProfileId,
      clientId: client.id,
      invoiceId: invoice.id,
      catalogId: catalog.id,
    };
  }, directory);
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator(".currency-notice")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByText("Rs. 54,022.50", { exact: true }).first(),
  ).toBeVisible();
  await page.evaluate(() => {
    document.querySelector("main")!.scrollTop = 300;
  });
  await page.getByRole("link", { name: "Expenses", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.round(document.querySelector("main")!.scrollTop),
      ),
    )
    .toBe(0);
  const row = page.getByRole("row").filter({ hasText: "Global subscription" });
  await expect(row).toContainText("Rs. 6,002.50");
  await expect(row).toContainText("($20.00 USD)");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(evidence, "expenses-lkr-1440.png"),
    scale: "css",
  });
  await page.keyboard.press("Control+k");
  const settingsSearch = page.getByRole("combobox", {
    name: "Search workspace records and actions",
  });
  await settingsSearch.fill("invoice defaults");
  await settingsSearch.press("Enter");
  const primaryCurrency = page.getByRole("combobox", {
    name: "Primary currency",
  });
  await primaryCurrency.selectOption("USD");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .billflow!.settings.get()
          .then((settings) => settings.defaultCurrency),
      ),
    )
    .toBe("USD");
  await primaryCurrency.selectOption("LKR");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .billflow!.profiles.list()
          .then(
            (state) =>
              state.profiles.find((profile) => profile.isActive)
                ?.defaultCurrency,
          ),
      ),
    )
    .toBe("LKR");
  await page.getByRole("link", { name: "Catalog", exact: true }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Foreign catalog service" }),
  ).toContainText("Rs. 6,002.50");
  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await page.getByRole("button", { name: "New Invoice", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Currency", { exact: true }).selectOption("LKR");
  await dialog
    .getByRole("combobox", { name: "Add service from catalog" })
    .selectOption(fixture.catalogId);
  await expect(dialog).toContainText("Rs. 6,002.50");
  await expect(dialog.getByLabel("Currency", { exact: true })).toHaveValue(
    "LKR",
  );
  expect(
    await page.evaluate(
      () => document.querySelector("main")?.closest("[inert]") !== null,
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await app.evaluate(({ dialog }) => {
    Object.assign(dialog, { showSaveDialog: async () => ({ canceled: true }) });
  });
  await page.getByTitle("View invoice design QA-USD").first().click();
  await page.getByRole("button", { name: "Save as PDF", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save as PDF", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("Saved:", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", { name: "Search workspace records and actions" })
    .fill("appearance");
  await page
    .getByRole("combobox", { name: "Search workspace records and actions" })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await window.billflow!.profiles.list()).profiles.find(
            (profile) => profile.isActive,
          )?.themePreference,
      ),
    )
    .toBe("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Client", exact: true })
    .first()
    .click();
  await page
    .getByPlaceholder("e.g. Apex Architecture Ltd")
    .fill("Confidential draft");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) => window.billflow!.workspace!.draft!(id, "client"),
        fixture.profileId,
      ),
    )
    .toContain("Confidential draft");
  const publicId = await page.evaluate(async () => {
    const result = await window.billflow!.profiles.create({
      name: "Public QA",
      role: "general",
      defaultCurrency: "USD",
      seedRoleCatalog: false,
    });
    const profile = result.profiles.find(
      (profile) => profile.name === "Public QA",
    )!;
    await window.billflow!.profiles.switch(profile.id);
    return profile.id;
  });
  await page.reload();
  expect(
    await page.evaluate(
      (id) => window.billflow!.workspace!.draft!(id, "client"),
      publicId,
    ),
  ).toBeNull();
  expect(
    await page.evaluate(async (id) => {
      try {
        await window.billflow!.workspace!.draft!(id, "client");
        return "allowed";
      } catch (error) {
        return String(error);
      }
    }, fixture.profileId),
  ).toContain("another profile");
  await page.evaluate(
    (id) => window.billflow!.profiles.switch(id, "2468"),
    fixture.profileId,
  );
  await page.reload();
  await app.evaluate(({ powerMonitor }) => {
    powerMonitor.emit("lock-screen");
  });
  await expect(page.getByRole("main")).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      try {
        await window.billflow!.clients.list();
        return "allowed";
      } catch (error) {
        return String(error);
      }
    }),
  ).toContain("WORKSPACE_LOCKED");
  await page.evaluate(
    (id) => window.billflow!.profiles.switch(id, "2468"),
    fixture.profileId,
  );
  await page.reload();
  const longInvoiceId = await page.evaluate(
    async ({ clientId }) => {
      const api = window.billflow!;
      const items = Array.from({ length: 30 }, (_, index) => ({
        description: `ITEM-${String(index + 1).padStart(2, "0")} Detailed website deliverable with acceptance criteria, project review and handoff documentation.`,
        quantity: 1,
        unitPriceCents: 12345,
      }));
      return (
        await api.invoices.create({
          clientId,
          code: "QA-LONG",
          currency: "USD",
          amountCents: 370350,
          items,
          paymentUrl: "https://example.invalid/pay",
        })
      ).id;
    },
    { clientId: fixture.clientId },
  );
  await page.waitForTimeout(250);
  for (const template of [
    "geometric-teal",
    "executive-wave",
    "scarlet-modern",
    "apex-orange",
    "noir-crimson",
  ]) {
    const exported = await page.evaluate(
      ({ id, template }) => window.billflow!.invoices.exportPdf(id, template),
      { id: longInvoiceId, template },
    );
    fs.copyFileSync(exported.filePath, path.join(evidence, `${template}.pdf`));
    expect(
      (
        await PDFDocument.load(fs.readFileSync(exported.filePath))
      ).getPageCount(),
    ).toBeGreaterThanOrEqual(2);
  }
  const voucher = await page.evaluate(async () => {
    const api = window.billflow!;
    const order = await api.workOrders.create({
      vendorSnapshot: { name: "デザイン会社" },
      scope: "日本語デザイン確認",
      feeCents: 2000,
      currency: "USD",
    });
    return api.workOrders.exportPdf(order.id);
  });
  fs.copyFileSync(voucher.filePath, path.join(evidence, "unicodeVoucher.pdf"));
  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().startsWith("app://billflow"))!
      .setSize(1100, 700);
  });
  await page.waitForTimeout(400);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(evidence, "invoices-1100-dark.png"),
    scale: "css",
  });
});
