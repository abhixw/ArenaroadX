// Admin-only DTO -> type mappers. Shared resources (Game, Tournament, Match, Prize) reuse the
// mappers in src/lib/mappers.ts rather than duplicating them -- only genuinely admin-only
// resources get their own mapper here.
import { PAYMENT_STATUS_MAP, REGISTRATION_STATUS_MAP } from "@/lib/mappers";
import type {
  AuditLogEntry,
  ImportRowReport,
  MatchResult,
  Participant,
  PlayerHistory,
  PlayerHistoryEntry,
  Refund,
  ResultImport,
  ScoringRule,
  Transaction,
  TournamentResult,
} from "@/types/admin";
import type { Match, MatchStatus, PaymentStatus, Prize, RegistrationStatus, User } from "@/types";

function toId(value: unknown): string {
  return String(value);
}

// ---- users ----

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  created_at: string;
}

export function mapAdminUser(dto: AdminUserDto): User {
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

// ---- matches (admin view -- includes room credentials directly) ----

export interface AdminMatchDto {
  id: string;
  tournament_id: string;
  match_number: number;
  scheduled_time: string;
  start_time: string | null;
  end_time: string | null;
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
  join_window_opens_at: string;
  join_window_closes_at: string;
  room_id: string | null;
  room_password: string | null;
  access_info: string | null;
}

const ADMIN_MATCH_STATUS_MAP: Record<AdminMatchDto["status"], MatchStatus> = {
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  COMPLETED: "ENDED",
  CANCELLED: "CANCELLED",
};

export function mapAdminMatch(dto: AdminMatchDto): Match {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    matchNumber: dto.match_number,
    scheduledAt: dto.scheduled_time,
    joinWindowOpensAt: dto.join_window_opens_at,
    joinWindowClosesAt: dto.join_window_closes_at,
    status: ADMIN_MATCH_STATUS_MAP[dto.status] ?? "SCHEDULED",
    roomId: dto.room_id ?? undefined,
    roomPassword: dto.room_password ?? undefined,
    resultSource: null,
  };
}

// ---- scoring rules ----

export interface ScoringRuleDto {
  id: string;
  tournament_id: string;
  version: number;
  method: ScoringRule["method"];
  placement_points: Record<string, number> | null;
  kill_point_value: number | null;
  field_weights: Record<string, number> | null;
  tie_break_fields: string[];
  is_active: boolean;
}

export function mapScoringRule(dto: ScoringRuleDto): ScoringRule {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    version: dto.version,
    method: dto.method,
    placementPoints: dto.placement_points,
    killPointValue: dto.kill_point_value,
    fieldWeights: dto.field_weights,
    tieBreakFields: dto.tie_break_fields,
    isActive: dto.is_active,
  };
}

// ---- match results ----

