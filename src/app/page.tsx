"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import Members from "@/components/Members";
import Loans from "@/components/Loans";
import Installments from "@/components/Installments";
import Debtors from "@/components/Debtors";
import Fund from "@/components/Fund";
import Reports from "@/components/Reports";
import SmsPanel from "@/components/SmsPanel";
import Users from "@/components/Users";
import Settings from "@/components/Settings";
import Backup from "@/components/Backup";
import Guarantors from "@/components/Guarantors";
import MemberInquiry from "@/components/MemberInquiry";

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [initError, setInitError] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    // Never leave the user stuck on the loading screen: give up after 20s.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      // Idempotent: also applies schema upgrades and new default settings.
      const initRes = await fetch("/api/init", { method: "POST", signal: controller.signal });
      if (!initRes.ok) {
        const initData = await initRes.json().catch(() => ({}));
        setInitError(
          initData.error && initData.error !== "خطای راه‌اندازی"
            ? initData.error
            : "راه‌اندازی سیستم با خطا مواجه شد. اتصال سرور به پایگاه داده (PostgreSQL) را بررسی کنید."
        );
      }
      const res = await fetch("/api/auth/me", { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      setInitError("ارتباط با سرور برقرار نشد. اتصال شبکه، روشن بودن سرور و فایروال را بررسی کنید.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data.error || "خطا در ورود");
        return;
      }
      setUser(data.user);
    } catch {
      setLoginError("ارتباط با سرور برقرار نشد");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4 animate-pulse">🏥</div>
          <div className="text-xl font-semibold">در حال بارگذاری...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#1e40af] to-[#0f172a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">🏥</div>
            <h1 className="text-2xl font-bold text-white mb-1">
              صندوق قرض‌الحسنه
            </h1>
            <p className="text-blue-300 text-lg font-semibold">
              بیمارستان بوعلی سینا ساری
            </p>
            <p className="text-blue-400 text-sm mt-2">سامانه مدیریت مالی</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-bold text-[#1e3a5f] mb-6 text-center">
              🔐 ورود به سیستم
            </h2>

            {initError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-4 text-sm text-center">
                {initError}
              </div>
            )}

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  نام کاربری
                </label>
                <input
                  required
                  className="form-input text-lg py-3"
                  placeholder="admin"
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  رمز عبور
                </label>
                <input
                  required
                  type="password"
                  className="form-input text-lg py-3"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 px-6 bg-[#1e3a5f] hover:bg-[#1e40af] text-white font-bold rounded-xl text-lg transition-all duration-200 disabled:opacity-50"
              >
                {loggingIn ? "⏳ در حال ورود..." : "🔑 ورود به سیستم"}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl text-xs text-blue-600 text-center">
              <div className="font-semibold mb-1">اطلاعات ورود پیش‌فرض:</div>
              <div>نام کاربری: <strong>admin</strong></div>
              <div>رمز عبور: <strong>admin123</strong></div>
            </div>
          </div>

          <p className="text-center text-blue-400 text-xs mt-6">
            نسخه ۱.۰ | سامانه مدیریت صندوق قرض‌الحسنه
          </p>
          <div className="text-center mt-3 no-print">
            <a href="/inquiry" className="text-blue-200 hover:text-white text-xs underline">
              استعلام وضعیت اعضا و رسیدها
            </a>
          </div>
        </div>
      </div>
    );
  }

  const pageComponents: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    members: <Members />,
    loans: <Loans />,
    installments: <Installments />,
    debtors: <Debtors />,
    fund: <Fund />,
    reports: <Reports />,
    sms: <SmsPanel />,
    users: <Users />,
    settings: <Settings />,
    backup: <Backup />,
    guarantors: <Guarantors />,
    inquiry: <MemberInquiry embedded />,
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm px-6 py-3 flex items-center justify-between flex-shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="text-[#1e3a5f] font-bold text-sm">
              🏥 بیمارستان بوعلی سینا ساری
            </div>
            <span className="text-gray-300">|</span>
            <div className="text-gray-500 text-xs">صندوق قرض‌الحسنه</div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-gray-600">
              خوش آمدید، <strong className="text-[#1e3a5f]">{user.fullName}</strong>
            </div>
            <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
              {user.role === "admin" ? "مدیر" : user.role === "manager" ? "کارشناس" : "مشاهده‌گر"}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {pageComponents[currentPage] || <Dashboard />}
        </main>
      </div>
    </div>
  );
}
