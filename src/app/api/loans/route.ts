import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans, members, installments, fundTransactions } from "@/db/schema";
import { eq, desc, like, or, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import {
  generateLoanCode,
  calculateInstallments,
  addMonths,
} from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const memberId = searchParams.get("memberId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const allLoans = await db
      .select({
        id: loans.id,
        loanCode: loans.loanCode,
        amount: loans.amount,
        interestRate: loans.interestRate,
        installmentCount: loans.installmentCount,
        installmentAmount: loans.installmentAmount,
        totalPayable: loans.totalPayable,
        paidAmount: loans.paidAmount,
        remainingAmount: loans.remainingAmount,
        status: loans.status,
        purpose: loans.purpose,
        requestDate: loans.requestDate,
        approvalDate: loans.approvalDate,
        disbursementDate: loans.disbursementDate,
        firstInstallmentDate: loans.firstInstallmentDate,
        notes: loans.notes,
        createdAt: loans.createdAt,
        memberId: loans.memberId,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        memberCode: members.memberCode,
        memberPhone: members.phone,
      })
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .orderBy(desc(loans.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(loans);

    return NextResponse.json({
      loans: allLoans,
      total: totalResult.count,
      page,
      limit,
    });
  } catch (error) {
    console.error("Loans GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "viewer")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const body = await req.json();

    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, parseInt(body.memberId)))
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: "عضو یافت نشد" }, { status: 404 });
    }

    const principal = parseFloat(body.amount);
    const interestRate = parseFloat(body.interestRate || "0");
    const installmentCount = parseInt(body.installmentCount);

    const { installmentAmount, totalPayable } = calculateInstallments(
      principal,
      interestRate,
      installmentCount
    );

    const loanCode = generateLoanCode();

    const [newLoan] = await db
      .insert(loans)
      .values({
        loanCode,
        memberId: parseInt(body.memberId),
        amount: principal.toString(),
        interestRate: interestRate.toString(),
        installmentCount,
        installmentAmount: installmentAmount.toString(),
        totalPayable: totalPayable.toString(),
        paidAmount: "0",
        remainingAmount: totalPayable.toString(),
        status: "pending",
        purpose: body.purpose || null,
        requestDate: body.requestDate || new Date().toISOString().split("T")[0],
        notes: body.notes || null,
        createdBy: session.userId,
      })
      .returning();

    return NextResponse.json({ loan: newLoan }, { status: 201 });
  } catch (error) {
    console.error("Loans POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
