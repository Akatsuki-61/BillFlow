import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ipcMain } from "./security";
import { getRootDatabasePath } from "./db";
import { atomicWrite } from "./managed-files";
import type {
  ExchangeRates,
  ExchangeRateState,
} from "../src/lib/currency-conversion";

const rate = z.number().finite().min(1e-6).max(500_000);
const ratesSchema = z.object({
  USD: z.literal(1),
  LKR: rate,
  EUR: rate,
  GBP: rate,
  CAD: rate,
});
const snapshotSchema = z.object({
  base: z.literal("USD"),
  rates: ratesSchema,
  updatedAt: z.string().datetime(),
  nextUpdateAt: z.string().datetime(),
  fetchedAt: z.string().datetime(),
  provider: z.literal("ExchangeRate-API"),
});
let inFlight: Promise<ExchangeRateState> | null = null;
let lastAttempt = 0;
let lastError: string | null = null;
function cachePath() {
  return path.join(path.dirname(getRootDatabasePath()), "exchange-rates.json");
}
export function cachedExchangeRates(): ExchangeRates | null {
  try {
    if (fs.statSync(cachePath()).size > 16_384) return null;
    return snapshotSchema.parse(
      JSON.parse(fs.readFileSync(cachePath(), "utf8")),
    );
  } catch {
    return null;
  }
}
/** Fixed public endpoint: no business records, credentials, or renderer-supplied URLs. */
export function fetchPublicExchangeRates(): Promise<ExchangeRates> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      "https://open.er-api.com/v6/latest/USD",
      { headers: { Accept: "application/json" } },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error("Exchange rates are temporarily unavailable."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 128 * 1024) {
            request.destroy(
              new Error("The exchange-rate response is too large."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const value = z
              .object({
                result: z.literal("success"),
                base_code: z.literal("USD"),
                rates: ratesSchema,
                time_last_update_unix: z.number().int().positive(),
                time_next_update_unix: z.number().int().positive(),
              })
              .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            const now = Date.now();
            if (
              value.time_last_update_unix * 1000 > now + 86_400_000 ||
              value.time_last_update_unix * 1000 < now - 30 * 86_400_000 ||
              value.time_next_update_unix <= value.time_last_update_unix ||
              value.time_next_update_unix * 1000 > now + 7 * 86_400_000
            )
              throw new Error("Invalid exchange-rate timestamp.");
            resolve({
              base: "USD",
              rates: value.rates,
              provider: "ExchangeRate-API",
              updatedAt: new Date(
                value.time_last_update_unix * 1000,
              ).toISOString(),
              nextUpdateAt: new Date(
                value.time_next_update_unix * 1000,
              ).toISOString(),
              fetchedAt: new Date(now).toISOString(),
            });
          } catch {
            reject(
              new Error("The exchange-rate response could not be validated."),
            );
          }
        });
      },
    );
    const deadline = setTimeout(
      () =>
        request.destroy(
          new Error(
            "Exchange-rate request timed out. Cached rates remain available.",
          ),
        ),
      8000,
    );
    request.once("close", () => clearTimeout(deadline));
    request.on("error", reject);
  });
}
export async function loadExchangeRates(): Promise<ExchangeRateState> {
  const cached = cachedExchangeRates();
  if (
    process.env.BILLFLOW_DISABLE_RATE_FETCH === "1" ||
    process.env.VITEST ||
    process.env.NODE_ENV === "test"
  )
    return { snapshot: cached, error: null };
  if (cached) {
    const freshUntil = Math.min(
      Date.parse(cached.nextUpdateAt),
      Date.parse(cached.fetchedAt) + 7 * 86_400_000,
    );
    if (Date.now() < freshUntil) return { snapshot: cached, error: null };
  }
  if (inFlight) return inFlight;
  if (Date.now() - lastAttempt < 60_000)
    return { snapshot: cached, error: lastError };
  lastAttempt = Date.now();
  inFlight = (async () => {
    try {
      const snapshot = await fetchPublicExchangeRates();
      atomicWrite(cachePath(), JSON.stringify(snapshot), 0o600);
      lastError = null;
      return { snapshot, error: null };
    } catch {
      lastError =
        "Could not update exchange rates. Connect to the internet and try again.";
      return { snapshot: cached, error: lastError };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
export function registerExchangeRateHandlers() {
  ipcMain.handle("currency:rates", () => loadExchangeRates());
}
