"""
Conformidad con la tesis (Capítulos 5 y 6): Tabla 5.3, Figura 5.10 y Figuras 6.4-6.6.
Pruebas puras, sin base de datos.
"""
from decimal import Decimal

from django.test import SimpleTestCase

from apps.guios.services.calculations import (
    FODA_OPPORTUNITY,
    FODA_STRENGTH,
    FODA_THREAT,
    FODA_WEAKNESS,
    VerdictFactor,
    assign_literature_importance,
    calculate_citation_ratio,
    calculate_expert_importance,
    calculate_literature_thresholds,
    calculate_quartiles,
    calculate_suggested_importance,
    calculate_weighted_average,
    classify_foda,
    classify_recommendation,
    combine_importance,
    meets_adoption_threshold,
)

# (factor, NS, TC, IL esperado, IS esperado) — Tabla 5.3, IE = 3 en todos.
TABLE_5_3 = [
    ("Compatibilidad", 8, 33, 3, 3),
    ("Fiabilidad", 5, 19, 3, 3),
    ("Mantenibilidad", 1, 4, 3, 3),
    ("Personalización", 6, 30, 4, 3),
    ("Prueba", 1, 4, 3, 3),
    ("Documentación", 11, 20, 1, 2),
    ("Portabilidad", 2, 4, 2, 2),
    ("Reusabilidad", 2, 5, 2, 2),
    ("Usabilidad", 4, 14, 2, 2),
    ("Apoyo de la alta dirección", 1, 5, 4, 3),
    ("Formación", 4, 27, 4, 3),
    ("Soporte", 6, 43, 4, 3),
    ("Actitud hacia el cambio", 2, 3, 1, 2),
    ("Bloqueo de proveedores", 1, 3, 2, 2),
    ("Casos de estudio de adopción FLOSS", 1, 1, 1, 2),
    ("Centralidad de TI", 2, 2, 1, 2),
    ("Tiempo de adopción", 2, 2, 1, 2),
    ("TCO", 2, 24, 4, 3),
]

# (factor, PM, ámbito, IR) — Figura 6.5 (LibreOffice, UNEMI).
FIGURE_6_5 = [
    ("Compatibilidad", "3.8", "external", 3),
    ("Prueba", "3.0", "external", 3),
    ("Fiabilidad", "3.2", "external", 3),
    ("Reusabilidad", "3.0", "external", 3),
    ("Usabilidad", "3.5", "external", 3),
    ("Mantenibilidad", "4.0", "external", 3),
    ("Casos de estudio", "3.0", "external", 3),
    ("Tiempo de adopción", "3.5", "internal", 3),
    ("Apoyo de la alta dirección", "4.0", "internal", 3),
    ("Actitud hacia el cambio", "3.0", "internal", 3),
    ("Coste total de propiedad", "3.5", "internal", 3),
    ("Personalización", "1.7", "external", 3),
    ("Portabilidad", "2.0", "external", 2),
    ("Documentación", "2.4", "external", 2),
    ("Bloqueo de proveedores", "2.0", "external", 2),
    ("Formación", "2.8", "internal", 3),
    ("Centralidad de TI", "2.5", "internal", 2),
    ("Soporte", "2.3", "internal", 3),
]


def _verdict_factor(name, pm, scope, ir):
    pm = Decimal(pm)
    foda = classify_foda(pm, scope)
    labels = {
        FODA_STRENGTH: "Fortaleza",
        FODA_OPPORTUNITY: "Oportunidad",
        FODA_WEAKNESS: "Debilidad",
        FODA_THREAT: "Amenaza",
    }
    return VerdictFactor(
        name=name,
        weighted_average=pm,
        meets_threshold=meets_adoption_threshold(pm),
        relative_importance=ir,
        foda_label=labels[foda],
    )


class ThesisMatrixTests(SimpleTestCase):
    def test_figure_5_10_cells(self):
        # (IE/ID = fila, IL/IS = columna)
        expected = {
            4: [2, 3, 3, 4],
            3: [2, 2, 3, 3],
            2: [1, 2, 2, 3],
            1: [1, 1, 2, 2],
        }
        for row, values in expected.items():
            for col, value in enumerate(values, start=1):
                self.assertEqual(combine_importance(row, col), value, f"M({row},{col})")

    def test_matrix_spot_checks(self):
        self.assertEqual(combine_importance(4, 3), 3)
        self.assertEqual(combine_importance(1, 3), 2)


