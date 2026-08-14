import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { TournamentCard } from "@/components/dashboard/TournamentCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getTournaments } from "@/api/tournaments";
import { getGames } from "@/api/games";
import type { TournamentStatus } from "@/types";

type StatusFilter = "ALL" | "REGISTRATION_OPEN" | "LIVE" | "REGISTRATION_CLOSED" | "COMPLETED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "REGISTRATION_OPEN", label: "Open" },
  { value: "LIVE", label: "Live" },
  { value: "REGISTRATION_CLOSED", label: "Upcoming" },
  { value: "COMPLETED", label: "Completed" },
];

function statusMatches(status: TournamentStatus, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "COMPLETED") {
    return ["RESULTS_PENDING", "RESULTS_REVIEW", "RESULTS_PUBLISHED", "COMPLETED"].includes(status);
  }
  if (filter === "REGISTRATION_CLOSED") {
    return ["REGISTRATION_CLOSED", "READY"].includes(status);
  }
  return status === filter;
}

export default function Tournaments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [gameFilter, setGameFilter] = useState<string>("ALL");

  const { data: tournaments, loading } = useAsyncData(getTournaments);
  const { data: games } = useAsyncData(getGames);

  useEffect(() => {
    const searchFromUrl = searchParams.get("search") ?? "";
    const gameFromUrl = searchParams.get("game");
    setQuery(searchFromUrl);
    if (gameFromUrl) setGameFilter(gameFromUrl);
    // Re-sync whenever the URL's search param changes (e.g. a new search from the top bar
    // while already on this page), not just on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const gameMap = useMemo(() => new Map((games ?? []).map((g) => [g.id, g])), [games]);

  const filtered = (tournaments ?? []).filter((t) => {
    const game = gameMap.get(t.gameId);
    const matchesQuery =
      !query.trim() ||
      t.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      game?.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusMatches(t.status, statusFilter);
    const matchesGame = gameFilter === "ALL" || t.gameId === gameFilter;
    return matchesQuery && matchesStatus && matchesGame;
  });

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim()) setSearchParams({ search: value.trim() });
    else setSearchParams({});
  }

  return (
    <div>
      <Topbar title="Tournaments" subtitle="Browse and join tournaments across every supported game." />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search by tournament or game..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <SlidersHorizontal size={15} className="shrink-0 text-gray-400" />
            <select
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
              className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-400"
            >
              <option value="ALL">All games</option>
              {(games ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                statusFilter === f.value
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((t) => {
              const game = gameMap.get(t.gameId);
              return game ? <TournamentCard key={t.id} tournament={t} game={game} /> : null;
            })}
      </div>

      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No tournaments match your filters"
          description="Try a different search term or clear the filters."
        />
      ) : null}
    </div>
  );
}
