# Análisis del prototipo original GUIOSAD (`guiosad.html`) frente a la tesis y al repositorio GUIOS PRO

**Proyecto:** GUIOS PRO — Grupo 4, UNEMI
**Fase:** análisis previo. No se modificó código.
**Entregables relacionados:** [`docs/catalogo_guios.json`](catalogo_guios.json)

---

## 0. Fuentes y convenciones

| Fuente | Identificación | Cómo se cita |
| :--- | :--- | :--- |
| Tesis (fuente de verdad) | Rea Sánchez, V. H. (2022), *Factores para la adopción de soluciones basadas en software libre*, Univ. de Sevilla | **p. N** = página **impresa**. En el visor PDF es N + 1 (p. ej., la Tabla 5.3 está en la p. 88 impresa, que es la p. 89 del PDF). |
| Prototipo original | `guiosad.html`, 9 454 líneas, MD5 `267c5b7e503e5f6f3f1779cb34c88600` (idéntico al adjunto) | **l. N** = línea del HTML |
| Repositorio | rama `master`, commit `a01236c` | `ruta/archivo:línea` |

Si dos fuentes se contradicen, se aplica este orden: **tesis > `docs/` > código del repo > `guiosad.html`**.

Nomenclatura que usa la tesis (Tabla 5.2, p. 86): **IE** Importancia del Experto, **IL** Importancia de la Literatura, **IS** Importancia **Sugerida**, **ID** Importancia del Decisor, **IR** Importancia Relativa, **PS** Ponderación del Subfactor, **PM** Ponderación Media del factor.

---

## 1. Resumen ejecutivo

1. **Las fórmulas de `guiosad.html` son correctas.** El cálculo de IR (`floor((IS+ID)/2)` con índices 0–3) equivale exactamente a la matriz de la Fig. 5.10; se verificaron las 16 celdas. La PM, la clasificación FODA (Ec. 5.3) y la regla A/B/C reproducen el resultado del caso UNEMI (Recomendación **C**).
2. **Los datos tienen errores.** La IS de **Usabilidad** (3 en lugar de 2) y la de **Apoyo de la alta dirección** (2 en lugar de 3) no coinciden con la Tabla 5.3. Hay 3 textos de subfactores alterados y el catálogo está escrito directamente en el JavaScript.
3. **La lógica y la interfaz tienen fallos que debemos corregir.** Los controles arrancan en "Irrelevante" y en "No cumple". La FODA no se recalcula si se cambia el ámbito o la ID. Se puede emitir el dictamen sin haber evaluado todos los factores relevantes. Los subfactores se etiquetan con la escala equivocada. No hay persistencia. Hay código muerto, y las variables de los textos del dictamen tienen los nombres cruzados (`ra` contiene la "Recomendación C").
4. **Confirmado: el dictamen A/C está invertido** en `docs/REQUISITOS.md`, `docs/DATABASE.md`, `docs/HISTORIAS_US.md` y `evaluation_verdict.py`. La causa más probable es el punto 3: quien leyó `guiosad.html` asumió que `ra` era la Recomendación A.
5. **Confirmado: `apps/auth/api/permissions.py` contiene código de otro sistema** (`HasObjectPermission`, con lógica de ventas, cajas y deudas). No se usa en ningún sitio e importa un módulo que no existe (`apps.cashregister`).
6. **Hallazgos nuevos en el repositorio:**
   - `docs/` y los modelos llaman a la IS "Importancia **Sistémica**"; la tesis dice "Importancia **Sugerida**".
   - `Factor.dimension` y `Subfactor.factor` usan `CASCADE`, lo que contradice RF-ADM-31/32.
   - Los resúmenes `docs/tesis/*.md` contienen errores graves. Por ejemplo, dicen que el caso UNEMI dio Recomendación A, cuando la tesis dice C.
7. **Qué existe en el repositorio:** los modelos de dominio (9), su admin y la migración `0001` (las tablas están vacías). **No hay** API, motor de cálculo, *seed* del catálogo, tests ni frontend de GUIOS.
8. **El catálogo cuadra: 3 dimensiones, 18 factores y 61 subfactores (40 / 19 / 2).** Para que cuadre hay que reasignar un subfactor de "Apoyo de la alta dirección" a "Actitud hacia el cambio", tal como hacen la Tabla 5.3 y la Fig. 5.8 (detalle en §4, T-01).
9. **La regla exacta de la Recomendación C es ambigua en la tesis.** El texto de la p. 105 (que compara cantidades) contradice el caso de estudio de la p. 104. **Resuelto (decisión P1):** C si hay al menos un factor negativo con IR Importante o Fundamental; C prevalece sobre B.

---

## 2. Cómo funciona `guiosad.html`

### 2.1 Tecnología y empaquetado

- Es una aplicación **Flexx 0.8** (Python transpilado a JavaScript) **exportada como HTML estático** (`flexx.is_exported = true`, l. 9426). No usa servidor, base de datos ni `localStorage`: **al recargar la página se pierde todo**.
- Las líneas 1 a ~8 860 son la librería Flexx (CSS, event loop y widgets). La aplicación está en el módulo `__main__`:
  - datos embebidos en l. 8877–8885;
  - `MainWidget.init` en l. 8905;
  - reacciones en l. 9138–9411.
- Al cargar, unos comandos BSDF en base64 (l. ~9428–9433) instancian `MainWidget` con el título **"GUIOSAD v. 0.1.2"**, el mismo que aparece en la captura de la Fig. 6.2 (p. 98).

### 2.2 Datos embebidos

| Variable | Línea | Contenido |
| :--- | :---: | :--- |
| `all_factors`, `factors_lbls` | 8877–8878 | 18 nombres de factor, en el orden de la Fig. 6.2 |
| `the_factor_global_weigth` | 8879 | PM por factor (inicia en 1; solo se escribe) |
| `the_factors_suggested_importance` | 8880 | IS por factor, de 1 a 4 |
| `the_importance_levels` | 8881 | Irrelevante, Opcional, Importante, Fundamental |
| `the_scopes` | 8882 | Ámbito: Externo / Interno / Ambos (Ambos solo en Soporte) |
| `the_subfactor_importance_levels` | 8883 | No cumple / Desconozco / Cumple parcialmente / Cumple |
| `the_subfactors` | 8884 | 61 textos de subfactor agrupados por factor |
| `the_subfactors_importance` | 8885 | Calificaciones guardadas (todas inician en 1) |

### 2.3 Pantallas y flujo

La aplicación tiene **3 pestañas**, cada una con dos pasos de la guía (Fig. 6.1, p. 96):

1. **"Paso 1 y 2. Obtención de factores relevantes"** (l. 8930). Muestra una fila por factor con estas columnas:
   - **Factor**;
   - **Imp. Sugerida** (solo lectura);
   - **Evaluación**: *slider* de 1 a 4 que **arranca en 1** (l. 8962);
   - **Imp. Decisor**: texto de la ID;
   - **Imp. Relativa**: texto de la IR;
   - **Alcance**: texto fijo, salvo en Soporte, que tiene un *ComboBox* Interno/Externo con **Interno preseleccionado** (l. 8995).
2. **"Paso 3 y 4. Obtención de factores ponderados"** (l. 9020). Tiene un *ComboBox* con los factores relevantes (l. 9028) y un botón **Guardar**. Cada subfactor del factor elegido tiene un *slider* de 1 a 4 y una etiqueta.
3. **"Paso 5 y 6. Evaluación y recomendación"** (l. 9062). Muestra por factor: Ponderación media (1 decimal), Alcance y FODA (en color). Abajo están el botón **Ver recomendación** y un cuadro de texto con el resultado.

