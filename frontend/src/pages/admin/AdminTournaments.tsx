import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { TournamentStatusBadge } from "@/components/ui/Badge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listTournaments } from "@/api/admin/tournaments";
import { getGames } from "@/api/games";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TournamentStatus } from "@/types";
import { CreateTournamentModal } from "@/components/admin/CreateTournamentModal";

const STATUS_FILTERS: { value: TournamentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "REGISTRATION_OPEN", label: "Registration Open" },
  { value: "REGISTRATION_CLOSED", label: "Registration Closed" },
  { value: "READY", label: "Ready" },
  { value: "LIVE", label: "Live" },
  { value: "RESULTS_PENDING", label: "Results Pending" },
  { value: "RESULTS_REVIEW", label: "Results Review" },
  { value: "RESULTS_PUBLISHED", label: "Results Published" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminTournaments() {
  const { data: tournaments, loading, refetch } = useAsyncData(listTournaments);
  const { data: games } = useAsyncData(getGames);
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | "ALL">("ALL");
  const [creating, setCreating] = useState(false);

  const gameMap = useMemo(() => new Map((games ?? []).map((g) => [g.id, g])), [games]);
  const filtered = (tournaments ?? [])
    .filter((t) => statusFilter === "ALL" || t.status === statusFilter)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div>
      <Topbar title="Tournaments" subtitle="Create and manage tournaments." />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === f.value ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus size={15} /> Create
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
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
                      <Link to={`/admin/tournaments/${t.id}`} className="hover:text-primary-600 hover:underline">
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
              <p className="p-8 text-center text-sm text-gray-400">No tournaments match this filter.</p>
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
