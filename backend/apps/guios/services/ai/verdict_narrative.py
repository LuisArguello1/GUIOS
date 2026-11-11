"""
Redacción del resumen ejecutivo y del plan de mitigación.

La letra A, B o C ya la decidió el motor. Este módulo solo pide una narración
con los factores calificados. Si el modelo no responde, se usa el texto predeterminado.
"""

import json
from typing import Any

# qwen3 y command-r admiten varios miles de tokens de salida.
# El dictamen pide un informe breve, no un párrafo de 90 palabras.
VERDICT_MAX_TOKENS = 4096

VERDICT_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "guios_verdict_narrative",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "executive_summary": {"type": "string"},
                "mitigation_plan": {"type": "string"},
            },
            "required": ["executive_summary", "mitigation_plan"],
        },
    },
}

RECOMMENDATION_TITLES = {
    "A": "Recomendación A: Adoptar sin observaciones",
    "B": "Recomendación B: Es posible adoptar, con matices",
    "C": "Recomendación C: Se sugiere analizar la adopción y posponerla",
}


def build_verdict_prompts(
    *,
    software_name: str,
    software_category: str,
    software_description: str,
    org_name: str,
    org_sector: str,
    org_description: str,
    recommendation: str,
    explanation_text: str,
    factors: list[dict[str, Any]],
) -> tuple[str, str]:
    title = RECOMMENDATION_TITLES.get(recommendation, f"Recomendación {recommendation}")
    compact_factors = [
        {
            "factor": item.get("factor") or item.get("factor_name"),
            "pm": item.get("pm"),
            "foda": item.get("foda"),
            "ir": item.get("ir"),
            "supera_umbral": bool(item.get("supera_umbral")),
        }
        for item in factors
    ]
    system_prompt = (
        "Eres el redactor del informe de adopción FLOSS de la guía GUIOS. "
        "Escribes para la alta dirección, en español claro y sin jerga innecesaria. "
        "Todo el informe va en español. No uses inglés. "
        "La recomendación A, B o C ya está decidida por el motor matemático. "
        "No la cambies, no la discutas y no inventes factores, promedios ni evidencias. "
        "Usa únicamente los datos que se te entregan. "
        "Responde solo un objeto JSON válido."
    )
    user_prompt = f"""
CONTEXTO
- Organización: {org_name}
- Sector: {org_sector or "No especificado"}
- Necesidad de la organización: {org_description or "No especificada"}
- Software candidato: {software_name}
- Categoría: {software_category or "General"}
- Descripción del software: {software_description or "No especificada"}

DICTAMEN YA CALCULADO (no se modifica)
- Código: {recommendation}
- Nombre: {title}
- Texto metodológico: {explanation_text}

FACTORES YA CALIFICADOS EN LOS PASOS ANTERIORES
Cada PM es la ponderación media de 1 a 4. El umbral es 3.0.
IR es la importancia relativa: 2 opcional, 3 importante, 4 fundamental.
{json.dumps(compact_factors, ensure_ascii=False, separators=(",", ":"))}

QUÉ DEBES REDACTAR
Escribe para alguien que va a decidir la adopción y no estuvo en la evaluación.
Entre 280 y 380 palabras en total, en Markdown, con los datos de la lista y nada más.

1. executive_summary
   - Empieza con la organización, el sector, el software y la recomendación {recommendation}. La letra sigue siendo {recommendation}.
   - Explica en prosa qué significa esa letra con el texto metodológico, sin repetirlo como consigna.
   - Sección "Qué sostiene la adopción": nombra los factores que superan el umbral, con su PM, FODA e IR, y qué capacidad dejan cubierta.
   - Sección "Qué condiciona la decisión": nombra los que quedan por debajo, con PM, FODA e IR, y qué riesgo concreto dejan abierto para esta organización.
   - Cierra con la consecuencia práctica: adoptar, adoptar con condiciones, o posponer, según la letra {recommendation}.

2. mitigation_plan
   - Un bloque por cada factor con PM menor a 3.0. En cada bloque: la brecha, dos acciones que la organización puede ejecutar con ese software (configuración, piloto, procedimiento o formación) y cómo comprobar que el factor volvió a superar 3.0.
   - Si todos superan el umbral, escribe un seguimiento de puesta en marcha: qué vigilar en los factores de IR 4, cómo confirmar que el PM se mantiene y cuándo repetir la evaluación.
   - No uses una sola frase genérica.

PROHIBIDO
- Cambiar la recomendación.
- Mencionar un factor que no esté en la lista.
- Inventar costos, plazos, proveedores o citas que no aparezcan en los datos.

RESPONDE ÚNICAMENTE ESTE JSON:
{{
  "executive_summary": "Markdown",
  "mitigation_plan": "Markdown"
}}
"""
    return system_prompt, user_prompt


