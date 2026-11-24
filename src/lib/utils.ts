import {
  addMonths as addJalaliMonthsToDate,
  format as formatJalali,
  getDate as getJalaliDate,
  getMonth as getJalaliMonth,
  getYear as getJalaliYear,
  parse as parseJalali,
  startOfMonth as startOfJalaliMonth,
} from "date-fns-jalali";

export const IRAN_TIME_ZONE = "Asia/Tehran";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert 0-9 to Eastern Arabic (Persian) digits. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/** Normalize Persian/Arabic-Indic digits back to Latin digits. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

const iranDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: IRAN_TIME_ZONE,
  calendar: "gregory",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's date in Iran, as a Gregorian `YYYY-MM-DD` key.
 * Dates are kept in this ISO form in the database and only rendered in Jalali.
 */
export function getIranTodayISO(date: Date = new Date()): string {
  const parts = iranDateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Parse a `YYYY-MM-DD` Gregorian key as a local date at noon (DST-safe). */
export function parseISODate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return new Date(NaN);
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );
}

/** Format a Date as a Gregorian `YYYY-MM-DD` key. */
export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Jalali date (`yyyy-MM-dd`, Latin digits) for the given date / ISO key. */
export function getJalaliISODate(
  value: string | Date | null | undefined = getIranTodayISO()
): string {
  const source = value === undefined ? getIranTodayISO() : value;
  const date = parseISODate(source);
  if (Number.isNaN(date.getTime())) return "";
  return formatJalali(date, "yyyy-MM-dd");
}

/** First day of the current Jalali month, as a Gregorian ISO key. */
export function getIranMonthStartISO(date: Date = new Date()): string {
  const today = parseISODate(getIranTodayISO(date));
  return toISODate(startOfJalaliMonth(today));
}

/** Add Jalali months to an ISO key and return the resulting Gregorian ISO key. */
export function addJalaliMonthsISO(isoDate: string, months: number): string {
  const date = parseISODate(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return toISODate(addJalaliMonthsToDate(date, months));
}

/** Add Gregorian days to an ISO key (used for SMS reminder windows). */
export function addDaysISO(isoDate: string, days: number): string {
  const date = parseISODate(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Jalali date formatted for date inputs / pickers: `۱۴۰۵/۰۱/۰۱`. */
export function formatJalaliInput(
  value: string | Date | null | undefined
): string {
  if (!value) return "";
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return "";
  return toPersianDigits(formatJalali(date, "yyyy/MM/dd"));
}

/**
 * Convert a typed Jalali date (`۱۴۰۵/۰۱/۰۱` or `1405-01-01`) into a Gregorian
 * ISO key. Returns null when the date is invalid.
 */
export function parseJalaliInput(value: string): string | null {
  const normalized = toLatinDigits(value.trim()).replace(/[-–]/g, "/");
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const padded = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  const parsed = parseJalali(padded, "yyyy/MM/dd", new Date(2020, 0, 1, 12));

  if (
    Number.isNaN(parsed.getTime()) ||
    getJalaliYear(parsed) !== year ||
    getJalaliMonth(parsed) !== month - 1 ||
    getJalaliDate(parsed) !== day
  ) {
    return null;
  }

  return toISODate(parsed);
}

/**
 * Accept dates from API clients either as a Gregorian ISO key (what we store)
 * or as a Jalali date typed by a user.
 */
export function normalizeDateInput(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return parseJalaliInput(trimmed);
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
}

export function formatNumber(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fa-IR").format(num);
}

const jalaliDateFormatter = new Intl.DateTimeFormat("fa-IR", {
  calendar: "persian",
  timeZone: IRAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const jalaliLongFormatter = new Intl.DateTimeFormat("fa-IR", {
  calendar: "persian",
  timeZone: IRAN_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const jalaliDateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  calendar: "persian",
  timeZone: IRAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDisplayDate(date: string | Date | null | undefined): Date {
  return typeof date === "string" ? new Date(date) : (date as Date);
}

/** Render any stored date/timestamp as a Solar Hijri date in Iran time. */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = toDisplayDate(date);
  if (Number.isNaN(d.getTime())) return "-";
  return jalaliDateFormatter.format(d);
}

export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = toDisplayDate(date);
  if (Number.isNaN(d.getTime())) return "-";
  return jalaliLongFormatter.format(d);
}

/** Render a timestamp with its time, converted to Iran time. */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = toDisplayDate(date);
  if (Number.isNaN(d.getTime())) return "-";
  return jalaliDateTimeFormatter.format(d);
}

export function generateMemberCode(): string {
  const prefix = "M";
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${timestamp}${random}`;
}

export function generateLoanCode(): string {
  const prefix = "L";
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${timestamp}${random}`;
}

export function calculateInstallments(
  principal: number,
  interestRate: number,
  installmentCount: number
): {
  installmentAmount: number;
  totalPayable: number;
  totalInterest: number;
} {
  if (interestRate === 0) {
    const installmentAmount = principal / installmentCount;
    return {
      installmentAmount: Math.ceil(installmentAmount),
      totalPayable: principal,
      totalInterest: 0,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const installmentAmount =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, installmentCount)) /
    (Math.pow(1 + monthlyRate, installmentCount) - 1);

  const totalPayable = installmentAmount * installmentCount;
  const totalInterest = totalPayable - principal;

  return {
    installmentAmount: Math.ceil(installmentAmount),
    totalPayable: Math.ceil(totalPayable),
    totalInterest: Math.ceil(totalInterest),
  };
}

/** @deprecated Use `addJalaliMonthsISO` for stored dates. */
export function addMonths(date: Date, months: number): Date {
  return addJalaliMonthsToDate(date, months);
}

/** @deprecated Use `formatDate` for Jalali dates in Iran time. */
export function toJalali(date: Date | string): string {
  return formatDate(date);
}

export function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}
