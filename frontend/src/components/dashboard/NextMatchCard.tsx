import { Link } from "react-router-dom";
import type { Game, Match, Tournament } from "@shared/types";
import { useCountdown } from "@/hooks/useCountdown";
import { Button } from "@shared/components/ui/Button";
import { pad2 } from "@shared/lib/utils";
import { Card } from "@shared/components/ui/Card";
import { Thumb } from "@shared/components/ui/Thumb";

export function NextMatchCard({
  tournament,
  game,
  match,
}: {
  tournament: Tournament;
  game: Game;
  match: Match;
}) {
  const countdown = useCountdown(match.joinWindowClosesAt);

  return (
    <Card className="p-5">
      <p className="text-sm font-bold text-gray-900">Next Match</p>

      <div className="mt-3 flex items-center gap-3">
        <Thumb src={tournament.imageUrl} alt={tournament.name} className="h-14 w-14 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900">{tournament.name}</p>
          <p className="text-xs text-gray-400">
            Match {match.matchNumber} • {game.name}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-gray-400">
        {countdown.expired ? "Join window closed" : "Join window closes in"}
      </p>

      {!countdown.expired ? (
        <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "HR", value: countdown.hours + countdown.days * 24 },
            { label: "MIN", value: countdown.minutes },
            { label: "SEC", value: countdown.seconds },
          ].map((unit) => (
            <div key={unit.label} className="rounded-xl bg-app-bg py-2">
              <p className="text-lg font-extrabold tabular-nums text-gray-900">
                {pad2(unit.value)}
              </p>
              <p className="text-[10px] font-semibold text-gray-400">{unit.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Link to={`/tournaments/${tournament.id}`} className="mt-4 block">
        <Button className="w-full">Go to Match Room</Button>
      </Link>
    </Card>
  );
}
