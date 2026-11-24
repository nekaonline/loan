import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Idempotent schema upgrades for installations created before the newer
 * features existed. Drizzle's generated SQL is checked in separately; this
 * helper makes sure an existing database picks up new tables/columns safely.
 */
const statements = [
  `CREATE TABLE IF NOT EXISTS guarantors (
    id serial PRIMARY KEY,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    national_id varchar(20) NOT NULL UNIQUE,
    phone varchar(20) NOT NULL,
    phone2 varchar(20),
    address text,
    job_title varchar(150),
    relation varchar(100),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    created_by integer REFERENCES users(id)
  )`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS guarantor_id integer REFERENCES guarantors(id)`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id serial PRIMARY KEY,
    loan_id integer NOT NULL REFERENCES loans(id),
    member_id integer REFERENCES members(id),
    stored_name varchar(255) NOT NULL,
    file_name varchar(255) NOT NULL,
    mime_type varchar(150),
    file_size integer NOT NULL DEFAULT 0,
    category varchar(50) NOT NULL DEFAULT 'other',
    description text,
    uploaded_by integer REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS guarantorships (
    id serial PRIMARY KEY,
    guarantor_id integer NOT NULL REFERENCES guarantors(id),
    loan_id integer NOT NULL REFERENCES loans(id),
    member_id integer NOT NULL REFERENCES members(id),
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    created_by integer REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS backups (
    id serial PRIMARY KEY,
    filename varchar(200) NOT NULL,
    version varchar(20) NOT NULL DEFAULT '1.0',
    content text NOT NULL,
    size integer NOT NULL DEFAULT 0,
    checksum varchar(64),
    source varchar(20) NOT NULL DEFAULT 'manual',
    created_at timestamp NOT NULL DEFAULT now(),
    created_by integer REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS report_templates (
    id serial PRIMARY KEY,
    name varchar(150) NOT NULL,
    report_type varchar(50) NOT NULL,
    filters text NOT NULL DEFAULT '{}',
    created_at timestamp NOT NULL DEFAULT now(),
    created_by integer REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sms_reminder_logs (
    id serial PRIMARY KEY,
    installment_id integer NOT NULL REFERENCES installments(id),
    reminder_date date NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'sent',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS attachments_loan_idx ON attachments(loan_id)`,
  `CREATE INDEX IF NOT EXISTS guarantorships_loan_idx ON guarantorships(loan_id)`,
  `CREATE INDEX IF NOT EXISTS sms_reminder_logs_date_idx ON sms_reminder_logs(reminder_date)`,
];

let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const statement of statements) {
        await db.execute(sql.raw(statement));
      }
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
