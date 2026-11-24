import { NextRequest, NextResponse } from "next/server";
import { findMemberForInquiry } from "@/lib/public-lookup";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!rateLimit(`inquiry:${clientKey(req.headers)}`, 10)) {
    return NextResponse.json(
      { error: "تعداد درخواست‌ها زیاد است، لطفاً کمی بعد تلاش کنید" },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const nationalId = String(body.nationalId || "");
  const phone = String(body.phone || "");
  if (!nationalId || !phone) {
    return NextResponse.json(
      { error: "کد ملی و تلفن الزامی است" },
      { status: 400 }
    );
  }

  const inquiry = await findMemberForInquiry(nationalId, phone);
  if (!inquiry) {
    return NextResponse.json(
      { error: "اطلاعاتی با این مشخصات یافت نشد" },
      { status: 404 }
    );
  }
  return NextResponse.json({ inquiry });
}
