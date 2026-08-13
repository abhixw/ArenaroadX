import { Link } from "react-router-dom";
import { Topbar } from "@/components/layout/Topbar";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Thumb } from "@/components/ui/Thumb";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getGames } from "@/api/games";
import { getTournaments } from "@/api/tournaments";

export default function Games() {
  const { data: games, loading } = useAsyncData(getGames);
  const { data: tournaments } = useAsyncData(getTournaments);

  return (
    <div>
      <Topbar title="Games" subtitle="Every game currently supported on the platform." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : (games ?? []).map((game) => {
              const openCount = (tournaments ?? []).filter(
                (t) => t.gameId === game.id && t.status === "REGISTRATION_OPEN",
              ).length;
              return (
                <Link
                  key={game.id}
                  to={`/tournaments?game=${game.id}`}
                  className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-card-lg"
                >
                  <div className="relative h-32 w-full overflow-hidden">
                    <Thumb
                      src={game.imageUrl}
                      alt={game.name}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-gray-900">{game.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{game.description}</p>
                    <p className="mt-3 text-xs font-semibold text-primary-600">
                      {openCount} open tournament{openCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
