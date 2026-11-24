import type { Currency } from "../../src/types/billing";
import type {
  AiCaptureIntent,
  AiExpenseCategory,
  AiPaymentSlipMismatch,
} from "../../src/types/ai";
import { extractCurrency, parseAmountToken } from "./entity-parser";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const KNOWN_BANKS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bcommercial\s+bank\b|\bcombank\b/i, name: "Commercial Bank" },
  { pattern: /\bsampath\s+bank\b|\bvishwa\b/i, name: "Sampath Bank" },
  { pattern: /\bhatton\s+national\b|\bhnb\b/i, name: "Hatton National Bank (HNB)" },
  { pattern: /\bbank\s+of\s+ceylon\b|\bboc\b/i, name: "Bank of Ceylon (BOC)" },
  { pattern: /\bpeople'?s\s+bank\b/i, name: "People's Bank" },
  { pattern: /\bnations\s+trust\b|\bfrimi\b/i, name: "Nations Trust Bank / FriMi" },
  { pattern: /\bseylan\s+bank\b/i, name: "Seylan Bank" },
  { pattern: /\bndb\s+bank\b|\bnational\s+development\s+bank\b/i, name: "NDB Bank" },
  { pattern: /\bdfcc\b/i, name: "DFCC Bank" },
  { pattern: /\bwise\b|\btransferwise\b/i, name: "Wise" },
  { pattern: /\bpayoneer\b/i, name: "Payoneer" },
  { pattern: /\bpaypal\b/i, name: "PayPal" },
  { pattern: /\bstripe\b/i, name: "Stripe" },
  { pattern: /\brevolut\b/i, name: "Revolut" },
  { pattern: /\bchase\b/i, name: "Chase" },
  { pattern: /\bbank\s+of\s+america\b/i, name: "Bank of America" },
];

const KNOWN_MERCHANTS: Array<{
  pattern: RegExp;
  name: string;
  category: AiExpenseCategory;
  defaultDescription: string;
}> = [
  { pattern: /\bopena[il1]\b|\bchatgpt\b/i, name: "OpenAI", category: "AI INFRASTRUCTURE", defaultDescription: "OpenAI API / ChatGPT subscription" },
  { pattern: /\banthropic\b|\bclaude\b/i, name: "Anthropic", category: "AI INFRASTRUCTURE", defaultDescription: "Anthropic Claude API / Pro plan" },
  { pattern: /\bcursor\b/i, name: "Cursor", category: "AI INFRASTRUCTURE", defaultDescription: "Cursor AI editor subscription" },
  { pattern: /\bhugging\s*face\b/i, name: "Hugging Face", category: "AI INFRASTRUCTURE", defaultDescription: "Hugging Face compute / inference" },
  { pattern: /\breplicate\b/i, name: "Replicate", category: "AI INFRASTRUCTURE", defaultDescription: "Replicate AI model hosting" },
  { pattern: /\bvercel\b/i, name: "Vercel Inc.", category: "HOSTING", defaultDescription: "Vercel cloud hosting & deployments" },
  { pattern: /\bamazon\s+web\s+services\b|\baws\b/i, name: "Amazon Web Services", category: "HOSTING", defaultDescription: "AWS cloud infrastructure" },
  { pattern: /\bgoogle\s+cloud\b|\bgcp\b/i, name: "Google Cloud", category: "HOSTING", defaultDescription: "Google Cloud Platform usage" },
  { pattern: /\bdigitalocean\b/i, name: "DigitalOcean", category: "HOSTING", defaultDescription: "DigitalOcean droplet & cloud hosting" },
  { pattern: /\bcloudflare\b/i, name: "Cloudflare", category: "HOSTING", defaultDescription: "Cloudflare DNS & edge hosting" },
  { pattern: /\bnetlify\b/i, name: "Netlify", category: "HOSTING", defaultDescription: "Netlify hosting plan" },
  { pattern: /\brailway\b/i, name: "Railway", category: "HOSTING", defaultDescription: "Railway cloud hosting" },
  { pattern: /\bsupabase\b/i, name: "Supabase", category: "HOSTING", defaultDescription: "Supabase database & hosting" },
  { pattern: /\bnamecheap\b|\bgodaddy\b|\bporkbun\b/i, name: "Domain Registrar", category: "HOSTING", defaultDescription: "Domain renewal & DNS hosting" },
  { pattern: /\bgithub\b/i, name: "GitHub", category: "SOFTWARE", defaultDescription: "GitHub subscription & Copilot" },
  { pattern: /\bfigma\b/i, name: "Figma", category: "SOFTWARE", defaultDescription: "Figma design seats subscription" },
  { pattern: /\badobe\b/i, name: "Adobe Creative Cloud", category: "SOFTWARE", defaultDescription: "Adobe Creative Cloud subscription" },
  { pattern: /\bjetbrains\b/i, name: "JetBrains", category: "SOFTWARE", defaultDescription: "JetBrains IDE license" },
  { pattern: /\bnotion\b/i, name: "Notion", category: "SOFTWARE", defaultDescription: "Notion workspace subscription" },
  { pattern: /\blinear\b/i, name: "Linear", category: "SOFTWARE", defaultDescription: "Linear issue tracker plan" },
  { pattern: /\bslack\b/i, name: "Slack", category: "SOFTWARE", defaultDescription: "Slack workspace plan" },
  { pattern: /\bzoom\b/i, name: "Zoom", category: "SOFTWARE", defaultDescription: "Zoom Pro subscription" },
  { pattern: /\bapple\s+store\b|\bmacbook\b|\blogitech\b|\bdell\b|\blenovo\b|\bsamsung\b|\bkeychron\b/i, name: "Hardware Vendor", category: "HARDWARE", defaultDescription: "Computer hardware & peripherals" },
  { pattern: /\buber\b|\bpickme\b|\blyft\b|\bsrilankan\s+airlines\b|\bemirates\b|\bbooking\.com\b|\bairbnb\b/i, name: "Travel Service", category: "TRAVEL", defaultDescription: "Client travel & transit" },
  { pattern: /\bstarbucks\b|\bbarista\b|\bcoffee\s+bean\b|\bcafe\b|\brestaurant\b|\bpizza\b|\buber\s*eats\b/i, name: "Cafe / Restaurant", category: "MEALS", defaultDescription: "Client meeting meal / coffee" },
  { pattern: /\bdialog\b|\bslt\s*mobitel\b|\bmobitel\b|\bstaples\b|\boffice\s+depot\b|\bcoworking\b|\bregus\b/i, name: "Office / Telecom", category: "OFFICE", defaultDescription: "Office supplies & internet" },
];

