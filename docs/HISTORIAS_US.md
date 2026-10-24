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
3. Si no existe ninguna PM, no se emite dictamen.
4. Los cálculos no deben depender de la disponibilidad de IA.

**Criterios de aceptación**
- **CA-01:** El motor calcula IR de manera determinista.
- **CA-02:** La escala utilizada es 1–4.
- **CA-03:** PM solo se calcula con todos los subfactores calificados.
- **CA-04:** El umbral positivo de FODA es PM ≥ 3.0.
- **CA-05:** Se aplican las reglas de dictamen A/B/C definidas en la metodología.
- **CA-06:** El motor puede ejecutarse sin componentes visuales.
- **CA-07:** El motor no depende del servicio de IA.
- **CA-08:** Se realizan pruebas unitarias para las reglas matemáticas.

**Reglas de negocio:** RN-01, RN-02, RN-03, RN-04.

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

**Descripción:** El evaluador configura mediante sliders la importancia de cada uno de los 18 factores y el sistema calcula la Importancia Relativa.

**Precondiciones:** Debe existir una evaluación iniciada y un catálogo activo.

**Flujo principal**
1. El sistema muestra los 18 factores.
2. Muestra la IS en solo lectura.
3. El evaluador asigna ID mediante slider de 1 a 4.
4. El sistema calcula IR inmediatamente.
5. Determina los factores relevantes.
6. Los factores irrelevantes son excluidos de las siguientes etapas.

**Flujos alternativos / excepciones**
1. No se pueden introducir valores fuera de 1–4.
2. El ámbito solo puede modificarse para Soporte.
3. Los factores con IR = Irrelevante no pasan a la calificación de subfactores.

**Criterios de aceptación**
- **CA-01:** Se muestran los 18 factores activos.
- **CA-02:** ID utiliza valores de 1 a 4.
- **CA-03:** IR se recalcula automáticamente.
- **CA-04:** El recálculo se realiza en menos de 100 ms.
- **CA-05:** Solo Soporte permite modificar su ámbito.
- **CA-06:** Los factores irrelevantes son filtrados automáticamente.

**Reglas de negocio:** RN-01, RN-06.

**Requerimientos relacionados:** RF-PUB-02, RF-PUB-03; RNF-01, RNF-06, RNF-07.

---

## US-10 — Evaluación de subfactores

- **Prioridad:** Alta
- **Sprint:** Sprint 3

**Historia de usuario:** Como evaluador, quiero calificar los subfactores de los factores relevantes, para que el sistema calcule la Ponderación Media y la clasificación FODA.

**Descripción:** El evaluador selecciona cada factor relevante y asigna una calificación de 1 a 4 a sus subfactores.

**Precondiciones:** Deben haberse configurado los factores y determinado cuáles son relevantes.

**Flujo principal**
1. El sistema muestra únicamente factores relevantes.
2. El evaluador selecciona un factor.
3. Visualiza sus subfactores.
4. Asigna una calificación de 1 a 4 a cada uno.
5. Presiona Guardar.
6. El sistema calcula PM.
7. Determina la clasificación FODA provisional.
8. Muestra la PM en el selector.

**Flujos alternativos / excepciones**
1. No se permiten valores fuera de 1–4.
2. Si falta una calificación, la PM no se considera válida.
3. Un factor irrelevante no aparece para ser calificado.

**Criterios de aceptación**
- **CA-01:** Solo aparecen factores relevantes.
- **CA-02:** Cada subfactor posee un slider de 1–4.
- **CA-03:** Guardar calcula PM.
- **CA-04:** PM solo es válida cuando todos los subfactores están calificados.
- **CA-05:** Se genera clasificación FODA provisional.
- **CA-06:** El proceso proporciona retroalimentación inmediata.

**Reglas de negocio:** RN-01, RN-02.

**Requerimientos relacionados:** RF-PUB-04; RNF-01, RNF-06, RNF-07.

---

## US-11 — Resultado FODA y dictamen final

- **Prioridad:** Alta
- **Sprint:** Sprint 3

**Historia de usuario:** Como evaluador, quiero visualizar la matriz FODA y obtener el dictamen final A, B o C, para conocer el resultado de la evaluación realizada.

**Descripción:** El sistema consolida los resultados obtenidos durante la evaluación y genera el dictamen matemático final.

**Precondiciones:** Deben existir factores evaluados con PM válida para poder generar el dictamen.

**Flujo principal**
1. El sistema muestra todos los factores y sus PM.
2. Muestra el ámbito utilizado.
3. Clasifica cada factor en la matriz FODA.
4. El evaluador solicita el dictamen.
5. El motor matemático genera A, B o C.
6. El sistema presenta la explicación correspondiente.
7. Si corresponde, posteriormente se muestra información generada por IA.

**Flujos alternativos / excepciones**
1. Si no existe ninguna PM, no se genera dictamen.
2. Los factores irrelevantes no participan.
3. El dictamen matemático no depende de la IA.

