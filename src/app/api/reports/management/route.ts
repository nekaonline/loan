import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  loans,
  members,
  installments,
  fundTransactions,
} from "@/db/schema";
import { and, count, desc, eq, gte, lte, max, min, sql, sum } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import {
  addJalaliMonthsISO,
  getIranMonthStartISO,
  getIranTodayISO,
  getJalaliISODate,
} from "@/lib/utils";

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function toNumber(value: string | number | null | undefined): number {
  return parseFloat(String(value ?? "0")) || 0;
}

function monthLabel(jalaliMonthKey: string): string {
  const [year, month] = jalaliMonthKey.split("-");
  return `${PERSIAN_MONTHS[Number(month) - 1] || ""} ${year}`.trim();
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = getIranTodayISO();
    const monthStart = getIranMonthStartISO();

    // ---------- KPI statistics ----------
    const [totalMembers] = await db
      .select({ value: count() })
      .from(members)
      .where(eq(members.isActive, true));

    const [activeLoans] = await db
      .select({ value: count(), total: sum(loans.remainingAmount) })
      .from(loans)
      .where(eq(loans.status, "active"));

    const [pendingLoans] = await db
      .select({ value: count() })
      .from(loans)
      .where(eq(loans.status, "pending"));

    const [overdue] = await db
      .select({ value: count(), total: sum(installments.amount) })
      .from(installments)
      .where(
        and(eq(installments.status, "pending"), lte(installments.dueDate, today))
      );

    const [monthlyCollection] = await db
      .select({ total: sum(installments.paidAmount) })
      .from(installments)
      .where(
        and(
          eq(installments.status, "paid"),
          gte(installments.paidDate, monthStart),
          lte(installments.paidDate, today)
        )
      );

    const loansByStatus = await db
      .select({
        status: loans.status,
        count: count(),
        total: sum(loans.amount),
      })
      .from(loans)
      .groupBy(loans.status);

    const fundByType = await db
      .select({ type: fundTransactions.type, total: sum(fundTransactions.amount) })
      .from(fundTransactions)
      .groupBy(fundTransactions.type);

    let income = 0;
    let expense = 0;
    const fundTotals: Record<string, number> = {};
    for (const row of fundByType) {
      const amount = toNumber(row.total);
      fundTotals[row.type] = amount;
      if (amount >= 0) income += amount;
      else expense += Math.abs(amount);
    }
    const fundBalance = income - expense;

    // ---------- Debtors ----------
    const debtorRows = await db
      .select({
        memberId: loans.memberId,
        memberCode: members.memberCode,
        firstName: members.firstName,
        lastName: members.lastName,
        phone: members.phone,
        nationalId: members.nationalId,
        department: members.department,
        email: members.email,
        city: members.city,
        joinDate: members.joinDate,
        guarantorName: members.guarantorName,
        guarantorPhone: members.guarantorPhone,
        totalLoaned: sum(loans.amount),
        totalPaid: sum(loans.paidAmount),
        totalRemaining: sum(loans.remainingAmount),
        loanCount: count(loans.id),
      })
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .where(eq(loans.status, "active"))
      .groupBy(
        loans.memberId,
        members.memberCode,
        members.firstName,
        members.lastName,
        members.phone,
        members.nationalId,
        members.department,
        members.email,
        members.city,
        members.joinDate,
        members.guarantorName,
        members.guarantorPhone
      )
      .orderBy(sql`sum(${loans.remainingAmount}) DESC`);

    const overdueByMember = await db
      .select({
        memberId: installments.memberId,
        overdueCount: count(installments.id),
        overdueAmount: sum(installments.amount),
      })
      .from(installments)
      .where(
        and(eq(installments.status, "pending"), lte(installments.dueDate, today))
      )
      .groupBy(installments.memberId);

    const nextDueByMember = await db
      .select({
        memberId: installments.memberId,
        nextDueDate: min(installments.dueDate),
      })
      .from(installments)
      .where(
        and(eq(installments.status, "pending"), gte(installments.dueDate, today))
      )
      .groupBy(installments.memberId);

    const lastPaidByMember = await db
      .select({
        memberId: installments.memberId,
        lastPaidDate: max(installments.paidDate),
      })
      .from(installments)
      .where(eq(installments.status, "paid"))
      .groupBy(installments.memberId);

    const overdueMap = new Map(
      overdueByMember.map((row) => [row.memberId, row])
    );
    const nextDueMap = new Map(
      nextDueByMember.map((row) => [row.memberId, row.nextDueDate])
    );
    const lastPaidMap = new Map(
      lastPaidByMember.map((row) => [row.memberId, row.lastPaidDate])
    );

    const debtors = debtorRows.map((row) => ({
      memberId: row.memberId,
      memberCode: row.memberCode,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      nationalId: row.nationalId,
      department: row.department,
      email: row.email,
      city: row.city,
      joinDate: row.joinDate,
      guarantorName: row.guarantorName,
      guarantorPhone: row.guarantorPhone,
      totalLoaned: toNumber(row.totalLoaned),
      totalPaid: toNumber(row.totalPaid),
      totalRemaining: toNumber(row.totalRemaining),
      loanCount: row.loanCount,
      overdueInstallments: overdueMap.get(row.memberId)?.overdueCount ?? 0,
      overdueAmount: toNumber(overdueMap.get(row.memberId)?.overdueAmount),
      nextDueDate: nextDueMap.get(row.memberId) ?? null,
      lastPaidDate: lastPaidMap.get(row.memberId) ?? null,
    }));

    // ---------- Loan recipients ----------
    const recipientRows = await db
      .select({
        id: loans.id,
        loanCode: loans.loanCode,
        status: loans.status,
        purpose: loans.purpose,
        amount: loans.amount,
        interestRate: loans.interestRate,
        installmentCount: loans.installmentCount,
        installmentAmount: loans.installmentAmount,
        totalPayable: loans.totalPayable,
        paidAmount: loans.paidAmount,
        remainingAmount: loans.remainingAmount,
        requestDate: loans.requestDate,
        approvalDate: loans.approvalDate,
        disbursementDate: loans.disbursementDate,
        firstInstallmentDate: loans.firstInstallmentDate,
        memberId: loans.memberId,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        memberCode: members.memberCode,
        memberPhone: members.phone,
      })
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .orderBy(desc(loans.requestDate), desc(loans.id))
      .limit(2000);

    const recipients = recipientRows.map((row) => ({
      id: row.id,
      loanCode: row.loanCode,
      status: row.status,
      purpose: row.purpose,
      amount: toNumber(row.amount),
      interestRate: toNumber(row.interestRate),
      installmentCount: row.installmentCount,
      installmentAmount: toNumber(row.installmentAmount),
      totalPayable: toNumber(row.totalPayable),
      paidAmount: toNumber(row.paidAmount),
      remainingAmount: toNumber(row.remainingAmount),
      requestDate: row.requestDate,
      approvalDate: row.approvalDate,
      disbursementDate: row.disbursementDate,
      firstInstallmentDate: row.firstInstallmentDate,
      memberId: row.memberId,
      memberFirstName: row.memberFirstName,
      memberLastName: row.memberLastName,
      memberCode: row.memberCode,
      memberPhone: row.memberPhone,
    }));

    // ---------- Fund transactions ----------
    const transactionRows = await db
      .select({
        id: fundTransactions.id,
        type: fundTransactions.type,
        amount: fundTransactions.amount,
        description: fundTransactions.description,
        referenceNo: fundTransactions.referenceNo,
        transactionDate: fundTransactions.transactionDate,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
      })
      .from(fundTransactions)
      .leftJoin(members, eq(fundTransactions.memberId, members.id))
      .orderBy(desc(fundTransactions.transactionDate), desc(fundTransactions.id))
      .limit(2000);

    const transactions = transactionRows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: toNumber(row.amount),
      description: row.description,
      referenceNo: row.referenceNo,
      transactionDate: row.transactionDate,
      memberFirstName: row.memberFirstName,
      memberLastName: row.memberLastName,
    }));

    // ---------- Collection trend (last 6 Jalali months) ----------
    const trendStart = addJalaliMonthsISO(monthStart, -5);
    const paidRows = await db
      .select({ paidDate: installments.paidDate, amount: installments.paidAmount })
      .from(installments)
      .where(
        and(
          eq(installments.status, "paid"),
          gte(installments.paidDate, trendStart),
          lte(installments.paidDate, today)
        )
      );

    const trend: Array<{ key: string; label: string; collection: number }> = [];
    for (let offset = 5; offset >= 0; offset--) {
      const iso = addJalaliMonthsISO(monthStart, -offset);
      const key = getJalaliISODate(iso).slice(0, 7);
      trend.push({ key, label: monthLabel(key), collection: 0 });
    }
    const trendMap = new Map(trend.map((item) => [item.key, item]));
    for (const row of paidRows) {
      if (!row.paidDate) continue;
      const key = getJalaliISODate(row.paidDate).slice(0, 7);
      const bucket = trendMap.get(key);
      if (bucket) bucket.collection += toNumber(row.amount);
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      stats: {
        totalMembers: totalMembers.value,
        activeLoans: activeLoans.value,
        totalOutstanding: toNumber(activeLoans.total),
        overdueCount: overdue.value,
        overdueAmount: toNumber(overdue.total),
        pendingLoans: pendingLoans.value,
        fundBalance,
        fundIncome: income,
        fundExpense: expense,
        monthlyCollection: toNumber(monthlyCollection.total),
      },
      loansByStatus: loansByStatus.map((row) => ({
        status: row.status,
        count: row.count,
        total: toNumber(row.total),
      })),
      fundByType: fundByType.map((row) => ({
        type: row.type,
        total: toNumber(row.total),
      })),
      debtors,
      recipients,
      transactions,
      collectionTrend: trend.map((item) => ({
        label: item.label,
        collection: item.collection,
      })),
    });
  } catch (error) {
    console.error("Management report error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
