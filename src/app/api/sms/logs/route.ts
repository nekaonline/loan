import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { smsLogs, members } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const logs = await db
      .select({
        id: smsLogs.id,
        phone: smsLogs.phone,
        message: smsLogs.message,
        status: smsLogs.status,
        provider: smsLogs.provider,
        responseMessage: smsLogs.responseMessage,
        sentAt: smsLogs.sentAt,
        createdAt: smsLogs.createdAt,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
      })
      .from(smsLogs)
      .leftJoin(members, eq(smsLogs.memberId, members.id))
      .orderBy(desc(smsLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("SMS logs error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
