"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface Member {
  id: number;
  memberCode: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  phone2?: string;
  email?: string;
  address?: string;
  city?: string;
  department?: string;
  jobTitle?: string;
  employeeId?: string;
  isActive: boolean;
  joinDate: string;
  guarantorName?: string;
  guarantorPhone?: string;
  notes?: string;
  createdAt: string;
}

interface MemberFormData {
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  phone2: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  birthDate: string;
  jobTitle: string;
  department: string;
  employeeId: string;
  guarantorName: string;
  guarantorPhone: string;
  guarantorNationalId: string;
  joinDate: string;
  notes: string;
  isActive: boolean;
}

const emptyForm: MemberFormData = {
  firstName: "", lastName: "", nationalId: "", phone: "",
  phone2: "", email: "", address: "", city: "", postalCode: "",
  birthDate: "", jobTitle: "", department: "", employeeId: "",
  guarantorName: "", guarantorPhone: "", guarantorNationalId: "",
  joinDate: new Date().toISOString().split("T")[0], notes: "", isActive: true,
};

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<Member | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMembers();
  }, [page, search]);

  async function fetchMembers() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/members?page=${page}&search=${encodeURIComponent(search)}&limit=15`
      );
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditMember(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(m: Member) {
    setEditMember(m);
    setForm({
      firstName: m.firstName, lastName: m.lastName, nationalId: m.nationalId,
      phone: m.phone, phone2: m.phone2 || "", email: m.email || "",
      address: m.address || "", city: m.city || "", postalCode: "",
      birthDate: "", jobTitle: m.jobTitle || "", department: m.department || "",
      employeeId: m.employeeId || "", guarantorName: m.guarantorName || "",
      guarantorPhone: m.guarantorPhone || "", guarantorNationalId: "",
      joinDate: m.joinDate, notes: m.notes || "", isActive: m.isActive,
    });
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editMember ? `/api/members/${editMember.id}` : "/api/members";
      const method = editMember ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در ذخیره‌سازی");
        return;
      }
      setShowModal(false);
      fetchMembers();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("آیا از حذف/غیرفعال کردن این عضو مطمئن هستید؟")) return;
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    if (res.ok) fetchMembers();
  }

  async function openDetail(m: Member) {
    const res = await fetch(`/api/members/${m.id}`);
    if (res.ok) {
      const data = await res.json();
      setShowDetail(data.member);
    }
  }

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">👥 مدیریت اعضا</h1>
        <button onClick={openAdd} className="btn btn-primary">
          ➕ افزودن عضو جدید
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          type="text"
          placeholder="جستجو بر اساس نام، کد ملی، تلفن یا کد عضویت..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="form-input"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>کد عضویت</th>
                <th>نام و نام خانوادگی</th>
                <th>کد ملی</th>
                <th>تلفن</th>
                <th>بخش/واحد</th>
                <th>تاریخ عضویت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">عضوی یافت نشد</td></tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id}>
                    <td><span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{m.memberCode}</span></td>
                    <td className="font-semibold">{m.firstName} {m.lastName}</td>
                    <td className="font-mono text-sm">{m.nationalId}</td>
                    <td>{m.phone}</td>
                    <td>{m.department || "-"}</td>
                    <td>{formatDate(m.joinDate)}</td>
                    <td>
                      <span className={`badge ${m.isActive ? "badge-green" : "badge-red"}`}>
                        {m.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openDetail(m)} className="btn btn-sm btn-secondary" title="جزئیات">👁️</button>
                        <button onClick={() => openEdit(m)} className="btn btn-sm btn-primary" title="ویرایش">✏️</button>
                        <button onClick={() => handleDelete(m.id)} className="btn btn-sm btn-danger" title="حذف">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t">
            <span className="text-sm text-gray-500">
              نمایش {(page - 1) * 15 + 1} تا {Math.min(page * 15, total)} از {total} عضو
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm btn-secondary">قبلی</button>
              <span className="btn btn-sm btn-secondary">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-sm btn-secondary">بعدی</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Add/Edit Member */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1e3a5f]">
                {editMember ? "✏️ ویرایش عضو" : "➕ افزودن عضو جدید"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نام *</label>
                  <input required className="form-input" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نام خانوادگی *</label>
                  <input required className="form-input" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">کد ملی *</label>
                  <input required className="form-input" value={form.nationalId} onChange={e => setForm({...form, nationalId: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">شماره موبایل *</label>
                  <input required className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">شماره موبایل ۲</label>
                  <input className="form-input" value={form.phone2} onChange={e => setForm({...form, phone2: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ایمیل</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">بخش/واحد</label>
                  <input className="form-input" value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سمت شغلی</label>
                  <input className="form-input" value={form.jobTitle} onChange={e => setForm({...form, jobTitle: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">کد پرسنلی</label>
                  <input className="form-input" value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاریخ عضویت</label>
                  <input type="date" className="form-input" value={form.joinDate} onChange={e => setForm({...form, joinDate: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">آدرس</label>
                <textarea rows={2} className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">شهر</label>
                  <input className="form-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">کد پستی</label>
                  <input className="form-input" value={form.postalCode} onChange={e => setForm({...form, postalCode: e.target.value})} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-3">اطلاعات ضامن</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">نام ضامن</label>
                    <input className="form-input" value={form.guarantorName} onChange={e => setForm({...form, guarantorName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تلفن ضامن</label>
                    <input className="form-input" value={form.guarantorPhone} onChange={e => setForm({...form, guarantorPhone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">کد ملی ضامن</label>
                    <input className="form-input" value={form.guarantorNationalId} onChange={e => setForm({...form, guarantorNationalId: e.target.value})} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
                <textarea rows={2} className="form-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>

              {editMember && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">عضو فعال است</label>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? "⏳ در حال ذخیره..." : "💾 ذخیره"}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1e3a5f]">👁️ مشخصات عضو</h2>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="کد عضویت" value={showDetail.memberCode} />
              <InfoRow label="نام و نام خانوادگی" value={`${showDetail.firstName} ${showDetail.lastName}`} />
              <InfoRow label="کد ملی" value={showDetail.nationalId} />
              <InfoRow label="تلفن" value={showDetail.phone} />
              <InfoRow label="تلفن ۲" value={showDetail.phone2 || "-"} />
              <InfoRow label="ایمیل" value={showDetail.email || "-"} />
              <InfoRow label="بخش" value={showDetail.department || "-"} />
              <InfoRow label="سمت" value={showDetail.jobTitle || "-"} />
              <InfoRow label="کد پرسنلی" value={showDetail.employeeId || "-"} />
              <InfoRow label="تاریخ عضویت" value={formatDate(showDetail.joinDate)} />
              <InfoRow label="وضعیت" value={showDetail.isActive ? "فعال" : "غیرفعال"} />
              <InfoRow label="شهر" value={showDetail.city || "-"} />
            </div>
            {showDetail.address && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-semibold text-gray-600">آدرس: </span>
                <span className="text-sm">{showDetail.address}</span>
              </div>
            )}
            {showDetail.guarantorName && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="font-semibold text-sm text-blue-800 mb-2">اطلاعات ضامن</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoRow label="نام ضامن" value={showDetail.guarantorName} />
                  <InfoRow label="تلفن ضامن" value={showDetail.guarantorPhone || "-"} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
