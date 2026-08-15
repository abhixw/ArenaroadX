import { Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PrizeStatusBadge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getMyPrizes } from "@/api/prizes";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function Prizes() {
  const { user } = useAuth();
  const { data: prizes, loading, error, refetch } = useAsyncData(
    () => (user ? getMyPrizes(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const totalPaid = (prizes ?? []).filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const totalPending = (prizes ?? [])
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <Topbar title="Prizes" subtitle="Track your winnings and payout status." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Total Paid Out</p>
          <p className="mt-1 text-2xl font-extrabold text-success-600">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Pending Payout</p>
          <p className="mt-1 text-2xl font-extrabold text-warning-600">{formatCurrency(totalPending)}</p>
        </Card>
      </div>

      <Card className="p-5">
        {error ? (
          <ErrorState message="Couldn't load your prizes." onRetry={refetch} />
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (prizes ?? []).length === 0 ? (
          <EmptyState
            icon={Gift}
            title="No prizes yet"
            description="Place in the top ranks of a tournament to earn a prize."
            action={
              <Link to="/tournaments" className="text-sm font-semibold text-primary-600 hover:underline">
                Browse tournaments
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {(prizes ?? []).map((prize) => (
              <div key={prize.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{prize.tournamentName}</p>
                  <p className="text-xs text-gray-400">
                    Rank #{prize.rank} • {formatDate(prize.createdAt)}
                    {prize.paidAt ? ` • Paid ${formatDate(prize.paidAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(prize.amount)}</span>
                  <PrizeStatusBadge status={prize.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
