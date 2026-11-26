import { describe, expect, it } from "vitest";
import {
  cleanMessageText,
  extractCurrency,
  extractDeliveryUrl,
  extractDueDate,
  matchCatalogLexically,
  parseMessageDeterministically,
  type CatalogMatchCandidate,
  type ClientMatchCandidate,
} from "../ai/entity-parser";

const CLIENTS: ClientMatchCandidate[] = [
  {
    id: "client-acme",
    name: "Acme Bakery",
    email: "ops@acmebakery.lk",
    contactPerson: "Kasun Perera",
    phone: "+94 77 123 4567",
    whatsappPhone: "+94771234567",
    currency: "LKR",
    driveUrl: "https://drive.google.com/drive/folders/acme-deliverables",
  },
  {
    id: "client-nova",
    name: "Nova Labs",
    email: "sarah@novalabs.io",
    contactPerson: "Sarah Chen",
    phone: "+1 415 555 0199",
    whatsappPhone: "+14155550199",
    currency: "USD",
    driveUrl: null,
  },
];

const CATALOG: CatalogMatchCandidate[] = [
  {
    id: "cat-web",
    title: "Landing Page Redesign",
    category: "Design",
    description: "Responsive marketing landing page redesign and UI polish",
    price: "350.00",
    priceCents: 35000,
    currency: "USD",
    unit: "project",
  },
  {
    id: "cat-stripe",
    title: "Stripe Payment Integration",
    category: "Development",
    description: "Stripe checkout webhooks and payment gateway setup",
    price: "250.00",
    priceCents: 25000,
    currency: "USD",
    unit: "service",
  },
];

