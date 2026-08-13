import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Thumb } from "@/components/ui/Thumb";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listGames, createGame, updateGame, deleteGame, type GameInput } from "@/api/admin/games";
import { ApiError } from "@/api/client";
import type { Game } from "@/types";

export default function AdminGames() {
  const { data: games, loading, refetch } = useAsyncData(listGames);
  const [editingGame, setEditingGame] = useState<Game | "new" | null>(null);
  const [deletingGame, setDeletingGame] = useState<Game | null>(null);

  return (
    <div>
      <Topbar title="Games" subtitle="Manage the games available on the platform." />

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditingGame("new")}>
          <Plus size={15} /> Add Game
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          : (games ?? []).map((game) => (
              <Card key={game.id} className="flex items-center gap-4 p-4">
                <Thumb src={game.imageUrl} alt={game.name} className="h-14 w-14 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">{game.name}</p>
                  <p className="truncate text-xs text-gray-400">{game.description}</p>
                  <p className="mt-1 text-xs font-medium text-gray-400">
                    {game.gameType} • {game.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setEditingGame(game)}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeletingGame(game)}>
                    <Trash2 size={13} className="text-danger-500" />
                  </Button>
                </div>
              </Card>
            ))}
      </div>

      {editingGame ? (
        <EditGameModal
          game={editingGame === "new" ? null : editingGame}
          onClose={() => setEditingGame(null)}
          onSaved={() => {
            setEditingGame(null);
            refetch();
          }}
        />
      ) : null}

      {deletingGame ? (
        <DeleteGameModal
          game={deletingGame}
          onClose={() => setDeletingGame(null)}
          onDeleted={() => {
            setDeletingGame(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function EditGameModal({
  game,
  onClose,
  onSaved,
}: {
  game: Game | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(game?.name ?? "");
  const [description, setDescription] = useState(game?.description ?? "");
  const [imageUrl, setImageUrl] = useState(game?.imageUrl ?? "");
  const [gameType, setGameType] = useState<string>(game?.gameType ?? "BATTLE_ROYALE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: GameInput = { name: name.trim(), description, imageUrl, gameType };
    try {
      if (game) await updateGame(game.id, input);
      else await createGame(input);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={game ? `Edit ${game.name}` : "Add Game"}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
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
        <div>
          <label className="text-xs font-semibold text-gray-500">Image URL</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Game Type</label>
          <select
            value={gameType}
            onChange={(e) => setGameType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          >
            <option value="BATTLE_ROYALE">Battle Royale</option>
            <option value="STRATEGY">Strategy</option>
            <option value="RACING">Racing</option>
            <option value="SHOOTER">Shooter</option>
          </select>
        </div>
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button className="w-full" onClick={handleSave} disabled={busy}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

function DeleteGameModal({
  game,
  onClose,
  onDeleted,
}: {
  game: Game;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteGame(game.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Delete ${game.name}?`}>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          This can't be undone. Games with existing tournaments can't be deleted.
        </p>
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
