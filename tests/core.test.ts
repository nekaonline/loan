import test from "node:test";
import assert from "node:assert/strict";
import {
  addJalaliMonthsISO,
  formatDate,
  formatJalaliInput,
  getIranTodayISO,
  normalizeDateInput,
  parseJalaliInput,
} from "../src/lib/utils";
import { maxAmountForRole } from "../src/lib/policy";
import { clientKey, rateLimit } from "../src/lib/rate-limit";

test("Iran date helpers stay in Solar Hijri", () => {
  assert.match(getIranTodayISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(parseJalaliInput("۱۴۰۵/۰۱/۰۱"), "2026-03-21");
  assert.equal(formatJalaliInput("2026-03-21"), "۱۴۰۵/۰۱/۰۱");
  assert.equal(addJalaliMonthsISO("2026-03-21", 1), "2026-04-21");
  assert.equal(normalizeDateInput("۱۴۰۵/۰۹/۰۳"), "2026-11-24");
  assert.equal(formatDate("2026-11-23T22:30:00Z"), "۱۴۰۵/۰۹/۰۳");
});

test("normalizeDateInput accepts ISO keys and Jalali dates in any form", () => {
  assert.equal(normalizeDateInput("2024-08-31"), "2024-08-31");
  assert.equal(normalizeDateInput("1403/06/10"), "2024-08-31");
  assert.equal(normalizeDateInput("1403-06-10"), "2024-08-31");
  assert.equal(normalizeDateInput("۱۴۰۳-۰۶-۱۰"), "2024-08-31");
  assert.equal(normalizeDateInput("1403/13/01"), null);
  assert.equal(normalizeDateInput(""), null);
});

test("role based loan cap never exceeds the fund cap", () => {
  const policy = {
    maxLoanAmount: 100_000_000,
    maxManagerLoanAmount: 50_000_000,
    maxActiveLoansPerMember: 1,
  };
  assert.equal(maxAmountForRole(policy, "admin"), 100_000_000);
  assert.equal(maxAmountForRole(policy, "manager"), 50_000_000);
});

test("public endpoint rate limiter blocks repeated requests", () => {
  const key = `test:${Date.now()}`;
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), false);
  assert.equal(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
});

test("backup dry-run validation detects incomplete files", async () => {
  process.env.DATABASE_URL ||= "postgresql://postgres:123@127.0.0.1:5432/loan_db";
  const { validateBackupPayload } = await import("../src/lib/backup");

  const invalid = validateBackupPayload({ version: "1.1", data: {} });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.length > 0);

  const valid = validateBackupPayload({
    version: "1.1",
    data: {
      members: [], loans: [], installments: [], fundTransactions: [],
      settings: [], users: [], guarantors: [], guarantorships: [],
      attachments: [], reportTemplates: [],
    },
  });
  assert.equal(valid.valid, true);
});
