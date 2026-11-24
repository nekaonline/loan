import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { installments, loans, fundTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getIranTodayISO, normalizeDateInput } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "viewer")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const { id } = await params;
    const installmentId = parseInt(id);
    const body = await req.json();

    const [installment] = await db
      .select()
      .from(installments)
      .where(eq(installments.id, installmentId))
      .limit(1);

    if (!installment) {
      return NextResponse.json({ error: "قسط یافت نشد" }, { status: 404 });
    }

    if (installment.status === "paid") {
      return NextResponse.json({ error: "این قسط قبلاً پرداخت شده" }, { status: 400 });
    }

    const paidDate = normalizeDateInput(body.paidDate) || getIranTodayISO();
    const paidAmount = body.amount || installment.amount;
    const receiptNo = body.receiptNo || null;

    // Update installment
    const [updatedInstallment] = await db
      .update(installments)
      .set({
        paidAmount: paidAmount.toString(),
        paidDate,
        status: "paid",
        receiptNo,
        notes: body.notes || installment.notes,
        paidBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(installments.id, installmentId))
      .returning();

    // Update loan paid/remaining amounts
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, installment.loanId))
      .limit(1);

    if (loan) {
      const newPaid = parseFloat(loan.paidAmount) + parseFloat(paidAmount.toString());
      const newRemaining = parseFloat(loan.totalPayable) - newPaid;
      const allInstallments = await db
        .select()
        .from(installments)
        .where(eq(installments.loanId, loan.id));

      const allPaid = allInstallments.every(
        (inst) => inst.id === installmentId || inst.status === "paid"
      );

      await db
        .update(loans)
        .set({
          paidAmount: newPaid.toString(),
          remainingAmount: Math.max(0, newRemaining).toString(),
          status: allPaid ? "paid" : "active",
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loan.id));

      // Record fund transaction
      await db.insert(fundTransactions).values({
        type: "installment_payment",
        amount: paidAmount.toString(),
        description: `دریافت قسط ${installment.installmentNo} وام ${loan.loanCode}`,
        memberId: installment.memberId,
        loanId: loan.id,
        referenceNo: receiptNo,
        transactionDate: paidDate,
        createdBy: session.userId,
      });
    }

    return NextResponse.json({ installment: updatedInstallment });
  } catch (error) {
    console.error("Installment pay error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
