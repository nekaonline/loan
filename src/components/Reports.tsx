"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatDate,
  formatDateLong,
  formatNumber,
  getIranTodayISO,
  getJalaliISODate,
} from "@/lib/utils";
import { exportToExcel } from "@/lib/export";

type ReportTab = "summary" | "debtors" | "recipients" | "fund";

interface Debtor {
  memberId: number;
  memberCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  nationalId: string;
  department: string | null;
  email: string | null;
  city: string | null;
  joinDate: string;
  guarantorName: string | null;
  guarantorPhone: string | null;
  totalLoaned: number;
  totalPaid: number;
  totalRemaining: number;
  loanCount: number;
  overdueInstallments: number;
  overdueAmount: number;
  nextDueDate: string | null;
  lastPaidDate: string | null;
}

interface Recipient {
  id: number;
  loanCode: string;
  status: string;
  purpose: string | null;
  amount: number;
  interestRate: number;
  installmentCount: number;
  installmentAmount: number;
  totalPayable: number;
  paidAmount: number;
  remainingAmount: number;
  requestDate: string;
  approvalDate: string | null;
  disbursementDate: string | null;
  firstInstallmentDate: string | null;
  memberId: number;
  memberFirstName: string;
  memberLastName: string;
  memberCode: string;
  memberPhone: string;
}

interface FundTransaction {
  id: number;
  type: string;
  amount: number;
  description: string | null;
  referenceNo: string | null;
  transactionDate: string;
  memberFirstName: string | null;
  memberLastName: string | null;
}

interface ReportData {
  generatedAt: string;
  stats: {
    totalMembers: number;
    activeLoans: number;
    totalOutstanding: number;
    overdueCount: number;
    overdueAmount: number;
    pendingLoans: number;
    fundBalance: number;
    fundIncome: number;
    fundExpense: number;
    monthlyCollection: number;
  };
  loansByStatus: Array<{ status: string; count: number; total: number }>;
  fundByType: Array<{ type: string; total: number }>;
  debtors: Debtor[];
  recipients: Recipient[];
  transactions: FundTransaction[];
  collectionTrend: Array<{ label: string; collection: number }>;
}

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: "summary", label: "خلاصه اجرایی" },
  { id: "debtors", label: "لیست بدهکاران" },
  { id: "recipients", label: "وام گیرندگان" },
  { id: "fund", label: "صندوق و تراز مالی" },
];

const statusLabels: Record<string, string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  active: "فعال",
  paid: "پرداخت شده",
  rejected: "رد شده",
};

const statusColors: Record<string, string> = {
  pending: "#eab308",
  approved: "#3b82f6",
  active: "#22c55e",
  paid: "#64748b",
  rejected: "#ef4444",
};

const transactionLabels: Record<string, string> = {
  deposit: "واریز به صندوق",
  withdrawal: "برداشت",
  loan_disbursement: "پرداخت وام",
  installment_payment: "دریافت قسط",
  fee: "کارمزد",
  other: "سایر",
};

