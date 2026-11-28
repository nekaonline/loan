#!/usr/bin/env node
/**
 * End-to-end API smoke test for the loan fund app.
 *
 * ⚠️  It CREATES and DELETES data and runs a backup RESTORE.
 *     Run it ONLY against a disposable test database, never production.
 *
 * Usage:
 *   1. Start the app on a test DB:   DATABASE_URL=postgresql://.../loan_test npm run dev
 *   2. Run:                          BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
 *
 * Exit code is non-zero when any check fails.
 */

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

let passed = 0;
const failures = [];
const uniq = Date.now().toString().slice(-7);

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failures.push(`${name} ${detail}`);
    console.log(`  ✘ ${name} ${detail}`);
  }
}

function section(title) {
  console.log(`\n▶ ${title}`);
}

/** Minimal client that keeps its own auth cookie (one per simulated user). */
function client() {
  let cookie = "";
  return async function call(method, path, body, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (cookie) headers.cookie = cookie;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, { method, headers, body: payload });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const m = /auth_token=([^;]*)/.exec(setCookie);
      if (m) cookie = m[1] ? `auth_token=${m[1]}` : "";
    }
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json().catch(() => null) : await res.text();
    return { status: res.status, data, headers: res.headers, setCookie };
  };
}

async function main() {
  console.log(`Smoke test against ${BASE}`);
  const admin = client();
  const anon = client();

  section("Health & init");
  let r = await anon("GET", "/api/health");
  check("GET /api/health -> ok", r.status === 200 && r.data?.ok === true, JSON.stringify(r.data));
  r = await anon("POST", "/api/init");
  check("POST /api/init (idempotent)", r.status === 200, JSON.stringify(r.data));
  r = await anon("GET", "/");
  check("GET / renders HTML", r.status === 200 && String(r.data).includes("<html"));

  section("Auth");
  r = await anon("GET", "/api/auth/me");
  check("me without login -> 401", r.status === 401);
  r = await anon("POST", "/api/auth/login", { username: ADMIN_USER, password: "wrong" });
  check("wrong password -> 401", r.status === 401);
  r = await admin("POST", "/api/auth/login", { username: ADMIN_USER, password: ADMIN_PASS });
  check("admin login", r.status === 200 && r.data?.user?.role === "admin", JSON.stringify(r.data));
  check("cookie is NOT Secure over http (LAN fix)", !/;\s*secure/i.test(r.setCookie || ""), r.setCookie);
  r = await admin("GET", "/api/auth/me");
  check("me after login", r.status === 200 && r.data?.user?.username === ADMIN_USER);

  section("Settings");
  r = await admin("GET", "/api/settings");
  check("GET settings", r.status === 200 && r.data?.settings?.fund_name);
  const originalSettings = r.data?.settings || {};
  r = await admin("POST", "/api/settings", {
    settings: { max_loan_amount: "100000000", max_loan_amount_manager: "50000000", max_active_loans_per_member: "1" },
  });
  check("POST settings (admin)", r.status === 200);

  section("Users & roles");
  const managerName = `mgr${uniq}`;
  const viewerName = `view${uniq}`;
  r = await admin("POST", "/api/users", { username: managerName, password: "pass1234", fullName: "کارشناس تست", role: "manager" });
  check("create manager user", r.status === 201, JSON.stringify(r.data));
  const managerId = r.data?.user?.id;
  r = await admin("POST", "/api/users", { username: viewerName, password: "pass1234", fullName: "مشاهده‌گر تست", role: "viewer" });
  check("create viewer user", r.status === 201);
  const viewerId = r.data?.user?.id;
  r = await admin("POST", "/api/users", { username: managerName, password: "x", fullName: "dup" });
  check("duplicate username rejected", r.status === 400);
  r = await admin("GET", "/api/users");
  check("list users", r.status === 200 && r.data.users.some((u) => u.username === managerName));

  const manager = client();
  const viewer = client();
  r = await manager("POST", "/api/auth/login", { username: managerName, password: "pass1234" });
  check("manager login", r.status === 200);
  r = await viewer("POST", "/api/auth/login", { username: viewerName, password: "pass1234" });
  check("viewer login", r.status === 200);
  r = await viewer("GET", "/api/users");
  check("viewer cannot list users -> 403", r.status === 403);
  r = await manager("GET", "/api/settings");
  check("manager sees masked api key", r.status === 200 && (r.data.settings.sms_api_key === "***" || r.data.settings.sms_api_key === undefined));
  r = await manager("POST", "/api/settings", { settings: { fund_name: "x" } });
  check("manager cannot change settings -> 403", r.status === 403);

  section("Members");
  const nid = `00${uniq}1`.slice(-10);
  r = await admin("POST", "/api/members", {
    firstName: "علی", lastName: "تستی", nationalId: nid, phone: `0912${uniq}`,
    department: "اورژانس", joinDate: "1403/01/15",
  });
  check("create member (Jalali joinDate)", r.status === 201, JSON.stringify(r.data));
  const member = r.data?.member;
  check("joinDate normalized to Gregorian", member?.joinDate === "2024-04-03", member?.joinDate);
  r = await admin("POST", "/api/members", { firstName: "x", lastName: "y", nationalId: nid, phone: "0912" });
  check("duplicate national ID rejected", r.status === 400);
  r = await viewer("POST", "/api/members", { firstName: "x", lastName: "y", nationalId: "1", phone: "1" });
  check("viewer cannot create member -> 403", r.status === 403);
  r = await admin("GET", `/api/members?search=${encodeURIComponent("تستی")}`);
  check("search members", r.status === 200 && r.data.members.some((m) => m.id === member?.id));
  r = await admin("PUT", `/api/members/${member?.id}`, { ...member, city: "ساری" });
  check("update member", r.status === 200 && r.data?.member?.city === "ساری");
  r = await admin("GET", `/api/members/${member?.id}`);
  check("member detail", r.status === 200 && Array.isArray(r.data.loans));
  const nid2 = `11${uniq}2`.slice(-10);
  r = await admin("POST", "/api/members", { firstName: "حذفی", lastName: "تست", nationalId: nid2, phone: "09110000000" });
  const tempMemberId = r.data?.member?.id;
  r = await manager("DELETE", `/api/members/${tempMemberId}`);
  check("manager cannot delete member -> 403", r.status === 403);
  r = await admin("DELETE", `/api/members/${tempMemberId}`);
  check("admin hard-deletes member without loans", r.status === 200 && /حذف/.test(r.data?.message || ""));

  section("Guarantors");
  const gnid = `22${uniq}3`.slice(-10);
  r = await admin("POST", "/api/guarantors", { firstName: "رضا", lastName: "ضامن", nationalId: gnid, phone: "09120000001" });
  check("create guarantor", r.status === 201, JSON.stringify(r.data));
  const guarantorId = r.data?.guarantor?.id;
  r = await admin("POST", "/api/guarantors", { firstName: "x" });
  check("guarantor validation", r.status === 400);
  r = await admin("GET", `/api/guarantors?search=${gnid}`);
  check("search guarantors", r.status === 200 && r.data.guarantors.length === 1);
  r = await admin("PUT", `/api/guarantors/${guarantorId}`, { firstName: "رضا", lastName: "ضامن", nationalId: gnid, phone: "09120000002" });
  check("update guarantor", r.status === 200);
  r = await admin("GET", `/api/guarantors/${guarantorId}`);
  check("guarantor detail", r.status === 200);

  section("Loans & policy");
  r = await manager("POST", "/api/loans", { memberId: member?.id, amount: "60000000", interestRate: "4", installmentCount: "12" });
  check("manager over own cap rejected", r.status === 400, JSON.stringify(r.data));
  r = await admin("POST", "/api/loans", { memberId: member?.id, amount: "0", installmentCount: "12" });
  check("zero amount rejected", r.status === 400);
  r = await admin("POST", "/api/loans", { memberId: member?.id, amount: "200000000", installmentCount: "12" });
  check("admin over fund cap rejected", r.status === 400);
  r = await manager("POST", "/api/loans", { memberId: member?.id, amount: "12000000", interestRate: "0", installmentCount: "12", requestDate: "1403/05/01" });
  check("manager creates loan", r.status === 201, JSON.stringify(r.data));
  const loan = r.data?.loan;
  check("installment amount = 1,000,000", Number(loan?.installmentAmount) === 1000000, loan?.installmentAmount);
  r = await manager("POST", "/api/loans", { memberId: member?.id, amount: "1000000", installmentCount: "2" });
  check("max active loans per member enforced", r.status === 400);
  r = await admin("GET", "/api/loans");
  check("list loans", r.status === 200 && r.data.loans.some((l) => l.id === loan?.id));
  r = await admin("PUT", `/api/loans/${loan?.id}`, { action: "disburse" });
  check("cannot disburse before approval", r.status === 400);
  r = await admin("PUT", `/api/loans/${loan?.id}`, { action: "approve" });
  check("approve loan", r.status === 200 && r.data?.loan?.status === "approved");
  r = await admin("PUT", `/api/loans/${loan?.id}`, { action: "disburse", disbursementDate: "1403/05/10", firstInstallmentDate: "1403/06/10" });
  check("disburse loan", r.status === 200 && r.data?.loan?.status === "active", JSON.stringify(r.data));
  r = await admin("GET", `/api/loans/${loan?.id}`);
  check("12 installments generated", r.status === 200 && r.data.installments.length === 12, String(r.data?.installments?.length));
  const insts = r.data?.installments || [];
  check("first due date = 1403/06/10 (2024-08-31)", insts[0]?.dueDate === "2024-08-31", insts[0]?.dueDate);
  check("monthly Jalali schedule (2nd = 1403/07/10 = 2024-10-01)", insts[1]?.dueDate === "2024-10-01", insts[1]?.dueDate);

  section("Loan guarantors & attachments");
  r = await admin("POST", `/api/loans/${loan?.id}/guarantors`, { guarantorId, notes: "ضمانت تست" });
  check("attach guarantor to loan", r.status === 201, JSON.stringify(r.data));
  const guarantorshipId = r.data?.guarantorship?.id;
  r = await admin("GET", `/api/loans/${loan?.id}/guarantors`);
  check("list loan guarantors", r.status === 200 && r.data.guarantors.length === 1);
  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), "test.pdf");
  form.append("loanId", String(loan?.id));
  form.append("category", "contract");
  r = await admin("POST", "/api/attachments", form);
  check("upload PDF attachment", r.status === 201, JSON.stringify(r.data));
  const attachmentId = r.data?.attachment?.id;
  const badForm = new FormData();
  badForm.append("file", new Blob(["x"], { type: "text/plain" }), "a.txt");
  badForm.append("loanId", String(loan?.id));
  r = await admin("POST", "/api/attachments", badForm);
  check("reject non PDF/image upload", r.status === 400);
  r = await admin("GET", `/api/attachments?loanId=${loan?.id}`);
  check("list attachments", r.status === 200 && r.data.attachments.length === 1);
  r = await admin("GET", `/api/attachments/${attachmentId}`);
  check("download attachment", r.status === 200 && String(r.data).startsWith("%PDF"));

  section("Installments, receipts, public inquiry");
  r = await admin("GET", `/api/installments?loanId=${loan?.id}`);
  check("list installments by loan", r.status === 200 && r.data.installments.length === 12);
  r = await admin("GET", "/api/installments?overdue=true");
  check("overdue installments query", r.status === 200 && Array.isArray(r.data.installments));
  r = await viewer("POST", `/api/installments/${insts[0]?.id}/pay`, {});
  check("viewer cannot pay -> 403", r.status === 403);
  r = await admin("POST", `/api/installments/${insts[0]?.id}/pay`, { amount: "-5" });
  check("negative payment rejected", r.status === 400);
  r = await admin("POST", `/api/installments/${insts[0]?.id}/pay`, { paidDate: "1403/06/09" });
  check("pay installment #1", r.status === 200, JSON.stringify(r.data));
  const receiptNo = r.data?.installment?.receiptNo;
  check("receipt number generated", /^RC-/.test(receiptNo || ""), receiptNo);
  r = await admin("POST", `/api/installments/${insts[0]?.id}/pay`, {});
  check("double payment rejected", r.status === 400);
  r = await admin("GET", `/api/loans/${loan?.id}`);
  check("loan paid/remaining updated", Number(r.data?.loan?.paidAmount) === 1000000 && Number(r.data?.loan?.remainingAmount) === 11000000,
    `${r.data?.loan?.paidAmount}/${r.data?.loan?.remainingAmount}`);
  r = await anon("GET", `/api/public/receipt/${encodeURIComponent(receiptNo)}`);
  check("public receipt lookup", r.status === 200 && r.data?.receipt?.loanCode === loan?.loanCode, JSON.stringify(r.data));
  r = await anon("GET", "/api/public/receipt/NOPE-123");
  check("unknown receipt -> 404", r.status === 404);
  r = await anon("GET", `/receipt/${encodeURIComponent(receiptNo)}`);
  check("receipt page renders", r.status === 200);
  r = await anon("POST", "/api/public/inquiry", { nationalId: nid, phone: `0912${uniq}`.slice(-4) });
  check("public inquiry (national id + last 4 phone)", r.status === 200 && r.data?.inquiry?.loans?.length === 1, JSON.stringify(r.data).slice(0, 200));
  r = await anon("POST", "/api/public/inquiry", { nationalId: nid, phone: "0000" });
  check("inquiry wrong phone -> 404", r.status === 404);
  r = await anon("GET", "/inquiry");
  check("inquiry page renders", r.status === 200);

  section("Fund");
  r = await admin("POST", "/api/fund", { type: "deposit", amount: 50000000, description: "واریز تست", transactionDate: "1403/05/01" });
  check("fund deposit", r.status === 201, JSON.stringify(r.data));
  r = await admin("GET", "/api/fund");
  check("fund list + balance", r.status === 200 && typeof r.data.balance === "number");

  section("Dashboard & reports");
  r = await admin("GET", "/api/dashboard");
  check("dashboard", r.status === 200, JSON.stringify(r.data).slice(0, 200));
  r = await admin("GET", "/api/reports/debtors");
  check("debtors report", r.status === 200);
  r = await admin("GET", "/api/reports/management");
  check("management report", r.status === 200, JSON.stringify(r.data).slice(0, 200));
  r = await admin("GET", "/api/reports/management?from=1403/01/01&to=1403/12/29");
  check("management report with Jalali date filter", r.status === 200 && r.data?.filters?.from === "2024-03-20", JSON.stringify(r.data?.filters));
  r = await admin("POST", "/api/reports/templates", { name: "الگوی تست", reportType: "summary", filters: { from: "1403/01/01" } });
  check("save report template", r.status === 201);
  const templateId = r.data?.template?.id;
  r = await admin("GET", "/api/reports/templates");
  check("list report templates", r.status === 200 && r.data.templates.some((t) => t.id === templateId));
  r = await admin("DELETE", `/api/reports/templates?id=${templateId}`);
  check("delete report template", r.status === 200);

  section("SMS (without provider config)");
  r = await admin("POST", "/api/sms/send", { phone: "09120000000", message: "تست" });
  check("send SMS returns graceful failure", r.status === 200 && r.data?.success === false, JSON.stringify(r.data));
  r = await admin("POST", "/api/sms/send", { action: "send_reminders" });
  check("send reminders runs", r.status === 200 && typeof r.data?.failed === "number", JSON.stringify(r.data));
  r = await admin("GET", "/api/sms/logs");
  check("SMS logs", r.status === 200);

  section("Backups");
  r = await admin("GET", "/api/backup");
  check("download full backup JSON", r.status === 200 && r.data?.data?.members);
  const backupJson = r.data;
  r = await admin("POST", "/api/backup", { ...backupJson, dryRun: true });
  check("backup dry-run validation", r.status === 200 && r.data?.valid === true, JSON.stringify(r.data));
  r = await admin("POST", "/api/backup", { dryRun: true, version: "1" });
  check("invalid backup rejected", r.status === 400);
  r = await admin("POST", "/api/backups");
  check("create stored snapshot", r.status === 201, JSON.stringify(r.data));
  const snapId = r.data?.backup?.id;
  r = await admin("GET", "/api/backups");
  check("list snapshots", r.status === 200 && r.data.backups.some((b) => b.id === snapId));
  r = await admin("GET", `/api/backups/${snapId}`);
  check("download snapshot", r.status === 200);
  r = await admin("POST", `/api/backups/${snapId}`, { dryRun: true });
  check("snapshot dry-run", r.status === 200 && r.data?.valid === true);
  r = await manager("GET", "/api/backups");
  check("manager cannot access backups -> 403", r.status === 403);
  r = await admin("POST", "/api/backup", backupJson);
  check("full restore from backup", r.status === 200, JSON.stringify(r.data));
  r = await admin("GET", `/api/loans/${loan?.id}`);
  check("data intact after restore", r.status === 200 && r.data?.installments?.length === 12);
  r = await admin("DELETE", `/api/backups?id=${snapId}`);
  check("delete snapshot", r.status === 200);

  section("Cleanup / delete rules");
  r = await admin("DELETE", `/api/loans/${loan?.id}`);
  check("active loan cannot be deleted", r.status === 400);
  r = await admin("POST", "/api/loans", { memberId: member?.id, amount: "1000000", installmentCount: "2" });
  const loan2 = r.data?.loan;
  check("admin can exceed active-loan count", r.status === 201);
  const f2 = new FormData();
  f2.append("file", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "a.png");
  f2.append("loanId", String(loan2?.id));
  await admin("POST", "/api/attachments", f2);
  await admin("POST", `/api/loans/${loan2?.id}/guarantors`, { guarantorId });
  r = await admin("DELETE", `/api/loans/${loan2?.id}`);
  check("delete pending loan that has attachment + guarantor", r.status === 200, JSON.stringify(r.data));
  r = await admin("DELETE", `/api/attachments/${attachmentId}`);
  check("delete attachment", r.status === 200);
  r = await admin("DELETE", `/api/loans/${loan?.id}/guarantors?id=${guarantorshipId}`);
  check("detach guarantor", r.status === 200);
  r = await admin("DELETE", `/api/members/${member?.id}`);
  check("member with loans is soft-deleted", r.status === 200 && /غیرفعال/.test(r.data?.message || ""));
  r = await admin("DELETE", `/api/users/${viewerId}`);
  check("delete viewer user", r.status === 200);
  r = await admin("PUT", `/api/users/${managerId}`, { fullName: "کارشناس", role: "manager", isActive: false });
  check("deactivate manager user", r.status === 200);
  r = await client()("POST", "/api/auth/login", { username: managerName, password: "pass1234" });
  check("inactive user cannot log in", r.status === 401);
  await admin("POST", "/api/settings", {
    settings: Object.fromEntries(
      ["max_loan_amount", "max_loan_amount_manager", "max_active_loans_per_member"]
        .filter((k) => originalSettings[k] !== undefined)
        .map((k) => [k, originalSettings[k]])
    ),
  });
  r = await admin("POST", "/api/auth/logout");
  check("logout", r.status === 200);
  r = await admin("GET", "/api/auth/me");
  check("me after logout -> 401", r.status === 401);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failures:\n - " + failures.join("\n - "));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(2);
});
