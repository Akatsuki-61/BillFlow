import { describe, expect, it } from "vitest";
import { normalizeNavPath, isNavActive } from "../navigation";

describe("navigation active state and normalization", () => {
  it("normalizes root and empty paths correctly", () => {
    expect(normalizeNavPath("/")).toBe("/");
    expect(normalizeNavPath("")).toBe("/");
    expect(normalizeNavPath(null)).toBe("/");
    expect(normalizeNavPath(undefined)).toBe("/");
    expect(normalizeNavPath("/index.html")).toBe("/");
    expect(normalizeNavPath("/index")).toBe("/");
  });

  it("normalizes subpage paths with and without trailing slashes and extensions", () => {
    expect(normalizeNavPath("/invoices")).toBe("/invoices");
    expect(normalizeNavPath("/invoices/")).toBe("/invoices");
    expect(normalizeNavPath("/invoices/index.html")).toBe("/invoices");
    expect(normalizeNavPath("/invoices?new=1")).toBe("/invoices");
    expect(normalizeNavPath("/invoices/#section")).toBe("/invoices");
    expect(normalizeNavPath("/tasks/")).toBe("/tasks");
    expect(normalizeNavPath("/catalog")).toBe("/catalog");
  });

  it("correctly identifies active route and never highlights Dashboard when on Invoices", () => {
    // When on invoices page
    const invoicesPath = "/invoices";
    expect(isNavActive(invoicesPath, "/invoices")).toBe(true);
    expect(isNavActive(invoicesPath, "/")).toBe(false); // Dashboard MUST NOT be active
    expect(isNavActive(invoicesPath, "/clients")).toBe(false);
    expect(isNavActive(invoicesPath, "/tasks")).toBe(false);

    // When on invoices page with trailing slash (Next.js trailingSlash: true)
    const invoicesTrailingSlash = "/invoices/";
    expect(isNavActive(invoicesTrailingSlash, "/invoices")).toBe(true);
    expect(isNavActive(invoicesTrailingSlash, "/")).toBe(false); // Dashboard MUST NOT be active

    // When on invoices page with search params
    const invoicesQuery = "/invoices?new=1";
    expect(isNavActive(invoicesQuery, "/invoices")).toBe(true);
    expect(isNavActive(invoicesQuery, "/")).toBe(false); // Dashboard MUST NOT be active

    // When on root Dashboard page
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/invoices")).toBe(false);
    expect(isNavActive("/index.html", "/")).toBe(true);
    expect(isNavActive("/index.html", "/invoices")).toBe(false);

    // When on Tasks page
    expect(isNavActive("/tasks", "/tasks")).toBe(true);
    expect(isNavActive("/tasks", "/")).toBe(false);
    expect(isNavActive("/tasks", "/invoices")).toBe(false);
  });
});
