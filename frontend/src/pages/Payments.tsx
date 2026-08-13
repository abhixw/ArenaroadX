import { useMemo } from "react";
import { Receipt } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaymentStatusBadge } from "@/components/ui/Badge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getMyPayments } from "@/api/payments";
import { getTournaments } from "@/api/tournaments";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function Payments() {
  const { data: payments, loading } = useAsyncData(getMyPayments);
  const { data: tournaments } = useAsyncData(getTournaments);

  const tournamentMap = useMemo(
    () => new Map((tournaments ?? []).map((t) => [t.id, t])),
    [tournaments],
  );

  const sorted = [...(payments ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div>
      <Topbar title="Payments" subtitle="Your entry fee payment history and refund status." />

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Receipt} title="No payments yet" description="Register for a tournament to see payments here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-app-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Tournament</th>
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3.5 font-medium text-gray-800">
                      {tournamentMap.get(p.tournamentId)?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">{p.razorpayOrderId}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{formatDateTime(p.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
