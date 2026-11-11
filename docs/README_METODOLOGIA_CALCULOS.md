# GUIOS — Metodología de cálculo de importancias, PM, FODA y dictamen

> Documento elaborado a partir de la lectura del código fuente (sin ejecutar nada).
> Cada afirmación indica el archivo donde se implementa, para poder sustentarla.
>
> Código base: `backend/apps/guios/services/calculations/` (una fórmula por archivo)
> y `backend/apps/guios/services/methodology.py` (orquestación y persistencia).

---

## 0. Vista general del pipeline

```
FASE 0 (automática, Celery + IA)
  Citas por subfactor ──► r_i (razón por factor) ──► Cuartiles Q1..Q4 ──► IL (Imp. Literatura)
  IL  +  IE (Imp. Experto, catálogo) ──Matriz──► IS (Imp. Sugerida)

FASE 1 (decisor)
  ID (Imp. del Decisor, 1-4) +  IS ──Matriz──► IR (Imp. Relativa)
  IR > 1  ⇒  el factor es RELEVANTE y pasa a la Fase 2
  IR = 1  ⇒  el factor se DESCARTA

FASE 2 (solo factores relevantes)
  Calificaciones PS (1-4) de cada subfactor ──promedio──► PM del factor
  PM ≥ 3.0 ⇒ cumple.   Ámbito (interno/externo) + cumple ⇒ cuadrante FODA

FASE 3
  Fallos (PM < 3.0) + IR del factor ⇒ Dictamen A / B / C
```

Siglas:

| Sigla | Nombre | Rango | Quién la define |
|---|---|---|---|
| `TC_i` | Total de citas del factor *i* | entero ≥ 0 | IA (fuentes verificables) o catálogo |
| `NS_i` | Nº de subfactores activos del factor *i* | ≥ 1 | Catálogo |
| `r_i` | Razón de citas del factor *i* | decimal ≥ 0 | Calculado |
| `Q1..Q4` | Cortes de cuartil de la evaluación | decimal | Calculado |
| `IL` | Importancia de la Literatura | 1–4 | Calculado |
| `IE` | Importancia del Experto | 1–4 | Catálogo (`Factor.expert_importance`, de encuestas de la tesis) |
| `IS` | Importancia Sugerida (a.k.a. sistémica) | 1–4 | Calculado `M(IE, IL)` |
| `ID` | Importancia del Decisor | 1–4 | Usuario (la IA solo sugiere) |
| `IR` | Importancia Relativa | 1–4 | Calculado `M(ID, IS)` |
| `PS_j` | Puntaje del subfactor *j* | 1–4 | Usuario (la IA solo sugiere) |
| `PM` | Ponderación Media del factor | 1.0–4.0 | Calculado |

Escala común de importancia: **1 = Irrelevante, 2 = Opcional, 3 = Importante, 4 = Fundamental**.
Escala de calificación de subfactores: **1 = No cumple, 2 = Desconozco si cumple, 3 = Cumple parcialmente, 4 = Cumple**.

---

## 1. Razón de citas `r_i` (Ecuación 5.1)

Archivo: `calculations/citation_ratio.py`

```
r_i = TC_i / NS_i
```

- `TC_i` = suma de las citas de todos los subfactores **activos** del factor.
- `NS_i` = cantidad de subfactores activos (si fuera 0 el factor se omite: `methodology.py`, línea ~115).
- Se cuantiza a 4 decimales con redondeo half-up.

### ¿De dónde salen las citas de cada subfactor?

