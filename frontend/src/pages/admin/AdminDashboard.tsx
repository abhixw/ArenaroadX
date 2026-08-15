import { Link } from "react-router-dom";
import { CalendarDays, Gamepad2, ListChecks, Users } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { TournamentStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listTournaments } from "@/api/admin/tournaments";
import { listGames } from "@/api/admin/games";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";

const LIVE_ISH = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "READY", "LIVE"];
const REVIEW_QUEUE_STATUSES = ["RESULTS_PENDING", "RESULTS_REVIEW"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: tournaments, loading, error, refetch } = useAsyncData(listTournaments);
  const { data: games } = useAsyncData(listGames);

  const active = (tournaments ?? []).filter((t) => LIVE_ISH.includes(t.status)).length;
  const totalPlayers = (tournaments ?? []).reduce((sum, t) => sum + t.registeredPlayers, 0);
  const reviewQueue = (tournaments ?? []).filter((t) => REVIEW_QUEUE_STATUSES.includes(t.status));

  const recent = [...(tournaments ?? [])]
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, 6);

  return (
    <div>
      <Topbar title={`Welcome, ${user?.handle ?? "Admin"}`} subtitle="Platform overview." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={CalendarDays} label="Active Tournaments" value={active} />
        <StatCard icon={ListChecks} label="Total Tournaments" value={(tournaments ?? []).length} tone="success" />
        <StatCard icon={Users} label="Total Registrations" value={totalPlayers} tone="warning" />
        <StatCard icon={Gamepad2} label="Games" value={(games ?? []).length} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Recent Tournaments</p>
            <Link to="/admin/tournaments" className="text-xs font-semibold text-primary-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {error ? (
              <ErrorState message="Couldn't load tournaments." onRetry={refetch} />
            ) : loading ? (
              <Skeleton className="h-24 w-full" />
            ) : recent.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No tournaments yet" />
            ) : (
              recent.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/tournaments/${t.id}`}
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-app-bg"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      {t.registeredPlayers}/{t.maxPlayers} players • {formatDate(t.startsAt)}
                    </p>
                  </div>
                  <TournamentStatusBadge status={t.status} />
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="h-fit p-5">
          <p className="text-sm font-bold text-gray-900">Result Review Queue</p>
          <div className="mt-3 space-y-2">
            {reviewQueue.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing waiting on review.</p>
            ) : (
              reviewQueue.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/tournaments/${t.id}`}
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-app-bg"
                >
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <TournamentStatusBadge status={t.status} />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
