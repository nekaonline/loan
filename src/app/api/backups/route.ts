import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { backups } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema-setup";
import { createBackupSnapshot } from "@/lib/backup";

async function adminSession() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 } as const;
  if (session.role !== "admin")
    return { error: "دسترسی محدود", status: 403 } as const;
  return { session } as const;
}

export async function GET() {
  const auth = await adminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  await ensureSchema();
  const list = await db
    .select({
      id: backups.id,
      filename: backups.filename,
      version: backups.version,
      size: backups.size,
      checksum: backups.checksum,
      source: backups.source,
      createdAt: backups.createdAt,
    })
    .from(backups)
    .orderBy(desc(backups.createdAt));

  return NextResponse.json({ backups: list });
}

export async function POST() {
  const auth = await adminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const backup = await createBackupSnapshot(
      auth.session.username,
      auth.session.userId,
      "manual"
    );
    return NextResponse.json(
      {
        backup: {
          id: backup.id,
          filename: backup.filename,
          createdAt: backup.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create snapshot error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await adminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "شناسه پشتیبان معتبر نیست" }, { status: 400 });
  }
  await db.delete(backups).where(eq(backups.id, id));
  return NextResponse.json({ success: true });
}
