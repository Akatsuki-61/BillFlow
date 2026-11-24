import type { Currency } from "../../src/types/billing";
import type {
  AiExtractedDeliverable,
  AiSuggestedClient,
} from "../../src/types/ai";

export interface ClientMatchCandidate {
  id: string;
  name: string;
  email: string;
  contactPerson?: string | null;
  phone?: string | null;
  whatsappPhone?: string | null;
  currency: Currency;
  driveUrl?: string | null;
  archivedAt?: string | null;
}

export interface CatalogMatchCandidate {
  id: string;
  title: string;
  category: string;
  description: string;
  price: string;
  priceCents: number;
  currency: Currency;
  unit: string;
}

export interface DeterministicParseResult {
  cleanedText: string;
  matchedClient: ClientMatchCandidate | null;
  clientConfidence: number | null;
  suggestedClient: AiSuggestedClient | null;
  currency: Currency | null;
  dueDate: string | null;
  deliveryUrl: string | null;
  notes: string | null;
  candidateItems: AiExtractedDeliverable[];
  rawSegments: string[];
  budgetHint: string | null;
}

const OCR_UI_NOISE_PATTERNS = [
  /^\s*(?:today|yesterday|online|typing\.{0,3}|last seen.*|search|messages? and calls are end-to-end encrypted.*)$/i,
  /^\s*(?:type a message|message|reply|forward|delivered|read|seen|sent|mute|video call|voice call)\s*$/i,
  /^\s*(?:sent from my (?:iphone|ipad|android|mobile)|get outlook for .*)\s*$/i,
  /^\s*(?:\d{1,2}:\d{2}\s*(?:am|pm)?\s*[✓✔]{0,2}|[✓✔]{1,2})\s*$/i,
  /^\s*(?:lte|4g|5g|wi-?fi|\d{1,3}%)\s*$/i,
];

const GREETING_OR_CLOSING_RE =
  /^(?:hi|hey|hello|dear|good\s+(?:morning|afternoon|evening)|hope\s+you(?:'re|\s+are)|how\s+are\s+you|thanks?(?:\s+a\s+lot|\s+so\s+much)?|thank\s+you|best(?:\s+regards)?|kind\s+regards|regards|cheers|warm\s+regards|let\s+me\s+know|please\s+let\s+me\s+know|looking\s+forward|talk\s+soon|take\s+care|ok(?:ay)?|sure|sounds\s+good|great|awesome|cool|got\s+it)[\s,!.:-]*$/i;

const ACTION_VERBS_RE =
  /\b(?:build|create|develop|design|redesign|fix|update|upgrade|integrate|connect|add|implement|setup|set\s+up|configure|deploy|migrate|optimize|refactor|audit|review|write|draft|prepare|deliver|make|produce|edit|animate|install|launch|refresh|revamp|automate|sync|customize|customise|debug|resolve|patch|test|convert|export|import|host|maintain|support)\b/i;

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

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanMessageText(raw: string): {
  cleanedText: string;
  senderHints: string[];
  subjectHint: string | null;
} {
  const senderHints: string[] = [];
  let subjectHint: string | null = null;

  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];

  for (const originalLine of lines) {
    let line = originalLine.trim();
    if (!line) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
      continue;
    }

    if (OCR_UI_NOISE_PATTERNS.some((re) => re.test(line))) {
      continue;
    }

    // Email headers
    const fromMatch = line.match(/^from\s*:\s*(.+)$/i);
    if (fromMatch) {
      const value = fromMatch[1].trim();
      if (value) senderHints.push(value);
      continue;
    }
    const subjectMatch = line.match(/^subject\s*:\s*(.+)$/i);
    if (subjectMatch) {
      subjectHint = subjectMatch[1].replace(/^(?:re|fwd?)\s*:\s*/i, "").trim();
      continue;
    }
    if (/^(?:to|cc|bcc|date|sent)\s*:/i.test(line)) {
      continue;
    }

    // WhatsApp exported chat prefix: [10:42 AM, 11/24/2026] Name: message
    // or 11/24/2026, 10:42 AM - Name: message
    const waBracket = line.match(
      /^\[?\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\]?\s*(?:-\s*)?([^:]{2,45}):\s*(.+)$/i,
    );
    if (waBracket) {
      senderHints.push(waBracket[1].trim());
      line = waBracket[2].trim();
    } else {
      const waTimeFirst = line.match(
        /^\[?\d{1,2}:\d{2}\s*(?:am|pm)?,\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\]?\s*([^:]{2,45}):\s*(.+)$/i,
      );
      if (waTimeFirst) {
        senderHints.push(waTimeFirst[1].trim());
        line = waTimeFirst[2].trim();
      }
    }

    // Strip trailing inline WhatsApp message timestamps like "10:42 AM"
    line = line
      .replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s*[✓✔]{0,2}$/i, "")
      .trim();

    if (line) kept.push(line);
  }

  return {
    cleanedText: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    senderHints,
    subjectHint,
  };
}

