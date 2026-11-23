import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "صندوق قرض‌الحسنه بیمارستان بوعلی سینا ساری",
  description: "سامانه مدیریت مالی صندوق قرض‌الحسنه",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-slate-100 text-slate-900 antialiased rtl">{children}</body>
    </html>
  );
}
