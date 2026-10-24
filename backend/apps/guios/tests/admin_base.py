"""Base común de las pruebas del panel administrativo (Paso 7)."""
from io import StringIO

from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.auth.models.user import CustomUser
from apps.core.models.modulePermission import ModulePermission
from apps.guios.models import Evaluation, EvaluationFactor, EvaluationSubfactor, Factor, Subfactor
from apps.guios.services import evaluation as evaluation_service

ADMIN = '/api/v1/guios/admin'

# Caso UNEMI con LibreOffice: código -> (ID, calificaciones).
UNEMI = {
    'TEC-COM': (4, [4, 4, 4, 4, 4, 4, 4, 2]), 'TEC-PER': (3, [1, 1, 2, 2, 2, 2]),
    'TEC-FIA': (3, [4, 3, 3, 3, 3]), 'TEC-REU': (2, [3, 3]), 'TEC-USA': (3, [4, 3, 4, 3]),
    'TEC-DOC': (3, [3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2]), 'TEC-MAN': (3, [4]), 'TEC-POR': (3, [2, 2]),
    'TEC-PRU': (3, [3]), 'ORG-SOP': (4, [3, 3, 2, 2, 2, 2]), 'ORG-TIE': (2, [4, 3]),
    'ORG-FOR': (3, [3, 3, 3, 2]), 'ORG-CAS': (2, [3]), 'ORG-CEN': (2, [3, 2]), 'ORG-APO': (3, [4]),
    'ORG-BLO': (2, [2]), 'ORG-ACT': (2, [3, 3]), 'ECO-TCO': (3, [4, 3]),
}


class AdminApiTestBase(APITestCase):

    @classmethod
    def setUpTestData(cls):
        out = StringIO()
        call_command('setup_menus', stdout=out)
        call_command('setup_permissions', stdout=out)
        call_command('seed_guios_catalog', stdout=out)
        cls.superuser = CustomUser.objects.create_superuser(email='super@unemi.edu.ec', password='Clave-segura-123')
        cls.nobody = CustomUser.objects.create_user(email='sinrol@unemi.edu.ec', password='Clave-segura-123')
        cls.viewer = cls.user_with('lector@unemi.edu.ec', 'Lector', ['catalog.view', 'evaluations.view'])
        cls.editor = cls.user_with('editor@unemi.edu.ec', 'Editor de catálogo',
                                   ['catalog.view', 'catalog.create', 'catalog.edit', 'catalog.delete'])
        cls.exporter = cls.user_with('exporta@unemi.edu.ec', 'Exportador', ['evaluations.view', 'evaluations.export'])
        cls.dashboard = cls.user_with('tablero@unemi.edu.ec', 'Tablero', ['dashboard.view'])

    @classmethod
    def user_with(cls, email, role, codenames):
        group = Group.objects.create(name=role)
        for permission in ModulePermission.objects.filter(codename__in=codenames):
            permission.groups.add(group)
        user = CustomUser.objects.create_user(email=email, password='Clave-segura-123')
        user.groups.add(group)
        return user

    def setUp(self):
        cache.clear()

    def as_user(self, user):
        """Autentica como el panel: cookie access_token (CookieJWTAuthentication)."""
        self.client.cookies['access_token'] = str(AccessToken.for_user(user))
        return self.client

    # ── Evaluaciones armadas con los servicios (sin pasar por la API pública) ──

    @staticmethod
    def make_evaluation(software='LibreOffice', org='UNEMI', fill=True, close=True):
        evaluation, _ = evaluation_service.create_evaluation(software_name=software, org_name=org)
        if fill:
            for code, (id_, ratings) in UNEMI.items():
                item = EvaluationFactor.objects.select_related('factor').get(evaluation=evaluation, factor__code=code)
                evaluation_service.set_decisor_importance(evaluation, item, id_)
                if item.factor.scope_configurable:
                    evaluation_service.set_scope(evaluation, item, 'internal')
                subs = EvaluationSubfactor.objects.filter(
                    evaluation=evaluation, subfactor__factor__code=code,
                ).order_by('subfactor__order', 'subfactor_id')
                for sub, rating in zip(subs, ratings):
                    evaluation_service.set_rating(evaluation, sub, rating)
        if fill and close:
            evaluation, _ = evaluation_service.generate_verdict(evaluation)
        return Evaluation.objects.get(pk=evaluation.pk)

    @staticmethod
    def factor(code):
        return Factor.objects.get(code=code)

    @staticmethod
    def subfactor(code):
        return Subfactor.objects.get(code=code)
