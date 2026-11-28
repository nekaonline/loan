import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { backups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema-setup";
import { validateBackupPayload, restoreBackupPayload } from "@/lib/backup";

type Context = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 } as const;
  if (session.role !== "admin")
    return { error: "دسترسی محدود", status: 403 } as const;
  return { session } as const;
}

export async function GET(_req: NextRequest, { params }: Context) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  await ensureSchema();
  const id = Number((await params).id);
  const [backup] = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  if (!backup) {
    return NextResponse.json({ error: "پشتیبان یافت نشد" }, { status: 404 });
  }
  return new NextResponse(backup.content, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${backup.filename}"`,
    },
  });
}

export async function POST(req: NextRequest, { params }: Context) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const id = Number((await params).id);
  const [backup] = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  if (!backup) {
    return NextResponse.json({ error: "پشتیبان یافت نشد" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  let payload: unknown;
  try {
    payload = JSON.parse(backup.content);
  } catch {
    return NextResponse.json({ error: "محتوای پشتیبان خواندنی نیست" }, { status: 400 });
  }

  const validation = validateBackupPayload(payload);
  if (!validation.valid) {
    return NextResponse.json(validation, { status: 400 });
  }
  if (body.dryRun) {
    return NextResponse.json({ dryRun: true, ...validation });
  }

  await restoreBackupPayload(payload as Parameters<typeof restoreBackupPayload>[0]);
  return NextResponse.json({ success: true, message: "پشتیبان بازیابی شد" });
}
