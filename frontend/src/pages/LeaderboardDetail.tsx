import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Topbar } from "@shared/components/layout/Topbar";
import { Card } from "@shared/components/ui/Card";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { ErrorState } from "@shared/components/ui/ErrorState";
import { TournamentStatusBadge } from "@shared/components/ui/Badge";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { useAuth } from "@shared/hooks/useAuth";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { getTournament } from "@shared/api/tournaments";
import { getGame } from "@shared/api/games";
import { getLeaderboard } from "@/api/results";

export default function LeaderboardDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: tournament, loading, error, refetch } = useAsyncData(() => getTournament(id!), [id]);
  const { data: game } = useAsyncData(() => getGame(tournament?.gameId ?? ""), [tournament?.gameId]);
  const { data: rows, loading: loadingRows } = useAsyncData(() => getLeaderboard(id!), [id]);

  if (!loading && !error && !tournament) {
    return <Navigate to="/leaderboards" replace />;
  }

  return (
    <div>
      <Link
        to="/leaderboards"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft size={15} /> Back to leaderboards
      </Link>

      {error ? (
        <ErrorState message="Couldn't load this leaderboard." onRetry={refetch} />
      ) : loading || !tournament || !game ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Topbar
            title={tournament.name}
            subtitle={
              <span className="flex items-center gap-2">
                {game.name} • {tournament.registeredPlayers} players
              </span>
            }
          />
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <TournamentStatusBadge status={tournament.status} />
              <span className="text-xs text-gray-400">{tournament.scoringSummary}</span>
            </div>
            {loadingRows ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <LeaderboardTable rows={rows ?? []} currentUserId={user?.id} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