Cada acción del usuario dispara una reacción distinta:

| Acción del usuario | Reacción | Líneas |
| :--- | :--- | :---: |
| Mueve cualquier *slider* | `update_results` (modo *auto*: se re-ejecuta ante cualquier cambio en lo que lee) | 9148–9223 |
| Elige un factor en el combo | `_combo_text_changed`: destruye y recrea los *sliders* de subfactores | 9225–9264 |
| Pulsa **Guardar** | `btn_sub_pressed`: calcula la PM y la FODA de ese factor | 9266–9308 |
| Pulsa **Ver recomendación** | `compute_recommendation` | 9310–9411 |

### 2.4 Cálculos, uno por uno

| # | Cálculo | Código (`guiosad.html`) | Tesis | ¿Coincide? |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **ID** | valor del *slider* (1–4) | Tabla 5.2, p. 86 | Sí |
| 2 | **IR** | `r = Math.floor((idx(IS) + idx(ID)) / 2)`, con idx de 0 a 3 (l. 9168–9170) | Matriz de la Fig. 5.10, p. 89 | **Sí** (ver tabla siguiente) |
| 3 | **Relevante** | `r > 0`, es decir, IR ≠ Irrelevante (l. 9172) | Tabla 5.2 ("IR > 1"), p. 86; Paso 2, p. 95 | Sí |
| 4 | **PM** | `suma(PS) / n_subfactores` (l. 9269–9276); se muestra con 1 decimal (l. 9279) | Sección 5.2.3, punto 4b, p. 89 | Sí |
| 5 | **FODA** | Interno: PM ≥ 3 → Fortaleza, si no Debilidad. Otro: PM ≥ 3 → Oportunidad, si no Amenaza (l. 9286–9302) | Ec. 5.3, p. 91 | Sí |
| 6 | **Dictamen** | Ver el detalle a continuación (l. 9310–9411) | pp. 104–106 | Sí con el caso de estudio; ambiguo con el texto (T-04) |

**Comprobación de la IR.** La tabla muestra la IR que da `floor` para cada combinación; coincide celda a celda con la Fig. 5.10.

| ID \ IS | 1 | 2 | 3 | 4 |
| :---: | :---: | :---: | :---: | :---: |
| **4 Fundamental** | 2 | 3 | 3 | 4 |
| **3 Importante** | 2 | 2 | 3 | 3 |
| **2 Opcional** | 1 | 2 | 2 | 3 |
| **1 Irrelevante** | 1 | 1 | 2 | 2 |

Consecuencia práctica: **un factor con IS = Importante siempre es relevante**, porque aunque el decisor le ponga ID = 1, su IR queda en Opcional.

**Detalle del dictamen** (`compute_recommendation`):

1. Toma solo los factores cuya celda FODA no está vacía ni dice "Subfactores no evaluados." (l. 9327). Lee esos valores **de los textos de la interfaz**, no de un modelo de datos.
2. Calcula una regla de mayoría (Fortalezas + Oportunidades frente a Debilidades + Amenazas) en l. 9372–9380. **Ese resultado se descarta** más abajo: es código muerto.
3. Recorre los factores evaluados:
   - `a = true` si alguno es negativo (Amenaza o Debilidad) con IR Importante o Fundamental;
   - `b = true` si alguno es negativo con IR Opcional.
4. Si `a` → muestra el texto `ra`, que es la **"Recomendación C"**. Si no y `b` → `rb`, **"Recomendación B"**. En otro caso → `rc`, **"Recomendación A"** (l. 9317–9319 y 9396–9404).
5. Si no hay ningún factor evaluado, el texto queda vacío (l. 9406).

La regla efectiva es:

> **C** si hay al menos un factor negativo con IR ≥ Importante · si no, **B** si hay algún negativo (todos con IR Opcional) · si no hay negativos, **A**.

### 2.5 Ejemplo resuelto: caso UNEMI con LibreOffice (servirá como *fixture* de pruebas)

Datos leídos de la Fig. 6.3 (p. 102: IS, ID, IR y ámbito) y de la Fig. 6.5 (p. 104: PM y FODA). La columna "IR con IS de la tesis" es el resultado de corregir la IS según la Tabla 5.3.

| Factor | IS tesis | IS guiosad | ID | IR (Fig. 6.3) | IR con IS de la tesis | PM (Fig. 6.5) | Ámbito | FODA |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Compatibilidad | 3 | 3 | 4 | Importante | Importante | 3.8 | Ext | Oportunidad |
| Personalización | 3 | 3 | 3 | Importante | Importante | 1.7 | Ext | **Amenaza** |
| Prueba | 3 | 3 | 3 | Importante | Importante | 3.0 | Ext | Oportunidad |
| Fiabilidad | 3 | 3 | 3 | Importante | Importante | 3.2 | Ext | Oportunidad |
| Reusabilidad | 2 | 2 | 2 | Opcional | Opcional | 3.0 | Ext | Oportunidad |
| Usabilidad | **2** | **3** | 3 | Importante | **Opcional** | 3.5 | Ext | Oportunidad |
| Mantenibilidad | 3 | 3 | 3 | Importante | Importante | 4.0 | Ext | Oportunidad |
| Portabilidad | 2 | 2 | 3 | Opcional | Opcional | 2.0 | Ext | Amenaza |
| Documentación | 2 | 2 | 3 | Opcional | Opcional | 2.4 | Ext | Amenaza |
| Formación | 3 | 3 | 3 | Importante | Importante | 2.8 (= 2.75) | Int | **Debilidad** |
| Tiempo de adopción | 2 | 2 | 2 | Opcional | Opcional | 3.5 | Int | Fortaleza |
| Casos de estudio | 2 | 2 | 2 | Opcional | Opcional | 3.0 | Ext | Oportunidad |
| Centralidad de TI | 2 | 2 | 2 | Opcional | Opcional | 2.5 | Int | Debilidad |
| Apoyo alta dirección | **3** | **2** | 3 | Opcional | **Importante** | 4.0 | Int | Fortaleza |
| Bloqueo de proveedores | 2 | 2 | 2 | Opcional | Opcional | 2.0 | Ext | Amenaza |
| Soporte | 3 | 3 | 4 | Importante | Importante | 2.3 | Int (elegido) | **Debilidad** |
| Actitud hacia el cambio | 2 | 2 | 2 | Opcional | Opcional | 3.0 | Int | Fortaleza |
| Coste total de propiedad | 3 | 3 | 3 | Importante | Importante | 3.5 | Int | Fortaleza |

Cómo leer el resultado:

- **Hay 11 factores positivos y 7 negativos.** Tres de los negativos tienen IR Importante (Personalización, Formación y Soporte), así que la regla del código da **C**, que es lo que reporta la tesis (Fig. 6.5).
- **Con la IS correcta de la Tabla 5.3 el resultado sigue siendo C**: Usabilidad y Apoyo cambian de IR, pero ambos son positivos.
- **La regla de mayoría del texto de la p. 105 no reproduce el caso**: con 11 positivos frente a 7 negativos habría dado "adoptar".
- Comprobación de la PM: en la Fig. 6.4 (p. 103), Compatibilidad tiene 7 subfactores en "Cumple" (4) y 1 en "Desconozco" (2). Eso da 30/8 = 3.75, que se muestra como 3.8. Coincide.

---

## 3. Errores y diferencias de `guiosad.html` frente a la tesis

Severidad: **Alta** = produce resultados incorrectos o engañosos. **Media** = degrada la confianza o la usabilidad. **Baja** = mantenibilidad o estética.

### 3.1 Errores de cálculo y de lógica