export function extractDeliveryUrl(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s<>()"']+/gi);
  if (!matches || matches.length === 0) return null;

  const cleaned = matches
    .map((url) => url.replace(/[.,;:!?)]+$/, ""))
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    });

  if (cleaned.length === 0) return null;

  const priorityDomains = [
    "drive.google.com",
    "docs.google.com",
    "github.com",
    "gitlab.com",
    "figma.com",
    "notion.so",
    "dropbox.com",
    "onedrive.live.com",
    "vercel.app",
    "loom.com",
  ];

  const prioritized = cleaned.find((url) => {
    const lower = url.toLowerCase();
    return priorityDomains.some((domain) => lower.includes(domain));
  });

  return prioritized ?? cleaned[0];
}

export function extractCurrency(text: string): Currency | null {
  const counts: Record<Currency, number> = {
    USD: 0,
    LKR: 0,
    EUR: 0,
    GBP: 0,
    CAD: 0,
  };

  if (/\bLKR\b/i.test(text) || /\bRs\.?\s*\d/i.test(text) || /rupees?/i.test(text)) {
    counts.LKR += 3;
  }
  if (/\bCAD\b/i.test(text) || /CA\$\s*\d/i.test(text) || /C\$\s*\d/i.test(text)) {
    counts.CAD += 3;
  }
  if (/\bGBP\b/i.test(text) || /£\s*\d/.test(text)) {
    counts.GBP += 3;
  }
  if (/\bEUR\b/i.test(text) || /€\s*\d/.test(text)) {
    counts.EUR += 3;
  }
  if (/\bUSD\b/i.test(text) || (/(?<![A-Z])\$\s*\d/.test(text) && counts.CAD === 0)) {
    counts.USD += 2;
  }

  let best: Currency | null = null;
  let bestScore = 0;
  for (const [code, score] of Object.entries(counts) as Array<[Currency, number]>) {
    if (score > bestScore) {
      bestScore = score;
      best = code;
    }
  }
  return best;
}

export function parseAmountToken(rawNumber: string, multiplier?: string): string | null {
  const normalized = rawNumber.replace(/,/g, "").trim();
  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const factor = multiplier && /^k$/i.test(multiplier) ? 1000 : 1;
  const amount = numeric * factor;
  if (amount > 100_000_000) return null;
  return amount.toFixed(2);
}

