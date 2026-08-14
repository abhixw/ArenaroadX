import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/api/client";
import { createTournament } from "@/api/admin/tournaments";
import { updateGame } from "@/api/admin/games";
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
  const [imageUrl, setImageUrl] = useState(games[0]?.imageUrl ?? "");
  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("0");
  const [firstPrize, setFirstPrize] = useState("0");
  const [secondPrize, setSecondPrize] = useState("0");
  const [maxPlayers, setMaxPlayers] = useState("100");
  const [startTime, setStartTime] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [gameUrl, setGameUrl] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const prizePool = (Number(firstPrize) || 0) + (Number(secondPrize) || 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleGameChange(newGameId: string) {
    setGameId(newGameId);
    setImageUrl(games.find((g) => g.id === newGameId)?.imageUrl ?? "");
  }

  async function handleCreate() {
    if (!gameId || !name.trim() || !startTime || !registrationDeadline) {
      setError("Game, name, start time, and registration deadline are all required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const selectedGame = games.find((g) => g.id === gameId);
      if (selectedGame && imageUrl.trim() !== (selectedGame.imageUrl ?? "")) {
        await updateGame(gameId, { imageUrl: imageUrl.trim() });
      }
      await createTournament({
        gameId,
        name: name.trim(),
        entryFee: Number(entryFee),
        prizePool,
        firstPrize: Number(firstPrize) || 0,
        secondPrize: Number(secondPrize) || 0,
        maxPlayers: Number(maxPlayers),
        startTime: new Date(startTime).toISOString(),
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        gameUrl: gameUrl.trim() || undefined,
        description: description.trim() || undefined,
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
            onChange={(e) => handleGameChange(e.target.value)}
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
          <label className="text-xs font-semibold text-gray-500">Logo (Image URL)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <p className="mt-1 text-[11px] text-gray-400">Sets the logo for this game — shown on every tournament card.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
        <div className="grid grid-cols-2 gap-2">
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
          <label className="text-xs font-semibold text-gray-500">Description / Instructions</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
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
        <p className="text-right text-sm font-semibold text-gray-700">
          Prize Pool: ₹{prizePool.toLocaleString("en-IN")}
        </p>
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button className="w-full" onClick={handleCreate} disabled={busy}>
          Create Tournament
        </Button>
      </div>
    </Modal>
  );
}