const CHART_COLORS = ["#1e3a5f", "#2563eb", "#22c55e", "#eab308", "#ef4444", "#8b5cf6"];

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportType, setReportType] = useState<ReportTab>("summary");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reports/management");
      if (!res.ok) throw new Error("خطا در بارگذاری گزارش");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای سرور");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Loading the report once on mount is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDebtors = useMemo(() => {
    if (!data) return [];
    return data.debtors.filter((d) =>
      `${d.firstName} ${d.lastName} ${d.memberCode} ${d.nationalId} ${d.phone} ${d.department || ""}`
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [data, normalizedSearch]);

  const filteredRecipients = useMemo(() => {
    if (!data) return [];
    return data.recipients.filter((r) =>
      `${r.memberFirstName} ${r.memberLastName} ${r.memberCode} ${r.loanCode} ${r.memberPhone}`
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [data, normalizedSearch]);

  const activeTabLabel =
    TABS.find((tab) => tab.id === reportType)?.label || "گزارش";
  const todayJalali = formatDateLong(getIranTodayISO());

  const statusChartData = (data?.loansByStatus || []).map((item) => ({
    name: statusLabels[item.status] || item.status,
    status: item.status,
    value: item.count,
  }));

  const debtorChartData = [...(data?.debtors || [])]
    .sort((a, b) => b.totalRemaining - a.totalRemaining)
    .slice(0, 10)
    .map((d) => ({
      name: `${d.firstName} ${d.lastName}`,
      amount: d.totalRemaining,
    }));

  const fundChartData = (data?.fundByType || []).map((item) => ({
    name: transactionLabels[item.type] || item.type,
    amount: Math.abs(item.total),
  }));

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    const stamp = getJalaliISODate();
    try {
      if (reportType === "summary") {
        await exportToExcel(`loan-report-summary-${stamp}`, [
          {
            name: "خلاصه",
            rows: [
              { شاخص: "تاریخ گزارش", مقدار: todayJalali },
              { شاخص: "اعضای فعال", مقدار: data.stats.totalMembers },
              { شاخص: "وام های فعال", مقدار: data.stats.activeLoans },
              { شاخص: "مجموع بدهی جاری", مقدار: data.stats.totalOutstanding },
              { شاخص: "اقساط معوق", مقدار: data.stats.overdueCount },
              { شاخص: "مبلغ معوق", مقدار: data.stats.overdueAmount },
              { شاخص: "در انتظار تایید", مقدار: data.stats.pendingLoans },
              { شاخص: "وصولی ماه جاری", مقدار: data.stats.monthlyCollection },
              { شاخص: "موجودی صندوق", مقدار: data.stats.fundBalance },
            ],
          },
          {
            name: "وضعیت وام ها",
            rows: data.loansByStatus.map((item) => ({
              وضعیت: statusLabels[item.status] || item.status,
              تعداد: item.count,
              "مجموع مبلغ (ریال)": item.total,
            })),
          },
          {
            name: "روند وصولی",
            rows: data.collectionTrend.map((item) => ({
              ماه: item.label,
              "مبلغ وصولی (ریال)": item.collection,
            })),
          },
          {
            name: "بدهکاران برتر",
            rows: debtorChartData.map((item) => ({
              عضو: item.name,
              "مانده بدهی (ریال)": item.amount,
            })),
          },
        ]);
      } else if (reportType === "debtors") {
        await exportToExcel(`loan-report-debtors-${stamp}`, [
          {
            name: "لیست بدهکاران",
            rows: filteredDebtors.map((d) => ({
              "کد عضویت": d.memberCode,
              "نام و نام خانوادگی": `${d.firstName} ${d.lastName}`,
              "کد ملی": d.nationalId,
              تلفن: d.phone,
              بخش: d.department || "",
              "تعداد وام": d.loanCount,
              "مجموع وام (ریال)": d.totalLoaned,
              "پرداخت شده (ریال)": d.totalPaid,
              "مانده بدهی (ریال)": d.totalRemaining,
              "اقساط معوق": d.overdueInstallments,
              "مبلغ معوق (ریال)": d.overdueAmount,
              "نزدیک ترین سررسید": d.nextDueDate ? formatDate(d.nextDueDate) : "",
              "آخرین پرداخت": d.lastPaidDate ? formatDate(d.lastPaidDate) : "",
              ضامن: d.guarantorName || "",
              "تلفن ضامن": d.guarantorPhone || "",
              "تاریخ عضویت": formatDate(d.joinDate),
            })),
          },
        ]);
      } else if (reportType === "recipients") {
        await exportToExcel(`loan-report-recipients-${stamp}`, [
          {
            name: "وام گیرندگان",
            rows: filteredRecipients.map((r) => ({
              "کد وام": r.loanCode,
              "کد عضویت": r.memberCode,
              "نام و نام خانوادگی": `${r.memberFirstName} ${r.memberLastName}`,
              تلفن: r.memberPhone,
              وضعیت: statusLabels[r.status] || r.status,
              "تاریخ درخواست": formatDate(r.requestDate),
              "تاریخ پرداخت": r.disbursementDate ? formatDate(r.disbursementDate) : "",
              "اولین قسط": r.firstInstallmentDate ? formatDate(r.firstInstallmentDate) : "",
              "مبلغ وام (ریال)": r.amount,
              "نرخ سود (%)": r.interestRate,
              "تعداد اقساط": r.installmentCount,
              "مبلغ قسط (ریال)": r.installmentAmount,
              "مبلغ قابل پرداخت (ریال)": r.totalPayable,
              "پرداخت شده (ریال)": r.paidAmount,
              "مانده (ریال)": r.remainingAmount,
              مقصود: r.purpose || "",
            })),
          },
        ]);
      } else {
        await exportToExcel(`loan-report-fund-${stamp}`, [
          {
            name: "تراز مالی",
            rows: [
              { شاخص: "تاریخ گزارش", مقدار: todayJalali },
              { شاخص: "موجودی صندوق (ریال)", مقدار: data.stats.fundBalance },
              { شاخص: "کل درآمدها (ریال)", مقدار: data.stats.fundIncome },
              { شاخص: "کل پرداخت ها (ریال)", مقدار: data.stats.fundExpense },
              { شاخص: "وصولی ماه جاری (ریال)", مقدار: data.stats.monthlyCollection },
              { شاخص: "مجموع مطالبات (ریال)", مقدار: data.stats.totalOutstanding },
              { شاخص: "مطالبات معوق (ریال)", مقدار: data.stats.overdueAmount },
              ...data.fundByType.map((item) => ({
                شاخص: `جمع ${transactionLabels[item.type] || item.type} (ریال)`,
                مقدار: item.total,
              })),
            ],
          },
          {
            name: "تراکنش ها",
            rows: data.transactions.map((tx) => ({
              "تاریخ": formatDate(tx.transactionDate),
              نوع: transactionLabels[tx.type] || tx.type,
              "مبلغ (ریال)": tx.amount,
              توضیحات: tx.description || "",
              عضو:
                tx.memberFirstName || tx.memberLastName
                  ? `${tx.memberFirstName || ""} ${tx.memberLastName || ""}`.trim()
                  : "",
              "شماره مرجع": tx.referenceNo || "",
            })),
          },
          {
            name: "روند وصولی",
            rows: data.collectionTrend.map((item) => ({
              ماه: item.label,
              "مبلغ وصولی (ریال)": item.collection,
            })),
          },
        ]);
      }
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        در حال تهیه گزارشات مدیریتی...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-5">
        {error}
        <button onClick={() => void fetchData()} className="btn btn-secondary mr-3">
          تلاش مجدد
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">📊 گزارشات مدیریتی</h1>
          <p className="text-xs text-gray-500 mt-1">
            تاریخ گزارش: {todayJalali}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="btn btn-success"
          >
            {exporting ? "⏳ در حال تهیه..." : "⬇️ خروجی اکسل (xlsx)"}
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary">
            🖨️ چاپ / ذخیره PDF
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-2 items-center no-print">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setReportType(tab.id);
              setSearch("");
            }}
            className={`btn btn-sm ${reportType === tab.id ? "btn-primary" : "btn-secondary"}`}
          >
            {tab.label}
          </button>
        ))}
        {(reportType === "debtors" || reportType === "recipients") && (
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو: نام، کد عضویت، کد ملی، تلفن..."
            className="form-input w-full md:w-80"
          />
        )}
        <span className="text-xs text-gray-400">
          برای ذخیره PDF از پنجره چاپ، گزینه Save as PDF را انتخاب کنید.
        </span>
      </div>

      <div className="space-y-5 print-report">
        <PrintHeader title={activeTabLabel} date={todayJalali} />

        {reportType === "summary" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-grid">
              <KPICard title="اعضای فعال" value={formatNumber(stats.totalMembers)} unit="نفر" color="blue" />
              <KPICard title="وام‌های فعال" value={formatNumber(stats.activeLoans)} unit="فقره" color="green" />
              <KPICard title="مجموع بدهی جاری" value={formatNumber(stats.totalOutstanding)} unit="ریال" color="orange" />
              <KPICard title="موجودی صندوق" value={formatNumber(stats.fundBalance)} unit="ریال" color={stats.fundBalance >= 0 ? "green" : "red"} />
              <KPICard title="اقساط معوق" value={formatNumber(stats.overdueCount)} unit="فقره" color="red" />
              <KPICard title="مبلغ معوق" value={formatNumber(stats.overdueAmount)} unit="ریال" color="red" />
              <KPICard title="در انتظار تأیید" value={formatNumber(stats.pendingLoans)} unit="درخواست" color="yellow" />
              <KPICard title="وصولی ماه جاری" value={formatNumber(stats.monthlyCollection)} unit="ریال" color="teal" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="توزیع وام‌ها بر اساس وضعیت">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {statusChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={statusColors[entry.status] || "#1e3a5f"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ChartCard>

              <ChartCard title="روند وصولی اقساط (۶ ماه اخیر هجری شمسی)">
                <LineChart data={data.collectionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(value: number) => formatNumber(value)} width={70} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="collection"
                    name="وصولی (ریال)"
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ChartCard>
            </div>

            <ChartCard title="بزرگترین بدهکاران (۱۰ نفر)">
              <BarChart data={debtorChartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value: number) => formatNumber(value)} />
                <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="amount" name="مانده بدهی (ریال)" fill="#dc2626" />
              </BarChart>
            </ChartCard>

            <ReportCard title="خلاصه مالی">
              <table className="data-table">
                <tbody>
                  <SummaryRow label="مجموع اعضای فعال" value={`${formatNumber(stats.totalMembers)} نفر`} />
                  <SummaryRow label="تعداد وام‌های فعال" value={`${formatNumber(stats.activeLoans)} فقره`} />
                  <SummaryRow label="مجموع بدهی جاری" value={`${formatNumber(stats.totalOutstanding)} ریال`} />
                  <SummaryRow label="تعداد اقساط معوق" value={`${formatNumber(stats.overdueCount)} قسط`} />
                  <SummaryRow label="مبلغ اقساط معوق" value={`${formatNumber(stats.overdueAmount)} ریال`} />
                  <SummaryRow label="وصولی ماه جاری" value={`${formatNumber(stats.monthlyCollection)} ریال`} />
                  <SummaryRow label="موجودی صندوق" value={`${formatNumber(stats.fundBalance)} ریال`} />
                </tbody>
              </table>
            </ReportCard>
          </>
        )}

        {reportType === "debtors" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-grid">
              <KPICard title="تعداد بدهکاران" value={formatNumber(filteredDebtors.length)} unit="نفر" color="blue" />
              <KPICard title="مجموع بدهی" value={formatNumber(filteredDebtors.reduce((sum, d) => sum + d.totalRemaining, 0))} unit="ریال" color="orange" />
              <KPICard title="اقساط معوق" value={formatNumber(filteredDebtors.reduce((sum, d) => sum + d.overdueInstallments, 0))} unit="فقره" color="red" />
              <KPICard title="مبلغ معوق" value={formatNumber(filteredDebtors.reduce((sum, d) => sum + d.overdueAmount, 0))} unit="ریال" color="red" />
            </div>

            <ChartCard title="۱۰ بدهکار برتر بر اساس مانده">
              <BarChart data={debtorChartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value: number) => formatNumber(value)} />
                <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="amount" name="مانده بدهی (ریال)" fill="#dc2626" />
              </BarChart>
            </ChartCard>

            <ReportCard title={`لیست بدهکاران (${filteredDebtors.length} نفر)`}>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>عضو</th>
                      <th>کد عضویت</th>
                      <th>کد ملی</th>
                      <th>تلفن</th>
                      <th>بخش</th>
                      <th>وام</th>
                      <th>مجموع وام</th>
                      <th>پرداخت شده</th>
                      <th>مانده</th>
                      <th>معوق</th>
                      <th>مبلغ معوق</th>
                      <th>نزدیکترین سررسید</th>
                      <th>آخرین پرداخت</th>
                      <th>ضامن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebtors.length === 0 ? (
                      <tr><td colSpan={15} className="text-center py-6 text-gray-400">بدهکاری یافت نشد</td></tr>
                    ) : (
                      filteredDebtors.map((d, index) => (
                        <tr key={d.memberId}>
                          <td>{index + 1}</td>
                          <td className="font-semibold whitespace-nowrap">{d.firstName} {d.lastName}</td>
                          <td className="font-mono">{d.memberCode}</td>
                          <td className="font-mono">{d.nationalId}</td>
                          <td className="whitespace-nowrap">{d.phone}</td>
                          <td>{d.department || "-"}</td>
                          <td className="text-center">{d.loanCount}</td>
                          <td>{formatNumber(d.totalLoaned)}</td>
                          <td className="text-green-700">{formatNumber(d.totalPaid)}</td>
                          <td className="font-bold text-red-700">{formatNumber(d.totalRemaining)}</td>
                          <td className="text-center">{d.overdueInstallments}</td>
                          <td className="text-red-600">{formatNumber(d.overdueAmount)}</td>
                          <td className="whitespace-nowrap">{d.nextDueDate ? formatDate(d.nextDueDate) : "-"}</td>
                          <td className="whitespace-nowrap">{d.lastPaidDate ? formatDate(d.lastPaidDate) : "-"}</td>
                          <td className="whitespace-nowrap">{d.guarantorName || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </>
        )}

        {reportType === "recipients" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-grid">
              <KPICard title="تعداد وام گیرندگان" value={formatNumber(filteredRecipients.length)} unit="نفر" color="blue" />
              <KPICard title="مجموع وام پرداختی" value={formatNumber(filteredRecipients.reduce((sum, r) => sum + r.amount, 0))} unit="ریال" color="green" />
              <KPICard title="وام‌های فعال" value={formatNumber(filteredRecipients.filter((r) => r.status === "active").length)} unit="فقره" color="teal" />
              <KPICard title="مانده وام‌ها" value={formatNumber(filteredRecipients.reduce((sum, r) => sum + r.remainingAmount, 0))} unit="ریال" color="orange" />
            </div>

            <ReportCard title={`لیست وام گیرندگان (${filteredRecipients.length} فقره)`}>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>کد وام</th>
                      <th>عضو</th>
                      <th>کد عضویت</th>
                      <th>تلفن</th>
                      <th>تاریخ درخواست</th>
                      <th>تاریخ پرداخت</th>
                      <th>اولین قسط</th>
                      <th>مبلغ وام</th>
                      <th>سود</th>
                      <th>اقساط</th>
                      <th>پرداخت شده</th>
                      <th>مانده</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.length === 0 ? (
                      <tr><td colSpan={14} className="text-center py-6 text-gray-400">وامی یافت نشد</td></tr>
                    ) : (
                      filteredRecipients.map((r, index) => (
                        <tr key={r.id}>
                          <td>{index + 1}</td>
                          <td className="font-mono whitespace-nowrap">{r.loanCode}</td>
                          <td className="font-semibold whitespace-nowrap">{r.memberFirstName} {r.memberLastName}</td>
                          <td className="font-mono">{r.memberCode}</td>
                          <td className="whitespace-nowrap">{r.memberPhone}</td>
                          <td className="whitespace-nowrap">{formatDate(r.requestDate)}</td>
                          <td className="whitespace-nowrap">{r.disbursementDate ? formatDate(r.disbursementDate) : "-"}</td>
                          <td className="whitespace-nowrap">{r.firstInstallmentDate ? formatDate(r.firstInstallmentDate) : "-"}</td>
                          <td>{formatNumber(r.amount)}</td>
                          <td>{r.interestRate}%</td>
                          <td className="text-center">{r.installmentCount}</td>
                          <td className="text-green-700">{formatNumber(r.paidAmount)}</td>
                          <td className="font-bold text-red-700">{formatNumber(r.remainingAmount)}</td>
                          <td>
                            <span className={`badge ${
                              r.status === "active" ? "badge-green" :
                              r.status === "paid" ? "badge-gray" :
                              r.status === "pending" ? "badge-yellow" :
                              r.status === "rejected" ? "badge-red" : "badge-blue"
                            }`}>
                              {statusLabels[r.status] || r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </>
        )}

        {reportType === "fund" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-grid">
              <KPICard title="موجودی صندوق" value={formatNumber(stats.fundBalance)} unit="ریال" color={stats.fundBalance >= 0 ? "green" : "red"} />
              <KPICard title="کل درآمدها" value={formatNumber(stats.fundIncome)} unit="ریال" color="green" />
              <KPICard title="کل پرداخت‌ها" value={formatNumber(stats.fundExpense)} unit="ریال" color="red" />
              <KPICard title="وصولی ماه جاری" value={formatNumber(stats.monthlyCollection)} unit="ریال" color="teal" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="تراز انواع تراکنش صندوق">
                <BarChart data={fundChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tickFormatter={(value: number) => formatNumber(value)} width={70} />
                  <Tooltip />
                  <Bar dataKey="amount" name="مبلغ (ریال)">
                    {fundChartData.map((item, index) => (
                      <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartCard>

              <ChartCard title="روند وصولی اقساط (۶ ماه اخیر هجری شمسی)">
                <LineChart data={data.collectionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(value: number) => formatNumber(value)} width={70} />
                  <Tooltip />
                  <Line type="monotone" dataKey="collection" name="وصولی (ریال)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ReportCard title="تراز مالی صندوق">
                <table className="data-table">
                  <tbody>
                    <SummaryRow label="موجودی صندوق" value={`${formatNumber(stats.fundBalance)} ریال`} />
                    <SummaryRow label="جمع درآمدها" value={`${formatNumber(stats.fundIncome)} ریال`} />
                    <SummaryRow label="جمع پرداخت‌ها" value={`${formatNumber(stats.fundExpense)} ریال`} />
                    <SummaryRow label="وصولی ماه جاری" value={`${formatNumber(stats.monthlyCollection)} ریال`} />
                    <SummaryRow label="مجموع مطالبات" value={`${formatNumber(stats.totalOutstanding)} ریال`} />
                    <SummaryRow label="مطالبات معوق" value={`${formatNumber(stats.overdueAmount)} ریال`} />
                  </tbody>
                </table>
              </ReportCard>

              <ReportCard title="جزئیات تراکنش‌ها">
                <div className="overflow-x-auto max-h-96">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>تاریخ</th>
                        <th>نوع</th>
                        <th>مبلغ</th>
                        <th>توضیحات</th>
                        <th>عضو</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-6 text-gray-400">تراکنشی ثبت نشده</td></tr>
                      ) : (
                        data.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="whitespace-nowrap">{formatDate(tx.transactionDate)}</td>
                            <td className="whitespace-nowrap">{transactionLabels[tx.type] || tx.type}</td>
                            <td className={tx.amount >= 0 ? "text-green-700" : "text-red-700"}>
                              {formatNumber(tx.amount)}
                            </td>
                            <td>{tx.description || "-"}</td>
                            <td>
                              {tx.memberFirstName || tx.memberLastName
                                ? `${tx.memberFirstName || ""} ${tx.memberLastName || ""}`.trim()
                                : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </ReportCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PrintHeader({ title, date }: { title: string; date: string }) {
  return (
    <div className="hidden print:block text-center border-b-2 border-slate-800 pb-3 mb-4">
      <h1 className="text-xl font-bold">صندوق قرض‌الحسنه بیمارستان بوعلی سینا ساری</h1>
      <div className="text-sm mt-1">{title}</div>
      <div className="text-xs text-gray-600 mt-1">تاریخ گزارش: {date}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 print-card">
      <h2 className="text-base font-bold text-[#1e3a5f] mb-3">{title}</h2>
      <div dir="ltr" className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 print-card">
      <h2 className="text-base font-bold text-[#1e3a5f] mb-3">{title}</h2>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="font-semibold">{label}</td>
      <td className="font-bold">{value}</td>
    </tr>
  );
}

function KPICard({
  title,
  value,
  unit,
  color,
}: {
  title: string;
  value: string;
  unit: string;
  color: string;
}) {
  const borders: Record<string, string> = {
    blue: "border-blue-500",
    green: "border-green-500",
    orange: "border-orange-500",
    red: "border-red-500",
    yellow: "border-yellow-500",
    teal: "border-teal-500",
  };
  const texts: Record<string, string> = {
    blue: "text-blue-700",
    green: "text-green-700",
    orange: "text-orange-700",
    red: "text-red-700",
    yellow: "text-yellow-700",
    teal: "text-teal-700",
  };
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 border-r-4 ${borders[color] || "border-blue-500"} print-card`}>
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div className={`text-xl font-bold ${texts[color] || "text-blue-700"}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{unit}</div>
    </div>
  );
}
