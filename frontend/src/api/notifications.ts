// The backend has no notifications resource, so this derives a real (not fabricated) feed
// from data that already exists: open match join-windows on your confirmed tournaments,
// your recently published results, and your captured payments. "Read" state has nowhere to
// persist server-side, so it's tracked in-memory for the session only.
import { getMyTournaments } from "@/api/registrations";
import { getMatches } from "@/api/tournaments";
import { getRecentResults } from "@/api/results";
import { getMyPayments } from "@/api/payments";
import type { Notification } from "@/types";

const readIds = new Set<string>();

const LIVE_ELIGIBLE_STATUSES = ["LIVE", "REGISTRATION_CLOSED", "READY"];

export async function getNotifications(): Promise<Notification[]> {
  const notifications: Notification[] = [];

  // Not authenticated (e.g. this fires mid-logout/mid-redirect, or a session just expired) --
  // no crash, just no notifications this round.
  let myTournaments: Awaited<ReturnType<typeof getMyTournaments>> = [];
  try {
    myTournaments = await getMyTournaments();
  } catch {
    return notifications;
  }
  const confirmed = myTournaments.filter((e) => e.registration.status === "CONFIRMED");

  const roomEligible = confirmed.filter((e) => LIVE_ELIGIBLE_STATUSES.includes(e.tournament.status));
  const matchesByTournament = await Promise.all(
    roomEligible.map((e) => getMatches(e.tournament.id, e.tournament.gameUrl).catch(() => [])),
  );
  roomEligible.forEach((entry, i) => {
    const now = Date.now();
    const openMatch = matchesByTournament[i].find(
      (m) =>
        m.status === "LIVE" ||
        (now >= new Date(m.joinWindowOpensAt).getTime() && now <= new Date(m.joinWindowClosesAt).getTime()),
    );
    if (openMatch) {
      notifications.push({
        id: `match-${openMatch.id}`,
        title: "Room details published",
        body: `${entry.tournament.name} — Match ${openMatch.matchNumber} join window is open.`,
        createdAt: openMatch.joinWindowOpensAt,
        read: readIds.has(`match-${openMatch.id}`),
      });
    }
  });

  try {
    const tournaments = confirmed.map((e) => e.tournament);
    const results = await getRecentResults(tournaments);
    for (const r of results.slice(0, 3)) {
      const id = `result-${r.tournamentId}`;
      notifications.push({
        id,
        title: "Results published",
        body: `${r.tournamentName} results are live. You finished #${r.rank}.`,
        createdAt: r.publishedAt,
        read: readIds.has(id),
      });
    }
  } catch {
    // Non-critical -- skip silently, the bell just shows fewer items.
  }

  try {
    const payments = (await getMyPayments()).filter((p) => p.status === "PAID").slice(0, 2);
    for (const p of payments) {
      const id = `payment-${p.id}`;
      notifications.push({
        id,
        title: "Payment confirmed",
        body: "Your entry fee payment was received.",
        createdAt: p.createdAt,
        read: readIds.has(id),
      });
    }
  } catch {
    // Non-critical -- skip silently.
  }

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function markAllRead(): Promise<void> {
  const current = await getNotifications();
  current.forEach((n) => readIds.add(n.id));
}
