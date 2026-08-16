import { useState } from "react";
import { Gift, Plus } from "lucide-react";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { ErrorState } from "@shared/components/ui/ErrorState";
import { PrizeStatusBadge, Badge } from "@shared/components/ui/Badge";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { ApiError } from "@shared/api/client";
import { createPrize, listPrizes, markPrizePaid } from "@/api/admin/prizes";
import { listParticipants } from "@/api/admin/registrations";
import { listRefunds, processRefund } from "@/api/admin/refunds";
import { formatCurrency, formatDate } from "@shared/lib/utils";
import type { Tournament } from "@shared/types";

const PUBLISHED_STATUSES = ["RESULTS_PUBLISHED", "COMPLETED"];

export function AdminPrizesTab({ tournament }: { tournament: Tournament }) {
  const {
    data: prizes,
    loading: loadingPrizes,
    error: prizesError,
    refetch: refetchPrizes,
  } = useAsyncData(() => listPrizes(tournament.id, tournament.name), [tournament.id, tournament.name]);
  const { data: participants } = useAsyncData(() => listParticipants(tournament.id), [tournament.id]);
  const { data: refunds, loading: loadingRefunds, error: refundsError, refetch: refetchRefunds } = useAsyncData(
    () => listRefunds(tournament.id),
    [tournament.id],
  );

  const [creating, setCreating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [processingRefundId, setProcessingRefundId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkPaid(prizeId: string) {
    setPayingId(prizeId);
    setError(null);
    try {
      await markPrizePaid(prizeId, tournament.name);
      refetchPrizes();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not mark prize paid.");
    } finally {
      setPayingId(null);
    }
  }

  const canAllocate = PUBLISHED_STATUSES.includes(tournament.status);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">Prizes</p>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            disabled={!canAllocate}
            title={canAllocate ? undefined : "Results must be published before allocating prizes."}
          >
            <Plus size={13} /> Allocate Prize
          </Button>
        </div>
        {!canAllocate ? (
          <p className="mt-2 text-xs text-warning-600">Prize allocation is only available once results are published.</p>
        ) : null}
        {error ? <p className="mt-2 text-xs font-medium text-danger-600">{error}</p> : null}

        <div className="mt-4">
          {prizesError ? (
            <ErrorState message="Couldn't load prizes." onRetry={refetchPrizes} />
          ) : loadingPrizes ? (
            <Skeleton className="h-20 w-full" />
          ) : (prizes ?? []).length === 0 ? (
            <EmptyState icon={Gift} title="No prizes allocated yet" />
          ) : (
            <div className="space-y-2">
              {(prizes ?? [])
                .sort((a, b) => a.rank - b.rank)
                .map((prize) => (
                  <div
                    key={prize.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Rank #{prize.rank} — {formatCurrency(prize.amount)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Player {prize.userId.slice(-6)} · {formatDate(prize.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PrizeStatusBadge status={prize.status} />
                      {prize.status === "PENDING" ? (
                        <Button size="sm" disabled={payingId === prize.id} onClick={() => handleMarkPaid(prize.id)}>
                          Mark Paid
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-bold text-gray-900">Refunds</p>
        <div className="mt-4">
          {refundsError ? (
            <ErrorState message="Couldn't load refunds." onRetry={refetchRefunds} />
          ) : loadingRefunds ? (
            <Skeleton className="h-20 w-full" />
          ) : (refunds ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No refunds for this tournament.</p>
          ) : (
            <div className="space-y-2">
              {(refunds ?? []).map((refund) => (
                <div
                  key={refund.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{formatCurrency(refund.amount)}</p>
                    <p className="text-xs text-gray-400">{refund.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={refund.status === "PROCESSED" ? "success" : refund.status === "FAILED" ? "danger" : "warning"}>
                      {refund.status}
                    </Badge>
                    {refund.status === "PENDING" ? (
                      <Button size="sm" onClick={() => setProcessingRefundId(refund.id)}>
                        Process
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {creating ? (
        <AllocatePrizeModal
          tournament={tournament}
          participants={participants ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refetchPrizes();
          }}
        />
      ) : null}

      {processingRefundId ? (
        <ProcessRefundModal
          refundId={processingRefundId}
          onClose={() => setProcessingRefundId(null)}
          onProcessed={() => {
            setProcessingRefundId(null);
            refetchRefunds();
          }}
        />
      ) : null}
    </div>
  );
}

function AllocatePrizeModal({
  tournament,
  participants,
  onClose,
  onCreated,
}: {
  tournament: Tournament;
  participants: { userId: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [userId, setUserId] = useState(participants[0]?.userId ?? "");
  const [rank, setRank] = useState("1");
  const [amount, setAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!userId) {
      setError("Select a player.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPrize(tournament.id, tournament.name, { userId, rank: Number(rank), amount: Number(amount) });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not allocate prize.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Allocate Prize">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500">Player</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          >
            {participants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-500">Rank</label>
            <input
              type="number"
              min={1}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Amount (₹)</label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>
        </div>
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button className="w-full" onClick={handleCreate} disabled={busy}>
          Allocate
        </Button>
      </div>
    </Modal>
  );
}

function ProcessRefundModal({
  refundId,
  onClose,
  onProcessed,
}: {
  refundId: string;
  onClose: () => void;
  onProcessed: () => void;
}) {
  const [providerReference, setProviderReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleProcess() {
    if (!providerReference.trim()) {
      setError("A provider reference is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await processRefund(refundId, providerReference.trim());
      onProcessed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not process refund.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Process Refund">
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          This records the refund as processed manually. No automated transfer happens.
        </p>
        <input
          value={providerReference}
          onChange={(e) => setProviderReference(e.target.value)}
          placeholder="Razorpay refund reference"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
        />
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <Button className="w-full" onClick={handleProcess} disabled={busy}>
          Confirm Processed
        </Button>
      </div>
    </Modal>
  );
}
