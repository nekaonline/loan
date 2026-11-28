"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime, getJalaliISODate } from "@/lib/utils";

interface SavedBackup {
  id: number;
  filename: string;
  size: number;
  checksum: string | null;
  source: string;
  createdAt: string;
}

export default function Backup() {
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [backups, setBackups] = useState<SavedBackup[]>([]);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState("24");
  const [retention, setRetention] = useState("10");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBackups = useCallback(async () => {
    const res = await fetch("/api/backups");
    if (res.ok) setBackups((await res.json()).backups);
    const settingsRes = await fetch("/api/settings");
    if (settingsRes.ok) {
      const values = (await settingsRes.json()).settings;
      setAutoEnabled(values.backup_auto_enabled === "true");
      setIntervalHours(values.backup_interval_hours || "24");
      setRetention(values.backup_retention_count || "10");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBackups();
  }, [loadBackups]);

  async function handleDownload() {
    const res = await fetch("/api/backup");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${getJalaliISODate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSaveSnapshot() {
    setResult(null);
    const res = await fetch("/api/backups", { method: "POST" });
    const data = await res.json();
    setResult({
      success: res.ok,
      message: res.ok ? "نسخه پشتیبان در سرور ذخیره شد" : data.error || "خطا",
    });
    if (res.ok) void loadBackups();
  }

  async function handleRestoreFile(file: File, dryRun: boolean) {
    setRestoring(true);
    setResult(null);
    try {
      const payload = JSON.parse(await file.text());
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, dryRun }),
      });
      const data = await res.json();
      setResult({
        success: res.ok,
        message: dryRun
          ? res.ok
            ? `بررسی موفق: ${Object.values(data.counts || {}).reduce((a: number, b) => a + Number(b), 0)} رکورد`
            : data.error || "فایل معتبر نیست"
          : data.message || data.error,
      });
    } catch {
      setResult({ success: false, message: "خطا در خواندن فایل پشتیبان" });
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSavedBackup(id: number, dryRun: boolean) {
    setResult(null);
    if (!dryRun && !confirm("⚠️ بازیابی داده‌های فعلی را جایگزین می کند. ادامه؟")) return;
    const res = await fetch(`/api/backups/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    });
    const data = await res.json();
    setResult({
      success: res.ok,
      message: dryRun
        ? res.ok
          ? "بررسی موفق: ساختار پشتیبان معتبر است"
          : data.error || "پشتیبان معتبر نیست"
        : data.message || data.error,
    });
  }

  async function saveSettings() {
    setResult(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          backup_auto_enabled: autoEnabled ? "true" : "false",
          backup_interval_hours: intervalHours,
          backup_retention_count: retention,
        },
      }),
    });
    setResult({
      success: res.ok,
      message: res.ok ? "تنظیمات پشتیبان ذخیره شد" : "خطا در ذخیره تنظیمات",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">💾 پشتیبان‌گیری و بازیابی</h1>
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-sm ${result.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {result.success ? "✅" : "❌"} {result.message}
          {result.success && !result.message.includes("بررسی") && !result.message.includes("ذخیره") && (
            <button onClick={() => window.location.reload()} className="btn btn-sm btn-success mr-3">
              بارگذاری مجدد
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">📦</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">تهیه نسخه پشتیبان</h2>
            <p className="text-gray-600 mb-4 text-sm">
              می‌توانید پشتیبان را دانلود کنید یا به صورت نسخه‌بندی‌شده در سرور ذخیره نمایید.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void handleDownload()} className="btn btn-primary">📥 دانلود فایل JSON</button>
              <button onClick={() => void handleSaveSnapshot()} className="btn btn-success">💾 ذخیره نسخه در سرور</button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">⚙️ پشتیبان‌گیری خودکار</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoEnabled} onChange={(e) => setAutoEnabled(e.target.checked)} />
            فعال‌سازی پشتیبان خودکار
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span>هر</span>
            <input type="number" min="1" className="form-input w-24" value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} />
            <span>ساعت</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>نگهداری</span>
            <input type="number" min="1" className="form-input w-24" value={retention} onChange={(e) => setRetention(e.target.value)} />
            <span>نسخه اخیر</span>
          </div>
          <button onClick={() => void saveSettings()} className="btn btn-sm btn-primary">ذخیره تنظیمات</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">🗂️ نسخه‌های ذخیره‌شده</h2>
        {backups.length === 0 ? (
          <p className="text-sm text-gray-400">نسخهای در سرور ذخیره نشده است</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>نام فایل</th>
                  <th>منبع</th>
                  <th>حجم</th>
                  <th>تاریخ</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td className="font-mono">{backup.filename}</td>
                    <td>{backup.source === "auto" ? "خودکار" : "دستی"}</td>
                    <td>{Math.ceil(backup.size / 1024)} KB</td>
                    <td>{formatDateTime(backup.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        <a href={`/api/backups/${backup.id}`} className="btn btn-sm btn-secondary">⬇️</a>
                        <button onClick={() => void handleSavedBackup(backup.id, true)} className="btn btn-sm btn-warning">بررسی</button>
                        <button onClick={() => void handleSavedBackup(backup.id, false)} className="btn btn-sm btn-danger">بازیابی</button>
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/backups?id=${backup.id}`, { method: "DELETE" });
                            if (res.ok) void loadBackups();
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🔄</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">بازیابی از فایل</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              ⚠️ بازیابی تمام داده‌های فعلی را جایگزین می‌کند. ابتدا گزینه بررسی (dry-run) را امتحان کنید.
            </div>
            <label className="cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-3xl mb-2">📂</div>
                <div className="font-semibold text-gray-700">فایل پشتیبان JSON را انتخاب کنید</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                disabled={restoring}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleRestoreFile(file, false);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-bold text-blue-800 mb-3">💡 راهنما</h3>
        <ul className="space-y-2 text-sm text-blue-700">
          <li>🔹 نسخه‌های خودکار هر ساعت بررسی می‌شوند و در صورت نیاز ایجاد می‌گردند.</li>
          <li>🔹 تعداد نسخه‌های نگهداری‌شده توسط تنظیم retention محدود می‌شود.</li>
          <li>🔹 قبل از بازیابی، دکمه «بررسی» ساختار فایل را بدون تغییر داده‌ها اعتبارسنجی می‌کند.</li>
          <li>🔹 فایل‌های پیوست وام در پوشه uploads سرور نگهداری می‌شوند و در پشتیبان JSON فقط اطلاعات متای آنها ذخیره می‌شود.</li>
        </ul>
      </div>
    </div>
  );
}
