import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members, loans, installments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const memberId = parseInt(id);

    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: "عضو یافت نشد" }, { status: 404 });
    }

    // Get member loans
    const memberLoans = await db
      .select()
      .from(loans)
      .where(eq(loans.memberId, memberId))
      .orderBy(desc(loans.createdAt));

    // Get member installments
    const memberInstallments = await db
      .select()
      .from(installments)
      .where(eq(installments.memberId, memberId))
      .orderBy(desc(installments.dueDate));

    return NextResponse.json({ member, loans: memberLoans, installments: memberInstallments });
  } catch (error) {
    console.error("Member GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "viewer") return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const { id } = await params;
    const memberId = parseInt(id);
    const body = await req.json();

    const [updated] = await db
      .update(members)
      .set({
        firstName: body.firstName,
        lastName: body.lastName,
        nationalId: body.nationalId,
        phone: body.phone,
        phone2: body.phone2 || null,
        email: body.email || null,
        address: body.address || null,
        city: body.city || null,
        postalCode: body.postalCode || null,
        birthDate: body.birthDate || null,
        jobTitle: body.jobTitle || null,
        department: body.department || null,
        employeeId: body.employeeId || null,
        guarantorName: body.guarantorName || null,
        guarantorPhone: body.guarantorPhone || null,
        guarantorNationalId: body.guarantorNationalId || null,
        isActive: body.isActive !== undefined ? body.isActive : true,
        notes: body.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "عضو یافت نشد" }, { status: 404 });
    }

    return NextResponse.json({ member: updated });
  } catch (error) {
    console.error("Member PUT error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const { id } = await params;
    const memberId = parseInt(id);

    // Check if member has active loans
    const activeLoans = await db
      .select({ id: loans.id })
      .from(loans)
      .where(eq(loans.memberId, memberId))
      .limit(1);

    if (activeLoans.length > 0) {
      // Soft delete
      await db
        .update(members)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(members.id, memberId));
      return NextResponse.json({ message: "عضو غیرفعال شد (دارای سابقه وام)" });
    }

    await db.delete(members).where(eq(members.id, memberId));
    return NextResponse.json({ message: "عضو حذف شد" });
  } catch (error) {
    console.error("Member DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
