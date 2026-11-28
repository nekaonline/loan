import { db } from "@/db";
import { installments, loans, members } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatDate, toLatinDigits } from "@/lib/utils";
import { ensureSchema } from "@/lib/schema-setup";

export interface PublicLoan {
  loanCode: string;
  status: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  requestDate: string;
  disbursementDate: string | null;
  installments: Array<{
    installmentNo: number;
    dueDate: string;
    amount: number;
    paidAmount: number;
    paidDate: string | null;
    status: string;
    receiptNo: string | null;
  }>;
}

export interface PublicInquiry {
  memberCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  joinDate: string;
  loans: PublicLoan[];
}

function normalize(value: string): string {
  return toLatinDigits(value).replace(/[-\s]/g, "").trim();
}

/** Look up a member by national ID plus full phone (or its last 4 digits). */
export async function findMemberForInquiry(
  nationalIdInput: string,
  phoneInput: string
): Promise<PublicInquiry | null> {
  await ensureSchema();
  const nationalId = normalize(nationalIdInput);
  const phone = normalize(phoneInput);
  if (nationalId.length < 8 || phone.length < 4) return null;

  const [member] = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
      joinDate: members.joinDate,
    })
    .from(members)
    .where(eq(members.nationalId, nationalId))
    .limit(1);

  if (!member) return null;
  const matchesPhone =
    phone.length >= 10 ? member.phone === phone : member.phone.endsWith(phone);
  if (!matchesPhone) return null;

  const loanRows = await db
    .select()
    .from(loans)
    .where(eq(loans.memberId, member.id))
    .orderBy(desc(loans.requestDate));

  const installmentRows = await db
    .select()
    .from(installments)
    .where(eq(installments.memberId, member.id))
    .orderBy(installments.dueDate);

  return {
    memberCode: member.memberCode,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    joinDate: formatDate(member.joinDate),
    loans: loanRows.map((loan) => ({
      loanCode: loan.loanCode,
      status: loan.status,
      amount: parseFloat(loan.amount),
      paidAmount: parseFloat(loan.paidAmount),
      remainingAmount: parseFloat(loan.remainingAmount),
      requestDate: formatDate(loan.requestDate),
      disbursementDate: loan.disbursementDate
        ? formatDate(loan.disbursementDate)
        : null,
      installments: installmentRows
        .filter((inst) => inst.loanId === loan.id)
        .map((inst) => ({
          installmentNo: inst.installmentNo,
          dueDate: formatDate(inst.dueDate),
          amount: parseFloat(inst.amount),
          paidAmount: parseFloat(inst.paidAmount),
          paidDate: inst.paidDate ? formatDate(inst.paidDate) : null,
          status: inst.status,
          receiptNo: inst.receiptNo,
        })),
    })),
  };
}

export interface PublicReceipt {
  receiptNo: string;
  memberName: string;
  loanCode: string;
  installmentNo: number;
  amount: number;
  paidDate: string;
  status: string;
}

export async function findReceipt(code: string): Promise<PublicReceipt | null> {
  await ensureSchema();
  const receiptNo = toLatinDigits(code).trim();
  if (!receiptNo) return null;

  const [row] = await db
    .select({
      receiptNo: installments.receiptNo,
      installmentNo: installments.installmentNo,
      amount: installments.paidAmount,
      paidDate: installments.paidDate,
      status: installments.status,
      loanCode: loans.loanCode,
      firstName: members.firstName,
      lastName: members.lastName,
    })
    .from(installments)
    .leftJoin(loans, eq(installments.loanId, loans.id))
    .leftJoin(members, eq(installments.memberId, members.id))
    .where(eq(installments.receiptNo, receiptNo))
    .limit(1);

  if (!row || !row.paidDate) return null;

  return {
    receiptNo: row.receiptNo || "",
    memberName: `${row.firstName || ""} ${row.lastName || ""}`.trim(),
    loanCode: row.loanCode || "-",
    installmentNo: row.installmentNo,
    amount: parseFloat(row.amount),
    paidDate: formatDate(row.paidDate),
    status: row.status,
  };
}
