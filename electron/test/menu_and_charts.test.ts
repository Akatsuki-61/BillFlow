import { describe, expect, it } from "vitest";
import { getAboutIconPath, buildMenuTemplate } from "../menu";
import type { MenuItemConstructorOptions, MenuItem, KeyboardEvent } from "electron";
import fs from "fs";

describe("macOS Menu & About Panel Configuration", () => {
  it("resolves the white brand mark icon path for About BillFlow", () => {
    const iconPath = getAboutIconPath();
    expect(iconPath).toBeDefined();
    expect(fs.existsSync(iconPath!)).toBe(true);
    expect(iconPath).toMatch(/logo-white\.png|BillFlow-Logo-White-Icon\.png/);
  });

  it("package.json author is set to Akatsuki-61", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    expect(pkg.author).toBe("Akatsuki-61");
    expect(pkg.name).toBe("billflow");
    expect(pkg.productName).toBe("BillFlow");
  });

  it("electron-builder.yml includes logo-white.png in extraResources and copyright", () => {
    const yaml = fs.readFileSync("electron-builder.yml", "utf-8");
    expect(yaml).toContain("logo-white.png");
    expect(yaml).toContain("Copyright © 2026 Akatsuki-61");
  });

  it("builds the macOS Application Menu with BillFlow, File, Edit, View, Tabs, Window", () => {
    const navigatedRoutes: string[] = [];
    const template = buildMenuTemplate((route) => navigatedRoutes.push(route), true);

    const menuLabels = template.map((m) => m.label);
    expect(menuLabels).toEqual(["BillFlow", "File", "Edit", "View", "Tabs", "Window"]);

    // 1. App Menu items
    const appMenu = template.find((m) => m.label === "BillFlow");
    expect(appMenu).toBeDefined();
    const appSubmenu = appMenu!.submenu as MenuItemConstructorOptions[];
    const appLabels = appSubmenu.map((i) => i.label || (i.role ? `role:${i.role}` : "separator"));

    expect(appLabels).toContain("About BillFlow");
    expect(appLabels).toContain("Settings...");
    expect(appLabels).toContain("Check for Updates...");
    expect(appLabels).not.toContain("Services"); // Services replaced by Settings

    const settingsItem = appSubmenu.find((i) => i.label === "Settings...");
    expect(settingsItem?.accelerator).toBe("CmdOrCtrl+,");
    settingsItem?.click?.({} as MenuItem, undefined, {} as KeyboardEvent);
    expect(navigatedRoutes).toContain("/settings");

    // 2. File Menu items
    const fileMenu = template.find((m) => m.label === "File");
    expect(fileMenu).toBeDefined();
    const fileSubmenu = fileMenu!.submenu as MenuItemConstructorOptions[];
    const newInvoiceItem = fileSubmenu.find((i) => i.label === "New Invoice");
    expect(newInvoiceItem?.accelerator).toBe("CmdOrCtrl+N");
    newInvoiceItem?.click?.({} as MenuItem, undefined, {} as KeyboardEvent);
    expect(navigatedRoutes).toContain("/invoices?new=1");

    // 3. Tabs Menu items
    const tabsMenu = template.find((m) => m.label === "Tabs");
    expect(tabsMenu).toBeDefined();
    const tabsSubmenu = tabsMenu!.submenu as MenuItemConstructorOptions[];

    const expectedTabs = [
      { label: "Dashboard", accelerator: "CmdOrCtrl+1", route: "/" },
      { label: "Invoices", accelerator: "CmdOrCtrl+2", route: "/invoices" },
      { label: "Clients", accelerator: "CmdOrCtrl+3", route: "/clients" },
      { label: "Catalog", accelerator: "CmdOrCtrl+4", route: "/catalog" },
      { label: "Expenses", accelerator: "CmdOrCtrl+5", route: "/expenses" },
      { label: "Outsourcing", accelerator: "CmdOrCtrl+6", route: "/outsourcing" },
      { label: "Tasks", accelerator: "CmdOrCtrl+7", route: "/tasks" },
      { label: "Analytics", accelerator: "CmdOrCtrl+8", route: "/analytics" },
      { label: "Support", route: "/support" },
    ];

    expectedTabs.forEach(({ label, accelerator, route }) => {
      const item = tabsSubmenu.find((i) => i.label === label);
      expect(item, `Tab item "${label}" should exist`).toBeDefined();
      if (accelerator) {
        expect(item?.accelerator).toBe(accelerator);
      }
      navigatedRoutes.length = 0;
      item?.click?.({} as MenuItem, undefined, {} as KeyboardEvent);
      expect(navigatedRoutes).toContain(route);
    });
  });

  it("widget definitions contain updated financial title and description for audience-growth-chart", async () => {
    const { WIDGET_CATALOG } = await import("../../src/lib/widgets/widgetDefinitions");
    const chart = WIDGET_CATALOG.find((w) => w.id === "audience-growth-chart");
    expect(chart).toBeDefined();
    expect(chart?.title).toBe("Delivered Solutions Financial Growth");
    expect(chart?.description).toContain("profit");
  });
});
