import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { installments, loans, members } from "@/db/schema";
import { eq, and, lte, gte, desc, or, like } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getIranTodayISO } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const memberId = searchParams.get("memberId") || "";
    const loanId = searchParams.get("loanId") || "";
    const overdue = searchParams.get("overdue") === "true";

    let query = db
      .select({
        id: installments.id,
        loanId: installments.loanId,
        memberId: installments.memberId,
        installmentNo: installments.installmentNo,
        dueDate: installments.dueDate,
        amount: installments.amount,
        principalAmount: installments.principalAmount,
        interestAmount: installments.interestAmount,
        paidAmount: installments.paidAmount,
        paidDate: installments.paidDate,
        status: installments.status,
        receiptNo: installments.receiptNo,
        notes: installments.notes,
        loanCode: loans.loanCode,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        memberCode: members.memberCode,
        memberPhone: members.phone,
      })
      .from(installments)
      .leftJoin(loans, eq(installments.loanId, loans.id))
      .leftJoin(members, eq(installments.memberId, members.id))
      .$dynamic();

    if (status) {
      query = query.where(eq(installments.status, status as "pending" | "paid" | "overdue"));
    }

    if (memberId) {
      query = query.where(eq(installments.memberId, parseInt(memberId)));
    }

    if (loanId) {
      query = query.where(eq(installments.loanId, parseInt(loanId)));
    }

    if (overdue) {
      const today = getIranTodayISO();
      query = query.where(
        and(
          eq(installments.status, "pending"),
          lte(installments.dueDate, today)
        )
      );
    }

    const results = await query.orderBy(desc(installments.dueDate));

    return NextResponse.json({ installments: results });
  } catch (error) {
    console.error("Installments GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
