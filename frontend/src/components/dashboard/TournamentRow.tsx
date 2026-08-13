import { Link } from "react-router-dom";
import { Calendar, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Game, Tournament } from "@/types";
import { TournamentStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Thumb } from "@/components/ui/Thumb";
import { formatCurrency, formatDate } from "@/lib/utils";

interface TournamentRowProps {
  tournament: Tournament;
  game: Game;
  metaLine?: ReactNode;
  cta: { label: string; variant?: "primary" | "outline" };
}

export function TournamentRow({ tournament, game, metaLine, cta }: TournamentRowProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 p-3 transition-colors hover:border-primary-100 sm:flex-row sm:items-center">
      <Thumb
        src={tournament.imageUrl}
        alt={tournament.name}
        className="h-16 w-full shrink-0 rounded-xl sm:w-24"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-gray-900">{tournament.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span>{game.name}</span>
          <span className="flex items-center gap-1">
            <Users size={12} />
            {tournament.registeredPlayers} Players
          </span>
          <span>{formatCurrency(tournament.fee)} Entry</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          <Calendar size={12} />
          {formatDate(tournament.startsAt)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <TournamentStatusBadge status={tournament.status} />
        {metaLine ? <div className="text-xs text-gray-500">{metaLine}</div> : null}
        <Link to={`/tournaments/${tournament.id}`} className="w-full sm:w-auto">
          <Button variant={cta.variant ?? "outline"} size="sm" className="w-full">
            {cta.label}
          </Button>
        </Link>
      </div>
    </div>
  );
}
