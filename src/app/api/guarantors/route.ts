import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { guarantors } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema-setup";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();

  const search = new URL(req.url).searchParams.get("search") || "";
  const list = await db
    .select()
    .from(guarantors)
    .orderBy(desc(guarantors.createdAt));

  const normalized = search.trim().toLowerCase();
  const filtered = normalized
    ? list.filter((g) =>
        `${g.firstName} ${g.lastName} ${g.nationalId} ${g.phone}`
          .toLowerCase()
          .includes(normalized)
      )
    : list;

  return NextResponse.json({ guarantors: filtered });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const body = await req.json();
  if (!body.firstName || !body.lastName || !body.nationalId || !body.phone) {
    return NextResponse.json(
      { error: "نام، نام خانوادگی، کد ملی و تلفن ضامن الزامی است" },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select({ id: guarantors.id })
    .from(guarantors)
    .where(eq(guarantors.nationalId, body.nationalId))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "ضامنی با این کد ملی وجود دارد" },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(guarantors)
    .values({
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
      createdBy: session.userId,
    })
    .returning();

  return NextResponse.json({ guarantor: created }, { status: 201 });
}
