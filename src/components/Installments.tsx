"use client";

import { useEffect, useState } from "react";
import { formatDate, formatNumber, getIranTodayISO } from "@/lib/utils";
import JalaliDatePicker from "@/components/JalaliDatePicker";
import ReceiptViewer from "@/components/ReceiptViewer";

interface Installment {
  id: number;
  loanId: number;
  memberId: number;
  installmentNo: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  paidDate?: string;
  status: string;
  receiptNo?: string;
  notes?: string;
  loanCode: string;
  memberFirstName: string;
  memberLastName: string;
  memberCode: string;
  memberPhone: string;
}

export default function Installments() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [overdue, setOverdue] = useState(false);
  const [payModal, setPayModal] = useState<Installment | null>(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    paidDate: getIranTodayISO(),
    receiptNo: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [smsModal, setSmsModal] = useState<Installment | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [receiptCode, setReceiptCode] = useState<string | null>(null);

  useEffect(() => { fetchInstallments(); }, [filter, overdue]);

  async function fetchInstallments() {
    setLoading(true);
    try {
      let url = "/api/installments?";
      if (filter !== "all") url += `status=${filter}&`;
      if (overdue) url += "overdue=true&";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInstallments(data.installments);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/installments/${payModal.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payForm),
      });
      if (res.ok) {
        setPayModal(null);
        fetchInstallments();
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendSms(inst: Installment) {
    setSmsModal(inst);
    setSmsMessage(
      `عضو گرامی ${inst.memberFirstName} ${inst.memberLastName}، قسط شماره ${inst.installmentNo} به مبلغ ${formatNumber(parseFloat(inst.amount))} ریال در تاریخ ${formatDate(inst.dueDate)} سررسید می‌شود. صندوق قرض‌الحسنه بوعلی سینا`
    );
  }

  async function handleSendSms(e: React.FormEvent) {
    e.preventDefault();
    if (!smsModal) return;
    setSaving(true);
    try {
      await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: smsModal.memberPhone,
          message: smsMessage,
          memberId: smsModal.memberId,
          installmentId: smsModal.id,
        }),
      });
      setSmsModal(null);
    } finally {
      setSaving(false);
    }
  }

  const today = getIranTodayISO();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">📋 اقساط و پرداخت‌ها</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {[
            { value: "all", label: "همه" },
            { value: "pending", label: "در انتظار" },
            { value: "paid", label: "پرداخت شده" },
            { value: "overdue", label: "معوق" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-secondary"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => setOverdue(e.target.checked)}
            className="rounded"
          />
          فقط سررسید گذشته
        </label>
        <div className="mr-auto text-sm text-gray-500">
          {installments.length} قسط
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>عضو</th>
                <th>کد وام</th>
                <th>شماره قسط</th>
                <th>سررسید</th>
                <th>مبلغ</th>
                <th>پرداخت شده</th>
                <th>وضعیت</th>
                <th>تاریخ پرداخت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
              ) : installments.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">قسطی یافت نشد</td></tr>
              ) : (
                installments.map((inst) => {
                  const isOverdue = inst.status === "pending" && inst.dueDate < today;
                  return (
                    <tr key={inst.id} className={isOverdue ? "bg-red-50" : ""}>
                      <td>
                        <div className="text-sm font-semibold">{inst.memberFirstName} {inst.memberLastName}</div>
                        <div className="text-xs text-gray-400">{inst.memberCode}</div>
                      </td>
                      <td><span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{inst.loanCode}</span></td>
                      <td className="text-center font-bold">{inst.installmentNo}</td>
                      <td className={isOverdue ? "text-red-600 font-semibold" : ""}>{formatDate(inst.dueDate)}</td>
                      <td className="font-semibold">{formatNumber(parseFloat(inst.amount))}</td>
                      <td className={parseFloat(inst.paidAmount) > 0 ? "text-green-600" : "text-gray-400"}>
                        {formatNumber(parseFloat(inst.paidAmount))}
                      </td>
                      <td>
                        <span className={`badge ${
                          inst.status === "paid" ? "badge-green" :
                          isOverdue ? "badge-red" : "badge-yellow"
                        }`}>
                          {inst.status === "paid" ? "✅ پرداخت" : isOverdue ? "⚠️ معوق" : "⏳ در انتظار"}
                        </span>
                      </td>
                      <td className="text-xs">
                        {inst.paidDate ? formatDate(inst.paidDate) : "-"}
                        {inst.status === "paid" && inst.receiptNo && (
                          <button onClick={() => setReceiptCode(inst.receiptNo || null)} className="btn btn-sm btn-secondary mr-1">
                            🧾 رسید
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {inst.status !== "paid" && (
                            <>
                              <button
                                onClick={() => {
                                  setPayModal(inst);
                                  setPayForm({ amount: inst.amount, paidDate: getIranTodayISO(), receiptNo: "", notes: "" });
                                }}
                                className="btn btn-sm btn-success"
                              >
                                💳 پرداخت
                              </button>
                              <button onClick={() => sendSms(inst)} className="btn btn-sm btn-secondary" title="ارسال پیامک">📱</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-content" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">💳 ثبت پرداخت قسط</h2>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div>عضو: <strong>{payModal.memberFirstName} {payModal.memberLastName}</strong></div>
              <div>کد وام: <strong>{payModal.loanCode}</strong></div>
              <div>قسط شماره: <strong>{payModal.installmentNo}</strong></div>
              <div>مبلغ اصلی: <strong>{formatNumber(parseFloat(payModal.amount))} ریال</strong></div>
            </div>
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ پرداختی (ریال) *</label>
                <input type="number" required className="form-input" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاریخ پرداخت</label>
                <JalaliDatePicker
                  value={payForm.paidDate}
                  required
                  onChange={(paidDate) => setPayForm({ ...payForm, paidDate })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">شماره رسید</label>
                <input className="form-input" value={payForm.receiptNo} onChange={e => setPayForm({ ...payForm, receiptNo: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <input className="form-input" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn btn-success flex-1">{saving ? "⏳..." : "✅ ثبت پرداخت"}</button>
                <button type="button" onClick={() => setPayModal(null)} className="btn btn-secondary flex-1">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsModal && (
        <div className="modal-overlay" onClick={() => setSmsModal(null)}>
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">📱 ارسال پیامک یادآور</h2>
              <button onClick={() => setSmsModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <form onSubmit={handleSendSms} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">گیرنده</label>
                <input className="form-input" value={smsModal.memberPhone} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">متن پیامک</label>
                <textarea rows={4} className="form-input" value={smsMessage} onChange={e => setSmsMessage(e.target.value)} />
                <div className="text-xs text-gray-400 mt-1">{smsMessage.length} کاراکتر</div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? "⏳..." : "📤 ارسال"}</button>
                <button type="button" onClick={() => setSmsModal(null)} className="btn btn-secondary flex-1">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {receiptCode && (
        <div className="modal-overlay" onClick={() => setReceiptCode(null)}>
          <div className="modal-content" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setReceiptCode(null)} className="text-2xl text-gray-400">✕</button>
            </div>
            <ReceiptViewer code={receiptCode} embedded />
          </div>
        </div>
      )}
    </div>
  );
}
