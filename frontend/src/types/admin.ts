import type { PaymentStatus, RegistrationStatus, User } from "@/types";

export type ScoringMethod = "MANUAL_TOTAL_SCORE" | "PLACEMENT_ONLY" | "PLACEMENT_AND_KILLS" | "CUSTOM_FORMULA";

export interface ScoringRule {
  id: string;
  tournamentId: string;
  version: number;
  method: ScoringMethod;
  placementPoints: Record<string, number> | null;
  killPointValue: number | null;
  fieldWeights: Record<string, number> | null;
  tieBreakFields: string[];
  isActive: boolean;
}

export type MatchResultStatus = "DRAFT" | "VALIDATED" | "EXCLUDED";
export type ResultSource = "OFFICIAL_API" | "OFFICIAL_EXPORT" | "ADMIN_IMPORT" | "ADMIN_MANUAL";

export interface MatchResult {
  id: string;
  matchId: string;
  tournamentId: string;
  userId: string;
  gameUid: string;
  placement: number | null;
  kills: number | null;
  rawData: Record<string, unknown>;
  status: MatchResultStatus;
  exclusionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TournamentResultStatus = "DRAFT" | "APPROVED" | "PUBLISHED";

export interface TournamentResult {
  id: string;
  tournamentId: string;
  userId: string;
  placementPoints: number;
  killPoints: number;
  bonusPoints: number;
  totalScore: number;
  rank: number | null;
  status: TournamentResultStatus;
  scoringRuleVersion: number;
}

export interface ResultRevision {
  id: string;
  tournamentId: string;
  matchResultId: string;
  tournamentResultId: string;
  userId: string;
  changedBy: string;
  reason: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  oldRank: number | null;
  newRank: number | null;
  oldTotalScore: number | null;
  newTotalScore: number | null;
  financialImpactFlagged: boolean;
  createdAt: string;
}

export type ImportStatus = "UPLOADED" | "VALIDATED" | "COMMITTED";
export type ImportRowStatus = "VALID" | "INVALID" | "DUPLICATE" | "UNKNOWN";

export interface ImportRowReport {
  rowNumber: number;
  gameUid: string | null;
  placement: number | null;
  kills: number | null;
  rowStatus: ImportRowStatus;
  reason: string | null;
  userId: string | null;
}

export interface ResultImport {
  id: string;
  tournamentId: string;
  matchId: string;
  filename: string;
  importedBy: string;
  rowCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  unknownCount: number;
  missingGameUids: string[];
  status: ImportStatus;
  rows: ImportRowReport[];
  createdAt: string;
}

export interface Participant {
  registrationId: string;
  userId: string;
  name: string;
  email: string;
  gameUid: string;
  paymentStatus: PaymentStatus;
  registrationStatus: RegistrationStatus;
}

export interface PlayerHistoryEntry {
  registrationId: string;
  registrationStatus: RegistrationStatus;
  paymentStatus: PaymentStatus;
  reservedUntil: string;
  registeredAt: string;
  tournamentId: string;
  tournamentName: string;
}

export interface PlayerHistory {
  user: User;
  registrations: PlayerHistoryEntry[];
}

export type RefundStatus = "PENDING" | "PROCESSED" | "FAILED";

export interface Refund {
  id: string;
  paymentId: string;
  registrationId: string;
  tournamentId: string;
  userId: string;
  amount: number;
  reason: string;
  providerReference: string | null;
  status: RefundStatus;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
}

export type TransactionType = "ENTRY_FEE" | "REFUND" | "PRIZE" | "ADJUSTMENT";

export interface Transaction {
  id: string;
  tournamentId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  statusCode: number;
  requestBody: Record<string, unknown> | null;
  createdAt: string;
}