1. **Con OpenAlex e IA** (`literature/openalex.py` y `ai/literature_evidence.py`):
   - En la Fase 0 (segundo plano con Celery), `OpenAlexClient` busca publicaciones académicas reales indexadas con DOI mediante una estrategia progresiva de 4 etapas, extracción de nombre raíz (`extract_root_software_name`) y verificación de relevancia temática en títulos y abstracts (`_is_relevant_work`).
   - El LLM (Azure OpenAI / Groq) recibe los abstracts y DOIs auténticos y realiza el mapeo semántico multi-criterio sobre los 61 subfactores del catálogo.
   - El sistema **cuenta** las fuentes válidas y sanitizadas, asignando los identificadores DOI reales.
   - Se descartan: títulos de ejemplo, `example.com/localhost`, DOIs sintéticos o de muestra, títulos < 8 caracteres,
     extractos < 12 caracteres, y fuentes sin URL real ni DOI formal con formato `10.xxxx/...`.
   - Se deduplican por (subfactor, DOI o URL): la misma obra cuenta una sola vez por subfactor,
     pero puede sustentar varios subfactores diferentes si su abstract lo amerita.
   - El campo `citations_count` que envíe el modelo se **ignora** explícitamente en favor de las fuentes reales contabilizadas.
   - Queda registrado con `evidence_origin = "openalex"`.
2. **Degradación Elegante y Contingencia Heurística**:
   - Si OpenAlex no retorna resultados indexados para software emergente, el LLM recurre a documentación técnica oficial y repositorios públicos (`evidence_origin = "model"`).
   - Si los proveedores de IA no responden (`ai/heuristic_provider.py`), se usa `base_citations_count` del catálogo base de la tesis (`evidence_origin = "catalog_baseline"`).

> Para sustentar: la importancia de literatura es **verificable y auditable** — cada cita es una fuente
> guardada en `ai_literature_sources` con DOI navegable, no una alucinación del modelo.

---

## 2. Cuartiles de la evaluación (`Q1..Q4`)

Archivos: `calculations/quartiles.py` y `calculations/literature_thresholds.py`

Se calculan **sobre las `r_i` de todos los factores de esa evaluación** (los cortes son relativos al
conjunto, no valores fijos).

### 2.1 Cuartiles estándar (interpolación lineal, método tipo 7 de R / NumPy)

Con las razones ordenadas de menor a mayor y `N` valores:

```
posición = (N − 1) · p        p ∈ {0.25, 0.50, 0.75}
Q_p = (1 − peso)·v[piso] + peso·v[techo]      (interpolación)
Q4  = máximo de la serie
```

Casos borde: lista vacía ⇒ (0,0,0,0); un solo valor ⇒ los cuatro cortes valen ese valor.

### 2.2 Corrección por exceso de ceros (`literature_thresholds.py`)

Si **al menos la mitad** de las razones son 0 **y** hay ≥ 2 razones positivas:

- `Q1 = 0` (los factores sin citas quedan siempre en IL = 1)
- `Q2, Q3, Q4` se calculan **solo con las razones positivas** (usando los Q1, Q3 y máx. de ese subconjunto).

Motivo: si 10 de 18 razones fueran 0, Q1 y Q2 valdrían ambos 0 y el nivel IL = 2 (`Q1 < r ≤ Q2`) sería imposible. Esta salvaguarda lo evita.
En caso contrario se usan los cuartiles estándar.

> `calculate_literature_thresholds(values, strict_thesis_mode=False)`: con `strict_thesis_mode=True` se aplican
> los cuartiles de la tesis sobre todas las razones, sin tratar los ceros. Con los datos de la Tabla 5.3
> (mínimo 1.0, sin ceros) ambos modos dan exactamente el mismo resultado.
>
> Las razones usadas para cuartiles e IL se calculan con 10 decimales (se guardan con 4) para reproducir
> los cortes de la tesis: q1 = 1.8636, q2 = 3.6500, q3 = 4.78125, q4 = 12.0.

---

## 3. Importancia de la Literatura `IL` (Ecuación 5.2)

Archivo: `calculations/literature_importance.py`

| Condición | IL | Etiqueta |
|---|---|---|
| `r_i ≤ Q1` | 1 | Irrelevante |
| `Q1 < r_i ≤ Q2` | 2 | Opcional |
| `Q2 < r_i ≤ Q3` | 3 | Importante |
| `Q3 < r_i ≤ Q4` | 4 | Fundamental |

(`r_i > Q4` es imposible porque `Q4` es el máximo; el código devuelve 4 por seguridad.)

