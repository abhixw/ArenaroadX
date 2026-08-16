import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { Topbar } from "@shared/components/layout/Topbar";
import { Card } from "@shared/components/ui/Card";
import { Tabs } from "@shared/components/ui/Tabs";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { ErrorState } from "@shared/components/ui/ErrorState";
import { TournamentRow } from "@/components/dashboard/TournamentRow";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { getMyTournaments } from "@/api/registrations";
import { getGames } from "@shared/api/games";
import { describeMyTournament, matchesTab, type MyTournamentTab } from "@/lib/selectors";
import { Link } from "react-router-dom";

const TABS: { value: MyTournamentTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function MyTournaments() {
  const [tab, setTab] = useState<MyTournamentTab>("ALL");
  const { data: entries, loading, error, refetch } = useAsyncData(getMyTournaments);
  const { data: games } = useAsyncData(getGames);

  const gameMap = useMemo(() => new Map((games ?? []).map((g) => [g.id, g])), [games]);

  const filtered = (entries ?? []).filter((e) => matchesTab(e.tournament, tab));
  const counts = Object.fromEntries(
    TABS.map((t) => [t.value, (entries ?? []).filter((e) => matchesTab(e.tournament, t.value)).length]),
  );

  return (
    <div>
      <Topbar title="My Tournaments" subtitle="Every tournament you've registered for, in one place." />

      <Card className="p-5">
        <Tabs
          options={TABS.map((t) => ({ ...t, count: counts[t.value] }))}
          value={tab}
          onChange={setTab}
        />

        <div className="mt-4 space-y-3">
          {error ? (
            <ErrorState message="Couldn't load your tournaments." onRetry={refetch} />
          ) : loading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nothing here yet"
              description="Tournaments you register for will show up in this tab."
              action={
                <Link to="/tournaments" className="text-sm font-semibold text-primary-600 hover:underline">
                  Browse tournaments
                </Link>
              }
            />
          ) : (
            filtered.map((entry) => {
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
      </Card>
    </div>
  );
}
