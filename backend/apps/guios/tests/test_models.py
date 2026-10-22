from django.core.exceptions import ValidationError
from django.db.models import ProtectedError
from django.test import TestCase

from apps.guios.models import (
    Dimension,
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationVerdict,
    Factor,
    Subfactor,
)


class GuiosModelTestBase(TestCase):
    def setUp(self):
        self.dimension = Dimension.objects.create(name="Organizacional", order=2)
        self.factor = Factor.objects.create(
            dimension=self.dimension,
            name="Soporte",
            suggested_importance=3,
            scope=Factor.SCOPE_BOTH,
            scope_configurable=True,
        )
        self.subfactor = Subfactor.objects.create(
            factor=self.factor,
            description="Existe soporte técnico disponible para la solución.",
        )
        self.evaluation = Evaluation.objects.create(
            software_name="LibreOffice",
            org_name="UNEMI",
        )


class CatalogProtectionTests(GuiosModelTestBase):
    """RF-ADM-31 y RF-ADM-32: no se borra lo que tiene hijos."""

    def test_dimension_with_factors_cannot_be_deleted(self):
        with self.assertRaises(ProtectedError):
            self.dimension.delete()
        self.assertTrue(Dimension.objects.filter(pk=self.dimension.pk).exists())

    def test_factor_with_subfactors_cannot_be_deleted(self):
        with self.assertRaises(ProtectedError):
            self.factor.delete()
        self.assertTrue(Factor.objects.filter(pk=self.factor.pk).exists())

    def test_empty_dimension_can_be_deleted(self):
        empty = Dimension.objects.create(name="Económica", order=3)
        empty.delete()
        self.assertFalse(Dimension.objects.filter(pk=empty.pk).exists())


class ImportanceRangeTests(GuiosModelTestBase):
    """RNF-07: IS, ID e IR solo aceptan valores de 1 a 4."""

    def test_suggested_importance_out_of_range_is_rejected(self):
        for value in (0, 5):
            self.factor.suggested_importance = value
            with self.assertRaises(ValidationError):
                self.factor.full_clean()

    def test_suggested_importance_in_range_is_accepted(self):
        for value in (1, 2, 3, 4):
            self.factor.suggested_importance = value
            self.factor.full_clean()

    def test_evaluation_factor_values_out_of_range_are_rejected(self):
        for field in ('suggested_importance_snapshot', 'decisor_importance', 'relative_importance'):
            for value in (0, 5):
                evaluation_factor = EvaluationFactor(
                    evaluation=self.evaluation,
                    factor=self.factor,
                    suggested_importance_snapshot=3,
                    factor_name_snapshot="Soporte",
                )
                setattr(evaluation_factor, field, value)
                with self.assertRaises(ValidationError, msg=f"{field}={value}"):
                    evaluation_factor.full_clean()

    def test_subfactor_rating_out_of_range_is_rejected(self):
        for value in (0, 5):
            evaluation_subfactor = EvaluationSubfactor(
                evaluation=self.evaluation,
                subfactor=self.subfactor,
                description_snapshot=self.subfactor.description,
                rating=value,
            )
            with self.assertRaises(ValidationError):
                evaluation_subfactor.full_clean()


class UnratedProgressTests(GuiosModelTestBase):
    """P4 y RN-12: el avance se guarda "sin calificar"."""

    def test_evaluation_factor_starts_unrated(self):
        evaluation_factor = EvaluationFactor(
            evaluation=self.evaluation,
            factor=self.factor,
            suggested_importance_snapshot=self.factor.suggested_importance,
            factor_name_snapshot=self.factor.name,
        )
        evaluation_factor.full_clean()
        evaluation_factor.save()
        evaluation_factor.refresh_from_db()

        self.assertIsNone(evaluation_factor.decisor_importance)
        self.assertIsNone(evaluation_factor.relative_importance)
        self.assertIsNone(evaluation_factor.is_relevant)
        self.assertEqual(evaluation_factor.scope_used, "")
        self.assertEqual(evaluation_factor.factor_name_snapshot, "Soporte")
        self.assertEqual(evaluation_factor.suggested_importance_snapshot, 3)

    def test_evaluation_subfactor_starts_unrated(self):
        evaluation_subfactor = EvaluationSubfactor(
            evaluation=self.evaluation,
            subfactor=self.subfactor,
            description_snapshot=self.subfactor.description,
            ai_suggested_rating=3,
        )
        evaluation_subfactor.full_clean()
        evaluation_subfactor.save()
        evaluation_subfactor.refresh_from_db()

        self.assertIsNone(evaluation_subfactor.rating)
        self.assertEqual(evaluation_subfactor.ai_suggested_rating, 3)

    def test_factor_name_snapshot_survives_catalog_rename(self):
        evaluation_factor = EvaluationFactor.objects.create(
            evaluation=self.evaluation,
            factor=self.factor,
            suggested_importance_snapshot=3,
            factor_name_snapshot=self.factor.name,
        )
        self.factor.name = "Soporte técnico"
        self.factor.save()
        evaluation_factor.refresh_from_db()
        self.assertEqual(evaluation_factor.factor_name_snapshot, "Soporte")


class VerdictTests(GuiosModelTestBase):
    """Letras de la tesis (pp. 104-106); los textos de IA quedan vacíos sin IA."""

    def test_recommendation_labels_follow_thesis(self):
        labels = dict(EvaluationVerdict.RECOMMENDATION_CHOICES)
        self.assertIn("Adoptar", labels['A'])
        self.assertIn("con matices", labels['B'])
        self.assertIn("posponer", labels['C'])

    def test_ai_texts_default_to_empty(self):
        verdict = EvaluationVerdict.objects.create(
            evaluation=self.evaluation,
            recommendation=EvaluationVerdict.RECOMMENDATION_C,
            explanation_text="Soporte y Formación son Debilidades con IR Importante.",
        )
        verdict.refresh_from_db()
        self.assertEqual(verdict.ai_executive_summary, "")
        self.assertEqual(verdict.ai_mitigation_plan, "")
