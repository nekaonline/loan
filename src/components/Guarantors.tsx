"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate, formatNumber } from "@/lib/utils";

interface Guarantor {
  id: number;
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  phone2: string | null;
  address: string | null;
  jobTitle: string | null;
  relation: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface HistoryItem {
  id: number;
  createdAt: string;
  loanCode: string | null;
  amount: string | null;
  status: string | null;
  memberName: string | null;
  memberLastName: string | null;
  memberCode: string | null;
}

const emptyForm = {
  firstName: "",
  lastName: "",
  nationalId: "",
  phone: "",
  phone2: "",
  address: "",
  jobTitle: "",
  relation: "",
  notes: "",
  isActive: true,
};

export default function Guarantors() {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Guarantor | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [detail, setDetail] = useState<{ guarantor: Guarantor; history: HistoryItem[] } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchGuarantors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guarantors?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setGuarantors(data.guarantors);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGuarantors();
  }, [fetchGuarantors]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setError("");
    setShowModal(true);
  }

  function openEdit(g: Guarantor) {
    setEditing(g);
    setForm({
      firstName: g.firstName,
      lastName: g.lastName,
      nationalId: g.nationalId,
      phone: g.phone,
      phone2: g.phone2 || "",
      address: g.address || "",
      jobTitle: g.jobTitle || "",
      relation: g.relation || "",
      notes: g.notes || "",
      isActive: g.isActive,
    });
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/guarantors/${editing.id}` : "/api/guarantors", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در ذخیره سازی");
        return;
      }
      setShowModal(false);
      void fetchGuarantors();
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(g: Guarantor) {
    const res = await fetch(`/api/guarantors/${g.id}`);
    if (res.ok) setDetail(await res.json());
  }

  async function toggleActive(g: Guarantor) {
    const res = await fetch(`/api/guarantors/${g.id}`, { method: "DELETE" });
    if (res.ok) void fetchGuarantors();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">🛡️ مدیریت ضامن‌ها</h1>
        <button onClick={openAdd} className="btn btn-primary">➕ افزودن ضامن</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو بر اساس نام، کد ملی یا تلفن..."
          className="form-input"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>نام و نام خانوادگی</th>
                <th>کد ملی</th>
                <th>تلفن</th>
                <th>شغل</th>
                <th>نسبت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
              ) : guarantors.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">ضامنی یافت نشد</td></tr>
              ) : (
                guarantors.map((g) => (
                  <tr key={g.id}>
                    <td className="font-semibold">{g.firstName} {g.lastName}</td>
                    <td className="font-mono text-xs">{g.nationalId}</td>
                    <td>{g.phone}</td>
                    <td>{g.jobTitle || "-"}</td>
                    <td>{g.relation || "-"}</td>
                    <td>
                      <span className={`badge ${g.isActive ? "badge-green" : "badge-red"}`}>
                        {g.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => void openDetail(g)} className="btn btn-sm btn-secondary" title="سوابق ضمانت">👁️</button>
                        <button onClick={() => openEdit(g)} className="btn btn-sm btn-primary" title="ویرایش">✏️</button>
                        {g.isActive && (
                          <button onClick={() => void toggleActive(g)} className="btn btn-sm btn-danger" title="غیرفعال کردن">🚫</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">
                {editing ? "✏️ ویرایش ضامن" : "➕ افزودن ضامن"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400">✕</button>
            </div>
            {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-3 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">نام *</label>
                  <input required className="form-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">نام خانوادگی *</label>
                  <input required className="form-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">کد ملی *</label>
                  <input required className="form-input" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">تلفن *</label>
                  <input required className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تلفن دوم</label>
                  <input className="form-input" value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">شغل</label>
                  <input className="form-input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نسبت با عضو</label>
                <input className="form-input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">آدرس</label>
                <textarea rows={2} className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">توضیحات</label>
                <textarea rows={2} className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button disabled={saving} className="btn btn-primary flex-1">💾 ذخیره</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">
                👁️ سوابق ضمانت - {detail.guarantor.firstName} {detail.guarantor.lastName}
              </h2>
              <button onClick={() => setDetail(null)} className="text-2xl text-gray-400">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              کد ملی: {detail.guarantor.nationalId} | تلفن: {detail.guarantor.phone}
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>تاریخ ضمانت</th>
                  <th>کد وام</th>
                  <th>عضو</th>
                  <th>مبلغ وام</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {detail.history.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-400">سابقه ضمانتی ثبت نشده</td></tr>
                ) : (
                  detail.history.map((h) => (
                    <tr key={h.id}>
                      <td>{formatDate(h.createdAt)}</td>
                      <td className="font-mono text-xs">{h.loanCode || "-"}</td>
                      <td>{h.memberName} {h.memberLastName || ""} ({h.memberCode})</td>
                      <td>{h.amount ? formatNumber(parseFloat(h.amount)) : "-"}</td>
                      <td>{h.status || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
