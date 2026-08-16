import { Medal } from "lucide-react";
import { cn } from "@shared/lib/utils";
import type { TournamentResultRow } from "@shared/types";

const medalColors: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-gray-400",
  3: "text-amber-600",
};

export function LeaderboardTable({
  rows,
  currentUserId,
  limit,
}: {
  rows: TournamentResultRow[];
  currentUserId?: string;
  limit?: number;
}) {
  const visible = limit ? rows.slice(0, limit) : rows;
  // The backend's aggregate tournament leaderboard only carries rank/player/score --
  // per-match raw stats (Game UID, placement, kills) aren't joined in there. Only show
  // those columns when a data source actually supplies them.
  const showRawStats = visible.some((r) => r.gameUid !== undefined);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="py-2.5 pl-2">Rank</th>
            <th className="py-2.5">Player</th>
            {showRawStats ? (
              <>
                <th className="py-2.5">Game UID</th>
                <th className="py-2.5 text-center">Placement</th>
                <th className="py-2.5 text-center">Kills</th>
              </>
            ) : null}
            <th className="py-2.5 pr-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const isMe = row.userId === currentUserId;
            return (
              <tr
                key={row.userId}
                className={cn(
                  "border-b border-gray-50 last:border-0",
                  isMe && "bg-primary-50/60",
                )}
              >
                <td className="py-2.5 pl-2 font-bold text-gray-800">
                  <span className={cn("inline-flex items-center gap-1", medalColors[row.rank])}>
                    {row.rank <= 3 ? <Medal size={14} /> : null}#{row.rank}
                  </span>
                </td>
                <td className="py-2.5 font-medium text-gray-800">
                  {row.userHandle}
                  {isMe ? <span className="ml-1.5 text-xs text-primary-600">(You)</span> : null}
                </td>
                {showRawStats ? (
                  <>
                    <td className="py-2.5 text-xs text-gray-400">{row.gameUid}</td>
                    <td className="py-2.5 text-center text-gray-600">{row.placement}</td>
                    <td className="py-2.5 text-center text-gray-600">{row.kills}</td>
                  </>
                ) : null}
                <td className="py-2.5 pr-2 text-right font-bold text-gray-900">{row.totalScore}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
