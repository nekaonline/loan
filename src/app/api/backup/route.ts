import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members, loans, installments, fundTransactions, settings, users, smsLogs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { formatDateTime, getJalaliISODate } from "@/lib/utils";
import { pool } from "@/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const [allMembers, allLoans, allInstallments, allTransactions, allSettings, allUsers] =
      await Promise.all([
        db.select().from(members),
        db.select().from(loans),
        db.select().from(installments),
        db.select().from(fundTransactions),
        db.select().from(settings),
        db.select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        }).from(users),
      ]);

    const backup = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      exportDateJalali: formatDateTime(new Date()),
      exportedBy: session.username,
      data: {
        members: allMembers,
        loans: allLoans,
        installments: allInstallments,
        fundTransactions: allTransactions,
        settings: allSettings,
        users: allUsers,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${getJalaliISODate()}.json"`,
      },
    });
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const body = await req.json();

    if (!body.data || !body.version) {
      return NextResponse.json({ error: "فایل پشتیبان معتبر نیست" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Clear existing data
      await client.query("DELETE FROM sms_logs");
      await client.query("DELETE FROM audit_logs");
      await client.query("DELETE FROM installments");
      await client.query("DELETE FROM fund_transactions");
      await client.query("DELETE FROM loans");
      await client.query("DELETE FROM members");
      await client.query("DELETE FROM settings");

      // Restore data
      if (body.data.settings && body.data.settings.length > 0) {
        for (const setting of body.data.settings) {
          await client.query(
            "INSERT INTO settings (id, key, value, description, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET value = $3",
            [setting.id, setting.key, setting.value, setting.description, setting.updatedAt]
          );
        }
      }

      if (body.data.members && body.data.members.length > 0) {
        for (const member of body.data.members) {
          await client.query(
            `INSERT INTO members (id, member_code, first_name, last_name, national_id, phone, phone2, email, address, city, postal_code, birth_date, job_title, department, employee_id, guarantor_name, guarantor_phone, guarantor_national_id, is_active, notes, join_date, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
             ON CONFLICT (id) DO UPDATE SET first_name=$3`,
            [member.id, member.memberCode, member.firstName, member.lastName, member.nationalId,
             member.phone, member.phone2, member.email, member.address, member.city, member.postalCode,
             member.birthDate, member.jobTitle, member.department, member.employeeId,
             member.guarantorName, member.guarantorPhone, member.guarantorNationalId,
             member.isActive, member.notes, member.joinDate, member.createdAt, member.updatedAt]
          );
        }
      }

      if (body.data.loans && body.data.loans.length > 0) {
        for (const loan of body.data.loans) {
          await client.query(
            `INSERT INTO loans (id, loan_code, member_id, amount, interest_rate, installment_count, installment_amount, total_payable, paid_amount, remaining_amount, status, purpose, request_date, approval_date, disbursement_date, first_installment_date, notes, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             ON CONFLICT (id) DO UPDATE SET status=$11`,
            [loan.id, loan.loanCode, loan.memberId, loan.amount, loan.interestRate,
             loan.installmentCount, loan.installmentAmount, loan.totalPayable,
             loan.paidAmount, loan.remainingAmount, loan.status, loan.purpose,
             loan.requestDate, loan.approvalDate, loan.disbursementDate,
             loan.firstInstallmentDate, loan.notes, loan.createdAt, loan.updatedAt]
          );
        }
      }

      if (body.data.installments && body.data.installments.length > 0) {
        for (const inst of body.data.installments) {
          await client.query(
            `INSERT INTO installments (id, loan_id, member_id, installment_no, due_date, amount, principal_amount, interest_amount, paid_amount, paid_date, status, receipt_no, notes, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             ON CONFLICT (id) DO UPDATE SET status=$11`,
            [inst.id, inst.loanId, inst.memberId, inst.installmentNo, inst.dueDate,
             inst.amount, inst.principalAmount, inst.interestAmount, inst.paidAmount,
             inst.paidDate, inst.status, inst.receiptNo, inst.notes, inst.createdAt, inst.updatedAt]
          );
        }
      }

      if (body.data.fundTransactions && body.data.fundTransactions.length > 0) {
        for (const tx of body.data.fundTransactions) {
          await client.query(
            `INSERT INTO fund_transactions (id, type, amount, description, member_id, loan_id, reference_no, transaction_date, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (id) DO NOTHING`,
            [tx.id, tx.type, tx.amount, tx.description, tx.memberId, tx.loanId,
             tx.referenceNo, tx.transactionDate, tx.createdAt]
          );
        }
      }

      // Reset sequences
      await client.query("SELECT setval('members_id_seq', (SELECT COALESCE(MAX(id), 1) FROM members))");
      await client.query("SELECT setval('loans_id_seq', (SELECT COALESCE(MAX(id), 1) FROM loans))");
      await client.query("SELECT setval('installments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM installments))");
      await client.query("SELECT setval('fund_transactions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM fund_transactions))");

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, message: "داده‌ها با موفقیت بازیابی شد" });
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json({ error: "خطای بازیابی: " + (error instanceof Error ? error.message : "خطای ناشناخته") }, { status: 500 });
  }
}
