"use client";

import { useEffect, useState } from "react";
import { formatNumber, formatDate, getIranTodayISO } from "@/lib/utils";

interface Debtor {
  memberId: number;
  memberCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
  totalLoaned: string;
  totalPaid: string;
  totalRemaining: string;
  loanCount: number;
  overdueInstallments: number;
  overdueAmount: string;
}

export default function Debtors() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Debtor | null>(null);
  const [memberDetails, setMemberDetails] = useState<{ loans: unknown[]; installments: unknown[] } | null>(null);
  const [bulkSms, setBulkSms] = useState(false);
  const [sending, setSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => { fetchDebtors(); }, []);

  async function fetchDebtors() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/debtors");
      if (res.ok) {
        const data = await res.json();
        setDebtors(data.debtors);
      }
    } finally {
      setLoading(false);
    }
  }

  async function openMember(debtor: Debtor) {
    setSelectedMember(debtor);
    const res = await fetch(`/api/members/${debtor.memberId}`);
    if (res.ok) {
      const data = await res.json();
      setMemberDetails(data);
    }
  }

  async function sendBulkSms() {
    setSending(true);
    setSmsResult(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reminders" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmsResult(data);
      }
    } finally {
      setSending(false);
    }
  }

  const totalRemaining = debtors.reduce((sum, d) => sum + parseFloat(d.totalRemaining || "0"), 0);
  const totalOverdue = debtors.reduce((sum, d) => sum + parseInt(String(d.overdueInstallments || "0")), 0);
  const today = getIranTodayISO();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">⚠️ لیست بدهکاران</h1>
        <div className="flex gap-2">
          <button onClick={sendBulkSms} disabled={sending} className="btn btn-warning">
            {sending ? "⏳ در حال ارسال..." : "📱 ارسال یادآور گروهی"}
          </button>
        </div>
      </div>

      {smsResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
          ✅ نتیجه ارسال: <strong>{smsResult.sent}</strong> پیامک ارسال شد، <strong>{smsResult.failed}</strong> مورد ناموفق
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border-r-4 border-red-500">
          <div className="text-xs text-gray-500 mb-1">تعداد بدهکاران</div>
          <div className="text-2xl font-bold text-red-600">{debtors.length} نفر</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-r-4 border-orange-500">
          <div className="text-xs text-gray-500 mb-1">مجموع بدهی</div>
          <div className="text-2xl font-bold text-orange-600">{formatNumber(totalRemaining)}</div>
          <div className="text-xs text-gray-400">ریال</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-r-4 border-yellow-500">
          <div className="text-xs text-gray-500 mb-1">اقساط معوق</div>
          <div className="text-2xl font-bold text-yellow-600">{totalOverdue} قسط</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>عضو</th>
                <th>بخش</th>
                <th>تلفن</th>
                <th>تعداد وام</th>
                <th>مجموع وام‌گرفته</th>
                <th>پرداخت شده</th>
                <th>مانده بدهی</th>
                <th>اقساط معوق</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
              ) : debtors.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">بدهکاری وجود ندارد 🎉</td></tr>
              ) : (
                debtors.map((d, idx) => (
                  <tr key={d.memberId} className={Number(d.overdueInstallments) > 0 ? "bg-red-50" : ""}>
                    <td className="text-center text-gray-400">{idx + 1}</td>
                    <td>
                      <div className="font-semibold">{d.firstName} {d.lastName}</div>
                      <div className="text-xs text-gray-400">{d.memberCode}</div>
                    </td>
                    <td>{d.department || "-"}</td>
                    <td>{d.phone}</td>
                    <td className="text-center">{d.loanCount}</td>
                    <td>{formatNumber(parseFloat(d.totalLoaned || "0"))}</td>
                    <td className="text-green-600">{formatNumber(parseFloat(d.totalPaid || "0"))}</td>
                    <td className="font-bold text-red-600">{formatNumber(parseFloat(d.totalRemaining || "0"))}</td>
                    <td>
                      {Number(d.overdueInstallments) > 0 ? (
                        <span className="badge badge-red">{d.overdueInstallments} قسط</span>
                      ) : (
                        <span className="badge badge-green">ندارد</span>
                      )}
                    </td>
                    <td>
                      <button onClick={() => openMember(d)} className="btn btn-sm btn-secondary">📋 جزئیات</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="modal-overlay" onClick={() => { setSelectedMember(null); setMemberDetails(null); }}>
          <div className="modal-content" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">
                📋 سابقه بدهی: {selectedMember.firstName} {selectedMember.lastName}
              </h2>
              <button onClick={() => { setSelectedMember(null); setMemberDetails(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{formatNumber(parseFloat(selectedMember.totalLoaned || "0"))}</div>
                <div className="text-xs text-blue-500 mt-1">مجموع وام‌گرفته (ریال)</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{formatNumber(parseFloat(selectedMember.totalPaid || "0"))}</div>
                <div className="text-xs text-green-500 mt-1">پرداخت شده (ریال)</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{formatNumber(parseFloat(selectedMember.totalRemaining || "0"))}</div>
                <div className="text-xs text-red-500 mt-1">مانده بدهی (ریال)</div>
              </div>
            </div>

            {memberDetails && (
              <>
                <h3 className="font-bold text-gray-800 mb-3">وام‌ها</h3>
                <div className="overflow-x-auto mb-4">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>کد وام</th>
                        <th>مبلغ</th>
                        <th>سود</th>
                        <th>اقساط</th>
                        <th>پرداخت شده</th>
                        <th>مانده</th>
                        <th>وضعیت</th>
                        <th>تاریخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(memberDetails.loans as Loan[]).map((loan: Loan) => (
                        <tr key={loan.id}>
                          <td className="font-mono">{loan.loanCode}</td>
                          <td>{formatNumber(parseFloat(loan.amount))}</td>
                          <td>{loan.interestRate}%</td>
                          <td className="text-center">{loan.installmentCount}</td>
                          <td className="text-green-600">{formatNumber(parseFloat(loan.paidAmount))}</td>
                          <td className="text-red-600 font-bold">{formatNumber(parseFloat(loan.remainingAmount))}</td>
                          <td><span className={`badge ${
                            loan.status === "active" ? "badge-green" :
                            loan.status === "paid" ? "badge-gray" : "badge-yellow"
                          }`}>{loan.status === "active" ? "فعال" : loan.status === "paid" ? "تسویه" : loan.status}</span></td>
                          <td>{formatDate(loan.requestDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="font-bold text-gray-800 mb-3">سابقه اقساط</h3>
                <div className="overflow-x-auto max-h-64">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>کد وام</th>
                        <th>قسط #</th>
                        <th>سررسید</th>
                        <th>مبلغ</th>
                        <th>پرداخت شده</th>
                        <th>تاریخ پرداخت</th>
                        <th>وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(memberDetails.installments as Installment[]).map((inst: Installment) => (
                        <tr key={inst.id} className={inst.status === "pending" && inst.dueDate < today ? "bg-red-50" : ""}>
                          <td className="font-mono">{inst.loanId}</td>
                          <td className="text-center">{inst.installmentNo}</td>
                          <td>{formatDate(inst.dueDate)}</td>
                          <td>{formatNumber(parseFloat(inst.amount))}</td>
                          <td className={parseFloat(inst.paidAmount) > 0 ? "text-green-600" : "text-gray-400"}>{formatNumber(parseFloat(inst.paidAmount))}</td>
                          <td>{inst.paidDate ? formatDate(inst.paidDate) : "-"}</td>
                          <td>
                            <span className={`badge ${inst.status === "paid" ? "badge-green" : inst.dueDate < today ? "badge-red" : "badge-yellow"}`}>
                              {inst.status === "paid" ? "پرداخت" : inst.dueDate < today ? "معوق" : "در انتظار"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Types for local use
interface Loan {
  id: number;
  loanCode: string;
  amount: string;
  interestRate: string;
  installmentCount: number;
  paidAmount: string;
  remainingAmount: string;
  status: string;
  requestDate: string;
}

interface Installment {
  id: number;
  loanId: number;
  installmentNo: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  paidDate?: string;
  status: string;
}
