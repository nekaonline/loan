"use client";

import { useEffect, useState } from "react";
import { formatNumber, formatDate } from "@/lib/utils";

interface DashboardData {
  stats: {
    totalMembers: number;
    activeLoans: number;
    totalOutstanding: number;
    overdueCount: number;
    overdueAmount: number;
    pendingLoans: number;
    fundBalance: number;
    monthlyCollection: number;
  };
  loansByStatus: Array<{ status: string; count: number; total: string }>;
  topDebtors: Array<{
    memberId: number;
    memberFirstName: string;
    memberLastName: string;
    memberCode: string;
    totalRemaining: string;
  }>;
}

const statusLabels: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  active: "فعال",
  paid: "پرداخت شده",
  rejected: "رد شده",
};

export default function Reports() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState("summary");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">در حال بارگذاری...</div>;
  if (!data) return null;

  const { stats } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">📊 گزارشات</h1>
        <button
          onClick={() => window.print()}
          className="btn btn-secondary no-print"
        >
          🖨️ چاپ گزارش
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex gap-2 no-print">
        {[
          { id: "summary", label: "خلاصه اجرایی" },
          { id: "loans", label: "گزارش وام‌ها" },
          { id: "fund", label: "گزارش صندوق" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`btn btn-sm ${reportType === tab.id ? "btn-primary" : "btn-secondary"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reportType === "summary" && (
        <div className="space-y-6 print-full">
          {/* Print Header */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-bold">صندوق قرض‌الحسنه بیمارستان بوعلی سینا ساری</h1>
            <div className="text-gray-600">گزارش خلاصه عملکرد - تاریخ: {new Date().toLocaleDateString("fa-IR")}</div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="اعضای فعال" value={formatNumber(stats.totalMembers)} unit="نفر" color="blue" />
            <KPICard title="وام‌های فعال" value={formatNumber(stats.activeLoans)} unit="فقره" color="green" />
            <KPICard title="مجموع بدهی جاری" value={formatNumber(stats.totalOutstanding)} unit="ریال" color="orange" />
            <KPICard title="موجودی صندوق" value={formatNumber(Math.abs(stats.fundBalance))} unit="ریال" color={stats.fundBalance >= 0 ? "green" : "red"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="اقساط معوق" value={formatNumber(stats.overdueCount)} unit="فقره" color="red" />
            <KPICard title="مبلغ معوق" value={formatNumber(stats.overdueAmount)} unit="ریال" color="red" />
            <KPICard title="در انتظار تأیید" value={formatNumber(stats.pendingLoans)} unit="درخواست" color="yellow" />
            <KPICard title="وصولی این ماه" value={formatNumber(stats.monthlyCollection)} unit="ریال" color="teal" />
          </div>

          {/* Loans by Status */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">توزیع وام‌ها بر اساس وضعیت</h2>
            <div className="space-y-3">
              {data.loansByStatus.map((item) => {
                const total = data.loansByStatus.reduce((s, i) => s + i.count, 0);
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{statusLabels[item.status] || item.status}</span>
                      <span><strong>{item.count}</strong> وام ({pct}%) - {formatNumber(parseFloat(item.total || "0"))} ریال</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full ${
                          item.status === "active" ? "bg-green-500" :
                          item.status === "paid" ? "bg-blue-500" :
                          item.status === "pending" ? "bg-yellow-500" :
                          item.status === "rejected" ? "bg-red-500" : "bg-gray-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Debtors */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">بزرگ‌ترین بدهکاران</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>عضو</th>
                  <th>کد عضویت</th>
                  <th>مانده بدهی (ریال)</th>
                </tr>
              </thead>
              <tbody>
                {data.topDebtors.map((d, i) => (
                  <tr key={d.memberId}>
                    <td className="text-center">{i + 1}</td>
                    <td className="font-semibold">{d.memberFirstName} {d.memberLastName}</td>
                    <td className="font-mono text-xs">{d.memberCode}</td>
                    <td className="font-bold text-red-600">{formatNumber(parseFloat(d.totalRemaining))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary Table */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">خلاصه مالی</h2>
            <table className="data-table">
              <tbody>
                <tr><td className="font-semibold">مجموع اعضای فعال</td><td className="font-bold text-blue-700">{formatNumber(stats.totalMembers)} نفر</td></tr>
                <tr><td className="font-semibold">تعداد وام‌های فعال</td><td className="font-bold text-green-700">{formatNumber(stats.activeLoans)} فقره</td></tr>
                <tr><td className="font-semibold">مجموع بدهی جاری</td><td className="font-bold text-orange-700">{formatNumber(stats.totalOutstanding)} ریال</td></tr>
                <tr><td className="font-semibold">تعداد اقساط معوق</td><td className="font-bold text-red-700">{formatNumber(stats.overdueCount)} قسط</td></tr>
                <tr><td className="font-semibold">مبلغ اقساط معوق</td><td className="font-bold text-red-700">{formatNumber(stats.overdueAmount)} ریال</td></tr>
                <tr><td className="font-semibold">وصولی این ماه</td><td className="font-bold text-green-700">{formatNumber(stats.monthlyCollection)} ریال</td></tr>
                <tr><td className="font-semibold">موجودی صندوق</td><td className={`font-bold ${stats.fundBalance >= 0 ? "text-green-700" : "text-red-700"}`}>{formatNumber(Math.abs(stats.fundBalance))} ریال</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === "loans" && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">گزارش وضعیت وام‌ها</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>وضعیت</th>
                <th>تعداد</th>
                <th>مجموع مبلغ (ریال)</th>
                <th>درصد</th>
              </tr>
            </thead>
            <tbody>
              {data.loansByStatus.map((item) => {
                const total = data.loansByStatus.reduce((s, i) => s + i.count, 0);
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <tr key={item.status}>
                    <td>
                      <span className={`badge ${
                        item.status === "active" ? "badge-green" :
                        item.status === "pending" ? "badge-yellow" :
                        item.status === "paid" ? "badge-gray" :
                        item.status === "rejected" ? "badge-red" : "badge-blue"
                      }`}>
                        {statusLabels[item.status] || item.status}
                      </span>
                    </td>
                    <td className="font-bold text-center">{item.count}</td>
                    <td className="font-bold">{formatNumber(parseFloat(item.total || "0"))}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reportType === "fund" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">گزارش مالی صندوق</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">درآمدها</h3>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm">وصولی اقساط این ماه</span>
                    <span className="font-bold text-green-700">{formatNumber(stats.monthlyCollection)} ریال</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">مانده‌ها</h3>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-blue-50 rounded">
                    <span className="text-sm">موجودی صندوق</span>
                    <span className={`font-bold ${stats.fundBalance >= 0 ? "text-green-700" : "text-red-700"}`}>{formatNumber(Math.abs(stats.fundBalance))} ریال</span>
                  </div>
                  <div className="flex justify-between p-2 bg-orange-50 rounded">
                    <span className="text-sm">مجموع مطالبات</span>
                    <span className="font-bold text-orange-700">{formatNumber(stats.totalOutstanding)} ریال</span>
                  </div>
                  <div className="flex justify-between p-2 bg-red-50 rounded">
                    <span className="text-sm">مطالبات معوق</span>
                    <span className="font-bold text-red-700">{formatNumber(stats.overdueAmount)} ریال</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, unit, color }: { title: string; value: string; unit: string; color: string }) {
  const borders: Record<string, string> = {
    blue: "border-blue-500", green: "border-green-500", orange: "border-orange-500",
    red: "border-red-500", yellow: "border-yellow-500", teal: "border-teal-500",
  };
  const texts: Record<string, string> = {
    blue: "text-blue-700", green: "text-green-700", orange: "text-orange-700",
    red: "text-red-700", yellow: "text-yellow-700", teal: "text-teal-700",
  };
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 border-r-4 ${borders[color] || "border-blue-500"}`}>
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div className={`text-xl font-bold ${texts[color] || "text-blue-700"}`}>{value}</div>
      <div className="text-xs text-gray-400">{unit}</div>
    </div>
  );
}
