import Link from "next/link";
import ReceiptViewer from "@/components/ReceiptViewer";

export const metadata = {
  title: "استعلام رسید پرداخت",
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#1e3a5f] text-white px-6 py-4 flex items-center justify-between no-print">
        <div className="font-bold">استعلام صحت رسید پرداخت</div>
        <Link href="/inquiry" className="btn btn-secondary btn-sm">
          استعلام عضو
        </Link>
      </header>
      <div className="p-6">
        <ReceiptViewer code={code} />
      </div>
    </div>
  );
}
