"""
apps/guios/test/test_repository_health.py
─────────────────────────────────────────────────────────────────────────────
Pruebas de unidad e integración para el Pulso Vivo de Repositorio FLOSS
(parseo GitHub/GitLab, índice de vitalidad, endpoints público/admin y reportes).
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.guios.models import (
    Dimension,
    Evaluation,
    EvaluationFactor,
    EvaluationResult,
    EvaluationSubfactor,
    EvaluationVerdict,
    Factor,
    Subfactor,
)
from apps.guios.services.reports import EvaluationExcelReport, EvaluationPDFReport
from apps.guios.services.repository_health import (
    compute_vitality_score,
    parse_repository_target,
    sync_evaluation_repo_health,
)

User = get_user_model()


class RepositoryHealthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            email="repo_audit@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Repo",
            last_name="Auditor",
        )
        self.dimension = Dimension.objects.create(
            name="Dimensión Tecnológica",
            description="Criterios técnicos",
            order=1,
        )
        self.factor = Factor.objects.create(
            dimension=self.dimension,
            name="Mantenimiento y Comunidad",
            systemic_importance=3,
            scope=Factor.SCOPE_EXTERNAL,
            order=1,
        )
        self.subfactor = Subfactor.objects.create(
            factor=self.factor,
            description="Licenciamiento OSI claro y comunidad activa",
            order=1,
        )
        self.evaluation = Evaluation.objects.create(
            software_name="Keycloak",
            software_version="25.0",
            software_category="Ciberseguridad y Redes",
            software_repo_url="https://github.com/keycloak/keycloak",
            org_name="UNEMI",
            org_sector="Educación Superior",
            status=Evaluation.STATUS_IN_PROGRESS,
            created_by=self.user,
            data_storage_consent=True,
        )
        EvaluationFactor.objects.create(
            evaluation=self.evaluation,
            factor=self.factor,
            systemic_importance_snapshot=3,
            subfactors_count_snapshot=1,
            decisor_importance=3,
            relative_importance=3,
            is_relevant=True,
        )
        EvaluationSubfactor.objects.create(
            evaluation=self.evaluation,
            subfactor=self.subfactor,
            description_snapshot=self.subfactor.description,
            rating=4,
        )

    def test_parse_repository_target_github_and_gitlab(self):
        self.assertEqual(
            parse_repository_target("https://github.com/postgres/postgres.git"),
            ("github", "postgres/postgres"),
        )
        self.assertEqual(
            parse_repository_target("github.com/odoo/odoo/tree/17.0"),
            ("github", "odoo/odoo"),
        )
        self.assertEqual(
            parse_repository_target("https://gitlab.com/gitlab-org/gitlab/-/releases"),
            ("gitlab", "gitlab-org/gitlab"),
        )
        self.assertIsNone(parse_repository_target("https://www.libreoffice.org"))

    def test_compute_vitality_score_flags_archived_and_stale_repos(self):
        score_ok, grade_ok, status_ok, alerts_ok = compute_vitality_score(
            archived=False,
            days_since_last_push=5,
            has_osi_license=True,
            has_release=True,
            stars=12000,
            contributors_count=120,
        )
        self.assertEqual(score_ok, 100)
        self.assertEqual(grade_ok, "Óptimo")
        self.assertEqual(status_ok, "active")
        self.assertEqual(alerts_ok, [])

        score_arch, grade_arch, status_arch, alerts_arch = compute_vitality_score(
            archived=True,
            days_since_last_push=600,
            has_osi_license=False,
            has_release=False,
            stars=50,
            contributors_count=1,
        )
        self.assertLessEqual(score_arch, 35)
        self.assertEqual(grade_arch, "Riesgo")
        self.assertEqual(status_arch, "archived")
        self.assertGreaterEqual(len(alerts_arch), 3)

    @patch("apps.guios.services.repository_health.httpx.Client")
    def test_sync_public_repo_health_endpoint_and_reports(self, mock_client_cls):
        recent_push = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()

        repo_resp = MagicMock(status_code=200)
        repo_resp.json.return_value = {
            "full_name": "keycloak/keycloak",
            "html_url": "https://github.com/keycloak/keycloak",
            "description": "Open Source Identity and Access Management",
            "homepage": "https://www.keycloak.org",
            "language": "Java",
            "topics": ["oauth2", "oidc", "saml"],
            "license": {"spdx_id": "Apache-2.0", "name": "Apache License 2.0"},
            "stargazers_count": 23400,
            "forks_count": 6900,
            "subscribers_count": 510,
            "open_issues_count": 1400,
            "default_branch": "main",
            "archived": False,
            "created_at": "2013-07-01T00:00:00Z",
            "pushed_at": recent_push,
        }
        rel_resp = MagicMock(status_code=200)
        rel_resp.json.return_value = {
            "tag_name": "25.0.6",
            "name": "Keycloak 25.0.6",
            "published_at": recent_push,
        }
        contrib_resp = MagicMock(status_code=200, headers={"Link": '<https://api.github.com?page=80>; rel="last"'})
        contrib_resp.json.return_value = [{"login": "stianst", "contributions": 5000}]
        count_resp = MagicMock(status_code=200, headers={"Link": '<https://api.github.com?page=412>; rel="last"'})

        client_instance = MagicMock()
        client_instance.get.side_effect = [repo_resp, rel_resp, contrib_resp, count_resp]
        mock_client_cls.return_value.__enter__.return_value = client_instance

        url = f"/api/v1/guios/public/evaluations/{self.evaluation.uuid}/repo-health/"
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        metrics = response.data["repo_health_metrics"]
        self.assertEqual(metrics["status"], "ok")
        self.assertEqual(metrics["provider"], "github")
        self.assertEqual(metrics["license_spdx"], "Apache-2.0")
        self.assertEqual(metrics["latest_release"]["tag_name"], "25.0.6")
        self.assertEqual(metrics["contributors_count"], 412)
        self.assertEqual(metrics["health_score"], 100)

        # Verificar que PDF y Excel integran la telemetría del repositorio sin errores
        self.evaluation.refresh_from_db()
        EvaluationResult.objects.create(
            evaluation=self.evaluation,
            factor=self.factor,
            weighted_average=Decimal("4.00"),
            meets_threshold=True,
            foda_classification=EvaluationResult.FODA_OPPORTUNITY,
        )
        EvaluationVerdict.objects.create(
            evaluation=self.evaluation,
            recommendation=EvaluationVerdict.RECOMMENDATION_A,
            explanation_text="Cumple los criterios metodológicos.",
        )
        pdf_buf = EvaluationPDFReport.generate(self.evaluation)
        self.assertTrue(pdf_buf.getvalue().startswith(b"%PDF-"))
        excel_buf = EvaluationExcelReport.generate(self.evaluation)
        self.assertTrue(excel_buf.getvalue().startswith(b"PK"))

    def test_sync_unsupported_url_returns_clean_status(self):
        metrics = sync_evaluation_repo_health(
            self.evaluation,
            repo_url="https://www.keycloak.org",
            force=True,
        )
        self.assertEqual(metrics["status"], "unsupported")
        self.evaluation.refresh_from_db()
        self.assertEqual(self.evaluation.software_repo_url, "https://www.keycloak.org")
