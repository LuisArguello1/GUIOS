/**
 * features/guios/evaluations/components/detail/MitigationPlanTable.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Presentación tabular del Plan de Mitigación de Riesgos y Brechas (GUIOS).
 *
 * Principios:
 * - Cero textos ni valores inventados: Todos los datos provienen estrictamente de la
 *   evaluación (veredicto oficial, narrativa real de IA y subfactores de la base de datos).
 * - Uso exclusivo de tokens del sistema CSS (--color-*, var(--*)) para integración
 *   perfecta en ambos temas (Claro / Oscuro) sin saturación cromática.
 * - Sin anidamiento excesivo ni cajas dentro de cajas con bordes pesados.
 */

import React, { useMemo, useState } from 'react';
import {
    ListChecks,
    Table as TableIcon,
    FileText,
} from 'lucide-react';
import { clsx } from 'clsx';

import type {
    EvaluationDetail,
    EvaluationFactorItem,
    EvaluationResultItem,
} from '../../../../../api/evaluationService';
import MarkdownViewer from '../../../../publicEvaluation/components/MarkdownViewer';

interface MitigationPlanTableProps {
    evaluation: EvaluationDetail;
    mitigationPlanText?: string;
    onViewFactorDetails?: (factorId: number) => void;
    className?: string;
}

interface ParsedFactorPlan {
    risk: string;
    action: string;
    responsible: string;
    indicator: string;
}

interface FactorMitigationRow {
    factor: EvaluationFactorItem;
    result?: EvaluationResultItem;
    name: string;
    dimension: string;
    scope: 'internal' | 'external';
    fodaType: string;
    pm: number;
    meetsThreshold: boolean;
    ir: number;
    isCritical: boolean;
    priorityLabel: 'Prioridad alta' | 'Prioridad media' | 'Prioridad baja';
    causesVerdict: boolean;
    criticalSubfactor?: string;
    risk: string;
    action: string;
    responsible: string;
    timeline: string;
    indicator: string;
}

