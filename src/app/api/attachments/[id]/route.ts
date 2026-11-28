import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema-setup";
import { safeUploadPath } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();

  const id = Number((await params).id);
  const [file] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  if (!file) {
    return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
  }

  try {
    const content = await readFile(safeUploadPath(file.storedName));
    return new NextResponse(content, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "فایل روی دیسک یافت نشد" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const id = Number((await params).id);
  const [file] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  if (!file) {
    return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
  }

  await db.delete(attachments).where(eq(attachments.id, id));
  try {
    await unlink(safeUploadPath(file.storedName));
  } catch {
    // Missing file on disk should not block deleting the database row.
  }
  return NextResponse.json({ success: true });
}