export function extractDueDate(text: string, now = new Date()): string | null {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Explicit ISO date YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const candidate = new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3]),
    );
    if (!Number.isNaN(candidate.getTime())) {
      return formatIsoDate(candidate);
    }
  }

  // 2. Month name + day: "Dec 5", "December 12th, 2026"
  const monthFirst = text.match(
    /\b(?:by|before|due|deadline|on|until|til)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/i,
  );
  if (monthFirst) {
    const month = MONTH_INDEX[monthFirst[1].toLowerCase()];
    const day = Number(monthFirst[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      let year = monthFirst[3] ? Number(monthFirst[3]) : base.getFullYear();
      let candidate = new Date(year, month, day);
      if (!monthFirst[3] && candidate < base) {
        year += 1;
        candidate = new Date(year, month, day);
      }
      if (!Number.isNaN(candidate.getTime())) return formatIsoDate(candidate);
    }
  }

  // 3. Day + Month name: "5th December", "12 Dec 2026"
  const dayFirst = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:,?\s*(20\d{2}))?\b/i,
  );
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = MONTH_INDEX[dayFirst[2].toLowerCase()];
    if (month !== undefined && day >= 1 && day <= 31) {
      let year = dayFirst[3] ? Number(dayFirst[3]) : base.getFullYear();
      let candidate = new Date(year, month, day);
      if (!dayFirst[3] && candidate < base) {
        year += 1;
        candidate = new Date(year, month, day);
      }
      if (!Number.isNaN(candidate.getTime())) return formatIsoDate(candidate);
    }
  }

  // 4. Relative days/weeks: "in 5 days", "within 2 weeks", "net 7 days"
  const relativeSpan = text.match(
    /\b(?:in|within|net)\s+(\d{1,2})\s+(day|days|week|weeks)\b/i,
  );
  if (relativeSpan) {
    const count = Number(relativeSpan[1]);
    const isWeeks = relativeSpan[2].toLowerCase().startsWith("week");
    const target = new Date(base);
    target.setDate(target.getDate() + (isWeeks ? count * 7 : count));
    return formatIsoDate(target);
  }

  // 5. Tomorrow
  if (/\btomorrow\b/i.test(text)) {
    const target = new Date(base);
    target.setDate(target.getDate() + 1);
    return formatIsoDate(target);
  }

  // 6. End of week / end of month
  if (/\b(?:end of (?:the )?week|eow)\b/i.test(text)) {
    const target = new Date(base);
    const diff = (5 - target.getDay() + 7) % 7 || 7;
    target.setDate(target.getDate() + diff);
    return formatIsoDate(target);
  }
  if (/\b(?:end of (?:the )?month|eom)\b/i.test(text)) {
    const target = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return formatIsoDate(target);
  }

  // 7. "next Friday", "by Friday", "before Monday"
  const weekdayMatch = text.match(
    /\b(next|this|by|before|on)\s+(monday|mon|tuesday|tues?|wednesday|wed|thursday|thurs?|friday|fri|saturday|sat|sunday|sun)\b/i,
  );
  if (weekdayMatch) {
    const qualifier = weekdayMatch[1].toLowerCase();
    const targetDay = WEEKDAY_INDEX[weekdayMatch[2].toLowerCase()];
    if (targetDay !== undefined) {
      const currentDay = base.getDay();
      let delta = (targetDay - currentDay + 7) % 7;
      if (delta === 0) delta = 7;
      if (qualifier === "next" && delta <= 2) {
        delta += 7;
      }
      const target = new Date(base);
      target.setDate(target.getDate() + delta);
      return formatIsoDate(target);
    }
  }

  return null;
}

function extractSignoffName(text: string): string | null {
  const signoffMatch = text.match(
    /(?:thanks(?:\s+again)?|thank\s+you|best(?:\s+regards)?|kind\s+regards|regards|cheers|sincerely)[,!.\s]*\n+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
  );
  if (signoffMatch) return signoffMatch[1].trim();
  return null;
}

