import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { db } from "@/db";
import { attachments, loans } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema-setup";
import {
  ensureUploadDir,
  isAllowedUpload,
  makeStoredName,
  MAX_UPLOAD_SIZE,
  safeUploadPath,
} from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();

  const loanId = Number(new URL(req.url).searchParams.get("loanId"));
  if (!loanId) {
    return NextResponse.json({ error: "شناسه وام معتبر نیست" }, { status: 400 });
  }

  const list = await db
    .select()
    .from(attachments)
    .where(eq(attachments.loanId, loanId))
    .orderBy(desc(attachments.createdAt));
  return NextResponse.json({ attachments: list });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer")
    return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });
  await ensureSchema();

  const form = await req.formData();
  const file = form.get("file");
  const loanId = Number(form.get("loanId"));
  const category = String(form.get("category") || "other");
  const description = String(form.get("description") || "");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "فایلی انتخاب نشده است" }, { status: 400 });
  }
  if (!isAllowedUpload(file.type)) {
    return NextResponse.json(
      { error: "فقط فایل‌های PDF و تصویر مجاز هستند" },
      { status: 400 }
    );
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد" },
      { status: 400 }
    );
  }

  const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
  if (!loan) {
    return NextResponse.json({ error: "وام یافت نشد" }, { status: 404 });
  }

  const storedName = makeStoredName(file.type, file.name);
  await ensureUploadDir();
  await writeFile(safeUploadPath(storedName), Buffer.from(await file.arrayBuffer()));

  const [created] = await db
    .insert(attachments)
    .values({
      loanId,
      memberId: loan.memberId,
      storedName,
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
      fileSize: file.size,
      category,
      description: description || null,
      uploadedBy: session.userId,
    })
    .returning();

  return NextResponse.json({ attachment: created }, { status: 201 });
}
