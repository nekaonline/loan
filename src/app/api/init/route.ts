import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, settings } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq, count } from "drizzle-orm";

export async function POST() {
  try {
    // Check if already initialized
    const [existing] = await db
      .select({ count: count() })
      .from(users);

    if (existing.count > 0) {
      return NextResponse.json({ message: "Already initialized" });
    }

    // Create admin user
    const hashedPassword = await hashPassword("admin123");
    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      fullName: "مدیر سیستم",
      role: "admin",
      isActive: true,
    });

    // Create default settings
    const defaultSettings = [
      { key: "fund_name", value: "صندوق قرض‌الحسنه بیمارستان بوعلی سینا ساری", description: "نام صندوق" },
      { key: "fund_manager", value: "مدیریت صندوق", description: "نام مدیر" },
      { key: "default_interest_rate", value: "4", description: "نرخ سود پیش‌فرض (درصد)" },
      { key: "default_installment_count", value: "12", description: "تعداد اقساط پیش‌فرض" },
      { key: "max_loan_amount", value: "100000000", description: "حداکثر مبلغ وام (ریال)" },
      { key: "sms_provider", value: "kavenegar", description: "ارائه‌دهنده پیامک" },
      { key: "sms_api_url", value: "", description: "آدرس API پیامک" },
      { key: "sms_api_key", value: "", description: "کلید API پیامک" },
      { key: "sms_sender", value: "", description: "شماره فرستنده پیامک" },
      { key: "sms_reminder_days", value: "3", description: "روزهای قبل از سررسید برای ارسال یادآور" },
      { key: "sms_installment_template", value: "عضو گرامی {name}، قسط شماره {installment_no} به مبلغ {amount} ریال در تاریخ {due_date} سررسید می‌شود. صندوق قرض‌الحسنه بوعلی سینا", description: "قالب پیامک یادآور قسط" },
      { key: "sms_auto_reminder", value: "false", description: "ارسال خودکار یادآور" },
      { key: "hospital_name", value: "بیمارستان بوعلی سینا ساری", description: "نام بیمارستان" },
      { key: "hospital_address", value: "ساری، خیابان بوعلی سینا", description: "آدرس بیمارستان" },
      { key: "hospital_phone", value: "", description: "تلفن بیمارستان" },
    ];

    for (const s of defaultSettings) {
      await db.insert(settings).values(s).onConflictDoNothing();
    }

    return NextResponse.json({ success: true, message: "سیستم راه‌اندازی شد" });
  } catch (error) {
    console.error("Init error:", error);
    return NextResponse.json({ error: "خطای راه‌اندازی" }, { status: 500 });
  }
}
