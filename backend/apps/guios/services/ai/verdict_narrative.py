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
                "mitigation_rows": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "factor": {"type": "string"},
                            "riesgo_metodologico": {"type": "string"},
                            "accion_correctiva": {"type": "string"},
                            "responsable": {"type": "string"},
                            "meta_aprobacion": {"type": "string"},
                        },
                        "required": [
                            "factor",
                            "riesgo_metodologico",
                            "accion_correctiva",
                            "responsable",
                            "meta_aprobacion",
                        ],
                    },
                },
            },
            "required": ["executive_summary", "mitigation_rows"],
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
            **({"dimension": item["dimension"]} if item.get("dimension") else {}),
            **({"subfactor_critico": item["subfactor_critico"]} if item.get("subfactor_critico") else {}),
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

2. mitigation_rows (lista de objetos estructurados compatibles con tabla y reporte narrativo: Factor / Brecha, Riesgo Metodológico, Acción Correctiva, Responsable, Meta de Aprobación)
   - Genera un objeto por cada factor con PM menor a 3.0 (prioriza mayor IR primero).
   - Si todos los factores superan 3.0, genera objetos de vigilancia preventiva para los factores críticos con IR >= 3 (o los de mayor IR) explicando qué vigilar en la puesta en marcha y cómo confirmar que el PM se mantiene >= 3.0.
   - Campos obligatorios en cada objeto (en español, específicos para {software_name} y la organización, sin frases genéricas):
     * "factor": nombre EXACTO del factor tal como aparece en FACTORES.
     * "riesgo_metodologico": brecha concreta detectada (menciona el subfactor crítico si está en los datos) y su riesgo técnico u organizacional.
     * "accion_correctiva": acción práctica y ejecutable con {software_name} (configuración, piloto acotado, procedimiento o formación) para cerrar la brecha.
     * "responsable": área o rol responsable concreto (ej. "Arquitectura TI", "Seguridad de la Información", "Líder Funcional / Gestión del Cambio", "Infraestructura y Soporte").
     * "meta_aprobacion": criterio verificable de cumplimiento y meta PM >= 3.0 en el factor.

PROHIBIDO
- Cambiar la recomendación.
- Mencionar un factor que no esté en la lista.
- Inventar costos, plazos no provistos en los datos, proveedores o citas inexistentes.

