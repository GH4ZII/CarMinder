class AppError(Exception):
    """Base exception for all domain errors."""

    def __init__(self, message: str = ""):
        self.message = message
        super().__init__(message)


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""


class AlreadyExistsError(AppError):
    """Raised when attempting to create a duplicate resource."""


class AuthenticationError(AppError):
    """Raised when authentication fails (bad credentials, expired token, etc.)."""


class ValidationError(AppError):
    """Raised when a business rule or validation check fails."""