| ID | Hallazgo | Evidencia en la tesis | Evidencia en el HTML | Sev. | Qué haremos |
| :--- | :--- | :--- | :--- | :---: | :--- |
| C-01 | **Se emite el dictamen sin evaluar todos los factores relevantes.** Basta guardar 1 factor positivo para obtener "Recomendación A". | El Paso 3 dice "por cada factor seleccionado … el decisor deberá evaluar" (p. 96). El Paso 6 recibe los factores ya clasificados en FODA (p. 97). | l. 9327 ignora en silencio los factores sin FODA | Alta | Bloquear el dictamen hasta que todos los factores relevantes tengan PM (ampliar RN-04, §9 P2). |
| C-02 | **La FODA queda desactualizada.** Ámbito y FODA se congelan al pulsar Guardar. Si luego cambia el ámbito de Soporte o la ID, la pantalla 3 no se actualiza. Si un factor pasa a irrelevante y vuelve a ser relevante, muestra "Subfactores no evaluados." aunque su PM sigue guardada. | La FODA depende de la PM y del ámbito actuales (Ec. 5.3, p. 91) | l. 9280–9302 y l. 9208–9220 | Alta | Derivar siempre la FODA de los datos; no guardar estados calculados en la interfaz. |
| C-03 | El dictamen se calcula **leyendo los textos de la interfaz** (l. 9324–9330 y 9356–9370), no un modelo de datos. Es la causa de C-02. | — | ídem | Media | Motor puro y separado de la interfaz (RNF-12). |
| C-04 | **Las variables del dictamen tienen los nombres cruzados:** `ra` contiene "Recomendación C" y `rc` contiene "Recomendación A". Lo que se muestra es correcto, pero el código induce a error. | A = adoptar (p. 104 y Fig. 6.6, p. 106); C = posponer (p. 105 y Fig. 6.5) | l. 9317–9319 y 9396–9404 | Alta (por su impacto en `docs/`) | Usar constantes con el nombre de cada recomendación. |
| C-05 | **Regla de C distinta del texto de la tesis.** El código usa "negativo con IR ≥ Importante"; el texto habla de "amenazas y debilidades mayores que oportunidades y fortalezas". | p. 105 frente al caso de la p. 104 | l. 9383–9394 | Media | Pendiente de confirmar (§4 T-04 y §9 P1). |
| C-06 | **Código muerto o roto en el dictamen:** la regla de mayoría se calcula y se descarta (l. 9372–9380). `a, b, c = False` se transpiló como `false[0]` (l. 9381–9382): en Python habría lanzado `TypeError` y en JavaScript funciona por casualidad. `the_global_imp` indexa con un decimal y no se usa (l. 9278). | — | citadas | Baja | No portar nada de esto. |
| C-07 | **La PM se muestra con 1 decimal pero se compara sin redondear.** Formación (2.75) aparece como "2.8" y aun así es Debilidad (Fig. 6.5). Esto confunde al usuario. | p. 104 | l. 9279 | Baja | Mostrar 2 decimales o indicar explícitamente "< 3". |
| C-08 | **"No sé" (valor 2) entra al promedio como 2,** así que desconocer un dato equivale casi a incumplirlo. *No es un error*: así lo define la escala. | p. 89 (4a) | l. 9269–9276 | Info | Explicarlo en la ayuda del Paso 3-4. |

### 3.2 Errores de datos

| ID | Hallazgo | Evidencia en la tesis | Evidencia en el HTML | Sev. | Qué haremos |
| :--- | :--- | :--- | :--- | :---: | :--- |
| D-01 | **IS de Usabilidad = 3 (Importante).** La tesis da IE 3 e IL 2, lo que resulta en **IS 2 (Opcional)**. | Tabla 5.3, p. 88 | l. 8880, posición 6 | Alta | Cargar la IS desde la Tabla 5.3 (`catalogo_guios.json`). |
| D-02 | **IS de Apoyo de la alta dirección = 2 (Opcional).** La tesis da IL 4, lo que resulta en **IS 3 (Importante)**. | Tabla 5.3, p. 88 | l. 8880, posición 14 | Alta | ídem. |
| — | *Nota:* el prototipo de la propia tesis ya tenía D-01 y D-02 (Fig. 6.2, p. 98, y Fig. 6.3, p. 102). | | | | |
| D-03 | **Tres textos de subfactor alterados:** TEC-PER-02 escribe "fácilmente" con acento combinado (`a`+U+0301), que falla en búsquedas y comparaciones. TEC-PER-04 dice "modificar el códigofuente" en lugar de "actualizar el código fuente". ORG-CAS-01 omite "de organizaciones similares". | Tabla 5.1, pp. 75 y 79; Figs. 5.7 y 5.8 | l. 8884 | Media | Usar los textos del JSON. |
| D-04 | **Erratas heredadas de la tesis:** "alternativa **patentada**" en lugar de "propietaria" (TCO-02). "El software es **una sistemas** de administración de base de datos independiente" es una mala traducción de "DBMS independent" (POR-02). La Fig. 5.7 dice "desplegar" y la Tabla 5.1 dice "instalar" (PRU-01). | Figs. 5.7 y 5.9 frente a la Tabla 5.1 y el Apéndice A | l. 8884 | Media | Decidir qué texto mostrar (§9 P3). |
| D-05 | **El catálogo está escrito directamente en el JavaScript.** Para cambiar un factor hay que editar el código. | La tesis lo señala como limitación (p. 113) | l. 8877–8885 | Alta | Catálogo en la base de datos (RNF-14) y CRUD desde el panel (RF-ADM-31..33). |
| D-06 | **La etiqueta del valor 2 no es la de la tesis:** el HTML dice "Desconozco si cumple requisito"; la tesis dice "No sé"; REQUISITOS dice "Desconozco si cumple el requisito". | p. 89 | l. 8883 | Baja | Unificar (propuesta: el texto de REQUISITOS). |
| D-07 | **Los nombres de los factores varían entre tablas:** Reutilización/Reusabilidad, Mantenimiento/Mantenibilidad, TCO/Coste total de propiedad, Soporte de alta dirección/Apoyo de la alta dirección. | Tablas 5.1 y 5.3 | l. 8877 | Baja | Usar los nombres de la Tabla 5.3 y guardar los otros como alias (ya está en el JSON). |
| D-08 | El subfactor del personal de TI está en **Actitud hacia el cambio**. *Correcto*: el HTML sigue la Tabla 5.3 y la Fig. 5.8, no la Tabla 5.1. | §4 T-01 | l. 8884, bloque 17 | — | Mantener. |

### 3.3 Problemas de diseño y UX

