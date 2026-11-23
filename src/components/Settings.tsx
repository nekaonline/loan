"use client";

import { useEffect, useState } from "react";

interface SettingsData {
  fund_name: string;
  fund_manager: string;
  hospital_name: string;
  hospital_address: string;
  hospital_phone: string;
  default_interest_rate: string;
  default_installment_count: string;
  max_loan_amount: string;
  sms_provider: string;
  sms_api_url: string;
  sms_api_key: string;
  sms_sender: string;
  sms_username: string;
  sms_password: string;
  sms_reminder_days: string;
  sms_installment_template: string;
  sms_auto_reminder: string;
  [key: string]: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>({} as SettingsData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testSmsPhone, setTestSmsPhone] = useState("");
  const [testSmsMsg, setTestSmsMsg] = useState("پیامک آزمایشی از صندوق قرض‌الحسنه بوعلی سینا");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function testSms() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testSmsPhone, message: testSmsMsg }),
      });
      const data = await res.json();
      setTestResult(data);
    } finally {
      setTesting(false);
    }
  }

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <div className="text-center py-16 text-gray-400">در حال بارگذاری...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">⚙️ تنظیمات سیستم</h1>
        <button onClick={handleSave} disabled={saving} className={`btn ${saved ? "btn-success" : "btn-primary"}`}>
          {saving ? "⏳ در حال ذخیره..." : saved ? "✅ ذخیره شد" : "💾 ذخیره تنظیمات"}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-2 flex gap-1">
        {[
          { id: "general", label: "🏥 اطلاعات صندوق" },
          { id: "loan", label: "💰 تنظیمات وام" },
          { id: "sms", label: "📱 پیامک" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm flex-1 ${activeTab === tab.id ? "btn-primary" : "btn-secondary"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">اطلاعات صندوق و بیمارستان</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="نام صندوق" value={settings.fund_name || ""} onChange={(v) => update("fund_name", v)} />
            <FormField label="نام مدیر صندوق" value={settings.fund_manager || ""} onChange={(v) => update("fund_manager", v)} />
            <FormField label="نام بیمارستان" value={settings.hospital_name || ""} onChange={(v) => update("hospital_name", v)} />
            <FormField label="تلفن بیمارستان" value={settings.hospital_phone || ""} onChange={(v) => update("hospital_phone", v)} />
          </div>
          <FormField label="آدرس بیمارستان" value={settings.hospital_address || ""} onChange={(v) => update("hospital_address", v)} textarea />
        </div>
      )}

      {activeTab === "loan" && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">تنظیمات پیش‌فرض وام</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نرخ سود پیش‌فرض (%)</label>
              <input type="number" step="0.1" className="form-input" value={settings.default_interest_rate || ""} onChange={e => update("default_interest_rate", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تعداد اقساط پیش‌فرض</label>
              <input type="number" className="form-input" value={settings.default_installment_count || ""} onChange={e => update("default_installment_count", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">حداکثر مبلغ وام (ریال)</label>
              <input type="number" className="form-input" value={settings.max_loan_amount || ""} onChange={e => update("max_loan_amount", e.target.value)} />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            💡 این تنظیمات به عنوان مقادیر پیش‌فرض هنگام ثبت وام جدید نمایش داده می‌شوند و قابل تغییر هستند.
          </div>
        </div>
      )}

      {activeTab === "sms" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#1e3a5f]">تنظیمات پیامک</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ارائه‌دهنده پیامک</label>
              <select className="form-input" value={settings.sms_provider || "kavenegar"} onChange={e => update("sms_provider", e.target.value)}>
                <option value="kavenegar">کاوه‌نگار (Kavenegar)</option>
                <option value="melipayamak">ملی‌پیامک (Melipayamak)</option>
                <option value="generic">عمومی (Generic HTTP API)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="آدرس API" value={settings.sms_api_url || ""} onChange={(v) => update("sms_api_url", v)} placeholder="https://api.kavenegar.com/v1" />
              <FormField label="کلید API" value={settings.sms_api_key || ""} onChange={(v) => update("sms_api_key", v)} type="password" />
            </div>

            {settings.sms_provider === "melipayamak" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="نام کاربری" value={settings.sms_username || ""} onChange={(v) => update("sms_username", v)} />
                <FormField label="رمز عبور API" value={settings.sms_password || ""} onChange={(v) => update("sms_password", v)} type="password" />
              </div>
            )}

            <FormField label="شماره فرستنده" value={settings.sms_sender || ""} onChange={(v) => update("sms_sender", v)} placeholder="5000..." />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">روزهای قبل از سررسید برای ارسال یادآور</label>
              <input type="number" min="1" max="30" className="form-input" value={settings.sms_reminder_days || "3"} onChange={e => update("sms_reminder_days", e.target.value)} style={{ maxWidth: 120 }} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">قالب پیامک یادآور قسط</label>
              <textarea rows={3} className="form-input" value={settings.sms_installment_template || ""} onChange={e => update("sms_installment_template", e.target.value)} />
              <div className="text-xs text-gray-500 mt-1">
                متغیرهای قابل استفاده: <code className="bg-gray-100 px-1 rounded">{"{name}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{installment_no}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{amount}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{due_date}"}</code>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReminder"
                checked={settings.sms_auto_reminder === "true"}
                onChange={e => update("sms_auto_reminder", e.target.checked ? "true" : "false")}
              />
              <label htmlFor="autoReminder" className="text-sm font-medium text-gray-700">
                ارسال خودکار پیامک یادآور (روزانه)
              </label>
            </div>
          </div>

          {/* Test SMS */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800">🧪 تست پیامک</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">شماره موبایل آزمایشی</label>
                <input className="form-input" value={testSmsPhone} onChange={e => setTestSmsPhone(e.target.value)} placeholder="09..." />
              </div>
              <div className="flex items-end">
                <button onClick={testSms} disabled={testing || !testSmsPhone} className="btn btn-warning w-full">
                  {testing ? "⏳ در حال ارسال..." : "📤 ارسال پیامک آزمایشی"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">متن پیامک آزمایشی</label>
              <textarea rows={2} className="form-input" value={testSmsMsg} onChange={e => setTestSmsMsg(e.target.value)} />
            </div>
            {testResult && (
              <div className={`rounded-lg p-3 text-sm ${testResult.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                {testResult.success ? "✅" : "❌"} {testResult.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea rows={2} className="form-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type={type} className="form-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
