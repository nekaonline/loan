"use client";

import { useEffect, useState } from "react";
import { formatDate, formatNumber, calculateInstallments } from "@/lib/utils";

interface Loan {
  id: number;
  loanCode: string;
  amount: string;
  interestRate: string;
  installmentCount: number;
  installmentAmount: string;
  totalPayable: string;
  paidAmount: string;
  remainingAmount: string;
  status: string;
  purpose: string;
  requestDate: string;
  approvalDate?: string;
  disbursementDate?: string;
  firstInstallmentDate?: string;
  notes?: string;
  createdAt: string;
  memberId: number;
  memberFirstName: string;
  memberLastName: string;
  memberCode: string;
  memberPhone: string;
}

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  memberCode: string;
  nationalId: string;
}

interface Installment {
  id: number;
  installmentNo: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  paidDate?: string;
  status: string;
  receiptNo?: string;
}

const statusLabels: Record<string, string> = {
  pending: "در انتظار",
  approved: "تأیید شده",
  active: "فعال",
  paid: "پرداخت شده",
  rejected: "رد شده",
};

const statusBadge: Record<string, string> = {
  pending: "badge-yellow",
  approved: "badge-blue",
  active: "badge-green",
  paid: "badge-gray",
  rejected: "badge-red",
};

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<{ loan: Loan; installments: Installment[] } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [form, setForm] = useState({
    memberId: "",
    amount: "",
    interestRate: "4",
    installmentCount: "12",
    purpose: "",
    requestDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [preview, setPreview] = useState({ installmentAmount: 0, totalPayable: 0, totalInterest: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [payModal, setPayModal] = useState<{ loan: Loan; installment: Installment } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", paidDate: new Date().toISOString().split("T")[0], receiptNo: "", notes: "" });

  useEffect(() => { fetchLoans(); }, [page]);

  useEffect(() => {
    if (form.amount && form.installmentCount) {
      const p = calculateInstallments(
        parseFloat(form.amount) || 0,
        parseFloat(form.interestRate) || 0,
        parseInt(form.installmentCount) || 1
      );
      setPreview(p);
    }
  }, [form.amount, form.interestRate, form.installmentCount]);

  async function fetchLoans() {
    setLoading(true);
    try {
      const res = await fetch(`/api/loans?page=${page}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setLoans(data.loans);
        setTotal(data.total);
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

  async function openDetail(loan: Loan) {
    const res = await fetch(`/api/loans/${loan.id}`);
    if (res.ok) {
      const data = await res.json();
      setShowDetail(data);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطا"); return; }
      setShowModal(false);
      fetchLoans();
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(loanId: number, action: string, extra?: object) {
    const res = await fetch(`/api/loans/${loanId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (res.ok) {
      fetchLoans();
      if (showDetail) {
        const r = await fetch(`/api/loans/${loanId}`);
        if (r.ok) setShowDetail(await r.json());
      }
    }
  }

  async function handlePayInstallment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/installments/${payModal.installment.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payForm),
      });
      if (res.ok) {
        setPayModal(null);
        fetchLoans();
        if (showDetail) {
          const r = await fetch(`/api/loans/${payModal.loan.id}`);
          if (r.ok) setShowDetail(await r.json());
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">💰 مدیریت وام‌ها</h1>
        <button onClick={() => { setError(""); setShowModal(true); }} className="btn btn-primary">
          ➕ درخواست وام جدید
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>کد وام</th>
                <th>عضو</th>
                <th>مبلغ وام</th>
                <th>سود (%)</th>
                <th>اقساط</th>
                <th>پرداخت شده</th>
                <th>مانده</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">وامی ثبت نشده</td></tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id}>
                    <td><span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{loan.loanCode}</span></td>
                    <td>
                      <div className="text-sm font-semibold">{loan.memberFirstName} {loan.memberLastName}</div>
                      <div className="text-xs text-gray-400">{loan.memberCode}</div>
                    </td>
                    <td className="font-semibold">{formatNumber(parseFloat(loan.amount))}</td>
                    <td>{loan.interestRate}%</td>
                    <td>{loan.installmentCount}</td>
                    <td className="text-green-600">{formatNumber(parseFloat(loan.paidAmount))}</td>
                    <td className="text-red-600 font-semibold">{formatNumber(parseFloat(loan.remainingAmount))}</td>
                    <td><span className={`badge ${statusBadge[loan.status] || "badge-gray"}`}>{statusLabels[loan.status]}</span></td>
                    <td className="text-xs">{formatDate(loan.requestDate)}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openDetail(loan)} className="btn btn-sm btn-secondary">👁️</button>
                        {loan.status === "pending" && (
                          <button onClick={() => handleAction(loan.id, "approve")} className="btn btn-sm btn-success">✅ تأیید</button>
                        )}
                        {loan.status === "approved" && (
                          <button onClick={() => handleAction(loan.id, "disburse")} className="btn btn-sm btn-primary">💸 پرداخت</button>
                        )}
                        {loan.status === "pending" && (
                          <button onClick={() => handleAction(loan.id, "reject")} className="btn btn-sm btn-danger">❌</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t">
            <span className="text-sm text-gray-500">صفحه {page} از {totalPages} - مجموع {total} وام</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm btn-secondary">قبلی</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-sm btn-secondary">بعدی</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Loan Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1e3a5f]">➕ درخواست وام جدید</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">جستجوی عضو *</label>
                <input
                  className="form-input"
                  placeholder="نام، کد ملی یا کد عضویت..."
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); searchMembers(e.target.value); }}
                />
                {members.length > 0 && memberSearch && (
                  <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto bg-white shadow-lg">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setForm({ ...form, memberId: m.id.toString() }); setMemberSearch(`${m.firstName} ${m.lastName} (${m.memberCode})`); setMembers([]); }}
                        className="w-full text-right px-4 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                      >
                        <span className="font-semibold">{m.firstName} {m.lastName}</span>
                        <span className="text-gray-400 mr-2">{m.memberCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ وام (ریال) *</label>
                  <input required type="number" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نرخ سود (%)</label>
                  <input type="number" step="0.1" className="form-input" value={form.interestRate} onChange={e => setForm({...form, interestRate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تعداد اقساط</label>
                  <input type="number" className="form-input" value={form.installmentCount} onChange={e => setForm({...form, installmentCount: e.target.value})} />
                </div>
              </div>

              {/* Preview */}
              {form.amount && parseFloat(form.amount) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-blue-800 font-bold text-lg">{formatNumber(preview.installmentAmount)}</div>
                    <div className="text-blue-600 text-xs">مبلغ هر قسط (ریال)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-blue-800 font-bold text-lg">{formatNumber(preview.totalPayable)}</div>
                    <div className="text-blue-600 text-xs">مجموع پرداختی (ریال)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-orange-600 font-bold text-lg">{formatNumber(preview.totalInterest)}</div>
                    <div className="text-orange-600 text-xs">مجموع سود (ریال)</div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">هدف وام</label>
                <input className="form-input" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} placeholder="ضروری، درمانی، مسکن..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاریخ درخواست</label>
                <input type="date" className="form-input" value={form.requestDate} onChange={e => setForm({...form, requestDate: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <textarea rows={2} className="form-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || !form.memberId} className="btn btn-primary flex-1">
                  {saving ? "⏳ در حال ذخیره..." : "💾 ثبت درخواست"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal-content" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">💰 جزئیات وام {showDetail.loan.loanCode}</h2>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="font-bold text-[#1e3a5f] mb-2">اطلاعات وام‌گیرنده</div>
                <InfoRow label="نام" value={`${showDetail.loan.memberFirstName} ${showDetail.loan.memberLastName}`} />
                <InfoRow label="کد عضویت" value={showDetail.loan.memberCode} />
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="font-bold text-[#1e3a5f] mb-2">جزئیات مالی</div>
                <InfoRow label="مبلغ وام" value={`${formatNumber(parseFloat(showDetail.loan.amount))} ریال`} />
                <InfoRow label="نرخ سود" value={`${showDetail.loan.interestRate}%`} />
                <InfoRow label="تعداد اقساط" value={showDetail.loan.installmentCount.toString()} />
                <InfoRow label="مبلغ هر قسط" value={`${formatNumber(parseFloat(showDetail.loan.installmentAmount))} ریال`} />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>پرداخت شده: <strong className="text-green-600">{formatNumber(parseFloat(showDetail.loan.paidAmount))} ریال</strong></span>
                <span>مانده: <strong className="text-red-600">{formatNumber(parseFloat(showDetail.loan.remainingAmount))} ریال</strong></span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (parseFloat(showDetail.loan.paidAmount) / parseFloat(showDetail.loan.totalPayable)) * 100)}%`
                  }}
                />
              </div>
              <div className="text-center text-xs text-gray-500 mt-1">
                {Math.round((parseFloat(showDetail.loan.paidAmount) / parseFloat(showDetail.loan.totalPayable)) * 100)}% پرداخت شده
              </div>
            </div>

            {/* Installments Table */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">جدول اقساط</h3>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>شماره</th>
                      <th>سررسید</th>
                      <th>مبلغ</th>
                      <th>پرداخت شده</th>
                      <th>تاریخ پرداخت</th>
                      <th>وضعیت</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showDetail.installments.map((inst) => (
                      <tr key={inst.id}>
                        <td className="text-center font-bold">{inst.installmentNo}</td>
                        <td>{formatDate(inst.dueDate)}</td>
                        <td>{formatNumber(parseFloat(inst.amount))}</td>
                        <td className={parseFloat(inst.paidAmount) > 0 ? "text-green-600" : ""}>
                          {formatNumber(parseFloat(inst.paidAmount))}
                        </td>
                        <td>{inst.paidDate ? formatDate(inst.paidDate) : "-"}</td>
                        <td>
                          <span className={`badge ${
                            inst.status === "paid" ? "badge-green" :
                            inst.status === "overdue" ? "badge-red" : "badge-yellow"
                          }`}>
                            {inst.status === "paid" ? "پرداخت شده" : inst.status === "overdue" ? "معوق" : "در انتظار"}
                          </span>
                        </td>
                        <td>
                          {inst.status !== "paid" && showDetail.loan.status === "active" && (
                            <button
                              onClick={() => {
                                setPayModal({ loan: showDetail.loan, installment: inst });
                                setPayForm({ amount: inst.amount, paidDate: new Date().toISOString().split("T")[0], receiptNo: "", notes: "" });
                              }}
                              className="btn btn-sm btn-success"
                            >
                              💳 پرداخت
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {showDetail.loan.status === "pending" && (
              <div className="flex gap-3 mt-4">
                <button onClick={() => handleAction(showDetail.loan.id, "approve")} className="btn btn-success">✅ تأیید وام</button>
                <button onClick={() => handleAction(showDetail.loan.id, "reject")} className="btn btn-danger">❌ رد وام</button>
              </div>
            )}
            {showDetail.loan.status === "approved" && (
              <button onClick={() => handleAction(showDetail.loan.id, "disburse")} className="btn btn-primary mt-4">💸 پرداخت وام (فعال‌سازی)</button>
            )}
          </div>
        </div>
      )}

      {/* Pay Installment Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-content" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">💳 ثبت پرداخت قسط</h2>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
              <div>عضو: <strong>{payModal.loan.memberFirstName} {payModal.loan.memberLastName}</strong></div>
              <div>قسط شماره: <strong>{payModal.installment.installmentNo}</strong></div>
              <div>مبلغ: <strong>{formatNumber(parseFloat(payModal.installment.amount))} ریال</strong></div>
            </div>
            <form onSubmit={handlePayInstallment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ پرداختی (ریال)</label>
                <input type="number" required className="form-input" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاریخ پرداخت</label>
                <input type="date" required className="form-input" value={payForm.paidDate} onChange={e => setPayForm({...payForm, paidDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">شماره رسید</label>
                <input className="form-input" value={payForm.receiptNo} onChange={e => setPayForm({...payForm, receiptNo: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <input className="form-input" value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn btn-success flex-1">
                  {saving ? "⏳..." : "✅ ثبت پرداخت"}
                </button>
                <button type="button" onClick={() => setPayModal(null)} className="btn btn-secondary flex-1">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