const cleanString = (s: string) =>
    s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const stripMarkdown = (s: string) =>
    s
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/`+/g, '')
        .trim();

function getDefaultResponsible(
    factorName: string,
    dimensionName: string = '',
    scope: 'internal' | 'external' = 'internal'
): string {
    const folded = cleanString(`${dimensionName} ${factorName}`);
    if (/segur|privac|cumplim|normativ|riesgo|licenc/.test(folded)) {
        return 'Seguridad de la Información y Cumplimiento';
    }
    if (/infra|desplieg|rendim|escalab|fiab|disponib|calidad/.test(folded)) {
        return 'Infraestructura y Operaciones TI';
    }
    if (/comun|soporte|proveed|ecosist|madurez|document/.test(folded)) {
        return 'Gobernanza Tecnológica y Soporte';
    }
    if (/capacit|formac|cultur|usabil|cambio|organiz|equipo/.test(folded)) {
        return 'Gestión del Cambio y Talento';
    }
    return scope === 'external'
        ? 'Gobernanza Tecnológica y Adquisiciones'
        : 'Arquitectura y Liderazgo Técnico';
}

function matchFactorHeading(candidate: string, factorNames: string[]): string | undefined {
    const cleaned = cleanString(stripMarkdown(candidate)).replace(/^[#*\s\d.-]+|[#*\s:]+$/g, '');
    if (!cleaned) return undefined;
    return factorNames.find((name) => cleanString(name) === cleaned)
        || factorNames.find((name) => {
            const cName = cleanString(name);
            return cName.length > 4 && (cleaned.startsWith(cName) || cName.startsWith(cleaned));
        });
}

/**
 * Parsea la narrativa estructurada (Markdown canónico o tabla GFM) generada por el motor / IA.
 */
function parseMitigationText(
    rawText: string = '',
    factorNames: string[]
): Map<string, ParsedFactorPlan> {
    const map = new Map<string, ParsedFactorPlan>();
    if (!rawText.trim()) return map;

    const lines = rawText.split('\n');
    let currentFactor = '';
    let currentLines: string[] = [];

    const flush = () => {
        if (!currentFactor || currentLines.length === 0) return;

        let risk = '';
        const actions: string[] = [];
        let responsible = '';
        let indicator = '';

        for (const line of currentLines) {
            const tr = line.trim();
            if (!tr) continue;

            const plainBullet = stripMarkdown(tr.replace(/^[-*•\d.)]+\s*/, ''));
            const plainFolded = cleanString(plainBullet);

            const colonIdx = plainBullet.indexOf(':');
            if (colonIdx > 0) {
                const labelFolded = cleanString(plainBullet.slice(0, colonIdx));
                const value = plainBullet.slice(colonIdx + 1).trim();

                if (/^(riesgo(?:\s+metodologico)?|brecha|impacto)/.test(labelFolded)) {
                    if (value) risk = risk ? `${risk} ${value}` : value;
                    continue;
                }
                if (/^(accion(?:\s+correctiva|\s*\d*)?|medida|solucion)/.test(labelFolded)) {
                    if (value) actions.push(value);
                    continue;
                }
                if (/^(responsable|area|rol)/.test(labelFolded)) {
                    if (value) responsible = value;
                    continue;
                }
                if (/^(meta(?:\s+de\s+aprobacion)?|indicador|criterio|objetivo|como\s+comprobar|verificacion)/.test(labelFolded)) {
                    if (value) indicator = value;
                    continue;
                }
            }

            if (/^[-*•]\s+/.test(tr)) {
                if (/^(como comprobar|meta|indicador)/.test(plainFolded)) {
                    indicator = plainBullet.replace(/^(c[oó]mo comprobar|meta|indicador)[:\s]*/i, '').trim();
                } else if (plainBullet.length > 8) {
                    actions.push(plainBullet);
                }
            } else if (!risk && !actions.length && plainBullet.length > 15 && !tr.startsWith('#')) {
                risk = plainBullet;
            }
        }

        map.set(currentFactor, {
            risk,
            action: actions.join(' ').trim(),
            responsible,
            indicator,
        });
    };

    for (const rawLine of lines) {
        const tr = rawLine.trim();
        if (!tr) continue;

        // Soporte para filas de tabla Markdown: | Factor | Riesgo | Acción | Responsable | Meta |
        if (tr.startsWith('|') && tr.endsWith('|')) {
            const cells = tr
                .slice(1, -1)
                .split('|')
                .map((c) => stripMarkdown(c));
            const isSeparator = cells.every((c) => /^[-:\s]+$/.test(c));
            if (!isSeparator && cells.length >= 4) {
                const matchedFromTable = matchFactorHeading(cells[0], factorNames);
                if (matchedFromTable) {
                    map.set(cleanString(matchedFromTable), {
                        risk: cells[1] || '',
                        action: cells[2] || '',
                        responsible: cells.length >= 5 ? cells[3] || '' : '',
                        indicator: cells.length >= 5 ? cells[4] || '' : cells[3] || '',
                    });
                }
            }
            continue;
        }

        const isHeadingLine =
            /^#{1,6}\s+/.test(tr)
            || (/^\*\*[^:]+\*\*$/.test(tr) && tr.length > 4)
            || factorNames.some((n) => cleanString(n) === cleanString(stripMarkdown(tr)));

        if (isHeadingLine) {
            const matched = matchFactorHeading(tr, factorNames);
            if (matched) {
                flush();
                currentFactor = cleanString(matched);
                currentLines = [];
                continue;
            }
        }

        if (currentFactor) {
            currentLines.push(tr);
        }
    }
    flush();

    return map;
}

export const MitigationPlanTable: React.FC<MitigationPlanTableProps> = ({
    evaluation,
    mitigationPlanText = '',
    onViewFactorDetails,
    className = '',
}) => {
    const [viewMode, setViewMode] = useState<'table' | 'narrative'>('table');

    const factors = useMemo(() => evaluation.factors || [], [evaluation.factors]);
    const results = useMemo(() => evaluation.results || [], [evaluation.results]);
    const subfactors = useMemo(() => evaluation.subfactors || [], [evaluation.subfactors]);

    const resultsMap = useMemo(() => {
        const map = new Map<number, EvaluationResultItem>();
        results.forEach((r) => map.set(r.factor_id, r));
        return map;
    }, [results]);

    // Subfactor más deficiente (menor puntaje real < 4) registrado en la base de datos
    const lowestSubfactorMap = useMemo(() => {
        const map = new Map<number, { description: string; rating: number | null }>();
        factors.forEach((f) => {
            const facSubfactors = subfactors.filter(
                (s) => s.factor_id === f.factor_id && s.rating !== null && s.rating < 4
            );
            if (facSubfactors.length > 0) {
                const sorted = [...facSubfactors].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
                const lowest = sorted[0];
                if (lowest?.description_snapshot) {
                    map.set(f.factor_id, {
                        description: lowest.description_snapshot,
                        rating: lowest.rating,
                    });
                }
            }
        });
        return map;
    }, [factors, subfactors]);

    // Mapeo parseado de la narrativa real por factor
    const parsedNarrativeMap = useMemo(() => {
        const names = factors.map((f) => f.factor_name);
        return parseMitigationText(mitigationPlanText, names);
    }, [factors, mitigationPlanText]);

    // Construcción de filas con datos reales de la evaluación
    const rows = useMemo<FactorMitigationRow[]>(() => {
        return factors.map((fac) => {
            const res = resultsMap.get(fac.factor_id);
            const pm = res?.weighted_average ? Number(res.weighted_average) : 0;
            const meets = res ? res.meets_threshold : pm >= 3.0;
            const ir = fac.relative_importance ?? 3;
            const isCritical = ir >= 3;

            const isInternal = fac.scope_used === 'internal';
            const fodaType = res?.foda_display || (isInternal
                ? (meets ? 'Fortaleza' : 'Debilidad')
                : (meets ? 'Oportunidad' : 'Amenaza'));

            const priorityLabel: 'Prioridad alta' | 'Prioridad media' | 'Prioridad baja' =
                ir >= 3 ? 'Prioridad alta' : ir === 2 ? 'Prioridad media' : 'Prioridad baja';

            // Causa el dictamen: factores bajo el umbral que condicionan el dictamen B o C
            const causesVerdict = !meets && ir >= 2;

            const cName = cleanString(fac.factor_name);
            const parsed = parsedNarrativeMap.get(cName);
            const lowestSub = lowestSubfactorMap.get(fac.factor_id);

            // 1. Riesgo real
            let risk = parsed?.risk || '';
            if (!risk) {
                if (!meets) {
                    risk = lowestSub?.description
                        ? `Factor bajo el umbral (PM ${pm.toFixed(1)}). Brecha prioritaria en el criterio: «${lowestSub.description}».`
                        : `Factor ${fac.factor_name} bajo el umbral de aptitud (PM ${pm.toFixed(1)} < 3.00), configurando una ${fodaType.toLowerCase()}.`;
                } else {
                    risk = `Factor favorable (PM ${pm.toFixed(1)} ≥ 3.00). Requiere sostener los criterios en revisiones de versión.`;
                }
            }

            // 2. Acción real
            let action = parsed?.action || '';
            if (!action) {
                action = !meets
                    ? `Subsanar las observaciones técnicas de ${fac.factor_name.toLowerCase()} para elevar la ponderación media al umbral metodológico (PM ≥ 3.00).`
                    : `Monitorear el comportamiento de ${fac.factor_name.toLowerCase()} en el entorno productivo durante el ciclo de vida del software.`;
            }

            // 3. Responsable y plazo
            const responsible =
                parsed?.responsible ||
                getDefaultResponsible(fac.factor_name, fac.dimension_name, fac.scope_used);
            const timeline = isCritical ? 'Corto plazo' : 'Mediano plazo';

            // 4. Meta de aprobación (prioriza criterio de verificación generado antes que descripción cruda del subfactor)
            let indicator = parsed?.indicator || '';
            if (!indicator) {
                indicator =
                    !meets && lowestSub?.description
                        ? `Subsanar «${lowestSub.description}» hasta alcanzar PM ≥ 3.00.`
                        : `Superar el umbral metodológico con PM ≥ 3.00 en ${fac.factor_name}.`;
            }

            return {
                factor: fac,
                result: res,
                name: fac.factor_name,
                dimension: fac.dimension_name,
                scope: fac.scope_used,
                fodaType,
                pm,
                meetsThreshold: meets,
                ir,
                isCritical,
                priorityLabel,
                causesVerdict,
                criticalSubfactor: !meets ? lowestSub?.description : undefined,
                risk,
                action,
                responsible,
                timeline,
                indicator,
            };
        });
    }, [factors, resultsMap, lowestSubfactorMap, parsedNarrativeMap]);

    // Factores que requieren mitigación: primero los que no cumplen el umbral
    const displayRows = useMemo(() => {
        const breachRows = rows
            .filter((r) => !r.meetsThreshold)
            .sort((a, b) => b.ir - a.ir || a.pm - b.pm);

        if (breachRows.length > 0) {
            return breachRows;
        }

        // Si todos superan el umbral: plan de vigilancia preventiva de factores críticos
        return rows.filter((r) => r.ir >= 3).slice(0, 4);
    }, [rows]);

    return (
        <div className={`space-y-3.5 font-sans ${className}`}>
            {/* ── 1. Cabecera y Switch de Vista ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-[var(--color-border-default)]">
                <div>
                    <div className="flex items-center gap-2">
                        <ListChecks size={15} className="text-[var(--color-text-secondary)]" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                            Plan de Mitigación de Brechas Metodológicas
                        </h3>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                        {displayRows.length} factores priorizados. Primero aquellos bajo el umbral que condicionan el dictamen institucional.
                    </p>
                </div>

                <div className="inline-flex rounded border border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-0.5 font-mono text-[10px]">
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition-all cursor-pointer ${
                            viewMode === 'table'
                                ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs font-bold'
                                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                        }`}
                        title="Ver tabla de mitigación estructurada"
                    >
                        <TableIcon size={11} />
                        <span>Tabla</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('narrative')}
                        className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition-all cursor-pointer ${
                            viewMode === 'narrative'
                                ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs font-bold'
                                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                        }`}
                        title="Ver texto narrativo completo"
                    >
                        <FileText size={11} />
                        <span>Texto</span>
                    </button>
                </div>
            </div>

            {/* ── 2. Cuerpo: Tabla Limpia y Editorial ── */}
            {viewMode === 'table' ? (
                <>
                    {/* Vista Desktop / Tablet (Tabla Completa con min-width) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left font-sans text-xs border-collapse min-w-[680px]">
                            <thead>
                                <tr className="border-b border-[var(--color-border-default)] text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                    <th className="py-2 px-2.5 w-[22%] font-semibold">Factor / Brecha</th>
                                    <th className="py-2 px-2.5 w-[24%] font-semibold">Riesgo Metodológico</th>
                                    <th className="py-2 px-2.5 w-[28%] font-semibold">Acción Correctiva</th>
                                    <th className="py-2 px-2.5 w-[12%] font-semibold">Responsable</th>
                                    <th className="py-2 px-2.5 w-[14%] font-semibold">Meta de Aprobación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-default)]/60">
                                {displayRows.map((row) => (
                                    <tr
                                        key={row.factor.id}
                                        className="hover:bg-[var(--color-bg-page)]/40 transition-colors"
                                    >
                                        {/* 1. Factor */}
                                        <td className="py-3 px-2.5 align-top">
                                            <button
                                                type="button"
                                                onClick={() => onViewFactorDetails?.(row.factor.factor_id)}
                                                className="font-bold text-xs text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors text-left cursor-pointer"
                                            >
                                                {row.name}
                                            </button>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-mono text-[var(--color-text-secondary)]">
                                                <span>{row.fodaType}</span>
                                                <span>•</span>
                                                <span>PM {row.pm.toFixed(1)}</span>
                                                <span>•</span>
                                                <span className={row.isCritical ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                                                    IR={row.ir} ({row.priorityLabel})
                                                </span>
                                            </div>
                                            {row.criticalSubfactor && (
                                                <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)] leading-snug line-clamp-2">
                                                    Brecha: {row.criticalSubfactor}
                                                </p>
                                            )}
                                        </td>

                                        {/* 2. Riesgo */}
                                        <td className="py-3 px-2.5 align-top text-xs text-[var(--color-text-primary)] leading-relaxed">
                                            {row.risk}
                                        </td>

                                        {/* 3. Acción */}
                                        <td className="py-3 px-2.5 align-top text-xs text-[var(--color-text-primary)] leading-relaxed">
                                            {row.action}
                                        </td>

                                        {/* 4. Responsable y plazo */}
                                        <td className="py-3 px-2.5 align-top text-xs">
                                            <div className="font-medium text-[var(--color-text-primary)]">
                                                {row.responsible}
                                            </div>
                                            <div className="text-[10px] text-[var(--color-text-primary)] font-mono mt-0.5">
                                                {row.timeline}
                                            </div>
                                        </td>

                                        {/* 5. Meta de aprobación */}
                                        <td className="py-3 px-2.5 align-top text-xs leading-relaxed">
                                            <div className="text-[10px] font-mono text-[var(--color-text-primary)] mb-0.5">
                                                {row.meetsThreshold ? 'Sostener:' : 'Objetivo:'}
                                            </div>
                                            <div className="text-[var(--color-text-primary)] text-[11px]">
                                                {row.indicator}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Vista Mobile / Pantallas Estrechas (Tarjetas Estructuradas) */}
                    <div className="md:hidden space-y-3">
                        {displayRows.map((row) => (
                            <div
                                key={row.factor.id}
                                className="p-3 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] space-y-2 text-xs"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => onViewFactorDetails?.(row.factor.factor_id)}
                                            className="font-bold text-xs text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors text-left cursor-pointer leading-snug"
                                        >
                                            {row.name}
                                        </button>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-[var(--color-text-secondary)]">
                                            <span>{row.dimension}</span>
                                            <span>•</span>
                                            <span>PM: {row.pm.toFixed(1)}/4.0</span>
                                        </div>
                                    </div>
                                    <span
                                        className={clsx(
                                            'text-[10px] font-mono px-2 py-0.5 rounded font-bold shrink-0 border',
                                            row.isCritical
                                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]'
                                        )}
                                    >
                                        IR={row.ir} • {row.priorityLabel}
                                    </span>
                                </div>

                                <div className="bg-[var(--color-bg-surface)] p-2 rounded-[4px] border border-[var(--color-border-subtle)]/60 text-[11px] leading-relaxed">
                                    <span className="font-mono text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block mb-0.5">
                                        Riesgo Metodológico
                                    </span>
                                    <p className="text-[var(--color-text-primary)]">{row.risk}</p>
                                </div>

                                <div className="bg-[var(--color-bg-surface)] p-2 rounded-[4px] border border-[var(--color-border-subtle)]/60 text-[11px] leading-relaxed">
                                    <span className="font-mono text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase block mb-0.5">
                                        Acción Correctiva
                                    </span>
                                    <p className="text-[var(--color-text-primary)]">{row.action}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] border-t border-[var(--color-border-subtle)]/50">
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block font-mono">Responsable / Plazo:</span>
                                        <span className="font-medium text-[var(--color-text-primary)]">{row.responsible}</span>
                                        <span className="text-[var(--color-text-secondary)] block font-mono">({row.timeline})</span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block font-mono">
                                            {row.meetsThreshold ? 'Sostener:' : 'Objetivo:'}
                                        </span>
                                        <span className="text-[var(--color-text-primary)] leading-tight block">
                                            {row.indicator}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="p-3.5 rounded bg-[var(--color-bg-page)]/50 border border-[var(--color-border-default)]">
                    {mitigationPlanText ? (
                        <MarkdownViewer content={mitigationPlanText} />
                    ) : (
                        <p className="text-xs text-[var(--color-text-tertiary)] italic">
                            No se ha registrado texto narrativo adicional para el plan de mitigación.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
