import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Topbar } from "@shared/components/layout/Topbar";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { ErrorState } from "@shared/components/ui/ErrorState";
import { TournamentStatusBadge } from "@shared/components/ui/Badge";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { listTournaments } from "@/api/admin/tournaments";
import { getGames } from "@shared/api/games";
import { formatCurrency, formatDate } from "@shared/lib/utils";
import { CreateTournamentModal } from "@/components/admin/CreateTournamentModal";

export default function AdminTournaments() {
  const { data: tournaments, loading, error, refetch } = useAsyncData(listTournaments);
  const { data: games } = useAsyncData(getGames);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") ?? "");

  useEffect(() => {
    setQuery(searchParams.get("search") ?? "");
    // Re-sync whenever the URL's search param changes (e.g. a new search from the top bar
    // while already on this page), not just on first mount.
  }, [searchParams]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim()) setSearchParams({ search: value.trim() });
    else setSearchParams({});
  }

  const gameMap = useMemo(() => new Map((games ?? []).map((g) => [g.id, g])), [games]);
  const filtered = (tournaments ?? [])
    .filter((t) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const game = gameMap.get(t.gameId);
      return t.name.toLowerCase().includes(q) || game?.name.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div>
      <Topbar title="Tournaments" subtitle="Create and manage tournaments." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            aria-label="Search by tournament or game"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by tournament or game..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus size={15} /> Create
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {error ? (
          <div className="p-5">
            <ErrorState message="Couldn't load tournaments." onRetry={refetch} />
          </div>
        ) : loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-app-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Tournament</th>
                  <th className="px-5 py-3">Game</th>
                  <th className="px-5 py-3">Players</th>
                  <th className="px-5 py-3">Fee</th>
                  <th className="px-5 py-3">Starts</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-app-bg/40">
                    <td className="px-5 py-3.5 font-medium text-gray-800">
                      <Link to={`/tournaments/${t.id}`} className="hover:text-primary-600 hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{gameMap.get(t.gameId)?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {t.registeredPlayers}/{t.maxPlayers}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{formatCurrency(t.fee)}</td>
                    <td className="px-5 py-3.5 text-gray-500">{formatDate(t.startsAt)}</td>
                    <td className="px-5 py-3.5">
                      <TournamentStatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">
                {query.trim() ? "No tournaments match your search." : "No tournaments yet."}
              </p>
            ) : null}
          </div>
        )}
      </Card>

      {creating ? (
        <CreateTournamentModal
          games={games ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}
