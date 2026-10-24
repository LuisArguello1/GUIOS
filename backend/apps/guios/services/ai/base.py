"""
apps/guios/services/ai/base.py
───────────────────────────────────────────────────────────────────────────────
Definición de la interfaz abstracta (Strategy Pattern) para proveedores de IA en GUIOS.
Cualquier motor de IA (Gemini, OpenAI, Heurístico) debe implementar estos 4 métodos
correspondientes a los hitos metodológicos de la guía.
"""
from abc import ABC, abstractmethod
from typing import Any


class BaseAIProvider(ABC):
    """
    Contrato base que todo proveedor de Inteligencia Artificial debe implementar.
    """

    @abstractmethod
    def search_literature_and_citations(
        self,
        software_name: str,
        software_category: str,
        software_repo_url: str | None,
        software_description: str,
        subfactors_data: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Paso 0 / Fase 2: Búsqueda y conteo de citas científicas por subfactor.
        
        Args:
            software_name: Nombre del software candidato (ej. "PostgreSQL").
            software_category: Categoría metodológica (ej. "Base de Datos").
            software_repo_url: URL pública al repositorio (ej. "github.com/postgres/postgres").
            software_description: Descripción funcional o arquitectónica.
            subfactors_data: Lista de diccionarios con:
                - 'id': int
                - 'factor_id': int
                - 'factor_name': str
                - 'description': str
                - 'keywords_ia': str
                - 'base_citations_count': int
                
        Returns:
            dict con estructura:
            {
                "citations_by_subfactor": {subfactor_id: int},
                "sources_by_factor": {factor_id: [{"title": str, "url": str, "snippet": str, "doi": str}]},
                "provider_info": str
            }
        """
        pass

    @abstractmethod
    def suggest_factor_importance(
        self,
        factor_name: str,
        factor_scope: str,
        is_suggested: int,
        org_sector: str,
        org_description: str,
        software_name: str,
    ) -> dict[str, Any]:
        """
        Paso 1-2: Sugerencia asistida de la Importancia del Decisor (ID: 1 a 4).
        
        Returns:
            {
                "suggested_id": int (1 a 4),
                "justification": str
            }
        """
        pass

    @abstractmethod
    def suggest_subfactor_rating(
        self,
        subfactor_description: str,
        factor_name: str,
        software_name: str,
        software_category: str,
        software_description: str,
    ) -> dict[str, Any]:
        """
        Paso 3-4: Sugerencia de calificación de cumplimiento (1 a 4) para un subfactor.
        
        Returns:
            {
                "suggested_rating": int (1 a 4),
                "justification": str
            }
        """
        pass

    @abstractmethod
    def generate_executive_summary_and_verdict(
        self,
        software_name: str,
        org_name: str,
        org_sector: str,
        recommendation: str,
        explanation_text: str,
        weaknesses: list[dict[str, Any]],
        strengths: list[dict[str, Any]],
        ir_summary: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Paso 5-6: Generación del Resumen Ejecutivo para la Alta Dirección y Plan de Mitigación.
        
        Returns:
            {
                "executive_summary": str,
                "mitigation_plan": str
            }
        """
        pass
