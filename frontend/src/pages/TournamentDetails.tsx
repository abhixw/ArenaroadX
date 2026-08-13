import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CalendarDays, Clock, Coins, Trophy, Users } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Thumb } from "@/components/ui/Thumb";
import { TournamentStatusBadge } from "@/components/ui/Badge";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { RoomAccessCard } from "@/components/tournaments/RoomAccessCard";
import { RegistrationFlow } from "@/components/tournaments/RegistrationFlow";
import { useAuth } from "@/hooks/useAuth";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getTournament, getMatches, getMatchAccess } from "@/api/tournaments";
import { getGame } from "@/api/games";
import { getRegistrationForTournament } from "@/api/registrations";
import { getLeaderboard } from "@/api/results";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const PUBLISHED_STATUSES = ["RESULTS_PUBLISHED", "COMPLETED"];

function isWithinJoinWindow(opensAt: string, closesAt: string): boolean {
  const now = Date.now();
  return now >= new Date(opensAt).getTime() && now <= new Date(closesAt).getTime();
}

export default function TournamentDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [flowOpen, setFlowOpen] = useState(false);

  const { data: tournament, loading, refetch: refetchTournament } = useAsyncData(
    () => getTournament(id!),
    [id],
  );
  const { data: game } = useAsyncData(() => getGame(tournament?.gameId ?? ""), [tournament?.gameId]);
  const { data: matches } = useAsyncData(
    () => getMatches(id!, tournament?.gameUrl),
    [id, tournament?.gameUrl],
  );
  const {
    data: registration,
    refetch: refetchRegistration,
  } = useAsyncData(() => getRegistrationForTournament(id!), [id]);
  const { data: leaderboard } = useAsyncData(
    () => (tournament && PUBLISHED_STATUSES.includes(tournament.status) ? getLeaderboard(id!) : Promise.resolve([])),
    [id, tournament?.status],
  );

  const isConfirmed = registration?.status === "CONFIRMED";
  const isReserved = registration?.status === "RESERVED";
  const liveMatch = matches?.find(
    (m) => m.status === "LIVE" || isWithinJoinWindow(m.joinWindowOpensAt, m.joinWindowClosesAt),
  );

  // Room credentials are participant-gated server-side -- only fetch once confirmed, and
  // treat any failure (not open yet / not a participant) as "nothing to show" rather than
  // a hard error, since RoomAccessCard already renders a graceful placeholder for that.
  const { data: matchAccess } = useAsyncData(
    () =>
      isConfirmed && liveMatch
        ? getMatchAccess(id!, liveMatch.id).catch(() => null)
        : Promise.resolve(null),
    [id, isConfirmed, liveMatch?.id],
  );

  if (!loading && !tournament) {
    return <Navigate to="/tournaments" replace />;
  }

  if (loading || !tournament || !game) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const roomMatch = liveMatch
    ? {
        ...liveMatch,
        roomId: matchAccess?.roomId ?? undefined,
        roomPassword: matchAccess?.roomPassword ?? undefined,
      }
    : undefined;

  function refreshAll() {
    refetchTournament();
    refetchRegistration();
  }

  return (
    <div>
      <Topbar title={tournament.name} subtitle={game.name} />

      <Card className="overflow-hidden">
        <Thumb src={tournament.imageUrl} alt={tournament.name} className="h-56 w-full" />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <TournamentStatusBadge status={tournament.status} />
            <span className="text-xs font-medium text-gray-400">{game.name}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{tournament.description}</p>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <InfoStat icon={Coins} label="Entry Fee" value={formatCurrency(tournament.fee)} />
            <InfoStat icon={Trophy} label="Prize Pool" value={formatCurrency(tournament.prizePool)} />
            <InfoStat
              icon={Users}
              label="Players"
              value={`${tournament.registeredPlayers}/${tournament.maxPlayers}`}
            />
            <InfoStat icon={CalendarDays} label="Starts" value={formatDateTime(tournament.startsAt)} />
          </Card>

          <Card className="p-5">
            <p className="text-sm font-bold text-gray-900">Rules</p>
            {tournament.rules.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                {tournament.rules.map((rule, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                    {rule}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No rules published yet.</p>
            )}
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-app-bg px-3 py-2.5 text-xs text-gray-500">
              <Clock size={14} className="shrink-0" />
              {tournament.scoringSummary}
            </p>
          </Card>

          {PUBLISHED_STATUSES.includes(tournament.status) ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Leaderboard</p>
                <Link
                  to={`/leaderboards/${tournament.id}`}
                  className="text-xs font-semibold text-primary-600 hover:underline"
                >
                  View full leaderboard
                </Link>
              </div>
              <div className="mt-3">
                <LeaderboardTable rows={leaderboard ?? []} currentUserId={user?.id} limit={5} />
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-sm font-bold text-gray-900">Registration</p>

            {isConfirmed ? (
              <div className="mt-3 rounded-xl bg-success-50 px-3 py-2.5 text-sm font-medium text-success-600">
                You're registered for this tournament.
              </div>
            ) : isReserved ? (
              <div className="mt-3 rounded-xl bg-warning-50 px-3 py-2.5 text-sm font-medium text-warning-600">
                Slot reserved — complete payment to confirm your spot.
              </div>
            ) : tournament.status === "REGISTRATION_OPEN" ? (
              <p className="mt-2 text-sm text-gray-500">
                {tournament.maxPlayers - tournament.registeredPlayers} slots left. Registration closes{" "}
                {formatDateTime(tournament.registrationClosesAt)}.
              </p>
            ) : tournament.status === "CANCELLED" ? (
              <p className="mt-2 text-sm text-gray-500">
                This tournament was cancelled. Paid entry fees are refunded automatically.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">Registration is not currently open.</p>
            )}

            {!registration && tournament.status === "REGISTRATION_OPEN" ? (
              <Button className="mt-4 w-full" onClick={() => setFlowOpen(true)}>
                Register Now
              </Button>
            ) : null}
            {isReserved ? (
              <Button className="mt-4 w-full" onClick={() => setFlowOpen(true)}>
                Complete Payment
              </Button>
            ) : null}
          </Card>

          {isConfirmed && roomMatch ? <RoomAccessCard match={roomMatch} /> : null}
        </div>
      </div>

      <RegistrationFlow
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        onSuccess={refreshAll}
        tournament={tournament}
        game={game}
        resumePendingPayment={isReserved}
      />
    </div>
  );
}

function InfoStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}