| ID | Hallazgo | Evidencia | Sev. | Qué haremos |
| :--- | :--- | :--- | :---: | :--- |
| U-01 | **No hay persistencia ni sesión:** al recargar se pierde todo. | l. 9426 (exportación estática); la tesis lo señala en p. 114 | Alta | RF-PUB-06 (`localStorage`) y guardar la evaluación en el *backend*. |
| U-02 | **Los valores iniciales sesgan el resultado.** La ID arranca en 1 = "Irrelevante" (l. 8962) y los subfactores en 1 = "No cumple" (l. 8885 y 9250). Si se pulsa Guardar sin tocar nada, la PM es 1 y el factor sale negativo. No existe el estado "sin calificar". | La tesis no define valores por defecto | Alta | Estado "sin calificar" obligatorio (§9 P4). |
| U-03 | **Se pierden cambios sin aviso.** Al cambiar de factor en el combo, los *sliders* se destruyen (l. 9234). Además, `update_results` vuelve a llamar a `set_options` y `set_selected_key` en cada cambio (l. 9197–9199), lo que puede regenerar el panel. | Lectura de código | Alta | Guardado automático por subfactor o aviso de cambios sin guardar. |
| U-04 | **Las etiquetas de los subfactores usan la escala de los factores:** al mover un *slider* de subfactor, `update_results` lo etiqueta como Irrelevante…Fundamental (l. 9201–9207). La etiqueta correcta solo aparece tras pulsar Guardar (l. 9273). | p. 89 (escala PS) | Media | Una sola fuente para cada escala. |
| U-05 | **Si el factor seleccionado deja de ser relevante, el Paso 3-4 se rompe.** El combo deja de encontrar la clave, `_combo_text_changed` busca `""` en `all_factors` (l. 9236–9237) y lanza `ValueError`. El panel queda vacío y **Guardar** usa los índices del factor anterior. *Detectado leyendo el código, no ejecutándolo.* | — | Media | La selección del paso 3-4 debe depender del estado de relevancia. |
| U-06 | **La entrada de subfactores es lenta:** se necesitan al menos 3 clics por factor. | La especialista lo señaló (p. 103 y p. 107) | Media | Selector segmentado de 4 opciones por subfactor y guardado automático. |
| U-07 | **No hay indicador de progreso:** el combo no muestra qué factores ya se evaluaron ni su PM, y no existe una vista FODA en cuadrantes. | p. 103 | Media | RF-PUB-04 (PM en el selector) y US-11 (cuadrantes). |
| U-08 | **La recomendación es genérica:** no dice qué factores la provocaron, y la especialista tuvo que volver a pantallas anteriores para entenderla. | p. 103 y p. 107 ("algo genéricos") | Alta | Mostrar los factores causantes con su IR, PM y FODA, y el texto de la tesis. |
| U-09 | **Un solo usuario:** no hay autenticación, historial ni trabajo colaborativo entre decisores. | p. 107 y p. 114 | Media | Historial: RF-ADM-34..36. **Colaboración: trabajo futuro (decisión P6).** La especialista del caso UNEMI la sugiere en la p. 107: *"posibilidad de trabajo colaborativo entre decisores … la decisión de adoptar un software no es responsabilidad de una persona en particular"*. |
| U-10 | **No hay ayuda contextual,** solo un párrafo por pestaña. | RNF-04 y RF-PUB-07 | Media | Modal de ayuda por paso. |
| U-11 | **Código sobrante:** `this.relevants` siempre está vacío (l. 8921 y 9181; son restos de unas casillas). `relevant_factors_lbls` es un alias de `factors_lbls` y lo vacía (l. 8908 y 9151). El mensaje de empate menciona "GUIOSAD" (l. 9378). | — | Baja | No portar. |
| U-12 | **Los resultados se comunican solo por color** (verde/rojo/amarillo), sin un texto o icono alternativo. | — | Baja | Accesibilidad: añadir etiqueta o icono además del color. |

---

## 4. Inconsistencias internas de la tesis y cómo proponemos resolverlas

| ID | Inconsistencia | Evidencia | Propuesta |
| :--- | :--- | :--- | :--- |
| T-01 | El subfactor **"El personal de TI de su organización respalda la adopción de este software"** está en distintos factores según la fuente. | Tabla 5.1 (p. 79): bajo "Soporte de alta dirección". Tabla 5.3 (p. 88): Apoyo NS = 1, Actitud NS = 2. Fig. 5.8 (p. 85): bloque "Acti.". | Asignarlo a **Actitud hacia el cambio**. Así el total es 61 (código `ORG-ACT-02`). |
| T-02 | En Documentación, dos subfactores comparten una misma celda. | Tabla 5.1, p. 77 | Son 11 subfactores (NS = 11 en la Tabla 5.3 y 11 barras en la Fig. 5.7). |
| T-03 | La IS del prototipo (Fig. 6.2) no coincide con la Tabla 5.3 en Usabilidad y Apoyo. | pp. 88 y 98 | **Manda la Tabla 5.3**. |
| T-04 | **La regla para elegir C es ambigua.** El texto describe una comparación de cantidades. El caso de estudio (11 positivos frente a 7 negativos) solo da C con la regla de "negativo en IR ≥ Importante". La definición de B ("debilidades/amenazas en factores de importancia relativa opcional") sí es coherente con esa regla. | p. 105 frente a la Fig. 6.5 (p. 104) | Usar la regla del código: **C** si hay negativo con IR ≥ 3; **B** si hay negativos y todos tienen IR = 2; **A** si no hay negativos. **Requiere confirmación (§9 P1).** |
| T-05 | **La columna TC (total de citas) de la Tabla 5.3 no se puede reproducir.** Sumando las citas de la Tabla 5.1, el total coincide solo en 9 de 18 factores (tabla siguiente). | Tablas 5.1 y 5.3 | Usar **IE, IL e IS tal como los publica la Tabla 5.3** y no recalcularlos (§9 P7). |
| T-06 | En la sección 5.2.3, punto 4, la PS, la PM y la FODA aparecen descritas como partes de la ID. En el Cap. 6 son los pasos 3 a 5. | pp. 89 y 96–97 | Seguir el flujo del Cap. 6 (Fig. 6.1). |
| T-07 | REQUISITOS llama a la IS "Importancia **Sistémica**"; la tesis la llama "Importancia **Sugerida**". | Tabla 5.2, p. 86 | Usar "Sugerida" (§5.2 R-03). |
| T-08 | La IE se describe como "escala discreta con un decimal", pero los ejemplos redondean a entero. | p. 86 | Sin impacto: la IE es 3 en todos los factores (Tabla 5.3). |
| T-09 | La tesis no fija un ámbito por defecto para Soporte; el HTML preselecciona Interno. | pp. 90 y 95 | Que el decisor lo elija explícitamente (§9 P4). |
| T-10 | La licencia de Flexx aparece como AGPL3 en la p. 97 y como 2-BSD en la p. 107. | — | Sin impacto. |

**T-05 en detalle:** comparación entre la suma de las citas de cada subfactor (Tabla 5.1) y el TC publicado (Tabla 5.3). Se calculó por script a partir del JSON.

| Factor | Σ citas (Tabla 5.1) | TC (Tabla 5.3) | ¿Coincide? |
| :--- | :---: | :---: | :---: |
| Compatibilidad | 25 | 33 | No |
| Personalización | 30 | 30 | Sí |
| Fiabilidad | 25 | 19 | No |
| Reusabilidad | 4 | 5 | No |
| Usabilidad | 14 | 14 | Sí |
| Documentación | 23 | 20 | No |
| Mantenibilidad / Portabilidad / Prueba | 4 / 4 / 4 | 4 / 4 / 4 | Sí |
| Soporte | 44 | 43 | No |
| Tiempo de adopción / Centralidad de TI | 2 / 2 | 2 / 2 | Sí |
| Formación | 27 | 27 | Sí |
| Casos de estudio | 2 | 1 | No |
| Apoyo alta dirección | 2 (5 si se cuenta el subfactor movido en T-01) | 5 | Solo con la asignación de la Tabla 5.1 |
| Bloqueo de proveedores | 8 | 3 | No |
| Actitud hacia el cambio | 4 (1 sin el subfactor movido) | 3 | No |
| Coste total de propiedad | 24 | 24 | Sí |

---

## 5. Estado del repositorio

### 5.1 Qué existe

