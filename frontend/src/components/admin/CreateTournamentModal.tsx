import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/api/client";
import { createTournament } from "@/api/admin/tournaments";
import type { Game } from "@/types";

export function CreateTournamentModal({
  games,
  onClose,
  onCreated,
}: {
  games: Game[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("0");
  const [prizePool, setPrizePool] = useState("0");
  const [maxPlayers, setMaxPlayers] = useState("100");
  const [startTime, setStartTime] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [rules, setRules] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!gameId || !name.trim() || !startTime || !registrationDeadline) {
      setError("Game, name, start time, and registration deadline are all required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTournament({
        gameId,
        name: name.trim(),
        entryFee: Number(entryFee),
        prizePool: Number(prizePool),
        maxPlayers: Number(maxPlayers),
        startTime: new Date(startTime).toISOString(),
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        rules,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create tournament.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Create Tournament" widthClassName="max-w-lg">
      <div className="space-y-3">
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
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
            <label className="text-xs font-semibold text-gray-500">Prize Pool (₹)</label>
            <input
              type="number"
              min={0}
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-500">Registration Deadline</label>
            <input
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
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
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button className="w-full" onClick={handleCreate} disabled={busy}>
          Create Tournament
        </Button>
      </div>
    </Modal>
  );
}
