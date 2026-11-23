"use client";

import { useState, useRef } from "react";

export default function Backup() {
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDownload() {
    const res = await fetch("/api/backup");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("⚠️ بازیابی نسخه پشتیبان تمام داده‌های فعلی را جایگزین می‌کند. آیا مطمئن هستید؟")) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setRestoring(true);
    setRestoreResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      setRestoreResult({ success: res.ok, message: result.message || result.error });
    } catch {
      setRestoreResult({ success: false, message: "خطا در خواندن فایل پشتیبان" });
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">💾 پشتیبان‌گیری و بازیابی</h1>
      </div>

      {/* Backup Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">📦</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">تهیه نسخه پشتیبان</h2>
            <p className="text-gray-600 mb-4 text-sm leading-relaxed">
              با کلیک بر روی دکمه زیر، تمام اطلاعات سیستم شامل اعضا، وام‌ها، اقساط، تراکنش‌ها و تنظیمات
              در قالب فایل JSON دانلود می‌شود. این فایل را در محل امنی نگهداری کنید.
            </p>
            <button onClick={handleDownload} className="btn btn-primary">
              📥 دانلود نسخه پشتیبان
            </button>
          </div>
        </div>
      </div>

      {/* Restore Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🔄</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">بازیابی از نسخه پشتیبان</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              ⚠️ <strong>هشدار مهم:</strong> بازیابی از نسخه پشتیبان تمام داده‌های فعلی را حذف و با داده‌های پشتیبان جایگزین می‌کند. این عملیات غیرقابل بازگشت است.
            </div>
            <label className="cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-3xl mb-2">📂</div>
                <div className="font-semibold text-gray-700">فایل پشتیبان را اینجا بارگذاری کنید</div>
                <div className="text-sm text-gray-400 mt-1">فرمت: JSON</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="hidden"
                disabled={restoring}
              />
            </label>
            {restoring && (
              <div className="mt-4 flex items-center gap-2 text-blue-600">
                <span className="animate-spin">⏳</span>
                در حال بازیابی اطلاعات...
              </div>
            )}
            {restoreResult && (
              <div className={`mt-4 rounded-lg p-4 text-sm ${restoreResult.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                {restoreResult.success ? "✅" : "❌"} {restoreResult.message}
                {restoreResult.success && (
                  <div className="mt-2">
                    <button onClick={() => window.location.reload()} className="btn btn-sm btn-success">
                      🔄 بارگذاری مجدد صفحه
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-bold text-blue-800 mb-3">💡 راهنمای پشتیبان‌گیری</h3>
        <ul className="space-y-2 text-sm text-blue-700">
          <li>🔹 توصیه می‌شود هر هفته یک بار از اطلاعات پشتیبان بگیرید</li>
          <li>🔹 فایل‌های پشتیبان را در چند محل مختلف (ابر، فلش‌درایو) نگهداری کنید</li>
          <li>🔹 قبل از هر تغییر بزرگ در سیستم، پشتیبان تهیه کنید</li>
          <li>🔹 فایل پشتیبان شامل تمام اطلاعات سیستم است (به جز رمزهای عبور)</li>
          <li>🔹 برای بازیابی روی سرور جدید، ابتدا سیستم را راه‌اندازی کرده سپس بازیابی کنید</li>
        </ul>
      </div>
    </div>
  );
}
