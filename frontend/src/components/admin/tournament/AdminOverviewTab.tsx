import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/api/client";
import {
  cancelTournament,
  closeRegistration,
  endTournament,
  markCompleted,
  markReady,
  openRegistration,
  startTournament,
  updateTournament,
} from "@/api/admin/tournaments";
import type { Game, Tournament, TournamentStatus } from "@/types";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const NEXT_ACTIONS: Partial<Record<TournamentStatus, { label: string; action: (id: string) => Promise<Tournament> }[]>> = {
  DRAFT: [{ label: "Open Registration", action: openRegistration }],
  REGISTRATION_OPEN: [{ label: "Close Registration", action: closeRegistration }],
  REGISTRATION_CLOSED: [{ label: "Mark Ready", action: markReady }],
  READY: [{ label: "Start Tournament", action: startTournament }],
  LIVE: [{ label: "End Tournament", action: endTournament }],
  RESULTS_PUBLISHED: [{ label: "Mark Completed", action: markCompleted }],
};

const CANCELLABLE_STATUSES: TournamentStatus[] = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "READY",
  "LIVE",
  "RESULTS_PENDING",
  "RESULTS_REVIEW",
];

export function AdminOverviewTab({
  tournament,
  games,
  onChanged,
}: {
  tournament: Tournament;
  games: Game[];
  onChanged: () => void;
}) {
  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description);
  const [gameId, setGameId] = useState(tournament.gameId);
  const [entryFee, setEntryFee] = useState(String(tournament.fee));
  const [firstPrize, setFirstPrize] = useState(String(tournament.firstPrize ?? 0));
  const [secondPrize, setSecondPrize] = useState(String(tournament.secondPrize ?? 0));
  const prizePool = (Number(firstPrize) || 0) + (Number(secondPrize) || 0);
  const [maxPlayers, setMaxPlayers] = useState(String(tournament.maxPlayers));
  const [startTime, setStartTime] = useState(toLocalInput(tournament.startsAt));
  const [registrationDeadline, setRegistrationDeadline] = useState(toLocalInput(tournament.registrationClosesAt));
  const [gameUrl, setGameUrl] = useState(tournament.gameUrl ?? "");
  const [rules, setRules] = useState(tournament.rules.join("\n"));
  const [instructions, setInstructions] = useState(tournament.scoringSummary);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (Number(entryFee) < 0 || Number(maxPlayers) < 1) {
      setError("Entry fee must be 0 or greater, and max players must be at least 1.");
      return;
    }
    if (new Date(registrationDeadline) >= new Date(startTime)) {
      setError("Registration deadline must be before the start time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateTournament(tournament.id, {
        gameId,
        name,
        description,
        entryFee: Number(entryFee),
        prizePool,
        firstPrize: Number(firstPrize) || 0,
        secondPrize: Number(secondPrize) || 0,
        maxPlayers: Number(maxPlayers),
        startTime: new Date(startTime).toISOString(),
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        gameUrl: gameUrl.trim(),
        rules,
        instructions,
      });
      setSaved(true);
      onChanged();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: (id: string) => Promise<Tournament>) {
    setActionBusy(true);
    setError(null);
    try {
      await action(tournament.id);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  const nextActions = NEXT_ACTIONS[tournament.status] ?? [];
  const canCancel = CANCELLABLE_STATUSES.includes(tournament.status);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <form onSubmit={handleSave} className="space-y-4">
        <p className="text-sm font-bold text-gray-900">Tournament Details</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-500">Game</label>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Entry Fee (₹)</label>
            <input
              type="number"
              min={0}
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Max Players</label>
            <input
              type="number"
              min={1}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">1st Prize (₹)</label>
            <input
              type="number"
              min={0}
              value={firstPrize}
              onChange={(e) => setFirstPrize(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">2nd Prize (₹)</label>
            <input
              type="number"
              min={0}
              value={secondPrize}
              onChange={(e) => setSecondPrize(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        </div>
        <p className="text-right text-xs font-semibold text-gray-500">
          Prize Pool: ₹{prizePool.toLocaleString("en-IN")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Registration Deadline</label>
            <input
              required
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Start Time</label>
            <input
              required
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Website Link</label>
          <input
            type="url"
            value={gameUrl}
            onChange={(e) => setGameUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Rules (one per line)</label>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : saved ? "Saved" : "Save Changes"}
        </Button>
        </form>
      </Card>

      <Card className="h-fit space-y-3 p-5">
        <p className="text-sm font-bold text-gray-900">Lifecycle</p>
        <p className="text-xs text-gray-400">
          Current status: <span className="font-semibold text-gray-600">{tournament.status}</span>
        </p>
        {tournament.gameUrl ? (
          <a href={tournament.gameUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full gap-2">
              Visit Website <ExternalLink size={14} />
            </Button>
          </a>
        ) : null}
        <div className="space-y-2">
          {nextActions.map((a) => (
            <Button
              key={a.label}
              className="w-full"
              disabled={actionBusy}
              onClick={() => handleAction(a.action)}
            >
              {a.label}
            </Button>
          ))}
          {canCancel ? (
            <Button variant="danger" className="w-full" disabled={actionBusy} onClick={() => setCancelling(true)}>
              Cancel Tournament
            </Button>
          ) : null}
          {nextActions.length === 0 && !canCancel ? (
            <p className="text-xs text-gray-400">No further transitions from this status.</p>
          ) : null}
        </div>
        {tournament.status === "CANCELLED" && tournament.cancellationReason ? (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">
            Cancelled: {tournament.cancellationReason}
          </p>
        ) : null}
      </Card>

      {cancelling ? (
        <CancelModal
          tournamentId={tournament.id}
          onClose={() => setCancelling(false)}
          onCancelled={() => {
            setCancelling(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function CancelModal({
  tournamentId,
  onClose,
  onCancelled,
}: {
  tournamentId: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    if (!reason.trim()) {
      setError("A reason is required to cancel a tournament.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await cancelTournament(tournamentId, reason.trim());
      onCancelled();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not cancel tournament.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Cancel Tournament">
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Confirmed paid registrations will enter the refund workflow. This cannot be undone.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for cancellation"
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
        />
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Back
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleCancel} disabled={busy}>
            Confirm Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
