from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.guios.models import (
    Dimension,
    Factor,
    Subfactor,
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
)
from apps.guios.services.calculations import calculate_literature_thresholds
from apps.guios.services.methodology import (
    COMBINATION_MATRIX,
    combine_importance,
    calculate_quartiles,
    assign_literature_importance,
    compute_evaluation_literature_metrics,
    apply_step1_decisor_importance,
    apply_step3_subfactor_ratings_and_foda,
    compute_final_verdict,
)

User = get_user_model()


class MethodologyUnitMathTests(TestCase):
    """
    Pruebas unitarias de las fórmulas matemáticas discretas y continuas
    definidas en el Capítulo 5 de la tesis doctoral.
    """

    def test_combine_importance_matrix_figure_5_10(self):
        """
        Verifica exhaustivamente la matriz de combinación de la Figura 5.10 de la tesis.
        (Cruces simétricos de IE x IL -> IS y ID x IS -> IR).
        """
        # Fila 4: Fundamental
        self.assertEqual(combine_importance(4, 1), 2)  # Fundamental x Irrelevante -> Opcional
        self.assertEqual(combine_importance(4, 2), 3)  # Fundamental x Opcional    -> Importante
        self.assertEqual(combine_importance(4, 3), 3)  # Fundamental x Importante  -> Importante
        self.assertEqual(combine_importance(4, 4), 4)  # Fundamental x Fundamental -> Fundamental

        # Fila 3: Importante
        self.assertEqual(combine_importance(3, 1), 2)  # Importante x Irrelevante  -> Opcional
        self.assertEqual(combine_importance(3, 2), 2)  # Importante x Opcional     -> Opcional
        self.assertEqual(combine_importance(3, 3), 3)  # Importante x Importante   -> Importante
        self.assertEqual(combine_importance(3, 4), 3)  # Importante x Fundamental  -> Importante

        # Fila 2: Opcional
        self.assertEqual(combine_importance(2, 1), 1)  # Opcional x Irrelevante    -> Irrelevante
        self.assertEqual(combine_importance(2, 2), 2)  # Opcional x Opcional       -> Opcional
        self.assertEqual(combine_importance(2, 3), 2)  # Opcional x Importante     -> Opcional
        self.assertEqual(combine_importance(2, 4), 3)  # Opcional x Fundamental    -> Importante

        # Fila 1: Irrelevante
        self.assertEqual(combine_importance(1, 1), 1)  # Irrelevante x Irrelevante -> Irrelevante
        self.assertEqual(combine_importance(1, 2), 1)  # Irrelevante x Opcional    -> Irrelevante
        self.assertEqual(combine_importance(1, 3), 2)  # Irrelevante x Importante  -> Opcional
        self.assertEqual(combine_importance(1, 4), 2)  # Irrelevante x Fundamental -> Opcional

    def test_combine_importance_clamps_out_of_bounds(self):
        """Valores fuera del rango [1, 4] deben ajustarse a los extremos sin error."""
        self.assertEqual(combine_importance(0, 5), combine_importance(1, 4))
        self.assertEqual(combine_importance(99, -5), combine_importance(4, 1))

    def test_calculate_quartiles_linear_interpolation(self):
        """
        Prueba la interpolación lineal de cuartiles para un conjunto ordenado
        de razones ri.
        """
        # Caso de 5 valores: [1.0, 2.0, 3.0, 4.0, 5.0]
        # n = 5
        # idx_q1 = (5-1) * 0.25 = 1.0 -> val = 2.0
        # idx_q2 = (5-1) * 0.50 = 2.0 -> val = 3.0
        # idx_q3 = (5-1) * 0.75 = 3.0 -> val = 4.0
        # q4 = max = 5.0
        r_vals = [1.0, 2.0, 3.0, 4.0, 5.0]
        q1, q2, q3, q4 = calculate_quartiles(r_vals)

        self.assertEqual(q1, Decimal('2.0000'))
        self.assertEqual(q2, Decimal('3.0000'))
        self.assertEqual(q3, Decimal('4.0000'))
        self.assertEqual(q4, Decimal('5.0000'))

    def test_calculate_quartiles_edge_cases(self):
        """Prueba casos de borde: lista vacía, ceros o un solo elemento."""
        # Vacío
        q1, q2, q3, q4 = calculate_quartiles([])
        self.assertEqual((q1, q2, q3, q4), (Decimal('0.0000'), Decimal('0.0000'), Decimal('0.0000'), Decimal('0.0000')))

        # Todos ceros (software nuevo sin citas académicas)
        q1, q2, q3, q4 = calculate_quartiles([0, 0, 0, 0])
        self.assertEqual((q1, q2, q3, q4), (Decimal('0.0000'), Decimal('0.0000'), Decimal('0.0000'), Decimal('0.0000')))

        # Un solo valor
        q1, q2, q3, q4 = calculate_quartiles([2.75])
        self.assertEqual((q1, q2, q3, q4), (Decimal('2.7500'), Decimal('2.7500'), Decimal('2.7500'), Decimal('2.7500')))

    def test_literature_thresholds_spread_when_most_ratios_are_zero(self):
        """
        Con la mayoría de factores en cero, q1 se mantiene en 0 y los cortes
        altos salen de las razones positivas. Una serie sin ceros no cambia.
        """
        q1, q2, q3, q4 = calculate_literature_thresholds(
            [0, 0, 0, 0, Decimal('0.1000'), Decimal('0.2000'), Decimal('0.5000')]
        )
        self.assertEqual((q1, q2, q3, q4), (
            Decimal('0.0000'),
            Decimal('0.1500'),
            Decimal('0.3500'),
            Decimal('0.5000'),
        ))
        self.assertEqual(assign_literature_importance(0, q1, q2, q3, q4), 1)
        self.assertEqual(assign_literature_importance(Decimal('0.1000'), q1, q2, q3, q4), 2)
        self.assertEqual(assign_literature_importance(Decimal('0.2000'), q1, q2, q3, q4), 3)
        self.assertEqual(assign_literature_importance(Decimal('0.5000'), q1, q2, q3, q4), 4)

        plain = calculate_literature_thresholds([1, 2, 4, 6])
        self.assertEqual(plain, (
            Decimal('1.7500'),
            Decimal('3.0000'),
            Decimal('4.5000'),
            Decimal('6.0000'),
        ))

    def test_assign_literature_importance_equation_5_2(self):
        """
        Prueba la asignación de IL en {1, 2, 3, 4} según los umbrales de cuartiles.
        """
        q1 = Decimal('1.0000')
        q2 = Decimal('2.5000')
        q3 = Decimal('4.0000')
        q4 = Decimal('6.0000')

        # ri <= q1 -> IL = 1 (Irrelevante)
        self.assertEqual(assign_literature_importance(Decimal('0.5000'), q1, q2, q3, q4), 1)
        self.assertEqual(assign_literature_importance(Decimal('1.0000'), q1, q2, q3, q4), 1)

        # q1 < ri <= q2 -> IL = 2 (Opcional)
        self.assertEqual(assign_literature_importance(Decimal('1.0001'), q1, q2, q3, q4), 2)
        self.assertEqual(assign_literature_importance(Decimal('2.5000'), q1, q2, q3, q4), 2)

        # q2 < ri <= q3 -> IL = 3 (Importante)
        self.assertEqual(assign_literature_importance(Decimal('2.5001'), q1, q2, q3, q4), 3)
        self.assertEqual(assign_literature_importance(Decimal('4.0000'), q1, q2, q3, q4), 3)

        # q3 < ri <= q4 -> IL = 4 (Fundamental)
        self.assertEqual(assign_literature_importance(Decimal('4.0001'), q1, q2, q3, q4), 4)
        self.assertEqual(assign_literature_importance(Decimal('6.0000'), q1, q2, q3, q4), 4)
        self.assertEqual(assign_literature_importance(Decimal('10.0000'), q1, q2, q3, q4), 4)