| Área | Estado |
| :--- | :--- |
| Infraestructura (`apps/auth`, `apps/core`) | Completa: usuarios, JWT en *cookie*, 2FA, OTP, roles, permisos por módulo, menús, organización, auditoría y *middleware*. |
| Modelos GUIOS (`apps/guios/models/`) | 9 modelos, admin y migración `0001_initial.py`. Las tablas existen en `db.sqlite3` y están **vacías** (`guios_factor`: 0 filas). |
| API GUIOS | **No existe.** `apps/guios/api/urls.py` está vacío y `config/urls.py` no incluye `guios`. |
| Motor de cálculo, *seed* y tests de GUIOS | **No existen.** |
| Permisos y menús de GUIOS | **No existen.** `setup_permissions.py` y `setup_menus.py` solo cubren el dashboard, los usuarios, la auditoría y la configuración. |
| Frontend GUIOS | **No existe.** `frontend/src/features/` solo tiene auth, dashboard, users, audit y settings. |

### 5.2 Errores confirmados y nuevos

**R-01 — El dictamen A/C está invertido (CONFIRMADO).**
La tesis define: **A = Adoptar** (p. 104; Fig. 6.6, p. 106), **B = Es posible adoptar, con matices** (p. 105), **C = Analizar y posponer la adopción** (p. 105; Fig. 6.5). La lógica del repositorio es correcta (negativo crítico, negativo opcional, ninguno), pero tiene **las letras A y C intercambiadas**, y el plan de mitigación está asociado a "A o B" cuando debería ser "B o C".

| Archivo | Líneas | Qué dice | Qué debe decir |
| :--- | :--- | :--- | :--- |
| `docs/REQUISITOS.md` | 136–149 | A = "No viable…", C = "Adoptar plenamente" | A = adoptar, C = posponer |
| `docs/REQUISITOS.md` | 161 (RF-PUB-05), 285 (RF-IA-04), 370 (US-14) | plan de mitigación si el dictamen es "A o B" | "B o C" |
| `docs/REQUISITOS.md` | 337 (RN-03) | "A tiene prioridad sobre B" | "C tiene prioridad sobre B" |
| `docs/REQUISITOS.md` | 363 (US-07) | "(A prevalece sobre B)" | "(C prevalece sobre B)" |
| `docs/DATABASE.md` | 457, 460–473 | igual que arriba | ídem |
| `docs/HISTORIAS_US.md` | 553, 562, 571, 576 | "A o B" | "B o C" |
| `backend/apps/guios/models/evaluation_verdict.py` | 15–19 (etiquetas), 46 (`help_text`) | A = "No viable sin mitigar riesgos", C = "Adoptar plenamente"; mitigación "(Recomendación A o B)" | A = Adoptar, C = Posponer; mitigación "(B o C)" |

**R-02 — Código sobrante en `apps/auth/api/permissions.py` (CONFIRMADO).**

- **l. 91–160:** `HasObjectPermission` contiene lógica de ventas (`is_sale`), deudas (`is_debt`) y cajas (`is_cash`), con permisos `sales.*`, `debts.*`, `cash.*` y `pos.*`. Además importa `apps.cashregister.services.cash_register` (l. 149), que no existe. **No se usa en ningún sitio** (verificado con grep).
- **l. 16–24:** el *docstring* de `HasModulePermission` usa ejemplos de POS.
- **l. 87–88:** el alias `HasGranularPermission` no se usa.
- **Restos menores (solo comentarios):** `core/api/views/permission_tree_views.py` l. 35–39 y `core/models/modulePermission.py` l. 14–18, 30 y 35.
- **Propuesta:** eliminar `HasObjectPermission` y el alias, y cambiar los ejemplos por permisos de GUIOS (`catalog.*`, `evaluations.*`).

**R-03 — "Importancia Sistémica" en lugar de "Importancia Sugerida" (NUEVO).**
Aparece en `docs/REQUISITOS.md` l. 70 (y en §3.3 y RF-PUB-02), `docs/DATABASE.md` l. 294, 301 y 377, `factor.py` l. 33, `evaluation_factor.py` l. 41, y en los nombres de campo `systemic_importance` y `systemic_importance_snapshot`. La tesis la llama "Importancia **Sugerida**" (Tabla 5.2, p. 86). Hay que decidir si solo se cambian las etiquetas o también los nombres de campo (§9 P5).

**R-04 — `CASCADE` contradice los requisitos (NUEVO).**
`factor.py` l. 21–26 (`dimension`, `on_delete=CASCADE`) y `subfactor.py` l. 10–15 (`factor`, `on_delete=CASCADE`) permiten borrar en cascada. Esto choca con RF-ADM-31 (una dimensión con factores no se puede eliminar) y RF-ADM-32 (un factor con subfactores no se puede eliminar), y con las restricciones que el propio `DATABASE.md` declara. **Propuesta:** usar `PROTECT`.

**R-05 — `docs/tesis/*.md` no es fiable (NUEVO).**

- `README_06…md` l. 99 dice que el caso UNEMI dio **"Recomendación A"**; la tesis dice **C** (Fig. 6.5, p. 104).
- l. 78–80 define A, B y C de forma distinta a las pp. 104–105.
- l. 17–32 cambia el orden de los pasos: pone la IR en el paso 4, cuando la Fig. 6.1 (p. 96) la pone en el paso 1.
- `README_05…md` l. 34, 40 y 45 da 29/26/6 subfactores por dimensión; los reales son **40/19/2**.
- l. 102 menciona un factor "Licencias" que no existe.
- l. 105 aplica la FODA "a cada subfactor"; en la tesis se aplica a cada factor (p. 91).
- Además, varios textos de subfactores son inventados (p. ej., "(ej. ODF)").
- **Propuesta:** marcar esos archivos como "resúmenes no normativos" o reescribirlos. No deben usarse para programar.

**R-06 — Las reglas de completitud son insuficientes (NUEVO).**
RN-04 solo bloquea el dictamen cuando *ningún* factor está evaluado. Equivale a C-01: hay que exigir que **todos los factores relevantes** estén evaluados (§9 P2).

**R-07 — Snapshot incompleto (NUEVO, baja).**
RN-08 guarda una copia de la IS y del texto del subfactor, pero no del **nombre del factor** ni de su dimensión. Si se renombra un factor, el historial cambia. Proponemos añadir `factor_name_snapshot`.

**R-08 — Riesgo de que la IA decida de facto (DISEÑO).**
RF-IA-02 y RF-IA-03 **precargan los *sliders*** con los valores sugeridos por la IA. Si el evaluador acepta todo sin revisar, la IA termina decidiendo el dictamen, y eso contradice la premisa de que "la IA solo sugiere". Propuesta:

- la sugerencia se muestra al lado del control, pero el valor queda "sin calificar" hasta que el humano lo confirme;
- el motor solo usa valores confirmados;
- el dictamen nunca pasa por la IA;
- el resumen y el plan de mitigación se generan *después* del dictamen y se muestran separados de él.

---

## 6. Qué conservar, qué mejorar y qué falta

### Conservar (está bien en `guiosad.html` y coincide con la tesis)

| Elemento | Dónde está en el repo |
| :--- | :--- |
| Flujo en 3 pantallas (pasos 1-2, 3-4 y 5-6) | RF-PUB-02..05 |
| IR calculada con la matriz de la Fig. 5.10 (o con `floor`, que es equivalente). Proponemos implementarla **como tabla** para que sea trazable a la tesis. | REQUISITOS §3.3 (fórmula correcta) |
| PM como promedio, umbral PM ≥ 3 y FODA según la Ec. 5.3 | REQUISITOS §3.3 y §8 |
| Regla A/B/C del código, **con las letras correctas** | Hay que corregir R-01 |
| Textos de las recomendaciones de las Figs. 6.5/6.6 como base de `explanation_text` | `EvaluationVerdict.explanation_text` |
| Transparencia: mostrar IS, ID e IR, y permitir volver atrás (lo valoró la especialista, pp. 106–107) | RF-PUB-02 y RF-ADM-35 |
| Ámbito configurable solo en Soporte | RN-06 y `Factor.scope_configurable` |

