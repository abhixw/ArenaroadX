from fastapi import status


class AppError(Exception):
    """Base class for application-level errors mapped to clean HTTP responses."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    error_code: str = "APPLICATION_ERROR"

    def __init__(self, message: str, error_code: str | None = None, status_code: int | None = None) -> None:
        self.message = message
        if error_code is not None:
            self.error_code = error_code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(message)


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "UNAUTHORIZED"

    def __init__(self, message: str = "Authentication required.") -> None:
        super().__init__(message)


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "FORBIDDEN"

    def __init__(self, message: str = "You do not have permission to perform this action.") -> None:
        super().__init__(message)


class InvalidCredentialsError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "INVALID_CREDENTIALS"

    def __init__(self, message: str = "Invalid email or password.") -> None:
        super().__init__(message)


class UserAlreadyExistsError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "USER_ALREADY_EXISTS"

    def __init__(self, message: str = "A user with this email already exists.") -> None:
        super().__init__(message)


class UserNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "USER_NOT_FOUND"

    def __init__(self, message: str = "User not found.") -> None:
        super().__init__(message)


class GameNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "GAME_NOT_FOUND"

    def __init__(self, message: str = "Game not found.") -> None:
        super().__init__(message)


class GameAlreadyExistsError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "GAME_ALREADY_EXISTS"

    def __init__(self, message: str = "A game with this name already exists.") -> None:
        super().__init__(message)


class GameInUseError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "GAME_IN_USE"

    def __init__(self, message: str = "Cannot delete a game that has tournaments associated with it.") -> None:
        super().__init__(message)


class TournamentNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "TOURNAMENT_NOT_FOUND"

    def __init__(self, message: str = "Tournament not found.") -> None:
        super().__init__(message)


class TournamentClosedError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "TOURNAMENT_CLOSED"

    def __init__(self, message: str = "Tournament registration is not open.") -> None:
        super().__init__(message)


class TournamentFullError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "TOURNAMENT_FULL"

    def __init__(self, message: str = "Tournament has reached its maximum player capacity.") -> None:
        super().__init__(message)


class InvalidTournamentStatusError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_TOURNAMENT_STATUS"

    def __init__(self, message: str = "Invalid tournament status transition.") -> None:
        super().__init__(message)


class AlreadyRegisteredError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "ALREADY_REGISTERED"

    def __init__(self, message: str = "You are already registered for this tournament.") -> None:
        super().__init__(message)


class RegistrationNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "REGISTRATION_NOT_FOUND"

    def __init__(self, message: str = "Registration not found.") -> None:
        super().__init__(message)


class RegistrationDeadlinePassedError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "REGISTRATION_DEADLINE_PASSED"

    def __init__(self, message: str = "The registration deadline for this tournament has passed.") -> None:
        super().__init__(message)


class AccountNotActiveError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "ACCOUNT_NOT_ACTIVE"

    def __init__(self, message: str = "Your account is suspended or banned and cannot register.") -> None:
        super().__init__(message)


class GameAccountRequiredError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "GAME_ACCOUNT_REQUIRED"

    def __init__(self, message: str = "A game account (Game UID) is required before registering.") -> None:
        super().__init__(message)


class GameAccountNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "GAME_ACCOUNT_NOT_FOUND"

    def __init__(self, message: str = "Game account not found.") -> None:
        super().__init__(message)


class GameAccountLockedError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "GAME_ACCOUNT_LOCKED"

    def __init__(
        self, message: str = "This game account can no longer be changed; registration has already closed."
    ) -> None:
        super().__init__(message)


class GameUidAlreadyClaimedError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "GAME_UID_ALREADY_CLAIMED"

    def __init__(self, message: str = "This Game UID is already registered to another account.") -> None:
        super().__init__(message)


class RegistrationNotPendingPaymentError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "REGISTRATION_NOT_PENDING_PAYMENT"

    def __init__(self, message: str = "This registration is not awaiting payment.") -> None:
        super().__init__(message)


class PaymentNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "PAYMENT_NOT_FOUND"

    def __init__(self, message: str = "Payment not found.") -> None:
        super().__init__(message)


class PaymentVerificationError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "PAYMENT_VERIFICATION_FAILED"

    def __init__(self, message: str = "Payment verification failed.") -> None:
        super().__init__(message)


class ResultNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "RESULT_NOT_FOUND"

    def __init__(self, message: str = "Result not found.") -> None:
        super().__init__(message)


class ResultAlreadyExistsError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "RESULT_ALREADY_EXISTS"

    def __init__(self, message: str = "A result already exists for this user in this tournament.") -> None:
        super().__init__(message)


class NotAConfirmedParticipantError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "NOT_A_CONFIRMED_PARTICIPANT"

    def __init__(self, message: str = "User is not a confirmed participant in this tournament.") -> None:
        super().__init__(message)


class MatchNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "MATCH_NOT_FOUND"

    def __init__(self, message: str = "Match not found.") -> None:
        super().__init__(message)


class DuplicateMatchNumberError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "DUPLICATE_MATCH_NUMBER"

    def __init__(self, message: str = "A match with this match number already exists for this tournament.") -> None:
        super().__init__(message)


class NotAMatchParticipantError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "NOT_A_MATCH_PARTICIPANT"

    def __init__(self, message: str = "You are not a participant in this match.") -> None:
        super().__init__(message)


class AccessWindowNotOpenError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "ACCESS_WINDOW_NOT_OPEN"

    def __init__(self, message: str = "The join window for this match has not opened yet.") -> None:
        super().__init__(message)


class ScoringRuleNotConfiguredError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SCORING_RULE_NOT_CONFIGURED"

    def __init__(self, message: str = "This tournament has no scoring rule configured yet.") -> None:
        super().__init__(message)


class ScoringDataMissingError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "SCORING_DATA_MISSING"

    def __init__(self, message: str = "Required data for this scoring method is missing.") -> None:
        super().__init__(message)


class UnregisteredGameUidError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "UNREGISTERED_GAME_UID"

    def __init__(self, message: str = "This Game UID is not a registered participant in this match.") -> None:
        super().__init__(message)


class MatchResultNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "MATCH_RESULT_NOT_FOUND"

    def __init__(self, message: str = "Match result not found.") -> None:
        super().__init__(message)


class MatchResultAlreadyExistsError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "MATCH_RESULT_ALREADY_EXISTS"

    def __init__(self, message: str = "A result already exists for this user in this match.") -> None:
        super().__init__(message)


class ResultImportNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "RESULT_IMPORT_NOT_FOUND"

    def __init__(self, message: str = "Result import not found.") -> None:
        super().__init__(message)


class ResultImportNotValidatedError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "RESULT_IMPORT_NOT_VALIDATED"

    def __init__(self, message: str = "This import must be validated before it can be committed.") -> None:
        super().__init__(message)


class ResultImportAlreadyCommittedError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "RESULT_IMPORT_ALREADY_COMMITTED"

    def __init__(self, message: str = "This import has already been committed.") -> None:
        super().__init__(message)


class EmptyCsvFileError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "EMPTY_CSV_FILE"

    def __init__(self, message: str = "The uploaded CSV file has no data rows.") -> None:
        super().__init__(message)


class ResultAlreadyPublishedError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "RESULT_ALREADY_PUBLISHED"

    def __init__(
        self, message: str = "This result is already published and locked; use the correction endpoint instead."
    ) -> None:
        super().__init__(message)


class PrizeNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "PRIZE_NOT_FOUND"

    def __init__(self, message: str = "Prize not found.") -> None:
        super().__init__(message)


class ResultsNotPublishedError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "RESULTS_NOT_PUBLISHED"

    def __init__(self, message: str = "Prize allocation cannot occur before results are published.") -> None:
        super().__init__(message)


class RefundNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "REFUND_NOT_FOUND"

    def __init__(self, message: str = "Refund not found.") -> None:
        super().__init__(message)


class RefundAlreadyProcessedError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_code = "REFUND_ALREADY_PROCESSED"

    def __init__(self, message: str = "This refund has already been processed.") -> None:
        super().__init__(message)


class CancellationReasonRequiredError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "CANCELLATION_REASON_REQUIRED"

    def __init__(self, message: str = "A reason is required to cancel a tournament.") -> None:
        super().__init__(message)