def parse_verdict_narrative(data: dict[str, Any] | None) -> dict[str, str]:
    payload = data or {}
    return {
        "executive_summary": str(payload.get("executive_summary", "")).strip(),
        "mitigation_plan": str(payload.get("mitigation_plan", "")).strip(),
    }


def build_predetermined_narrative(
    *,
    software_name: str,
    org_name: str,
    org_sector: str,
    recommendation: str,
    explanation_text: str,
    factors: list[dict[str, Any]],
) -> dict[str, str]:
    """Texto del motor, usado cuando la IA no responde o la evaluación va sin asistencia."""
    title = RECOMMENDATION_TITLES.get(recommendation, f"Recomendación {recommendation}")
    positive = [item for item in factors if item.get("supera_umbral")]
    negative = [item for item in factors if not item.get("supera_umbral")]

    def _factor_line(item: dict[str, Any]) -> str:
        name = item.get("factor") or item.get("factor_name") or "Factor"
        pm = item.get("pm", "")
        foda = item.get("foda", "")
        ir = item.get("ir", "")
        return f"**{name}** ({foda}, PM {pm}, IR {ir})"

    strength_text = (
        ", ".join(_factor_line(item) for item in positive)
        if positive
        else "ningún factor relevante supera hoy el umbral de 3.0"
    )
    executive_summary = (
        f"### Dictamen de adopción\n\n"
        f"{org_name} ({org_sector or 'Sector no especificado'}) evaluó {software_name} "
        f"con la guía GUIOS. El motor fija **{title}**. {explanation_text}\n\n"
        f"### Qué sostiene la adopción\n\n"
        f"{strength_text}. Esos promedios salen de las calificaciones ya registradas "
        f"y no cambian la letra {recommendation}.\n\n"
        f"### Qué condiciona la decisión\n\n"
        f"Factores por debajo del umbral: {len(negative)}. "
        f"Factores que lo superan: {len(positive)}. "
        f"La decisión práctica es mantener la recomendación {recommendation} "
        f"y tratar primero las brechas que siguen abiertas."
    )

    if not negative:
        watched = ", ".join(_factor_line(item) for item in positive) or software_name
        mitigation_plan = (
            "### Seguimiento de la puesta en marcha\n\n"
            "No hay debilidades ni amenazas en los factores relevantes. "
            "No se requiere un plan correctivo previo.\n\n"
            f"- Confirme en un piloto que se mantienen los factores de mayor peso: {watched}.\n"
            "- Defina un responsable de la adopción y un criterio de vuelta atrás si un factor cae por debajo de 3.0.\n"
            "- Repita la evaluación cuando cambie la versión del software o el uso previsto en la organización."
        )
    else:
        lines = []
        for item in negative:
            name = item.get("factor") or item.get("factor_name") or "Factor"
            pm = item.get("pm", "")
            foda = item.get("foda", "")
            ir = item.get("ir", "")
            lines.append(
                f"### {name}\n\n"
                f"Brecha: queda como {foda} con PM {pm} e IR {ir}. "
                f"Ese promedio está bajo 3.0 y condiciona ampliar el uso de {software_name}.\n\n"
                f"- Acote un piloto donde se pruebe solo este factor y se documente qué falla hoy.\n"
                f"- Asigne un responsable que cierre la brecha de {name} antes de extender el despliegue.\n"
                f"- Vuelva a calificar {name}. El factor queda atendido cuando su PM supere 3.0."
            )
        mitigation_plan = "### Plan de mitigación\n\n" + "\n\n".join(lines)

    return {
        "executive_summary": executive_summary,
        "mitigation_plan": mitigation_plan,
    }