function formatIsoDate(year: number, monthZeroBased: number, day: number): string | null {
  if (year < 2000 || year > 2099 || monthZeroBased < 0 || monthZeroBased > 11 || day < 1 || day > 31) {
    return null;
  }
  const d = new Date(year, monthZeroBased, day);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== monthZeroBased ||
    d.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(monthZeroBased + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractDocumentDate(text: string): string | null {
  // 1. ISO YYYY-MM-DD or YYYY/MM/DD
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const formatted = formatIsoDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (formatted) return formatted;
  }

  // 2. DD-MMM-YYYY or DD MMM YYYY (e.g. 25 Nov 2026, 25-Nov-2026)
  const dayMonthYear = text.match(
    /\b(\d{1,2})[\s/-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?,?[\s/-]+(20\d{2})\b/i,
  );
  if (dayMonthYear) {
    const month = MONTH_INDEX[dayMonthYear[2].toLowerCase()];
    if (month !== undefined) {
      const formatted = formatIsoDate(
        Number(dayMonthYear[3]),
        month,
        Number(dayMonthYear[1]),
      );
      if (formatted) return formatted;
    }
  }

  // 3. MMM DD, YYYY (e.g. Nov 25, 2026)
  const monthDayYear = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i,
  );
  if (monthDayYear) {
    const month = MONTH_INDEX[monthDayYear[1].toLowerCase()];
    if (month !== undefined) {
      const formatted = formatIsoDate(
        Number(monthDayYear[3]),
        month,
        Number(monthDayYear[2]),
      );
      if (formatted) return formatted;
    }
  }

  // 4. DD/MM/YYYY or DD-MM-YYYY (common on Sri Lankan & international bank slips)
  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const year = Number(dmy[3]);
    // Prefer DD/MM/YYYY when first > 12, or default DD/MM/YYYY unless second > 12 (MM/DD/YYYY)
    const formatted =
      second > 12
        ? formatIsoDate(year, first - 1, second)
        : formatIsoDate(year, second - 1, first);
    if (formatted) return formatted;
  }

  return null;
}

