// The backend tracks no "performance analytics" resource at all (no monthly trend, no
// aggregate win-rate/current-rank endpoint) -- these are honest client-side derivations from
// the same published-results feed the Dashboard's "Recent Results" panel already fetches
// (GET /api/users/me/leaderboard-history via api/results.ts's getRecentResults), not
// backend-tracked figures. Callers already have that list in hand; no extra request needed.
import type { RecentResult } from "@/api/results";
import type { PerformancePoint } from "@shared/types";

export interface PerformanceStats {
  matchesPlayed: number;
  wins: number;
  winRate: number;
  avgPlacement: number;
}

export function computePerformanceStats(results: RecentResult[]): PerformanceStats {
  const matchesPlayed = results.length;
  const wins = results.filter((r) => r.rank === 1).length;
  const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0;
  const avgPlacement =
    matchesPlayed > 0
      ? Math.round((results.reduce((sum, r) => sum + r.rank, 0) / matchesPlayed) * 10) / 10
      : 0;
  return { matchesPlayed, wins, winRate, avgPlacement };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// One point per calendar month that has at least one published result, in chronological
// order, averaging the score when a month has more than one. Not a full 12-month calendar --
// there's no data to fill in the gaps with.
export function computePerformanceHistory(results: RecentResult[]): PerformancePoint[] {
  const byMonth = new Map<string, { label: string; total: number; count: number; sortKey: number }>();
  for (const r of results) {
    const date = new Date(r.publishedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const existing = byMonth.get(key);
    if (existing) {
      existing.total += r.score;
      existing.count += 1;
    } else {
      byMonth.set(key, {
        label: MONTH_LABELS[date.getMonth()],
        total: r.score,
        count: 1,
        sortKey: date.getFullYear() * 12 + date.getMonth(),
      });
    }
  }
  return Array.from(byMonth.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((m) => ({ month: m.label, score: Math.round(m.total / m.count) }));
}

export interface DashboardStats {
  currentRank: number | null;
  rankTournamentsCount: number;
}

export function computeDashboardStats(results: RecentResult[]): DashboardStats {
  if (results.length === 0) return { currentRank: null, rankTournamentsCount: 0 };
  const mostRecent = [...results].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )[0];
  return { currentRank: mostRecent.rank, rankTournamentsCount: results.length };
}
