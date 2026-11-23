"use client";

import { useEffect, useState } from "react";
import { formatNumber, formatCurrency } from "@/lib/utils";

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
  recentTransactions: Array<{
    id: number;
    type: string;
    amount: string;
    description: string;
    transactionDate: string;
    memberFirstName: string;
    memberLastName: string;
  }>;
  topDebtors: Array<{
    memberId: number;
    memberFirstName: string;
    memberLastName: string;
    memberCode: string;
    totalRemaining: string;
  }>;
}

const transactionTypeLabels: Record<string, string> = {
  deposit: "واریز",
  withdrawal: "برداشت",
  loan_disbursement: "پرداخت وام",
  installment_payment: "دریافت قسط",
  fee: "کارمزد",
  other: "سایر",
};

const statusLabels: Record<string, string> = {
  pending: "در انتظار",
  approved: "تأیید شده",
  active: "فعال",
  paid: "پرداخت شده",
  rejected: "رد شده",
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <p className="text-gray-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">
          📊 داشبورد مدیریتی
        </h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString("fa-IR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="اعضای فعال"
          value={formatNumber(stats.totalMembers)}
          icon="👥"
          color="blue"
          sub="نفر عضو"
        />
        <StatCard
          title="وام‌های فعال"
          value={formatNumber(stats.activeLoans)}
          icon="💰"
          color="green"
          sub="فقره وام"
        />
        <StatCard
          title="مجموع بدهی"
          value={formatNumber(stats.totalOutstanding)}
          icon="📉"
          color="orange"
          sub="ریال"
        />
        <StatCard
          title="اقساط معوق"
          value={formatNumber(stats.overdueCount)}
          icon="⚠️"
          color="red"
          sub={`${formatNumber(stats.overdueAmount)} ریال`}
        />
        <StatCard
          title="وام در انتظار تأیید"
          value={formatNumber(stats.pendingLoans)}
          icon="🕐"
          color="yellow"
          sub="درخواست"
        />
        <StatCard
          title="موجودی صندوق"
          value={formatNumber(Math.abs(stats.fundBalance))}
          icon="🏦"
          color={stats.fundBalance >= 0 ? "green" : "red"}
          sub="ریال"
        />
        <StatCard
          title="وصولی این ماه"
          value={formatNumber(stats.monthlyCollection)}
          icon="📈"
          color="teal"
          sub="ریال"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Debtors */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
            <span>⚠️</span> بزرگترین بدهکاران
          </h2>
          <div className="space-y-3">
            {data.topDebtors.length === 0 ? (
              <p className="text-gray-400 text-center py-4">بدهکاری وجود ندارد</p>
            ) : (
              data.topDebtors.map((debtor, idx) => (
                <div
                  key={debtor.memberId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-sm">
                        {debtor.memberFirstName} {debtor.memberLastName}
                      </div>
                      <div className="text-xs text-gray-500">{debtor.memberCode}</div>
                    </div>
                  </div>
                  <div className="text-red-600 font-bold text-sm">
                    {formatNumber(parseFloat(debtor.totalRemaining))} ریال
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
            <span>🔄</span> آخرین تراکنش‌ها
          </h2>
          <div className="space-y-2">
            {data.recentTransactions.length === 0 ? (
              <p className="text-gray-400 text-center py-4">تراکنشی ثبت نشده</p>
            ) : (
              data.recentTransactions.slice(0, 8).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 border-b border-gray-100"
                >
                  <div>
                    <div className="text-xs font-medium">
                      {transactionTypeLabels[tx.type] || tx.type}
                    </div>
                    <div className="text-xs text-gray-500">
                      {tx.memberFirstName} {tx.memberLastName}
                    </div>
                  </div>
                  <div className="text-left">
                    <div
                      className={`text-xs font-bold ${
                        parseFloat(tx.amount) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {parseFloat(tx.amount) >= 0 ? "+" : ""}
                      {formatNumber(Math.abs(parseFloat(tx.amount)))} ریال
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(tx.transactionDate).toLocaleDateString("fa-IR")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Loans by Status */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
          <span>💰</span> وضعیت وام‌ها
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {data.loansByStatus.map((item) => (
            <div
              key={item.status}
              className="text-center p-3 bg-gray-50 rounded-lg"
            >
              <div className="text-2xl font-bold text-[#1e3a5f]">
                {item.count}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {statusLabels[item.status] || item.status}
              </div>
              <div className="text-xs text-gray-400">
                {formatNumber(parseFloat(item.total || "0"))} ریال
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  sub,
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
  sub: string;
}) {
  const borderColors: Record<string, string> = {
    blue: "border-blue-500",
    green: "border-green-500",
    orange: "border-orange-500",
    red: "border-red-500",
    yellow: "border-yellow-500",
    teal: "border-teal-500",
  };

  const bgColors: Record<string, string> = {
    blue: "bg-blue-50",
    green: "bg-green-50",
    orange: "bg-orange-50",
    red: "bg-red-50",
    yellow: "bg-yellow-50",
    teal: "bg-teal-50",
  };

  return (
    <div
      className={`stat-card border-r-4 ${borderColors[color] || "border-blue-500"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{title}</p>
          <p className="text-xl font-bold text-[#1e3a5f]">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <div
          className={`p-2 rounded-lg text-2xl ${bgColors[color] || "bg-blue-50"}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