### Mejorar

| Elemento | Problema | Cobertura en REQUISITOS |
| :--- | :--- | :--- |
| IS de Usabilidad y Apoyo | D-01, D-02 | No cubierto: el *seed* debe salir de `catalogo_guios.json` |
| Catálogo fuera del código | D-05 | Cubierto (RNF-14) |
| Estado "sin calificar" | U-02 | **No cubierto**: proponemos una nueva regla de negocio |
| FODA siempre derivada de los datos | C-02 | **No cubierto**: proponemos una nueva regla de negocio |
| Dictamen solo con todos los factores relevantes evaluados | C-01, R-06 | Parcial (RN-02, RN-04): ampliar |
| Explicar el dictamen con los factores causantes | U-08 | Parcial (RF-PUB-05): ampliar |
| Entrada de subfactores ágil y guardado automático | U-03, U-06 | Parcial (RF-PUB-04) |
| PM con 2 decimales | C-07 | No cubierto |
| Persistencia | U-01 | Cubierto (RF-PUB-06 y el modelo `Evaluation`) |
| Sugerencias de la IA que requieren confirmación | R-08 | Parcial (RNF-05): ajustar RF-IA-02 y RF-IA-03 |

### Falta (no está en `guiosad.html`)

| Elemento | Origen | Cobertura en REQUISITOS |
| :--- | :--- | :--- |
| Modal de inicio, IA, panel admin, CRUD del catálogo, historial, exportación y auditoría | REQUISITOS; la tesis pide CRUD e historial (pp. 113–114) | Cubierto |
| Evaluación **colaborativa** entre varios decisores | Tesis, p. 107 y p. 114 | **No cubierto** (§9 P6) |
| Guía de acciones concretas para cada debilidad o amenaza | Tesis, p. 115 | Parcial (RF-IA-04). Podría tener una versión determinista: listar los subfactores que no cumplen. |
| "Segunda evaluación" de los subfactores que no cumplen | Tesis, pp. 104–105 (A y B) | Parcial (exportación CSV/PDF, RF-ADM-36) |

---

## 7. Catálogo extraído

El detalle completo está en [`docs/catalogo_guios.json`](catalogo_guios.json). Por cada subfactor incluye: texto de la Tabla 5.1, texto de la encuesta en español (Figs. 5.7–5.9), texto en inglés (Apéndice A), referencias bibliográficas y notas. Por cada factor incluye: NS, TC, IE, IL, IS y ámbito. También contiene las escalas, la matriz de la Fig. 5.10, las reglas FODA, los 4 factores excluidos (p. 74) y los textos de las recomendaciones.

| # | Código | Dimensión | Factor (Tabla 5.3) | IS | Ámbito (Tabla 5.4) | NS |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | TEC-COM | Tecnológica | Compatibilidad | 3 Importante | Externo | 8 |
| 2 | TEC-PER | Tecnológica | Personalización | 3 Importante | Externo | 6 |
| 3 | TEC-FIA | Tecnológica | Fiabilidad | 3 Importante | Externo | 5 |
| 4 | TEC-REU | Tecnológica | Reusabilidad | 2 Opcional | Externo | 2 |
| 5 | TEC-USA | Tecnológica | Usabilidad | 2 Opcional | Externo | 4 |
| 6 | TEC-DOC | Tecnológica | Documentación | 2 Opcional | Externo | 11 |
| 7 | TEC-MAN | Tecnológica | Mantenibilidad | 3 Importante | Externo | 1 |
| 8 | TEC-POR | Tecnológica | Portabilidad | 2 Opcional | Externo | 2 |
| 9 | TEC-PRU | Tecnológica | Prueba | 3 Importante | Externo | 1 |
| 10 | ORG-SOP | Organizacional | Soporte | 3 Importante | **Ambos (configurable)** | 6 |
| 11 | ORG-TIE | Organizacional | Tiempo de adopción | 2 Opcional | Interno | 2 |
| 12 | ORG-FOR | Organizacional | Formación | 3 Importante | Interno | 4 |
| 13 | ORG-CAS | Organizacional | Casos de estudio de adopción FLOSS | 2 Opcional | Externo | 1 |
| 14 | ORG-CEN | Organizacional | Centralidad de la tecnología de la información | 2 Opcional | Interno | 2 |
| 15 | ORG-APO | Organizacional | Apoyo de la alta dirección | 3 Importante | Interno | 1 |
| 16 | ORG-BLO | Organizacional | Bloqueo de proveedores | 2 Opcional | Externo | 1 |
| 17 | ORG-ACT | Organizacional | Actitud hacia el cambio | 2 Opcional | Interno | 2 |
| 18 | ECO-TCO | Económica | Coste total de propiedad | 3 Importante | Interno | 2 |
| | | | **Total** | | | **61** |

**Verificación automática** (script de validación ejecutado sobre el JSON):

- 3 dimensiones, 18 factores y 61 subfactores (TEC 40 · ORG 19 · ECO 2).
- En los 18 factores, el número de subfactores coincide con el NS de la Tabla 5.3.
- En los 18 factores, la IS coincide con lo que da la matriz de la Fig. 5.10 aplicada a (IL, IE).
- El ámbito, el número de subfactores por factor y el orden coinciden con `guiosad.html`. **Solo difieren la IS de 2 factores (D-01, D-02) y 3 textos (D-03).**

**Los conteos cuadran solo con la reasignación T-01.** Si se siguiera literalmente la Tabla 5.1, Apoyo tendría 2 subfactores y Actitud 1. El total seguiría siendo 61, pero no coincidiría con la Tabla 5.3 ni con la Fig. 5.8.

---

## 8. Plan de trabajo final (de lo más básico a lo más complejo)

**Forma de trabajo acordada:** se hace un paso a la vez. Antes de cada paso se presenta la lista de archivos que se van a tocar y se espera la confirmación del equipo. **Cada paso cierra con sus propias pruebas pasando** (no solo el Paso 11). No se hace commit: lo hace el equipo después de revisar.

**Orden:** primero el motor y la evaluación completa **sin IA**, con pruebas. La IA entra al final (pasos 9 y 10) y nunca participa en el dictamen.

**Referencia visual:** las pantallas de `docs/prototipo/` (ver su `README.md`). Cuando una pantalla contradice la tesis o las decisiones de §9, mandan la tesis y las decisiones (p. ej., los controles del prototipo aparecen marcados, pero se decidió que todo arranque "sin calificar").

