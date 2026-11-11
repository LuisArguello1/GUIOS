"""
apps/core/management/commands/seed_guios_catalog.py
─────────────────────────────────────────────────────────────────────────────
Pobla (o actualiza) de manera automática el Catálogo Maestro de la metodología GUIOS
(Dimensiones, Factores y Subfactores) extraído de la tesis doctoral:
"Factores para la adopción de soluciones basadas en software libre" (Rea Sánchez, 2022).

Estructura cargada:
- 3 Dimensiones (Tecnológica, Organizacional, Económica)
- 18 Factores (con sus alcances, IE base e IL base)
- 61 Subfactores (afirmaciones verificables y palabras clave para IA)

Uso:
    python manage.py seed_guios_catalog
    python manage.py seed_guios_catalog --reset
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from apps.guios.models import Dimension, Factor, Subfactor
from apps.guios.services.calculations.matrix import combine_importance


GUIOS_CATALOGO = [
    {
        "name": "Tecnológica",
        "description": "Factores que se relacionan con las características técnicas de los productos que se consideran para su adopción.",
        "order": 1,
        "factors": [
            {
                "name": "Compatibilidad",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 3,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "Una empresa proporciona una infraestructura de nube lista para usar para este software.",
                        "base_citations_count": 2,
                        "keywords_ia": "cloud infrastructure, saas, paas, aws, azure, hosting, nube gestionada",
                    },
                    {
                        "description": "El software puede exportar formatos propietarios.",
                        "base_citations_count": 3,
                        "keywords_ia": "export, formatos propietarios, interoperabilidad, office, docx, xlsx, pdf",
                    },
                    {
                        "description": "El software interactúa y se integra con el software propietario existente.",
                        "base_citations_count": 4,
                        "keywords_ia": "integración, api, middleware, legacy systems, conectividad, sistemas existentes",
                    },
                    {
                        "description": "El software está certificado para operar en su nicho de mercado.",
                        "base_citations_count": 2,
                        "keywords_ia": "certificación, estándares de industria, compliance, auditoría, homologación",
                    },
                    {
                        "description": "El software es compatible con los casos de uso y las funcionalidades más comunes.",
                        "base_citations_count": 4,
                        "keywords_ia": "funcionalidades, casos de uso habituales, requerimientos de usuario, cobertura funcional",
                    },
                    {
                        "description": "El software es compatible con múltiples componentes de hardware.",
                        "base_citations_count": 3,
                        "keywords_ia": "hardware compatibility, arquitecturas x86 arm, drivers, periféricos, servidores",
                    },
                    {
                        "description": "El software usa formatos estándar.",
                        "base_citations_count": 5,
                        "keywords_ia": "formatos estándar, open standards, odf, xml, json, rfc, interoperabilidad abierta",
                    },
                    {
                        "description": "El software es compatible con varios sistemas operativos diferentes.",
                        "base_citations_count": 4,
                        "keywords_ia": "cross-platform, multiplataforma, linux, windows, macos, bsd",
                    },
                ],
            },
            {
                "name": "Personalización",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 4,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El acceso al código fuente es un incentivo para la organización.",
                        "base_citations_count": 4,
                        "keywords_ia": "código fuente, source code access, soberanía tecnológica, inspección, transparencia",
                    },
                    {
                        "description": "El software se puede ampliar fácilmente para satisfacer mis necesidades mejorando el código fuente.",
                        "base_citations_count": 4,
                        "keywords_ia": "extensibilidad, modificación de código, parches internos, desarrollo a medida",
                    },
                    {
                        "description": "Las innovaciones se introducen en el software a un ritmo rápido.",
                        "base_citations_count": 3,
                        "keywords_ia": "innovación rápida, release cycle, nuevas características, evolución tecnológica",
                    },
                    {
                        "description": "El software es fácil de personalizar sin necesidad de actualizar el código fuente.",
                        "base_citations_count": 3,
                        "keywords_ia": "personalización sin código, configuración flexible, preferencias, ajustes de usuario",
                    },
                    {
                        "description": "El software soporta nuevas funciones a través de módulos.",
                        "base_citations_count": 4,
                        "keywords_ia": "módulos, plugins, extensiones, arquitectura modular, addons",
                    },
                    {
                        "description": "Hay un repositorio público de extensiones para este software.",
                        "base_citations_count": 3,
                        "keywords_ia": "marketplace de plugins, extensión comunitaria, plugin registry, catálogo de módulos",
                    },
                ],
            },
            {
                "name": "Fiabilidad",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 3,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El software tiene un buen historial en cuanto a errores de seguridad (el software es seguro).",
                        "base_citations_count": 5,
                        "keywords_ia": "seguridad informática, cve, vulnerabilidades, parches de seguridad, auditoría de código",
                    },
                    {
                        "description": "El software es fiable y estable.",
                        "base_citations_count": 5,
                        "keywords_ia": "estabilidad, robustez, uptime, baja tasa de fallos, confiabilidad técnica",
                    },
                    {
                        "description": "El software es más flexible que la solución propietaria.",
                        "base_citations_count": 3,
                        "keywords_ia": "flexibilidad operativa, adaptabilidad, menor rigidez de arquitectura",
                    },
                    {
                        "description": "El software es más confiable que la solución propietaria.",
                        "base_citations_count": 3,
                        "keywords_ia": "confiabilidad comparativa, disponibilidad del servicio, tolerancia a fallos",
                    },
                    {
                        "description": "El programa proporciona una amplia variedad de funciones de control de acceso.",
                        "base_citations_count": 4,
                        "keywords_ia": "control de acceso, rbac, roles y permisos, autenticación mfa, acl, seguridad",
                    },
                ],
            },
            {
                "name": "Reutilización",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 2,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "La licencia permite extensiones propietarias.",
                        "base_citations_count": 2,
                        "keywords_ia": "licenciamiento permisivo, mit, bsd, apache, extensiones comerciales propietarias",
                    },
                    {
                        "description": "El software se ofrece como una biblioteca / marco de trabajo.",
                        "base_citations_count": 2,
                        "keywords_ia": "framework, sdk, librería de software, componentes reutilizables de desarrollo",
                    },
                ],
            },
            {
                "name": "Usabilidad",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 2,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El software proporciona una interfaz gráfica de usuario (GUI).",
                        "base_citations_count": 3,
                        "keywords_ia": "interfaz gráfica, gui, ui intuitiva, entorno visual de escritorio o web",
                    },
                    {
                        "description": "El software es más fácil de usar que la alternativa propietaria.",
                        "base_citations_count": 2,
                        "keywords_ia": "ergonomía, facilidad de uso, experiencia de usuario, satisfacción ux",
                    },
                    {
                        "description": "El software es fácil de aprender.",
                        "base_citations_count": 3,
                        "keywords_ia": "curva de aprendizaje suave, facilidad de aprendizaje, intuitividad inicial",
                    },
                    {
                        "description": "El usuario está descontento con el software propietario.",
                        "base_citations_count": 2,
                        "keywords_ia": "insatisfacción de usuario privativo, motivación al reemplazo, frustración tecnológica",
                    },
                ],
            },
            {
                "name": "Documentación",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 1,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "La documentación de desarrollo cubre todas las características.",
                        "base_citations_count": 2,
                        "keywords_ia": "documentación de desarrollo, api docs, arquitectura técnica completa",
                    },
                    {
                        "description": "El software está bien documentado.",
                        "base_citations_count": 3,
                        "keywords_ia": "calidad de documentación, manuales exhaustivos, guías técnicas oficiales",
                    },
                    {
                        "description": "La documentación está disponible en múltiples formatos.",
                        "base_citations_count": 1,
                        "keywords_ia": "formatos de documentación, pdf, html, wiki, man pages, offline docs",
                    },
                    {
                        "description": "La documentación es fácil de entender.",
                        "base_citations_count": 2,
                        "keywords_ia": "claridad documental, tutoriales guiados, explicaciones sencillas",
                    },
                    {
                        "description": "La documentación está actualizada.",
                        "base_citations_count": 2,
                        "keywords_ia": "documentación actualizada, release notes, sincronización con versión vigente",
                    },
                    {
                        "description": "La documentación está escrita por escritores especializados.",
                        "base_citations_count": 1,
                        "keywords_ia": "redactores técnicos profesionales, technical writers, precisión editorial",
                    },
                    {
                        "description": "La documentación del software es de alta calidad.",
                        "base_citations_count": 2,
                        "keywords_ia": "alta calidad documental, precisión técnica, estructuración profesional",
                    },
                    {
                        "description": "El software viene con documentación de desarrollo.",
                        "base_citations_count": 2,
                        "keywords_ia": "guías de desarrollo, sdk, especificación de código y módulos",
                    },
                    {
                        "description": "El software viene con documentación del usuario.",
                        "base_citations_count": 3,
                        "keywords_ia": "manual de usuario final, user guide, ayuda contextual integrada",
                    },
                    {
                        "description": "La documentación del usuario cubre todas las características.",
                        "base_citations_count": 2,
                        "keywords_ia": "cobertura funcional de usuario, instructivos de operación, faqs",
                    },
                    {
                        "description": "Los formatos de datos están bien documentados.",
                        "base_citations_count": 2,
                        "keywords_ia": "especificación de formatos de archivo, esquemas de datos, data format docs",
                    },
                ],
            },
            {
                "name": "Mantenimiento",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 3,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El software es mantenido activamente por los desarrolladores.",
                        "base_citations_count": 4,
                        "keywords_ia": "mantenimiento activo, frecuencia de commits, soporte de bugs, vitalidad de proyecto",
                    },
                ],
            },
            {
                "name": "Portabilidad",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 2,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "Una versión de aplicación móvil de este software está disponible.",
                        "base_citations_count": 2,
                        "keywords_ia": "aplicación móvil, android, ios, soporte móvil nativo",
                    },
                    {
                        "description": "El software es un sistema de administración de base de datos independiente.",
                        "base_citations_count": 2,
                        "keywords_ia": "independencia de motor de base de datos, compatibilidad db, rdbms agnostic",
                    },
                ],
            },
            {
                "name": "Prueba",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 3,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El software es fácil de instalar y de probar.",
                        "base_citations_count": 4,
                        "keywords_ia": "facilidad de instalación, despliegue docker, sandbox de prueba, demo interactivo",
                    },
                ],
            },
        ],
    },
    {
        "name": "Organizacional",
        "description": "Factores relacionados con los aspectos organizacionales y los recursos humanos de la institución que adoptan un producto.",
        "order": 2,
        "factors": [
            {
                "name": "Soporte",
                "scope": Factor.SCOPE_INTERNAL,
                "scope_configurable": True,  # Puede evaluarse interno o externo según decisión del usuario
                "literature_importance_base": 4,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El soporte de la comunidad para este software está disponible.",
                        "base_citations_count": 5,
                        "keywords_ia": "soporte comunitario, foros de soporte, stack overflow, discord, canal oficial",
                    },
                    {
                        "description": "Soporte de expertos y consultores externos para consultas específicas está disponible.",
                        "base_citations_count": 4,
                        "keywords_ia": "consultoría externa, asesores especializados, servicios profesionales independientes",
                    },
                    {
                        "description": "El soporte comercial de este software está disponible 24/7/365.",
                        "base_citations_count": 4,
                        "keywords_ia": "soporte comercial 24/7, sla empresarial, contratos de mantenimiento garantizado",
                    },
                    {
                        "description": "Es fácil contratar personal informático en la comunidad que conozca este software.",
                        "base_citations_count": 3,
                        "keywords_ia": "talento humano ti, mercado laboral de desarrolladores, perfiles capacitados",
                    },
                    {
                        "description": "Hay desarrolladores en su organización que saben cómo desarrollar este software.",
                        "base_citations_count": 4,
                        "keywords_ia": "desarrolladores internos, capacidades técnicas del staff, soporte in-house",
                    },
                    {
                        "description": "Soporte comercial para la personalización de software está disponible.",
                        "base_citations_count": 3,
                        "keywords_ia": "servicios de personalización comercial, empresas integradoras, consultoras ti",
                    },
                ],
            },
            {
                "name": "Formación",
                "scope": Factor.SCOPE_INTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 4,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "La adopción de este software permite a los usuarios mejorar las habilidades técnicas de TI.",
                        "base_citations_count": 3,
                        "keywords_ia": "mejora de competencias ti, capacitación tecnológica, crecimiento profesional de usuarios",
                    },
                    {
                        "description": "El personal de la organización puede aprender fácilmente por sí mismo a utilizar este software.",
                        "base_citations_count": 3,
                        "keywords_ia": "autoaprendizaje, capacidad autodidacta del personal, autonomía de uso",
                    },
                    {
                        "description": "El personal de la organización está capacitado para resolver problemas tecnológicos.",
                        "base_citations_count": 4,
                        "keywords_ia": "resolución de incidencias técnicas, autosuficiencia de soporte ti interno",
                    },
                    {
                        "description": "Los planes de entrenamiento de este software están disponibles.",
                        "base_citations_count": 4,
                        "keywords_ia": "planes de capacitación, cursos estructurados, material de entrenamiento, certificaciones",
                    },
                ],
            },
            {
                "name": "Tiempo de adopción",
                "scope": Factor.SCOPE_INTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 1,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "Los requisitos de instalación y despliegue del software son fáciles de cumplir.",
                        "base_citations_count": 2,
                        "keywords_ia": "requisitos de instalación simples, despliegue ágil, aprovisionamiento rápido",
                    },
                    {
                        "description": "El tiempo requerido para adoptar este software es bajo.",
                        "base_citations_count": 2,
                        "keywords_ia": "tiempo de adopción reducido, periodo de transición rápido, migración ágil",
                    },
                ],
            },
            {
                "name": "Casos de estudio de la adopción de FLOSS",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 1,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "Hay informes públicos disponibles en Internet que describen el éxito de la adopción de este software (de organizaciones similares).",
                        "base_citations_count": 3,
                        "keywords_ia": "casos de éxito públicos, testimonios de adopción, whitepapers institucionales",
                    },
                    {
                        "description": "La adopción de este software mejora el entorno de trabajo de los usuarios.",
                        "base_citations_count": 3,
                        "keywords_ia": "mejora del entorno de trabajo, clima laboral tecnológico, productividad de empleados",
                    },
                ],
            },
            {
                "name": "Centralidad de TI",
                "scope": Factor.SCOPE_INTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 1,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "Centralizar la infraestructura de TI ayuda a acelerar la adopción de este software.",
                        "base_citations_count": 2,
                        "keywords_ia": "infraestructura centralizada, gobernanza de ti, control unificado de tecnología",
                    },
                ],
            },
            {
                "name": "Apoyo de alta dirección",
                "scope": Factor.SCOPE_INTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 4,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "La alta dirección apoya la adopción exitosa de este software.",
                        "base_citations_count": 5,
                        "keywords_ia": "apoyo gerencial, patrocinio ejecutivo, compromiso de directores, presupuesto asignado",
                    },
                    {
                        "description": "El personal de TI de su organización respalda la adopción de este software.",
                        "base_citations_count": 4,
                        "keywords_ia": "respaldo del equipo ti, compromiso técnico interno, motivación de ingenieros",
                    },
                ],
            },
            {
                "name": "Bloqueo de proveedores",
                "scope": Factor.SCOPE_EXTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 2,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El software reduce las dependencias de los proveedores en tu entorno.",
                        "base_citations_count": 4,
                        "keywords_ia": "reducción de vendor lock-in, independencia de proveedores, libertad tecnológica",
                    },
                ],
            },
            {
                "name": "Actitud hacia el cambio",
                "scope": Factor.SCOPE_INTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 1,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "El personal de la organización muestra poca resistencia al cambio tecnológico.",
                        "base_citations_count": 3,
                        "keywords_ia": "baja resistencia al cambio, apertura a nuevas herramientas, cultura innovadora",
                    },
                ],
            },
        ],
    },
    {
        "name": "Económica",
        "description": "Factores relacionados con el aspecto económico que se utilizan para adquirir, vender o alquilar productos y servicios.",
        "order": 3,
        "factors": [
            {
                "name": "Costo total de la propiedad (TCO)",
                "scope": Factor.SCOPE_INTERNAL,
                "scope_configurable": False,
                "literature_importance_base": 4,
                "expert_importance": 3,
                "subfactors": [
                    {
                        "description": "Es poco probable que haya costos ocultos al adoptar este software.",
                        "base_citations_count": 4,
                        "keywords_ia": "costos ocultos mínimos, transparencia presupuestaria, previsibilidad financiera",
                    },
                    {
                        "description": "La adopción de este software es menos costosa que la alternativa propietaria.",
                        "base_citations_count": 5,
                        "keywords_ia": "ahorro de licencias, menor tco, retorno de inversión roi, costo beneficio favorable",
                    },
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Carga o actualiza el Catálogo Maestro de GUIOS (18 Factores y 61 Subfactores de la Tesis)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Elimina el catálogo existente antes de sembrar para una recarga limpia.',
        )

    def handle(self, *args, **options):
        reset_mode = options.get('reset', False)

        self.stdout.write(self.style.MIGRATE_HEADING("Iniciando carga del Catálogo Maestro GUIOS (Tesis Rea Sánchez)..."))

        with transaction.atomic():
            if reset_mode:
                self.stdout.write(self.style.WARNING("Modo --reset activo: Eliminando subfactores, factores y dimensiones base..."))
                Subfactor.objects.filter(is_base=True).delete()
                Factor.objects.filter(is_base=True).delete()
                Dimension.objects.filter(is_base=True).delete()

            total_dimensions = 0
            total_factors = 0
            total_subfactors = 0

            for dim_data in GUIOS_CATALOGO:
                dim_name = dim_data["name"]
                dimension, dim_created = Dimension.objects.update_or_create(
                    name=dim_name,
                    defaults={
                        "description": dim_data.get("description", ""),
                        "order": dim_data.get("order", 0),
                        "is_base": True,
                    },
                )
                action_dim = "Creada" if dim_created else "Actualizada"
                self.stdout.write(f"  [Dimensión] {action_dim}: {dim_name}")
                total_dimensions += 1

                for f_order, factor_data in enumerate(dim_data.get("factors", []), start=1):
                    f_name = factor_data["name"]
                    lit_base = factor_data.get("literature_importance_base", 1)
                    exp_base = factor_data.get("expert_importance", 3)
                    # Autocalcular IS = combine(IE, IL) según Figura 5.10 de la tesis
                    systemic_is = combine_importance(exp_base, lit_base)

                    factor, f_created = Factor.objects.update_or_create(
                        dimension=dimension,
                        name=f_name,
                        defaults={
                            "scope": factor_data.get("scope", Factor.SCOPE_EXTERNAL),
                            "scope_configurable": factor_data.get("scope_configurable", False),
                            "literature_importance_base": lit_base,
                            "expert_importance": exp_base,
                            "systemic_importance": systemic_is,
                            "order": f_order,
                            "is_base": True,
                            "is_active": True,
                        },
                    )
                    action_factor = "Creado" if f_created else "Actualizado"
                    self.stdout.write(f"    -> [Factor #{f_order}] {action_factor}: {f_name} (IS={systemic_is}, IE={exp_base}, IL={lit_base})")
                    total_factors += 1

                    for sf_order, sf_item in enumerate(factor_data.get("subfactors", []), start=1):
                        if isinstance(sf_item, dict):
                            sf_desc = sf_item["description"]
                            sf_cits = sf_item.get("base_citations_count", 1)
                            sf_keys = sf_item.get("keywords_ia", "")
                        else:
                            sf_desc = str(sf_item)
                            sf_cits = 1
                            sf_keys = ""

                        subfactor, sf_created = Subfactor.objects.update_or_create(
                            factor=factor,
                            description=sf_desc,
                            defaults={
                                "base_citations_count": sf_cits,
                                "keywords_ia": sf_keys,
                                "order": sf_order,
                                "is_base": True,
                                "is_active": True,
                            },
                        )
                        total_subfactors += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("[OK] Catalogo Maestro GUIOS sembrado exitosamente:"))
        self.stdout.write(self.style.SUCCESS(f"  * Dimensiones : {total_dimensions}"))
        self.stdout.write(self.style.SUCCESS(f"  * Factores    : {total_factors}"))
        self.stdout.write(self.style.SUCCESS(f"  * Subfactores : {total_subfactors}"))
