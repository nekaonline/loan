"use client";

import { useEffect, useState } from "react";
import { formatNumber, formatDate } from "@/lib/utils";

interface Transaction {
  id: number;
  type: string;
  amount: string;
  description: string;
  referenceNo?: string;
  transactionDate: string;
  createdAt: string;
  memberId?: number;
  memberFirstName?: string;
  memberLastName?: string;
}

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  memberCode: string;
}

const typeLabels: Record<string, string> = {
  deposit: "💰 واریز",
  withdrawal: "💸 برداشت",
  loan_disbursement: "📤 پرداخت وام",
  installment_payment: "📥 دریافت قسط",
  fee: "🏷️ کارمزد",
  other: "📝 سایر",
};

const typeColors: Record<string, string> = {
  deposit: "text-green-600",
  withdrawal: "text-red-600",
  loan_disbursement: "text-red-600",
  installment_payment: "text-green-600",
  fee: "text-orange-600",
  other: "text-gray-600",
};

export default function Fund() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [form, setForm] = useState({
    type: "deposit",
    amount: "",
    description: "",
    memberId: "",
    referenceNo: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchFund(); }, [page]);

  async function fetchFund() {
    setLoading(true);
    try {
      const res = await fetch(`/api/fund?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setBalance(data.balance);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const amount = form.type === "withdrawal" || form.type === "loan_disbursement"
        ? `-${form.amount}`
        : form.amount;
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ type: "deposit", amount: "", description: "", memberId: "", referenceNo: "", transactionDate: new Date().toISOString().split("T")[0] });
        fetchFund();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">🏦 موجودی و تراکنش‌های صندوق</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          ➕ ثبت تراکنش
        </button>
      </div>

      {/* Balance Card */}
      <div className={`rounded-xl shadow-sm p-6 text-center ${balance >= 0 ? "bg-green-600" : "bg-red-600"} text-white`}>
        <div className="text-sm mb-1 opacity-80">موجودی فعلی صندوق</div>
        <div className="text-4xl font-bold">{formatNumber(Math.abs(balance))}</div>
        <div className="text-lg opacity-80 mt-1">ریال</div>
        {balance < 0 && <div className="text-sm mt-2 bg-red-700 rounded px-3 py-1 inline-block">⚠️ موجودی منفی</div>}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b font-semibold text-gray-700">تاریخچه تراکنش‌ها</div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>نوع</th>
                <th>مبلغ</th>
                <th>توضیحات</th>
                <th>عضو</th>
                <th>شماره مرجع</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">تراکنشی ثبت نشده</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{typeLabels[tx.type] || tx.type}</td>
                    <td className={`font-bold ${typeColors[tx.type] || "text-gray-600"}`}>
                      {parseFloat(tx.amount) >= 0 ? "+" : ""}
                      {formatNumber(Math.abs(parseFloat(tx.amount)))}
                    </td>
                    <td className="text-sm">{tx.description || "-"}</td>
                    <td className="text-sm">{tx.memberFirstName ? `${tx.memberFirstName} ${tx.memberLastName}` : "-"}</td>
                    <td className="font-mono text-xs">{tx.referenceNo || "-"}</td>
                    <td className="text-xs">{formatDate(tx.transactionDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 flex gap-2 border-t">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm btn-secondary">قبلی</button>
          <span className="btn btn-sm btn-secondary">صفحه {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={transactions.length < 20} className="btn btn-sm btn-secondary">بعدی</button>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">➕ ثبت تراکنش جدید</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع تراکنش *</label>
                <select required className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="deposit">واریز به صندوق</option>
                  <option value="withdrawal">برداشت از صندوق</option>
                  <option value="fee">کارمزد</option>
                  <option value="other">سایر</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ (ریال) *</label>
                <input type="number" required className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">جستجوی عضو</label>
                <input
                  className="form-input"
                  placeholder="نام یا کد عضو..."
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); searchMembers(e.target.value); }}
                />
                {members.length > 0 && memberSearch && (
                  <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-white shadow">
                    {members.map((m) => (
                      <button key={m.id} type="button"
                        onClick={() => { setForm({ ...form, memberId: m.id.toString() }); setMemberSearch(`${m.firstName} ${m.lastName}`); setMembers([]); }}
                        className="w-full text-right px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                      >{m.firstName} {m.lastName} ({m.memberCode})</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">شماره مرجع</label>
                  <input className="form-input" value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاریخ</label>
                  <input type="date" className="form-input" value={form.transactionDate} onChange={e => setForm({ ...form, transactionDate: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? "⏳..." : "💾 ثبت"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
