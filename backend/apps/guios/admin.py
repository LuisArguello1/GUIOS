from django.contrib import admin
from .models import (
    Dimension,
    Factor,
    Subfactor,
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
    AIAssistanceLog,
)


@admin.register(Dimension)
class DimensionAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'name', 'order', 'is_base', 'created_at')
    list_filter = ('is_base',)
    search_fields = ('code', 'name', 'description')
    ordering = ('order', 'id')


class SubfactorInline(admin.TabularInline):
    model = Subfactor
    extra = 1
    fields = ('code', 'description', 'order', 'is_base', 'is_active')


@admin.register(Factor)
class FactorAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'name', 'dimension', 'suggested_importance', 'scope', 'scope_configurable', 'order', 'is_active')
    list_filter = ('dimension', 'scope', 'scope_configurable', 'is_active', 'is_base')
    search_fields = ('code', 'name', 'dimension__name')
    ordering = ('dimension__order', 'order', 'id')
    inlines = [SubfactorInline]


@admin.register(Subfactor)
class SubfactorAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'factor', 'description_short', 'order', 'is_base', 'is_active')
    list_filter = ('factor__dimension', 'factor', 'is_active', 'is_base')
    search_fields = ('code', 'description', 'factor__name')
    ordering = ('factor__order', 'order', 'id')

    def description_short(self, obj):
        return obj.description[:60] + ('...' if len(obj.description) > 60 else '')
    description_short.short_description = 'Descripción'


class EvaluationFactorInline(admin.TabularInline):
    model = EvaluationFactor
    extra = 0
    readonly_fields = ('suggested_importance_snapshot', 'factor_name_snapshot', 'relative_importance', 'is_relevant')


class EvaluationResultInline(admin.TabularInline):
    model = EvaluationResult
    extra = 0
    readonly_fields = ('weighted_average', 'meets_threshold', 'foda_classification', 'calculated_at')


class EvaluationVerdictInline(admin.StackedInline):
    model = EvaluationVerdict
    extra = 0
    can_delete = False


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ('id', 'software_name', 'software_version', 'org_name', 'status', 'ai_enabled', 'started_at', 'completed_at')
    list_filter = ('status', 'ai_enabled', 'started_at')
    search_fields = ('software_name', 'org_name', 'uuid', 'session_token')
    readonly_fields = ('uuid', 'started_at')
    ordering = ('-started_at',)
    inlines = [EvaluationFactorInline, EvaluationResultInline, EvaluationVerdictInline]


@admin.register(EvaluationFactor)
class EvaluationFactorAdmin(admin.ModelAdmin):
    list_display = ('id', 'evaluation', 'factor', 'suggested_importance_snapshot', 'decisor_importance', 'relative_importance', 'is_relevant', 'scope_used')
    list_filter = ('is_relevant', 'scope_used', 'relative_importance')
    search_fields = ('evaluation__software_name', 'factor__name')


@admin.register(EvaluationSubfactor)
class EvaluationSubfactorAdmin(admin.ModelAdmin):
    list_display = ('id', 'evaluation', 'subfactor', 'rating', 'rating_was_ai_accepted', 'saved_at')
    list_filter = ('rating', 'rating_was_ai_accepted')
    search_fields = ('evaluation__software_name', 'subfactor__description')


@admin.register(EvaluationResult)
class EvaluationResultAdmin(admin.ModelAdmin):
    list_display = ('id', 'evaluation', 'factor', 'weighted_average', 'meets_threshold', 'foda_classification', 'calculated_at')
    list_filter = ('foda_classification', 'meets_threshold')
    search_fields = ('evaluation__software_name', 'factor__name')


@admin.register(EvaluationVerdict)
class EvaluationVerdictAdmin(admin.ModelAdmin):
    list_display = ('id', 'evaluation', 'recommendation', 'calculated_at')
    list_filter = ('recommendation', 'calculated_at')
    search_fields = ('evaluation__software_name', 'explanation_text')


@admin.register(AIAssistanceLog)
class AIAssistanceLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'evaluation', 'request_type', 'status', 'response_time_ms', 'requested_at')
    list_filter = ('request_type', 'status', 'requested_at')
    search_fields = ('evaluation__software_name', 'error_message')
    readonly_fields = ('requested_at',)