function extractAmountsWithPriority(
  text: string,
  priorityLinePatterns: RegExp[],
  ignoreLinePatterns: RegExp[] = [],
): { amount: string | null; currency: Currency | null } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const currency = extractCurrency(text);

  const moneyPatterns = [
    /(?:CA\$|US\$|\$|€|£|LKR|USD|EUR|GBP|CAD|Rs\.?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/i,
    /\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2})\s*(?:LKR|USD|EUR|GBP|CAD|Rs\.?)?\b/i,
  ];

  const extractFromLine = (line: string): string | null => {
    for (const pattern of moneyPatterns) {
      const match = line.match(pattern);
      if (match) {
        const parsed = parseAmountToken(match[1]);
        if (parsed) return parsed;
      }
    }
    return null;
  };

  // Pass 1: Lines matching high-priority labels (in priority order)
  for (const labelRe of priorityLinePatterns) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!labelRe.test(line)) continue;
      if (ignoreLinePatterns.some((ig) => ig.test(line))) continue;
      const direct = extractFromLine(line);
      if (direct) {
        return {
          amount: direct,
          currency: extractCurrency(line) ?? currency,
        };
      }
      // Check next line (receipts often print "Total" on one line and "$45.00" on the next)
      if (i + 1 < lines.length) {
        const nextVal = extractFromLine(lines[i + 1]);
        if (nextVal) {
          return {
            amount: nextVal,
            currency: extractCurrency(lines[i + 1]) ?? currency,
          };
        }
      }
    }
  }

  // Pass 2: Any explicit currency-prefixed number across the document (take largest plausible total)
  let bestVal = 0;
  let bestStr: string | null = null;
  for (const line of lines) {
    if (ignoreLinePatterns.some((ig) => ig.test(line))) continue;
    const explicit = line.match(
      /(?:CA\$|US\$|\$|€|£|LKR|USD|EUR|GBP|CAD|Rs\.?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi,
    );
    if (!explicit) continue;
    for (const token of explicit) {
      const numMatch = token.match(/(\d[\d,]*(?:\.\d{1,2})?)/);
      if (!numMatch) continue;
      const parsed = parseAmountToken(numMatch[1]);
      if (!parsed) continue;
      const num = Number.parseFloat(parsed);
      if (num > bestVal) {
        bestVal = num;
        bestStr = parsed;
      }
    }
  }

  return { amount: bestStr, currency };
}

