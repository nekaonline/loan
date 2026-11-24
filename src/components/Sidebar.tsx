"use client";

import { useState } from "react";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  user: { fullName: string; role: string; username: string } | null;
  onLogout: () => void;
}

const menuItems = [
  { id: "dashboard", label: "داشبورد", icon: "🏠" },
  { id: "members", label: "مدیریت اعضا", icon: "👥" },
  { id: "loans", label: "مدیریت وام‌ها", icon: "💰" },
  { id: "installments", label: "اقساط و پرداخت", icon: "📋" },
  { id: "debtors", label: "لیست بدهکاران", icon: "⚠️" },
  { id: "fund", label: "موجودی صندوق", icon: "🏦" },
  { id: "reports", label: "گزارشات", icon: "📊" },
  { id: "sms", label: "پیامک", icon: "📱" },
  { id: "users", label: "مدیریت کاربران", icon: "👤" },
  { id: "settings", label: "تنظیمات", icon: "⚙️" },
  { id: "backup", label: "پشتیبان‌گیری", icon: "💾" },
];

const roleLabels: Record<string, string> = {
  admin: "مدیر",
  manager: "کارشناس",
  viewer: "مشاهده‌گر",
};

export default function Sidebar({ currentPage, onNavigate, user, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`${collapsed ? "w-16" : "w-64"} bg-[#1e3a5f] min-h-screen flex flex-col transition-all duration-300 flex-shrink-0 no-print`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        {!collapsed ? (
          <div className="text-center">
            <div className="text-2xl mb-1">🏥</div>
            <div className="text-white font-bold text-sm leading-tight">
              صندوق قرض‌الحسنه
            </div>
            <div className="text-blue-300 text-xs mt-1">بوعلی سینا ساری</div>
          </div>
        ) : (
          <div className="text-center text-2xl">🏥</div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="self-end m-2 text-white/50 hover:text-white text-xs px-2"
      >
        {collapsed ? "◀" : "▶"}
      </button>

      {/* Menu Items */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {menuItems.map((item) => {
          const isAdminOnly = ["users", "backup"].includes(item.id);
          if (isAdminOnly && user?.role === "viewer") return null;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-item w-full text-right ${currentPage === item.id ? "active" : ""}`}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-white/10">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="text-white/80 text-xs">
              <div className="font-semibold text-white">{user?.fullName}</div>
              <div className="text-blue-300">{roleLabels[user?.role || ""] || user?.role}</div>
            </div>
            <button
              onClick={onLogout}
              className="w-full text-center text-red-300 hover:text-red-200 text-xs py-1 px-2 rounded border border-red-400/30 hover:bg-red-400/10 transition-colors"
            >
              🚪 خروج
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="w-full text-center text-red-300 hover:text-red-200 text-lg"
            title="خروج"
          >
            🚪
          </button>
        )}
      </div>
    </div>
  );
}
