import logging

from rest_framework import permissions

from apps.core.selectors.permissions import user_has_permission

logger = logging.getLogger(__name__)


class HasModulePermission(permissions.BasePermission):
    """
    Sistema de permisos granulares basado en ModulePermission.

    Las vistas definen qué permiso se requiere mediante:

        # Opción A — mismo permiso para todas las acciones:
        required_permission = 'pos.create_sale'

        # Opción B — permiso por acción REST:
        required_permission = {
            'list':    'sales.view_all',
            'create':  'pos.create_sale',
            'destroy': 'pos.cancel_sale',
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


# Alias de compatibilidad — se puede eliminar cuando no haya más imports
HasGranularPermission = HasModulePermission


class HasObjectPermission(permissions.BasePermission):
    """
    Permiso por propiedad de objeto.
    Permite acceso si es superuser o si el usuario es propietario.
    """

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user

        if user.is_superuser:
            return True

        # Buscar campo de propietario en el objeto
        owner = getattr(
            obj, "user",
            getattr(obj, "created_by",
            getattr(obj, "user_open", None))
        )

        # Caso especial: modelos anclados a una venta
        if not owner and hasattr(obj, "sale"):
            owner = getattr(obj.sale, "user", None)

        if owner and owner == user:
            return True

        is_sale = hasattr(obj, "payment_type") and hasattr(obj, "total") and hasattr(obj, "is_paid")
        is_debt = hasattr(obj, "total_amount") and hasattr(obj, "paid_amount") and hasattr(obj, "is_paid")
        is_cash = hasattr(obj, "initial_amount") or hasattr(obj, "cash_register")

        # Permisos granulares para ver objetos de otros
        if request.method in permissions.SAFE_METHODS:
            if is_sale and user_has_permission(user, "sales.view_all"):
                return True
            if is_cash and user_has_permission(user, "cash.view_all"):
                return True
            if is_debt and user_has_permission(user, "debts.view_all"):
                return True

        # Permisos granulares para MODIFICAR objetos de otros
        action = getattr(view, 'action', None)
        if action:
            if is_sale:
                if action == 'cancel' and user_has_permission(user, "sales.cancel_any"):
                    return True
                if action == 'add_payment' and user_has_permission(user, "debts.register_payment"):
                    return True
                if action == 'mark_as_paid' and user_has_permission(user, "pos.create_sale"):
                    return True
            if is_cash:
                # Si tiene permiso de ver todo (rol supervisor/manager), puede operar sobre otras cajas
                if user_has_permission(user, "cash.view_all"):
                    return True

                # En modo Global (force_single_open_register), permitimos que cualquier usuario
                # con los permisos adecuados opere sobre la caja abierta, aunque no la haya abierto él.
                if hasattr(obj, 'status') and obj.status == 'ABIERTA':
                    try:
                        from apps.cashregister.services.cash_register import get_cash_runtime_config
                        config = get_cash_runtime_config()
                        if config.get('force_single_open_register'):
                            return True
                    except ImportError:
                        pass

            if is_debt:
                if action == 'add_payment' and user_has_permission(user, "debts.register_payment"):
                    return True

        return False
