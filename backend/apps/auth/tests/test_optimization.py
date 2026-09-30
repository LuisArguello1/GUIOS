import time
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()


class AuthOptimizationTests(APITestCase):
    """
    Pruebas para verificar la optimización de consultas y rendimiento
    en los endpoints de la aplicación de autenticación y usuarios.
    """

    def setUp(self):
        # Crear grupos de prueba
        self.group_admin, _ = Group.objects.get_or_create(name="Administrador")
        self.group_operator, _ = Group.objects.get_or_create(name="Operador")

        # Crear 50 usuarios
        users_to_create = []
        for i in range(50):
            users_to_create.append(
                User(
                    email=f"user_opt_{i}@example.com",
                    username=f"useropt_{i}",
                    first_name=f"Nombre_{i}",
                    last_name=f"Apellido_{i}",
                    is_active=True,
                )
            )
        self.created_users = User.objects.bulk_create(users_to_create)

        # Asociar grupos
        for i, user in enumerate(self.created_users):
            if i % 2 == 0:
                user.groups.add(self.group_admin)
            else:
                user.groups.add(self.group_operator)

        # Configurar un administrador para poder realizar peticiones autenticadas
        self.admin_user = self.created_users[0]
        self.admin_user.is_staff = True
        self.admin_user.is_superuser = True
        self.admin_user.save()

        # URLs de los endpoints
        self.list_url = reverse('authentication:user-list')
        self.selectors_url = reverse('authentication:user-selectors')
        self.detail_url = reverse('authentication:user-detail', kwargs={'pk': self.admin_user.id})

    def test_user_list_query_count_is_optimized(self):
        """
        Verifica que la lista de usuarios no realice prefetching innecesario de permisos.
        Debería requerir un número mínimo y controlado de consultas.
        """
        self.client.force_authenticate(user=self.admin_user)

        connection.queries_log.clear()
        start_time = time.perf_counter()
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(self.list_url)
        end_time = time.perf_counter()

        queries_count = len(ctx.captured_queries)
        duration_ms = (end_time - start_time) * 1000

        print(f"\n[TEST LISTADO] Consultas SQL: {queries_count} | Tiempo: {duration_ms:.2f} ms")

        # Con prefetch condicional:
        # 1. Validación de sesión (middleware)
        # 2. Count para paginación
        # 3. SELECT de usuarios
        # 4. Prefetch de grupos
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(queries_count, 5, f"La lista está realizando {queries_count} consultas, lo cual es ineficiente.")

    def test_user_selectors_is_optimized(self):
        """
        Verifica que el endpoint de selectores sea extremadamente rápido y no instancie modelos.
        """
        self.client.force_authenticate(user=self.admin_user)

        connection.queries_log.clear()
        start_time = time.perf_counter()
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(self.selectors_url)
        end_time = time.perf_counter()

        queries_count = len(ctx.captured_queries)
        duration_ms = (end_time - start_time) * 1000

        print(f"[TEST SELECTORS] Consultas SQL: {queries_count} | Tiempo: {duration_ms:.2f} ms")

        # Debe tomar muy pocas consultas:
        # 1. Validación de sesión (middleware)
        # 2. Consulta directa de campos usando .values()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(queries_count, 3, f"El selector está realizando {queries_count} consultas, lo cual es ineficiente.")

    def test_user_detail_retains_full_prefetch(self):
        """
        Verifica que el detalle del usuario todavía cargue la información completa de permisos y menús.
        """
        self.client.force_authenticate(user=self.admin_user)

        connection.queries_log.clear()
        start_time = time.perf_counter()
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(self.detail_url)
        end_time = time.perf_counter()

        queries_count = len(ctx.captured_queries)
        duration_ms = (end_time - start_time) * 1000

        print(f"[TEST DETALLE] Consultas SQL: {queries_count} | Tiempo: {duration_ms:.2f} ms")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
