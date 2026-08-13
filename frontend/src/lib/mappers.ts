// Translates the backend's snake_case DTOs into the frontend's existing camelCase types
// (src/types/index.ts) so pages/components never have to know the wire format changed.
import type {
  Game,
  GameAccount,
  Match,
  MatchStatus,
  Payment,
  PaymentStatus,
  Prize,
  Registration,
  RegistrationStatus,
  Tournament,
  TournamentResultRow,
  User,
} from "@/types";

// ---- shared helpers ----

function toId(value: unknown): string {
  return String(value);
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---- user / auth ----

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  created_at: string;
}

export function mapUser(dto: UserDto): User {
  return {
    id: toId(dto.id),
    name: dto.name,
    handle: dto.name.replace(/\s+/g, ""),
    email: dto.email,
    phone: dto.phone,
    role: dto.role,
    status: dto.status,
    createdAt: dto.created_at,
  };
}

// ---- games ----

export interface GameDto {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  game_type: string | null;
  is_active: boolean;
}

const KNOWN_GAME_TYPES = new Set(["BATTLE_ROYALE", "STRATEGY", "RACING", "SHOOTER"]);

export function mapGame(dto: GameDto): Game {
  return {
    id: toId(dto.id),
    slug: slugify(dto.name),
    name: dto.name,
    description: dto.description ?? "",
    imageUrl: dto.image_url ?? "",
    gameType: (KNOWN_GAME_TYPES.has(dto.game_type ?? "") ? dto.game_type : "BATTLE_ROYALE") as Game["gameType"],
    isActive: dto.is_active,
  };
}

// ---- game accounts ----

export interface GameAccountDto {
  id: string;
  user_id: string;
  game_id: string;
  game_uid: string;
  game_username: string | null;
  verified_at: string | null;
}

export function mapGameAccount(dto: GameAccountDto): GameAccount {
  return {
    id: toId(dto.id),
    userId: toId(dto.user_id),
    gameId: toId(dto.game_id),
    gameUid: dto.game_uid,
    gameUsername: dto.game_username ?? "",
    verifiedAt: dto.verified_at,
    // The backend has no stored "locked" flag -- lock state is only enforced (and
    // discovered) at write time via a GAME_ACCOUNT_LOCKED error. See GameAccounts.tsx.
    lockedAt: null,
  };
}

// ---- tournaments ----

export interface TournamentDto {
  id: string;
  game_id: string;
  name: string;
  description: string | null;
  entry_fee: number | string;
  prize_pool: number | string;
  max_players: number;
  registered_players: number;
  start_time: string;
  registration_deadline: string;
  game_url: string | null;
  rules: string | null;
  instructions: string | null;
  status: string;
  cancellation_reason?: string | null;
  created_at: string;
}

// The backend has no per-tournament image -- only games have one. Callers pass the parent
// game's image_url through as a fallback so tournament cards/heroes still have art.
export function mapTournament(dto: TournamentDto, gameImageUrl?: string | null): Tournament {
  return {
    id: toId(dto.id),
    gameId: toId(dto.game_id),
    name: dto.name,
    description: dto.description ?? "",
    imageUrl: gameImageUrl ?? "",
    gameUrl: dto.game_url,
    fee: Number(dto.entry_fee),
    prizePool: Number(dto.prize_pool),
    maxPlayers: dto.max_players,
    registeredPlayers: dto.registered_players,
    status: dto.status as Tournament["status"],
    // The backend only tracks when registration *closes* (registration_deadline), not when
    // it opened -- registrationOpensAt isn't rendered anywhere today, so this is a harmless stand-in.
    registrationOpensAt: dto.created_at,
    registrationClosesAt: dto.registration_deadline,
    startsAt: dto.start_time,
    endsAt: null,
    rules: (dto.rules ?? "").split("\n").map((r) => r.trim()).filter(Boolean),
    scoringSummary: dto.instructions?.trim() || "Scoring is configured by the tournament admin.",
    cancellationReason: dto.cancellation_reason,
  };
}

// ---- matches ----

export interface MatchDto {
  id: string;
  tournament_id: string;
  match_number: number;
  scheduled_time: string;
  join_window_opens_at: string;
  join_window_closes_at: string;
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
}

const MATCH_STATUS_MAP: Record<MatchDto["status"], MatchStatus> = {
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  COMPLETED: "ENDED",
  CANCELLED: "CANCELLED",
};