export function matchOrSuggestClient(
  rawText: string,
  cleanedText: string,
  senderHints: string[],
  clients: readonly ClientMatchCandidate[],
): {
  matchedClient: ClientMatchCandidate | null;
  clientConfidence: number | null;
  suggestedClient: AiSuggestedClient | null;
} {
  const activeClients = clients.filter((c) => !c.archivedAt);
  const emailMatch = rawText.match(
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  );
  const extractedEmail = emailMatch ? emailMatch[1].toLowerCase() : undefined;

  const phoneMatch = rawText.match(
    /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/,
  );
  const rawPhone =
    phoneMatch && normalizePhoneDigits(phoneMatch[0]).length >= 9
      ? phoneMatch[0].trim()
      : undefined;
  const extractedPhoneDigits = rawPhone ? normalizePhoneDigits(rawPhone) : "";

  // 1. Exact email match
  if (extractedEmail) {
    const byEmail = activeClients.find(
      (c) => c.email.trim().toLowerCase() === extractedEmail,
    );
    if (byEmail) {
      return {
        matchedClient: byEmail,
        clientConfidence: 0.99,
        suggestedClient: null,
      };
    }
  }

  // 2. Phone / WhatsApp tail match (last 9 digits)
  if (extractedPhoneDigits.length >= 9) {
    const tail = extractedPhoneDigits.slice(-9);
    const byPhone = activeClients.find((c) => {
      const p1 = c.phone ? normalizePhoneDigits(c.phone) : "";
      const p2 = c.whatsappPhone ? normalizePhoneDigits(c.whatsappPhone) : "";
      return (
        (p1.length >= 9 && p1.endsWith(tail)) ||
        (p2.length >= 9 && p2.endsWith(tail))
      );
    });
    if (byPhone) {
      return {
        matchedClient: byPhone,
        clientConfidence: 0.96,
        suggestedClient: null,
      };
    }
  }

  // 3. Name / contactPerson / domain fuzzy match against senderHints + text
  const searchableRaw = normalizeToken(`${senderHints.join(" ")} ${cleanedText}`);
  const extractedDomain = extractedEmail
    ? extractedEmail.split("@")[1]?.split(".")[0]
    : "";
  const genericDomains = new Set([
    "gmail",
    "yahoo",
    "outlook",
    "hotmail",
    "icloud",
    "proton",
    "protonmail",
    "live",
    "me",
  ]);

  let bestClient: ClientMatchCandidate | null = null;
  let bestScore = 0;

  for (const client of activeClients) {
    const nameNorm = normalizeToken(client.name);
    const contactNorm = normalizeToken(client.contactPerson || "");
    let score = 0;

    if (nameNorm.length >= 3 && searchableRaw.includes(nameNorm)) {
      score = Math.max(score, 0.92);
    }
    if (contactNorm.length >= 3 && searchableRaw.includes(contactNorm)) {
      score = Math.max(score, 0.9);
    }

    // Check individual words from sender hints
    for (const hint of senderHints) {
      const hintNorm = normalizeToken(hint.replace(/<[^>]+>/g, ""));
      if (!hintNorm) continue;
      if (hintNorm === nameNorm || hintNorm === contactNorm) {
        score = Math.max(score, 0.95);
      } else if (
        hintNorm.length >= 3 &&
        (nameNorm.includes(hintNorm) || contactNorm.includes(hintNorm))
      ) {
        score = Math.max(score, 0.84);
      }
    }

    // Corporate email domain match
    if (
      extractedDomain &&
      extractedDomain.length >= 3 &&
      !genericDomains.has(extractedDomain) &&
      nameNorm.replace(/\s+/g, "").includes(extractedDomain)
    ) {
      score = Math.max(score, 0.86);
    }

    if (score > bestScore) {
      bestScore = score;
      bestClient = client;
    }
  }

  if (bestClient && bestScore >= 0.8) {
    return {
      matchedClient: bestClient,
      clientConfidence: bestScore,
      suggestedClient: null,
    };
  }

  // 4. Otherwise build a suggested new client if we have any sender identity
  let senderName = "";
  for (const hint of senderHints) {
    const stripped = hint
      .replace(/<[^>]+>/g, "")
      .replace(/["']/g, "")
      .trim();
    if (stripped && !stripped.includes("@") && stripped.length >= 2) {
      senderName = stripped;
      break;
    }
  }
  if (!senderName) {
    senderName = extractSignoffName(cleanedText) || "";
  }
  if (!senderName && extractedEmail) {
    const localPart = extractedEmail.split("@")[0] || "";
    const parts = localPart
      .split(/[._-]+/)
      .filter((p) => p.length > 1)
      .map((p) => p[0].toUpperCase() + p.slice(1));
    senderName = parts.join(" ");
  }

  if (senderName || extractedEmail || rawPhone) {
    return {
      matchedClient: null,
      clientConfidence: null,
      suggestedClient: {
        name: senderName || "New Client",
        ...(extractedEmail ? { email: extractedEmail } : {}),
        ...(senderName ? { contactPerson: senderName } : {}),
        ...(rawPhone ? { phone: rawPhone, whatsappPhone: rawPhone } : {}),
      },
    };
  }

  return {
    matchedClient: null,
    clientConfidence: null,
    suggestedClient: null,
  };
}

function parseLineItemDetails(rawItem: string): {
  description: string;
  quantity: number;
  unitPrice: string | null;
} {
  let text = rawItem
    .replace(/^[\s•●▪◦‣–—*+-]+/, "")
    .replace(/^\d{1,2}\s*[.):-]\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .trim();

  // Extract inline price e.g. "Landing page - $300", "Logo (Rs. 15,000)", "API setup 45k LKR"
  let unitPrice: string | null = null;
  const pricePatterns = [
    /(?:[-–—:@(]\s*)?(?:CA\$|US\$|\$|€|£|LKR|USD|EUR|GBP|CAD|Rs\.?)\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k)?\b\s*\)?/i,
    /(?:[-–—:@(]\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*(k)?\s*(?:LKR|USD|EUR|GBP|CAD|Rs\.?)\b\s*\)?/i,
  ];
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseAmountToken(match[1], match[2]);
      if (parsed) {
        unitPrice = parsed;
        text = text.replace(match[0], " ").trim();
        break;
      }
    }
  }

  // Extract inline quantity e.g. "2x Product pages", "3x icons", "(qty: 4)"
  let quantity = 1;
  const qtyPrefix = text.match(/^(\d{1,3})\s*[x×]\s+(.+)$/i);
  if (qtyPrefix) {
    quantity = Math.max(1, Number.parseInt(qtyPrefix[1], 10) || 1);
    text = qtyPrefix[2].trim();
  } else {
    const qtySuffix = text.match(/\(\s*(?:qty|quantity|x)\s*[:=]?\s*(\d{1,3})\s*\)/i);
    if (qtySuffix) {
      quantity = Math.max(1, Number.parseInt(qtySuffix[1], 10) || 1);
      text = text.replace(qtySuffix[0], " ").trim();
    }
  }

  // Clean leading conversational scaffolding
  text = text
    .replace(
      /^(?:please\s+|pls\s+|can\s+you\s+(?:also\s+)?|could\s+you\s+(?:also\s+)?|we\s+(?:also\s+)?need\s+(?:you\s+to\s+)?|i\s+(?:also\s+)?need\s+(?:you\s+to\s+)?|also\s+|and\s+also\s+|oh\s+and\s+|don't\s+forget\s+(?:the\s+|to\s+)?|remember\s+to\s+|my\s+\w+\s+wants\s+(?:us\s+to\s+)?)/i,
      "",
    )
    .replace(/\s+(?:by|before|until)\s+(?:next\s+|this\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|\d{1,2}(?:st|nd|rd|th)?\s+\w+|\w+\s+\d{1,2}(?:st|nd|rd|th)?).*$/i, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s*[-–—:,;]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > 0) {
    text = text[0].toUpperCase() + text.slice(1);
  }

  return {
    description: text.slice(0, 220),
    quantity,
    unitPrice,
  };
}

function isLikelyDeliverableClause(segment: string): boolean {
  const trimmed = segment.trim();
  if (trimmed.length < 4 || trimmed.length > 260) return false;
  if (GREETING_OR_CLOSING_RE.test(trimmed)) return false;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return false;
  if (/^(?:budget|total|deadline|due\s+date|link|folder|drive|repo|email|phone|whatsapp)\b/i.test(trimmed)) {
    return false;
  }
  if (/^(?:here(?:'s|\s+is)\s+(?:our|the)\s+(?:link|folder|drive|repo|figma|doc))/i.test(trimmed)) {
    return false;
  }
  return true;
}

export function extractCandidateSegments(cleanedText: string): {
  segments: string[];
  structuredListFound: boolean;
} {
  const lines = cleanedText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Check if the message already uses numbered or bulleted lists
  const listLines = lines.filter((line) =>
    /^(?:[-•●▪◦‣*+]|\d{1,2}\s*[.):-]|\[\s?[xX ]?\])\s+/.test(line),
  );

  if (listLines.length >= 1) {
    return {
      segments: listLines,
      structuredListFound: true,
    };
  }

  // Otherwise break prose into clauses around sentence boundaries and "and also / plus / oh and"
  const rawClauses: string[] = [];
  for (const line of lines) {
    const withoutUrls = line.replace(/https?:\/\/\S+/gi, " ").trim();
    if (!withoutUrls) continue;
    const sentences = withoutUrls.split(/(?<=[.!?])\s+|\s*;\s*|\s+—\s+|\s+-\s+(?=[A-Z])/);
    for (const sentence of sentences) {
      const subParts = sentence.split(
        /,?\s+(?:and\s+also|oh\s+and|plus|as\s+well\s+as|and\s+(?=(?:add|build|create|fix|update|design|connect|integrate|set\s+up|deploy|don't\s+forget|do|make|refresh|implement)\b))/i,
      );
      for (const part of subParts) {
        const clean = part.trim();
        if (clean) rawClauses.push(clean);
      }
    }
  }

  return {
    segments: rawClauses,
    structuredListFound: false,
  };
}

export function extractBudgetHint(text: string): string | null {
  const match = text.match(
    /\b(?:budget|around|approx(?:imately)?|max(?:imum)?|total)\s*(?:is|of|:)?\s*(?:around|about|~)?\s*(?:CA\$|US\$|\$|€|£|LKR|USD|EUR|GBP|CAD|Rs\.?)?\s*(\d[\d,]*(?:\.\d{1,2})?\s*k?)\s*(?:LKR|USD|EUR|GBP|CAD|Rs\.?)?/i,
  );
  return match ? match[0].trim() : null;
}

export function parseMessageDeterministically(
  rawText: string,
  clients: readonly ClientMatchCandidate[],
  now = new Date(),
): DeterministicParseResult {
  const { cleanedText, senderHints, subjectHint } = cleanMessageText(rawText);
  const deliveryUrl = extractDeliveryUrl(rawText);
  const currency = extractCurrency(rawText);
  const dueDate = extractDueDate(cleanedText, now);
  const budgetHint = extractBudgetHint(cleanedText);
  const { matchedClient, clientConfidence, suggestedClient } =
    matchOrSuggestClient(rawText, cleanedText, senderHints, clients);

  const { segments, structuredListFound } = extractCandidateSegments(cleanedText);

  const candidateItems: AiExtractedDeliverable[] = [];
  const seenDescriptions = new Set<string>();

  for (const segment of segments) {
    if (!isLikelyDeliverableClause(segment)) continue;
    const details = parseLineItemDetails(segment);
    if (details.description.length < 3) continue;

    // In freeform prose, require either an action verb, explicit price, or clear deliverable noun
    if (
      !structuredListFound &&
      !ACTION_VERBS_RE.test(segment) &&
      !details.unitPrice &&
      segments.length > 1
    ) {
      // Still keep if it contains strong project/deliverable nouns
      if (
        !/\b(?:page|site|website|app|api|logo|banner|dashboard|design|integration|feature|bug|fix|checkout|payment|login|auth|database|migration|report|bot|script|component|module|screen|form|customizer|ordering|seo|hosting|deployment|maintenance)\b/i.test(
          details.description,
        )
      ) {
        continue;
      }
    }

    const dedupeKey = details.description.toLowerCase();
    if (seenDescriptions.has(dedupeKey)) continue;
    seenDescriptions.add(dedupeKey);

    candidateItems.push({
      id: `ai-item-${candidateItems.length + 1}`,
      description: details.description,
      quantity: details.quantity,
      unitPrice: details.unitPrice,
      priceSource: details.unitPrice ? "message" : null,
      catalogId: null,
      catalogTitle: null,
      catalogMatchScore: null,
      confidence: structuredListFound ? 0.9 : ACTION_VERBS_RE.test(segment) ? 0.82 : 0.7,
    });
  }

  // Fallback to subject line or first meaningful sentence if nothing matched
  if (candidateItems.length === 0) {
    const fallbackTitle =
      subjectHint ||
      cleanedText
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length >= 6 && !GREETING_OR_CLOSING_RE.test(l));
    if (fallbackTitle) {
      const details = parseLineItemDetails(fallbackTitle);
      if (details.description.length >= 3) {
        candidateItems.push({
          id: "ai-item-1",
          description: details.description,
          quantity: details.quantity,
          unitPrice: details.unitPrice,
          priceSource: details.unitPrice ? "message" : null,
          catalogId: null,
          catalogTitle: null,
          catalogMatchScore: null,
          confidence: 0.55,
        });
      }
    }
  }

  const noteParts: string[] = [];
  if (subjectHint) noteParts.push(`Subject: ${subjectHint}`);
  if (budgetHint) noteParts.push(`Client note: ${budgetHint}`);

  return {
    cleanedText,
    matchedClient,
    clientConfidence,
    suggestedClient,
    currency: currency ?? matchedClient?.currency ?? null,
    dueDate,
    deliveryUrl: deliveryUrl ?? matchedClient?.driveUrl ?? null,
    notes: noteParts.length > 0 ? noteParts.join(" · ") : null,
    candidateItems: candidateItems.slice(0, 15),
    rawSegments: segments,
    budgetHint,
  };
}

/** Lightweight lexical fallback matcher used when neural embeddings are unavailable. */
export function matchCatalogLexically(
  description: string,
  catalogItems: readonly CatalogMatchCandidate[],
): { item: CatalogMatchCandidate; score: number } | null {
  const descTokens = new Set(
    normalizeToken(description)
      .split(" ")
      .filter((t) => t.length >= 3),
  );
  if (descTokens.size === 0 || catalogItems.length === 0) return null;

  let best: { item: CatalogMatchCandidate; score: number } | null = null;
  for (const cat of catalogItems) {
    const catTokens = new Set(
      normalizeToken(`${cat.title} ${cat.description} ${cat.category}`)
        .split(" ")
        .filter((t) => t.length >= 3),
    );
    if (catTokens.size === 0) continue;
    let overlap = 0;
    for (const token of descTokens) {
      if (catTokens.has(token)) overlap += 1;
    }
    const score = overlap / Math.sqrt(descTokens.size * catTokens.size);
    if (score >= 0.45 && (!best || score > best.score)) {
      best = { item: cat, score: Math.min(0.95, Number(score.toFixed(2))) };
    }
  }
  return best;
}
