import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Badge } from "@shared/components/ui/Badge";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { ErrorState } from "@shared/components/ui/ErrorState";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { ApiError } from "@shared/api/client";
import { listMatches } from "@/api/admin/matches";
import {
  correctMatchResult,
  enterMatchResult,
  listMatchResults,
  listTournamentResults,
  publishResults,
  reviewResults,
  updateMatchResult,
} from "@/api/admin/results";
import { ScoringRuleCard } from "@/components/admin/tournament/ScoringRuleCard";
import type { Tournament } from "@shared/types";
import type { MatchResult } from "@/types/admin";

const PUBLISHED_STATUSES = ["RESULTS_PUBLISHED", "COMPLETED"];

export function AdminResultsTab({ tournament }: { tournament: Tournament }) {
  const { data: matches, loading: loadingMatches, error: matchesError } = useAsyncData(
    () => listMatches(tournament.id),
    [tournament.id],
  );
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const activeMatchId = selectedMatchId ?? matches?.[0]?.id ?? null;

  const {
    data: matchResults,
    loading: loadingResults,
    refetch: refetchResults,
  } = useAsyncData(() => (activeMatchId ? listMatchResults(activeMatchId) : Promise.resolve([])), [activeMatchId]);

  const { data: tournamentResults, refetch: refetchTournamentResults } = useAsyncData(
    () => listTournamentResults(tournament.id),
    [tournament.id],
  );

  const [reviewBusy, setReviewBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReview() {
    setReviewBusy(true);
    setError(null);
    try {
      await reviewResults(tournament.id);
      refetchTournamentResults();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not review results.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function handlePublish() {
    setReviewBusy(true);
    setError(null);
    try {
      await publishResults(tournament.id);
      refetchTournamentResults();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not publish results.");
    } finally {
      setReviewBusy(false);
    }
  }

  const isPublished = PUBLISHED_STATUSES.includes(tournament.status);
  const draftCount = (tournamentResults ?? []).filter((r) => r.status === "DRAFT").length;
  const approvedCount = (tournamentResults ?? []).filter((r) => r.status === "APPROVED").length;

  return (
    <div className="space-y-6">
      <ScoringRuleCard tournamentId={tournament.id} />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900">Calculated Results</p>
            <p className="text-xs text-gray-400">
              {(tournamentResults ?? []).length} calculated · {draftCount} draft · {approvedCount} approved
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReview} disabled={reviewBusy}>
              {reviewBusy ? <Loader2 size={13} className="animate-spin" /> : "Review Draft Results"}
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={reviewBusy}>
              Publish Results
            </Button>
          </div>
        </div>
        {error ? <p className="mt-3 text-xs font-medium text-danger-600">{error}</p> : null}
        {(tournamentResults ?? []).length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400">
                  <th className="py-2">Rank</th>
                  <th className="py-2">Score</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(tournamentResults ?? [])
                  .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                  .map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 font-semibold text-gray-800">#{r.rank ?? "—"}</td>
                      <td className="py-2 text-gray-600">{r.totalScore}</td>
                      <td className="py-2">
                        <Badge tone={r.status === "PUBLISHED" ? "success" : r.status === "APPROVED" ? "warning" : "gray"}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-400">No calculated results yet — enter or import raw match results below.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-900">Raw Match Results</p>
          {matches && matches.length > 0 ? (
            <select
              value={activeMatchId ?? ""}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary-400"
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  Match {m.matchNumber}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {matchesError ? (
          <div className="mt-4">
            <ErrorState message="Couldn't load matches." />
          </div>
        ) : loadingMatches ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : !matches || matches.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">Add a match first (Matches tab) before entering results.</p>
        ) : (
          <div className="mt-4 space-y-5">
            <ManualEntryForm matchId={activeMatchId!} onEntered={refetchResults} />
            <MatchResultsTable
              results={matchResults ?? []}
              loading={loadingResults}
              isPublished={isPublished}
              onSaved={refetchResults}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function ManualEntryForm({ matchId, onEntered }: { matchId: string; onEntered: () => void }) {
  const [gameUid, setGameUid] = useState("");
  const [placement, setPlacement] = useState("");
  const [kills, setKills] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!gameUid.trim()) {
      setError("Game UID is required.");
      return;
    }
    if (placement && Number(placement) < 1) {
      setError("Placement must be 1 or greater.");
      return;
    }
    if (kills && Number(kills) < 0) {
      setError("Kills cannot be negative.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await enterMatchResult(matchId, {
        gameUid: gameUid.trim(),
        placement: placement ? Number(placement) : undefined,
        kills: kills ? Number(kills) : undefined,
      });
      setGameUid("");
      setPlacement("");
      setKills("");
      onEntered();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not enter result.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-500">Manual Entry</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <input
          value={gameUid}
          onChange={(e) => setGameUid(e.target.value)}
          placeholder="Game UID"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
        />
        <input
          type="number"
          min={1}
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
          placeholder="Placement"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
        />
        <input
          type="number"
          min={0}
          value={kills}
          onChange={(e) => setKills(e.target.value)}
          placeholder="Kills"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
        />
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-danger-600">{error}</p> : null}
      <Button size="sm" variant="secondary" className="mt-2" onClick={handleSubmit} disabled={busy}>
        Add Result
      </Button>
    </div>
  );
}

function MatchResultsTable({
  results,
  loading,
  isPublished,
  onSaved,
}: {
  results: MatchResult[];
  loading: boolean;
  isPublished: boolean;
  onSaved: () => void;
}) {
  if (loading) return <Skeleton className="h-20 w-full" />;
  if (results.length === 0) return <p className="text-sm text-gray-400">No results entered for this match yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400">
            <th className="py-2">Game UID</th>
            <th className="py-2">Placement</th>
            <th className="py-2">Kills</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <ResultRow key={r.id} result={r} isPublished={isPublished} onSaved={onSaved} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({
  result,
  isPublished,
  onSaved,
}: {
  result: MatchResult;
  isPublished: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [placement, setPlacement] = useState(String(result.placement ?? ""));
  const [kills, setKills] = useState(String(result.kills ?? ""));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (placement && Number(placement) < 1) {
      setError("Placement must be 1 or greater.");
      return;
    }
    if (kills && Number(kills) < 0) {
      setError("Kills cannot be negative.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isPublished) {
        if (!reason.trim()) {
          setError("A reason is required to correct a published result.");
          setBusy(false);
          return;
        }
        await correctMatchResult(result.id, {
          placement: placement ? Number(placement) : undefined,
          kills: kills ? Number(kills) : undefined,
          reason: reason.trim(),
        });
      } else {
        await updateMatchResult(result.id, {
          placement: placement ? Number(placement) : undefined,
          kills: kills ? Number(kills) : undefined,
        });
      }
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-gray-50 bg-app-bg/40 last:border-0">
        <td className="py-2" colSpan={5}>
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-xs text-gray-500">{result.gameUid}</span>
            <input
              type="number"
              min={1}
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              placeholder="Placement"
              className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-400"
            />
            <input
              type="number"
              min={0}
              value={kills}
              onChange={(e) => setKills(e.target.value)}
              placeholder="Kills"
              className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-400"
            />
            {isPublished ? (
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for correction"
                className="min-w-[160px] flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-400"
              />
            ) : null}
            <Button size="sm" onClick={handleSave} disabled={busy}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {error ? <p className="mt-1 text-xs font-medium text-danger-600">{error}</p> : null}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 text-gray-700">{result.gameUid}</td>
      <td className="py-2 text-gray-600">{result.placement ?? "—"}</td>
      <td className="py-2 text-gray-600">{result.kills ?? "—"}</td>
      <td className="py-2">
        <Badge tone={result.status === "VALIDATED" ? "success" : result.status === "EXCLUDED" ? "danger" : "gray"}>
          {result.status}
        </Badge>
      </td>
      <td className="py-2 text-right">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {isPublished ? "Correct" : "Edit"}
        </Button>
      </td>
    </tr>
  );
}
