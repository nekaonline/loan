import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "viewer"]);
export const loanStatusEnum = pgEnum("loan_status", [
  "pending",
  "approved",
  "active",
  "paid",
  "rejected",
]);
export const installmentStatusEnum = pgEnum("installment_status", [
  "pending",
  "paid",
  "overdue",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdrawal",
  "loan_disbursement",
  "installment_payment",
  "fee",
  "other",
]);
export const smsLogStatusEnum = pgEnum("sms_log_status", [
  "sent",
  "failed",
  "pending",
]);

// Users (system users with roles)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 20 }),
  role: userRoleEnum("role").notNull().default("viewer"),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Members (Qarz-al-Hasaneh fund members)
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  memberCode: varchar("member_code", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  nationalId: varchar("national_id", { length: 20 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull(),
  phone2: varchar("phone2", { length: 20 }),
  email: varchar("email", { length: 200 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  birthDate: date("birth_date"),
  jobTitle: varchar("job_title", { length: 150 }),
  department: varchar("department", { length: 150 }),
  employeeId: varchar("employee_id", { length: 50 }),
  guarantorName: varchar("guarantor_name", { length: 200 }),
  guarantorPhone: varchar("guarantor_phone", { length: 20 }),
  guarantorNationalId: varchar("guarantor_national_id", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  joinDate: date("join_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Fund accounts (track overall fund balance)
export const fundTransactions = pgTable("fund_transactions", {
  id: serial("id").primaryKey(),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  memberId: integer("member_id").references(() => members.id),
  loanId: integer("loan_id"),
  referenceNo: varchar("reference_no", { length: 100 }),
  transactionDate: date("transaction_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Loans
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  loanCode: varchar("loan_code", { length: 50 }).notNull().unique(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  installmentCount: integer("installment_count").notNull(),
  installmentAmount: numeric("installment_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  totalPayable: numeric("total_payable", { precision: 15, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  remainingAmount: numeric("remaining_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  status: loanStatusEnum("status").notNull().default("pending"),
  purpose: text("purpose"),
  requestDate: date("request_date").notNull(),
  approvalDate: date("approval_date"),
  disbursementDate: date("disbursement_date"),
  firstInstallmentDate: date("first_installment_date"),
  notes: text("notes"),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Installments
export const installments = pgTable("installments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id")
    .notNull()
    .references(() => loans.id),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  installmentNo: integer("installment_no").notNull(),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  principalAmount: numeric("principal_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  interestAmount: numeric("interest_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  paidDate: date("paid_date"),
  status: installmentStatusEnum("status").notNull().default("pending"),
  receiptNo: varchar("receipt_no", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  paidBy: integer("paid_by").references(() => users.id),
});

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// SMS Logs
export const smsLogs = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id),
  phone: varchar("phone", { length: 20 }).notNull(),
  message: text("message").notNull(),
  status: smsLogStatusEnum("status").notNull().default("pending"),
  provider: varchar("provider", { length: 100 }),
  responseCode: varchar("response_code", { length: 50 }),
  responseMessage: text("response_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  installmentId: integer("installment_id").references(() => installments.id),
});

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  tableName: varchar("table_name", { length: 100 }),
  recordId: integer("record_id"),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const membersRelations = relations(members, ({ many, one }) => ({
  loans: many(loans),
  fundTransactions: many(fundTransactions),
  installments: many(installments),
  smsLogs: many(smsLogs),
  createdByUser: one(users, {
    fields: [members.createdBy],
    references: [users.id],
  }),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  member: one(members, {
    fields: [loans.memberId],
    references: [members.id],
  }),
  installments: many(installments),
  approvedByUser: one(users, {
    fields: [loans.approvedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [loans.createdBy],
    references: [users.id],
  }),
}));

export const installmentsRelations = relations(installments, ({ one }) => ({
  loan: one(loans, {
    fields: [installments.loanId],
    references: [loans.id],
  }),
  member: one(members, {
    fields: [installments.memberId],
    references: [members.id],
  }),
  paidByUser: one(users, {
    fields: [installments.paidBy],
    references: [users.id],
  }),
}));

export const fundTransactionsRelations = relations(
  fundTransactions,
  ({ one }) => ({
    member: one(members, {
      fields: [fundTransactions.memberId],
      references: [members.id],
    }),
    createdByUser: one(users, {
      fields: [fundTransactions.createdBy],
      references: [users.id],
    }),
  })
);

export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
  member: one(members, {
    fields: [smsLogs.memberId],
    references: [members.id],
  }),
  installment: one(installments, {
    fields: [smsLogs.installmentId],
    references: [installments.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  members: many(members),
  loans: many(loans),
  auditLogs: many(auditLogs),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type Installment = typeof installments.$inferSelect;
export type NewInstallment = typeof installments.$inferInsert;
export type FundTransaction = typeof fundTransactions.$inferSelect;
export type NewFundTransaction = typeof fundTransactions.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type SmsLog = typeof smsLogs.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
