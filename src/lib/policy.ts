import { db } from "@/db";
import { settings } from "@/db/schema";
import { or, eq } from "drizzle-orm";

export interface LoanPolicy {
  maxLoanAmount: number;
  maxManagerLoanAmount: number;
  maxActiveLoansPerMember: number;
}

const DEFAULT_POLICY: LoanPolicy = {
  maxLoanAmount: 100_000_000,
  maxManagerLoanAmount: 50_000_000,
  maxActiveLoansPerMember: 1,
};

/** Read loan limits from settings; missing or invalid values fall back safely. */
export async function getLoanPolicy(): Promise<LoanPolicy> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(
      or(
        eq(settings.key, "max_loan_amount"),
        eq(settings.key, "max_loan_amount_manager"),
        eq(settings.key, "max_active_loans_per_member")
      )
    );

  const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
  const positive = (key: string, fallback: number) => {
    const value = values.get(key);
    return value !== undefined && Number.isFinite(value) && value > 0
      ? value
      : fallback;
  };

  return {
    maxLoanAmount: positive("max_loan_amount", DEFAULT_POLICY.maxLoanAmount),
    maxManagerLoanAmount: positive(
      "max_loan_amount_manager",
      DEFAULT_POLICY.maxManagerLoanAmount
    ),
    maxActiveLoansPerMember: Math.floor(
      positive(
        "max_active_loans_per_member",
        DEFAULT_POLICY.maxActiveLoansPerMember
      )
    ),
  };
}

/** Managers cannot exceed their own cap or the global fund cap. */
export function maxAmountForRole(policy: LoanPolicy, role: string): number {
  if (role === "admin") return policy.maxLoanAmount;
  return Math.min(policy.maxLoanAmount, policy.maxManagerLoanAmount);
}
