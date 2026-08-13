import { useMemo, useState } from "react";
import { Lock, Pencil, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Thumb } from "@/components/ui/Thumb";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getGames } from "@/api/games";
import { getMyGameAccounts, upsertGameAccount } from "@/api/gameAccounts";
import { getMyTournaments } from "@/api/registrations";
import type { Game, GameAccount, Tournament } from "@/types";
import { formatDate } from "@/lib/utils";

// Mirrors the backend's own lock rule (game_account_service._UNLOCKED_TOURNAMENT_STATUSES):
// a game's account is locked once the player has an active registration for a tournament of
// that game that's moved past DRAFT/REGISTRATION_OPEN. This is a UI hint only -- the backend
// re-checks and is the actual source of truth (see EditAccountModal's error handling below).
const UNLOCKED_TOURNAMENT_STATUSES: Tournament["status"][] = ["DRAFT", "REGISTRATION_OPEN"];

export default function GameAccounts() {
  const { data: games, loading: loadingGames } = useAsyncData(getGames);
  const { data: accounts, loading: loadingAccounts, refetch } = useAsyncData(getMyGameAccounts);
  const { data: myTournaments } = useAsyncData(getMyTournaments);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  const accountByGame = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.gameId, a])),
    [accounts],
  );

  const lockedGameIds = useMemo(() => {
    const locked = new Set<string>();
    for (const entry of myTournaments ?? []) {
      const activeRegistration =
        entry.registration.status === "CONFIRMED" || entry.registration.status === "RESERVED";
      if (activeRegistration && !UNLOCKED_TOURNAMENT_STATUSES.includes(entry.tournament.status)) {
        locked.add(entry.tournament.gameId);
      }
    }
    return locked;
  }, [myTournaments]);

  const loading = loadingGames || loadingAccounts;

  return (
    <div>
      <Topbar
        title="Game Accounts"
        subtitle="Link the Game UID we use to match your results. Locked once registration closes."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          : (games ?? []).map((game) => (
              <GameAccountCard
                key={game.id}
                game={game}
                account={accountByGame.get(game.id)}
                locked={lockedGameIds.has(game.id)}
                onEdit={() => setEditingGame(game)}
              />
            ))}
      </div>

      {editingGame ? (
        <EditAccountModal
          game={editingGame}
          account={accountByGame.get(editingGame.id)}
          locked={lockedGameIds.has(editingGame.id)}
          onClose={() => setEditingGame(null)}
          onSaved={() => {
            setEditingGame(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function GameAccountCard({
  game,
  account,
  locked,
  onEdit,
}: {
  game: Game;
  account?: GameAccount;
  locked: boolean;
  onEdit: () => void;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <Thumb src={game.imageUrl} alt={game.name} className="h-14 w-14 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900">{game.name}</p>
        {account ? (
          <>
            <p className="truncate text-sm text-gray-600">{account.gameUsername}</p>
            <p className="text-xs text-gray-400">UID: {account.gameUid}</p>
            <div className="mt-1 flex items-center gap-2">
              {account.verifiedAt ? (
                <span className="flex items-center gap-1 text-xs font-medium text-success-600">
                  <ShieldCheck size={12} /> Verified {formatDate(account.verifiedAt)}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-warning-600">
                  <ShieldAlert size={12} /> Unverified — double check before registering
                </span>
              )}
              {locked ? (
                <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                  <Lock size={12} /> Locked
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400">No account linked yet.</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>
        {account ? <Pencil size={14} /> : <Plus size={14} />}
        {account ? "Edit" : "Add"}
      </Button>
    </Card>
  );
}

function EditAccountModal({
  game,
  account,
  locked,
  onClose,
  onSaved,
}: {
  game: Game;
  account?: GameAccount;
  locked: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [uid, setUid] = useState(account?.gameUid ?? "");
  const [username, setUsername] = useState(account?.gameUsername ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!uid.trim() || !username.trim()) {
      setError("Both fields are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertGameAccount({ gameId: game.id, gameUid: uid.trim(), gameUsername: username.trim() });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${account ? "Edit" : "Add"} ${game.name} Account`}>
      <div className="space-y-3">
        {locked ? (
          <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
            This Game UID is tied to an active tournament past registration. Changing the UID
            will be rejected — your in-game name can still be updated.
          </p>
        ) : null}
        <div>
          <label className="text-xs font-semibold text-gray-500">Game UID</label>
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">In-game name</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-600">
          Match results are linked using this UID. It will be locked once you register and
          registration closes, so make sure it's correct.
        </p>
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button className="w-full" onClick={handleSave} disabled={busy}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
