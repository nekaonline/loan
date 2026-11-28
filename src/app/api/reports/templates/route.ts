import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reportTemplates } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema-setup";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();

  const list = await db
    .select({
      id: reportTemplates.id,
      name: reportTemplates.name,
      reportType: reportTemplates.reportType,
      filters: reportTemplates.filters,
      createdAt: reportTemplates.createdAt,
    })
    .from(reportTemplates)
    .orderBy(desc(reportTemplates.createdAt));

  return NextResponse.json({ templates: list });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const body = await req.json();
  const name = String(body.name || "").trim();
  const reportType = String(body.reportType || "summary");
  if (!name) {
    return NextResponse.json({ error: "نام الگو الزامی است" }, { status: 400 });
  }

  const [created] = await db
    .insert(reportTemplates)
    .values({
      name: name.slice(0, 150),
      reportType: reportType.slice(0, 50),
      filters: JSON.stringify(body.filters || {}),
      createdBy: session.userId,
    })
    .returning();

  return NextResponse.json({ template: created }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "شناسه الگو معتبر نیست" }, { status: 400 });
  }
  await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  return NextResponse.json({ success: true });
}
