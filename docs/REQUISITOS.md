# Ingeniería de Requisitos — GUIOS PRO

**Proyecto:** Sistema de Evaluación de Adopción de Software (GUIOS PRO)
**Asignatura:** Procesos y Calidad de Software
**Responsable de sección:** Luis Emilio Arguello Lopez
**Fecha de elaboración:** Septiembre 2026
**Versión:** 1.0 — Sprint 0

---

## Indice

1. [Contexto del sistema y base metodológica](#1-contexto)
2. [Arquitectura funcional general](#2-arquitectura)
3. [Datos y cálculos del sistema](#3-datos)
4. [Requerimientos Funcionales — Módulo Público](#4-modulo-publico)
5. [Requerimientos Funcionales — Módulo Administrativo](#5-modulo-administrativo)
   - 5.1 Autenticación y Control de Acceso
   - 5.2 Perfil de Usuario
   - 5.3 Grupos y Roles
   - 5.4 Permisos por Módulo
   - 5.5 Módulos del Panel y Configuración del Sistema
   - 5.6 Gestión de Usuarios
   - 5.7 Gestión del Catálogo
   - 5.8 Historial de Evaluaciones
   - 5.9 Auditoría del Sistema
6. [Requerimientos Funcionales — Módulo de Asistencia con IA](#6-modulo-ia)
7. [Requerimientos No Funcionales](#7-no-funcionales)
8. [Restricciones del sistema](#8-restricciones)
9. [Reglas del negocio](#9-reglas)
10. [Product Backlog Inicial](#10-product-backlog)

---

## 1. Contexto del sistema y base metodológica

GUIOS PRO es un sistema informático web que implementa la guía metodológica GUIOS (Guía para la Adopción de Software de Código Abierto), derivada de la tesis doctoral del Dr. Víctor Hugo Rea Sánchez. Su propósito es proporcionar a organizaciones públicas y privadas un proceso estructurado, repetible y objetivo para evaluar si un software de código abierto (FLOSS) es adecuado para su contexto particular.

El sistema evalúa el software candidato a través de tres dimensiones: Tecnológica, Organizacional y Económica. Cada dimensión agrupa factores de evaluación, y cada factor contiene subfactores concretos que el evaluador debe calificar. El resultado final es un dictamen automatizado (Recomendación A, B o C) que orienta la decisión de adopción.

El sistema amplía la herramienta prototipo original con dos componentes adicionales: un panel administrativo para gestionar el catálogo de evaluación y un módulo de asistencia mediante inteligencia artificial que reduce la carga cognitiva del evaluador durante el proceso.

---

## 2. Arquitectura funcional general

El sistema se divide en tres módulos con responsabilidades claramente delimitadas:

| Módulo | Acceso | Propósito principal |
| :--- | :--- | :--- |
| **Módulo Público** | Sin autenticación | Permite a cualquier persona evaluar un software candidato siguiendo los 6 pasos metodológicos de GUIOS |
| **Módulo Administrativo** | Autenticación requerida | Gestión del catálogo (dimensiones, factores, subfactores), gestión de usuarios y consulta del historial de evaluaciones |
| **Módulo de Asistencia con IA** | Integrado en el módulo público | Analiza información del software y de la empresa para sugerir valores en los pasos 1-2 y 3-4, y genera el resumen ejecutivo del dictamen |

El catálogo gestionado desde el módulo administrativo es el mismo que se consume en el módulo público. Cualquier cambio en factores o subfactores se refleja en la vista pública de forma inmediata.

---

## 3. Datos y cálculos del sistema

Esta sección describe los datos concretos que el sistema procesa, de dónde provienen y cómo se transforman. Es la base directa para los requerimientos funcionales.

### 3.1 Catálogo base (datos fijos gestionados por el administrador)

El catálogo comprende:

- **3 Dimensiones:** Tecnológica, Organizacional, Económica.
- **18 Factores** distribuidos entre las dimensiones, cada uno con:
  - Nombre del factor.
  - Importancia Sugerida (IS): valor entre 1 y 4 que la guía GUIOS obtiene combinando la importancia de los expertos (IE) y la de la literatura (IL) (Tabla 5.3 de la tesis; se usa tal como está publicada, sin recalcularla). Es fijo para cada factor, se muestra al evaluador **como referencia** y no lo define el evaluador.
  - Ámbito predeterminado: Interno, Externo o Ambos. Determina cómo se clasifica el factor en la matriz FODA.
- **61 Subfactores** distribuidos entre los factores, cada uno con:
  - Descripción del criterio a evaluar (redactada como afirmación verificable). Se usa el texto de la encuesta a expertos (Figuras 5.7 a 5.9 de la tesis) con solo las erratas obvias corregidas.

La fuente del catálogo base es `docs/catalogo_guios.json` (9 + 8 + 1 factores; 40 + 19 + 2 subfactores), verificado contra la tesis en `docs/ANALISIS_GUIOS_ORIGINAL.md`.

### 3.2 Datos ingresados por el evaluador (variables por evaluación)

| Dato | Paso | Rango | Descripción |
| :--- | :---: | :---: | :--- |
| Importancia del Decisor (ID) | 1-2 | 1 a 4 | El evaluador indica qué tan importante es cada factor para su organización |
| Ámbito del factor "Soporte" | 1-2 | Interno / Externo | Único factor con ámbito configurable por el evaluador |
| Calificación de subfactores | 3-4 | 1 a 4 | El evaluador califica el nivel de cumplimiento de cada subfactor |

Todos estos datos **arrancan "sin calificar"**: el sistema no preselecciona ningún valor, ni siquiera el ámbito de "Soporte". El evaluador debe elegir cada uno de forma explícita (RN-12).

**Escala de IS e ID (Factores):**

| Valor | Etiqueta |
| :---: | :--- |
| 1 | Irrelevante |
| 2 | Opcional |
| 3 | Importante |
| 4 | Fundamental |

**Escala de calificación de Subfactores:**

| Valor | Etiqueta |
| :---: | :--- |
| 1 | No cumple el requisito |
| 2 | Desconozco si cumple el requisito |
| 3 | Cumple parcialmente el requisito |
| 4 | Cumple el requisito |

### 3.3 Cálculos del motor matemático

Todos los cálculos siguientes son deterministas y se ejecutan en el backend sin intervención de la IA.

**Importancia Relativa (IR):**

La IR se obtiene con la matriz de la Figura 5.10 de la tesis (filas: ID; columnas: IS):

| ID \ IS | 1 | 2 | 3 | 4 |
| :---: | :---: | :---: | :---: | :---: |
| **4 Fundamental** | 2 | 3 | 3 | 4 |
| **3 Importante** | 2 | 2 | 3 | 3 |
| **2 Opcional** | 1 | 2 | 2 | 3 |
| **1 Irrelevante** | 1 | 1 | 2 | 2 |

Fórmula equivalente (verificada en las 16 celdas):

```
IR_indice = floor( (IS_indice + ID_indice) / 2 )

Donde IS_indice e ID_indice van de 0 a 3 (valor del campo menos 1).
El resultado se mapea a la escala de etiquetas (0=Irrelevante, 1=Opcional, 2=Importante, 3=Fundamental).
```

Un factor es relevante (pasa a los pasos 3 y 4) si su IR es distinto de Irrelevante (IR > 1). Consecuencia: un factor con IS = Importante siempre es relevante.

**Ponderación Media (PM):**

```
PM = suma(calificaciones de subfactores) / cantidad de subfactores del factor

El resultado es un número decimal (se muestra con 2 decimales). Umbral de corte: PM >= 3.0,
comparado sin redondear.
```

**Clasificación FODA** (Ecuación 5.3 de la tesis). Se **deriva siempre** de la PM y del ámbito vigentes; si el evaluador cambia el ámbito de "Soporte" o la ID, la clasificación se recalcula (RN-13):

```
Si Ambito = Interno:
    PM >= 3.0  ->  FORTALEZA
    PM <  3.0  ->  DEBILIDAD

Si Ambito = Externo:
    PM >= 3.0  ->  OPORTUNIDAD
    PM <  3.0  ->  AMENAZA
```

**Dictamen final (Matriz de decisión).** Letras y significado según la tesis (págs. 104-106). Solo se emite cuando **todos** los factores relevantes están evaluados (RN-04):

```
Si existe al menos un factor con FODA negativo (Debilidad o Amenaza)
   Y cuya IR = Importante o Fundamental:
        ->  RECOMENDACION C (Analizar y posponer la adopción)

Si existe al menos un factor con FODA negativo
   Y cuya IR = Opcional (y no hay ninguno crítico negativo):
        ->  RECOMENDACION B (Es posible adoptar, con matices)

Si todos los factores evaluados son Fortalezas u Oportunidades:
        ->  RECOMENDACION A (Adoptar)
```

C prevalece sobre B (RN-03). Junto con la letra, el motor devuelve **los factores que causan el dictamen** (los negativos, con su IR, PM y FODA) y los subfactores que no cumplen, para que la recomendación sea personalizada y no solo el texto genérico de la tesis (RF-PUB-05).

Caso de referencia (tesis, Figuras 6.3 a 6.5): LibreOffice en UNEMI da **Recomendación C**, causada por Personalización (Amenaza), Formación (Debilidad) y Soporte (Debilidad), los tres con IR Importante.

---

## 4. Requerimientos Funcionales — Módulo Público

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RF-PUB-01** | Modal de inicio de evaluación | Al ingresar a la vista pública el sistema debe presentar un modal con los campos: nombre del software candidato (obligatorio), versión del software (opcional), nombre de la organización evaluadora (obligatorio), sector o rubro (opcional), descripción general de la organización y sus necesidades de TI (opcional, recomendada para la asistencia de IA) y enlace al repositorio del software (opcional, recomendado para la asistencia de IA). El evaluador puede continuar sin completar los campos opcionales; en ese caso el sistema opera en modo manual sin asistencia de IA. | Alta |
| **RF-PUB-02** | Paso 1 y 2 — Configuración de factores relevantes | El sistema debe presentar la tabla de los 18 factores del catálogo activo. Por cada factor se muestran las siguientes columnas: nombre del factor y su dimensión, Importancia Sugerida (IS) del catálogo en solo lectura (como referencia de la guía), control de 4 opciones (1 a 4) para asignar la Importancia del Decisor (ID), etiqueta de la ID seleccionada, Importancia Relativa (IR) calculada automáticamente, y control de ámbito (selector editable únicamente para el factor "Soporte"; campo de solo lectura para los demás). La ID y el ámbito de "Soporte" arrancan "sin calificar" (RN-12). La IR debe recalcularse y mostrarse de forma inmediata sin requerir confirmación. El avance se guarda automáticamente. | Alta |
| **RF-PUB-03** | Filtrado automático de factores relevantes | Al completar el Paso 1 y 2, el sistema determina qué factores son relevantes (IR distinto de Irrelevante) y muestra únicamente esos factores en los Pasos 3 y 4. Los factores con IR = Irrelevante quedan excluidos de la calificación de subfactores y del dictamen final. | Alta |
| **RF-PUB-04** | Paso 3 y 4 — Calificación de subfactores | El sistema debe presentar un selector con solo los factores relevantes. Al seleccionar un factor se despliega la lista de sus subfactores con el texto de cada criterio. **Calificación ágil** (mejora pedida por la especialista del caso de estudio, tesis pág. 107): cada subfactor se califica con un solo clic en un grupo de 4 botones con su etiqueta (No cumple / Desconozco / Cumple parcialmente / Cumple), sin sliders; cada calificación se guarda automáticamente, sin botón "Guardar" por factor. Todas arrancan "sin calificar". Cuando el factor tiene todos sus subfactores calificados, el sistema calcula su Ponderación Media (PM) y su clasificación FODA. El selector muestra junto a cada factor su progreso (subfactores calificados / total) y su PM, y el sistema indica qué factores relevantes faltan por completar. | Alta |
| **RF-PUB-05** | Paso 5 y 6 — Visualización FODA y dictamen | El sistema debe presentar los factores relevantes en una matriz FODA de cuatro cuadrantes y en una tabla con: nombre, IR, PM calculada (vacío si no fue evaluado), ámbito asignado y clasificación FODA, con diferenciación entre resultados positivos (Fortaleza/Oportunidad) y negativos (Debilidad/Amenaza) mediante color **y** texto. El botón de dictamen permanece bloqueado hasta que todos los factores relevantes estén evaluados (RN-04). El dictamen muestra: tipo de recomendación (A, B o C) con diferenciación visual, texto explicativo según la metodología GUIOS y una **recomendación personalizada** (mejora pedida por la especialista, tesis pág. 107) que nombra los factores que causan el dictamen con su IR, PM y FODA, y los subfactores que no cumplen. Si la IA fue usada, se muestran además, separados del dictamen matemático, el resumen ejecutivo y, si el dictamen es B o C, el plan de mitigación. | Alta |
| **RF-PUB-06** | Persistencia temporal de sesión | El sistema debe mantener el estado completo de la evaluación durante la sesión activa del navegador. Si el usuario recarga la página sin cerrar la pestaña, el progreso no debe perderse. Puede implementarse mediante almacenamiento local del navegador (localStorage). | Media |
| **RF-PUB-07** | Ayuda contextual por paso | En cada uno de los tres pasos debe existir un botón de ayuda que abra un modal explicativo. El modal debe describir en lenguaje no técnico el objetivo del paso, qué significa cada columna o campo y cómo debe interpretarse el resultado. | Alta |

---

## 5. Requerimientos Funcionales — Módulo Administrativo

Los requerimientos del módulo administrativo se presentan en formato tabular organizado por subsistema. Cada requerimiento incluye su código, nombre, descripción funcional detallada y nivel de prioridad (Alta, Media, Baja).

---

### 5.1 Autenticación y Control de Acceso

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RF-ADM-01** | Inicio de sesión | El sistema debe permitir el acceso al panel administrativo mediante un formulario de inicio de sesión con los campos correo electrónico y contraseña. El acceso debe ser denegado si las credenciales son incorrectas, mostrando un mensaje de error sin especificar cuál campo falló. Tras cinco intentos fallidos consecutivos, la cuenta debe bloquearse temporalmente durante un período configurable. | Alta |
| **RF-ADM-02** | Cierre de sesión | El sistema debe proporcionar un botón de cierre de sesión accesible desde cualquier pantalla del panel. Al cerrar sesión, el token de autenticación debe invalidarse en el servidor y la sesión local debe eliminarse del navegador. | Alta |
| **RF-ADM-03** | Expiración de sesión | Las sesiones activas deben expirar automáticamente tras un período de inactividad configurable por el superadministrador (valor predeterminado: 30 minutos). Al expirar, el sistema debe redirigir al formulario de inicio de sesión y notificar al usuario que su sesión ha caducado. | Alta |
| **RF-ADM-04** | Recuperación de contraseña | El sistema debe ofrecer un flujo de recuperación de contraseña accesible desde la pantalla de inicio de sesión. El usuario ingresa su correo registrado y recibe un codigo unico de 6 digitos valido por 30 minutos. El usuario debe confirmar su identidad con el codigo de 6 digitos para restablecer su contraseña. El codigo debe quedar invalidado tras su primer uso o al vencer el tiempo límite. | Alta |
| **RF-ADM-05** | Autenticación de dos factores (2FA) | El sistema debe soportar autenticación de dos factores mediante aplicaciones de código TOTP (como Google Authenticator o similares). La activación del 2FA debe ser opcional para el usuario. Al activarlo, el sistema genera un código QR para vincular la aplicación. En el inicio de sesión con 2FA activo, tras validar la contraseña, el sistema solicita el código de seis dígitos generado por la aplicación. | Alta |
| **RF-ADM-06** | Desvinculación del 2FA | El superadministrador debe poder desactivar el 2FA de cualquier cuenta desde el panel de gestión de usuarios. El propio usuario puede desvincularlo desde su perfil ingresando su contraseña actual como confirmación. | Media |

---

### 5.2 Perfil de Usuario

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RF-ADM-07** | Visualización del perfil | El sistema debe mostrar al usuario autenticado una pantalla de perfil con su información actual: nombre completo, correo electrónico, rol asignado, grupo al que pertenece, fecha de creación de la cuenta y estado de activación del 2FA. | Media |
| **RF-ADM-08** | Edición de datos personales | El usuario debe poder actualizar su nombre completo desde su perfil. El correo electrónico solo puede ser modificado por el superadministrador desde la gestión de usuarios, no por el propio usuario, para preservar la integridad del registro. | Media |
| **RF-ADM-09** | Cambio de contraseña | El usuario debe poder cambiar su propia contraseña desde la pantalla de perfil. El sistema debe solicitar la contraseña actual, la nueva contraseña y su confirmación. La nueva contraseña debe cumplir la política de seguridad configurada: mínimo ocho caracteres, al menos una letra mayúscula, una minúscula y un número. | Alta |
| **RF-ADM-10** | Imagen de perfil | El usuario debe poder subir o actualizar una imagen de perfil en formato JPG o PNG con un tamaño máximo de 2 MB. El sistema debe redimensionar la imagen automáticamente al momento de almacenarla. | Baja |

---

### 5.3 Grupos y Roles

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RF-ADM-11** | Creación de roles desde la interfaz | Los roles del sistema no son fijos ni predefinidos en el código. El superadministrador debe poder crear, editar y eliminar roles de forma dinámica desde la interfaz. Al crear un rol se indica su nombre. Un rol no puede eliminarse si tiene usuarios asignados. | Alta |
| **RF-ADM-12** | Gestión de grupos | El superadministrador debe poder crear grupos de usuarios para organizar equipos de trabajo. Cada grupo tiene un nombre. Un usuario puede pertenecer a un único grupo. | Media |
| **RF-ADM-13** | Asignación de rol a usuario | Al crear o editar un usuario, el superadministrador debe poder asignarle un grupo desde los disponibles en el sistema. El rol determina los permisos que el usuario tiene sobre cada módulo. | Alta |
| **RF-ADM-14** | Herencia de permisos por grupo | Los usuarios heredan los permisos del grupo al que pertenecen. Los permisos de un usuario individual pueden complementar los del grupo, pero nunca pueden exceder el conjunto máximo de permisos disponibles para su rol. | Media |

---

### 5.4 Permisos por Módulo

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RF-ADM-15** | Permisos definidos en código, asignados desde la interfaz | El conjunto de permisos disponibles en el sistema (Ver, Crear, Editar, Eliminar sobre cada módulo) está definido y acoplado en el código del backend y del frontend. No es posible crear permisos nuevos desde la interfaz, ya que cada permiso tiene lógica de validación asociada en el servidor. Desde la interfaz el superadministrador únicamente selecciona qué permisos del conjunto disponible se asignan a cada rol. | Alta |
| **RF-ADM-16** | Control de acceso por ruta | Cada ruta del panel administrativo debe verificar en el servidor que el usuario autenticado tiene el permiso requerido. Si no lo tiene, el sistema redirige a una pantalla de acceso denegado. La misma validación debe aplicarse en los endpoints del backend de forma independiente al frontend. | Alta |
| **RF-ADM-17** | Ocultamiento de elementos sin permiso | Los botones, menús y acciones de tabla para los que el usuario no tiene permiso deben ocultarse o deshabilitarse directamente en la interfaz. No deben mostrarse como disponibles para luego rechazarse al intentar usarlos. | Alta |

---

### 5.5 Módulos del Panel Administrativo y Configuración del Sistema

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RF-ADM-18** | Estructura de navegación del panel | El panel administrativo debe contar con un menú lateral persistente que agrupe las secciones del sistema. Los módulos visibles en el menú se ajustan según los permisos del rol activo. | Alta |
| **RF-ADM-19** | Tablero principal (Dashboard) | El tablero muestra un resumen de actividad: total de evaluaciones realizadas, distribución de dictámenes (A, B, C) en formato gráfico, evaluaciones recientes y accesos directos a las secciones más utilizadas según el rol activo. | Media |
| **RF-ADM-20** | Módulo de catálogo | Presenta una vista de árbol navegable con la jerarquía Dimensión → Factor → Subfactor. El administrador puede realizar operaciones CRUD sobre cada nivel desde la misma vista. Cualquier cambio se refleja de forma inmediata en la vista pública. | Alta |
| **RF-ADM-21** | Módulo de evaluaciones | Lista todas las evaluaciones registradas con filtros por: nombre del software, organización, tipo de dictamen (A/B/C), rango de fechas y estado. Permite ver el detalle completo en modo solo lectura y exportarlo en PDF. | Alta |
| **RF-ADM-22** | Módulo de configuración — Organización | En la sección de Organización el superadministrador puede configurar la identidad del sistema: nombre de la organización, slogan, correo de contacto, RUC, logotipo (imagen JPG o PNG), dirección física y teléfono. Estos datos se utilizan como membrete en los reportes generados y como identidad visual del panel. | Alta |
| **RF-ADM-23** | Módulo de configuración — Roles y Permisos | En la sección de Roles y Permisos el superadministrador puede crear y administrar roles, y asignar a cada rol el conjunto de permisos disponibles en el sistema. Los permisos disponibles (Ver, Crear, Editar, Eliminar sobre cada módulo) están definidos en el código y no pueden ser creados desde la interfaz. La interfaz únicamente presenta el listado de permisos existentes y permite activarlos o desactivarlos para cada rol. | Alta |
| **RF-ADM-24** | Módulo de configuración — Estructura del menú | En la sección de Estructura del Menú el superadministrador puede organizar de forma visual los módulos y secciones que aparecen en el menú lateral del panel. La organización es puramente visual: permite reordenar, agrupar y ocultar secciones del menú sin afectar la lógica de permisos ni las rutas del sistema. Los cambios se aplican para todos los usuarios que accedan al panel. | Media |

---

### 5.6 Gestión de Usuarios

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-ADM-25** | Listado de usuarios | El superadministrador debe poder consultar la lista completa de usuarios con información de nombre, correo, rol, grupo, estado de la cuenta (activa/inactiva) y si tiene 2FA habilitado. El listado debe soportar búsqueda por nombre o correo y filtro por rol o grupo. | Alta |
| **RF-ADM-26** | Creación de usuarios | El superadministrador debe poder crear nuevos usuarios del panel administrativo indicando: nombre completo, correo electrónico, rol, grupo y estado inicial. | Alta |
| **RF-ADM-27** | Edición de usuarios | El superadministrador debe poder editar cualquier dato de un usuario existente: nombre, correo, rol, grupo y estado. Los cambios de rol deben aplicarse de forma inmediata en la siguiente acción del usuario afectado. | Alta |
| **RF-ADM-28** | Activación y desactivación de cuentas | El superadministrador debe poder activar o desactivar cuentas de usuario sin eliminarlas. Un usuario con cuenta desactivada no puede iniciar sesión. Si el usuario tiene sesión activa al momento de ser desactivado, su sesión debe invalidarse inmediatamente. | Alta |
| **RF-ADM-29** | Eliminación de usuarios | El superadministrador debe poder eliminar permanentemente una cuenta de usuario solo si esta no tiene evaluaciones ni actividad registrada en el historial. Si existe actividad asociada, la opción disponible es únicamente la desactivación de la cuenta. | Media |
| **RF-ADM-30** | Restablecimiento de contraseña por administrador | El superadministrador debe poder forzar el restablecimiento de contraseña de cualquier usuario. El sistema envía al correo del usuario afectado un enlace de restablecimiento con las mismas condiciones que el flujo de recuperación estándar (RF-ADM-04). | Alta |

---

### 5.7 Gestión del Catálogo (Dimensiones, Factores y Subfactores)

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-ADM-31** | CRUD de dimensiones | El administrador debe poder crear, consultar, editar y eliminar dimensiones. Una dimensión solo puede eliminarse si no tiene factores asociados. | Alta |
| **RF-ADM-32** | CRUD de factores | El administrador debe poder crear, consultar, editar y eliminar factores. Al crear un factor debe indicar: dimensión, nombre, IS (1 a 4) y ámbito (Interno, Externo o Ambos). Un factor solo puede eliminarse si no tiene subfactores ni evaluaciones que lo referencien. Cualquier modificación se refleja de forma inmediata en la vista pública. | Alta |
| **RF-ADM-33** | CRUD de subfactores | El administrador debe poder crear, consultar, editar y eliminar subfactores. Al crear un subfactor debe indicar el factor al que pertenece y el texto descriptivo del criterio. Un subfactor solo puede eliminarse si no tiene calificaciones registradas en evaluaciones. | Alta |

---

### 5.8 Historial de Evaluaciones

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-ADM-34** | Listado y filtrado del historial | El administrador debe poder consultar el historial completo de evaluaciones con filtros por: nombre del software evaluado, nombre de la organización, tipo de dictamen (A, B o C), rango de fechas y estado de la evaluación (en progreso o finalizada). | Alta |
| **RF-ADM-35** | Vista de detalle de evaluación | El administrador debe poder abrir el detalle de una evaluación en modo solo lectura, visualizando: datos del software y la organización, valores de IS, ID, IR y ámbito configurados en el Paso 1-2, calificaciones de cada subfactor del Paso 3-4, clasificación FODA de cada factor, y el dictamen emitido junto con el resumen ejecutivo generado por la IA si aplica. | Alta |
| **RF-ADM-36** | Exportación del historial | El administrador debe poder exportar el listado filtrado del historial en formato CSV para análisis externo. El detalle de una evaluación individual debe poder exportarse en formato PDF. | Media |

---

### 5.9 Auditoría del Sistema

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-ADM-37** | Registro automático de eventos de auditoría | El sistema debe registrar de forma automática e inmutable cada evento relevante que ocurra en el panel administrativo. Los eventos registrados incluyen: inicio y cierre de sesión, intentos de acceso fallidos, creación, edición y eliminación de usuarios, cambios de rol o grupo, modificaciones al catálogo (dimensiones, factores, subfactores), cambios en la configuración del sistema (organización, roles, permisos, estructura del menú), y generación de dictamen en evaluaciones. Cada registro de auditoría debe contener: usuario que ejecutó la acción, tipo de evento, módulo afectado, descripción del cambio (valor anterior y valor nuevo cuando aplique), dirección IP del cliente y marca de tiempo exacta. | Alta |
| **RF-ADM-38** | Inmutabilidad de los registros de auditoría | Los registros de auditoría no pueden ser editados, eliminados ni purgados desde la interfaz del sistema, independientemente del rol del usuario. Solo un proceso de archivo programado por el equipo técnico puede mover registros antiguos a almacenamiento histórico, manteniendo siempre la trazabilidad completa. | Alta |
| **RF-ADM-39** | Consulta y filtrado del log de auditoría | El superadministrador debe poder consultar el log de auditoría con filtros por: usuario, tipo de evento, módulo afectado y rango de fechas. El log debe presentarse en orden cronológico descendente (evento más reciente primero). | Alta |

---

## 6. Requerimientos Funcionales — Módulo de Asistencia con IA

El módulo de asistencia con inteligencia artificial actúa como un asistente de apoyo al evaluador. **La IA solo sugiere:** en ningún caso reemplaza el juicio humano, rellena valores por su cuenta ni ejecuta los cálculos matemáticos del motor GUIOS. El evaluador acepta, cambia o ignora cada sugerencia. El dictamen siempre lo calcula el motor matemático, aunque la IA esté apagada o falle (RN-14).

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RF-IA-01** | Activación opcional del módulo | El modal de inicio tiene un interruptor **"Activar asistencia IA"**, apagado por defecto. Solo puede encenderse si el evaluador proporcionó al menos uno de estos datos: descripción de la organización y sus necesidades, o enlace al repositorio del software candidato. Con el interruptor apagado, el sistema funciona completo en modo manual. | Alta |
| **RF-IA-02** | Sugerencia de Importancia del Decisor en Pasos 1 y 2 | Al invocar la IA en el Paso 1-2, el sistema envía al servicio los datos del software y de la organización registrados junto con el catálogo de factores. El servicio retorna para cada factor un valor sugerido de ID (1 a 4) con una justificación breve. La sugerencia se muestra **junto** al control, diferenciada visualmente, con las acciones **Aceptar**, **Cambiar** e **Ignorar**; el valor del control sigue "sin calificar" hasta que el evaluador decide. Se guarda la ID sugerida, su justificación y si fue aceptada sin cambios. | Alta |
| **RF-IA-03** | Sugerencia de calificación de subfactores en Pasos 3 y 4 | Al invocar la IA en el Paso 3-4, el sistema envía los datos registrados y los subfactores del factor seleccionado. El servicio retorna para cada subfactor un valor sugerido de calificación (1 a 4) con una justificación breve. Se muestra junto a cada subfactor con las mismas acciones Aceptar / Cambiar / Ignorar; la IA nunca califica por su cuenta. Se guarda la calificación sugerida, su justificación y si fue aceptada sin cambios. | Alta |
| **RF-IA-04** | Generación del resumen ejecutivo y plan de mitigación | Tras calcular el dictamen, si la IA está activada, el sistema envía al servicio la matriz FODA, los factores que causan el dictamen y el tipo de dictamen (A, B o C). El servicio retorna un resumen ejecutivo en lenguaje claro para la Alta Dirección y, **si el dictamen es B o C**, un plan de mitigación con acciones concretas para los factores negativos. Ambos complementan la recomendación personalizada y se muestran separados del dictamen matemático, que no cambia. | Alta |
| **RF-IA-05** | Manejo de errores del servicio de IA | Si el servicio de IA no está disponible, devuelve error o supera el tiempo de espera configurado, el sistema debe: notificar al evaluador con un mensaje claro, permitir continuar en modo manual sin interrupción del flujo, y no bloquear ni generar errores en los cálculos matemáticos del motor GUIOS, que funcionan con independencia total del servicio de IA. | Alta |
| **RF-IA-06** | Formato de comunicación con el servicio de IA | El backend estructura todas las solicitudes al servicio en formato JSON estricto y solicita respuestas en el mismo formato. Las respuestas son validadas antes de mostrarse al usuario. Si una respuesta no cumple el formato esperado, el sistema la descarta y notifica el error sin interrumpir el flujo de evaluación. | Alta |
| **RF-IA-07** | Trazabilidad, credenciales y pruebas | Cada llamada al servicio se registra en `AIAssistanceLog` (tipo, payload sin credenciales, respuesta, estado y tiempo). La clave de la API se lee del archivo `.env` del servidor, nunca del código. El proveedor queda detrás de una interfaz intercambiable; las pruebas automáticas usan un proveedor falso (mock) y nunca hacen llamadas reales. El proveedor real se elige antes de implementar este módulo. | Alta |

---

## 7. Requerimientos No Funcionales

Los requerimientos no funcionales se formulan siguiendo las características de calidad de producto definidas en la norma ISO/IEC 25010.

| Número | Requerimiento | Descripción | Prioridad |
| :--- | :--- | :--- | :---: |
| **RNF-01** | Rendimiento — recálculo inmediato | El recálculo de la Importancia Relativa (IR) al elegir una ID en el Paso 1-2 debe completarse en menos de 100 ms. El cálculo de la Ponderación Media (PM) y la clasificación FODA al calificar el último subfactor de un factor debe completarse en menos de 200 ms. La generación del dictamen matemático final no debe superar los 300 ms. | Alta |
| **RNF-02** | Rendimiento — tiempos del panel administrativo | El panel administrativo debe cargar cualquier listado principal (usuarios, evaluaciones, catálogo) en menos de 2 segundos en condiciones de conexión normal. | Media |
| **RNF-03** | Rendimiento — tiempo de espera del servicio de IA | Las solicitudes al servicio de IA deben tener un tiempo máximo de espera (timeout) configurable. El valor predeterminado es 30 segundos. Al superar ese límite, el sistema activa el mecanismo de degradación elegante (RF-IA-05). | Media |
| **RNF-04** | Usabilidad — lenguaje accesible para el módulo público | La interfaz del módulo público debe ser comprensible para usuarios no técnicos. Los textos de cada paso, columna y escala de evaluación deben redactarse sin presuponer conocimientos previos de metodologías de software. | Alta |
| **RNF-05** | Usabilidad — diferenciación de sugerencias de IA | Las calificaciones y valores sugeridos por la IA deben estar visualmente diferenciados de los valores ingresados manualmente. El evaluador debe poder identificar en todo momento qué valores provienen del asistente y cuáles fueron decididos por él. | Alta |
| **RNF-06** | Usabilidad — retroalimentación inmediata | El sistema debe proporcionar retroalimentación visual inmediata ante cualquier acción del usuario: selección de un valor, guardado automático de subfactores, invocación del servicio de IA y cálculo del dictamen. En operaciones que toman más de 500 ms debe mostrarse un indicador de progreso. | Alta |
| **RNF-07** | Confiabilidad — restricción de rangos | Los controles de selección deben restringir físicamente el ingreso de valores fuera del rango permitido [1, 4] (o "sin calificar"). El sistema no debe permitir guardar calificaciones fuera de ese rango ni por manipulación directa del DOM ni por solicitudes al backend. | Alta |
| **RNF-08** | Confiabilidad — determinismo del motor matemático | El motor de cálculo (IR, PM, FODA y dictamen) debe producir resultados deterministas: la misma entrada siempre produce la misma salida. Ninguna parte de estos cálculos debe ser delegada al servicio de IA. | Alta |
| **RNF-09** | Confiabilidad — integridad referencial y snapshots en base de datos | La base de datos debe aplicar restricciones de clave foránea (FK PROTECT) para evitar la eliminación en cascada de factores o subfactores con evaluaciones históricas (RN-07), y almacenar snapshots inmutables para desacoplar el histórico de evaluaciones de futuras modificaciones o recalibraciones del catálogo (RN-08). | Alta |
| **RNF-10** | Portabilidad — compatibilidad de navegadores | El módulo público y el panel administrativo deben funcionar correctamente en las versiones actuales de Google Chrome, Mozilla Firefox y Microsoft Edge sin requerir extensiones, plugins ni configuraciones especiales. | Alta |
| **RNF-11** | Mantenibilidad — separación de capas en el frontend | La arquitectura del frontend debe separar estrictamente la capa de presentación, la lógica de estado y los componentes por paso o sección. Ningún componente debe tener dependencias directas con otro del mismo nivel. | Alta |
| **RNF-12** | Mantenibilidad — motor matemático desacoplado | El motor de cálculo debe estar desacoplado de la interfaz de usuario y poder ejecutarse y probarse de forma independiente, sin necesidad de instanciar componentes visuales. | Alta |
| **RNF-13** | Mantenibilidad — módulo de IA encapsulado | La integración con el servicio de IA debe estar encapsulada en un servicio independiente. Sustituir el proveedor de IA no debe requerir modificar la lógica de los pasos de evaluación ni el motor matemático. | Alta |
| **RNF-14** | Mantenibilidad — catálogo centralizado | El catálogo de factores y subfactores no debe estar codificado directamente en el frontend. Debe cargarse desde el backend o desde un archivo de configuración centralizado. | Alta |
| **RNF-15** | Seguridad — autenticación del panel administrativo | Ninguna ruta del panel administrativo debe ser accesible sin sesión activa válida. La validación debe realizarse tanto en el enrutamiento del frontend como en cada endpoint del backend. | Alta |
| **RNF-16** | Seguridad — protección de credenciales de IA | Las credenciales de acceso al servicio de IA (claves de API) deben almacenarse exclusivamente en el servidor y nunca exponerse en el código del frontend ni en las respuestas de la API pública. | Alta |
| **RNF-17** | Seguridad — privacidad de datos del evaluador | La información ingresada por el evaluador en el modal de inicio (descripción de la empresa, enlace al repositorio) se transmite al servicio de IA exclusivamente mediante HTTPS(produccion), HTTP(desarrollo). No se almacena en el servidor sin consentimiento explícito del evaluador. | Alta |
| **RNF-18** | Seguridad — validación de entradas en el backend | El sistema debe proteger todos los endpoints del backend contra inyección de datos malformados mediante validación de esquemas en cada entrada. Las solicitudes que no cumplan el esquema esperado deben ser rechazadas con un código de error apropiado. | Alta |
| **RNF-19** | Disponibilidad — independencia del servicio de IA | La no disponibilidad del servicio de IA no debe afectar la disponibilidad ni la funcionalidad del sistema principal. El sistema debe operar al 100% de su capacidad de evaluación matemática con independencia del estado del servicio de IA. | Alta |

---

## 8. Restricciones del sistema

| Restricción | Descripción |
| :--- | :--- |
| Escala de evaluación fija | Tanto los factores (IS, ID, IR) como los subfactores se evalúan en escala discreta de 1 a 4. No se admite otra escala. |
| Alcance: un decisor por evaluación | Cada evaluación la realiza un solo decisor. La evaluación colaborativa entre varios decisores (sugerida por la especialista del caso de estudio, tesis pág. 107) queda como **trabajo futuro**. |
| Catálogo base de la guía GUIOS | El catálogo inicial de 18 factores y 61 subfactores proviene de la tesis doctoral. El administrador puede ampliarlo pero no reducirlo por debajo del mínimo original sin respaldo metodológico. |
| Umbral de clasificación FODA | El umbral de corte para determinar si un factor es positivo es PM >= 3.0. Este valor es una constante metodológica y no debe ser configurable por el usuario. |
| Independencia del motor matemático | Los cálculos de IR, PM, FODA y dictamen deben ser deterministas y ejecutarse sin depender de ningún servicio externo. |
| Idioma | La interfaz del sistema se presenta íntegramente en español. |

---

## 9. Reglas del negocio

| Código | Regla |
| :--- | :--- |
| RN-01 | Un factor con IR = Irrelevante no participa en la calificación de subfactores ni en el dictamen final, independientemente del valor de sus subfactores. |
| RN-02 | La PM de un factor solo se considera válida si todos sus subfactores han sido calificados. Un factor con subfactores sin calificar no debe generar clasificación FODA ni entrar en el dictamen. |
| RN-03 | El dictamen C tiene prioridad sobre el B. Si existen factores negativos tanto en IR crítica (Importante o Fundamental) como en IR opcional, el dictamen resultante es siempre C. |
| RN-04 | El evaluador puede guardar su avance en cualquier momento, pero el sistema no emite el dictamen hasta que **todos** los factores relevantes tengan todos sus subfactores calificados. Mientras falte alguno, informa cuáles están incompletos. |
| RN-05 | Las sugerencias de la IA son orientativas. El valor que se persiste es siempre el que el evaluador eligió o aceptó explícitamente; una sugerencia no aceptada no cuenta como valor. |
| RN-06 | El factor "Soporte" es el único del catálogo base cuyo ámbito puede ser configurado por el evaluador. Todos los demás tienen ámbito fijo definido en el catálogo. |
| RN-07 | Integridad referencial del catálogo: Un administrador solo puede eliminar un factor o subfactor si no existen evaluaciones registradas que lo referencien, protegiendo las referencias directas mediante restricciones de clave foránea (`models.PROTECT`). |
| RN-08 | Inmutabilidad histórica mediante snapshot: Las evaluaciones completadas son inmutables. Para garantizar que ediciones posteriores en los nombres de factores, en los textos de subfactores o en la Importancia Sugerida (IS) del catálogo administrativo no alteren retroactivamente evaluaciones históricas, las tablas intermedias de evaluación almacenan copias snapshot (`suggested_importance_snapshot`, `factor_name_snapshot` y `description_snapshot`). El historial, los cálculos de PM/FODA y el dictamen quedan fijados permanentemente. |
| RN-09 | Permisos definidos en código (RBAC estricto): Los permisos semánticos (`ModulePermission`) están definidos exclusivamente en el código fuente del sistema (`backend` y `frontend`). La interfaz administrativa solo permite asignar o revocar permisos preexistentes a los roles dinámicos creados, no crear permisos nuevos arbitrarios. |
| RN-10 | Unicidad de Organización (Singleton): El sistema admite un único registro de identidad institucional en la base de datos para membretes, logos y reportes corporativos. |
| RN-11 | Inmutabilidad de auditoría con verificación criptográfica: Todo registro en `AuditLog` es inmutable. Incorpora un checksum criptográfico SHA-256 para detectar alteraciones directas en la base de datos. No existe interfaz ni endpoint para editar o eliminar registros de auditoría. |
| RN-12 | Sin valores por defecto: la Importancia del Decisor, el ámbito de "Soporte" y las calificaciones de subfactores arrancan "sin calificar". La IS se muestra solo como referencia; nunca se usa como valor de la ID. Un subfactor sin calificar no cuenta como "No cumple". |
| RN-13 | Resultados derivados: la IR, la relevancia, la PM, la clasificación FODA y el dictamen se calculan siempre a partir de los valores vigentes. Si el evaluador cambia una ID, el ámbito de "Soporte" o una calificación, todos los resultados afectados se recalculan; nunca se muestra un resultado desactualizado. |
| RN-14 | Independencia del dictamen respecto a la IA: el dictamen lo calcula exclusivamente el motor matemático con los valores confirmados por el evaluador. La misma entrada produce el mismo dictamen con la IA apagada, encendida o con fallas. |

---

## 10. Product Backlog Inicial

El Product Backlog inicial se define para el marco de gestión SCRUM. Las historias de usuario están priorizadas según su valor de negocio y su arquitectura de dependencias técnicas: primero se consolida el núcleo de infraestructura, autenticación, control de acceso y catálogo administrativo (Core & Admin); posteriormente se implementa el flujo de evaluación pública GUIOS; y finalmente se incorporan los módulos de asistencia con inteligencia artificial, historial avanzado y reportería.

El esfuerzo estimado se expresa en Story Points (SP) usando la serie de Fibonacci. Las historias se distribuyen a lo largo de cuatro sprints de dos semanas cada uno.

| ID | Historia de usuario | Criterios de aceptación principales | Prioridad | Est. (SP) | Sprint |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **US-01** | Como superadministrador, quiero iniciar sesión con correo y contraseña, activar 2FA opcional y recuperar mi clave vía código de 6 dígitos, para acceder de forma segura al panel administrativo. | Login con credenciales seguras. Bloqueo temporal tras 5 intentos fallidos consecutivos. Flujo TOTP con código QR y claves de respaldo. Recuperación de contraseña por código OTP de 6 dígitos con vigencia de 30 min. | Alta | 5 | 1 |
| **US-02** | Como superadministrador, quiero crear, listar, editar y activar/desactivar usuarios asignándoles grupos y roles, para gestionar el personal operativo del sistema. | CRUD de usuarios con validaciones de email único. Desactivación inmediata que invalida sesiones activas. Búsqueda y filtrado por rol y estado. | Alta | 5 | 1 |
| **US-03** | Como superadministrador, quiero crear roles dinámicos, asignarles permisos de módulo acoplados en código y organizar visualmente la estructura del menú lateral, para gobernar el acceso del panel. | Creación dinámica de roles. Asignación granular de permisos existentes (`ModulePermission`). Editor visual para reordenar, agrupar y mostrar/ocultar secciones del sidebar. Validación estricta en frontend y backend. | Alta | 5 | 1 |
| **US-04** | Como superadministrador, quiero configurar los datos institucionales de la organización (nombre, RUC, logo, contacto), para establecer la identidad visual del sistema y el membrete de reportes. | Registro único (Singleton). Validación de RUC Ecuador. Carga y procesamiento de logo a formato optimizado. Información reflejada en el encabezado del panel y reportes PDF. | Alta | 3 | 1 |
| **US-05** | Como superadministrador, quiero consultar el log de auditoría inmutable con todos los eventos relevantes del sistema, para garantizar la trazabilidad y detección de anomalías. | Registro automático de acciones (login, cambios de usuario, roles, catálogo). Checksum criptográfico SHA-256 por registro. Filtros por usuario, módulo, evento y fecha. Sin opciones de edición o borrado. | Alta | 5 | 1 |
| **US-06** | Como administrador, quiero gestionar el catálogo de dimensiones, factores y subfactores en una vista de árbol jerárquica, para mantener actualizada la base metodológica de evaluación. | CRUD en cascada Dimensión → Factor → Subfactor. Validación de rangos en IS (1-4). Configuración del ámbito (Interno/Externo) y bandera de Soporte. Restricción `PROTECT` que impide borrar elementos con evaluaciones vinculadas. | Alta | 8 | 2 |
| **US-07** | Como desarrollador / sistema, quiero disponer de un motor de cálculo matemático determinista y desacoplado, para computar de forma exacta la IR, PM, matriz FODA y dictámenes A, B y C. | Implementación pura de fórmulas GUIOS: IR por la matriz de la Figura 5.10 (equivale a $IR\_idx = \lfloor(IS\_idx + ID\_idx)/2\rfloor$), umbral $PM \ge 3.0$, clasificación FODA por ámbito, matriz de decisión A (adoptar), B (con matices), C (posponer); C prevalece sobre B. Devuelve los factores que causan el dictamen. Sin dictamen si falta algún factor relevante. Caso UNEMI de la tesis → C. Cobertura de pruebas unitarias al 100%. | Alta | 5 | 2 |
| **US-08** | Como evaluador, quiero registrar los datos iniciales del software candidato y mi organización en un modal de bienvenida, para contextualizar la evaluación antes de comenzar. | Modal al ingresar a la vista pública. Validación de campos obligatorios (software, organización). Campos opcionales (versión, sector, repositorio, descripción TI) para habilitar asistencia de IA. | Alta | 3 | 3 |
| **US-09** | Como evaluador, quiero configurar la Importancia del Decisor (ID) de los 18 factores en los Pasos 1 y 2, para que el sistema determine cuáles son relevantes. | Control de 4 opciones para la ID, que arranca "sin calificar", con la IS de la guía visible como referencia. Recálculo inmediato (<100 ms) de la Importancia Relativa (IR). Selector de ámbito (sin preselección) editable únicamente en el factor "Soporte". Filtro automático: solo factores con IR > 1 pasan al Paso 3. | Alta | 5 | 3 |
| **US-10** | Como evaluador, quiero calificar los subfactores de cada factor relevante de forma rápida en los Pasos 3 y 4, para que el sistema calcule la Ponderación Media y clasifique cada factor en la matriz FODA. | Selector exclusivo de factores relevantes con progreso y PM. Un clic por subfactor en 4 botones con etiqueta, arrancando "sin calificar". Guardado automático, sin botón "Guardar" por factor (mejora pedida por la especialista, tesis pág. 107). PM y FODA al completar el factor. | Alta | 8 | 3 |
| **US-11** | Como evaluador, quiero visualizar la matriz FODA consolidada, obtener el dictamen final (A, B o C) y conservar mi avance temporal, para conocer la viabilidad de adopción sin perder mi progreso. | Matriz visual en cuatro cuadrantes (Fortalezas, Oportunidades, Debilidades, Amenazas). Dictamen bloqueado hasta evaluar todos los factores relevantes. Bloque de dictamen con color y texto, texto explicativo metodológico y recomendación personalizada que nombra los factores causantes (tesis pág. 107). Persistencia de sesión en `localStorage`. | Alta | 5 | 3 |
| **US-12** | Como administrador, quiero consultar el historial completo de evaluaciones con filtros avanzados y exportar reportes en CSV y PDF, para dar seguimiento formal a las decisiones tomadas. | Listado de evaluaciones filtrable por software, organización, dictamen (A/B/C) y fecha. Vista detallada en modo solo lectura de factores y subfactores calificados. Descarga de listado en CSV y reporte ejecutivo individual en PDF. | Alta | 5 | 4 |
| **US-13** | Como evaluador, quiero que la IA sugiera valores de ID en los Pasos 1-2 y calificaciones de subfactores en los Pasos 3-4 con su justificación, para agilizar el proceso de evaluación. | Interruptor "Activar asistencia IA" en el registro, habilitado solo con descripción o URL de repositorio. Sugerencias mostradas junto al control, diferenciadas visualmente, con Aceptar / Cambiar / Ignorar; la IA nunca rellena valores. Se guarda la sugerencia, la justificación y si se aceptó sin cambios. Manejo elegante de timeouts (30s) y errores. Pruebas con proveedor falso (mock). | Alta | 8 | 4 |
| **US-14** | Como evaluador, quiero que tras emitirse el dictamen la IA genere un resumen ejecutivo y un plan de mitigación para factores críticos negativos, para presentar un informe claro a la Alta Dirección. | Generación de resumen ejecutivo no técnico. Plan de mitigación con acciones correctivas concretas si el dictamen es B o C. Registro del consumo en `AIAssistanceLog`. Independencia total del motor de decisión matemático (mismo dictamen con o sin IA). | Alta | 5 | 4 |

---

*Documento elaborado en el marco del Sprint 0 del proyecto GUIOS PRO.*
*Basado en la metodología GUIOS — Tesis Doctoral, Universidad de Sevilla / UNEMI.*
