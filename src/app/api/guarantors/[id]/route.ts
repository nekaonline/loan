import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { guarantors, guarantorships, loans, members } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema-setup";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();

  const id = Number((await params).id);
  const [guarantor] = await db.select().from(guarantors).where(eq(guarantors.id, id)).limit(1);
  if (!guarantor) {
    return NextResponse.json({ error: "ضامن یافت نشد" }, { status: 404 });
  }

  const history = await db
    .select({
      id: guarantorships.id,
      createdAt: guarantorships.createdAt,
      loanId: loans.id,
      loanCode: loans.loanCode,
      amount: loans.amount,
      status: loans.status,
      memberId: members.id,
      memberName: members.firstName,
      memberLastName: members.lastName,
      memberCode: members.memberCode,
    })
    .from(guarantorships)
    .leftJoin(loans, eq(guarantorships.loanId, loans.id))
    .leftJoin(members, eq(guarantorships.memberId, members.id))
    .where(eq(guarantorships.guarantorId, id))
    .orderBy(desc(guarantorships.createdAt));

  return NextResponse.json({ guarantor, history });
}

export async function PUT(req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const id = Number((await params).id);
  const body = await req.json();
  const [updated] = await db
    .update(guarantors)
    .set({
      firstName: body.firstName,
      lastName: body.lastName,
      nationalId: body.nationalId,
      phone: body.phone,
      phone2: body.phone2 || null,
      address: body.address || null,
      jobTitle: body.jobTitle || null,
      relation: body.relation || null,
      notes: body.notes || null,
      isActive: body.isActive !== false,
    })
    .where(eq(guarantors.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "ضامن یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ guarantor: updated });
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const id = Number((await params).id);
  const [updated] = await db
    .update(guarantors)
    .set({ isActive: false })
    .where(eq(guarantors.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "ضامن یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: "ضامن غیرفعال شد" });
}
