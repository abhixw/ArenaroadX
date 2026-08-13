import { useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsyncData } from "@/hooks/useAsyncData";
import { ApiError } from "@/api/client";
import { listMatches } from "@/api/admin/matches";
import {
  commitResultImport,
  correctMatchResult,
  enterMatchResult,
  getCsvTemplateUrl,
  listMatchResults,
  listTournamentResults,
  publishResults,
  reviewResults,
  updateMatchResult,
  uploadResultImport,
  validateResultImport,
} from "@/api/admin/results";
import { ScoringRuleCard } from "@/components/admin/tournament/ScoringRuleCard";
import type { Tournament } from "@/types";
import type { MatchResult, ResultImport } from "@/types/admin";

const PUBLISHED_STATUSES = ["RESULTS_PUBLISHED", "COMPLETED"];

export function AdminResultsTab({ tournament }: { tournament: Tournament }) {
  const { data: matches, loading: loadingMatches } = useAsyncData(
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

        {loadingMatches ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : !matches || matches.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">Add a match first (Matches tab) before entering results.</p>
        ) : (
          <div className="mt-4 space-y-5">
            <ManualEntryForm matchId={activeMatchId!} onEntered={refetchResults} />
            <CsvImportPanel matchId={activeMatchId!} onCommitted={refetchResults} />
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
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
          placeholder="Placement"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
        />
        <input
          type="number"
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

function CsvImportPanel({ matchId, onCommitted }: { matchId: string; onCommitted: () => void }) {
  const [resultImport, setResultImport] = useState<ResultImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const templateUrl = useMemo(() => getCsvTemplateUrl(), []);

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const imported = await uploadResultImport(matchId, file);
      setResultImport(imported);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    if (!resultImport) return;
    setBusy(true);
    setError(null);
    try {
      setResultImport(await validateResultImport(resultImport.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Validation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!resultImport) return;
    setBusy(true);
    setError(null);
    try {
      setResultImport(await commitResultImport(resultImport.id));
      onCommitted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Commit failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">CSV Import</p>
        <a
          href={templateUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-primary-600 hover:underline"
        >
          Download template
        </a>
      </div>
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-app-bg">
        <Upload size={14} />
        {resultImport ? resultImport.filename : "Choose CSV file"}
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </label>
      {error ? <p className="mt-2 text-xs font-medium text-danger-600">{error}</p> : null}
      {resultImport ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="success">{resultImport.validCount} valid</Badge>
            <Badge tone="danger">{resultImport.invalidCount} invalid</Badge>
            <Badge tone="warning">{resultImport.duplicateCount} duplicate</Badge>
            <Badge tone="gray">{resultImport.unknownCount} unknown</Badge>
            <Badge tone="primary">{resultImport.status}</Badge>
          </div>
          {resultImport.rows.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-app-bg/60 text-left text-gray-400">
                    <th className="px-2 py-1.5">Row</th>
                    <th className="px-2 py-1.5">Game UID</th>
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {resultImport.rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-gray-50">
                      <td className="px-2 py-1.5">{r.rowNumber}</td>
                      <td className="px-2 py-1.5">{r.gameUid ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.rowStatus}</td>
                      <td className="px-2 py-1.5 text-gray-400">{r.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="flex gap-2">
            {resultImport.status === "UPLOADED" ? (
              <Button size="sm" onClick={handleValidate} disabled={busy}>
                Validate
              </Button>
            ) : null}
            {resultImport.status === "VALIDATED" ? (
              <Button size="sm" onClick={handleCommit} disabled={busy}>
                Commit Valid Rows
              </Button>
            ) : null}
            {resultImport.status === "COMMITTED" ? (
              <Badge tone="success">Committed</Badge>
            ) : null}
          </div>
        </div>
      ) : null}
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
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              placeholder="Placement"
              className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-400"
            />
            <input
              type="number"
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
