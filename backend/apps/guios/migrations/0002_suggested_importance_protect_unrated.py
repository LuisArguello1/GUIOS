import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Paso 2 del plan (docs/ANALISIS_GUIOS_ORIGINAL.md §8): "Importancia Sugerida" (P5),
    PROTECT en el catálogo, factor_name_snapshot (RN-08), valores "sin calificar" (P4)
    y etiquetas A/B/C de la tesis.
    """

    dependencies = [
        ('guios', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='factor',
            old_name='systemic_importance',
            new_name='suggested_importance',
        ),
        migrations.RenameField(
            model_name='evaluationfactor',
            old_name='systemic_importance_snapshot',
            new_name='suggested_importance_snapshot',
        ),
        migrations.AddField(
            model_name='evaluationfactor',
            name='factor_name_snapshot',
            field=models.CharField(default='', help_text='Copia inmutable del nombre del factor al momento de la evaluación (RN-08).', max_length=200, verbose_name='Snapshot del nombre del factor'),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='evaluationfactor',
            name='decisor_importance',
            field=models.PositiveSmallIntegerField(blank=True, help_text='Valoración asignada por la organización evaluadora (1 a 4). Nulo = sin calificar (RN-12).', null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(4)], verbose_name='Importancia del Decisor (ID)'),
        ),
        migrations.AlterField(
            model_name='evaluationfactor',
            name='is_relevant',
            field=models.BooleanField(blank=True, help_text='True si IR > Irrelevante (1). Determina si pasa al Paso 3-4 (RN-01). Nulo mientras la ID esté sin calificar.', null=True, verbose_name='Es relevante'),
        ),
        migrations.AlterField(
            model_name='evaluationfactor',
            name='relative_importance',
            field=models.PositiveSmallIntegerField(blank=True, help_text='Calculada por el motor: floor((IS_idx + ID_idx) / 2) mapeada a [1-4]. Nula mientras la ID esté sin calificar.', null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(4)], verbose_name='Importancia Relativa (IR)'),
        ),
        migrations.AlterField(
            model_name='evaluationfactor',
            name='scope_used',
            field=models.CharField(blank=True, choices=[('internal', 'Interno'), ('external', 'Externo')], default='', help_text="Interno o Externo. Configurable por el usuario solo para 'Soporte'; vacío mientras no lo elija (RN-06, RN-12).", max_length=10, verbose_name='Ámbito FODA efectivo'),
        ),
        migrations.AlterField(
            model_name='evaluationfactor',
            name='suggested_importance_snapshot',
            field=models.PositiveSmallIntegerField(help_text='Copia inmutable del IS del factor al momento de la evaluación (RN-08).', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(4)], verbose_name='Snapshot de Importancia Sugerida (IS)'),
        ),
        migrations.AlterField(
            model_name='evaluationsubfactor',
            name='rating',
            field=models.PositiveSmallIntegerField(blank=True, choices=[(1, 'No cumple el requisito'), (2, 'Desconozco si cumple el requisito'), (3, 'Cumple parcialmente el requisito'), (4, 'Cumple el requisito')], help_text='1: No cumple, 2: Desconozco, 3: Cumple parcialmente, 4: Cumple. Nulo = sin calificar (RN-12).', null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(4)], verbose_name='Calificación del evaluador'),
        ),
        migrations.AlterField(
            model_name='evaluationverdict',
            name='ai_mitigation_plan',
            field=models.TextField(blank=True, default='', help_text='Plan de acciones correctivas para factores negativos (Recomendación B o C). Vacío si no aplica.', verbose_name='Plan de mitigación generado por IA'),
        ),
        migrations.AlterField(
            model_name='evaluationverdict',
            name='recommendation',
            field=models.CharField(choices=[('A', 'Recomendación A (Adoptar)'), ('B', 'Recomendación B (Es posible adoptar con matices)'), ('C', 'Recomendación C (Analizar y posponer la adopción)')], max_length=1, verbose_name='Tipo de recomendación'),
        ),
        migrations.AlterField(
            model_name='factor',
            name='dimension',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='factors', to='guios.dimension', verbose_name='Dimensión'),
        ),
        migrations.AlterField(
            model_name='factor',
            name='suggested_importance',
            field=models.PositiveSmallIntegerField(help_text='Valor fijo definido por la metodología (1: Irrelevante, 2: Opcional, 3: Importante, 4: Fundamental).', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(4)], verbose_name='Importancia Sugerida (IS)'),
        ),
        migrations.AlterField(
            model_name='subfactor',
            name='factor',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='subfactors', to='guios.factor', verbose_name='Factor'),
        ),
    ]
