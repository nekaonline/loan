"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";

interface SmsLog {
  id: number;
  phone: string;
  message: string;
  status: string;
  provider?: string;
  responseMessage?: string;
  sentAt?: string;
  createdAt: string;
  memberFirstName?: string;
  memberLastName?: string;
}

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  memberCode: string;
  phone: string;
}

export default function SmsPanel() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [form, setForm] = useState({ phone: "", message: "", memberId: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/sms/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } finally {
      setLoading(false);
    }
  }

  async function searchMembers(q: string) {
    if (q.length < 2) return;
    const res = await fetch(`/api/members?search=${encodeURIComponent(q)}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedMember?.phone || form.phone,
          message: form.message,
          memberId: selectedMember?.id,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setForm({ ...form, message: "" });
        fetchLogs();
      }
    } finally {
      setSending(false);
    }
  }

  async function sendReminders() {
    setSendingReminders(true);
    setReminderResult(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reminders" }),
      });
      const data = await res.json();
      setReminderResult(data);
      fetchLogs();
    } finally {
      setSendingReminders(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">📱 مدیریت پیامک</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Send SMS */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-[#1e3a5f] mb-4">📤 ارسال پیامک</h2>
          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">جستجوی عضو</label>
              <input
                className="form-input"
                placeholder="نام یا کد ملی..."
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); searchMembers(e.target.value); }}
              />
              {members.length > 0 && memberSearch && (
                <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-white shadow">
                  {members.map((m) => (
                    <button key={m.id} type="button"
                      onClick={() => {
                        setSelectedMember(m);
                        setMemberSearch(`${m.firstName} ${m.lastName}`);
                        setForm({ ...form, phone: m.phone, memberId: m.id.toString() });
                        setMembers([]);
                      }}
                      className="w-full text-right px-3 py-2 hover:bg-gray-50 text-sm border-b"
                    >
                      {m.firstName} {m.lastName} - {m.phone}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">شماره موبایل *</label>
              <input
                required
                className="form-input"
                value={selectedMember?.phone || form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                readOnly={!!selectedMember}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">متن پیامک *</label>
              <textarea required rows={4} className="form-input" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
              <div className="text-xs text-gray-400 mt-1">{form.message.length} کاراکتر</div>
            </div>
            {result && (
              <div className={`rounded-lg p-3 text-sm ${result.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                {result.success ? "✅" : "❌"} {result.message}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={sending} className="btn btn-primary flex-1">{sending ? "⏳..." : "📤 ارسال"}</button>
              <button type="button" onClick={() => { setSelectedMember(null); setMemberSearch(""); setForm({ phone: "", message: "", memberId: "" }); setResult(null); }} className="btn btn-secondary">پاک</button>
            </div>
          </form>
        </div>

        {/* Bulk Reminders */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-[#1e3a5f] mb-4">🔔 ارسال یادآور گروهی</h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            با کلیک بر روی دکمه زیر، پیامک یادآور به تمام اعضایی که اقساطشان سررسید شده یا نزدیک به سررسید است ارسال می‌شود.
          </p>
          <button
            onClick={sendReminders}
            disabled={sendingReminders}
            className="btn btn-warning w-full"
          >
            {sendingReminders ? "⏳ در حال ارسال..." : "📱 ارسال یادآور به همه بدهکاران"}
          </button>
          {reminderResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              ✅ ارسال موفق: <strong>{reminderResult.sent}</strong> | ❌ ناموفق: <strong>{reminderResult.failed}</strong>
            </div>
          )}
          <div className="mt-4 text-xs text-gray-400 space-y-1">
            <div>• تنظیمات روزهای یادآور و قالب پیامک در بخش تنظیمات قابل تغییر است</div>
            <div>• ارسال خودکار روزانه در تنظیمات فعال‌سازی می‌شود</div>
          </div>
        </div>
      </div>

      {/* SMS Logs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-[#1e3a5f]">📋 سابقه ارسال پیامک‌ها</h2>
          <button onClick={fetchLogs} className="btn btn-sm btn-secondary">🔄 بارگذاری مجدد</button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>عضو</th>
                <th>شماره</th>
                <th>متن پیام</th>
                <th>وضعیت</th>
                <th>پاسخ سرور</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">پیامکی ارسال نشده</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.memberFirstName ? `${log.memberFirstName} ${log.memberLastName}` : "-"}</td>
                    <td className="font-mono text-xs">{log.phone}</td>
                    <td className="max-w-xs text-xs text-gray-600 truncate" title={log.message}>{log.message}</td>
                    <td>
                      <span className={`badge ${log.status === "sent" ? "badge-green" : log.status === "failed" ? "badge-red" : "badge-yellow"}`}>
                        {log.status === "sent" ? "✅ ارسال شد" : log.status === "failed" ? "❌ ناموفق" : "⏳ در صف"}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">{log.responseMessage?.slice(0, 50) || "-"}</td>
                    <td className="text-xs">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