**Criterios de aceptación**
- **CA-01:** Se muestra la matriz FODA completa.
- **CA-02:** Se diferencian visualmente resultados positivos y negativos.
- **CA-03:** Se genera un dictamen A/B/C según las reglas metodológicas.
- **CA-04:** Se muestra una explicación del resultado.
- **CA-05:** No se genera dictamen si no existe ninguna PM.
- **CA-06:** El cálculo matemático no depende del servicio de IA.
- **CA-07:** El progreso puede mantenerse durante la sesión del navegador.

**Reglas de negocio:** RN-01, RN-03, RN-04.

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

**Descripción:** La IA puede sugerir valores para ID y para los subfactores cuando el evaluador proporciona información contextual suficiente. Las sugerencias son orientativas y pueden modificarse.

**Precondiciones:** Debe existir descripción de la organización o enlace al repositorio para habilitar la IA.

**Flujo principal**
1. El evaluador proporciona descripción o repositorio.
2. El sistema habilita la IA.
3. El evaluador solicita sugerencias.
4. La IA devuelve ID para los 18 factores con justificación.
5. Los valores se cargan en los sliders.
6. El evaluador puede modificarlos.
7. En los pasos de subfactores puede solicitar nuevas sugerencias.
8. Guarda los valores finales.

**Flujos alternativos / excepciones**
1. Si no hay descripción ni repositorio, la IA permanece deshabilitada.
2. Si la IA falla, el evaluador puede continuar manualmente.
3. Si supera los 30 segundos, se activa el mecanismo de degradación.
4. Si la respuesta no cumple el JSON esperado, se descarta.
5. Modificar manualmente una sugerencia hace que deje de identificarse como sugerencia aceptada.

**Criterios de aceptación**
- **CA-01:** La IA solo se habilita cuando existe descripción o repositorio.
- **CA-02:** Se generan sugerencias de ID para los 18 factores.
- **CA-03:** Cada sugerencia incluye justificación.
- **CA-04:** Las sugerencias se distinguen visualmente de los valores manuales.
- **CA-05:** El evaluador puede modificar cualquier sugerencia.
- **CA-06:** Se generan sugerencias para subfactores cuando se solicita.
- **CA-07:** Se persiste el valor final guardado por el evaluador.
- **CA-08:** Un error o timeout de IA no interrumpe la evaluación.

**Reglas de negocio:** RN-05 — Las sugerencias de IA son orientativas.

**Requerimientos relacionados:** RF-IA-01, RF-IA-02, RF-IA-03, RF-IA-05, RF-IA-06; RNF-03, RNF-05, RNF-13, RNF-16, RNF-17, RNF-18, RNF-19.

---

## US-14 — Resumen ejecutivo y plan de mitigación mediante IA

- **Prioridad:** Alta
- **Sprint:** Sprint 4

**Historia de usuario:** Como evaluador, quiero obtener un resumen ejecutivo y, cuando corresponda, un plan de mitigación generado por IA, para complementar la interpretación del resultado de la evaluación.

**Descripción:** Después de obtener el dictamen matemático, el sistema puede enviar los resultados de la matriz FODA a la IA para generar un resumen ejecutivo y, para dictámenes A o B, un plan de mitigación relacionado con los factores negativos.

**Precondiciones:** Debe existir un dictamen matemático generado. La IA debe estar habilitada para generar el contenido correspondiente.

**Flujo principal**
1. El motor genera el dictamen matemático.
2. El sistema comprueba si la IA está habilitada.
3. Envía la matriz FODA y el dictamen al servicio de IA.
4. Recibe el resumen ejecutivo.
5. Si el dictamen es A o B, recibe también el plan de mitigación.
6. Valida la respuesta.
7. Muestra la información diferenciada del resultado matemático.
8. Registra la asistencia realizada.

**Flujos alternativos / excepciones**
1. Si la IA no está disponible, el dictamen matemático permanece disponible.
2. Si se produce timeout, se informa al evaluador y se mantiene el resultado matemático.
3. Si la respuesta no cumple el formato esperado, se descarta.
4. Si el dictamen no es A o B, no se genera plan de mitigación.

**Criterios de aceptación**
- **CA-01:** El resumen ejecutivo se genera después del dictamen cuando la IA está habilitada.
- **CA-02:** El resumen se presenta separado del dictamen matemático.
- **CA-03:** Para dictámenes A o B se genera un plan de mitigación.
- **CA-04:** El plan contiene acciones relacionadas con factores negativos.
- **CA-05:** Un error de IA no modifica el dictamen matemático.
- **CA-06:** Las respuestas son validadas antes de mostrarse.
- **CA-07:** La interacción con IA queda registrada en AIAssistanceLog.

**Reglas de negocio:** RN-03, RN-04, RN-05.

**Requerimientos relacionados:** RF-PUB-05, RF-IA-04, RF-IA-05, RF-IA-06; RNF-03, RNF-05, RNF-13, RNF-19.