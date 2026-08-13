import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Gamepad2, ListChecks, Trophy } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { NextMatchCard } from "@/components/dashboard/NextMatchCard";
import { RecentResultsList } from "@/components/dashboard/RecentResultsList";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { TournamentCard } from "@/components/dashboard/TournamentCard";
import { TournamentRow } from "@/components/dashboard/TournamentRow";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getMyTournaments } from "@/api/registrations";
import { findNextMatch, getTournaments } from "@/api/tournaments";
import { getGames } from "@/api/games";
import { getRecentResults } from "@/api/results";
import { computeDashboardStats, computePerformanceHistory, computePerformanceStats } from "@/lib/performance";
import { describeMyTournament, matchesTab, type MyTournamentTab } from "@/lib/selectors";

const TABS: { value: MyTournamentTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<MyTournamentTab>("ALL");

  const { data: myTournaments, loading: loadingMine } = useAsyncData(getMyTournaments);
  const { data: tournaments, loading: loadingTournaments } = useAsyncData(getTournaments);
  const { data: games } = useAsyncData(getGames);
  const { data: nextMatch, loading: loadingNext } = useAsyncData(
    () => (myTournaments ? findNextMatch(myTournaments) : Promise.resolve(null)),
    [myTournaments],
  );
  const { data: recentResults, loading: loadingResults } = useAsyncData(
    () => (tournaments ? getRecentResults(tournaments) : Promise.resolve([])),
    [tournaments],
  );

  const gameMap = useMemo(() => new Map((games ?? []).map((g) => [g.id, g])), [games]);
  const perfStats = useMemo(() => computePerformanceStats(recentResults ?? []), [recentResults]);
  const perfHistory = useMemo(() => computePerformanceHistory(recentResults ?? []), [recentResults]);
  const dashStats = useMemo(() => computeDashboardStats(recentResults ?? []), [recentResults]);

  const liveOrUpcomingCount =
    myTournaments?.filter(
      (e) =>
        e.registration.status === "CONFIRMED" &&
        ["LIVE", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "READY"].includes(e.tournament.status),
    ).length ?? 0;

  const filteredMine = (myTournaments ?? []).filter((e) => matchesTab(e.tournament, tab)).slice(0, 3);

  const exploreTournaments = (tournaments ?? [])
    .filter((t) => t.status === "REGISTRATION_OPEN")
    .filter((t) => !(myTournaments ?? []).some((e) => e.tournament.id === t.id))
    .slice(0, 4);

  return (
    <div>
      <Topbar
        title={
          <>
            Welcome back, <span className="text-primary-600">{user?.handle ?? "Player"}</span> 👋
          </>
        }
        subtitle="Here's what's happening in your gaming journey."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Gamepad2}
              label="Active Tournaments"
              value={liveOrUpcomingCount}
              hint="You're registered"
            />
            <StatCard
              icon={CalendarClock}
              label="Upcoming Matches"
              value={nextMatch ? 1 : 0}
              hint={nextMatch ? "Next match scheduled" : "None scheduled"}
              tone="success"
            />
            <StatCard
              icon={Trophy}
              label="Current Rank"
              value={dashStats.currentRank ? `#${dashStats.currentRank}` : "—"}
              hint={dashStats.currentRank ? `In ${dashStats.rankTournamentsCount} tournaments` : undefined}
              tone="warning"
            />
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">My Tournaments</p>
            </div>
            <div className="mt-3">
              <Tabs options={TABS} value={tab} onChange={setTab} />
            </div>

            <div className="mt-4 space-y-3">
              {loadingMine ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : filteredMine.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No tournaments here yet"
                  description="Browse open tournaments and register to see them show up here."
                  action={
                    <Link to="/tournaments" className="text-sm font-semibold text-primary-600 hover:underline">
                      Browse tournaments
                    </Link>
                  }
                />
              ) : (
                filteredMine.map((entry) => {
                  const presentation = describeMyTournament(entry);
                  const game = gameMap.get(entry.tournament.gameId);
                  return game ? (
                    <TournamentRow
                      key={entry.registration.id}
                      tournament={entry.tournament}
                      game={game}
                      metaLine={presentation.meta}
                      cta={{ label: presentation.ctaLabel, variant: presentation.ctaVariant }}
                    />
                  ) : null;
                })
              )}
            </div>

            <Link
              to="/my-tournaments"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline"
            >
              View all tournaments →
            </Link>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Explore Tournaments</p>
              <Link to="/tournaments" className="text-xs font-semibold text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {loadingTournaments
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : exploreTournaments.map((t) => {
                    const game = gameMap.get(t.gameId);
                    return game ? <TournamentCard key={t.id} tournament={t} game={game} /> : null;
                  })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {loadingNext ? (
            <Skeleton className="h-64 w-full" />
          ) : nextMatch && gameMap.get(nextMatch.tournament.gameId) ? (
            <NextMatchCard
              tournament={nextMatch.tournament}
              game={gameMap.get(nextMatch.tournament.gameId)!}
              match={nextMatch.match}
            />
          ) : (
            <Card className="p-5">
              <EmptyState
                icon={CalendarClock}
                title="No upcoming matches"
                description="Register for a tournament to see your next match here."
              />
            </Card>
          )}

          {loadingResults ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <RecentResultsList results={recentResults ?? []} />
          )}

          <PerformanceChart data={perfHistory} stats={perfStats} />
        </div>
      </div>
    </div>
  );
}
