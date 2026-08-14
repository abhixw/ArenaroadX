export type UserRole = "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: string;
}

export type GameType = "BATTLE_ROYALE" | "STRATEGY" | "RACING" | "SHOOTER";

export interface Game {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  gameType: GameType;
  isActive: boolean;
}

export interface GameAccount {
  id: string;
  userId: string;
  gameId: string;
  gameUid: string;
  gameUsername: string;
  verifiedAt: string | null;
  lockedAt: string | null;
}

export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "READY"
  | "LIVE"
  | "RESULTS_PENDING"
  | "RESULTS_REVIEW"
  | "RESULTS_PUBLISHED"
  | "COMPLETED"
  | "CANCELLED";

export interface Tournament {
  id: string;
  gameId: string;
  name: string;
  description: string;
  imageUrl: string;
  gameUrl?: string | null;
  fee: number;
  prizePool: number;
  firstPrize?: number | null;
  secondPrize?: number | null;
  maxPlayers: number;
  registeredPlayers: number;
  status: TournamentStatus;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string | null;
  rules: string[];
  scoringSummary: string;
  cancellationReason?: string | null;
}

export type MatchStatus = "SCHEDULED" | "JOIN_OPEN" | "LIVE" | "ENDED" | "CANCELLED";

export interface Match {
  id: string;
  tournamentId: string;
  matchNumber: number;
  scheduledAt: string;
  joinWindowOpensAt: string;
  joinWindowClosesAt: string;
  status: MatchStatus;
  roomId?: string;
  roomPassword?: string;
  roomUrl?: string;
  resultSource: "ADMIN_IMPORT" | "ADMIN_MANUAL" | "OFFICIAL_API" | "OFFICIAL_EXPORT" | null;
}

export type RegistrationStatus = "RESERVED" | "CONFIRMED" | "CANCELLED" | "DISQUALIFIED" | "EXPIRED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface Registration {
  id: string;
  userId: string;
  tournamentId: string;
  gameAccountId: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  reservationExpiresAt: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  registrationId: string;
  tournamentId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface MatchResult {
  id: string;
  matchId: string;
  gameUid: string;
  placement: number;
  kills: number;
  source: "ADMIN_IMPORT" | "ADMIN_MANUAL" | "OFFICIAL_API" | "OFFICIAL_EXPORT";
}

export interface TournamentResultRow {
  rank: number;
  userId: string;
  userHandle: string;
  avatarUrl?: string;
  // Per-match raw stats aren't carried by the backend's aggregate tournament leaderboard
  // (only the calculated rank/score are) -- optional so the UI can render without them.
  gameUid?: string;
  placement?: number;
  kills?: number;
  totalScore: number;
}

export type PrizeStatus = "PENDING" | "PAID";

export interface Prize {
  id: string;
  tournamentId: string;
  tournamentName: string;
  userId: string;
  rank: number;
  amount: number;
  status: PrizeStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface PerformancePoint {
  month: string;
  score: number;
}