| Paso | Contenido | Pruebas / criterio de "terminado" |
| :---: | :--- | :--- |
| **1** | **Documentación, catálogo y limpieza** (sin lógica nueva). <br>• `REQUISITOS.md`, `DATABASE.md`, `HISTORIAS_US.md`: letras A/C según la tesis; plan de mitigación para **B y C**; RN-03 "C prevalece sobre B"; "Importancia **Sugerida**"; RN-04 ampliada (dictamen bloqueado hasta evaluar **todos** los factores relevantes, aunque se pueda guardar el avance); reglas nuevas: todo arranca "sin calificar" y la FODA siempre se deriva de los datos; IS visible como referencia; mejoras de la especialista (p. 107); reglas de IA de este plan; colaboración como trabajo futuro. <br>• `catalogo_guios.json`: campo `texto_mostrar` (texto de la encuesta con solo las erratas obvias corregidas, P3) y `pagina_origen` en cada subfactor. <br>• `docs/tesis/*.md`: aviso de "resumen no normativo" con la lista de errores conocidos (R-05). <br>• `permissions.py`: quitar `HasObjectPermission`, el alias y los ejemplos de POS (R-02). | Un grep no encuentra textos invertidos ni "Sistémica"; el script de validación del JSON pasa (3/18/61); los tests de `auth` siguen pasando. |
| **1b** | **Entorno de desarrollo** (antes del Paso 2, para que todo el equipo pueda trabajar). <br>• `.env.example`: quitar la `SECRET_KEY` real y la configuración de "turnos" / puerto 8040; dejar valores de ejemplo para GUIOS. <br>• `README`: exigir Python 3.12 (Django 6 no funciona con 3.11); en Windows, `py -3.12 -m venv venv`. <br>• Redis opcional en desarrollo: si `DEBUG=True` y no hay `REDIS_URL`, usar `LocMemCache` y sesiones en base de datos. <br>• Que `python backend/manage.py test` funcione desde la raíz, y que el CI ejecute los tests y `makemigrations --check`, además de `check`. | `python backend/manage.py test` pasa sin Redis; `manage.py check` y `makemigrations --check` limpios; el *workflow* de CI incluye los tres comandos. |
| **2** | **Modelos y migración `0002`.** <br>• Renombrar `systemic_importance` → `suggested_importance` y `systemic_importance_snapshot` → `suggested_importance_snapshot` (P5). <br>• `PROTECT` en `Factor.dimension` y `Subfactor.factor` (RF-ADM-31 y 32, R-04). <br>• Etiquetas A/B/C correctas y mitigación "(B o C)" en `EvaluationVerdict`. <br>• `factor_name_snapshot` en `EvaluationFactor` (R-07). <br>• Permitir guardar avance "sin calificar" (P4): `decisor_importance`, `relative_importance` e `is_relevant` admiten nulo; `scope_used` admite vacío (ámbito de Soporte sin elegir); `EvaluationSubfactor.rating` admite nulo (sugerencia de IA aún no decidida). Ver `docs/DATABASE.md` §14 y §15. | `makemigrations --check` limpio; tests de modelo: no se puede borrar una dimensión con factores ni un factor con subfactores; rangos 1–4. |
| **3** | **Carga inicial del catálogo.** Comando idempotente `seed_guios_catalog` que lee `docs/catalogo_guios.json` (IS de la Tabla 5.3 sin recalcular, P7) y marca `is_base=True`. | Tests: 3/18/61, IS de cada factor, Soporte con ámbito configurable, ejecutarlo dos veces no duplica. |
| **4** | **Motor de cálculo puro** (`apps/guios/services/`), sin Django ni IA (RNF-12): IR por la matriz de la Fig. 5.10, relevancia (IR > 1), PM con `Decimal`, FODA derivada, completitud y dictamen (C prevalece sobre B, P1). Devuelve también **los factores que causan el dictamen** con su IR, PM y FODA (base de la recomendación personalizada). | Tests: las 16 celdas de la matriz; PM = 3.00 y 2.99; caso **UNEMI → C** (con la IS del prototipo y con la de la tesis) y sus factores causantes (Personalización, Formación, Soporte); casos A y B; incompleto → sin dictamen. Cobertura del 100 % (US-07). |
| **5** | **API pública sin IA** (DRF): catálogo activo (solo lectura, con la IS como referencia), crear evaluación (registro), guardar avance del Paso 1-2 y del Paso 3-4 por subfactor, calcular dictamen, consultar resumen. Sesión anónima por `session_token`. Ver §8.2 (auditoría y sanitización). | Tests de API: rangos 1–4 (RNF-07 y 18), solo Soporte con ámbito configurable, dictamen rechazado si falta algún factor relevante, resultado idéntico al del motor. |
| **6** | **Frontend público sin IA** (pantallas `fig02` a `fig05`): registro, estación de evaluación, resultados y ayuda. Incluye las **dos mejoras pedidas por la especialista (p. 107)**: <br>• **Calificar subfactores más fácil:** 4 botones por subfactor (sin *slider*), guardado automático al elegir, sin botón "Guardar" por factor, progreso visible (factores evaluados y PM en el selector), avisos de lo que falta. <br>• **Recomendación personalizada:** el dictamen nombra los factores que lo causan, con su IR, PM y FODA, y los subfactores que no cumplen; no solo el texto genérico de la tesis. <br>También: todo arranca "sin calificar", la IS se muestra junto a cada factor como referencia, FODA en cuadrantes y persistencia en `localStorage` + *backend*. Ver §8.2 (reutilización, diseño y rutas públicas). | El caso UNEMI cargado a mano produce C y nombra sus 3 factores causantes; recargar la página no pierde datos; el botón de dictamen está bloqueado hasta completar. |
| **7** | **API administrativa:** CRUD del catálogo (respeta `PROTECT` e `is_base`), historial con filtros, exportación CSV/PDF, permisos y menús GUIOS (`setup_permissions`, `setup_menus`), auditoría de cambios, endpoint de métricas para el tablero. Ver §8.2. | Tests de permisos por rol; no se puede borrar algo con evaluaciones. |
| **8** | **Frontend administrativo** (`fig09` a `fig15`): tablero A/B/C, árbol del catálogo, historial y detalle en solo lectura. Sin "peso relativo" por dimensión y con escala 1–4 (ver "Lo que NO hay que copiar" en el README del prototipo). Extiende el `DashboardPage` existente. Ver §8.2. | Pruebas de interfaz de los CRUD y filtros. |
| **9** | **IA en el *backend*** (requiere la decisión de proveedor, §8.1). <br>• Servicio encapsulado con una interfaz `ProveedorIA` y dos implementaciones: el proveedor elegido y un **proveedor falso (mock)** para los tests (RNF-13). <br>• Tres operaciones: (a) Paso 1-2: sugerir la ID de cada factor según el software y el contexto registrados; (b) Paso 3-4: sugerir la calificación 1–4 de cada subfactor con una justificación breve; (c) tras el dictamen: resumen ejecutivo para la alta dirección y, si el dictamen es **B o C**, plan de mitigación de los factores negativos. <br>• Respuestas en JSON validadas con esquema; *timeout* configurable (30 s); si falla, se informa y la evaluación sigue en modo manual (RF-IA-05). <br>• Cada llamada se registra en `AIAssistanceLog`; las sugerencias se guardan en `EvaluationFactor` (`ai_suggested_id`, `ai_id_justification`, `id_was_ai_accepted`) y en `EvaluationSubfactor` (`ai_suggested_rating`, `ai_rating_justification`, `rating_was_ai_accepted`). <br>• La clave de la API va en `.env`, nunca en el código ni en las respuestas (RNF-16). | Tests **solo con el mock**, sin llamadas reales: validación del JSON, *timeout*, error del proveedor y respuesta inválida. **Test clave:** el dictamen es idéntico con la IA apagada, encendida, fallando o devolviendo basura. |
| **10** | **IA en el *frontend*.** Interruptor **"Activar asistencia IA"** en el registro (`fig02`); sin él, el sistema funciona completo. Las sugerencias se muestran **junto** al control, diferenciadas visualmente (RNF-05), con botones **Aceptar / Cambiar / Ignorar**; el valor sigue "sin calificar" hasta que el usuario decide (la IA nunca rellena por su cuenta). El resumen ejecutivo y el plan de mitigación aparecen **separados** del dictamen matemático, como complemento de la recomendación personalizada. | Pruebas de interfaz con el mock: aceptar, cambiar e ignorar; la evaluación completa sin IA sigue funcionando. |
| **11** | **QA final:** prueba de punta a punta del caso UNEMI con y sin IA, rendimiento (RNF-01), accesibilidad (texto además del color, U-12) y revisión final contra la tesis. | Lista de verificación firmada por el equipo. |

