import type { MyTournamentEntry } from "@/lib/mappers";
import type { Tournament } from "@/types";
import { formatDate } from "@/lib/utils";

const UPCOMING_STATUSES: Tournament["status"][] = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "READY",
];
const COMPLETED_STATUSES: Tournament["status"][] = [
  "RESULTS_PENDING",
  "RESULTS_REVIEW",
  "RESULTS_PUBLISHED",
  "COMPLETED",
];

export type MyTournamentTab = "ALL" | "ACTIVE" | "UPCOMING" | "COMPLETED" | "CANCELLED";

export function matchesTab(tournament: Tournament, tab: MyTournamentTab): boolean {
  switch (tab) {
    case "ALL":
      return true;
    case "ACTIVE":
      return tournament.status === "LIVE";
    case "UPCOMING":
      return UPCOMING_STATUSES.includes(tournament.status);
    case "COMPLETED":
      return COMPLETED_STATUSES.includes(tournament.status);
    case "CANCELLED":
      return tournament.status === "CANCELLED";
  }
}

export interface RowPresentation {
  ctaLabel: string;
  ctaVariant: "primary" | "outline";
  meta: string;
}

export function describeMyTournament(entry: MyTournamentEntry): RowPresentation {
  const { tournament } = entry;
  if (tournament.status === "LIVE") {
    return { ctaLabel: "Join Match", ctaVariant: "primary", meta: "Join window open" };
  }
  if (tournament.status === "CANCELLED") {
    return { ctaLabel: "View Details", ctaVariant: "outline", meta: "Refund processed" };
  }
  if (UPCOMING_STATUSES.includes(tournament.status)) {
    return {
      ctaLabel: "View Details",
      ctaVariant: "outline",
      meta: `Starts ${formatDate(tournament.startsAt)}`,
    };
  }
  return { ctaLabel: "View Results", ctaVariant: "outline", meta: "Results published" };
}