class ThesisTable53Tests(SimpleTestCase):
    def setUp(self):
        self.ratios = [calculate_citation_ratio(tc, ns, decimals=10) for _, ns, tc, _, _ in TABLE_5_3]

    def test_quartiles_match_table_5_3(self):
        q1, q2, q3, q4 = calculate_quartiles(self.ratios)
        self.assertEqual(q1, Decimal("1.8636"))
        self.assertEqual(q2, Decimal("3.6500"))
        self.assertEqual(q3, Decimal("4.7813"))  # 4.78125 a 4 decimales, half-up
        self.assertEqual(q4, Decimal("12.0000"))

    def test_strict_and_default_modes_agree_without_zeros(self):
        self.assertEqual(
            calculate_literature_thresholds(self.ratios, strict_thesis_mode=True),
            calculate_literature_thresholds(self.ratios),
        )

    def test_il_and_is_per_factor(self):
        q1, q2, q3, q4 = calculate_literature_thresholds(self.ratios, strict_thesis_mode=True)
        for (name, _, _, expected_il, expected_is), ratio in zip(TABLE_5_3, self.ratios):
            il = assign_literature_importance(ratio, q1, q2, q3, q4)
            self.assertEqual(il, expected_il, f"IL de {name}")
            self.assertEqual(calculate_suggested_importance(il, 3), expected_is, f"IS de {name}")


class ZeroInflationTests(SimpleTestCase):
    def test_default_mode_keeps_il_2_when_many_zeros(self):
        ratios = [0] * 10 + [1, 2, 3, 4, 5, 6, 7, 8]
        strict = calculate_literature_thresholds(ratios, strict_thesis_mode=True)
        self.assertEqual(strict[0], strict[1])  # q1 == q2 == 0: IL = 2 imposible
        q1, q2, q3, q4 = calculate_literature_thresholds(ratios)
        self.assertEqual(q1, Decimal("0.0000"))
        self.assertGreater(q2, q1)
        levels = {assign_literature_importance(Decimal(r), q1, q2, q3, q4) for r in ratios}
        self.assertEqual(levels, {1, 2, 3, 4})


class ExpertImportanceTests(SimpleTestCase):
    def test_rounding_half_up(self):
        self.assertEqual(calculate_expert_importance([3, 3, 3]), 3)
        self.assertEqual(calculate_expert_importance([3, 3, 4]), 3)        # 3.33
        self.assertEqual(calculate_expert_importance([3, 4]), 4)           # 3.5 sube
        self.assertEqual(calculate_expert_importance([2, 3]), 3)           # 2.5 sube (round() daría 2)
        self.assertEqual(calculate_expert_importance([4, 4, 3]), 4)        # 3.67

    def test_empty_ratings_raise(self):
        with self.assertRaises(ValueError):
            calculate_expert_importance([])


class ThesisCaseStudyTests(SimpleTestCase):
    def test_compatibility_pm_and_foda(self):
        pm = calculate_weighted_average([2, 4, 4, 4, 4, 4, 4, 4])
        self.assertEqual(pm, Decimal("3.8"))
        self.assertEqual(classify_foda(pm, "external"), FODA_OPPORTUNITY)

    def test_figure_6_5_counts_and_verdict(self):
        factors = [_verdict_factor(*row) for row in FIGURE_6_5]
        labels = [f.foda_label for f in factors]
        self.assertEqual(labels.count("Oportunidad"), 7)
        self.assertEqual(labels.count("Fortaleza"), 4)
        self.assertEqual(labels.count("Amenaza"), 4)
        self.assertEqual(labels.count("Debilidad"), 3)
        recommendation, explanation = classify_recommendation(factors)
        self.assertEqual(recommendation, "C")
        self.assertIn("IR >= 3", explanation)


class VerdictRuleTests(SimpleTestCase):
    def _factor(self, pm, ir):
        return _verdict_factor("F", pm, "internal", ir)

    def test_a_when_no_failures(self):
        self.assertEqual(classify_recommendation([self._factor("3.0", 2), self._factor("4.0", 3)])[0], "A")

    def test_b_when_failures_are_optional_and_not_more_than_positives(self):
        factors = [self._factor("2.0", 2), self._factor("3.5", 3), self._factor("3.5", 3)]
        self.assertEqual(classify_recommendation(factors)[0], "B")

    def test_b_when_failures_equal_positives(self):
        factors = [self._factor("2.0", 2), self._factor("3.5", 3)]
        self.assertEqual(classify_recommendation(factors)[0], "B")

    def test_c_when_optional_failures_outnumber_positives(self):
        factors = [self._factor("2.0", 2), self._factor("2.0", 2), self._factor("3.5", 3)]
        recommendation, explanation = classify_recommendation(factors)
        self.assertEqual(recommendation, "C")
        self.assertIn("superan", explanation)

    def test_c_when_any_failure_is_important(self):
        factors = [self._factor("2.0", 3)] + [self._factor("4.0", 2)] * 5
        self.assertEqual(classify_recommendation(factors)[0], "C")