**Trabajo futuro (fuera de este plan):** evaluación colaborativa entre varios decisores (P6; sugerida por la especialista en la p. 107 y señalada como limitación en la p. 114).

### 8.1 Proveedor de IA: opciones para decidir (antes del Paso 9)

**Estimación de uso por evaluación completa** (supuesto, a medir en el Paso 9): 1 llamada para el Paso 1-2, ~18 llamadas para el Paso 3-4 (una por factor relevante) y 1 para el resumen y la mitigación. Unos **35 000 tokens de entrada y 30 000 de salida** (la salida incluye el razonamiento interno del modelo).

| Opción | Modelo | Precio por 1 M tokens (entrada / salida) | Costo aprox. por evaluación | Costo aprox. por 100 evaluaciones | Fuente del precio |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **A. Anthropic (recomendada)** | **Claude Sonnet 5.5** | $2.00 / $10.00 | ~$0.37 | ~$37 | Oficial (lista de precios de Anthropic) |
| A'. Anthropic, bajo costo | Claude Haiku 5.5 | $0.10 / $0.50 | ~$0.02 | ~$2 | Oficial |
| A''. Anthropic, máxima calidad | Claude Opus 5.5 | $4.00 / $20.00 | ~$0.74 | ~$74 | Oficial |
| B. Google | Gemini 3.8 Flash | $0.75 / $3.75 hasta el 31/12/2026; luego $1.50 / $7.50 | ~$0.14 (luego ~$0.28) | ~$14 (luego ~$28) | Página de precios de Google Cloud citada por agregadores; **verificar** |
| C. OpenAI | GPT-5.6 Luna | $0.20 / $1.20 | ~$0.04 | ~$4 | Solo agregadores (fuentes contradictorias); **verificar** |

**Recomendación: opción A con Claude Sonnet 5.5.** Motivos:
- Buena calidad de redacción en español para el resumen ejecutivo y el plan de mitigación, que son el texto más visible.
- Salidas JSON estructuradas validadas por esquema (`output_config.format`), lo que simplifica cumplir RF-IA-06.
- SDK oficial de Python (`anthropic`) y precios oficiales verificados.
- Si el costo preocupa, se puede usar Haiku 5.5 para las sugerencias de los pasos 1-4 y Sonnet 5.5 solo para el resumen. Como la interfaz `ProveedorIA` es intercambiable, el cambio de modelo o de proveedor es de configuración.

**Decisión pendiente del equipo:** proveedor y modelo. El Paso 9 no empieza sin ella.

### 8.2 Ajustes acordados para los pasos 5 a 8 (antes del Paso 3)

**Reutilizar lo que ya existe (pasos 6 a 8).** No se crean de nuevo piezas que el repositorio ya tiene:
- Componentes de `frontend/src/components/ui` (Button, Input, Select, Modal, Table, Card, Toggle, Pagination, Skeleton, etc.).
- `MainLayout`, `Sidebar` y `breadcrumbs`; `ModuleGuard` y `PermissionGuard` para el acceso.
- El patrón de datos: `api/*Service.ts` + `api/endpoints.ts` + *stores* de Zustand (`app/`) + *hooks* (`hooks/`).
- `setup_menus` y `setup_permissions` para registrar los módulos y permisos de GUIOS.
- Usuarios, roles, organización, menú, auditoría, perfil, login, 2FA y recuperación de contraseña **ya existen y no se rehacen**.

**Diseño.** Las pantallas nuevas usan el tema y las variables CSS existentes (`frontend/src/index.css`, modo claro y oscuro). `docs/prototipo/` es solo referencia de **estructura y contenido**, no de colores.

**Tablero (pasos 7 y 8).** Se extiende el `DashboardPage` existente con las métricas de GUIOS (dictámenes A/B/C y evaluaciones recientes), alimentadas por un *endpoint* nuevo en `apps/guios`.

**Auditoría (Paso 5).** Las señales de `apps/auth/signals.py` auditan todos los modelos. Se agregan a `IGNORED_MODELS` los modelos de evaluación (`Evaluation`, `EvaluationFactor`, `EvaluationSubfactor`, `EvaluationResult`, `EvaluationVerdict`, `AIAssistanceLog`) para que el guardado automático no llene la auditoría, y el servicio que emite el dictamen registra explícitamente un evento **"dictamen generado"** en `AuditLog` (RF-ADM-37). El catálogo (`Dimension`, `Factor`, `Subfactor`) se sigue auditando. Prueba: guardar avance no crea registros de auditoría; emitir el dictamen crea uno.

**Rutas públicas (Paso 6).** La evaluación pública tiene rutas propias fuera de `/dashboard` y no exige sesión. El interceptor de `api/axios.ts` no debe intentar refrescar el token ni redirigir a `/login` por errores de la API pública de GUIOS (hoy, un 401 dispara el *refresh* y, si falla, hace *logout* y redirige); esos errores se muestran en la propia pantalla. Prueba: un error de la API pública no saca al usuario de la evaluación.

**Sanitización (pasos 5 y 7).** `XSSSanitizationMiddleware` (`apps/core`) pasa cada texto JSON por `nh3.clean(tags=set())`, que quita las etiquetas y además convierte `&`, `<` y `>` en entidades: "B&R" se guarda como "B&amp;R" y "a < b" como "a &lt; b". Eso daña nombres de software, organizaciones y textos del catálogo.
- **Decidido (sin tocar `apps/core`):** en los *serializers* de `apps/guios` usar un campo de texto propio (p. ej. `PlainTextField`) que aplique `html.unescape()` al recibir el valor. El middleware sigue quitando las etiquetas (la protección XSS se mantiene) y GUIOS guarda el texto que escribió el usuario. React escapa al mostrar; las salidas que no pasan por React (exportación PDF/CSV del Paso 7, *prompts* de IA del Paso 9) deben escapar o tratar el texto como datos.
- **Alternativa descartada (tocaba `apps/core`):** que el middleware solo quite etiquetas y no escape `&`, `<` y `>` (o excluir las rutas de GUIOS) y validar en los *serializers*.
- **Pruebas en los pasos 5 y 7:** "B&R Consultores", "a < b", "x > 3" y "Ñandú & Cía." se guardan y se devuelven idénticos; `<script>alert(1)</script>` no se guarda con etiquetas.

---

## 9. Decisiones del equipo (confirmadas)

| # | Pregunta | Decisión |
| :---: | :--- | :--- |
| P1 | Regla de la Recomendación C | **C** si hay al menos un factor negativo (Debilidad o Amenaza) con IR Importante o Fundamental. C prevalece sobre B. Es la regla del documento del Sprint 0. |
| P2 | Completitud del dictamen | Se puede guardar el avance, pero el dictamen se bloquea hasta evaluar todos los factores relevantes. |
| P3 | Texto de los subfactores | Texto de la encuesta (Figs. 5.7–5.9), corrigiendo solo erratas obvias. El JSON anota la página de origen de cada subfactor. |
| P4 | Valores iniciales | Todo arranca "sin calificar". La IS de la guía se muestra junto a cada factor como referencia; la ID la elige el usuario. |
| P5 | "Sistémica" → "Sugerida" | Se renombran también los campos (la base está vacía). |
| P6 | Evaluación colaborativa | Trabajo futuro (la sugiere la especialista en la p. 107). |
| P7 | IS publicada | Se usa la IS de la Tabla 5.3 sin recalcular. |
| P8 | Proveedor de IA | Se decide al llegar al Paso 9 (opciones en §8.1). Hasta entonces se usa solo el proveedor falso (mock). |

---

*Análisis elaborado sin modificar código. Archivos generados: `docs/ANALISIS_GUIOS_ORIGINAL.md` y `docs/catalogo_guios.json`.*
