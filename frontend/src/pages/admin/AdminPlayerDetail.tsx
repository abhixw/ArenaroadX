import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge, PaymentStatusBadge, RegistrationStatusBadge } from "@/components/ui/Badge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { ApiError } from "@/api/client";
import { getPlayerHistory } from "@/api/admin/registrations";
import { resetUserPassword, updateUserStatus } from "@/api/admin/users";
import { formatDate } from "@/lib/utils";
import type { UserStatus } from "@/types";

export default function AdminPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: history, loading, error: loadError, refetch } = useAsyncData(() => getPlayerHistory(id!), [id]);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleStatusChange(status: UserStatus) {
    setBusy(true);
    setError(null);
    setResetMessage(null);
    try {
      await updateUserStatus(id!, status);
      refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    // No self-service "forgot password" flow exists (no email infrastructure) -- the admin
    // sets the new password directly here and relays it to the player out-of-band.
    const newPassword = window.prompt(
      "Enter a new password for this player (min 8 chars, with an uppercase letter, a lowercase letter, and a digit). It will not be shown again after this, so relay it to the player now."
    );
    if (!newPassword) return;

    setBusy(true);
    setError(null);
    setResetMessage(null);
    try {
      await resetUserPassword(id!, newPassword);
      setResetMessage("Password reset. Relay the new password to the player now — it will not be shown again.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !loadError && !history) {
    return <Navigate to="/admin/players" replace />;
  }

  return (
    <div>
      <Link
        to="/admin/players"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft size={15} /> Back to players
      </Link>

      {loadError ? (
        <ErrorState message="Couldn't load this player." onRetry={refetch} />
      ) : loading || !history ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Topbar
            title={history.user.name}
            subtitle={history.user.phone ? `${history.user.email} · ${history.user.phone}` : history.user.email}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <p className="text-sm font-bold text-gray-900">Registration History</p>
              {error ? <p className="mt-2 text-xs font-medium text-danger-600">{error}</p> : null}
              {history.registrations.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No tournament registrations yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {history.registrations.map((r) => (
                    <div
                      key={r.registrationId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3"
                    >
                      <div>
                        <Link
                          to={`/admin/tournaments/${r.tournamentId}`}
                          className="text-sm font-semibold text-gray-800 hover:text-primary-600 hover:underline"
                        >
                          {r.tournamentName}
                        </Link>
                        <p className="text-xs text-gray-400">{formatDate(r.registeredAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PaymentStatusBadge status={r.paymentStatus} />
                        <RegistrationStatusBadge status={r.registrationStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="h-fit space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Avatar name={history.user.name} size={48} />
                <div>
                  <p className="font-bold text-gray-900">{history.user.name}</p>
                  <p className="text-xs text-gray-400">Member since {formatDate(history.user.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Account Status</p>
                <div className="mt-1">
                  <Badge
                    tone={
                      history.user.status === "ACTIVE"
                        ? "success"
                        : history.user.status === "SUSPENDED"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {history.user.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                {history.user.status !== "ACTIVE" ? (
                  <Button size="sm" className="w-full" disabled={busy} onClick={() => handleStatusChange("ACTIVE")}>
                    Reactivate
                  </Button>
                ) : null}
                {history.user.status !== "SUSPENDED" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => handleStatusChange("SUSPENDED")}
                  >
                    Suspend
                  </Button>
                ) : null}
                {history.user.status !== "BANNED" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    className="w-full"
                    disabled={busy}
                    onClick={() => handleStatusChange("BANNED")}
                  >
                    Ban
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={handleResetPassword}>
                  Reset Password
                </Button>
                {resetMessage ? <p className="text-xs font-medium text-success-600">{resetMessage}</p> : null}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
