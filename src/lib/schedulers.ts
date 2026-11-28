import { db } from "@/db";
import { backups, settings } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ensureSchema } from "@/lib/schema-setup";
import { sendInstallmentReminders } from "@/lib/sms";
import { createBackupSnapshot } from "@/lib/backup";

let started = false;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await ensureSchema();

    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings);
    const config = new Map(rows.map((row) => [row.key, row.value]));

    if (config.get("sms_auto_reminder") === "true") {
      await sendInstallmentReminders();
    }

    if (config.get("backup_auto_enabled") === "true") {
      const intervalHours = Math.max(1, parseInt(config.get("backup_interval_hours") || "24") || 24);
      const [lastBackup] = await db
        .select({ createdAt: backups.createdAt })
        .from(backups)
        .where(eq(backups.source, "auto"))
        .orderBy(desc(backups.createdAt))
        .limit(1);

      const elapsed = lastBackup
        ? Date.now() - new Date(lastBackup.createdAt).getTime()
        : Number.POSITIVE_INFINITY;

      if (elapsed >= intervalHours * 60 * 60 * 1000) {
        await createBackupSnapshot("scheduler", undefined, "auto");
      }
    }
  } catch (error) {
    console.error("Scheduled task error:", error);
  } finally {
    running = false;
  }
}

/** Starts hourly checks. Safe to call more than once. */
export function startSchedulers() {
  if (started || !process.env.DATABASE_URL) return;
  started = true;
  const timer = setInterval(() => void tick(), 60 * 60 * 1000);
  timer.unref?.();
}
