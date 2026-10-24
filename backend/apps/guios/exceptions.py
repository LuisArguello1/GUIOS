"""
apps/guios/exceptions.py
─────────────────────────────────────────────────────────────────────────────
Excepciones de dominio para la aplicación GUIOS.
Evita el uso de excepciones genéricas (Exception) en la lógica de negocio.
"""


class GuiosDomainError(Exception):
    """Excepción base para errores de dominio en GUIOS."""
    pass


class DimensionNotFoundError(GuiosDomainError):
    """Lanzada cuando una dimensión no existe."""
    pass


class DimensionAlreadyExistsError(GuiosDomainError):
    """Lanzada cuando ya existe una dimensión con el mismo nombre."""
    pass


class DimensionCannotBeDeletedError(GuiosDomainError):
    """Lanzada cuando se intenta eliminar una dimensión protegida (base o con factores)."""
    pass


class FactorNotFoundError(GuiosDomainError):
    """Lanzada cuando un factor no existe."""
    pass


class FactorAlreadyExistsError(GuiosDomainError):
    """Lanzada cuando ya existe un factor con el mismo nombre en la dimensión."""
    pass


class FactorCannotBeDeletedError(GuiosDomainError):
    """Lanzada cuando se intenta eliminar un factor protegido (base, con subfactores o evaluaciones)."""
    pass


class SubfactorNotFoundError(GuiosDomainError):
    """Lanzada cuando un subfactor no existe."""
    pass


class SubfactorAlreadyExistsError(GuiosDomainError):
    """Lanzada cuando ya existe un subfactor con la misma descripción en el factor."""
    pass


class SubfactorCannotBeDeletedError(GuiosDomainError):
    """Lanzada cuando se intenta eliminar un subfactor protegido (base o con evaluaciones asociadas)."""
    pass


class EvaluationNotFoundError(GuiosDomainError):
    """Lanzada cuando una evaluación no existe."""
    pass


class EvaluationAlreadyCompletedError(GuiosDomainError):
    """Lanzada cuando se intenta modificar una evaluación que ya está finalizada."""
    pass


class EvaluationInvalidStateError(GuiosDomainError):
    """Lanzada cuando una acción no es válida para el estado actual de la evaluación."""
    pass


class EvaluationValidationError(GuiosDomainError):
    """Lanzada cuando los datos de entrada para un cálculo o fase de evaluación son inválidos."""
    pass