**Ejemplo.** Razones `[0, 0, 1, 2, 4]` (5 factores): Q1 = 0, Q2 = 1, Q3 = 2, Q4 = 4 →
IL = `[1, 1, 2, 3, 4]`.

Ejemplo con los umbrales de la evaluación de Moodle (Q1 = 0.1, Q2 = 0.7, Q3 = 1.0):
r = 0.05 → IL 1; r = 0.5 → IL 2; r = 0.9 → IL 3; r > 1.0 → IL 4.

---

## 4. Matriz de combinación (Figura 5.10) — operador `M(a, b)`

Archivo: `calculations/matrix.py`. Es **simétrica**: `M(a,b) = M(b,a)`.

| fila \ columna | 1 | 2 | 3 | 4 |
|:---:|:---:|:---:|:---:|:---:|
| **1** | 1 | 1 | 2 | 2 |
| **2** | 1 | 2 | 2 | 3 |
| **3** | 2 | 2 | 3 | 3 |
| **4** | 2 | 3 | 3 | 4 |

Se usa dos veces:

- `IS = M(IE, IL)` — `calculations/suggested_importance.py`
- `IR = M(ID, IS)` — `calculations/relative_importance.py`

Propiedades útiles para la defensa:

- El resultado nunca se aleja más de 1 punto del promedio de las dos entradas (es una "mezcla suavizada").
- **Solo 3 combinaciones dan 1:** `(1,1)`, `(1,2)` y `(2,1)`. Cualquier otra combinación da ≥ 2.
- Solo `(4,4)` da 4.

---

## 5. Importancia Sugerida `IS`

```
IS = M(IE, IL)
```

- `IE` viene del catálogo (`Factor.expert_importance`, tomado de las encuestas a expertos de la tesis; valor por defecto 3).
- `IL` es el calculado en la sección 3.
- Se guarda como *snapshot* en la evaluación (`systemic_importance_snapshot`) para que cambios futuros
  del catálogo no alteren evaluaciones ya hechas (`methodology.py`, `compute_evaluation_literature_metrics`).

Interpretación: combina **lo que dicen los expertos** con **lo que dice la literatura** sobre ese software.

---

## 6. Importancia Relativa `IR` y filtro de relevancia

Archivo: `calculations/relative_importance.py`; aplicación en `methodology.py → apply_step1_decisor_importance`

```
IR = M(ID, IS)
es_relevante = (IR > 1)
```

- `ID` la elige el decisor para cada factor (la IA solo da una sugerencia con justificación, que no se aplica sola).
- Si `IR = 1` el factor se **descarta** (no se califica, no entra a FODA ni al dictamen).
- Si `IR ∈ {2, 3, 4}` el factor **pasa a la Fase 2**.

### 6.1 ¿Por qué un factor con Importancia del Decisor "Irrelevante" (ID = 1) puede pasar a la segunda fase?

Porque el filtro **no mira solo el ID**: mira el **IR = M(ID, IS)**, que combina la opinión del decisor
con la importancia sugerida (expertos + literatura). Con ID = 1:

| IS (sugerida) | `M(1, IS)` = IR | ¿Pasa? |
|:---:|:---:|:---:|
| 1 | 1 | ❌ Se descarta |
| 2 | 1 | ❌ Se descarta |
| **3** | **2** | ✅ **Pasa** (IR = 2, "Opcional") |
| **4** | **2** | ✅ **Pasa** (IR = 2, "Opcional") |

Es decir: **si el decisor dice "irrelevante" pero la evidencia (IS) dice "importante" o "fundamental",
el factor no se descarta, sino que se degrada a IR = 2 (Opcional)**. Es una decisión de diseño de la
metodología: la opinión de una sola persona no puede, por sí sola, eliminar un criterio que expertos y
literatura consideran importante.

Simétricamente, un decisor que marca un factor como "fundamental" (ID = 4) lo hace pasar siempre
(`M(4, x) ≥ 2`), aunque la literatura lo considere irrelevante (IR = 2).

