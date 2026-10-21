# Historias de Usuario

Documento de historias de usuario del sistema. Cada historia incluye su descripción, precondiciones, flujo principal, flujos alternativos, criterios de aceptación, reglas de negocio y requerimientos relacionados.

## Índice

| ID | Nombre | Prioridad | Sprint |
|----|--------|-----------|--------|
| [US-01](#us-01--gestión-de-acceso-del-superadministrador) | Gestión de acceso del Superadministrador | Alta | 1 |
| [US-02](#us-02--gestión-de-usuarios) | Gestión de usuarios | Alta | 1 |
| [US-03](#us-03--gestión-de-roles-permisos-y-menú) | Gestión de roles, permisos y menú | Alta | 1 |
| [US-04](#us-04--configuración-de-información-institucional) | Configuración de información institucional | Alta | 1 |
| [US-05](#us-05--auditoría-y-trazabilidad) | Auditoría y trazabilidad | Alta | 1 |
| [US-06](#us-06--gestión-del-catálogo-de-evaluación) | Gestión del catálogo de evaluación | Alta | 2 |
| [US-07](#us-07--motor-matemático-de-evaluación) | Motor matemático de evaluación | Alta | 2 |
| [US-08](#us-08--registro-inicial-del-software-y-organización) | Registro inicial del software y organización | Alta | 3 |
| [US-09](#us-09--configuración-de-factores-e-importancia-del-decisor) | Configuración de factores e Importancia del Decisor | Alta | 3 |
| [US-10](#us-10--evaluación-de-subfactores) | Evaluación de subfactores | Alta | 3 |
| [US-11](#us-11--resultado-foda-y-dictamen-final) | Resultado FODA y dictamen final | Alta | 3 |
| [US-12](#us-12--historial-y-exportación-de-evaluaciones) | Historial y exportación de evaluaciones | Alta | 4 |
| [US-13](#us-13--asistencia-de-ia-durante-la-evaluación) | Asistencia de IA durante la evaluación | Alta | 4 |
| [US-14](#us-14--resumen-ejecutivo-y-plan-de-mitigación-mediante-ia) | Resumen ejecutivo y plan de mitigación mediante IA | Alta | 4 |

---

## US-01 — Gestión de acceso del Superadministrador

- **Prioridad:** Alta
- **Sprint:** Sprint 1

**Historia de usuario:** Como superadministrador, quiero iniciar sesión de forma segura mediante correo y contraseña, disponer de 2FA opcional y recuperar mi contraseña, para acceder de forma segura al panel administrativo.

**Descripción:** El sistema debe permitir al superadministrador autenticarse mediante correo electrónico y contraseña. También debe permitir activar autenticación de dos factores mediante TOTP y recuperar la contraseña mediante un código de 6 dígitos.

**Precondiciones:** El usuario debe disponer de una cuenta registrada y activa. Para utilizar 2FA debe haberlo configurado previamente.

**Flujo principal**
1. El superadministrador accede al formulario de inicio de sesión.
2. Ingresa correo y contraseña.
3. El sistema valida las credenciales.
4. Si tiene 2FA activo, solicita el código TOTP.
5. Valida el código.
6. Permite el acceso al panel administrativo.
7. El usuario puede cerrar sesión desde el panel.

**Flujos alternativos / excepciones**
1. Si las credenciales son incorrectas, se muestra un mensaje genérico.
2. Después de 5 intentos fallidos consecutivos, la cuenta se bloquea temporalmente.
3. Si el código 2FA es incorrecto, se rechaza el acceso.
4. Si el usuario olvida su contraseña, puede solicitar recuperación.
5. El código de recuperación de 6 dígitos deja de ser válido después de 30 minutos o después de utilizarse.

**Criterios de aceptación**
- **CA-01:** El formulario permite ingresar correo y contraseña.
- **CA-02:** Después de 5 intentos fallidos se aplica bloqueo temporal.
- **CA-03:** El 2FA TOTP puede activarse opcionalmente y utiliza código QR.
- **CA-04:** Una cuenta con 2FA activo solicita el código TOTP después de validar la contraseña.
- **CA-05:** La recuperación utiliza un código único de 6 dígitos con validez de 30 minutos.
- **CA-06:** El cierre de sesión invalida la sesión/token.

**Reglas de negocio:** RN-09

**Requerimientos relacionados:** RF-ADM-01, RF-ADM-02, RF-ADM-03, RF-ADM-04, RF-ADM-05, RF-ADM-06; RNF-15, RNF-18.

---

## US-02 — Gestión de usuarios

- **Prioridad:** Alta
- **Sprint:** Sprint 1

**Historia de usuario:** Como superadministrador, quiero crear, consultar, editar, activar y desactivar usuarios y asignarles grupos y roles, para controlar el acceso al panel administrativo.

**Descripción:** Permite administrar las cuentas de usuarios del sistema, incluyendo sus datos personales, rol, grupo y estado.

**Precondiciones:** El superadministrador debe haber iniciado sesión y disponer de permisos para gestionar usuarios.

**Flujo principal**
1. El superadministrador accede al módulo de usuarios.
2. Consulta el listado.
3. Puede buscar por nombre o correo y filtrar por rol o grupo.
4. Puede crear un usuario indicando nombre, correo, rol, grupo y estado.
5. Puede editar los datos de un usuario.
6. Puede activar o desactivar una cuenta.
7. El sistema aplica los cambios.

**Flujos alternativos / excepciones**
1. Si el correo ya existe, se rechaza la creación.
2. Si se desactiva un usuario con sesión activa, su sesión se invalida inmediatamente.
3. Si un usuario tiene actividad o evaluaciones asociadas, no puede eliminarse permanentemente y debe desactivarse.

**Criterios de aceptación**
- **CA-01:** Se pueden crear usuarios con los datos requeridos.
- **CA-02:** El correo electrónico debe ser único.
- **CA-03:** Se pueden editar nombre, correo, rol, grupo y estado.
- **CA-04:** Se puede buscar por nombre/correo y filtrar por rol/grupo/estado.
- **CA-05:** La desactivación impide nuevos accesos.
- **CA-06:** La desactivación invalida inmediatamente una sesión activa.
- **CA-07:** La eliminación está protegida cuando existen registros asociados.

**Reglas de negocio:** RN-07, RN-09.

**Requerimientos relacionados:** RF-ADM-12, RF-ADM-13, RF-ADM-14, RF-ADM-25, RF-ADM-26, RF-ADM-27, RF-ADM-28, RF-ADM-29, RF-ADM-30; RNF-02, RNF-15, RNF-18.

---

## US-03 — Gestión de roles, permisos y menú

- **Prioridad:** Alta
- **Sprint:** Sprint 1

**Historia de usuario:** Como superadministrador, quiero gestionar roles, asignar permisos existentes y organizar visualmente el menú, para controlar las funciones disponibles para cada usuario.

**Descripción:** Permite crear y administrar roles dinámicos, asignarles permisos disponibles y configurar visualmente la estructura del menú administrativo.

**Precondiciones:** El superadministrador debe estar autenticado y autorizado para administrar configuración.

**Flujo principal**
1. Accede a Roles y Permisos.
2. Crea, edita o elimina un rol.
3. Selecciona permisos existentes para el rol.
4. Configura grupos cuando corresponda.
5. Accede a Estructura del Menú.
6. Reordena, agrupa u oculta módulos.
7. Guarda la configuración.

**Flujos alternativos / excepciones**
1. No se pueden crear permisos nuevos desde la interfaz.
2. No se puede eliminar un rol que tenga usuarios asignados.
3. Un usuario no puede acceder a rutas para las cuales no tiene permisos.
4. Ocultar un módulo del menú no modifica los permisos ni las rutas.

**Criterios de aceptación**
- **CA-01:** Se pueden crear, editar y eliminar roles.
- **CA-02:** Los permisos disponibles corresponden únicamente a permisos definidos por el sistema.
- **CA-03:** Se pueden asignar permisos a roles.
- **CA-04:** Las rutas y endpoints validan permisos independientemente del frontend.
- **CA-05:** Los elementos sin permiso se ocultan o deshabilitan.
- **CA-06:** El menú puede reordenarse, agruparse y ocultarse visualmente.

**Reglas de negocio:** RN-09 — RBAC estricto.

**Requerimientos relacionados:** RF-ADM-11, RF-ADM-12, RF-ADM-13, RF-ADM-14, RF-ADM-15, RF-ADM-16, RF-ADM-17, RF-ADM-18, RF-ADM-23, RF-ADM-24; RNF-15, RNF-18.

---

## US-04 — Configuración de información institucional

- **Prioridad:** Alta
- **Sprint:** Sprint 1

**Historia de usuario:** Como superadministrador, quiero configurar la información institucional del sistema, para que la identidad de la organización aparezca correctamente en el panel y reportes.

**Descripción:** Permite configurar nombre de organización, slogan, correo, RUC, logotipo, dirección y teléfono.

**Precondiciones:** El superadministrador debe estar autenticado y autorizado para modificar la configuración institucional.

**Flujo principal**
1. Accede a Configuración → Organización.
2. Visualiza los datos actuales.
3. Ingresa o modifica los datos institucionales.
4. Carga el logotipo cuando corresponda.
5. Guarda los cambios.
6. El sistema actualiza la identidad visual y los reportes.

**Flujos alternativos / excepciones**
1. Si el formato del logotipo no es válido, se rechaza.
2. Si los datos requeridos no cumplen las validaciones establecidas, no se guardan.
3. Solo debe existir un registro de identidad institucional.

**Criterios de aceptación**
- **CA-01:** Se puede configurar nombre, slogan, correo, RUC, dirección y teléfono.
- **CA-02:** Se puede cargar logotipo JPG o PNG.
- **CA-03:** Los datos aparecen en la identidad del panel.
- **CA-04:** Los datos institucionales se utilizan en los reportes.
- **CA-05:** Existe un único registro institucional.

**Reglas de negocio:** RN-10 — Unicidad de Organización (Singleton).

**Requerimientos relacionados:** RF-ADM-22; RNF-18.

---

## US-05 — Auditoría y trazabilidad

- **Prioridad:** Alta
- **Sprint:** Sprint 1

**Historia de usuario:** Como superadministrador, quiero consultar un registro inmutable de las operaciones realizadas en el sistema, para disponer de trazabilidad de las acciones administrativas.

**Descripción:** El sistema debe registrar automáticamente los eventos relevantes del panel administrativo y permitir su consulta mediante filtros.

**Precondiciones:** El usuario debe estar autenticado como superadministrador.

**Flujo principal**
1. El sistema registra automáticamente los eventos.
2. Cada evento almacena usuario, evento, módulo, cambios, IP y fecha/hora.
3. El superadministrador accede al log.
4. Aplica filtros por usuario, evento, módulo o fechas.
5. Visualiza los registros ordenados del más reciente al más antiguo.

**Flujos alternativos / excepciones**
1. Los registros no pueden editarse.
2. Los registros no pueden eliminarse desde la interfaz.
3. Un intento de modificar un registro debe ser rechazado.

**Criterios de aceptación**
- **CA-01:** Se registran automáticamente los eventos definidos.
- **CA-02:** Cada registro contiene actor, evento, módulo, cambio, IP y fecha/hora.
- **CA-03:** Los registros son inmutables.
- **CA-04:** Se utiliza checksum SHA-256 para detectar alteraciones.
- **CA-05:** El superadministrador puede filtrar por usuario, evento, módulo y fecha.
- **CA-06:** Los registros aparecen en orden cronológico descendente.

**Reglas de negocio:** RN-11 — Inmutabilidad de auditoría con verificación criptográfica.

**Requerimientos relacionados:** RF-ADM-37, RF-ADM-38, RF-ADM-39.

---

## US-06 — Gestión del catálogo de evaluación

- **Prioridad:** Alta
- **Sprint:** Sprint 2

**Historia de usuario:** Como administrador, quiero gestionar dimensiones, factores y subfactores desde un catálogo jerárquico, para mantener actualizada la metodología de evaluación GUIOS.

**Descripción:** Permite administrar el árbol Dimensión, Factor, Subfactor y mantener la integridad de las referencias utilizadas por evaluaciones históricas.

**Precondiciones:** El administrador debe estar autenticado y tener permisos sobre el catálogo.

**Flujo principal**
1. Accede al catálogo.
2. Visualiza dimensiones, factores y subfactores en estructura jerárquica.
3. Crea, consulta, edita o elimina dimensiones.
4. Gestiona factores indicando IS y ámbito.
5. Gestiona subfactores indicando su factor y criterio.
6. Guarda los cambios.
7. El catálogo actualizado queda disponible para el módulo público.

**Flujos alternativos / excepciones**
1. No se puede eliminar una dimensión con factores asociados.
2. No se puede eliminar un factor referenciado por subfactores o evaluaciones.
3. No se puede eliminar un subfactor con calificaciones registradas.
4. Los cambios posteriores no deben modificar evaluaciones históricas.

**Criterios de aceptación**
- **CA-01:** Existe estructura Dimensión-Factor-Subfactor.
- **CA-02:** Se dispone de CRUD para los tres niveles.
- **CA-03:** IS utiliza escala 1–4.
- **CA-04:** El factor permite ámbito Interno, Externo o Ambos según catálogo.
- **CA-05:** Se protege la integridad referencial.
- **CA-06:** Los cambios se reflejan en la vista pública.
- **CA-07:** Las evaluaciones históricas conservan sus snapshots.

**Reglas de negocio:**
- RN-07 — Integridad referencial.
- RN-08 — Inmutabilidad histórica mediante snapshot.

**Requerimientos relacionados:** RF-ADM-20, RF-ADM-31, RF-ADM-32, RF-ADM-33; RNF-09, RNF-14.

---

## US-07 — Motor matemático de evaluación

- **Prioridad:** Alta
- **Sprint:** Sprint 2

**Historia de usuario:** Como responsable del sistema, quiero disponer de un motor matemático determinista y desacoplado, para calcular IR, PM, FODA y dictámenes de manera consistente.

**Descripción:** Implementar el motor encargado de realizar los cálculos metodológicos de GUIOS sin depender del servicio de IA ni de componentes visuales.

**Precondiciones:** Deben estar definidos los datos de IS, ID, subfactores y ámbitos requeridos por cada cálculo.

**Flujo principal**
1. Recibe los valores de evaluación.
2. Calcula IR.
3. Determina factores relevantes.
4. Calcula PM cuando los subfactores están completos.
5. Determina la clasificación FODA.
6. Aplica las reglas correspondientes al dictamen.
7. Devuelve el resultado al sistema.

**Flujos alternativos / excepciones**
1. Un factor irrelevante no participa en subfactores ni dictamen.
2. Una PM incompleta no genera FODA.
3. Si falta algún factor relevante por evaluar, no se emite dictamen y se informa cuáles faltan.
4. Los cálculos no deben depender de la disponibilidad de IA.

**Criterios de aceptación**
- **CA-01:** El motor calcula IR de manera determinista con la matriz de la Figura 5.10 de la tesis.
- **CA-02:** La escala utilizada es 1–4; un valor "sin calificar" no se trata como 1.
- **CA-03:** PM solo se calcula con todos los subfactores calificados.
- **CA-04:** El umbral positivo de FODA es PM ≥ 3.0 (sin redondear).
- **CA-05:** Dictamen según la tesis: A Adoptar (sin negativos), B Con matices (negativos solo en IR Opcional), C Posponer (algún negativo con IR Importante o Fundamental). C prevalece sobre B.
- **CA-06:** El motor devuelve los factores que causan el dictamen, con su IR, PM y FODA.
- **CA-07:** El motor puede ejecutarse sin componentes visuales.
- **CA-08:** El motor no depende del servicio de IA.
- **CA-09:** Se realizan pruebas unitarias para las reglas matemáticas, incluido el caso UNEMI de la tesis (Figuras 6.3 a 6.5), que debe dar C.

**Reglas de negocio:** RN-01, RN-02, RN-03, RN-04, RN-12, RN-13, RN-14.

**Requerimientos relacionados:** RNF-01, RNF-08, RNF-12.

---

## US-08 — Registro inicial del software y organización

- **Prioridad:** Alta
- **Sprint:** Sprint 3

**Historia de usuario:** Como evaluador, quiero ingresar los datos del software y de mi organización al iniciar la evaluación, para proporcionar al sistema el contexto necesario para realizar la evaluación.

**Descripción:** Al ingresar al módulo público se presenta un modal con la información básica del software y organización.

**Precondiciones:** El evaluador debe acceder al módulo público de evaluación.

**Flujo principal**
1. El sistema muestra el modal de inicio.
2. El evaluador ingresa el nombre del software.
3. Ingresa el nombre de la organización.
4. Puede ingresar versión y sector.
5. Puede proporcionar descripción y repositorio.
6. Confirma la información.
7. El sistema inicia la evaluación.

**Flujos alternativos / excepciones**
1. Si falta el nombre del software, no permite continuar.
2. Si falta la organización, no permite continuar.
3. Los campos opcionales pueden dejarse vacíos.
4. Si no existe descripción ni repositorio, la evaluación continúa en modo manual.

**Criterios de aceptación**
- **CA-01:** El modal aparece al iniciar una evaluación.
- **CA-02:** Software y organización son obligatorios.
- **CA-03:** Versión y sector son opcionales.
- **CA-04:** Descripción y repositorio pueden utilizarse para habilitar IA.
- **CA-05:** Es posible continuar sin los campos opcionales.

**Reglas de negocio:** RN-05, según corresponda al uso posterior de IA.

**Requerimientos relacionados:** RF-PUB-01, RF-IA-01; RNF-04, RNF-17.

---

## US-09 — Configuración de factores e Importancia del Decisor

- **Prioridad:** Alta
- **Sprint:** Sprint 3

**Historia de usuario:** Como evaluador, quiero configurar la Importancia del Decisor de los factores, para que el sistema determine automáticamente cuáles son relevantes para mi evaluación.

**Descripción:** El evaluador elige la importancia de cada uno de los 18 factores con un control de 4 opciones y el sistema calcula la Importancia Relativa.

**Precondiciones:** Debe existir una evaluación iniciada y un catálogo activo.

**Flujo principal**
1. El sistema muestra los 18 factores, todos "sin calificar".
2. Muestra la Importancia Sugerida (IS) de la guía en solo lectura, como referencia.
3. El evaluador elige la ID (1 a 4) de cada factor.
4. El sistema calcula IR inmediatamente y guarda el avance.
5. Determina los factores relevantes.
6. El evaluador elige el ámbito (Interno o Externo) de Soporte.
7. Los factores irrelevantes son excluidos de las siguientes etapas.

**Flujos alternativos / excepciones**
1. No se pueden introducir valores fuera de 1–4.
2. El ámbito solo puede modificarse para Soporte; no tiene valor preseleccionado.
3. Los factores con IR = Irrelevante no pasan a la calificación de subfactores.
4. Si el evaluador cambia una ID o el ámbito después, todos los resultados afectados se recalculan.

**Criterios de aceptación**
- **CA-01:** Se muestran los 18 factores activos, sin valores preseleccionados.
- **CA-02:** ID utiliza valores de 1 a 4; la IS no se usa como valor por defecto.
- **CA-03:** IR se recalcula automáticamente.
- **CA-04:** El recálculo se realiza en menos de 100 ms.
- **CA-05:** Solo Soporte permite modificar su ámbito.
- **CA-06:** Los factores irrelevantes son filtrados automáticamente.

**Reglas de negocio:** RN-01, RN-06, RN-12, RN-13.

**Requerimientos relacionados:** RF-PUB-02, RF-PUB-03; RNF-01, RNF-06, RNF-07.

---

## US-10 — Evaluación de subfactores

- **Prioridad:** Alta
- **Sprint:** Sprint 3

**Historia de usuario:** Como evaluador, quiero calificar los subfactores de los factores relevantes, para que el sistema calcule la Ponderación Media y la clasificación FODA.

**Descripción:** El evaluador selecciona cada factor relevante y califica sus subfactores de 1 a 4 con un solo clic por subfactor. Es la mejora de "calificación más fácil" que pidió la especialista del caso de estudio (tesis, pág. 107), frente al prototipo original, que necesitaba al menos tres clics y un botón "Guardar" por factor.

**Precondiciones:** Deben haberse configurado los factores y determinado cuáles son relevantes.

**Flujo principal**
1. El sistema muestra únicamente factores relevantes, con su progreso (subfactores calificados / total) y su PM.
2. El evaluador selecciona un factor.
3. Visualiza sus subfactores, todos "sin calificar".
4. Califica cada uno con un clic en 4 botones con etiqueta (No cumple / Desconozco / Cumple parcialmente / Cumple).
5. Cada calificación se guarda automáticamente.
6. Al completar el factor, el sistema calcula su PM y su clasificación FODA.
7. El sistema indica qué factores relevantes faltan por completar.

**Flujos alternativos / excepciones**
1. No se permiten valores fuera de 1–4.
2. Si falta una calificación, la PM no se considera válida.
3. Un factor irrelevante no aparece para ser calificado.
4. Cambiar de factor no pierde las calificaciones ya hechas.

**Criterios de aceptación**
- **CA-01:** Solo aparecen factores relevantes.
- **CA-02:** Cada subfactor se califica con un clic en 4 botones con etiqueta; no hay sliders.
- **CA-03:** No existe botón "Guardar" por factor: el guardado es automático.
- **CA-04:** PM solo es válida cuando todos los subfactores están calificados.
- **CA-05:** Se genera la clasificación FODA del factor al completarlo.
- **CA-06:** El proceso proporciona retroalimentación inmediata y muestra el progreso.

**Reglas de negocio:** RN-01, RN-02, RN-12, RN-13.

**Requerimientos relacionados:** RF-PUB-04; RNF-01, RNF-06, RNF-07.

---

## US-11 — Resultado FODA y dictamen final

- **Prioridad:** Alta
- **Sprint:** Sprint 3

**Historia de usuario:** Como evaluador, quiero visualizar la matriz FODA y obtener el dictamen final A, B o C, para conocer el resultado de la evaluación realizada.

**Descripción:** El sistema consolida los resultados obtenidos durante la evaluación y genera el dictamen matemático final.

**Precondiciones:** Todos los factores relevantes deben estar evaluados (PM válida) para poder generar el dictamen.

**Flujo principal**
1. El sistema muestra los factores relevantes con su IR y su PM.
2. Muestra el ámbito utilizado.
3. Clasifica cada factor en la matriz FODA (cuatro cuadrantes).
4. El evaluador solicita el dictamen.
5. El motor matemático genera A (Adoptar), B (Es posible adoptar, con matices) o C (Analizar y posponer la adopción).
6. El sistema presenta el texto metodológico y una recomendación personalizada que nombra los factores causantes con su IR, PM y FODA, y los subfactores que no cumplen.
7. Si la IA está activada, se muestran por separado el resumen ejecutivo y, si el dictamen es B o C, el plan de mitigación.

**Flujos alternativos / excepciones**
1. Mientras falte algún factor relevante por evaluar, el botón de dictamen está bloqueado y se indica qué falta.
2. Los factores irrelevantes no participan.
3. El dictamen matemático no depende de la IA.

**Criterios de aceptación**
- **CA-01:** Se muestra la matriz FODA completa.
- **CA-02:** Se diferencian resultados positivos y negativos con color y texto.
- **CA-03:** Se genera un dictamen A/B/C según las reglas metodológicas (C prevalece sobre B).
- **CA-04:** La recomendación nombra los factores que causan el dictamen (mejora pedida por la especialista, tesis pág. 107).
- **CA-05:** No se genera dictamen mientras falte algún factor relevante por evaluar.
- **CA-06:** El cálculo matemático no depende del servicio de IA.
- **CA-07:** El progreso puede mantenerse durante la sesión del navegador.

**Reglas de negocio:** RN-01, RN-03, RN-04, RN-13, RN-14.

**Requerimientos relacionados:** RF-PUB-05, RF-PUB-06, RF-PUB-07; RNF-01, RNF-06, RNF-08.

---

## US-12 — Historial y exportación de evaluaciones

- **Prioridad:** Alta
- **Sprint:** Sprint 4

**Historia de usuario:** Como administrador, quiero consultar y filtrar el historial de evaluaciones y exportar sus resultados, para realizar seguimiento y análisis de las evaluaciones realizadas.

**Descripción:** Permite consultar evaluaciones registradas, visualizar su información en modo lectura y exportar información en CSV o PDF.

**Precondiciones:** Debe existir una sesión administrativa válida y evaluaciones registradas.

**Flujo principal**
1. El administrador accede al historial.
2. Consulta las evaluaciones.
3. Filtra por software, organización, dictamen, fechas y estado.
4. Selecciona una evaluación.
5. Visualiza su detalle en modo solo lectura.
6. Puede exportar el listado filtrado a CSV.
7. Puede exportar una evaluación individual a PDF.

**Flujos alternativos / excepciones**
1. Si no existen resultados para los filtros, se muestra el estado correspondiente.
2. El detalle no puede modificarse desde esta vista.
3. Las evaluaciones finalizadas mantienen sus datos históricos.

**Criterios de aceptación**
- **CA-01:** El historial permite filtrar por software, organización, dictamen, fechas y estado.
- **CA-02:** El detalle es de solo lectura.
- **CA-03:** Se muestran IS, ID, IR, ámbitos, subfactores, FODA y dictamen.
- **CA-04:** Se puede exportar el listado filtrado en CSV.
- **CA-05:** Se puede exportar una evaluación individual en PDF.
- **CA-06:** Las evaluaciones históricas conservan sus snapshots.

**Reglas de negocio:** RN-08 — Inmutabilidad histórica mediante snapshot.

**Requerimientos relacionados:** RF-ADM-21, RF-ADM-34, RF-ADM-35, RF-ADM-36; RNF-02, RNF-09.

---

## US-13 — Asistencia de IA durante la evaluación

- **Prioridad:** Alta
- **Sprint:** Sprint 4

**Historia de usuario:** Como evaluador, quiero recibir sugerencias de IA para la Importancia del Decisor y las calificaciones de subfactores, para disponer de información de apoyo durante la evaluación.

**Descripción:** La IA puede sugerir valores para ID y para los subfactores cuando el evaluador activa la asistencia y proporciona información contextual suficiente. **La IA solo sugiere:** el evaluador acepta, cambia o ignora cada sugerencia, y la IA nunca rellena valores por su cuenta.

**Precondiciones:** El interruptor "Activar asistencia IA" del registro está encendido, lo que exige descripción de la organización o enlace al repositorio.

**Flujo principal**
1. En el registro, el evaluador proporciona descripción o repositorio y enciende "Activar asistencia IA".
2. En el Paso 1-2, el evaluador solicita sugerencias.
3. La IA devuelve una ID sugerida para cada factor, con justificación breve.
4. Cada sugerencia se muestra junto a su control, diferenciada visualmente, con Aceptar / Cambiar / Ignorar; el control sigue "sin calificar" hasta que el evaluador decide.
5. En el Paso 3-4, el evaluador puede solicitar sugerencias de calificación (1 a 4, con justificación) para los subfactores de un factor, con las mismas acciones.
6. El sistema guarda el valor elegido por el evaluador, la sugerencia, su justificación y si se aceptó sin cambios.

**Flujos alternativos / excepciones**
1. Si no hay descripción ni repositorio, el interruptor no puede encenderse.
2. Con el interruptor apagado, el sistema funciona completo en modo manual.
3. Si la IA falla o supera los 30 segundos, se informa al evaluador y continúa en modo manual.
4. Si la respuesta no cumple el JSON esperado, se descarta.
5. Cambiar una sugerencia antes de aceptarla hace que no se registre como aceptada sin cambios.

**Criterios de aceptación**
- **CA-01:** El interruptor solo se habilita cuando existe descripción o repositorio.
- **CA-02:** Se generan sugerencias de ID para los factores, cada una con justificación.
- **CA-03:** Ninguna sugerencia se aplica sin una acción explícita del evaluador.
- **CA-04:** Las sugerencias se distinguen visualmente de los valores elegidos por el evaluador.
- **CA-05:** El evaluador puede aceptar, cambiar o ignorar cada sugerencia.
- **CA-06:** Se generan sugerencias para subfactores cuando se solicitan.
- **CA-07:** Se persisten el valor elegido, la sugerencia, la justificación y si se aceptó sin cambios.
- **CA-08:** Un error o timeout de IA no interrumpe la evaluación ni cambia el dictamen.
- **CA-09:** Las pruebas automáticas usan un proveedor de IA falso (mock), sin llamadas reales.

**Reglas de negocio:** RN-05 — Las sugerencias de IA son orientativas; RN-12; RN-14.

**Requerimientos relacionados:** RF-IA-01, RF-IA-02, RF-IA-03, RF-IA-05, RF-IA-06, RF-IA-07; RNF-03, RNF-05, RNF-13, RNF-16, RNF-17, RNF-18, RNF-19.

---

## US-14 — Resumen ejecutivo y plan de mitigación mediante IA

- **Prioridad:** Alta
- **Sprint:** Sprint 4

**Historia de usuario:** Como evaluador, quiero obtener un resumen ejecutivo y, cuando corresponda, un plan de mitigación generado por IA, para complementar la interpretación del resultado de la evaluación.

**Descripción:** Después de obtener el dictamen matemático, el sistema puede enviar los resultados de la matriz FODA a la IA para generar un resumen ejecutivo y, para dictámenes B o C, un plan de mitigación relacionado con los factores negativos. Complementa la recomendación personalizada; el dictamen matemático no cambia.

**Precondiciones:** Debe existir un dictamen matemático generado. La IA debe estar habilitada para generar el contenido correspondiente.

**Flujo principal**
1. El motor genera el dictamen matemático.
2. El sistema comprueba si la IA está habilitada.
3. Envía la matriz FODA, los factores que causan el dictamen y el dictamen al servicio de IA.
4. Recibe el resumen ejecutivo.
5. Si el dictamen es B o C, recibe también el plan de mitigación.
6. Valida la respuesta.
7. Muestra la información diferenciada del resultado matemático.
8. Registra la asistencia realizada.

**Flujos alternativos / excepciones**
1. Si la IA no está disponible, el dictamen matemático permanece disponible.
2. Si se produce timeout, se informa al evaluador y se mantiene el resultado matemático.
3. Si la respuesta no cumple el formato esperado, se descarta.
4. Si el dictamen es A, no se genera plan de mitigación.

**Criterios de aceptación**
- **CA-01:** El resumen ejecutivo se genera después del dictamen cuando la IA está habilitada.
- **CA-02:** El resumen se presenta separado del dictamen matemático.
- **CA-03:** Para dictámenes B o C se genera un plan de mitigación.
- **CA-04:** El plan contiene acciones relacionadas con factores negativos.
- **CA-05:** Un error de IA no modifica el dictamen matemático.
- **CA-06:** Las respuestas son validadas antes de mostrarse.
- **CA-07:** La interacción con IA queda registrada en AIAssistanceLog.

**Reglas de negocio:** RN-03, RN-04, RN-05, RN-14.

**Requerimientos relacionados:** RF-PUB-05, RF-IA-04, RF-IA-05, RF-IA-06; RNF-03, RNF-05, RNF-13, RNF-19.