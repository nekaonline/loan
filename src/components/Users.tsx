"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";

interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  admin: "مدیر سیستم",
  manager: "کارشناس",
  viewer: "مشاهده‌گر",
};

const roleDesc: Record<string, string> = {
  admin: "دسترسی کامل به همه قسمت‌ها",
  manager: "ثبت و ویرایش اطلاعات، بدون حذف",
  viewer: "فقط مشاهده",
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    phone: "",
    role: "viewer",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditUser(null);
    setForm({ username: "", password: "", fullName: "", email: "", phone: "", role: "viewer", isActive: true });
    setError("");
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ username: u.username, password: "", fullName: u.fullName, email: u.email || "", phone: u.phone || "", role: u.role, isActive: u.isActive });
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editUser ? `/api/users/${editUser.id}` : "/api/users";
      const method = editUser ? "PUT" : "POST";
      const body = editUser ? { ...form, password: form.password || undefined } : form;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "خطا"); return; }
      setShowModal(false);
      fetchUsers();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...u, isActive: !u.isActive }),
    });
    if (res.ok) fetchUsers();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">👤 مدیریت کاربران سیستم</h1>
        <button onClick={openAdd} className="btn btn-primary">➕ کاربر جدید</button>
      </div>

      {/* Role Info Cards */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role} className="bg-white rounded-xl shadow-sm p-4 border-r-4 border-blue-400">
            <div className="font-bold text-[#1e3a5f]">{label}</div>
            <div className="text-xs text-gray-500 mt-1">{roleDesc[role]}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>نام کاربری</th>
              <th>نام کامل</th>
              <th>سطح دسترسی</th>
              <th>تلفن</th>
              <th>ایمیل</th>
              <th>آخرین ورود</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">در حال بارگذاری...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">کاربری ثبت نشده</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono font-semibold">{u.username}</td>
                  <td>{u.fullName}</td>
                  <td>
                    <span className={`badge ${
                      u.role === "admin" ? "badge-purple" :
                      u.role === "manager" ? "badge-blue" : "badge-gray"
                    }`}>
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td>{u.phone || "-"}</td>
                  <td className="text-xs">{u.email || "-"}</td>
                  <td className="text-xs">{u.lastLogin ? formatDateTime(u.lastLogin) : "هرگز"}</td>
                  <td>
                    <span className={`badge ${u.isActive ? "badge-green" : "badge-red"}`}>
                      {u.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="btn btn-sm btn-primary">✏️</button>
                      <button onClick={() => toggleActive(u)} className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-success"}`}>
                        {u.isActive ? "🚫" : "✅"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1e3a5f]">{editUser ? "✏️ ویرایش کاربر" : "➕ کاربر جدید"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نام کاربری *</label>
                  <input required className="form-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!editUser} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{editUser ? "رمز عبور جدید" : "رمز عبور *"}</label>
                  <input
                    type="password"
                    required={!editUser}
                    className="form-input"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder={editUser ? "خالی = بدون تغییر" : ""}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نام کامل *</label>
                <input required className="form-input" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تلفن</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ایمیل</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سطح دسترسی *</label>
                <select required className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="viewer">مشاهده‌گر - فقط مشاهده</option>
                  <option value="manager">کارشناس - ثبت و ویرایش</option>
                  <option value="admin">مدیر - دسترسی کامل</option>
                </select>
              </div>

              {editUser && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ua" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                  <label htmlFor="ua" className="text-sm">کاربر فعال است</label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? "⏳..." : "💾 ذخیره"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