export interface MatchResultDto {
  id: string;
  match_id: string;
  tournament_id: string;
  user_id: string;
  game_uid: string;
  placement: number | null;
  kills: number | null;
  raw_data: Record<string, unknown>;
  status: MatchResult["status"];
  exclusion_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function mapMatchResult(dto: MatchResultDto): MatchResult {
  return {
    id: toId(dto.id),
    matchId: toId(dto.match_id),
    tournamentId: toId(dto.tournament_id),
    userId: toId(dto.user_id),
    gameUid: dto.game_uid,
    placement: dto.placement,
    kills: dto.kills,
    rawData: dto.raw_data,
    status: dto.status,
    exclusionReason: dto.exclusion_reason,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

// ---- calculated tournament results ----

export interface TournamentResultDto {
  id: string;
  tournament_id: string;
  user_id: string;
  placement_points: number;
  kill_points: number;
  bonus_points: number;
  total_score: number;
  rank: number | null;
  status: TournamentResult["status"];
  scoring_rule_version: number;
}

export function mapTournamentResult(dto: TournamentResultDto): TournamentResult {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    userId: toId(dto.user_id),
    placementPoints: dto.placement_points,
    killPoints: dto.kill_points,
    bonusPoints: dto.bonus_points,
    totalScore: dto.total_score,
    rank: dto.rank,
    status: dto.status,
    scoringRuleVersion: dto.scoring_rule_version,
  };
}

// ---- result imports ----

export interface ImportRowReportDto {
  row_number: number;
  game_uid: string | null;
  placement: number | null;
  kills: number | null;
  row_status: ImportRowReport["rowStatus"];
  reason: string | null;
  user_id: string | null;
}

export interface ResultImportDto {
  id: string;
  tournament_id: string;
  match_id: string;
  filename: string;
  imported_by: string;
  row_count: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  unknown_count: number;
  missing_game_uids: string[];
  status: ResultImport["status"];
  rows: ImportRowReportDto[];
  created_at: string;
}

export function mapResultImport(dto: ResultImportDto): ResultImport {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    matchId: toId(dto.match_id),
    filename: dto.filename,
    importedBy: toId(dto.imported_by),
    rowCount: dto.row_count,
    validCount: dto.valid_count,
    invalidCount: dto.invalid_count,
    duplicateCount: dto.duplicate_count,
    unknownCount: dto.unknown_count,
    missingGameUids: dto.missing_game_uids,
    status: dto.status,
    rows: dto.rows.map((r) => ({
      rowNumber: r.row_number,
      gameUid: r.game_uid,
      placement: r.placement,
      kills: r.kills,
      rowStatus: r.row_status,
      reason: r.reason,
      userId: r.user_id ? toId(r.user_id) : null,
    })),
    createdAt: dto.created_at,
  };
}

// ---- participants ----

export interface ParticipantDto {
  registration_id: string;
  user_id: string;
  name: string;
  email: string;
  game_uid: string;
  payment_status: "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
  registration_status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "DISQUALIFIED" | "EXPIRED";
}

export function mapParticipant(dto: ParticipantDto): Participant {
  return {
    registrationId: toId(dto.registration_id),
    userId: toId(dto.user_id),
    name: dto.name,
    email: dto.email,
    gameUid: dto.game_uid,
    paymentStatus: PAYMENT_STATUS_MAP[dto.payment_status] as PaymentStatus,
    registrationStatus: REGISTRATION_STATUS_MAP[dto.registration_status] as RegistrationStatus,
  };
}

// ---- player history ----

export interface PlayerHistoryDto {
  user: AdminUserDto;
  registrations: {
    registration_id: string;
    registration_status: ParticipantDto["registration_status"];
    payment_status: ParticipantDto["payment_status"];
    reserved_until: string;
    registered_at: string;
    tournament: { id: string; name: string };
  }[];
}

export function mapPlayerHistory(dto: PlayerHistoryDto): PlayerHistory {
  return {
    user: mapAdminUser(dto.user),
    registrations: dto.registrations.map(
      (r): PlayerHistoryEntry => ({
        registrationId: toId(r.registration_id),
        registrationStatus: REGISTRATION_STATUS_MAP[r.registration_status] as RegistrationStatus,
        paymentStatus: PAYMENT_STATUS_MAP[r.payment_status] as PaymentStatus,
        reservedUntil: r.reserved_until,
        registeredAt: r.registered_at,
        tournamentId: toId(r.tournament.id),
        tournamentName: r.tournament.name,
      }),
    ),
  };
}

// ---- prizes (admin view -- raw PrizeResponse, tournament name supplied by caller's context) ----

export interface AdminPrizeDto {
  id: string;
  tournament_id: string;
  user_id: string;
  rank: number;
  amount: number | string;
  payout_status: "PENDING" | "PAID";
  paid_at: string | null;
  created_at: string;
}

export function mapAdminPrize(dto: AdminPrizeDto, tournamentName: string): Prize {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    tournamentName,
    userId: toId(dto.user_id),
    rank: dto.rank,
    amount: Number(dto.amount),
    status: dto.payout_status,
    createdAt: dto.created_at,
    paidAt: dto.paid_at,
  };
}

// ---- refunds ----

export interface RefundDto {
  id: string;
  payment_id: string;
  registration_id: string;
  tournament_id: string;
  user_id: string;
  amount: number | string;
  reason: string;
  provider_reference: string | null;
  status: Refund["status"];
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export function mapRefund(dto: RefundDto): Refund {
  return {
    id: toId(dto.id),
    paymentId: toId(dto.payment_id),
    registrationId: toId(dto.registration_id),
    tournamentId: toId(dto.tournament_id),
    userId: toId(dto.user_id),
    amount: Number(dto.amount),
    reason: dto.reason,
    providerReference: dto.provider_reference,
    status: dto.status,
    processedBy: dto.processed_by ? toId(dto.processed_by) : null,
    processedAt: dto.processed_at,
    createdAt: dto.created_at,
  };
}

// ---- transactions (ledger) ----

export interface TransactionDto {
  id: string;
  tournament_id: string;
  user_id: string;
  type: Transaction["type"];
  amount: number | string;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

export function mapTransaction(dto: TransactionDto): Transaction {
  return {
    id: toId(dto.id),
    tournamentId: toId(dto.tournament_id),
    userId: toId(dto.user_id),
    type: dto.type,
    amount: Number(dto.amount),
    referenceId: dto.reference_id ? toId(dto.reference_id) : null,
    note: dto.note,
    createdAt: dto.created_at,
  };
}

// ---- audit logs ----

export interface AuditLogDto {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  status_code: number;
  request_body: Record<string, unknown> | null;
  created_at: string;
}

export function mapAuditLog(dto: AuditLogDto): AuditLogEntry {
  return {
    id: toId(dto.id),
    actorId: dto.actor_id ? toId(dto.actor_id) : null,
    action: dto.action,
    entity: dto.entity,
    statusCode: dto.status_code,
    requestBody: dto.request_body,
    createdAt: dto.created_at,
  };
}
