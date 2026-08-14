import { Link } from "react-router-dom";
import type { RecentResult } from "@/api/results";
import { Card } from "@/components/ui/Card";
import { Thumb } from "@/components/ui/Thumb";

export function RecentResultsList({ results }: { results: RecentResult[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Recent Results</p>
        <Link to="/leaderboards" className="text-xs font-semibold text-primary-600 hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-3 space-y-1">
        {results.map((r) => (
          <Link
            key={r.tournamentId}
            to={`/leaderboards/${r.tournamentId}`}
            className="flex items-center gap-3 rounded-xl p-2 hover:bg-app-bg"
          >
            <Thumb
              src={r.imageUrl}
              alt={r.tournamentName}
              className="h-10 w-10 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">{r.tournamentName}</p>
              <p className="text-xs text-gray-400">
                #{r.rank}/{r.totalPlayers}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold text-success-600">{r.score} Pts</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
