import logging

from rest_framework import permissions

from apps.core.selectors.permissions import user_has_permission

logger = logging.getLogger(__name__)


class HasModulePermission(permissions.BasePermission):
    """
    Sistema de permisos granulares basado en ModulePermission.

    Las vistas definen qué permiso se requiere mediante:

        # Opción A — mismo permiso para todas las acciones:
        required_permission = 'users.view'

        # Opción B — permiso por acción REST:
        required_permission = {
            'list':    'users.view',
            'create':  'users.create',
            'destroy': 'users.deactivate',
        }

    Niveles de evaluación:
        1. No autenticado → 403
        2. Superuser → bypass total → True
        3. `required_permission` definido → consulta ModulePermission
        4. Sin restricción definida → True (vista pública autenticada)
    """

    def has_permission(self, request, view) -> bool:
        user = request.user

        if not user or not user.is_authenticated:
            return False

        # ── Superuser bypasea todo ────────────────────────────────────────────
        if user.is_superuser:
            return True

        # ── Resolver el codename requerido ────────────────────────────────────
        required = self._resolve_required_codename(request, view)
        if required is None:
            # Sin restricción: cualquier usuario autenticado puede acceder
            return True

        # Si es una lista o tupla, verificar si tiene AL MENOS UNO
        if isinstance(required, (list, tuple)):
            return any(user_has_permission(user, c) for c in required)

        return user_has_permission(user, required)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _resolve_required_codename(self, request, view) -> str | tuple | list | None:
        """
        Determina qué codename de permiso se requiere para esta petición.
        Soporta dos formatos de declaración en la vista:

        1. required_permission = 'codename'
        2. required_permission = {'action': 'codename', ...}
        """
        action = getattr(view, "action", None)

        # Si no es un ViewSet (es una APIView), mapeamos el método HTTP a una acción lógica
        if action is None:
            method_map = {
                "GET": "list",
                "POST": "create",
                "PUT": "update",
                "PATCH": "update",
                "DELETE": "destroy",
            }
            action = method_map.get(request.method, request.method.lower())

        perm = getattr(view, "required_permission", None)
        if perm:
            if isinstance(perm, dict):
                return perm.get(action)
            return perm

        return None