### 6.2 Consecuencia en el dictamen (importante para la defensa)

Un factor que pasó **solo gracias a la evidencia** y con ID = 1 queda con IR = 2 como máximo. Por tanto:

- Si falla (PM < 3.0), **solo puede producir Recomendación B** (nunca C), porque C exige IR ≥ 3.
- Su peso en el veredicto queda acotado: es un "aviso", no un bloqueo.

Esto equilibra los dos riesgos: no ignorar evidencia fuerte, pero no dejar que un criterio poco valorado
por el decisor hunda la adopción.

---

## 7. Ponderación Media `PM` (Fase 2)

Archivo: `calculations/weighted_average.py`; aplicación en `methodology.py → apply_step3_subfactor_ratings_and_foda`

```
PM_i = redondeo_half_up( Σ PS_j / NS_i , 1 decimal )
```

- `PS_j` ∈ {1,2,3,4} (se limita al rango 1–4 al guardar).
- Solo se calcula para factores **relevantes** (IR > 1).
- **Regla RN-02:** si algún subfactor activo del factor no tiene calificación, **no se calcula PM** y se borra
  cualquier resultado previo de ese factor. Así no se emiten dictámenes sobre datos incompletos.
- **Umbral de adopción: `PM ≥ 3.0`** (constante fija `ADOPTION_THRESHOLD`).
- Se compara el valor **ya redondeado a 1 decimal**: un promedio de 2.95 se redondea a 3.0 y **cumple**.
- La calificación 2 ("Desconozco") entra al promedio con valor 2: la incertidumbre **resta**, no se ignora.

**Ejemplo:** subfactores con PS = `[4, 3, 3, 2]` → 12/4 = 3.0 → cumple. PS = `[4, 3, 2, 2]` → 11/4 = 2.75 → 2.8 → no cumple.

---

## 8. Análisis FODA

Archivo: `calculations/foda.py`

El cuadrante se decide con dos datos: **PM** (¿cumple o no?) y **ámbito** del factor (interno o externo).

| | Interno | Externo |
|---|:---:|:---:|
| **PM ≥ 3.0** | Fortaleza (F) | Oportunidad (O) |
| **PM < 3.0** | Debilidad (D) | Amenaza (A) |

- El ámbito por defecto es `Factor.scope` (interno/externo). Solo el factor **"Soporte"**
  (`scope_configurable`) lo puede cambiar el decisor.
- Si el ámbito es `both` y no se eligió, el snapshot lo trata como **interno** (`methodology.py`, ~línea 161).
  Cualquier ámbito distinto de `internal` se trata como externo al clasificar.
- **Solo los factores relevantes (IR > 1) aparecen en el FODA.** Por eso el balance
  "14 favorables · 4 desfavorables" suma los factores que pasaron el filtro, no todo el catálogo.
- Las expresiones del tipo `PM ≥ 3.0` en la interfaz son el criterio de clasificación, no un dato calculado.

---

## 9. Dictamen final A / B / C

Archivo: `calculations/verdict.py`

Sobre los factores relevantes: `fallos` = PM < 3.0 (Debilidad o Amenaza) y `positivos` = PM ≥ 3.0 (Fortaleza u Oportunidad).

| Situación | Recomendación |
|---|---|
| `fallos = 0` | **A** — Adoptar sin observaciones |
| Hay fallos, **todos** con IR = 2, y `fallos ≤ positivos` | **B** — Adoptar con matices (plan de acción preventivo) |
| **Algún** fallo con IR ≥ 3, **O BIEN** `fallos > positivos` | **C** — Analizar la adopción y posponerla |

- La regla de C es un **OR**: p. ej., en el caso LibreOffice (Figura 6.5) hay 11 positivos y 7 fallos (no superan), pero hay
  fallos con IR = 3 (Personalización, Formación, Soporte), por lo que el dictamen es C.
- Un factor con IR = 1 ya no existe en este punto (fue descartado), por lo que no puede afectar el dictamen.
- IR = 3 e IR = 4 pesan igual para pasar a C (el umbral es "≥ 3").
- El texto explicativo es **determinista** (generado por plantilla); la IA solo redacta el resumen
  ejecutivo y el plan de mitigación, sin modificar la recomendación.

