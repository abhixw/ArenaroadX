import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformancePoint } from "@shared/types";
import { Card } from "@shared/components/ui/Card";

interface PerformanceStats {
  matchesPlayed: number;
  wins: number;
  winRate: number;
  avgPlacement: number;
}

export function PerformanceChart({
  data,
  stats,
}: {
  data: PerformancePoint[];
  stats: PerformanceStats;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Your Performance</p>
        <span className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
          This Month
        </span>
      </div>

      <div className="mt-2 h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="performanceStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c5cff" />
                <stop offset="100%" stopColor="#6c4cec" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #f1f1f4",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="url(#performanceStroke)"
              strokeWidth={3}
              dot={{ r: 3, fill: "#7c5cff", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
        <StatRow label="Matches Played" value={stats.matchesPlayed} />
        <StatRow label="Wins" value={stats.wins} />
        <StatRow label="Win Rate" value={`${stats.winRate}%`} />
        <StatRow label="Avg. Placement" value={stats.avgPlacement} />
      </div>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}