class MethodologyPipelineEndToEndTests(TestCase):
    """
    Prueba el flujo metodológico completo desde la creación de la evaluación,
    procesamiento de citas con IA (Paso 0), asignación del decisor (Paso 1-2),
    calificación práctica de subfactores (Paso 3-4) y veredicto FODA (Paso 5-6).
    """

    def setUp(self):
        # 1. Crear usuario evaluador
        self.user = User.objects.create_user(
            email="evaluador_ti@unemi.edu.ec",
            password="securePassword123*",
            first_name="Especialista",
            last_name="TI",
        )

        # 2. Crear Dimensiones del Catálogo
        self.dim_tec = Dimension.objects.create(name="Tecnológica", order=1, is_base=True)
        self.dim_org = Dimension.objects.create(name="Organizacional", order=2, is_base=True)
        self.dim_eco = Dimension.objects.create(name="Económica", order=3, is_base=True)

        # 3. Crear 4 Factores con diferentes configuraciones
        # Factor 1: Compatibilidad (Externo, IE=4)
        self.factor_comp = Factor.objects.create(
            dimension=self.dim_tec,
            name="Compatibilidad",
            scope=Factor.SCOPE_EXTERNAL,
            expert_importance=4,  # Fundamental
            systemic_importance=4,
            order=1,
            is_active=True,
        )
        # 2 Subfactores de Compatibilidad
        self.sf_comp_1 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="El software utiliza formatos estándar (ej. ODF)",
            base_citations_count=5,
            order=1,
            is_active=True,
        )
        self.sf_comp_2 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="El software interactúa con formatos propietarios existentes",
            base_citations_count=3,
            order=2,
            is_active=True,
        )

        # Factor 2: Fiabilidad (Externo, IE=3)
        self.factor_fiab = Factor.objects.create(
            dimension=self.dim_tec,
            name="Fiabilidad",
            scope=Factor.SCOPE_EXTERNAL,
            expert_importance=3,  # Importante
            systemic_importance=3,
            order=2,
            is_active=True,
        )
        self.sf_fiab_1 = Subfactor.objects.create(
            factor=self.factor_fiab,
            description="El software es estable y cuenta con control de acceso",
            base_citations_count=2,
            order=1,
            is_active=True,
        )

        # Factor 3: Soporte (Interno, IE=4)
        self.factor_sop = Factor.objects.create(
            dimension=self.dim_org,
            name="Soporte",
            scope=Factor.SCOPE_INTERNAL,
            scope_configurable=True,
            expert_importance=4,  # Fundamental
            systemic_importance=4,
            order=1,
            is_active=True,
        )
        self.sf_sop_1 = Subfactor.objects.create(
            factor=self.factor_sop,
            description="El personal interno cuenta con conocimiento técnico",
            base_citations_count=4,
            order=1,
            is_active=True,
        )

        # Factor 4: Formación (Interno, IE=2)
        self.factor_form = Factor.objects.create(
            dimension=self.dim_org,
            name="Formación",
            scope=Factor.SCOPE_INTERNAL,
            expert_importance=2,  # Opcional
            systemic_importance=2,
            order=2,
            is_active=True,
        )
        self.sf_form_1 = Subfactor.objects.create(
            factor=self.factor_form,
            description="Existe material y cursos de capacitación disponibles",
            base_citations_count=1,
            order=1,
            is_active=True,
        )

        # 4. Crear instancia de Evaluación (software LibreOffice)
        self.eval = Evaluation.objects.create(
            software_name="LibreOffice",
            software_category="Ofimática",
            software_version="7.5",
            software_description="Suite ofimática open source alternativa a MS Office",
            org_name="Universidad Estatal de Milagro (UNEMI)",
            org_sector="Educación Superior",
            org_description="Migración en estaciones de trabajo administrativas y docentes",
            ai_enabled=True,
            created_by=self.user,
        )

        self.ai_citations = {
            self.sf_comp_1.id: 8,
            self.sf_comp_2.id: 4,
            self.sf_fiab_1.id: 2,
            self.sf_sop_1.id: 4,
            self.sf_form_1.id: 1,
        }

    def test_step0_literature_calculation_with_ai_citations(self):
        """
        Paso 0: Simula la respuesta de citas de la IA para LibreOffice:
        - Compatibilidad: sf1=8 citas, sf2=4 citas -> TC=12, NS=2 -> ri = 12/2 = 6.0000
        - Fiabilidad: sf1=2 citas                  -> TC=2,  NS=1 -> ri = 2/1  = 2.0000
        - Soporte: sf1=4 citas                     -> TC=4,  NS=1 -> ri = 4/1  = 4.0000
        - Formación: sf1=1 cita                    -> TC=1,  NS=1 -> ri = 1/1  = 1.0000
        
        Orden de ri: [1.0, 2.0, 4.0, 6.0]
        n = 4
        q1 (25%): 1.7500
        q2 (50%): 3.0000
        q3 (75%): 4.5000
        q4 (100%): 6.0000
        """
        ai_sources = {
            self.factor_comp.id: [
                {"title": "ODF Standard in Public Sector", "url": "https://doi.org/example-odf", "subfactor_id": self.sf_comp_1.id}
            ]
        }

        # Ejecutar Fase 3 / Paso 0
        updated_eval = compute_evaluation_literature_metrics(
            evaluation=self.eval,
            ai_citations_by_subfactor=self.ai_citations,
            ai_sources_by_factor=ai_sources,
        )

        # 1. Validar cuartiles guardados en Evaluation
        self.assertEqual(updated_eval.q1_threshold, Decimal('1.7500'))
        self.assertEqual(updated_eval.q2_threshold, Decimal('3.0000'))
        self.assertEqual(updated_eval.q3_threshold, Decimal('4.5000'))
        self.assertEqual(updated_eval.q4_threshold, Decimal('6.0000'))
        self.assertEqual(updated_eval.ai_status, Evaluation.AI_STATUS_COMPLETED)

        # 2. Validar EvaluationFactor para Compatibilidad:
        # ri = 6.0000 > q3 (4.5) -> IL = 4 (Fundamental)
        # IE = 4 (Fundamental)
        # IS = combine(4, 4) = 4
        ef_comp = EvaluationFactor.objects.get(evaluation=self.eval, factor=self.factor_comp)
        self.assertEqual(ef_comp.citations_count, 12)
        self.assertEqual(ef_comp.subfactors_count_snapshot, 2)
        self.assertEqual(ef_comp.citation_ratio, Decimal('6.0000'))
        self.assertEqual(ef_comp.literature_importance_calculated, 4)
        self.assertEqual(ef_comp.expert_importance_snapshot, 4)
        self.assertEqual(ef_comp.systemic_importance_snapshot, 4)
        self.assertEqual(len(ef_comp.ai_literature_sources), 1)

        # 3. Validar EvaluationFactor para Formación:
        # ri = 1.0000 <= q1 (1.7500) -> IL = 1 (Irrelevante)
        # IE = 2 (Opcional)
        # IS = combine(IE=2, IL=1) = 1 (Irrelevante)
        ef_form = EvaluationFactor.objects.get(evaluation=self.eval, factor=self.factor_form)
        self.assertEqual(ef_form.citations_count, 1)
        self.assertEqual(ef_form.citation_ratio, Decimal('1.0000'))
        self.assertEqual(ef_form.literature_importance_calculated, 1)
        self.assertEqual(ef_form.expert_importance_snapshot, 2)
        self.assertEqual(ef_form.systemic_importance_snapshot, 1)

        # 4. Validar que EvaluationSubfactor se poblaron con los snapshots
        esf_comp_1 = EvaluationSubfactor.objects.get(evaluation=self.eval, subfactor=self.sf_comp_1)
        self.assertEqual(esf_comp_1.ai_citations_count, 8)
        self.assertIn("formatos estándar", esf_comp_1.description_snapshot)
        self.assertIsNone(esf_comp_1.rating)  # Aún no calificado por el decisor

    def test_step1_and_step2_decisor_importance_and_relevance_filter(self):
        """
        Pasos 1 y 2: Decisor asigna ID.
        - Compatibilidad (IS=4): Decisor asigna ID=4 -> IR = combine(4, 4) = 4 -> is_relevant=True
        - Soporte (IS=3): Decisor asigna ID=4 -> IR = combine(4, 3) = 3 -> is_relevant=True
        - Formación (IS=1): Decisor asigna ID=1 -> IR = combine(1, 1) = 1 -> is_relevant=False (descartado)
        """
        # Inicializar literatura con citas IA
        compute_evaluation_literature_metrics(self.eval, self.ai_citations)

        decisor_inputs = [
            {"factor_id": self.factor_comp.id, "decisor_importance": 4, "scope_used": Factor.SCOPE_EXTERNAL},
            {"factor_id": self.factor_fiab.id, "decisor_importance": 3, "scope_used": Factor.SCOPE_EXTERNAL},
            {"factor_id": self.factor_sop.id, "decisor_importance": 4, "scope_used": Factor.SCOPE_INTERNAL},
            {"factor_id": self.factor_form.id, "decisor_importance": 1, "scope_used": Factor.SCOPE_INTERNAL},
        ]

        apply_step1_decisor_importance(self.eval, decisor_inputs)

        ef_comp = EvaluationFactor.objects.get(evaluation=self.eval, factor=self.factor_comp)
        self.assertEqual(ef_comp.decisor_importance, 4)
        self.assertEqual(ef_comp.relative_importance, 4)
        self.assertTrue(ef_comp.is_relevant)

        ef_sop = EvaluationFactor.objects.get(evaluation=self.eval, factor=self.factor_sop)
        self.assertEqual(ef_sop.relative_importance, 3)
        self.assertTrue(ef_sop.is_relevant)

        ef_form = EvaluationFactor.objects.get(evaluation=self.eval, factor=self.factor_form)
        self.assertEqual(ef_form.decisor_importance, 1)
        self.assertEqual(ef_form.relative_importance, 1)
        self.assertFalse(ef_form.is_relevant)  # Filtrado por RN-01 (IR > 1)

    def test_step3_and_step4_weighted_average_and_foda_classification(self):
        """
        Pasos 3 y 4:
        - Compatibilidad (Externo):
          sf1 = 4, sf2 = 3 -> PM = (4+3)/2 = 3.5 >= 3.0 -> Externo -> OPORTUNIDAD
        - Soporte (Interno):
          sf1 = 4 -> PM = 4.0 >= 3.0 -> Interno -> FORTALEZA
        - Fiabilidad (Externo):
          sf1 = 2 -> PM = 2.0 < 3.0 -> Externo -> AMENAZA
        """
        compute_evaluation_literature_metrics(self.eval, self.ai_citations)
        decisor_inputs = [
            {"factor_id": self.factor_comp.id, "decisor_importance": 4, "scope_used": Factor.SCOPE_EXTERNAL},
            {"factor_id": self.factor_fiab.id, "decisor_importance": 3, "scope_used": Factor.SCOPE_EXTERNAL},
            {"factor_id": self.factor_sop.id, "decisor_importance": 4, "scope_used": Factor.SCOPE_INTERNAL},
            {"factor_id": self.factor_form.id, "decisor_importance": 1, "scope_used": Factor.SCOPE_INTERNAL},
        ]
        apply_step1_decisor_importance(self.eval, decisor_inputs)

        ratings = {
            self.sf_comp_1.id: 4,
            self.sf_comp_2.id: 3,
            self.sf_sop_1.id: 4,
            self.sf_fiab_1.id: 2,
        }

        results = apply_step3_subfactor_ratings_and_foda(self.eval, ratings)

        # 3 resultados (Formación fue descartada por IR=1)
        self.assertEqual(len(results), 3)

        res_comp = EvaluationResult.objects.get(evaluation=self.eval, factor=self.factor_comp)
        self.assertEqual(res_comp.weighted_average, Decimal('3.5'))
        self.assertTrue(res_comp.meets_threshold)
        self.assertEqual(res_comp.foda_classification, EvaluationResult.FODA_OPPORTUNITY)

        res_sop = EvaluationResult.objects.get(evaluation=self.eval, factor=self.factor_sop)
        self.assertEqual(res_sop.weighted_average, Decimal('4.0'))
        self.assertTrue(res_sop.meets_threshold)
        self.assertEqual(res_sop.foda_classification, EvaluationResult.FODA_STRENGTH)

        res_fiab = EvaluationResult.objects.get(evaluation=self.eval, factor=self.factor_fiab)
        self.assertEqual(res_fiab.weighted_average, Decimal('2.0'))
        self.assertFalse(res_fiab.meets_threshold)
        self.assertEqual(res_fiab.foda_classification, EvaluationResult.FODA_THREAT)

    def test_step5_and_step6_verdicts(self):
        """
        Verifica los 3 tipos de veredicto según los criterios de la tesis GUIOS:
        - Recomendación A: Todos los factores cumplen (PM >= 3.0) -> Adoptar sin observaciones.
        - Recomendación B: Fallo únicamente en factor opcional (IR == 2) -> Es posible adoptar, con matices.
        - Recomendación C: Fallo en factor crítico (IR >= 3) -> Posponer / analizar.
        """
        compute_evaluation_literature_metrics(self.eval, self.ai_citations)

        # ── ESCENARIO 1: Recomendación C (Fallo en Compatibilidad que tiene IR=4) ──
        decisor_inputs_c = [
            {"factor_id": self.factor_comp.id, "decisor_importance": 4, "scope_used": Factor.SCOPE_EXTERNAL},  # IR = 4
            {"factor_id": self.factor_sop.id, "decisor_importance": 4, "scope_used": Factor.SCOPE_INTERNAL},    # IR = 3
        ]
        apply_step1_decisor_importance(self.eval, decisor_inputs_c)

        # Compatibilidad sf1=1, sf2=2 -> PM = 1.5 < 3.0 (Falla en factor crítico IR=4)
        ratings_scenario_c = {
            self.sf_comp_1.id: 1,
            self.sf_comp_2.id: 2,
            self.sf_sop_1.id: 4,
        }
        apply_step3_subfactor_ratings_and_foda(self.eval, ratings_scenario_c)
        verdict_c = compute_final_verdict(self.eval)
        self.assertEqual(verdict_c.recommendation, EvaluationVerdict.RECOMMENDATION_C)
        self.assertIn("posponerla", verdict_c.explanation_text)

        # ── ESCENARIO 2: Recomendación B (Fallo sólo en factor opcional IR=2) ──
        # Reiniciar cierre del escenario anterior sobre la instancia compartida
        self.eval.status = Evaluation.STATUS_IN_PROGRESS
        self.eval.completed_at = None
        self.eval.save(update_fields=["status", "completed_at"])
        EvaluationVerdict.objects.filter(evaluation=self.eval).delete()

        # Fiabilidad: IS=2, Decisor asigna ID=2 -> combine(2, 2) = 2 (Opcional)
        # Compatibilidad: aprueba (PM=4.0)
        decisor_inputs_b = [
            {"factor_id": self.factor_comp.id, "decisor_importance": 4, "scope_used": Factor.SCOPE_EXTERNAL},  # IR = 4
            {"factor_id": self.factor_fiab.id, "decisor_importance": 2, "scope_used": Factor.SCOPE_EXTERNAL},  # IR = 2 (Opcional)
        ]
        apply_step1_decisor_importance(self.eval, decisor_inputs_b)
        ratings_scenario_b = {
            self.sf_comp_1.id: 4,
            self.sf_comp_2.id: 4,  # Compatibilidad PM = 4.0 (aprueba)
            self.sf_fiab_1.id: 2,  # Fiabilidad PM = 2.0 (falla pero IR = 2)
        }
        apply_step3_subfactor_ratings_and_foda(self.eval, ratings_scenario_b)
        verdict_b = compute_final_verdict(self.eval)
        self.assertEqual(verdict_b.recommendation, EvaluationVerdict.RECOMMENDATION_B)
        self.assertIn("con matices", verdict_b.explanation_text)

        # ── ESCENARIO 3: Recomendación A (Adopción sin observaciones, todos PM >= 3.0) ──
        # Reiniciar cierre del escenario anterior sobre la instancia compartida
        self.eval.status = Evaluation.STATUS_IN_PROGRESS
        self.eval.completed_at = None
        self.eval.save(update_fields=["status", "completed_at"])
        EvaluationVerdict.objects.filter(evaluation=self.eval).delete()

        ratings_scenario_a = {
            self.sf_comp_1.id: 4,
            self.sf_comp_2.id: 4,
            self.sf_sop_1.id: 4,
            self.sf_fiab_1.id: 4,  # Ahora aprueba
        }
        apply_step3_subfactor_ratings_and_foda(self.eval, ratings_scenario_a)
        verdict_a = compute_final_verdict(self.eval)
        self.assertEqual(verdict_a.recommendation, EvaluationVerdict.RECOMMENDATION_A)
        self.assertIn("Adoptar sin observaciones", verdict_a.explanation_text)
        self.assertEqual(self.eval.status, Evaluation.STATUS_COMPLETED)
        self.assertIsNotNone(self.eval.completed_at)