export function parseBankTransferSlip(
  ocrText: string,
  context: {
    expectedAmountCents?: number;
    expectedAdvanceCents?: number;
    expectedCurrency?: Currency;
  } = {},
): {
  amount: string | null;
  amountCents: number | null;
  currency: Currency | null;
  paymentDate: string | null;
  reference: string | null;
  bankName: string | null;
  matchLabel: string | null;
  mismatch: AiPaymentSlipMismatch | null;
  warnings: string[];
} {
  const warnings: string[] = [];

  const { amount, currency } = extractAmountsWithPriority(
    ocrText,
    [
      /\b(?:transfer\s+amount|transferred\s+amount|amount\s+transferred|payment\s+amount|amount\s+paid|paid\s+amount|debit\s+amount|credit\s+amount|total\s+amount|transaction\s+amount)\b/i,
      /\b(?:amount|total|paid|value)\b/i,
    ],
    [/\b(?:fee|charge|commission|balance\s+after|available\s+balance|account\s*(?:no|number))\b/i],
  );

  const amountCents = amount ? Math.round(Number.parseFloat(amount) * 100) : null;
  const paymentDate = extractDocumentDate(ocrText);

  // Extract bank/transfer reference number
  let reference: string | null = null;
  const refPatterns = [
    /\b(?:ref(?:erence)?(?:\s*(?:no|number|#|id))?|transaction\s*(?:id|no|#|ref)|txn\s*(?:id|no|#)|receipt\s*(?:no|#)|confirmation\s*(?:no|#|code)|trace\s*(?:no|#)|utr(?:\s*no)?|slip\s*(?:no|#))\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{4,32})\b/i,
    /\b((?:FT|TXN|REF|UTR|SLIP|CEFT|IBFT)[A-Z0-9_-]{5,24})\b/,
  ];
  for (const pattern of refPatterns) {
    const match = ocrText.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim();
      if (!/^(?:successful|completed|approved|pending|transfer|payment|amount|date)$/i.test(candidate)) {
        reference = candidate;
        break;
      }
    }
  }

  let bankName: string | null = null;
  for (const entry of KNOWN_BANKS) {
    if (entry.pattern.test(ocrText)) {
      bankName = entry.name;
      break;
    }
  }

  let matchLabel: string | null = null;
  let mismatch: AiPaymentSlipMismatch | null = null;

  if (
    currency &&
    context.expectedCurrency &&
    currency !== context.expectedCurrency
  ) {
    mismatch = {
      kind: "currency_mismatch",
      message: `Slip shows ${currency}, but this invoice is billed in ${context.expectedCurrency}.`,
    };
  } else if (amountCents !== null) {
    const advanceTarget = context.expectedAdvanceCents ?? 0;
    const balanceTarget = context.expectedAmountCents ?? 0;
    const tolerance = 100; // within 1.00 currency unit

    if (advanceTarget > 0 && Math.abs(amountCents - advanceTarget) <= tolerance) {
      matchLabel = "Matches required advance deposit";
    } else if (balanceTarget > 0 && Math.abs(amountCents - balanceTarget) <= tolerance) {
      matchLabel = "Matches remaining invoice balance";
    } else if (balanceTarget > 0 && amountCents > balanceTarget + tolerance) {
      mismatch = {
        kind: "overpaid",
        message: `Slip amount (${amount}) exceeds remaining balance (${(balanceTarget / 100).toFixed(2)}). Verify before saving.`,
      };
    } else if (advanceTarget > 0 && amountCents < advanceTarget - tolerance) {
      mismatch = {
        kind: "underpaid",
        message: `Slip amount (${amount}) is less than the expected advance (${(advanceTarget / 100).toFixed(2)}).`,
      };
    } else if (balanceTarget > 0 && amountCents < balanceTarget - tolerance) {
      mismatch = {
        kind: "underpaid",
        message: `Partial payment detected (${amount} of ${(balanceTarget / 100).toFixed(2)} remaining).`,
      };
    }
  } else {
    warnings.push("Could not confidently detect the transfer amount from this slip.");
  }

  return {
    amount,
    amountCents,
    currency: currency ?? context.expectedCurrency ?? null,
    paymentDate,
    reference,
    bankName,
    matchLabel,
    mismatch,
    warnings,
  };
}

export function parseExpenseReceiptDeterministically(ocrText: string): {
  merchant: string | null;
  description: string | null;
  amount: string | null;
  amountCents: number | null;
  currency: Currency | null;
  incurredAt: string | null;
  heuristicCategory: AiExpenseCategory;
  matchedKnownMerchant: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = ocrText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);

  let merchant: string | null = null;
  let description: string | null = null;
  let heuristicCategory: AiExpenseCategory = "SOFTWARE";
  let matchedKnownMerchant = false;

  for (const known of KNOWN_MERCHANTS) {
    if (known.pattern.test(ocrText)) {
      merchant = known.name;
      heuristicCategory = known.category;
      description = known.defaultDescription;
      matchedKnownMerchant = true;
      break;
    }
  }

  // Fallback merchant: first clean title-like line at the top of the receipt
  if (!merchant) {
    const candidate = lines.find(
      (line) =>
        line.length >= 3 &&
        line.length <= 60 &&
        !/^(?:receipt|invoice|tax\s+invoice|bill|date|order|payment|thank\s+you|paid|total|subtotal|qty)/i.test(
          line,
        ) &&
        !/^\d+[\d\s/.,:-]*$/.test(line),
    );
    if (candidate) {
      merchant = candidate.replace(/\s+/g, " ").trim();
    }
  }

  // Fallback heuristic category keywords if unknown merchant
  if (!matchedKnownMerchant) {
    const lower = ocrText.toLowerCase();
    if (/\b(?:llm|token|inference|gpu|api\s+credits|ai\s+api|openai|anthropic|gemini)\b/.test(lower)) {
      heuristicCategory = "AI INFRASTRUCTURE";
    } else if (/\b(?:hosting|server|cloud|domain|dns|ssl|vps|droplet|bandwidth|deployment)\b/.test(lower)) {
      heuristicCategory = "HOSTING";
    } else if (/\b(?:flight|airline|taxi|cab|ride|hotel|fuel|petrol|parking|toll|train)\b/.test(lower)) {
      heuristicCategory = "TRAVEL";
    } else if (/\b(?:coffee|cafe|lunch|dinner|breakfast|bakery|restaurant|tea|food|beverage)\b/.test(lower)) {
      heuristicCategory = "MEALS";
    } else if (/\b(?:keyboard|mouse|monitor|ssd|laptop|cable|adapter|headphone|webcam|hardware)\b/.test(lower)) {
      heuristicCategory = "HARDWARE";
    } else if (/\b(?:internet|broadband|fiber|stationery|paper|chair|desk|coworking|rent|electricity)\b/.test(lower)) {
      heuristicCategory = "OFFICE";
    } else {
      heuristicCategory = "SOFTWARE";
    }
  }

  const { amount, currency } = extractAmountsWithPriority(
    ocrText,
    [
      /\b(?:grand\s+total|amount\s+paid|total\s+paid|total\s+charged|total\s+due|balance\s+paid)\b/i,
      /\b(?:^total\b|\btotal\s*:|\btotal\s+(?:usd|lkr|eur|gbp|cad|rs))/i,
      /\b(?:amount|subtotal)\b/i,
    ],
    [/\b(?:tax\s+id|vat\s+no|invoice\s*(?:no|#)|receipt\s*(?:no|#)|order\s*(?:no|#))\b/i],
  );

  const amountCents = amount ? Math.round(Number.parseFloat(amount) * 100) : null;
  const incurredAt = extractDocumentDate(ocrText);

  if (!description) {
    const descLine = lines.find(
      (line) =>
        line !== merchant &&
        line.length >= 6 &&
        line.length <= 90 &&
        !/^(?:receipt|invoice|date|total|subtotal|tax|paid|visa|mastercard|card|thank)/i.test(
          line,
        ) &&
        !/^\$?\d[\d,.]*$/.test(line),
    );
    description = descLine ? descLine.slice(0, 120) : merchant ? `${merchant} expense` : null;
  }

  if (!amount) {
    warnings.push("Could not detect a clear receipt total — verify the amount before saving.");
  }

  return {
    merchant,
    description,
    amount,
    amountCents,
    currency,
    incurredAt,
    heuristicCategory,
    matchedKnownMerchant,
    warnings,
  };
}

export function detectCaptureIntentHeuristically(text: string): {
  intent: AiCaptureIntent;
  confidence: number;
  reason: string;
} {
  const lower = text.toLowerCase();

  const quoteSignals = [
    /\bhow\s+much\b/,
    /\b(?:quote|quotation|estimate|proposal|ballpark|pricing|rough\s+cost|what\s+would\s+(?:it|this)\s+cost|what\s+do\s+you\s+charge|rate\s+for)\b/,
    /\bcan\s+you\s+(?:quote|estimate|give\s+(?:me|us)\s+a\s+price)\b/,
    /\bwondering\s+(?:how\s+much|what\s+the\s+cost)\b/,
  ];

  const invoiceSignals = [
    /\b(?:send\s+(?:the\s+|an?\s+)?invoice|bill\s+(?:us|me)|invoice\s+(?:us|me|for)|go\s+ahead|approved|ready\s+to\s+(?:start|pay|proceed)|transfer\s+(?:the\s+)?(?:50%|advance|deposit))\b/,
  ];

  const taskSignals = [
    /\b(?:quick\s+fix|hotfix|bug\s+fix|minor\s+tweak|small\s+change|add\s+to\s+(?:the\s+)?(?:board|sprint|backlog|todo)|current\s+sprint|retainer\s+task|jira|ticket\s*#?\d+|can\s+you\s+fix\s+this\s+bug)\b/,
  ];

  const quoteHits = quoteSignals.filter((re) => re.test(lower)).length;
  const invoiceHits = invoiceSignals.filter((re) => re.test(lower)).length;
  const taskHits = taskSignals.filter((re) => re.test(lower)).length;

  if (quoteHits > 0 && invoiceHits === 0) {
    return {
      intent: "quote",
      confidence: Math.min(0.95, 0.78 + quoteHits * 0.08),
      reason: "Pricing or estimate inquiry detected — recommended as a Proposal / Quote.",
    };
  }
  if (taskHits > 0 && invoiceHits === 0 && quoteHits === 0) {
    return {
      intent: "tasks",
      confidence: Math.min(0.92, 0.75 + taskHits * 0.08),
      reason: "Ad-hoc fix or sprint task detected — ready to add straight to Kanban Tasks.",
    };
  }
  if (invoiceHits > 0) {
    return {
      intent: "invoice",
      confidence: Math.min(0.96, 0.82 + invoiceHits * 0.06),
      reason: "Approved scope or billing request detected — ready for New Invoice.",
    };
  }

  return {
    intent: "invoice",
    confidence: 0.65,
    reason: "Client deliverable request detected — ready to draft an Invoice.",
  };
}
