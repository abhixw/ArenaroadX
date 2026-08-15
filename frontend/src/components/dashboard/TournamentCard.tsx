import { Link } from "react-router-dom";
import { Trophy, Users } from "lucide-react";
import type { Game, Tournament } from "@/types";
import { TournamentStatusBadge } from "@/components/ui/Badge";
import { Thumb } from "@/components/ui/Thumb";
import { formatCurrency } from "@/lib/utils";

export function TournamentCard({ tournament, game }: { tournament: Tournament; game: Game }) {
  const ctaLabel = tournament.status === "REGISTRATION_OPEN" ? "Join Now" : "View Details";

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-card-lg"
    >
      <div className="relative h-32 w-full overflow-hidden">
        <Thumb
          src={tournament.imageUrl}
          alt={tournament.name}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-2.5 top-2.5">
          <TournamentStatusBadge status={tournament.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-1 font-bold text-gray-900">{tournament.name}</p>
        <p className="mt-0.5 text-xs font-medium text-gray-400">{game.name}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users size={13} />
            {tournament.registeredPlayers}/{tournament.maxPlayers} Players
          </span>
          <span>{formatCurrency(tournament.fee)} Entry</span>
          {tournament.firstPrize ? (
            <span className="flex items-center gap-1 font-semibold text-primary-600">
              <Trophy size={13} />
              {formatCurrency(tournament.firstPrize)} 1st Prize
            </span>
          ) : (
            <span className="flex items-center gap-1 font-semibold text-primary-600">
              <Trophy size={13} />
              {formatCurrency(tournament.prizePool)} Prize Pool
            </span>
          )}
        </div>
        <div className="mt-auto pt-3.5">
          <span className="flex w-full items-center justify-center rounded-xl bg-primary-500 px-3 py-2 text-sm font-semibold text-white group-hover:bg-primary-600">
            {ctaLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
