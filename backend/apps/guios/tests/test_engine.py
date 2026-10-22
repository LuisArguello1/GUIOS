import ast
import json
from dataclasses import replace
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

from apps.guios.services import engine
from apps.guios.services.engine import (
    FactorInput,
    SubfactorInput,
    classify_foda,
    display_pm,
    evaluate,
    evaluate_factor,
    is_relevant,
    meets_threshold,
    recommendation,
    relative_importance,
    weighted_average,
)

CATALOG_PATH = Path(settings.BASE_DIR).parent / 'docs' / 'catalogo_guios.json'
ENGINE_PATH = Path(engine.__file__)

SCOPE_FROM_CATALOG = {'interno': 'internal', 'externo': 'external', 'ambos': None}


def load_catalog():
    with CATALOG_PATH.open(encoding='utf-8') as handle:
        return json.load(handle)


def subfactors(code, ratings):
    return tuple(
        SubfactorInput(f"{code}-{i:02d}", f"Subfactor {i} de {code}", rating)
        for i, rating in enumerate(ratings, start=1)
    )


def factor(code='F', is_=3, id_=3, scope='internal', ratings=(4,), configurable=False, name=None):
    return FactorInput(
        code=code,
        name=name or code,
        suggested_importance=is_,
        decisor_importance=id_,
        scope=scope,
        scope_configurable=configurable,
        subfactors=subfactors(code, ratings),
    )


