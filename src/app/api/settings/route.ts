import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allSettings = await db.select().from(settings);

    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      // Don't expose sensitive settings to non-admins
      if (
        session.role !== "admin" &&
        (s.key.includes("password") || s.key.includes("api_key"))
      ) {
        settingsMap[s.key] = "***";
      } else {
        settingsMap[s.key] = s.value || "";
      }
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error("Settings GET error:", error);
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
    const { settings: newSettings } = body;

    for (const [key, value] of Object.entries(newSettings)) {
      await db
        .insert(settings)
        .values({
          key,
          value: value as string,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: value as string,
            updatedBy: session.userId,
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
