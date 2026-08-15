import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Thumb } from "@/components/ui/Thumb";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getTournaments } from "@/api/tournaments";
import { getGames } from "@/api/games";
import { formatDate } from "@/lib/utils";
import { useMemo } from "react";

const PUBLISHED = ["RESULTS_PUBLISHED", "COMPLETED"];

export default function Leaderboards() {
  const { data: tournaments, loading, error, refetch } = useAsyncData(getTournaments);
  const { data: games } = useAsyncData(getGames);
  const gameMap = useMemo(() => new Map((games ?? []).map((g) => [g.id, g])), [games]);

  const published = (tournaments ?? [])
    .filter((t) => PUBLISHED.includes(t.status))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div>
      <Topbar title="Leaderboards" subtitle="Published results across every tournament you've played." />

      {error ? (
        <Card className="p-5">
          <ErrorState message="Couldn't load leaderboards." onRetry={refetch} />
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : published.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={Trophy}
            title="No published leaderboards yet"
            description="Once an admin publishes results, they'll show up here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {published.map((t) => {
            const game = gameMap.get(t.gameId);
            return (
              <Link
                key={t.id}
                to={`/leaderboards/${t.id}`}
                className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-card-lg"
              >
                <Thumb src={t.imageUrl} alt={t.name} className="h-14 w-14 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">
                    {game?.name} • {t.registeredPlayers} players • {formatDate(t.startsAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary-600">View →</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
