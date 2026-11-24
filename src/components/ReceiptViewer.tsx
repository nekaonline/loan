"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/utils";

interface Receipt {
  receiptNo: string;
  memberName: string;
  loanCode: string;
  installmentNo: number;
  amount: number;
  paidDate: string;
  status: string;
}

export default function ReceiptViewer({
  code,
  embedded = false,
}: {
  code?: string;
  embedded?: boolean;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(code));
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/public/receipt/${encodeURIComponent(code || "")}`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error || "رسید یافت نشد");
          return;
        }
        if (cancelled) return;
        setReceipt(data.receipt);

        const QRCode = (await import("qrcode")).default;
        const url = `${window.location.origin}/receipt/${encodeURIComponent(code || "")}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 160, margin: 1 });
        if (!cancelled) setQr(dataUrl);
      } catch {
        if (!cancelled) setError("خطا در بارگذاری رسید");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const body = (
    <div className="space-y-4">
      {loading && <div className="text-center py-12 text-gray-400">در حال بارگذاری رسید...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}
      {receipt && (
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-2xl mx-auto print-card">
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
            <h1 className="text-xl font-bold">
              صندوق قرض الحسنه بیمارستان بوعلی سینا ساری
            </h1>
            <div className="text-sm text-gray-600 mt-1">رسید پرداخت قسط وام</div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <span className="text-gray-500">شماره رسید: </span>
              <strong className="font-mono">{receipt.receiptNo}</strong>
            </div>
            <div>
              <span className="text-gray-500">تاریخ پرداخت: </span>
              <strong>{receipt.paidDate}</strong>
            </div>
            <div>
              <span className="text-gray-500">عضو: </span>
              <strong>{receipt.memberName}</strong>
            </div>
            <div>
              <span className="text-gray-500">کد وام: </span>
              <strong className="font-mono">{receipt.loanCode}</strong>
            </div>
            <div>
              <span className="text-gray-500">شماره قسط: </span>
              <strong>{receipt.installmentNo}</strong>
            </div>
            <div>
              <span className="text-gray-500">وضعیت: </span>
              <strong>{receipt.status === "paid" ? "پرداخت شده" : receipt.status}</strong>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-800">مبلغ پرداختی</div>
              <div className="text-3xl font-bold text-blue-900 mt-1">
                {formatNumber(receipt.amount)} <span className="text-base">ریال</span>
              </div>
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="کد QR رسید" className="w-28 h-28" />
            )}
          </div>

          <div className="text-center text-xs text-gray-400 mt-5">
            با اسکن کد QR می‌توانید صحت این رسید را استعلام نمایید.
          </div>

          <div className="flex justify-center mt-6 no-print">
            <button onClick={() => window.print()} className="btn btn-primary">
              🖨️ چاپ رسید / ذخیره PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return embedded ? body : <div className="min-h-screen bg-slate-100 p-6">{body}</div>;
}
