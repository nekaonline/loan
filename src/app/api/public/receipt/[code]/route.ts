import { NextRequest, NextResponse } from "next/server";
import { findReceipt } from "@/lib/public-lookup";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!rateLimit(`receipt:${clientKey(req.headers)}`, 30)) {
    return NextResponse.json(
      { error: "تعداد درخواست‌ها زیاد است، لطفاً کمی بعد تلاش کنید" },
      { status: 429 }
    );
  }

  const { code } = await params;
  const receipt = await findReceipt(decodeURIComponent(code));
  if (!receipt) {
    return NextResponse.json({ error: "رسیدی با این کد یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ receipt });
}
