import { useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Card } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { ErrorState } from "@shared/components/ui/ErrorState";
import { PaymentStatusBadge, RegistrationStatusBadge } from "@shared/components/ui/Badge";
import { useAsyncData } from "@shared/hooks/useAsyncData";
import { ApiError } from "@shared/api/client";
import { disqualifyRegistration, listParticipants } from "@/api/admin/registrations";
import type { Participant } from "@/types/admin";
import type { Tournament } from "@shared/types";

export function AdminParticipantsTab({ tournament }: { tournament: Tournament }) {
  const { data: participants, loading, error, refetch } = useAsyncData(
    () => listParticipants(tournament.id),
    [tournament.id],
  );
  const [disqualifying, setDisqualifying] = useState<Participant | null>(null);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Participants</p>
        <span className="text-xs text-gray-400">{(participants ?? []).length} confirmed</span>
      </div>

      <div className="mt-4">
        {error ? (
          <ErrorState message="Couldn't load participants." onRetry={refetch} />
        ) : loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (participants ?? []).length === 0 ? (
          <EmptyState icon={Users} title="No confirmed participants yet" description="They'll show up here once registrations are confirmed." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400">
                  <th className="py-2">Player</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Game UID</th>
                  <th className="py-2">Payment</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(participants ?? []).map((p) => (
                  <tr key={p.registrationId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5">
                      <Link to={`/players/${p.userId}`} className="font-medium text-gray-800 hover:text-primary-600 hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-xs text-gray-400">{p.email}</p>
                    </td>
                    <td className="py-2.5 text-gray-500">{p.phone || "—"}</td>
                    <td className="py-2.5 text-gray-600">{p.gameUid}</td>
                    <td className="py-2.5">
                      <PaymentStatusBadge status={p.paymentStatus} />
                    </td>
                    <td className="py-2.5">
                      <RegistrationStatusBadge status={p.registrationStatus} />
                    </td>
                    <td className="py-2.5 text-right">
                      {p.registrationStatus === "CONFIRMED" ? (
                        <Button size="sm" variant="danger" onClick={() => setDisqualifying(p)}>
                          Disqualify
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {disqualifying ? (
        <DisqualifyModal
          participant={disqualifying}
          onClose={() => setDisqualifying(null)}
          onDisqualified={() => {
            setDisqualifying(null);
            refetch();
          }}
        />
      ) : null}
    </Card>
  );
}

function DisqualifyModal({
  participant,
  onClose,
  onDisqualified,
}: {
  participant: Participant;
  onClose: () => void;
  onDisqualified: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDisqualify() {
    if (!reason.trim()) {
      setError("A reason is required to disqualify a participant.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await disqualifyRegistration(participant.registrationId, reason.trim());
      onDisqualified();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not disqualify participant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Disqualify ${participant.name}?`}>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">Disqualified users cannot receive prizes. This is recorded and audited.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
        />
        {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDisqualify} disabled={busy}>
            Disqualify
          </Button>
        </div>
      </div>
    </Modal>
  );
}
