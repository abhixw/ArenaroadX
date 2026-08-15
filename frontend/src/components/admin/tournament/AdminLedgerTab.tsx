import { Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getLedger } from "@/api/admin/refunds";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Tournament } from "@/types";
import type { TransactionType } from "@/types/admin";

const TYPE_TONE: Record<TransactionType, "success" | "danger" | "primary" | "gray"> = {
  ENTRY_FEE: "success",
  REFUND: "danger",
  PRIZE: "primary",
  ADJUSTMENT: "gray",
};

export function AdminLedgerTab({ tournament }: { tournament: Tournament }) {
  const { data: transactions, loading, error, refetch } = useAsyncData(() => getLedger(tournament.id), [tournament.id]);

  const total = (transactions ?? []).reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Financial Ledger</p>
        <span className="text-sm font-bold text-gray-900">{formatCurrency(total)}</span>
      </div>

      <div className="mt-4">
        {error ? (
          <ErrorState message="Couldn't load the ledger." onRetry={refetch} />
        ) : loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (transactions ?? []).length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400">
                  <th className="py-2">Type</th>
                  <th className="py-2">Note</th>
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(transactions ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5">
                      <Badge tone={TYPE_TONE[t.type]}>{t.type}</Badge>
                    </td>
                    <td className="py-2.5 text-gray-600">{t.note ?? "—"}</td>
                    <td className="py-2.5 text-gray-500">{formatDateTime(t.createdAt)}</td>
                    <td
                      className={`py-2.5 text-right font-semibold ${t.amount < 0 ? "text-danger-600" : "text-gray-900"}`}
                    >
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
