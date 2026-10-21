# Diccionario de Modelos de Base de Datos — GUIOS PRO

Este documento especifica la totalidad de los modelos de base de datos del sistema GUIOS PRO. Cubre los módulos de infraestructura (autenticación, auditoría, RBAC, organización) y el dominio de evaluación (catálogo GUIOS, sesiones de evaluación, resultados y asistencia de IA).

---

## Indice

**Módulo de infraestructura**

1. [User — `CustomUser`](#1-user--customuser)
2. [AuditLog — `AuditLog`](#2-auditlog--auditlog)
3. [OTP — `PasswordResetOTP`](#3-otp--passwordresetotp)
4. [2FA — `TOTPDevice`](#4-2fa--totpdevice)
5. [Group — `Group`](#5-group--group)
6. [MenuGroup — `MenuGroup`](#6-menugroup--menugroup)
7. [MenuModule — `MenuModule`](#7-menumodule--menumodule)
8. [ModulePermission — `ModulePermission`](#8-modulepermission--modulepermission)
9. [Organization — `Organization`](#9-organization--organization)

**Módulo de evaluación GUIOS**

10. [Dimension — `Dimension`](#10-dimension--dimension)
11. [Factor — `Factor`](#11-factor--factor)
12. [Subfactor — `Subfactor`](#12-subfactor--subfactor)
13. [Evaluation — `Evaluation`](#13-evaluation--evaluation)
14. [EvaluationFactor — `EvaluationFactor`](#14-evaluationfactor--evaluationfactor)
15. [EvaluationSubfactor — `EvaluationSubfactor`](#15-evaluationsubfactor--evaluationsubfactor)
16. [EvaluationResult — `EvaluationResult`](#16-evaluationresult--evaluationresult)
17. [EvaluationVerdict — `EvaluationVerdict`](#17-evaluationverdict--evaluationverdict)
18. [AIAssistanceLog — `AIAssistanceLog`](#18-aiassistancelog--aiassistancelog)

---

## Diagrama de relaciones general

```
[Infraestructura]
Group (1) --------- (N) CustomUser
Group (N) --------- (N) MenuModule         -> core_menumodule_roles
Group (N) --------- (N) ModulePermission   -> core_modulepermission_groups
MenuGroup (1) ------ (N) MenuModule
MenuModule (1) ----- (N) ModulePermission
CustomUser (1) ----- (1) TOTPDevice
CustomUser (1) ----- (N) PasswordResetOTP
CustomUser (1) ----- (N) AuditLog
Organization        (Singleton)

[Dominio de evaluación]
Dimension (1) ------- (N) Factor
Factor (1) ---------- (N) Subfactor
Evaluation (1) ------ (N) EvaluationFactor    [1 por cada Factor del catálogo activo]
Evaluation (1) ------ (N) EvaluationSubfactor [1 por cada Subfactor calificado]
Evaluation (1) ------ (N) EvaluationResult    [1 por cada Factor relevante calificado]
Evaluation (1) ------ (1) EvaluationVerdict
Evaluation (1) ------ (N) AIAssistanceLog
EvaluationFactor (N) -------> Factor
EvaluationSubfactor (N) ----> Subfactor
EvaluationResult (N) -------> Factor
CustomUser (1) ------ (N) Evaluation          [evaluaciones iniciadas desde el panel admin]
```

---

## Módulo de infraestructura

---

### 1. User — `CustomUser`

- **Tabla en BD:** `authentication_customuser`
- **Ubicación:** `apps.auth.models.user.CustomUser`
- **Estado:** Implementado
- **Descripción:** Modelo principal de identidad y usuario. Extiende `AbstractUser` de Django utilizando el `email` como identificador de autenticación (`USERNAME_FIELD`). Cubre el RF-ADM-01 (login), RF-ADM-07 a 10 (perfil), RF-ADM-25 a 30 (gestión de usuarios).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `password` | `CharField(128)` | No | Hash criptográfico de la contraseña. |
| `last_login` | `DateTimeField` | Sí | Fecha y hora del último inicio de sesión exitoso. |
| `is_superuser` | `BooleanField` | No (Default: False) | Concede todos los permisos sin asignación explícita. |
| `username` | `CharField(150)` | No (Unique) | Nombre de usuario interno; autogenerado desde el correo si no se envía. |
| `first_name` | `CharField(150)` | Sí (Blank) | Nombre de pila. |
| `last_name` | `CharField(150)` | Sí (Blank) | Apellido. |
| `email` | `EmailField(254)` | No (Unique) | Correo electrónico único; campo de autenticación principal. |
| `is_staff` | `BooleanField` | No (Default: False) | Autoriza acceso al panel administrativo de Django. |
| `is_active` | `BooleanField` | No (Default: True) | Cuenta activa y habilitada. RF-ADM-28: desactivar invalida sesión. |
| `date_joined` | `DateTimeField` | No | Fecha de creación de la cuenta. |
| `phone` | `CharField(20)` | Sí | Teléfono con formato Ecuador. |
| `avatar` | `ImageField` | Sí | Imagen de perfil (JPG/PNG, máx. 2 MB). RF-ADM-10. |
| `created_at` | `DateTimeField` | No (auto_now_add) | Timestamp de creación. |
| `updated_at` | `DateTimeField` | No (auto_now) | Timestamp de modificación. |
| `groups` | `ManyToManyField(Group)` | Sí | Roles/Grupos del usuario. |
| `user_permissions` | `ManyToManyField(Permission)` | Sí | Permisos directos asignados. |

---

### 2. AuditLog — `AuditLog`

- **Tabla en BD:** `authentication_auditlog`
- **Ubicación:** `apps.auth.models.audit.AuditLog`
- **Estado:** Implementado
- **Descripción:** Registro inmutable de eventos y operaciones. Verifica integridad criptográfica con SHA-256. Cubre RF-ADM-37 a 40 (módulo de auditoría) y RN-11.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `action` | `CharField(10)` | No (Index) | Acción: `CREATE`, `UPDATE`, `DELETE`, `RESTORE` o `EXPORT`. |
| `source` | `CharField(20)` | No (Default: `web`) | Origen: `web`, `api`, `admin`, `cli`, `signal`, `import`. |
| `reason` | `TextField` | Sí (Blank) | Justificación de la acción (ej: número de ticket). |
| `content_type` | `ForeignKey(ContentType)` | Sí | Modelo Django del objeto auditado (clave genérica). |
| `object_id` | `CharField(255)` | No (Index) | ID del registro afectado. |
| `user` | `ForeignKey(CustomUser)` | Sí | Usuario que ejecutó la operación. |
| `impersonated_by` | `ForeignKey(CustomUser)` | Sí | Administrador que actuó suplantando al usuario. |
| `before` | `JSONField` | Sí | Estado del objeto antes del cambio. |
| `after` | `JSONField` | Sí | Estado del objeto después del cambio. |
| `changed_fields` | `JSONField` | No (Default: list) | Lista de atributos modificados. |
| `deleted_snapshot` | `JSONField` | Sí | Snapshot del objeto en el momento de eliminarse. |
| `ip_address` | `GenericIPAddressField` | Sí | IP del cliente. RF-ADM-37. |
| `user_agent` | `TextField` | Sí (Blank) | Cabecera User-Agent del cliente. |
| `session_key` | `CharField(40)` | Sí (Blank) | Clave de sesión HTTP asociada. |
| `request_id` | `UUIDField` | Sí (Index) | UUID de trazabilidad por petición. |
| `batch_id` | `UUIDField` | Sí (Index) | UUID para operaciones masivas. |
| `extra` | `JSONField` | No (Default: dict) | Metadatos adicionales clave-valor. |
| `checksum` | `CharField(64)` | Sí (Blank) | Hash SHA-256 de los campos críticos. RF-ADM-38 (inmutabilidad), RN-11. |
| `timestamp` | `DateTimeField` | No (auto_now_add, Index) | Fecha y hora del evento. |

---

### 3. OTP — `PasswordResetOTP`

- **Tabla en BD:** `authentication_passwordresetotp`
- **Ubicación:** `apps.auth.models.otp.PasswordResetOTP`
- **Estado:** Implementado
- **Descripción:** Códigos numéricos de un solo uso para restablecimiento de contraseña. Generados con CSPRNG. Cubre RF-ADM-04 (recuperación de contraseña vía código de 6 dígitos válido 30 minutos).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `user` | `ForeignKey(CustomUser)` | No | Usuario al que se emitió el código. |
| `code` | `CharField(6)` | No | Código numérico seguro de 6 dígitos. |
| `created_at` | `DateTimeField` | No (auto_now_add) | Timestamp de emisión (válido 30 minutos desde aquí). |
| `is_used` | `BooleanField` | No (Default: False) | Código ya utilizado para cambio de clave. |
| `is_verified` | `BooleanField` | No (Default: False) | Código validado con éxito previamente. |

---

### 4. 2FA — `TOTPDevice`

- **Tabla en BD:** `authentication_totpdevice`
- **Ubicación:** `apps.auth.models.totp.TOTPDevice`
- **Estado:** Implementado
- **Descripción:** Configuración de autenticación de dos factores (RFC 6238) por usuario. Protección anti-replay con contador de ventana temporal. Cubre RF-ADM-05 y RF-ADM-06 (activación/desvinculación 2FA).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `user` | `OneToOneField(CustomUser)` | No (Unique) | Usuario propietario del dispositivo 2FA. |
| `secret` | `CharField(32)` | No | Clave secreta Base32 para cálculo de códigos TOTP. |
| `is_active` | `BooleanField` | No (Default: False) | 2FA habilitado y verificado. |
| `created_at` | `DateTimeField` | No (auto_now_add) | Timestamp de enrolamiento. |
| `updated_at` | `DateTimeField` | No (auto_now) | Timestamp de modificación. |
| `last_verified_counter` | `BigIntegerField` | No (Default: -1) | Ventana `time // 30` para bloquear replay. |
| `recovery_codes` | `JSONField` | No (Default: list) | Hashes de códigos de respaldo de un solo uso. |

---

### 5. Group — `Group`

- **Tabla en BD:** `auth_group`
- **Ubicación:** `django.contrib.auth.models.Group`
- **Estado:** Implementado (modelo estándar de Django, extendido funcionalmente)
- **Descripción:** Modelo de roles/grupos de Django. Los roles **no son predefinidos en código**; el superadministrador los crea dinámicamente desde la interfaz (RF-ADM-11). Cada grupo tiene permisos granulares asignados a través de `ModulePermission` y visibilidad de menú a través de `MenuModule`.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `AutoField` | No (PK) | Identificador único autoincremental. |
| `name` | `CharField(150)` | No (Unique) | Nombre del rol o grupo creado desde la interfaz. |

**Relaciones inversas:**
- `user_set`: Usuarios asignados a este grupo.
- `menu_modules`: Módulos del menú lateral visibles para este rol (`core_menumodule_roles`).
- `module_permissions`: Permisos granulares habilitados para este rol (`core_modulepermission_groups`).

---

### 6. MenuGroup — `MenuGroup`

- **Tabla en BD:** `core_menugroup`
- **Ubicación:** `apps.core.models.menuGroup.MenuGroup`
- **Estado:** Implementado
- **Descripción:** Categorías o agrupadores del menú lateral del panel administrativo. La estructura del menú es configurable visualmente desde RF-ADM-24 (Módulo de configuración — Estructura del menú).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `name` | `CharField(100)` | No | Nombre de la categoría del menú. |
| `order` | `PositiveIntegerField` | No (Default: 0) | Orden de aparición en el sidebar. |
| `icon` | `CharField(50)` | Sí | Clave del ícono representativo. |

---

### 7. MenuModule — `MenuModule`

- **Tabla en BD:** `core_menumodule`
- **Ubicación:** `apps.core.models.menuModule.MenuModule`
- **Estado:** Implementado
- **Descripción:** Ítem individual del menú lateral perteneciente a una categoría. Controla visibilidad por rol (RF-ADM-17: los elementos sin permiso no aparecen). La asignación de roles al módulo implementa RF-ADM-15 y RF-ADM-16.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `group` | `ForeignKey(MenuGroup)` | No | Categoría padre del módulo. |
| `label` | `CharField(100)` | No | Texto visible del ítem en el menú. |
| `icon` | `CharField(50)` | No | Nombre del ícono (React/Lucide). |
| `path` | `CharField(255)` | No | Ruta relativa del frontend. |
| `order` | `PositiveIntegerField` | No (Default: 0) | Orden dentro de la categoría. |
| `is_active` | `BooleanField` | No (Default: True) | Módulo activo y visible en el menú. |
| `roles` | `ManyToManyField(Group)` | Sí | Roles con acceso a este módulo. |

---

### 8. ModulePermission — `ModulePermission`

- **Tabla en BD:** `core_modulepermission`
- **Ubicación:** `apps.core.models.modulePermission.ModulePermission`
- **Estado:** Implementado
- **Descripción:** Permiso granular semántico acoplado a un módulo del sistema. **Los permisos son definidos en el código del backend/frontend** y no se crean desde la interfaz (RF-ADM-15). Desde la interfaz únicamente se activan o desactivan para cada rol.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `module` | `ForeignKey(MenuModule)` | No | Módulo al que pertenece el permiso. |
| `codename` | `CharField(120)` | No (Unique, Index) | Identificador técnico único: `modulo.accion` (ej: `catalog.create_factor`). |
| `label` | `CharField(150)` | No | Nombre legible en la interfaz de gestión de roles. |
| `description` | `TextField` | Sí (Blank) | Explicación de la acción que habilita el permiso. |
| `order` | `PositiveSmallIntegerField` | No (Default: 0) | Orden en la lista de permisos del módulo. |
| `groups` | `ManyToManyField(Group)` | Sí | Roles que tienen habilitado este permiso. |

---

### 9. Organization — `Organization`

- **Tabla en BD:** `core_organization`
- **Ubicación:** `apps.core.models.organization.Organization`
- **Estado:** Implementado
- **Descripción:** Datos institucionales del sistema. Diseñado bajo patrón Singleton (un único registro). Cubre RF-ADM-22 (Módulo de configuración — Organización). Los datos se usan como membrete en exportaciones PDF.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `name` | `CharField(150)` | No | Nombre comercial o razón social. |
| `slogan` | `CharField(255)` | Sí | Frase o lema institucional. |
| `ruc` | `CharField(13)` | Sí | RUC validado (algoritmo módulo 10/11, Ecuador). |
| `address` | `TextField` | Sí | Dirección física. |
| `phone` | `CharField(50)` | Sí | Teléfono de contacto normalizado. |
| `email` | `EmailField(254)` | Sí | Correo institucional de contacto. |
| `logo` | `ImageField` | Sí | Logotipo (JPG/PNG, ruta: `organization/logos/`). |
| `created_at` | `DateTimeField` | No (auto_now_add) | Timestamp de creación. |
| `updated_at` | `DateTimeField` | No (auto_now) | Timestamp de última actualización. |

---

## Módulo de evaluación GUIOS

> **Nota (Paso 1 del plan, `docs/ANALISIS_GUIOS_ORIGINAL.md` §8):** esta sección describe el estado **objetivo** acordado por el equipo. Los cambios respecto a la migración `0001` (renombre a `suggested_importance`, `PROTECT` en dimensión→factor y factor→subfactor, valores nulos para "sin calificar" y `factor_name_snapshot`) se aplican en la migración `0002` (Paso 2).

---

### 10. Dimension — `Dimension`

- **Tabla en BD:** `guios_dimension`
- **Ubicación:** `apps.guios.models.dimension.Dimension`
- **Estado:** Pendiente de implementación
- **Descripción:** Agrupador de primer nivel del catálogo GUIOS: Tecnológica, Organizacional, Económica. El catálogo base proviene de la tesis doctoral. Cubre RF-ADM-31 (CRUD de dimensiones).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `name` | `CharField(150)` | No (Unique) | Nombre de la dimensión. |
| `description` | `TextField` | Sí (Blank) | Descripción del alcance de la dimensión. |
| `order` | `PositiveSmallIntegerField` | No (Default: 0) | Orden de presentación en la evaluación. |
| `is_base` | `BooleanField` | No (Default: False) | Pertenece al catálogo base de la tesis. No eliminable si `True`. |
| `created_at` | `DateTimeField` | No (auto_now_add) | Timestamp de creación. |
| `updated_at` | `DateTimeField` | No (auto_now) | Timestamp de modificación. |

**Restricción:** Una dimensión no puede eliminarse si tiene factores asociados (RF-ADM-31).

---

### 11. Factor — `Factor`

- **Tabla en BD:** `guios_factor`
- **Ubicación:** `apps.guios.models.factor.Factor`
- **Estado:** Pendiente de implementación
- **Descripción:** Criterio de evaluación de segundo nivel. Cada factor tiene una Importancia Sugerida (IS) definida por la metodología (Tabla 5.3 de la tesis). Cubre RF-ADM-32 (CRUD de factores), RF-PUB-02 (Paso 1-2) y RN-06 (ámbito de Soporte).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `dimension` | `ForeignKey(Dimension)` | No (PROTECT) | Dimensión a la que pertenece. PROTECT impide borrar una dimensión con factores (RF-ADM-31). |
| `name` | `CharField(200)` | No | Nombre del factor. |
| `suggested_importance` | `PositiveSmallIntegerField` | No | IS de la guía (Tabla 5.3). Valores: 1, 2, 3, 4. Se muestra al evaluador como referencia. |
| `scope` | `CharField(10)` | No | Ámbito FODA: `internal`, `external` o `both`. |
| `scope_configurable` | `BooleanField` | No (Default: False) | `True` únicamente para el factor "Soporte" (RF-PUB-02, RN-06). |
| `order` | `PositiveSmallIntegerField` | No (Default: 0) | Orden dentro de la dimensión. |
| `is_base` | `BooleanField` | No (Default: False) | Pertenece al catálogo base de la tesis. No eliminable si `True`. |
| `is_active` | `BooleanField` | No (Default: True) | Factor activo. Inactivo = no aparece en nuevas evaluaciones. |
| `created_at` | `DateTimeField` | No (auto_now_add) | Timestamp de creación. |
| `updated_at` | `DateTimeField` | No (auto_now) | Timestamp de modificación. |

**Restricciones:**
- `suggested_importance` acepta únicamente valores [1, 4]. (RNF-07)
- `scope` acepta únicamente `internal`, `external` o `both`.
- Solo puede eliminarse si no tiene subfactores ni registros en `EvaluationFactor`. (RF-ADM-32, RN-07)

---

### 12. Subfactor — `Subfactor`

- **Tabla en BD:** `guios_subfactor`
- **Ubicación:** `apps.guios.models.subfactor.Subfactor`
- **Estado:** Pendiente de implementación
- **Descripción:** Criterio de tercer nivel que el evaluador califica individualmente. Texto redactado como afirmación verificable. Cubre RF-ADM-33 (CRUD) y RF-PUB-04 (Paso 3-4).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `factor` | `ForeignKey(Factor)` | No (PROTECT) | Factor al que pertenece. PROTECT impide borrar un factor con subfactores (RF-ADM-32). |
| `description` | `TextField` | No | Texto del criterio redactado como afirmación verificable. |
| `order` | `PositiveSmallIntegerField` | No (Default: 0) | Orden dentro del factor. |
| `is_base` | `BooleanField` | No (Default: False) | Pertenece al catálogo base de la tesis. |
| `is_active` | `BooleanField` | No (Default: True) | Subfactor activo. |
| `created_at` | `DateTimeField` | No (auto_now_add) | Timestamp de creación. |
| `updated_at` | `DateTimeField` | No (auto_now) | Timestamp de modificación. |

**Restricción:** Solo puede eliminarse si no tiene registros en `EvaluationSubfactor`. (RF-ADM-33, RN-07)

---

### 13. Evaluation — `Evaluation`

- **Tabla en BD:** `guios_evaluation`
- **Ubicación:** `apps.guios.models.evaluation.Evaluation`
- **Estado:** Pendiente de implementación
- **Descripción:** Registro principal de una sesión de evaluación. Actúa como cabecera de todos los registros de detalle. Cubre RF-PUB-01 (datos del modal de inicio), RF-PUB-06 (persistencia), RF-ADM-34 y 35 (historial).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `uuid` | `UUIDField` | No (Unique, auto) | Identificador público seguro para compartir sin exponer IDs secuenciales. |
| `software_name` | `CharField(200)` | No | Nombre del software candidato. RF-PUB-01. |
| `software_version` | `CharField(50)` | Sí (Blank) | Versión del software. RF-PUB-01. |
| `software_repo_url` | `URLField` | Sí | Enlace al repositorio del software. Insumo opcional para la IA. RF-PUB-01, RF-IA-01. |
| `org_name` | `CharField(200)` | No | Nombre de la organización evaluadora. RF-PUB-01. |
| `org_sector` | `CharField(150)` | Sí (Blank) | Sector o rubro de la organización. RF-PUB-01. |
| `org_description` | `TextField` | Sí (Blank) | Descripción de la organización y sus necesidades de TI. Insumo principal para la IA. RF-PUB-01, RF-IA-01. |
| `ai_enabled` | `BooleanField` | No (Default: False) | IA fue activada en esta evaluación. RF-IA-01. |
| `status` | `CharField(20)` | No (Default: `in_progress`) | Estado: `in_progress` o `completed`. RF-ADM-34. |
| `created_by` | `ForeignKey(CustomUser)` | Sí (SET_NULL) | Usuario del panel que inició la evaluación. `NULL` para evaluaciones públicas anónimas. |
| `started_at` | `DateTimeField` | No (auto_now_add) | Fecha y hora de inicio. |
| `completed_at` | `DateTimeField` | Sí | Fecha y hora en que se emitió el dictamen. |
| `session_token` | `CharField(64)` | Sí (Unique, Index) | Token de sesión anónima del navegador. Identifica evaluaciones públicas sin usuario. RF-PUB-06. |

---

### 14. EvaluationFactor — `EvaluationFactor`

- **Tabla en BD:** `guios_evaluationfactor`
- **Ubicación:** `apps.guios.models.evaluation_factor.EvaluationFactor`
- **Estado:** Pendiente de implementación
- **Descripción:** Configuración asignada por el evaluador a cada factor en el Paso 1-2. Incluye snapshot del IS para proteger el historial si el catálogo cambia (RN-08). Cubre RF-PUB-02, RF-PUB-03, RF-IA-02, RN-01, RN-08.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `evaluation` | `ForeignKey(Evaluation)` | No (CASCADE) | Evaluación a la que pertenece. |
| `factor` | `ForeignKey(Factor)` | No (PROTECT) | Factor configurado. PROTECT protege el historial (RN-07). |
| `suggested_importance_snapshot` | `PositiveSmallIntegerField` | No | Copia de la IS del factor en el momento de la evaluación. Valores: 1-4. (RN-08, RNF-09) |
| `factor_name_snapshot` | `CharField(200)` | No | Copia del nombre del factor en el momento de la evaluación. (RN-08) |
| `decisor_importance` | `PositiveSmallIntegerField` | Sí | ID asignado por el evaluador. Valores: 1-4. `NULL` = "sin calificar" (RN-12). (RF-PUB-02, RNF-07) |
| `relative_importance` | `PositiveSmallIntegerField` | Sí | IR calculada por el motor con la matriz de la Figura 5.10 (equivale a `floor((IS_idx + ID_idx) / 2)` mapeada a [1-4]). `NULL` mientras la ID esté sin calificar. (RNF-08, RN-13) |
| `is_relevant` | `BooleanField` | Sí | `True` si IR > Irrelevante. Determina si el factor pasa al Paso 3-4. `NULL` mientras la ID esté sin calificar. (RF-PUB-03, RN-01) |
| `scope_used` | `CharField(10)` | Sí (Blank) | Ámbito efectivo: `internal` o `external`. Para los factores con ámbito fijo se copia del catálogo; para "Soporte" lo elige el evaluador y queda vacío mientras esté sin calificar. (RN-06, RN-12) |
| `ai_suggested_id` | `PositiveSmallIntegerField` | Sí | ID sugerido por la IA. `NULL` si la IA no fue invocada. (RF-IA-02) |
| `ai_id_justification` | `TextField` | Sí (Blank) | Justificación de la IA para el ID sugerido. |
| `id_was_ai_accepted` | `BooleanField` | No (Default: False) | `True` si el evaluador aceptó la sugerencia de la IA sin cambios. (RN-05) |

**Restricción de unicidad:** `(evaluation, factor)`.

---

### 15. EvaluationSubfactor — `EvaluationSubfactor`

- **Tabla en BD:** `guios_evaluationsubfactor`
- **Ubicación:** `apps.guios.models.evaluation_subfactor.EvaluationSubfactor`
- **Estado:** Pendiente de implementación
- **Descripción:** Calificación asignada a cada subfactor en el Paso 3-4. Incluye snapshot del texto del subfactor para proteger el historial (RN-08). Cubre RF-PUB-04, RF-IA-03, RN-08.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `evaluation` | `ForeignKey(Evaluation)` | No (CASCADE) | Evaluación a la que pertenece. |
| `subfactor` | `ForeignKey(Subfactor)` | No (PROTECT) | Subfactor calificado. PROTECT protege el historial (RN-07). |
| `description_snapshot` | `TextField` | No | Copia del texto del subfactor en el momento de la evaluación. (RN-08, RNF-09) |
| `rating` | `PositiveSmallIntegerField` | Sí | Calificación final del evaluador. Valores: 1-4. `NULL` = "sin calificar" (p. ej., la IA ya sugirió pero el evaluador aún no decide) (RN-12). (RF-PUB-04, RNF-07) |
| `ai_suggested_rating` | `PositiveSmallIntegerField` | Sí | Calificación sugerida por la IA. `NULL` si no fue invocada. (RF-IA-03) |
| `ai_rating_justification` | `TextField` | Sí (Blank) | Justificación de la IA para la calificación sugerida. |
| `rating_was_ai_accepted` | `BooleanField` | No (Default: False) | `True` si el evaluador aceptó la sugerencia de la IA sin cambios. (RN-05) |
| `saved_at` | `DateTimeField` | No (auto_now) | Fecha y hora del último guardado. |

**Restricción de unicidad:** `(evaluation, subfactor)`.

---

### 16. EvaluationResult — `EvaluationResult`

- **Tabla en BD:** `guios_evaluationresult`
- **Ubicación:** `apps.guios.models.evaluation_result.EvaluationResult`
- **Estado:** Pendiente de implementación
- **Descripción:** Resultados calculados por el motor matemático para cada factor relevante: Ponderación Media (PM) y clasificación FODA. Cubre RF-PUB-05 (Paso 5-6), RNF-08 (determinismo).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `evaluation` | `ForeignKey(Evaluation)` | No (CASCADE) | Evaluación a la que pertenece. |
| `factor` | `ForeignKey(Factor)` | No (PROTECT) | Factor evaluado. |
| `weighted_average` | `DecimalField(5, 2)` | No | PM: `sum(ratings) / count(subfactors)`. Umbral: PM >= 3.0. (RN-02) |
| `meets_threshold` | `BooleanField` | No | `True` si `weighted_average >= 3.0`. |
| `foda_classification` | `CharField(12)` | No | Resultado FODA: `strength`, `weakness`, `opportunity` o `threat`. |
| `calculated_at` | `DateTimeField` | No (auto_now) | Fecha y hora del último cálculo. |

Solo existe resultado para un factor relevante con **todos** sus subfactores calificados (RN-02). Se recalcula cada vez que cambia una calificación, la ID o el ámbito del factor (RN-13).

**Lógica de clasificación (motor matemático, no IA):**

```
scope_used = 'internal' y meets_threshold = True  ->  strength   (Fortaleza)
scope_used = 'internal' y meets_threshold = False ->  weakness   (Debilidad)
scope_used = 'external' y meets_threshold = True  ->  opportunity (Oportunidad)
scope_used = 'external' y meets_threshold = False ->  threat      (Amenaza)
```

**Restricción de unicidad:** `(evaluation, factor)`.

---

### 17. EvaluationVerdict — `EvaluationVerdict`

- **Tabla en BD:** `guios_evaluationverdict`
- **Ubicación:** `apps.guios.models.evaluation_verdict.EvaluationVerdict`
- **Estado:** Pendiente de implementación
- **Descripción:** Dictamen final emitido por el motor matemático. Relación OneToOne con Evaluation. Almacena opcionalmente el resumen ejecutivo y plan de mitigación de la IA. Cubre RF-PUB-05, RF-IA-04, RN-03 y RN-04.

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `evaluation` | `OneToOneField(Evaluation)` | No (CASCADE) | Evaluación a la que corresponde el dictamen. |
| `recommendation` | `CharField(1)` | No | Tipo de recomendación según la tesis (págs. 104-106): `A` Adoptar, `B` Es posible adoptar con matices, `C` Analizar y posponer la adopción. |
| `explanation_text` | `TextField` | No | Texto explicativo del dictamen. Generado por el motor matemático, no por la IA. |
| `ai_executive_summary` | `TextField` | Sí (Blank) | Resumen ejecutivo generado por el servicio de IA. `NULL` si IA no fue invocada. (RF-IA-04) |
| `ai_mitigation_plan` | `TextField` | Sí (Blank) | Plan de mitigación de la IA para dictámenes B o C. `NULL` si no aplica. (RF-IA-04) |
| `calculated_at` | `DateTimeField` | No (auto_now_add) | Fecha y hora de emisión del dictamen. |

**Lógica del dictamen (motor matemático):**

```
Precondición (RN-04): todos los factores relevantes tienen EvaluationResult.

Recomendación C:  Existe algún EvaluationResult con foda_classification IN ('weakness','threat')
                  Y su EvaluationFactor.relative_importance IN (3, 4) [Importante o Fundamental]

Recomendación B:  Existe algún EvaluationResult con foda_classification IN ('weakness','threat')
                  Y su EvaluationFactor.relative_importance = 2 [Opcional]
                  Y NO existe ningún caso de Recomendación C

Recomendación A:  Todos los EvaluationResult tienen foda_classification IN ('strength','opportunity')
```

> RN-03: El dictamen C tiene prioridad sobre el B. RN-04: Mientras falte algún factor relevante por evaluar, no se emite dictamen. RN-14: el dictamen no depende de la IA. `explanation_text` nombra los factores que causan el dictamen (RF-PUB-05).

---

### 18. AIAssistanceLog — `AIAssistanceLog`

- **Tabla en BD:** `guios_aiassistancelog`
- **Ubicación:** `apps.guios.models.ai_log.AIAssistanceLog`
- **Estado:** Pendiente de implementación
- **Descripción:** Registro de cada llamada al servicio de IA durante una evaluación. Permite trazabilidad completa de las interacciones con el servicio externo. Cubre RF-IA-05 (errores/timeout), RF-IA-06 (formato JSON), RNF-03 (timeout), RNF-19 (independencia).

| Campo | Tipo de Dato | Nulo / Opcional | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BigAutoField` | No (PK) | Identificador único autoincremental. |
| `evaluation` | `ForeignKey(Evaluation)` | No (CASCADE) | Evaluación en cuyo contexto se realizó la llamada. |
| `request_type` | `CharField(30)` | No | Tipo de asistencia: `factor_importance`, `subfactor_rating` o `executive_summary`. |
| `factor` | `ForeignKey(Factor)` | Sí (SET_NULL) | Factor involucrado. Aplica para los dos primeros tipos. |
| `request_payload` | `JSONField` | No | Cuerpo completo de la solicitud enviada al servicio (sin claves de API). (RF-IA-06) |
| `response_payload` | `JSONField` | Sí | Cuerpo de la respuesta recibida. `NULL` si falló antes de recibir respuesta. (RF-IA-06) |
| `status` | `CharField(10)` | No | Resultado: `success`, `error` o `timeout`. (RF-IA-05) |
| `error_message` | `TextField` | Sí (Blank) | Mensaje de error si `status != success`. |
| `response_time_ms` | `PositiveIntegerField` | Sí | Tiempo de respuesta en ms. Timeout: 30 000 ms. (RNF-03) |
| `requested_at` | `DateTimeField` | No (auto_now_add) | Fecha y hora de la solicitud. |

---

## Resumen del esquema completo

| # | Modelo | Tabla | Estado | Cubre requerimientos principales |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `CustomUser` | `authentication_customuser` | Implementado | RF-ADM-01, 07-10, 25-30 |
| 2 | `AuditLog` | `authentication_auditlog` | Implementado | RF-ADM-37, 38, 39, 40, RN-11 |
| 3 | `PasswordResetOTP` | `authentication_passwordresetotp` | Implementado | RF-ADM-04 |
| 4 | `TOTPDevice` | `authentication_totpdevice` | Implementado | RF-ADM-05, 06 |
| 5 | `Group` | `auth_group` | Implementado | RF-ADM-11, 12, 13, 14 |
| 6 | `MenuGroup` | `core_menugroup` | Implementado | RF-ADM-24 |
| 7 | `MenuModule` | `core_menumodule` | Implementado | RF-ADM-15, 16, 17, 18, 24 |
| 8 | `ModulePermission` | `core_modulepermission` | Implementado | RF-ADM-15, 23, RN-09 |
| 9 | `Organization` | `core_organization` | Implementado | RF-ADM-22, RN-10 |
| 10 | `Dimension` | `guios_dimension` | Pendiente | RF-ADM-31 |
| 11 | `Factor` | `guios_factor` | Pendiente | RF-ADM-32, RF-PUB-02, RN-06, RN-07 |
| 12 | `Subfactor` | `guios_subfactor` | Pendiente | RF-ADM-33, RF-PUB-04, RN-07 |
| 13 | `Evaluation` | `guios_evaluation` | Pendiente | RF-PUB-01, 06, RF-ADM-34, 35 |
| 14 | `EvaluationFactor` | `guios_evaluationfactor` | Pendiente | RF-PUB-02, 03, RF-IA-02, RN-01, RN-05, RN-06, RN-08 |
| 15 | `EvaluationSubfactor` | `guios_evaluationsubfactor` | Pendiente | RF-PUB-04, RF-IA-03, RN-02, RN-05, RN-08 |
| 16 | `EvaluationResult` | `guios_evaluationresult` | Pendiente | RF-PUB-05, RN-02, RNF-08 |
| 17 | `EvaluationVerdict` | `guios_evaluationverdict` | Pendiente | RF-PUB-05, RF-IA-04, RN-03, RN-04 |
| 18 | `AIAssistanceLog` | `guios_aiassistancelog` | Pendiente | RF-IA-05, RF-IA-06, RNF-03, RNF-19 |

---

*Documento elaborado en el marco del Sprint 0 del proyecto GUIOS PRO.*
*Los modelos de la columna "Implementado" provienen del módulo de infraestructura del backend Django.*
*Los modelos "Pendiente" corresponden al dominio de evaluación a desarrollar en los Sprints 1-4.*
