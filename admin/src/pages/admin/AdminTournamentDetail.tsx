import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Topbar } from "@shared/components/layout/Topbar";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { ErrorState } from "@shared/components/ui/ErrorState";
import { Tabs } from "@shared/components/ui/Tabs";
import { TournamentStatusBadge } from "@shared/components/ui/Badge";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { getTournament } from "@shared/api/tournaments";
import { getGames } from "@shared/api/games";
import { AdminOverviewTab } from "@/components/admin/tournament/AdminOverviewTab";
import { AdminMatchesTab } from "@/components/admin/tournament/AdminMatchesTab";
import { AdminResultsTab } from "@/components/admin/tournament/AdminResultsTab";
import { AdminParticipantsTab } from "@/components/admin/tournament/AdminParticipantsTab";
import { AdminPrizesTab } from "@/components/admin/tournament/AdminPrizesTab";

type Tab = "overview" | "matches" | "results" | "participants" | "prizes";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "matches", label: "Matches" },
  { value: "results", label: "Results" },
  { value: "participants", label: "Participants" },
  { value: "prizes", label: "Prizes & Refunds" },
];

export default function AdminTournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: tournament, loading, error, refetch } = useAsyncData(() => getTournament(id!), [id]);
  const { data: games } = useAsyncData(getGames);

  if (!loading && !error && !tournament) {
    return <Navigate to="/tournaments" replace />;
  }

  if (error) {
    return <ErrorState message="Couldn't load this tournament." onRetry={refetch} />;
  }

  if (loading || !tournament) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const game = (games ?? []).find((g) => g.id === tournament.gameId);

  return (
    <div>
      <Topbar
        title={tournament.name}
        subtitle={
          <span className="flex items-center gap-2">
            {game?.name} <TournamentStatusBadge status={tournament.status} />
          </span>
        }
      />

      <div className="card mb-6 p-2">
        <Tabs options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "overview" ? (
        <AdminOverviewTab tournament={tournament} games={games ?? []} onChanged={refetch} />
      ) : null}
      {tab === "matches" ? <AdminMatchesTab tournament={tournament} /> : null}
      {tab === "results" ? <AdminResultsTab tournament={tournament} /> : null}
      {tab === "participants" ? <AdminParticipantsTab tournament={tournament} /> : null}
      {tab === "prizes" ? <AdminPrizesTab tournament={tournament} /> : null}
    </div>
  );
}