**Ejemplo (Moodle, tu captura):** hubo fallos en *Usabilidad* (Amenaza, PM 2.8, IR 3) y *Apoyo de alta
dirección* (Debilidad, PM 2.0, IR 3). Como ambos tienen IR ≥ 3 ⇒ **Recomendación C**.

---

## 10. Ejemplo completo de punta a punta

Factor *X* con 4 subfactores, `IE = 3`, con razones del conjunto que dan `Q1 = 0.1, Q2 = 0.7, Q3 = 1.0`.

1. Citas del factor: 3 ⇒ `r = 3 / 4 = 0.75`.
2. `0.7 < 0.75 ≤ 1.0` ⇒ **IL = 3**.
3. `IS = M(IE=3, IL=3) = 3`.
4. Decisor marca `ID = 1` (irrelevante) ⇒ `IR = M(1, 3) = 2` ⇒ **relevante** (pasa).
5. Calificaciones `PS = [4, 3, 3, 2]` ⇒ `PM = 3.0` ⇒ cumple.
6. Ámbito interno ⇒ **Fortaleza**.
7. Al cumplir no aporta fallos al dictamen.

Variante: si las calificaciones fueran `[3, 2, 3, 2]` ⇒ PM = 2.5 ⇒ no cumple ⇒ **Debilidad** con IR = 2 ⇒
contribuiría a una **Recomendación B**, salvo que los fallos superen en número a los positivos (entonces C).

---

## 11. Puntos a tener presentes al sustentar (limitaciones honestas)

1. **Los cuartiles son relativos al conjunto de factores.** Un factor "fundamental" en literatura lo es
   *respecto a los demás factores de esa evaluación*, no en términos absolutos.
2. **La IL depende de la calidad de las fuentes que encuentre la IA.** Si el modelo encuentra pocas, hay
   muchos ceros y se activa la corrección de la sección 2.2. Con contingencia local se usa el conteo del catálogo.
3. **La matriz es una convención de la metodología** (Figura 5.10 de la tesis); el código la reproduce tal cual.
   No es derivable matemáticamente: se justifica por la tesis, no por una fórmula.
4. **`IE` se guarda como entero en el catálogo** (`Factor.expert_importance`, por defecto 3; la tesis tiene IE = 3 en los 18
   factores, y los valores revisados del seed coinciden, pero conviene verificar el seed completo). No hay tablas de encuestas de
   expertos; la función `calculate_expert_importance(ratings)`
   (`calculations/expert_importance.py`) implementa la media y el redondeo half-up de la p. 86 (3.5 → 4) para cuando existan.
5. **PM usa promedio simple:** todos los subfactores pesan igual dentro de su factor.
6. **El umbral 3.0 es fijo** y se aplica sobre el valor redondeado a 1 decimal.
7. **La IA solo sugiere** `ID` y `PS`; los valores que cuentan son los que confirma el usuario.

---

## 12. Mapa rápido de archivos

| Concepto | Archivo |
|---|---|
| `r_i` | `backend/apps/guios/services/calculations/citation_ratio.py` |
| Cuartiles | `.../calculations/quartiles.py`, `.../calculations/literature_thresholds.py` |
| `IL` | `.../calculations/literature_importance.py` |
| Matriz `M` | `.../calculations/matrix.py` |
| `IS` | `.../calculations/suggested_importance.py` |
| `IR` y relevancia | `.../calculations/relative_importance.py` |
| `PM` y umbral | `.../calculations/weighted_average.py` |
| FODA | `.../calculations/foda.py` |
| Dictamen A/B/C | `.../calculations/verdict.py` |
| Conteo de citas con IA | `backend/apps/guios/services/ai/literature_evidence.py` |
| Orquestación y snapshots | `backend/apps/guios/services/methodology.py` |
| Tarea asíncrona (Celery) | `backend/apps/guios/tasks.py` |
