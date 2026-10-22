# GUIOS PRO — guía para agentes

`CLAUDE.md` y `AGENTS.md` son idénticos: si cambias uno, copia el otro.

## Fuentes y prioridad

Si dos fuentes se contradicen: **tesis > `docs/` > código > `guiosad.html`**.

- Tesis: Rea Sánchez (2022). Se cita por página impresa (PDF = página + 1).
- `docs/`: `REQUISITOS.md`, `DATABASE.md` (estado objetivo de los modelos), `HISTORIAS_US.md`,
  `catalogo_guios.json` (3 dimensiones / 18 factores / 61 subfactores) y
  `ANALISIS_GUIOS_ORIGINAL.md` (§8 plan por pasos, §9 decisiones P1–P8).
- `docs/tesis/*.md` **no es fiable** (resumen con errores, hallazgo R-05). No usarlo para programar.
- `guiosad.html` es el prototipo original: solo referencia, con errores de datos conocidos.

## Reglas de GUIOS ya decididas

- IS = Importancia **Sugerida** (Tabla 5.3, sin recalcular). Escala 1–4: Irrelevante, Opcional,
  Importante, Fundamental. Sin pesos por dimensión.
- IR = ⌊(IS + ID) ÷ 2⌋ con índices 0–3 (matriz de la Fig. 5.10). Factor relevante si IR > 1.
- PM = media de las calificaciones (1–4) de los subfactores del factor, con `Decimal`.
  Cumple si PM ≥ 3.00.
- FODA siempre derivada: interno + cumple = Fortaleza, interno + no cumple = Debilidad,
  externo + cumple = Oportunidad, externo + no cumple = Amenaza. Solo "Soporte" tiene ámbito
  configurable.
- Dictamen: **A** Adoptar, **B** Adoptar con matices, **C** Posponer. C si hay un factor
  negativo con IR 3 o 4; B si solo los hay con IR 2; A si no hay negativos. C prevalece sobre B.
  Caso UNEMI/LibreOffice → **C**.
- Se puede guardar avance, pero no hay dictamen hasta evaluar **todos** los factores relevantes.
- Todo arranca "sin calificar" (nulo). La IS se muestra como referencia; la ID la elige el usuario.
- Snapshots (IS, nombre del factor, texto del subfactor) protegen el historial. `PROTECT` en el
  catálogo: no se borra lo que tiene hijos o evaluaciones.
- IA: opcional, al final (Pasos 9–10). Solo sugiere; nunca rellena valores ni decide el dictamen.
  Tests solo con proveedor falso. La clave va en `.env`. Proveedor aún sin decidir (P8).

## Comandos (comprobados en esta copia, Python 3.12, Node 22)

```sh
python3.12 -m venv venv && ./venv/bin/pip install -r requirements.txt   # Windows: py -3.12 -m venv venv
./venv/bin/python backend/manage.py check
./venv/bin/python backend/manage.py makemigrations --check --dry-run
./venv/bin/python backend/manage.py test            # desde la raíz; no necesita Redis
./venv/bin/python backend/manage.py seed_guios_catalog [--dry-run]   # catálogo base (tras migrate)
cd frontend && npm ci && npm run lint && npm run build
```

Cobertura del motor (debe ser 100 %):

```sh
./venv/bin/coverage run --branch --include="*/guios/services/engine.py" backend/manage.py test apps.guios.tests.test_engine
./venv/bin/coverage report -m --fail-under=100
```

```bat
venv\Scripts\coverage run --branch --include="*/guios/services/engine.py" backend\manage.py test apps.guios.tests.test_engine
venv\Scripts\coverage report -m --fail-under=100
```

`npm install`/`npm ci` activa el hook `.githooks/pre-push`, que corre check, migraciones, tests, lint y build.

## Estructura del backend

Django en `backend/` (`config/` y `apps/`). Cada app separa capas:

- `models/`: un modelo por archivo, exportado en `models/__init__.py`.
- `selectors/`: consultas de solo lectura.
- `services/`: lógica y escrituras. El motor de cálculo de GUIOS es puro (sin Django ni IA).
- `api/`: `serializers/`, `views/` y `urls.py` (DRF). Las vistas no llevan lógica de negocio.

El trabajo de GUIOS va en `apps/guios`. **No tocar `apps/auth` ni `apps/core`** salvo que el
paso lo pida.

## Diseño

Pantallas de referencia en `docs/prototipo/` (leer su `README.md`). Frontend real: React 19 +
TypeScript + Tailwind 4. Si una pantalla contradice la tesis o las decisiones, mandan estas.

## Forma de trabajo

1. Un paso del plan (`ANALISIS_GUIOS_ORIGINAL.md` §8) a la vez.
2. Antes de empezar, presentar la lista de archivos que se van a tocar y esperar confirmación.
3. Cerrar el paso con sus pruebas y todos los comandos de arriba pasando.
4. Commit y push **solo a la rama de trabajo**, nunca a `master`. El equipo revisa y une con un PR.
