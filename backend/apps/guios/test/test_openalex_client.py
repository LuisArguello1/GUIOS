"""
apps/guios/test/test_openalex_client.py
───────────────────────────────────────────────────────────────────────────────
Pruebas unitarias para el cliente de OpenAlex y decodificación de metadatos.
"""
from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase

from apps.guios.services.literature.openalex import (
    AcademicWork,
    OpenAlexClient,
    clean_doi,
    reconstruct_abstract,
)


class OpenAlexClientTestCase(SimpleTestCase):
    def test_clean_doi(self):
        self.assertEqual(clean_doi("https://doi.org/10.1109/TSE.2023.12345"), "10.1109/TSE.2023.12345")
        self.assertEqual(clean_doi("http://dx.doi.org/10.1016/j.jss.2022.01"), "10.1016/j.jss.2022.01")
        self.assertEqual(clean_doi("10.1145/1234567"), "10.1145/1234567")
        self.assertEqual(clean_doi(None), "")
        self.assertEqual(clean_doi(""), "")

    def test_reconstruct_abstract(self):
        inverted_index = {
            "Open": [0],
            "source": [1],
            "software": [2],
            "adoption": [3],
            "is": [4],
            "beneficial.": [5],
        }
        abstract = reconstruct_abstract(inverted_index)
        self.assertEqual(abstract, "Open source software adoption is beneficial.")

        # Manejo de nulo o dict vacío
        self.assertEqual(reconstruct_abstract(None), "")
        self.assertEqual(reconstruct_abstract({}), "")

    def test_academic_work_to_dict(self):
        work = AcademicWork(
            openalex_id="https://openalex.org/W123",
            doi="10.1234/test",
            doi_url="https://doi.org/10.1234/test",
            title="Study on FLOSS",
            publication_year=2024,
            venue_name="IEEE Software",
            cited_by_count=10,
            abstract="Abstract text",
        )
        data = work.to_dict()
        self.assertEqual(data["doi"], "10.1234/test")
        self.assertEqual(data["publication_year"], 2024)

    @patch("apps.guios.services.literature.openalex.httpx.Client")
    def test_search_works_success(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "id": "https://openalex.org/W1",
                    "doi": "https://doi.org/10.1145/1111",
                    "title": "Adoption of Keycloak in Enterprise",
                    "publication_year": 2023,
                    "cited_by_count": 5,
                    "primary_location": {"source": {"display_name": "ACM Computing Surveys"}},
                    "abstract_inverted_index": {"Keycloak": [0], "provides": [1], "IAM.": [2]},
                },
                {
                    "id": "https://openalex.org/W2",
                    "doi": "https://doi.org/10.1109/2222",
                    "title": "Security Evaluation of Keycloak Authentication Frameworks",
                    "publication_year": 2022,
                    "cited_by_count": 12,
                    "primary_location": {"source": {"display_name": "IEEE Security"}},
                    "abstract_inverted_index": {"We": [0], "evaluate": [1], "Keycloak": [2], "security.": [3]},
                },
                {
                    "id": "https://openalex.org/W3",
                    "doi": "https://doi.org/10.1007/3333",
                    "title": "Comparative Study of Keycloak and Open Source IAM",
                    "publication_year": 2021,
                    "cited_by_count": 3,
                    "primary_location": {"source": {"display_name": "Springer LNCS"}},
                    "abstract_inverted_index": {"Comparison": [0], "of": [1], "Keycloak": [2], "tools.": [3]},
                },
            ]
        }
        mock_client.get.return_value = mock_response

        client = OpenAlexClient()
        works = client.search_works(software_name="Keycloak", category="Seguridad")

        self.assertEqual(len(works), 3)
        self.assertEqual(works[0].doi, "10.1145/1111")
        self.assertEqual(works[0].abstract, "Keycloak provides IAM.")
        self.assertEqual(works[1].venue_name, "IEEE Security")

    def test_mentions_software_uses_whole_words(self):
        from apps.guios.services.literature.openalex import mentions_software

        self.assertTrue(mentions_software("Migrating to Go in production", "Go"))
        self.assertFalse(mentions_software("A good digital strategy", "Go"))
        self.assertTrue(mentions_software("Odoo-based ERP", "Odoo"))
        self.assertFalse(mentions_software("", "Odoo"))

    @patch("apps.guios.services.literature.openalex.httpx.Client")
    def test_search_works_network_error_handled_gracefully(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.get.side_effect = Exception("Connection timed out")

        client = OpenAlexClient()
        works = client.search_works(software_name="AnySoftware")
        self.assertEqual(works, [])

    @patch("apps.guios.services.literature.openalex.httpx.Client")
    def test_search_works_enforces_2020_2025_date_range_in_filter_and_locally(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "id": "https://openalex.org/W2019",
                    "doi": "https://doi.org/10.1000/old-2019",
                    "title": "Old Keycloak Study Before Window",
                    "publication_year": 2019,
                    "cited_by_count": 50,
                    "primary_location": {"source": {"display_name": "Old Journal"}},
                    "abstract_inverted_index": {"Keycloak": [0], "legacy": [1], "study.": [2]},
                },
                {
                    "id": "https://openalex.org/W2020",
                    "doi": "https://doi.org/10.1000/ok-2020",
                    "title": "Keycloak Architecture 2020",
                    "publication_year": 2020,
                    "cited_by_count": 10,
                    "primary_location": {"source": {"display_name": "Journal 2020"}},
                    "abstract_inverted_index": {"Keycloak": [0], "architecture": [1], "2020.": [2]},
                },
                {
                    "id": "https://openalex.org/W2025",
                    "doi": "https://doi.org/10.1000/ok-2025",
                    "title": "Keycloak Security 2025",
                    "publication_year": 2025,
                    "cited_by_count": 8,
                    "primary_location": {"source": {"display_name": "Journal 2025"}},
                    "abstract_inverted_index": {"Keycloak": [0], "security": [1], "2025.": [2]},
                },
                {
                    "id": "https://openalex.org/W2026",
                    "doi": "https://doi.org/10.1000/new-2026",
                    "title": "Future Keycloak 2026",
                    "publication_year": 2026,
                    "cited_by_count": 2,
                    "primary_location": {"source": {"display_name": "Journal 2026"}},
                    "abstract_inverted_index": {"Keycloak": [0], "future": [1], "2026.": [2]},
                },
            ]
        }
        mock_client.get.return_value = mock_response

        client = OpenAlexClient()
        works = client.search_works(software_name="Keycloak", category="Seguridad")

        self.assertTrue(mock_client.get.called)
        for call in mock_client.get.call_args_list:
            params = call.kwargs.get("params") or {}
            self.assertIn("publication_year:2020-2025", params.get("filter", ""))

        dois = [w.doi for w in works]
        self.assertEqual(dois, ["10.1000/ok-2020", "10.1000/ok-2025"])

