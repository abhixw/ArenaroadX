import { useState } from "react";
import { Search } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { PageControls } from "@/components/ui/PageControls";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listAllPayments, type AdminPayment } from "@/api/admin/payments";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const STATUS_TONE: Record<AdminPayment["status"], "success" | "warning" | "gray" | "danger"> = {
  CREATED: "gray",
  PENDING: "warning",
  CAPTURED: "success",
  FAILED: "danger",
  REFUNDED: "gray",
};

const PAGE_SIZE = 20;

export default function AdminPayments() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: result, loading } = useAsyncData(() => listAllPayments(page, PAGE_SIZE), [page]);

  // Search only filters within the currently loaded page -- the payments list has no
  // server-side search (unlike players), so this stays a client-side page-local filter.
  const filtered = (result?.items ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.playerName.toLowerCase().includes(q) ||
      p.playerEmail.toLowerCase().includes(q) ||
      p.tournamentName.toLowerCase().includes(q) ||
      p.razorpayOrderId.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <Topbar title="Payments" subtitle="Every entry-fee payment across all tournaments." />

      <Card className="p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by player, tournament, or order ID..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </Card>

      <Card className="mt-4 p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Search} title="No payments found" description="Try a different search term." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-app-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3">Tournament</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Order ID</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-app-bg/40">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-800">{p.playerName}</p>
                        <p className="text-xs text-gray-400">{p.playerEmail}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{p.tournamentName}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{formatCurrency(p.amount)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">{p.razorpayOrderId}</td>
                      <td className="px-5 py-3.5 text-gray-500">{formatDateTime(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PageControls pagination={result?.pagination ?? null} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
