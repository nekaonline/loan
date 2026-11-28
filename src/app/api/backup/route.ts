import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJalaliISODate } from "@/lib/utils";
import {
  buildBackupPayload,
  restoreBackupPayload,
  validateBackupPayload,
} from "@/lib/backup";

export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const backup = await buildBackupPayload(session.username);

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
    if (body.dryRun) {
      const validation = validateBackupPayload(body);
      return NextResponse.json(validation, { status: validation.valid ? 200 : 400 });
    }

    await restoreBackupPayload(body);
    return NextResponse.json({ success: true, message: "داده‌ها با موفقیت بازیابی شد" });
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json(
      {
        error:
          "خطای بازیابی: " +
          (error instanceof Error ? error.message : "خطای ناشناخته"),
      },
      { status: 500 }
    );
  }
}
