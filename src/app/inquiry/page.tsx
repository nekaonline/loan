import Link from "next/link";
import MemberInquiry from "@/components/MemberInquiry";

export const metadata = {
  title: "استعلام وضعیت عضو",
};

export default function InquiryPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#1e3a5f] text-white px-6 py-4 flex items-center justify-between no-print">
        <div>
          <div className="font-bold">صندوق قرض الحسنه بیمارستان بوعلی سینا ساری</div>
          <div className="text-xs text-blue-200 mt-1">سامانه استعلام وضعیت اعضا</div>
        </div>
        <Link href="/" className="btn btn-secondary btn-sm">
          ورود به سامانه
        </Link>
      </header>
      <div className="p-6">
        <MemberInquiry />
      </div>
    </div>
  );
}
