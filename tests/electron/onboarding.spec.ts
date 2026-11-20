import {
  test,
  expect,
  _electron,
  type ElectronApplication,
} from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("first launch creates one workspace and resumes optional permissions after restarting", async ({}, testInfo) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "billflow-onboarding-"),
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== "ELECTRON_RUN_AS_NODE" && value !== undefined,
    ),
  ) as Record<string, string>;
  let app: ElectronApplication | undefined;
  async function launch() {
    app = await _electron.launch({
      executablePath: process.env.BILLFLOW_APP_PATH!,
      env: {
        ...env,
        BILLFLOW_USER_DATA: directory,
        BILLFLOW_VERIFY_HIDDEN: "1",
        BILLFLOW_DISABLE_NATIVE_CALENDAR: "1",
        BILLFLOW_DISABLE_RATE_FETCH: "1",
      },
    });
    return app.firstWindow();
  }

  try {
    let page = await launch();
    const picker = page.getByRole("main", { name: "BillFlow setup" });
    await expect(
      picker.getByRole("heading", { name: "Who’s working?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Invoices", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("picker.png"),
      scale: "css",
    });
    const add = picker.getByRole("button", { name: "Add profile" });
    await expect(add).toBeFocused();
    await page.keyboard.press("Enter");
    const name = picker.getByRole("textbox", { name: "What’s your name?" });
    await expect(name).toBeFocused();
    await expect(picker.getByRole("textbox")).toHaveCount(1);
    await name.fill("Alex Rivera");
    await name.press("Enter");

    const company = picker.getByRole("textbox", { name: /company or studio/ });
    await expect(company).toBeFocused();
    await company.fill("Rivera Studio");
    await picker.getByRole("button", { name: "Back" }).click();
    await expect(name).toHaveValue("Alex Rivera");
    await picker.getByRole("button", { name: "Continue" }).click();
    await expect(company).toHaveValue("Rivera Studio");
    await picker.getByRole("button", { name: "Continue" }).click();

    const email = picker.getByRole("textbox", { name: /email should clients/ });
    await expect(email).toBeFocused();
    await picker.getByRole("button", { name: "Continue" }).click();
    await picker
      .getByRole("combobox", { name: /currency/ })
      .selectOption("LKR");
    await picker.getByRole("button", { name: "Continue" }).click();
    await expect(
      picker.getByRole("heading", { name: "Review your profile" }),
    ).toBeFocused();
    await expect(picker.getByText("Rivera Studio")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("review.png"),
      scale: "css",
    });
    await picker.getByRole("button", { name: "Create profile" }).click();

    await expect(
      page.getByRole("heading", { name: "Optional permissions" }),
    ).toBeVisible();
    const [profile] = (
      await page.evaluate(() => window.billflow!.profiles.list())
    ).profiles;
    expect(profile.name).toBe("Alex Rivera");
    expect(profile.defaultCurrency).toBe("LKR");
    await expect(
      page.getByRole("link", { name: "Invoices", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Enable notifications" }).click();
    await expect(page.getByText(/Enabled in BillFlow/)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("permissions.png"),
      scale: "css",
    });

    await app!.close();
    page = await launch();
    await expect(
      page.getByRole("heading", { name: "Optional permissions" }),
    ).toBeFocused();
    await expect(page.getByText(/Enabled in BillFlow/)).toBeVisible();
    if (process.platform === "darwin") {
      await page.getByRole("button", { name: "Connect Calendar" }).click();
      await expect(
        page.getByRole("main", { name: "BillFlow setup" }).getByRole("alert"),
      ).toContainText("Apple Calendar is unavailable");
    }
    await page.getByRole("button", { name: "Open BillFlow" }).click();
    await expect(
      page.getByRole("link", { name: "Invoices", exact: true }),
    ).toBeVisible();
    const state = await page.evaluate(async () => {
      const api = window.billflow!;
      const profiles = await api.profiles.list();
      return {
        profiles,
        settings: await api.settings.get(),
        catalog: await api.catalog.list(),
      };
    });
    expect(state.profiles.profiles).toHaveLength(1);
    expect(state.profiles.desktopSetup).toEqual({
      permissionsPending: false,
      notificationsEnabled: true,
      calendarConnected: false,
    });
    expect(state.settings).toMatchObject({
      businessName: "Rivera Studio",
      defaultCurrency: "LKR",
      email: "",
    });
    expect(state.catalog).toHaveLength(0);
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Invoices", exact: true }),
    ).toBeVisible();
  } finally {
    await app?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
