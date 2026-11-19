import type { RecurringCadence } from "../src/types/recurring";

function parseDateParts(dateStr: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid YYYY-MM-DD schedule date: ${dateStr}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }
  return [year, month, day];
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInUtcMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function addDaysToDateKey(dateStr: string, days: number): string {
  const [year, month, day] = parseDateParts(dateStr);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return formatUtcDate(next);
}

export function advanceScheduleDate(
  dateStr: string,
  cadence: RecurringCadence,
  anchorDayOfMonth?: number | null,
): string {
  const [year, month, day] = parseDateParts(dateStr);
  if (cadence === "weekly") {
    return addDaysToDateKey(dateStr, 7);
  }
  if (cadence === "biweekly") {
    return addDaysToDateKey(dateStr, 14);
  }

  const monthOffset =
    cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  const targetDay = anchorDayOfMonth ?? day;
  const totalMonths = year * 12 + (month - 1) + monthOffset;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth1Based = (totalMonths % 12) + 1;
  const clampedDay = Math.min(
    targetDay,
    daysInUtcMonth(targetYear, targetMonth1Based),
  );
  return formatUtcDate(
    new Date(Date.UTC(targetYear, targetMonth1Based - 1, clampedDay)),
  );
}

export function advanceSchedulePastDate(
  nextRunDate: string,
  today: string,
  cadence: RecurringCadence,
  anchorDayOfMonth?: number | null,
): string {
  const [, , initialDay] = parseDateParts(nextRunDate);
  const anchor = anchorDayOfMonth ?? initialDay;
  let candidate = advanceScheduleDate(nextRunDate, cadence, anchor);
  let guard = 0;
  while (candidate <= today && guard < 1200) {
    candidate = advanceScheduleDate(candidate, cadence, anchor);
    guard++;
  }
  return candidate;
}
