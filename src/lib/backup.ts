import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { db, pool } from "@/db";
import {
  members,
  loans,
  installments,
  fundTransactions,
  settings,
  users,
  smsLogs,
  guarantors,
  guarantorships,
  attachments,
  reportTemplates,
  backups,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatDateTime, getJalaliISODate } from "@/lib/utils";
import { ensureSchema } from "@/lib/schema-setup";

export interface BackupPayload {
  version: string;
  exportDate: string;
  exportDateJalali: string;
  exportedBy: string;
  data: Record<string, unknown[]>;
}

/** Build a complete, versioned backup payload from the current database. */
export async function buildBackupPayload(exportedBy: string): Promise<BackupPayload> {
  await ensureSchema();

  const [
    allMembers,
    allLoans,
    allInstallments,
    allTransactions,
    allSettings,
    allUsers,
    allGuarantors,
    allGuarantorships,
    allAttachments,
    allTemplates,
  ] = await Promise.all([
    db.select().from(members),
    db.select().from(loans),
    db.select().from(installments),
    db.select().from(fundTransactions),
    db.select().from(settings),
    db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users),
    db.select().from(guarantors),
    db.select().from(guarantorships),
    db.select().from(attachments),
    db.select().from(reportTemplates),
  ]);

  return {
    version: "1.1",
    exportDate: new Date().toISOString(),
    exportDateJalali: formatDateTime(new Date()),
    exportedBy,
    data: {
      members: allMembers,
      loans: allLoans,
      installments: allInstallments,
      fundTransactions: allTransactions,
      settings: allSettings,
      users: allUsers,
      guarantors: allGuarantors,
      guarantorships: allGuarantorships,
      attachments: allAttachments,
      reportTemplates: allTemplates,
    },
  };
}

export interface BackupValidation {
  valid: boolean;
  counts: Record<string, number>;
  issues: string[];
}

/** Validate a backup file without touching the database (dry run). */
export function validateBackupPayload(payload: unknown): BackupValidation {
  const issues: string[] = [];
  const counts: Record<string, number> = {};
  const root = payload as Partial<BackupPayload> | null;

  if (!root || typeof root !== "object" || !root.version || !root.data) {
    return { valid: false, counts, issues: ["ساختار فایل پشتیبان معتبر نیست"] };
  }

  const required = [
    "members",
    "loans",
    "installments",
    "fundTransactions",
    "settings",
    "users",
  ];
  for (const key of required) {
    const value = (root.data as Record<string, unknown>)[key];
    if (!Array.isArray(value)) issues.push(`بخش ${key} وجود ندارد`);
    else counts[key] = value.length;
  }

  for (const key of [
    "guarantors",
    "guarantorships",
    "attachments",
    "reportTemplates",
  ]) {
    const value = (root.data as Record<string, unknown>)[key];
    counts[key] = Array.isArray(value) ? value.length : 0;
  }

  return { valid: issues.length === 0, counts, issues };
}

async function insertRows(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
  const updates = columns
    .slice(1)
    .map((column) => `${column}=excluded.${column}`)
    .join(",");

  for (const values of rows) {
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values
    );
  }
}

