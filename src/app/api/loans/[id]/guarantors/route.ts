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

  const loanId = Number((await params).id);
  const list = await db
    .select({
      id: guarantorships.id,
      notes: guarantorships.notes,
      createdAt: guarantorships.createdAt,
      guarantorId: guarantors.id,
      firstName: guarantors.firstName,
      lastName: guarantors.lastName,
      nationalId: guarantors.nationalId,
      phone: guarantors.phone,
    })
    .from(guarantorships)
    .leftJoin(guarantors, eq(guarantorships.guarantorId, guarantors.id))
    .where(eq(guarantorships.loanId, loanId))
    .orderBy(desc(guarantorships.createdAt));

  return NextResponse.json({ guarantors: list });
}

export async function POST(req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const loanId = Number((await params).id);
  const body = await req.json();
  const guarantorId = Number(body.guarantorId);

  const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
  const [guarantor] = await db
    .select()
    .from(guarantors)
    .where(eq(guarantors.id, guarantorId))
    .limit(1);
  if (!loan || !guarantor) {
    return NextResponse.json(
      { error: "وام یا ضامن یافت نشد" },
      { status: 404 }
    );
  }

  const [created] = await db
    .insert(guarantorships)
    .values({
      guarantorId,
      loanId,
      memberId: loan.memberId,
      notes: body.notes || null,
      createdBy: session.userId,
    })
    .returning();

  // Keep the member's legacy guarantor fields in sync for detail screens.
  await db
    .update(members)
    .set({
      guarantorId,
      guarantorName: `${guarantor.firstName} ${guarantor.lastName}`,
      guarantorPhone: guarantor.phone,
      guarantorNationalId: guarantor.nationalId,
    })
    .where(eq(members.id, loan.memberId));

  return NextResponse.json({ guarantorship: created }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "شناسه ضمانت معتبر نیست" }, { status: 400 });
  }
  await db.delete(guarantorships).where(eq(guarantorships.id, id));
  return NextResponse.json({ success: true });
}
