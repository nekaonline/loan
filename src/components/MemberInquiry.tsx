"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/utils";

interface PublicInstallment {
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  paidDate: string | null;
  status: string;
  receiptNo: string | null;
}

interface PublicLoan {
  loanCode: string;
  status: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  requestDate: string;
  disbursementDate: string | null;
  installments: PublicInstallment[];
}

interface InquiryResult {
  memberCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  joinDate: string;
  loans: PublicLoan[];
}

const statusLabels: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  active: "فعال",
  paid: "پرداخت شده",
  rejected: "رد شده",
};

export default function MemberInquiry({ embedded = false }: { embedded?: boolean }) {
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<InquiryResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalId, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در استعلام");
        return;
      }
      setResult(data.inquiry);
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm p-6 max-w-xl">
        {!embedded && (
          <h1 className="text-2xl font-bold text-[#1e3a5f] mb-4">
            🔎 استعلام وضعیت عضو
          </h1>
        )}
        <p className="text-sm text-gray-600 mb-4">
          با وارد کردن کد ملی و شماره تلفن ثبت‌شده (یا ۴ رقم آخر تلفن)، وضعیت
          وام‌ها و اقساط خود را مشاهده نمایید.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">کد ملی *</label>
            <input
              required
              className="form-input"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="کد ملی ۱۰ رقمی"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">تلفن *</label>
            <input
              required
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="شماره تلفن یا ۴ رقم آخر"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}
          <button disabled={loading} className="btn btn-primary w-full">
            {loading ? "⏳ در حال جستجو..." : "🔎 استعلام"}
          </button>
        </form>
      </div>

      {result && (
        <div className="space-y-5 print-report">
          <div className="hidden print:block text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h1 className="text-xl font-bold">صندوق قرض الحسنه بیمارستان بوعلی سینا ساری</h1>
            <div className="text-sm mt-1">گزارش وضعیت عضو</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1e3a5f]">
                {result.firstName} {result.lastName}
              </h2>
              <div className="text-xs text-gray-500 mt-1">
                کد عضویت: {result.memberCode} | تلفن: {result.phone} | تاریخ عضویت:{" "}
                {result.joinDate}
              </div>
            </div>
            <button onClick={() => window.print()} className="btn btn-secondary no-print">
              🖨️ چاپ / PDF
            </button>
          </div>

          {result.loans.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400">
              وامی برای این عضو ثبت نشده است
            </div>
          ) : (
            result.loans.map((loan) => (
              <div key={loan.loanCode} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3">
                  <div>
                    <h3 className="font-bold text-[#1e3a5f]">
                      وام {loan.loanCode}{" "}
                      <span className="badge badge-blue">
                        {statusLabels[loan.status] || loan.status}
                      </span>
                    </h3>
                    <div className="text-xs text-gray-500 mt-1">
                      تاریخ درخواست: {loan.requestDate}
                      {loan.disbursementDate ? ` | تاریخ پرداخت: ${loan.disbursementDate}` : ""}
                    </div>
                  </div>
                  <div className="text-sm">
                    مبلغ وام: <strong>{formatNumber(loan.amount)}</strong> | مانده:{" "}
                    <strong className="text-red-600">
                      {formatNumber(loan.remainingAmount)}
                    </strong>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>قسط</th>
                        <th>سررسید</th>
                        <th>مبلغ</th>
                        <th>پرداخت شده</th>
                        <th>تاریخ پرداخت</th>
                        <th>وضعیت</th>
                        <th>شماره رسید</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loan.installments.map((inst) => (
                        <tr key={inst.installmentNo}>
                          <td className="text-center">{inst.installmentNo}</td>
                          <td>{inst.dueDate}</td>
                          <td>{formatNumber(inst.amount)}</td>
                          <td className="text-green-700">{formatNumber(inst.paidAmount)}</td>
                          <td>{inst.paidDate || "-"}</td>
                          <td>{inst.status === "paid" ? "پرداخت شده" : "در انتظار"}</td>
                          <td className="font-mono">{inst.receiptNo || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return embedded ? content : <div className="min-h-screen bg-slate-100 p-6">{content}</div>;
}
