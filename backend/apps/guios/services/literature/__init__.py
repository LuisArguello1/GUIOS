"""
apps/guios/services/literature
Módulo de recolección de literatura científica y fuentes bibliográficas.
"""
from .openalex import AcademicWork, OpenAlexClient, clean_doi, reconstruct_abstract

__all__ = [
    "AcademicWork",
    "OpenAlexClient",
    "clean_doi",
    "reconstruct_abstract",
]

