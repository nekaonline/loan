import { db } from "@/db";
import {
  settings,
  smsLogs,
  members,
  installments,
  smsReminderLogs,
} from "@/db/schema";
import { eq, and, lte, or } from "drizzle-orm";
import { addDaysISO, formatDate, getIranTodayISO } from "@/lib/utils";
import { ensureSchema } from "@/lib/schema-setup";

interface SmsSettings {
  apiUrl: string;
  apiKey: string;
  sender: string;
  username?: string;
  password?: string;
  provider: string;
}

async function getSmsSettings(): Promise<SmsSettings | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(
      or(
        eq(settings.key, "sms_api_url"),
        eq(settings.key, "sms_api_key"),
        eq(settings.key, "sms_sender"),
        eq(settings.key, "sms_username"),
        eq(settings.key, "sms_password"),
        eq(settings.key, "sms_provider")
      )
    );

  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.value) map[row.key] = row.value;
  }

  if (!map["sms_api_url"] || !map["sms_sender"]) return null;

  return {
    apiUrl: map["sms_api_url"],
    apiKey: map["sms_api_key"] || "",
    sender: map["sms_sender"],
    username: map["sms_username"],
    password: map["sms_password"],
    provider: map["sms_provider"] || "generic",
  };
}

export async function sendSms(
  phone: string,
  message: string,
  memberId?: number,
  installmentId?: number
): Promise<{ success: boolean; message: string }> {
  const smsConfig = await getSmsSettings();

  if (!smsConfig) {
    await db.insert(smsLogs).values({
      memberId: memberId || null,
      phone,
      message,
      status: "failed",
      responseMessage: "SMS settings not configured",
      installmentId: installmentId || null,
    });
    return { success: false, message: "تنظیمات پیامک پیکربندی نشده است" };
  }

  try {
    let response;
    let success = false;
    let responseCode = "";
    let responseMessage = "";

    if (smsConfig.provider === "kavenegar") {
      const url = `${smsConfig.apiUrl}/sms/send.json`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apikey: smsConfig.apiKey,
        },
        body: new URLSearchParams({
          receptor: phone,
          message,
          sender: smsConfig.sender,
        }),
      });
      response = await res.json();
      success = response?.return?.status === 200;
      responseCode = String(response?.return?.status || "");
      responseMessage = response?.return?.message || "";
    } else if (smsConfig.provider === "melipayamak") {
      const res = await fetch(`${smsConfig.apiUrl}/send/simple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: smsConfig.username,
          password: smsConfig.password,
          to: phone,
          from: smsConfig.sender,
          text: message,
        }),
      });
      response = await res.json();
      success = response?.Value > 0;
      responseCode = String(response?.Value || "");
      responseMessage = response?.RetStatus || "";
    } else {
      // Generic HTTP API
      const res = await fetch(smsConfig.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${smsConfig.apiKey}`,
        },
        body: JSON.stringify({
          to: phone,
          from: smsConfig.sender,
          text: message,
        }),
      });
      response = await res.json();
      success = res.ok;
      responseCode = String(res.status);
      responseMessage = JSON.stringify(response);
    }

    await db.insert(smsLogs).values({
      memberId: memberId || null,
      phone,
      message,
      status: success ? "sent" : "failed",
      provider: smsConfig.provider,
      responseCode,
      responseMessage,
      sentAt: success ? new Date() : null,
      installmentId: installmentId || null,
    });

    return {
      success,
      message: success ? "پیامک با موفقیت ارسال شد" : responseMessage,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "خطای ناشناخته";
    await db.insert(smsLogs).values({
      memberId: memberId || null,
      phone,
      message,
      status: "failed",
      responseMessage: errMsg,
      installmentId: installmentId || null,
    });
    return { success: false, message: errMsg };
  }
}

export async function sendInstallmentReminders(options: { force?: boolean } = {}): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  await ensureSchema();
  // Get SMS template from settings
  const templateRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "sms_installment_template"))
    .limit(1);

  const template =
    templateRow[0]?.value ||
    "عضو گرامی {name}، قسط شماره {installment_no} به مبلغ {amount} ریال در تاریخ {due_date} سررسید می‌شود. صندوق قرض‌الحسنه بوعلی سینا";

  const daysBeforeRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "sms_reminder_days"))
    .limit(1);

  const daysBefore = parseInt(daysBeforeRow[0]?.value || "3");
  const reminderDateStr = addDaysISO(getIranTodayISO(), daysBefore);

  const pendingInstallments = await db
    .select({
      installment: installments,
      member: members,
    })
    .from(installments)
    .leftJoin(members, eq(installments.memberId, members.id))
    .where(
      and(
        eq(installments.status, "pending"),
        lte(installments.dueDate, reminderDateStr)
      )
    );

  const todayISO = getIranTodayISO();
  const alreadySent = await db
    .select({ installmentId: smsReminderLogs.installmentId })
    .from(smsReminderLogs)
    .where(eq(smsReminderLogs.reminderDate, todayISO));
  const sentIds = new Set(alreadySent.map((row) => row.installmentId));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { installment, member } of pendingInstallments) {
    if (!member) continue;
    if (!options.force && sentIds.has(installment.id)) {
      skipped++;
      continue;
    }
    const phone = member.phone;
    const message = template
      .replace("{name}", `${member.firstName} ${member.lastName}`)
      .replace("{installment_no}", String(installment.installmentNo))
      .replace("{amount}", new Intl.NumberFormat("fa-IR").format(parseFloat(installment.amount)))
      .replace("{due_date}", formatDate(installment.dueDate));

    const result = await sendSms(phone, message, member.id, installment.id);
    if (result.success) sent++;
    else failed++;

    await db.insert(smsReminderLogs).values({
      installmentId: installment.id,
      reminderDate: todayISO,
      status: result.success ? "sent" : "failed",
    });
    sentIds.add(installment.id);
  }

  return { sent, failed, skipped };
}
