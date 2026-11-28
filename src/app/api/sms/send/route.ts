import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendSms, sendInstallmentReminders } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "viewer")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const body = await req.json();

    if (body.action === "send_reminders") {
      const result = await sendInstallmentReminders({ force: body.force === true });
      return NextResponse.json(result);
    }

    if (!body.phone || !body.message) {
      return NextResponse.json(
        { error: "شماره تلفن و متن پیام الزامی است" },
        { status: 400 }
      );
    }

    const result = await sendSms(
      body.phone,
      body.message,
      body.memberId,
      body.installmentId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("SMS send error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