class ImportanceMatrixTests(SimpleTestCase):
    """Fig. 5.10 (p. 89): las 16 celdas."""

    # EXPECTED[ID][IS] = IR
    EXPECTED = {
        1: {1: 1, 2: 1, 3: 2, 4: 2},
        2: {1: 1, 2: 2, 3: 2, 4: 3},
        3: {1: 2, 2: 2, 3: 3, 4: 3},
        4: {1: 2, 2: 3, 3: 3, 4: 4},
    }

    def test_sixteen_cells(self):
        for id_, row in self.EXPECTED.items():
            for is_, expected in row.items():
                with self.subTest(IS=is_, ID=id_):
                    self.assertEqual(relative_importance(is_, id_), expected)

    def test_matrix_matches_catalog_json(self):
        rows = load_catalog()['matriz_importancia']['filas_por_importancia_decisor']
        for id_, values in rows.items():
            for is_, expected in enumerate(values, start=1):
                with self.subTest(IS=is_, ID=id_):
                    self.assertEqual(relative_importance(is_, int(id_)), expected)

    def test_matrix_equals_floor_of_indexes(self):
        for is_ in range(1, 5):
            for id_ in range(1, 5):
                self.assertEqual(relative_importance(is_, id_), (is_ - 1 + id_ - 1) // 2 + 1)

    def test_important_suggested_importance_is_always_relevant(self):
        for id_ in range(1, 5):
            self.assertTrue(is_relevant(relative_importance(3, id_)))

    def test_relevance(self):
        self.assertFalse(is_relevant(1))
        for ir in (2, 3, 4):
            self.assertTrue(is_relevant(ir))

    def test_out_of_range_values_are_rejected(self):
        for is_, id_ in ((0, 3), (5, 3), (3, 0), (3, 5), (True, 3), (3, None), ('3', 3)):
            with self.subTest(IS=is_, ID=id_), self.assertRaises(ValueError):
                relative_importance(is_, id_)
        with self.assertRaises(ValueError):
            is_relevant(0)


class WeightedAverageTests(SimpleTestCase):
    """PM exacta con Decimal; el redondeo es solo para mostrar."""

    def test_exactly_three_meets_threshold(self):
        average = weighted_average([3, 3, 4, 2])
        self.assertEqual(average, Decimal('3'))
        self.assertTrue(meets_threshold(average))
        self.assertEqual(display_pm(average), Decimal('3.00'))

    def test_two_point_ninety_nine_does_not_meet_threshold(self):
        ratings = [3] * 296 + [2] * 3          # 894 / 299 = 2.9899...
        average = weighted_average(ratings)
        self.assertEqual(display_pm(average), Decimal('2.99'))
        self.assertFalse(meets_threshold(average))

    def test_comparison_uses_exact_value_not_rounded(self):
        ratings = [3] * 199 + [2]              # 599 / 200 = 2.995 -> se muestra 3.00
        average = weighted_average(ratings)
        self.assertEqual(average, Decimal('2.995'))
        self.assertEqual(display_pm(average), Decimal('3.00'))
        self.assertFalse(meets_threshold(average))

    def test_unknown_rating_counts_in_average(self):
        average = weighted_average([3, 3, 3, 2])    # Formación del caso UNEMI
        self.assertEqual(average, Decimal('2.75'))
        self.assertFalse(meets_threshold(average))

    def test_repeating_decimal_is_kept_exact(self):
        average = weighted_average([1, 1, 2, 2, 2, 2])   # 10 / 6
        self.assertEqual(display_pm(average), Decimal('1.67'))
        self.assertEqual(average * 6, Decimal('10'))

    def test_invalid_ratings_are_rejected(self):
        for ratings in ([], [0], [5], [True], [3, None]):
            with self.subTest(ratings=ratings), self.assertRaises(ValueError):
                weighted_average(ratings)


class FodaTests(SimpleTestCase):
    """Ec. 5.3 (p. 91)."""

    def test_four_quadrants(self):
        self.assertEqual(classify_foda('internal', True), 'strength')
        self.assertEqual(classify_foda('internal', False), 'weakness')
        self.assertEqual(classify_foda('external', True), 'opportunity')
        self.assertEqual(classify_foda('external', False), 'threat')

    def test_invalid_scope_is_rejected(self):
        with self.assertRaises(ValueError):
            classify_foda('both', True)


class FactorEvaluationTests(SimpleTestCase):

    def test_complete_relevant_factor(self):
        result, missing = evaluate_factor(factor(ratings=(4, 4, 2, 1), scope='external'))
        self.assertEqual(missing, [])
        self.assertEqual(result.relative_importance, 3)
        self.assertTrue(result.is_relevant)
        self.assertEqual(result.weighted_average, Decimal('2.75'))
        self.assertEqual(result.weighted_average_display, Decimal('2.75'))
        self.assertFalse(result.meets_threshold)
        self.assertEqual(result.foda, 'threat')
        self.assertTrue(result.is_negative)

    def test_failing_subfactors_include_their_rating(self):
        result, _ = evaluate_factor(factor(code='X', ratings=(4, 3, 2, 1)))
        self.assertEqual(
            [(s.code, s.rating) for s in result.failing_subfactors],
            [('X-03', 2), ('X-04', 1)],
        )
        self.assertEqual(result.failing_subfactors[1].description, "Subfactor 4 de X")

    def test_irrelevant_factor_is_left_out(self):
        result, missing = evaluate_factor(factor(is_=1, id_=1, ratings=(1, 1), scope=None, configurable=True))
        self.assertEqual(missing, [])
        self.assertEqual(result.relative_importance, 1)
        self.assertFalse(result.is_relevant)
        self.assertIsNone(result.weighted_average)
        self.assertIsNone(result.weighted_average_display)
        self.assertIsNone(result.foda)
        self.assertFalse(result.is_negative)

    def test_irrelevant_factor_without_subfactors_is_allowed(self):
        result, missing = evaluate_factor(replace(factor(is_=2, id_=1), subfactors=()))
        self.assertFalse(result.is_relevant)
        self.assertEqual(missing, [])

    def test_missing_decisor_importance_asks_only_for_it(self):
        result, missing = evaluate_factor(factor(code='X', id_=None, ratings=(None, None), scope=None, configurable=True))
        self.assertEqual([(m.kind, m.factor_code, m.subfactor_code) for m in missing], [('decisor_importance', 'X', None)])
        self.assertIsNone(result.relative_importance)
        self.assertIsNone(result.is_relevant)

    def test_relevant_factor_without_subfactors_raises(self):
        with self.assertRaises(ValueError):
            evaluate_factor(replace(factor(), subfactors=()))

    def test_fixed_scope_factor_without_scope_raises(self):
        with self.assertRaises(ValueError):
            evaluate_factor(factor(scope=None, configurable=False))

    def test_invalid_scope_raises(self):
        with self.assertRaises(ValueError):
            evaluate_factor(factor(scope='both'))

    def test_invalid_partial_rating_raises(self):
        with self.assertRaises(ValueError):
            evaluate_factor(factor(ratings=(5, None)))

    def test_invalid_suggested_importance_raises(self):
        with self.assertRaises(ValueError):
            evaluate_factor(factor(is_=0, id_=None))


class VerdictTests(SimpleTestCase):

    def test_case_a_without_negatives(self):
        outcome = evaluate([
            factor('F1', ratings=(4, 4), scope='internal'),
            factor('F2', ratings=(3, 3), scope='external'),
        ])
        self.assertTrue(outcome.is_complete)
        self.assertEqual(outcome.verdict.recommendation, 'A')
        self.assertEqual(outcome.verdict.causing_factors, ())

    def test_case_b_negatives_only_optional(self):
        outcome = evaluate([
            factor('F1', is_=2, id_=2, ratings=(1, 2), scope='internal'),   # IR 2, Debilidad
            factor('F2', is_=3, id_=4, ratings=(4,), scope='external'),
        ])
        self.assertEqual(outcome.verdict.recommendation, 'B')
        self.assertEqual([f.code for f in outcome.verdict.causing_factors], ['F1'])
        self.assertEqual(outcome.verdict.causing_factors[0].relative_importance, 2)

    def test_case_c_with_important_negative(self):
        outcome = evaluate([
            factor('F1', is_=3, id_=3, ratings=(2, 2), scope='external'),   # IR 3, Amenaza
            factor('F2', is_=4, id_=4, ratings=(1,), scope='internal'),     # IR 4, Debilidad
            factor('F3', is_=2, id_=2, ratings=(1,), scope='internal'),     # IR 2, Debilidad
            factor('F4', ratings=(4,)),
        ])
        self.assertEqual(outcome.verdict.recommendation, 'C')
        # C prevalece sobre B; los causantes son solo los de IR 3 o 4.
        self.assertEqual([f.code for f in outcome.verdict.causing_factors], ['F1', 'F2'])

    def test_irrelevant_negative_does_not_count(self):
        outcome = evaluate([
            factor('F1', is_=1, id_=1, ratings=(1,), scope='internal'),
            factor('F2', ratings=(4,)),
        ])
        self.assertEqual(outcome.verdict.recommendation, 'A')

    def test_recommendation_ignores_irrelevant_results(self):
        result, _ = evaluate_factor(factor(is_=1, id_=1, ratings=(1,)))
        self.assertEqual(recommendation([result]).recommendation, 'A')


class CompletenessTests(SimpleTestCase):
    """Sin dictamen mientras falte algo; la lista de pendientes es exacta."""

    def test_incomplete_evaluation_has_no_verdict_and_lists_missing(self):
        outcome = evaluate([
            factor('F1', ratings=(4, None, None), scope='external'),
            factor('SOP', ratings=(4, 4), scope=None, configurable=True, name='Soporte'),
            factor('F3', id_=None, ratings=(None,)),
            factor('F4', ratings=(4,)),
        ])
        self.assertFalse(outcome.is_complete)
        self.assertIsNone(outcome.verdict)
        self.assertEqual(
            [(m.kind, m.factor_code, m.subfactor_code) for m in outcome.missing],
            [
                ('subfactor_rating', 'F1', 'F1-02'),
                ('subfactor_rating', 'F1', 'F1-03'),
                ('scope', 'SOP', None),
                ('decisor_importance', 'F3', None),
            ],
        )
        self.assertEqual(outcome.missing[2].factor_name, 'Soporte')

    def test_partial_results_are_kept_for_complete_factors(self):
        outcome = evaluate([
            factor('F1', ratings=(4, None)),
            factor('F2', ratings=(1, 1), scope='internal'),
        ])
        f1, f2 = outcome.factors
        self.assertIsNone(f1.weighted_average)
        self.assertEqual(f2.foda, 'weakness')
        self.assertIsNone(outcome.verdict)

    def test_configurable_factor_with_ratings_but_no_scope_has_pm_but_no_foda(self):
        outcome = evaluate([factor('SOP', ratings=(4, 4), scope=None, configurable=True)])
        result = outcome.factors[0]
        self.assertEqual(result.weighted_average, Decimal('4'))
        self.assertIsNone(result.foda)
        self.assertIsNone(outcome.verdict)

    def test_unrated_irrelevant_factor_does_not_block_verdict(self):
        outcome = evaluate([
            factor('F1', is_=2, id_=1, ratings=(None, None)),
            factor('F2', ratings=(4,)),
        ])
        self.assertTrue(outcome.is_complete)
        self.assertEqual(outcome.verdict.recommendation, 'A')

    def test_support_with_ir_one_does_not_need_scope(self):
        # Con la IS del catálogo (3) Soporte siempre es relevante; si el catálogo
        # le pusiera IS 1 o 2 y el decisor ID 1, su IR sería 1.
        for support_is in (1, 2):
            with self.subTest(IS=support_is):
                outcome = evaluate([
                    factor('ORG-SOP', is_=support_is, id_=1, ratings=(None,) * 6,
                           scope=None, configurable=True, name='Soporte'),
                    factor('F2', ratings=(4,)),
                ])
                support = outcome.factors[0]
                self.assertEqual(support.relative_importance, 1)
                self.assertFalse(support.is_relevant)
                self.assertEqual(outcome.missing, ())
                self.assertEqual(outcome.verdict.recommendation, 'A')

    def test_empty_evaluation_is_complete_with_a(self):
        outcome = evaluate([])
        self.assertTrue(outcome.is_complete)
        self.assertEqual(outcome.verdict.recommendation, 'A')


class UnemiCaseTests(SimpleTestCase):
    """
    Caso de estudio UNEMI con LibreOffice (tesis, Figs. 6.3-6.5, pp. 102-104;
    docs/ANALISIS_GUIOS_ORIGINAL.md §2.5). Las calificaciones reproducen la PM
    de la Fig. 6.5 con el número real de subfactores de cada factor.
    """

    # código: (ID, calificaciones)
    CASE = {
        'TEC-COM': (4, [4, 4, 4, 4, 4, 4, 4, 2]),        # 3.75 Oportunidad
        'TEC-PER': (3, [1, 1, 2, 2, 2, 2]),              # 1.67 Amenaza
        'TEC-FIA': (3, [4, 3, 3, 3, 3]),                 # 3.20 Oportunidad
        'TEC-REU': (2, [3, 3]),                          # 3.00 Oportunidad
        'TEC-USA': (3, [4, 3, 4, 3]),                    # 3.50 Oportunidad
        'TEC-DOC': (3, [3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2]),  # 2.36 Amenaza
        'TEC-MAN': (3, [4]),                             # 4.00 Oportunidad
        'TEC-POR': (3, [2, 2]),                          # 2.00 Amenaza
        'TEC-PRU': (3, [3]),                             # 3.00 Oportunidad
        'ORG-SOP': (4, [3, 3, 2, 2, 2, 2]),              # 2.33 Debilidad (ámbito interno elegido)
        'ORG-TIE': (2, [4, 3]),                          # 3.50 Fortaleza
        'ORG-FOR': (3, [3, 3, 3, 2]),                    # 2.75 Debilidad
        'ORG-CAS': (2, [3]),                             # 3.00 Oportunidad
        'ORG-CEN': (2, [3, 2]),                          # 2.50 Debilidad
        'ORG-APO': (3, [4]),                             # 4.00 Fortaleza
        'ORG-BLO': (2, [2]),                             # 2.00 Amenaza
        'ORG-ACT': (2, [3, 3]),                          # 3.00 Fortaleza
        'ECO-TCO': (3, [4, 3]),                          # 3.50 Fortaleza
    }

    EXPECTED_FODA = {
        'TEC-COM': 'opportunity', 'TEC-PER': 'threat', 'TEC-FIA': 'opportunity',
        'TEC-REU': 'opportunity', 'TEC-USA': 'opportunity', 'TEC-DOC': 'threat',
        'TEC-MAN': 'opportunity', 'TEC-POR': 'threat', 'TEC-PRU': 'opportunity',
        'ORG-SOP': 'weakness', 'ORG-TIE': 'strength', 'ORG-FOR': 'weakness',
        'ORG-CAS': 'opportunity', 'ORG-CEN': 'weakness', 'ORG-APO': 'strength',
        'ORG-BLO': 'threat', 'ORG-ACT': 'strength', 'ECO-TCO': 'strength',
    }

    # IS de guiosad.html que difieren de la Tabla 5.3.
    GUIOSAD_IS = {'TEC-USA': 3, 'ORG-APO': 2}

    def build_inputs(self, is_overrides=None):
        is_overrides = is_overrides or {}
        inputs = []
        for dimension in load_catalog()['dimensiones']:
            for item in dimension['factores']:
                code = item['codigo']
                id_, ratings = self.CASE[code]
                catalog_subfactors = item['subfactores']
                self.assertEqual(len(ratings), len(catalog_subfactors), code)
                scope = SCOPE_FROM_CATALOG[item['ambito']]
                if item['ambito_configurable']:
                    scope = 'internal'
                inputs.append(FactorInput(
                    code=code,
                    name=item['nombre'],
                    suggested_importance=is_overrides.get(code, item['is']),
                    decisor_importance=id_,
                    scope=scope,
                    scope_configurable=item['ambito_configurable'],
                    subfactors=tuple(
                        SubfactorInput(s['codigo'], s['texto_mostrar'], rating)
                        for s, rating in zip(catalog_subfactors, ratings)
                    ),
                ))
        return inputs

    def assert_unemi_c(self, outcome):
        self.assertTrue(outcome.is_complete)
        self.assertEqual(len(outcome.factors), 18)
        self.assertEqual({f.code: f.foda for f in outcome.factors}, self.EXPECTED_FODA)
        self.assertEqual(outcome.verdict.recommendation, 'C')

        causing = {f.code: f for f in outcome.verdict.causing_factors}
        self.assertEqual(set(causing), {'TEC-PER', 'ORG-FOR', 'ORG-SOP'})
        self.assertEqual(
            {code: f.name for code, f in causing.items()},
            {'TEC-PER': 'Personalización', 'ORG-FOR': 'Formación', 'ORG-SOP': 'Soporte'},
        )
        for f in causing.values():
            self.assertEqual(f.relative_importance, 3)

        self.assertEqual(causing['TEC-PER'].weighted_average_display, Decimal('1.67'))
        self.assertEqual(causing['TEC-PER'].foda, 'threat')
        self.assertEqual(causing['ORG-FOR'].weighted_average, Decimal('2.75'))
        self.assertEqual(causing['ORG-FOR'].foda, 'weakness')
        self.assertEqual(causing['ORG-SOP'].weighted_average_display, Decimal('2.33'))
        self.assertEqual(causing['ORG-SOP'].foda, 'weakness')

        self.assertEqual([s.rating for s in causing['TEC-PER'].failing_subfactors], [1, 1, 2, 2, 2, 2])
        self.assertEqual(
            [(s.code, s.rating) for s in causing['ORG-FOR'].failing_subfactors],
            [('ORG-FOR-04', 2)],
        )
        self.assertEqual(len(causing['ORG-SOP'].failing_subfactors), 4)
        self.assertTrue(causing['ORG-FOR'].failing_subfactors[0].description)

    def test_unemi_with_thesis_importance_gives_c(self):
        outcome = evaluate(self.build_inputs())
        self.assert_unemi_c(outcome)
        by_code = {f.code: f for f in outcome.factors}
        self.assertEqual(by_code['TEC-USA'].relative_importance, 2)
        self.assertEqual(by_code['ORG-APO'].relative_importance, 3)
        self.assertEqual(by_code['TEC-COM'].weighted_average, Decimal('3.75'))

    def test_unemi_with_guiosad_importance_gives_c(self):
        outcome = evaluate(self.build_inputs(self.GUIOSAD_IS))
        self.assert_unemi_c(outcome)
        by_code = {f.code: f for f in outcome.factors}
        self.assertEqual(by_code['TEC-USA'].relative_importance, 3)
        self.assertEqual(by_code['ORG-APO'].relative_importance, 2)

    def test_unemi_without_support_scope_has_no_verdict(self):
        inputs = [replace(f, scope=None) if f.scope_configurable else f for f in self.build_inputs()]
        outcome = evaluate(inputs)
        self.assertIsNone(outcome.verdict)
        self.assertEqual([(m.kind, m.factor_code) for m in outcome.missing], [('scope', 'ORG-SOP')])


class EnginePurityTests(SimpleTestCase):
    """RNF-12: el motor no depende de Django ni de la IA."""

    def test_engine_imports_only_standard_library(self):
        tree = ast.parse(ENGINE_PATH.read_text(encoding='utf-8'))
        modules = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules.update(alias.name.split('.')[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                modules.add((node.module or '').split('.')[0])
        self.assertTrue(modules <= {'dataclasses', 'decimal', 'typing'}, modules)