describe("AI entity-parser", () => {
  it("cleans WhatsApp OCR noise and extracts structured email deliverables", () => {
    const raw = `
      From: Sarah Chen <sarah@novalabs.io>
      Subject: Re: Sprint 4 Deliverables
      Today
      Hi Chethaka,
      Hope you're doing well! Here is what we need for this sprint:
      1. Landing page redesign - $400
      2. 2x Stripe checkout integration ($250)
      3. Fix mobile navigation drawer bug
      Please deliver by Dec 12, 2026.
      Assets folder: https://drive.google.com/drive/folders/sprint4-assets
      Thanks,
      Sarah Chen
      Sent from my iPhone
    `;

    const parsed = parseMessageDeterministically(
      raw,
      CLIENTS,
      new Date("2026-11-25T10:00:00Z"),
    );

    expect(parsed.matchedClient?.id).toBe("client-nova");
    expect(parsed.currency).toBe("USD");
    expect(parsed.dueDate).toBe("2026-12-12");
    expect(parsed.deliveryUrl).toBe(
      "https://drive.google.com/drive/folders/sprint4-assets",
    );
    expect(parsed.candidateItems).toHaveLength(3);
    expect(parsed.candidateItems[0]).toMatchObject({
      description: "Landing page redesign",
      quantity: 1,
      unitPrice: "400.00",
      priceSource: "message",
    });
    expect(parsed.candidateItems[1]).toMatchObject({
      description: "Stripe checkout integration",
      quantity: 2,
      unitPrice: "250.00",
      priceSource: "message",
    });
    expect(parsed.candidateItems[2]).toMatchObject({
      description: "Fix mobile navigation drawer bug",
      quantity: 1,
      unitPrice: null,
    });
  });

  it("extracts tasks, client, currency, and relative due date from casual WhatsApp chat", () => {
    const raw = `
      [10:42 AM, 11/25/2026] Kasun Perera: Hey bro, about the bakery site — please add an online cake customizer and connect WhatsApp ordering before next Friday, oh and don't forget the logo refresh. Budget is around 85k LKR. 10:42 AM ✓✓
      Type a message
    `;

    const parsed = parseMessageDeterministically(
      raw,
      CLIENTS,
      new Date("2026-11-25T10:00:00Z"), // Wednesday Nov 25, 2026
    );

    expect(parsed.matchedClient?.id).toBe("client-acme");
    expect(parsed.currency).toBe("LKR");
    expect(parsed.dueDate).toBe("2026-12-04"); // next Friday (since Friday is 2 days away, next Friday = Dec 4)
    expect(parsed.deliveryUrl).toBe(
      "https://drive.google.com/drive/folders/acme-deliverables",
    );
    expect(parsed.candidateItems.length).toBeGreaterThanOrEqual(2);
    expect(
      parsed.candidateItems.some((item) =>
        item.description.toLowerCase().includes("cake customizer"),
      ),
    ).toBe(true);
    expect(
      parsed.candidateItems.some((item) =>
        item.description.toLowerCase().includes("logo refresh"),
      ),
    ).toBe(true);
  });

  it("suggests a new client when sender is not in directory", () => {
    const raw = `
      From: Amal Silva <amal@ceylontech.lk>
      Hi, could you build a custom inventory dashboard and deploy it to Vercel in 5 days?
      WhatsApp: +94 71 999 8877
    `;
    const parsed = parseMessageDeterministically(
      raw,
      CLIENTS,
      new Date("2026-11-25T10:00:00Z"),
    );

    expect(parsed.matchedClient).toBeNull();
    expect(parsed.suggestedClient).toMatchObject({
      name: "Amal Silva",
      email: "amal@ceylontech.lk",
      whatsappPhone: "+94 71 999 8877",
    });
    expect(parsed.dueDate).toBe("2026-11-30");
  });

  it("handles currency, date, URL, and lexical catalog helpers accurately", () => {
    expect(extractCurrency("Total Rs. 45,000 for site")).toBe("LKR");
    expect(extractCurrency("Budget is €900")).toBe("EUR");
    expect(extractCurrency("Price CA$450")).toBe("CAD");
    expect(
      extractDeliveryUrl(
        "Check https://example.com and https://github.com/acme/web-app.",
      ),
    ).toBe("https://github.com/acme/web-app");
    expect(extractDueDate("Need it tomorrow", new Date("2026-11-25"))).toBe(
      "2026-11-26",
    );
    expect(
      extractDueDate(
        "I want website created by next week for my t-shirt business",
        new Date("2026-11-25"),
      ),
    ).toBe("2026-12-02");
    expect(
      cleanMessageText("Online\nHello\nType a message\n10:42 AM ✓✓").cleanedText,
    ).toBe("Hello");

    const match = matchCatalogLexically(
      "Marketing landing page redesign",
      CATALOG,
    );
    expect(match?.item.id).toBe("cat-web");
  });

  it("strips greetings/signoffs and matches 'website' requests to Website Development / Web Development", () => {
    const webCatalog: CatalogMatchCandidate[] = [
      {
        id: "cat-website",
        title: "Website Development",
        category: "Development",
        description: "Full-stack responsive business website build",
        price: "500.00",
        priceCents: 50000,
        currency: "USD",
        unit: "project",
      },
      {
        id: "cat-mobile",
        title: "Mobile App Development",
        category: "Development",
        description: "Native iOS and Android mobile application",
        price: "1200.00",
        priceCents: 120000,
        currency: "USD",
        unit: "project",
      },
    ];

    const parsed = parseMessageDeterministically(
      "Hi Nipun, hope you're doing well! I need a website for my bakery by next Friday. Please let me know. Thanks, Sarah",
      CLIENTS,
      new Date("2026-11-25T10:00:00Z"),
      webCatalog,
    );

    expect(parsed.candidateItems).toHaveLength(1);
    expect(parsed.candidateItems[0].description).toBe("Website for my bakery");
    expect(parsed.candidateItems[0].description.toLowerCase()).not.toContain("hi nipun");
    expect(parsed.candidateItems[0].description.toLowerCase()).not.toContain("thanks");

    const matched = matchCatalogLexically(
      parsed.candidateItems[0].description,
      webCatalog,
    );
    expect(matched?.item.id).toBe("cat-website");

    // Synonym check: "website" also matches "Web Development"
    const webDevMatch = matchCatalogLexically("Website for our coffee shop", [
      { ...webCatalog[0], id: "cat-webdev", title: "Web Development" },
    ]);
    expect(webDevMatch?.item.id).toBe("cat-webdev");

    // Negative check: bugfix mentioning "mobile" must NOT falsely match "Mobile App Development"
    const bugMatch = matchCatalogLexically(
      "Fix mobile navigation drawer bug",
      webCatalog,
    );
    expect(bugMatch).toBeNull();
  });
});
