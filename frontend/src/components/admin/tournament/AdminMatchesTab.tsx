import { useState } from "react";
import { CalendarDays, Loader2, Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsyncData } from "@/hooks/useAsyncData";
import { ApiError } from "@/api/client";
import {
  cancelMatch,
  createMatch,
  endMatch,
  listMatches,
  startMatch,
  updateMatch,
  type MatchInput,
} from "@/api/admin/matches";
import { formatDateTime } from "@/lib/utils";
import type { Match, Tournament } from "@/types";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_TONE: Record<Match["status"], "success" | "warning" | "gray" | "danger"> = {
  SCHEDULED: "warning",
  JOIN_OPEN: "warning",
  LIVE: "success",
  ENDED: "gray",
  CANCELLED: "danger",
};

export function AdminMatchesTab({ tournament }: { tournament: Tournament }) {
  const { data: matches, loading, refetch } = useAsyncData(() => listMatches(tournament.id), [tournament.id]);
  const [creating, setCreating] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTransition(matchId: string, action: (id: string) => Promise<Match>) {
    setActionBusyId(matchId);
    setError(null);
    try {
      await action(matchId);
      refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That action failed.");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Matches</p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> Add Match
        </Button>
      </div>

      {error ? <p className="mt-3 text-xs font-medium text-danger-600">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (matches ?? []).length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No matches yet"
            description="Add a match once you're ready to configure room access for confirmed participants."
          />
        ) : (
          (matches ?? [])
            .sort((a, b) => a.matchNumber - b.matchNumber)
            .map((m) => (
              <div key={m.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Match {m.matchNumber}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(m.scheduledAt)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
                  <span>Opens: {formatDateTime(m.joinWindowOpensAt)}</span>
                  <span>Closes: {formatDateTime(m.joinWindowClosesAt)}</span>
                  <span>Room: {m.roomId || "—"}</span>
                  <span>Password: {m.roomPassword || "—"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingMatch(m)}>
                    <Pencil size={12} /> Edit
                  </Button>
                  {m.status === "SCHEDULED" || m.status === "JOIN_OPEN" ? (
                    <Button
                      size="sm"
                      disabled={actionBusyId === m.id}
                      onClick={() => handleTransition(m.id, startMatch)}
                    >
                      {actionBusyId === m.id ? <Loader2 size={12} className="animate-spin" /> : "Start"}
                    </Button>
                  ) : null}
                  {m.status === "LIVE" ? (
                    <Button
                      size="sm"
                      disabled={actionBusyId === m.id}
                      onClick={() => handleTransition(m.id, endMatch)}
                    >
                      {actionBusyId === m.id ? <Loader2 size={12} className="animate-spin" /> : "End"}
                    </Button>
                  ) : null}
                  {m.status !== "ENDED" && m.status !== "CANCELLED" ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={actionBusyId === m.id}
                      onClick={() => handleTransition(m.id, cancelMatch)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
        )}
      </div>

      {creating ? (
        <MatchModal
          tournamentId={tournament.id}
          nextMatchNumber={(matches?.length ?? 0) + 1}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refetch();
          }}
        />
      ) : null}

      {editingMatch ? (
        <MatchModal
          tournamentId={tournament.id}
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onSaved={() => {
            setEditingMatch(null);
            refetch();
          }}
        />
      ) : null}
    </Card>
  );
}

function MatchModal({
  tournamentId,
  match,
  nextMatchNumber,
  onClose,
  onSaved,
}: {
  tournamentId: string;
  match?: Match;
  nextMatchNumber?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [matchNumber, setMatchNumber] = useState(String(match?.matchNumber ?? nextMatchNumber ?? 1));
  const [scheduledTime, setScheduledTime] = useState(match ? toLocalInput(match.scheduledAt) : "");
  const [joinOpens, setJoinOpens] = useState(match ? toLocalInput(match.joinWindowOpensAt) : "");
  const [joinCloses, setJoinCloses] = useState(match ? toLocalInput(match.joinWindowClosesAt) : "");
  const [roomId, setRoomId] = useState(match?.roomId ?? "");
  const [roomPassword, setRoomPassword] = useState(match?.roomPassword ?? "");
  const [accessInfo, setAccessInfo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!scheduledTime || !joinOpens || !joinCloses) {
      setError("Scheduled time and join window are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: Partial<MatchInput> = {
      scheduledTime: new Date(scheduledTime).toISOString(),
      joinWindowOpensAt: new Date(joinOpens).toISOString(),
      joinWindowClosesAt: new Date(joinCloses).toISOString(),
      roomId,
      roomPassword,
      accessInfo,
    };
    try {
      if (match) {
        await updateMatch(match.id, input);
      } else {
        await createMatch(tournamentId, { ...(input as MatchInput), matchNumber: Number(matchNumber) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={match ? `Edit Match ${match.matchNumber}` : "Add Match"}>
      <div className="space-y-3">
        {!match ? (
          <div>
            <label className="text-xs font-semibold text-gray-500">Match Number</label>
            <input
              type="number"
              min={1}
              value={matchNumber}
              onChange={(e) => setMatchNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        ) : null}
        <div>
          <label className="text-xs font-semibold text-gray-500">Scheduled Time</label>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-500">Join Window Opens</label>
            <input
              type="datetime-local"
              value={joinOpens}
              onChange={(e) => setJoinOpens(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Join Window Closes</label>
            <input
              type="datetime-local"
              value={joinCloses}
              onChange={(e) => setJoinCloses(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-500">Room ID</label>
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Room Password</label>
            <input
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Access Info</label>
          <input
            value={accessInfo}
            onChange={(e) => setAccessInfo(e.target.value)}
            placeholder="e.g. Join 15 minutes before start."
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button className="w-full" onClick={handleSave} disabled={busy}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
