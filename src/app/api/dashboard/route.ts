import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members, loans, installments, fundTransactions } from "@/db/schema";
import { eq, and, lte, gte, count, sum, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getIranMonthStartISO, getIranTodayISO } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = getIranTodayISO();

    // Total members
    const [totalMembers] = await db
      .select({ count: count() })
      .from(members)
      .where(eq(members.isActive, true));

    // Total active loans
    const [activeLoans] = await db
      .select({ count: count(), total: sum(loans.remainingAmount) })
      .from(loans)
      .where(eq(loans.status, "active"));

    // Total outstanding (remaining amount)
    const [outstanding] = await db
      .select({ total: sum(loans.remainingAmount) })
      .from(loans)
      .where(eq(loans.status, "active"));

    // Overdue installments
    const [overdueCount] = await db
      .select({ count: count(), total: sum(installments.amount) })
      .from(installments)
      .where(
        and(
          eq(installments.status, "pending"),
          lte(installments.dueDate, today)
        )
      );

    // Pending loans
    const [pendingLoans] = await db
      .select({ count: count() })
      .from(loans)
      .where(eq(loans.status, "pending"));

    // Fund balance (sum of all transactions)
    const transactions = await db
      .select({ type: fundTransactions.type, total: sum(fundTransactions.amount) })
      .from(fundTransactions)
      .groupBy(fundTransactions.type);

    let fundBalance = 0;
    for (const t of transactions) {
      fundBalance += parseFloat(t.total || "0");
    }

    // Monthly collection (current Jalali month, Iran time)
    const firstDayStr = getIranMonthStartISO();

    const [monthlyCollection] = await db
      .select({ total: sum(installments.paidAmount) })
      .from(installments)
      .where(
        and(
          eq(installments.status, "paid"),
          gte(installments.paidDate, firstDayStr),
          lte(installments.paidDate, today)
        )
      );

    // Recent transactions
    const recentTransactions = await db
      .select({
        id: fundTransactions.id,
        type: fundTransactions.type,
        amount: fundTransactions.amount,
        description: fundTransactions.description,
        transactionDate: fundTransactions.transactionDate,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
      })
      .from(fundTransactions)
      .leftJoin(members, eq(fundTransactions.memberId, members.id))
      .orderBy(sql`${fundTransactions.createdAt} DESC`)
      .limit(10);

    // Loans by status
    const loansByStatus = await db
      .select({
        status: loans.status,
        count: count(),
        total: sum(loans.amount),
      })
      .from(loans)
      .groupBy(loans.status);

    // Top debtors
    const topDebtors = await db
      .select({
        memberId: loans.memberId,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        memberCode: members.memberCode,
        totalRemaining: sum(loans.remainingAmount),
      })
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .where(eq(loans.status, "active"))
      .groupBy(loans.memberId, members.firstName, members.lastName, members.memberCode)
      .orderBy(sql`sum(${loans.remainingAmount}) DESC`)
      .limit(5);

    return NextResponse.json({
      stats: {
        totalMembers: totalMembers.count,
        activeLoans: activeLoans.count,
        totalOutstanding: parseFloat(outstanding.total || "0"),
        overdueCount: overdueCount.count,
        overdueAmount: parseFloat(overdueCount.total || "0"),
        pendingLoans: pendingLoans.count,
        fundBalance,
        monthlyCollection: parseFloat(monthlyCollection.total || "0"),
      },
      loansByStatus,
      recentTransactions,
      topDebtors,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
