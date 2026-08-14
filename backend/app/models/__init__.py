from app.models.audit_log import AuditLog
from app.models.game import Game
from app.models.game_account import GameAccount
from app.models.match import Match, MatchStatus, ResultSource
from app.models.match_participant import MatchParticipant, MatchParticipationStatus
from app.models.match_result import MatchResult, MatchResultStatus
from app.models.payment import Payment, PaymentStatus
from app.models.prize import Prize, PrizePayoutStatus
from app.models.refund import Refund, RefundStatus
from app.models.registration import Registration, RegistrationPaymentStatus, RegistrationStatus
from app.models.result_import import ImportRowStatus, ImportStatus, ResultImport
from app.models.result_revision import ResultRevision
from app.models.scoring_rule import ScoringMethod, ScoringRule
from app.models.tournament import Tournament, TournamentStatus
from app.models.tournament_result import TournamentResult, TournamentResultStatus
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole, UserStatus

ALL_DOCUMENT_MODELS = [
    AuditLog,
    User,
    Game,
    Tournament,
    GameAccount,
    Registration,
    Payment,
    Match,
    MatchParticipant,
    ScoringRule,
    MatchResult,
    TournamentResult,
    ResultImport,
    ResultRevision,
    Prize,
    Refund,
    Transaction,
]

__all__ = [
    "AuditLog",
    "User",
    "UserRole",
    "UserStatus",
    "Game",
    "Tournament",
    "TournamentStatus",
    "GameAccount",
    "Registration",
    "RegistrationStatus",
    "RegistrationPaymentStatus",
    "Payment",
    "PaymentStatus",
    "Match",
    "MatchStatus",
    "ResultSource",
    "MatchParticipant",
    "MatchParticipationStatus",
    "ScoringRule",
    "ScoringMethod",
    "MatchResult",
    "MatchResultStatus",
    "TournamentResult",
    "TournamentResultStatus",
    "ResultImport",
    "ImportStatus",
    "ImportRowStatus",
    "ResultRevision",
    "Prize",
    "PrizePayoutStatus",
    "Refund",
    "RefundStatus",
    "Transaction",
    "TransactionType",
    "ALL_DOCUMENT_MODELS",
]