/** Restore a validated backup inside one transaction. */
export async function restoreBackupPayload(payload: BackupPayload): Promise<void> {
  await ensureSchema();
  const validation = validateBackupPayload(payload);
  if (!validation.valid) {
    throw new Error(validation.issues.join("، "));
  }

  const data = payload.data as Record<string, Record<string, unknown>[]>;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM sms_reminder_logs");
    await client.query("DELETE FROM sms_logs");
    await client.query("DELETE FROM audit_logs");
    await client.query("DELETE FROM attachments");
    await client.query("DELETE FROM guarantorships");
    await client.query("DELETE FROM installments");
    await client.query("DELETE FROM fund_transactions");
    await client.query("DELETE FROM loans");
    await client.query("DELETE FROM members");
    await client.query("DELETE FROM guarantors");
    await client.query("DELETE FROM settings");
    await client.query("DELETE FROM report_templates");

    await insertRows(
      client,
      "settings",
      ["id", "key", "value", "description", "updated_at"],
      (data.settings || []).map((s) => [
        s.id, s.key, s.value, s.description, s.updatedAt,
      ])
    );

    await insertRows(
      client,
      "guarantors",
      ["id", "first_name", "last_name", "national_id", "phone", "phone2", "address", "job_title", "relation", "notes", "is_active", "created_at", "created_by"],
      (data.guarantors || []).map((g) => [
        g.id, g.firstName, g.lastName, g.nationalId, g.phone, g.phone2,
        g.address, g.jobTitle, g.relation, g.notes, g.isActive, g.createdAt, g.createdBy,
      ])
    );

    await insertRows(
      client,
      "members",
      ["id", "member_code", "first_name", "last_name", "national_id", "phone", "phone2", "email", "address", "city", "postal_code", "birth_date", "job_title", "department", "employee_id", "guarantor_name", "guarantor_phone", "guarantor_national_id", "guarantor_id", "is_active", "notes", "join_date", "created_at", "updated_at"],
      (data.members || []).map((m) => [
        m.id, m.memberCode, m.firstName, m.lastName, m.nationalId, m.phone,
        m.phone2, m.email, m.address, m.city, m.postalCode, m.birthDate,
        m.jobTitle, m.department, m.employeeId, m.guarantorName,
        m.guarantorPhone, m.guarantorNationalId, m.guarantorId ?? null,
        m.isActive, m.notes, m.joinDate, m.createdAt, m.updatedAt,
      ])
    );

    await insertRows(
      client,
      "loans",
      ["id", "loan_code", "member_id", "amount", "interest_rate", "installment_count", "installment_amount", "total_payable", "paid_amount", "remaining_amount", "status", "purpose", "request_date", "approval_date", "disbursement_date", "first_installment_date", "notes", "created_at", "updated_at"],
      (data.loans || []).map((l) => [
        l.id, l.loanCode, l.memberId, l.amount, l.interestRate,
        l.installmentCount, l.installmentAmount, l.totalPayable, l.paidAmount,
        l.remainingAmount, l.status, l.purpose, l.requestDate, l.approvalDate,
        l.disbursementDate, l.firstInstallmentDate, l.notes, l.createdAt, l.updatedAt,
      ])
    );

    await insertRows(
      client,
      "installments",
      ["id", "loan_id", "member_id", "installment_no", "due_date", "amount", "principal_amount", "interest_amount", "paid_amount", "paid_date", "status", "receipt_no", "notes", "created_at", "updated_at"],
      (data.installments || []).map((i) => [
        i.id, i.loanId, i.memberId, i.installmentNo, i.dueDate, i.amount,
        i.principalAmount, i.interestAmount, i.paidAmount, i.paidDate,
        i.status, i.receiptNo, i.notes, i.createdAt, i.updatedAt,
      ])
    );

    await insertRows(
      client,
      "fund_transactions",
      ["id", "type", "amount", "description", "member_id", "loan_id", "reference_no", "transaction_date", "created_at"],
      (data.fundTransactions || []).map((t) => [
        t.id, t.type, t.amount, t.description, t.memberId, t.loanId,
        t.referenceNo, t.transactionDate, t.createdAt,
      ])
    );

    await insertRows(
      client,
      "guarantorships",
      ["id", "guarantor_id", "loan_id", "member_id", "notes", "created_at", "created_by"],
      (data.guarantorships || []).map((g) => [
        g.id, g.guarantorId, g.loanId, g.memberId, g.notes, g.createdAt, g.createdBy,
      ])
    );

    await insertRows(
      client,
      "attachments",
      ["id", "loan_id", "member_id", "stored_name", "file_name", "mime_type", "file_size", "category", "description", "uploaded_by", "created_at"],
      (data.attachments || []).map((a) => [
        a.id, a.loanId, a.memberId, a.storedName, a.fileName, a.mimeType,
        a.fileSize, a.category, a.description, a.uploadedBy, a.createdAt,
      ])
    );

    await insertRows(
      client,
      "report_templates",
      ["id", "name", "report_type", "filters", "created_at", "created_by"],
      (data.reportTemplates || []).map((t) => [
        t.id, t.name, t.reportType, t.filters, t.createdAt, t.createdBy,
      ])
    );

    for (const sequence of [
      "members",
      "loans",
      "installments",
      "fund_transactions",
      "guarantors",
      "guarantorships",
      "attachments",
      "report_templates",
    ]) {
      await client.query(
        `SELECT setval('${sequence}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ${sequence}))`
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Store a snapshot and enforce the retention setting. */
export async function createBackupSnapshot(
  exportedBy: string,
  createdBy?: number,
  source: "manual" | "auto" = "manual"
) {
  await ensureSchema();
  const payload = await buildBackupPayload(exportedBy);
  const content = JSON.stringify(payload);
  const filename = `backup-${getJalaliISODate()}.json`;
  const checksum = createHash("sha256").update(content).digest("hex");

  const [backup] = await db
    .insert(backups)
    .values({ filename, version: payload.version, content, size: content.length, checksum, source, createdBy: createdBy ?? null })
    .returning();

  const [retention] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "backup_retention_count"))
    .limit(1);
  const keep = Math.max(1, parseInt(retention?.value || "10") || 10);
  const all = await db
    .select({ id: backups.id })
    .from(backups)
    .orderBy(desc(backups.createdAt));
  for (const old of all.slice(keep)) {
    await db.delete(backups).where(eq(backups.id, old.id));
  }

  return backup;
}