export function mapMatch(dto: MatchDto, gameUrl?: string | null): Match {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    matchNumber: dto.match_number,
    scheduledAt: dto.scheduled_time,
    joinWindowOpensAt: dto.join_window_opens_at,
    joinWindowClosesAt: dto.join_window_closes_at,
    status: MATCH_STATUS_MAP[dto.status] ?? "SCHEDULED",
    roomUrl: gameUrl ?? undefined,
    resultSource: null,
  };
}

// ---- registrations ----

export interface RegistrationDto {
  id: string;
  user_id: string;
  tournament_id: string;
  game_account_id: string;
  registration_status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "DISQUALIFIED" | "EXPIRED";
  payment_status: "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
  reserved_until: string;
  created_at: string;
}

export const REGISTRATION_STATUS_MAP: Record<RegistrationDto["registration_status"], RegistrationStatus> = {
  PENDING_PAYMENT: "RESERVED",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  DISQUALIFIED: "DISQUALIFIED",
  EXPIRED: "EXPIRED",
};

export const PAYMENT_STATUS_MAP: Record<RegistrationDto["payment_status"], PaymentStatus> = {
  PENDING: "PENDING",
  CAPTURED: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
};

export function mapRegistration(dto: RegistrationDto): Registration {
  return {
    id: toId(dto.id),
    userId: toId(dto.user_id),
    tournamentId: toId(dto.tournament_id),
    gameAccountId: toId(dto.game_account_id),
    status: REGISTRATION_STATUS_MAP[dto.registration_status],
    paymentStatus: PAYMENT_STATUS_MAP[dto.payment_status],
    reservationExpiresAt:
      REGISTRATION_STATUS_MAP[dto.registration_status] === "RESERVED" ? dto.reserved_until : null,
    createdAt: dto.created_at,
  };
}

// GET /api/my-tournaments -- already pre-joined with the tournament by the backend.
export interface MyTournamentDto {
  registration_id: string;
  registration_status: RegistrationDto["registration_status"];
  payment_status: RegistrationDto["payment_status"];
  reserved_until: string;
  registered_at: string;
  tournament: TournamentDto;
}

export interface MyTournamentEntry {
  registration: Registration;
  tournament: Tournament;
}

export function mapMyTournament(dto: MyTournamentDto, gameImageUrl?: string | null): MyTournamentEntry {
  return {
    registration: mapRegistration({
      id: dto.registration_id,
      user_id: "",
      tournament_id: dto.tournament.id,
      game_account_id: "",
      registration_status: dto.registration_status,
      payment_status: dto.payment_status,
      reserved_until: dto.reserved_until,
      created_at: dto.registered_at,
    }),
    tournament: mapTournament(dto.tournament, gameImageUrl),
  };
}

// ---- payments ----

export interface PaymentDto {
  id: string;
  registration_id: string;
  tournament_id: string;
  amount_paise: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  status: "CREATED" | "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
  created_at: string;
}

const PAYMENT_ONLY_STATUS_MAP: Record<PaymentDto["status"], PaymentStatus> = {
  CREATED: "PENDING",
  PENDING: "PENDING",
  CAPTURED: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
};

export function mapPayment(dto: PaymentDto): Payment {
  return {
    id: toId(dto.id),
    registrationId: toId(dto.registration_id),
    tournamentId: toId(dto.tournament_id),
    razorpayOrderId: dto.razorpay_order_id,
    razorpayPaymentId: dto.razorpay_payment_id ?? undefined,
    amount: dto.amount_paise / 100,
    status: PAYMENT_ONLY_STATUS_MAP[dto.status],
    createdAt: dto.created_at,
  };
}

// ---- leaderboard ----

export interface LeaderboardEntryDto {
  rank: number;
  user_id: string;
  player_name: string;
  score: number;
}

export function mapLeaderboardRow(dto: LeaderboardEntryDto): TournamentResultRow {
  return {
    rank: dto.rank,
    userId: toId(dto.user_id),
    userHandle: dto.player_name,
    totalScore: dto.score,
  };
}

export interface LeaderboardHistoryEntryDto {
  tournament_id: string;
  tournament_name: string;
  rank: number;
  score: number;
}

// ---- prizes ----

export interface MyPrizeDto {
  id: string;
  tournament_id: string;
  tournament_name: string;
  rank: number;
  amount: number | string;
  payout_status: "PENDING" | "PAID";
  paid_at: string | null;
  created_at: string;
}

export function mapPrize(dto: MyPrizeDto, userId: string): Prize {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    tournamentName: dto.tournament_name,
    userId,
    rank: dto.rank,
    amount: Number(dto.amount),
    status: dto.payout_status,
    createdAt: dto.created_at,
    paidAt: dto.paid_at,
  };
}
