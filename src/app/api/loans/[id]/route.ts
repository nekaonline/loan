import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans, members, installments, fundTransactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import {
  calculateInstallments,
  addJalaliMonthsISO,
  getIranTodayISO,
  normalizeDateInput,
  formatNumber,
} from "@/lib/utils";
import { getLoanPolicy, maxAmountForRole } from "@/lib/policy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const loanId = parseInt(id);

    const [loan] = await db
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
        memberNationalId: members.nationalId,
      })
      .from(loans)
      .leftJoin(members, eq(loans.memberId, members.id))
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) {
      return NextResponse.json({ error: "وام یافت نشد" }, { status: 404 });
    }

    const loanInstallments = await db
      .select()
      .from(installments)
      .where(eq(installments.loanId, loanId))
      .orderBy(installments.installmentNo);

    return NextResponse.json({ loan, installments: loanInstallments });
  } catch (error) {
    console.error("Loan GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(
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
    const loanId = parseInt(id);
    const body = await req.json();

    const [existingLoan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!existingLoan) {
      return NextResponse.json({ error: "وام یافت نشد" }, { status: 404 });
    }

    // Handle approval + disbursement
    if (body.action === "approve") {
      const [updated] = await db
        .update(loans)
        .set({
          status: "approved",
          approvalDate: getIranTodayISO(),
          approvedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loanId))
        .returning();
      return NextResponse.json({ loan: updated });
    }

    if (body.action === "disburse") {
      if (existingLoan.status !== "approved") {
        return NextResponse.json(
          { error: "وام باید ابتدا تأیید شود" },
          { status: 400 }
        );
      }

      const disbursementDate =
        normalizeDateInput(body.disbursementDate) || getIranTodayISO();
      const firstInstallmentDate =
        normalizeDateInput(body.firstInstallmentDate) ||
        addJalaliMonthsISO(disbursementDate, 1);

      const [updated] = await db
        .update(loans)
        .set({
          status: "active",
          disbursementDate,
          firstInstallmentDate,
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loanId))
        .returning();

      // Generate installment schedule
      const principal = parseFloat(existingLoan.amount);
      const interestRate = parseFloat(existingLoan.interestRate);
      const installmentCount = existingLoan.installmentCount;
      const installmentAmount = parseFloat(existingLoan.installmentAmount);

      const installmentValues = [];
      let remainingPrincipal = principal;

      for (let i = 1; i <= installmentCount; i++) {
        const dueDate = addJalaliMonthsISO(firstInstallmentDate, i - 1);
        let interestAmt = 0;
        let principalAmt = installmentAmount;

        if (interestRate > 0) {
          const monthlyRate = interestRate / 100 / 12;
          interestAmt = remainingPrincipal * monthlyRate;
          principalAmt = installmentAmount - interestAmt;
          remainingPrincipal -= principalAmt;
        }

        installmentValues.push({
          loanId,
          memberId: existingLoan.memberId,
          installmentNo: i,
          dueDate,
          amount: installmentAmount.toString(),
          principalAmount: Math.max(0, principalAmt).toFixed(2),
          interestAmount: Math.max(0, interestAmt).toFixed(2),
          paidAmount: "0",
          status: "pending" as const,
        });
      }

      await db.insert(installments).values(installmentValues);

      // Record fund transaction
      await db.insert(fundTransactions).values({
        type: "loan_disbursement",
        amount: `-${existingLoan.amount}`,
        description: `پرداخت وام ${existingLoan.loanCode} به عضو`,
        memberId: existingLoan.memberId,
        loanId,
        transactionDate: disbursementDate,
        createdBy: session.userId,
      });

      return NextResponse.json({ loan: updated });
    }

    if (body.action === "reject") {
      const [updated] = await db
        .update(loans)
        .set({
          status: "rejected",
          notes: body.notes || existingLoan.notes,
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loanId))
        .returning();
      return NextResponse.json({ loan: updated });
    }

    // General update
    const principal = body.amount
      ? parseFloat(body.amount)
      : parseFloat(existingLoan.amount);

    if (body.amount) {
      const policy = await getLoanPolicy();
      const cap = maxAmountForRole(policy, session.role);
      if (!Number.isFinite(principal) || principal <= 0 || principal > cap) {
        return NextResponse.json(
          {
            error: `مبلغ وام باید بین 0 و ${formatNumber(cap)} ریال باشد`,
          },
          { status: 400 }
        );
      }
    }

    const interestRate = body.interestRate !== undefined
      ? parseFloat(body.interestRate)
      : parseFloat(existingLoan.interestRate);
    const installmentCount = body.installmentCount
      ? parseInt(body.installmentCount)
      : existingLoan.installmentCount;

    const { installmentAmount, totalPayable } = calculateInstallments(
      principal,
      interestRate,
      installmentCount
    );

    const [updated] = await db
      .update(loans)
      .set({
        amount: principal.toString(),
        interestRate: interestRate.toString(),
        installmentCount,
        installmentAmount: installmentAmount.toString(),
        totalPayable: totalPayable.toString(),
        remainingAmount: (
          totalPayable - parseFloat(existingLoan.paidAmount)
        ).toString(),
        purpose: body.purpose || existingLoan.purpose,
        notes: body.notes || existingLoan.notes,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, loanId))
      .returning();

    return NextResponse.json({ loan: updated });
  } catch (error) {
    console.error("Loan PUT error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const { id } = await params;
    const loanId = parseInt(id);

    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1);

    if (!loan) {
      return NextResponse.json({ error: "وام یافت نشد" }, { status: 404 });
    }

    if (loan.status === "active") {
      return NextResponse.json(
        { error: "وام فعال قابل حذف نیست" },
        { status: 400 }
      );
    }

    await db.delete(installments).where(eq(installments.loanId, loanId));
    await db.delete(loans).where(eq(loans.id, loanId));

    return NextResponse.json({ message: "وام حذف شد" });
  } catch (error) {
    console.error("Loan DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