RESPONDE ÚNICAMENTE ESTE JSON:
{{
  "executive_summary": "Markdown",
  "mitigation_rows": [
    {{
      "factor": "Nombre exacto del factor",
      "riesgo_metodologico": "Riesgo y brecha concreta",
      "accion_correctiva": "Acción concreta con el software",
      "responsable": "Área o rol responsable",
      "meta_aprobacion": "Criterio verificable y PM >= 3.0"
    }}
  ]
}}
"""
    return system_prompt, user_prompt


def _clean_single_line(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _fold_label(text: str) -> str:
    import unicodedata

    cleaned = str(text or "").strip().replace("**", "").replace("__", "").lower()
    normalized = unicodedata.normalize("NFD", cleaned)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def default_responsible_for_factor(
    factor_name: str,
    dimension: str = "",
    scope: str = "",
) -> str:
    """Infiere un rol/área responsable coherente para factores sin responsable explícito."""
    text = _fold_label(f"{dimension} {factor_name}")
    if any(k in text for k in ("segur", "privac", "cumplim", "normativ", "riesgo", "licenc")):
        return "Seguridad de la Información y Cumplimiento"
    if any(k in text for k in ("infra", "desplieg", "rendim", "escalab", "fiab", "disponib", "calidad")):
        return "Infraestructura y Operaciones TI"
    if any(k in text for k in ("comun", "soporte", "proveed", "ecosist", "madurez", "document")):
        return "Gobernanza Tecnológica y Soporte"
    if any(k in text for k in ("capacit", "formac", "cultur", "usabil", "cambio", "organiz", "equipo")):
        return "Gestión del Cambio y Talento"
    if _fold_label(scope) == "external":
        return "Gobernanza Tecnológica y Adquisiciones"
    return "Arquitectura y Liderazgo Técnico"


def format_mitigation_rows_markdown(
    rows: list[dict[str, Any]],
    *,
    heading: str = "Plan de mitigación",
    intro: str = "",
) -> str:
    """Serializa filas estructuradas de mitigación en Markdown canónico legible."""
    blocks: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        factor = _clean_single_line(row.get("factor") or row.get("factor_name"))
        riesgo = _clean_single_line(row.get("riesgo_metodologico") or row.get("riesgo"))
        accion = _clean_single_line(row.get("accion_correctiva") or row.get("accion"))
        responsable = _clean_single_line(row.get("responsable"))
        meta = _clean_single_line(row.get("meta_aprobacion") or row.get("meta"))
        if not factor or not any((riesgo, accion, responsable, meta)):
            continue
        lines = [f"### {factor}"]
        if riesgo:
            lines.append(f"- **Riesgo Metodológico:** {riesgo}")
        if accion:
            lines.append(f"- **Acción Correctiva:** {accion}")
        if responsable:
            lines.append(f"- **Responsable:** {responsable}")
        if meta:
            lines.append(f"- **Meta de Aprobación:** {meta}")
        blocks.append("\n".join(lines))

    if not blocks:
        return ""

    parts: list[str] = []
    if heading:
        parts.append(f"### {heading}")
    if intro:
        parts.append(intro.strip())
    parts.extend(blocks)
    return "\n\n".join(parts)


def parse_mitigation_plan_sections(text: str) -> dict[str, dict[str, str]]:
    """
    Extrae filas estructuradas desde Markdown canónico (o tablas/bloques legados),
    indexadas por nombre normalizado de factor.
    """
    sections: dict[str, dict[str, str]] = {}
    if not text or not str(text).strip():
        return sections

    raw_text = str(text).strip()
    ignored_headings = {
        "plan de mitigacion",
        "plan de mitigacion de brechas metodologicas",
        "seguimiento de la puesta en marcha",
    }

    # 1. Soporte para bloques encabezados con ### / **Factor**
    current_key = ""
    current_row: dict[str, str] | None = None

    def _flush() -> None:
        nonlocal current_key, current_row
        if current_key and current_row:
            sections[current_key] = current_row
        current_key = ""
        current_row = None

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # Fila de tabla Markdown: | Factor | Riesgo | Acción | Responsable | Meta |
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip().replace("**", "").replace("__", "") for c in line.strip("|").split("|")]
            if len(cells) >= 4 and not all(set(c) <= set("-: ") for c in cells):
                first_folded = _fold_label(cells[0])
                if first_folded.startswith("factor") or first_folded in ignored_headings:
                    continue
                if len(cells) >= 5:
                    sections[first_folded] = {
                        "factor": cells[0],
                        "riesgo_metodologico": cells[1],
                        "accion_correctiva": cells[2],
                        "responsable": cells[3],
                        "meta_aprobacion": cells[4],
                    }
                else:
                    sections[first_folded] = {
                        "factor": cells[0],
                        "riesgo_metodologico": cells[1],
                        "accion_correctiva": cells[2],
                        "responsable": "",
                        "meta_aprobacion": cells[3],
                    }
            continue

        is_h3 = line.startswith("### ") or line.startswith("## ")
        is_bold_heading = (
            line.startswith("**")
            and line.endswith("**")
            and ":" not in line
            and len(line) > 4
        )
        if is_h3 or is_bold_heading:
            heading_name = line.lstrip("# ").strip().replace("**", "").replace("__", "").strip()
            heading_folded = _fold_label(heading_name)
            _flush()
            if heading_folded and heading_folded not in ignored_headings:
                current_key = heading_folded
                current_row = {
                    "factor": heading_name,
                    "riesgo_metodologico": "",
                    "accion_correctiva": "",
                    "responsable": "",
                    "meta_aprobacion": "",
                }
            continue

        if current_row is None:
            continue

        cleaned_line = line.lstrip("-*• ").strip()
        plain_line = cleaned_line.replace("**", "").replace("__", "").strip()
        folded_line = _fold_label(plain_line)

        if ":" in plain_line:
            label_part, value_part = plain_line.split(":", 1)
            label_folded = _fold_label(label_part)
            val = value_part.strip()
            if label_folded.startswith(("riesgo", "brecha", "impacto")):
                current_row["riesgo_metodologico"] = (
                    f"{current_row['riesgo_metodologico']} {val}".strip()
                    if current_row["riesgo_metodologico"]
                    else val
                )
                continue
            if label_folded.startswith(("accion", "medida", "solucion")):
                current_row["accion_correctiva"] = (
                    f"{current_row['accion_correctiva']} {val}".strip()
                    if current_row["accion_correctiva"]
                    else val
                )
                continue
            if label_folded.startswith(("responsable", "area", "rol")):
                current_row["responsable"] = val
                continue
            if label_folded.startswith(("meta", "indicador", "criterio", "objetivo", "verificacion")):
                current_row["meta_aprobacion"] = val
                continue

        # Fallback para bullets legados sin etiqueta explícita
        if line.startswith(("-", "*", "•")):
            if not current_row["accion_correctiva"] and not any(
                k in folded_line for k in ("pm supere", "reevaluar", "vuelva a calificar", "umbral")
            ):
                current_row["accion_correctiva"] = plain_line
            elif not current_row["meta_aprobacion"]:
                current_row["meta_aprobacion"] = plain_line
        elif not current_row["riesgo_metodologico"]:
            current_row["riesgo_metodologico"] = plain_line

    _flush()
    return sections


def parse_verdict_narrative(data: dict[str, Any] | None) -> dict[str, str]:
    payload = data or {}
    mitigation_rows = payload.get("mitigation_rows")
    mitigation_plan = ""
    if isinstance(mitigation_rows, list) and mitigation_rows:
        mitigation_plan = format_mitigation_rows_markdown(mitigation_rows)
    if not mitigation_plan:
        mitigation_plan = str(payload.get("mitigation_plan", "")).strip()
    return {
        "executive_summary": str(payload.get("executive_summary", "")).strip(),
        "mitigation_plan": mitigation_plan,
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
    relevant_factors = [
        item for item in factors
        if item.get("es_relevante") is not False
        and (item.get("ir") is None or int(item.get("ir") or 0) > 1)
    ]
    positive = [item for item in relevant_factors if item.get("supera_umbral")]
    negative = [item for item in relevant_factors if not item.get("supera_umbral")]

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
        watched_items = [item for item in positive if int(item.get("ir") or 0) >= 3][:4] or positive[:4]
        watched_rows = []
        for item in watched_items:
            name = str(item.get("factor") or item.get("factor_name") or "Factor")
            pm = item.get("pm", "")
            foda = item.get("foda", "")
            ir = item.get("ir", "")
            dimension = str(item.get("dimension") or "")
            alcance = str(item.get("alcance") or "")
            watched_rows.append({
                "factor": name,
                "riesgo_metodologico": (
                    f"Factor favorable ({foda}, PM {pm}, IR {ir}) que requiere vigilancia "
                    f"continua para sostener el nivel de adopción en {software_name}."
                ),
                "accion_correctiva": (
                    f"Incluir {name} en revisiones periódicas de piloto y operación con {software_name}, "
                    f"verificando estabilidad ante cambios de versión o alcance."
                ),
                "responsable": default_responsible_for_factor(name, dimension, alcance),
                "meta_aprobacion": f"Sostener PM >= 3.00 en {name} durante la puesta en marcha.",
            })
        mitigation_plan = format_mitigation_rows_markdown(
            watched_rows,
            heading="Seguimiento de la puesta en marcha",
            intro=(
                "No hay debilidades ni amenazas en los factores relevantes. "
                "No se requiere un plan correctivo previo; se establece vigilancia preventiva."
            ),
        ) or (
            "### Seguimiento de la puesta en marcha\n\n"
            "No hay debilidades ni amenazas en los factores relevantes. "
            "No se requiere un plan correctivo previo.\n\n"
            f"- Confirme en un piloto que se mantienen los factores de mayor peso ({software_name}).\n"
            "- Defina un responsable de la adopción y un criterio de vuelta atrás si un factor cae por debajo de 3.0.\n"
            "- Repita la evaluación cuando cambie la versión del software o el uso previsto en la organización."
        )
    else:
        breach_rows = []
        for item in negative:
            name = str(item.get("factor") or item.get("factor_name") or "Factor")
            pm = item.get("pm", "")
            foda = item.get("foda", "")
            ir = item.get("ir", "")
            dimension = str(item.get("dimension") or "")
            alcance = str(item.get("alcance") or "")
            sub_crit = _clean_single_line(item.get("subfactor_critico"))
            sub_note = f" Subfactor crítico: {sub_crit}." if sub_crit else ""
            breach_rows.append({
                "factor": name,
                "riesgo_metodologico": (
                    f"Brecha registrada como {foda} (PM {pm} < 3.0, IR {ir}) que condiciona "
                    f"ampliar el uso de {software_name}.{sub_note}"
                ),
                "accion_correctiva": (
                    f"Acotar un piloto técnico sobre {name} en {software_name}, documentar la causa "
                    f"de la brecha y aplicar ajuste de configuración o capacitación antes de extender el despliegue."
                ),
                "responsable": default_responsible_for_factor(name, dimension, alcance),
                "meta_aprobacion": f"Reevaluar {name} y superar el umbral metodológico con PM >= 3.00.",
            })
        mitigation_plan = format_mitigation_rows_markdown(
            breach_rows,
            heading="Plan de mitigación",
        )

    return {
        "executive_summary": executive_summary,
        "mitigation_plan": mitigation_plan,
    }
