import re

from django.test import TestCase

STRICT_CSP = "default-src 'self'"


class SecurityHeadersTests(TestCase):
    """CSP estricta en la API; CSP propia solo para la documentación (sidecar)."""

    def test_api_keeps_strict_csp(self):
        response = self.client.get('/api/v1/guios/public/catalog/')
        self.assertEqual(response['Content-Security-Policy'], STRICT_CSP)
        response = self.client.get('/api/v1/guios/public/evaluations/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(response['Content-Security-Policy'], STRICT_CSP)

    def test_docs_csp_allows_no_external_or_inline_scripts(self):
        for path in ('/api/docs/', '/api/redoc/'):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                csp = response['Content-Security-Policy']
                self.assertTrue(csp.startswith("default-src 'self'"))
                self.assertNotIn('script-src', csp)          # scripts: solo 'self'
                self.assertNotIn('http', csp)                # ningún CDN permitido
                self.assertIn("worker-src 'self' blob:", csp)

    def test_docs_use_local_assets_and_no_inline_scripts(self):
        for path in ('/api/docs/', '/api/redoc/'):
            with self.subTest(path=path):
                html = self.client.get(path).content.decode()
                self.assertIn('/static/drf_spectacular_sidecar/', html)
                self.assertNotIn('cdn.jsdelivr.net', html)
                for script in re.findall(r'<script([^>]*)>(.*?)</script>', html, re.S):
                    attrs, body = script
                    self.assertIn('src=', attrs)
                    self.assertEqual(body.strip(), '')
