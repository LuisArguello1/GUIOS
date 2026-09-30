from django.contrib import admin

from .models.menuGroup import MenuGroup
from .models.menuModule import MenuModule
from .models.modulePermission import ModulePermission
from .models.organization import Organization


@admin.register(MenuGroup)
class MenuGroupAdmin(admin.ModelAdmin):
	list_display = ("name", "order", "icon")
	search_fields = ("name",)
	ordering = ("order", "name")


@admin.register(MenuModule)
class MenuModuleAdmin(admin.ModelAdmin):
	list_display = ("label", "group", "path", "order", "is_active", "icon")
	list_filter = ("group", "is_active")
	search_fields = ("label", "path", "icon")
	ordering = ("group__order", "order")


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
	list_display = ("name", "ruc", "phone", "email", "updated_at")
	search_fields = ("name", "ruc", "phone", "email")
	ordering = ("name",)



@admin.register(ModulePermission)
class ModulePermissionAdmin(admin.ModelAdmin):
	list_display = ("codename", "label", "module", "order")
	list_filter = ("module", "module__group")
	search_fields = ("codename", "label", "description")
	ordering = ("module__group__order", "module__order", "order")
	filter_horizontal = ("groups",)
	list_per_page = 50
