import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans, members, installments } from "@/db/schema";
import { eq, and, lte, sum, count, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];

    // Get all debtors with active loans
    const debtors = await db
      .select({
        memberId: loans.memberId,
        memberCode: members.memberCode,
        firstName: members.firstName,
        lastName: members.lastName,
        phone: members.phone,
        department: members.department,
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
        members.department
      )
      .orderBy(sql`sum(${loans.remainingAmount}) DESC`);

    // Get overdue installments count per member
    const overdueByMember = await db
      .select({
        memberId: installments.memberId,
        overdueCount: count(installments.id),
        overdueAmount: sum(installments.amount),
      })
      .from(installments)
      .where(
        and(
          eq(installments.status, "pending"),
          lte(installments.dueDate, today)
        )
      )
      .groupBy(installments.memberId);

    const overdueMap = new Map(
      overdueByMember.map((o) => [
        o.memberId,
        { count: o.overdueCount, amount: o.overdueAmount },
      ])
    );

    const debtorsWithOverdue = debtors.map((d) => ({
      ...d,
      overdueInstallments: overdueMap.get(d.memberId)?.count || 0,
      overdueAmount: overdueMap.get(d.memberId)?.amount || "0",
    }));

    return NextResponse.json({ debtors: debtorsWithOverdue });
  } catch (error) {
    console.error("Debtors report error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
