# GUIOS - Guía Unificada de Interfaz y Operación de Sistemas

Plataforma empresarial de evaluación multicriterio, gestión organizacional y adopción de software libre (FLOSS). Implementa una arquitectura desacoplada de alto rendimiento con backend en **Django REST Framework**, procesamiento asíncrono con **Celery & Redis**, asistencia cognitiva multimodelo (**Azure OpenAI**, **Groq**, **Cohere**), integración bibliométrica científica en tiempo real con **OpenAlex** y frontend reactivo en **React 19** con **Vite**, **TypeScript** y **Tailwind CSS**.

---

## Índice de Contenidos

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Arquitectura y Tecnologías](#2-arquitectura-y-tecnologías)
3. [Módulos Principales](#3-módulos-principales)
4. [Requisitos Previos del Sistema](#4-requisitos-previos-del-sistema)
5. [Clonación del Repositorio](#5-clonación-del-repositorio)
6. [Configuración de Variables de Entorno](#6-configuración-de-variables-de-entorno)
7. [Instalación y Configuración del Backend](#7-instalación-y-configuración-del-backend)
   - [7.1 Creación y activación del entorno virtual](#71-creación-y-activación-del-entorno-virtual)
   - [7.2 Instalación de dependencias Python](#72-instalación-de-dependencias-python)
   - [7.3 Base de datos y migraciones](#73-base-de-datos-y-migraciones)
   - [7.4 Creación de superusuario y carga de catálogos](#74-creación-de-superusuario-y-carga-de-catálogos)
   - [7.5 Servicio de Redis (Broker y Caché)](#75-servicio-de-redis-broker-y-caché)
   - [7.6 Worker de Celery para Tareas de IA](#76-worker-de-celery-para-tareas-de-ia)
   - [7.7 Ejecución del servidor backend (puerto 8050)](#77-ejecución-del-servidor-backend-puerto-8050)
8. [Instalación y Configuración del Frontend](#8-instalación-y-configuración-del-frontend)
   - [8.1 Instalación de paquetes npm](#81-instalación-de-paquetes-npm)
   - [8.2 Configuración del Hook pre-push](#82-configuración-del-hook-pre-push)
   - [8.3 Ejecución del servidor de desarrollo Vite](#83-ejecución-del-servidor-de-desarrollo-vite)
9. [Guía de Ejecución Concurrente en Tres Terminales](#9-guía-de-ejecución-concurrente-en-tres-terminales)
10. [Políticas de Calidad de Código y CI/CD](#10-políticas-de-calidad-de-código-y-cicd)
11. [Estructura del Repositorio](#11-estructura-del-repositorio)

---

## 1. Descripción del Proyecto

**GUIOS** es una herramienta especializada orientada a instituciones públicas, académicas y privadas para evaluar objetivamente la viabilidad técnica, organizacional y económica de adoptar soluciones de **Software Libre y de Código Abierto (FLOSS)**.

El sistema se basa en el marco metodológico multicriterio de GUIOS, estructurado en:
- **3 Dimensiones:** Tecnológica, Organizacional y Económica.
- **18 Factores Clave de Decisión:** Ponderados por la literatura científica indexada y la Importancia del Decisor (ID).
- **96 Subfactores Técnicos Verificables:** Criterios de auditoría evaluados en escala de 1 a 4.
- **Motor Matemático Determinista:** Cálculo matricial de Importancia Relativa (IR), Ponderación Media (PM), Matriz FODA cuadrante a cuadrante y Veredicto de Adopción (Recomendación A, B o C) con Plan de Mitigación auditable.
- **Asistencia Cognitiva Explicable:** Integración con LLMs para asistir al decisor con sugerencias argumentadas y justificaciones técnicas, manteniendo el veredicto 100% determinista y matemático.

---

## 2. Arquitectura y Tecnologías

### Backend
- **Lenguaje:** Python 3.11 / 3.12 / 3.14
- **Framework:** Django 6.0 con Django REST Framework (DRF)
- **Autenticación:** SimpleJWT con cookies seguras HttpOnly, protección CSRF y soporte 2FA (TOTP)
- **Tareas Asíncronas & Caché:** Celery con broker Redis
- **Modelos de Inteligencia Artificial:** Adaptador modular multimodelo para:
  - **Azure OpenAI:** `gpt-5-mini` / `gpt-4o-mini` (Zero Data Retention corporativo)
  - **Groq:** `qwen/qwen3.8-27b` (Inferencia LPU de ultra-baja latencia)
  - **Cohere:** `command-r-plus-08-2024`
  - **Motor Heurístico:** Modo offline de respaldo automático
- **Indexación Científica:** OpenAlex REST API para recopilación de citas y literatura académica
- **Generación de Reportes:** WeasyPrint / ReportLab para Dossier PDF de alta fidelidad editorial y openpyxl para libros de cálculo Excel
- **Base de Datos:** PostgreSQL (con fallback automático a SQLite3 en desarrollo local)

### Frontend
- **Biblioteca:** React 19 con TypeScript
- **Empaquetador & DevServer:** Vite 8 con división de chunks optimizada (*manualChunks*)
- **Enrutamiento:** React Router v7
- **Gestión de Estado Global:** Zustand
- **Estilos & Diseño:** Tailwind CSS v4, Lucide React, Framer Motion
- **Visualización de Datos:** Recharts y Three.js (renderizado 3D interactivo en Landing y Login)
- **Calidad de Código:** ESLint 9 y TypeScript en modo estricto

---

## 3. Módulos Principales

### 3.1 Módulo de Evaluación Pública (Wizard en 3 Fases)
- **Paso 0 (Registro e Historial):** Formulario ergonómico para registrar el software FLOSS y la organización adoptante, selector de IA, consentimientos informados de privacidad (cero PII) e historial local en `localStorage` con buscador en tiempo real, filtros de estado, clonación de datos para nuevas versiones, enlaces compartibles (`?uuid=<uuid>`) y comparador de dos evaluaciones lado a lado.
- **Fase 1 (Factores y Decisor):** Ajuste de la Importancia del Decisor (ID: 1 a 4) y alcance (interno/externo), cálculo automático de la Importancia Relativa (IR) y filtro de relevancia RN-01.
- **Fase 2 (Calificación de Subfactores):** Calificación técnica de afirmaciones verificables por factor, cálculo en tiempo real de la Ponderación Media (PM) y cuadrante FODA proyectado.
- **Fase 3 (Matriz FODA, Dictamen y Mitigación):** Visualización de la Matriz FODA 2×2 interactiva (con navegación cruzada de inspección hacia la Fase 2), Veredicto de Adopción (A, B o C), Plan de Mitigación detallado y descarga de reportes en PDF y Excel.
- **Modo Solo Lectura Inmutable:** Al avanzar a la Fase 3, los datos de las Fases 1 y 2 se bloquean contra modificaciones accidentales, permitiendo su libre consulta e inspección.
- **Tutorial Guiado Interactivo (Spotlight Tour):** Asistente paso a paso con reflector disponible desde el Paso 0 hasta la Fase 3.

### 3.2 Módulo de Administración y Control Organizacional
- Autenticación segura con 2FA / TOTP mediante códigos QR.
- Gestión de organizaciones, departamentos, usuarios y sesiones activas.
- Árbol de permisos jerárquicos y asignación granular de privilegios por roles.
- Bitácora inmutable de auditoría para trazabilidad de operaciones críticas.
- Catálogo maestro de dimensiones, factores y subfactores con métricas base.

---

## 4. Requisitos Previos del Sistema

Asegúrese de contar con las siguientes herramientas en su entorno de trabajo:

- **Git:** 2.40 o superior
- **Python:** 3.11, 3.12 o 3.14
- **Node.js:** v20.x o v22.x LTS (con npm 10+)
- **PostgreSQL:** 14 o superior (opcional; si no se configura `DB_ENGINE`, el sistema utiliza SQLite3 local)
- **Redis Server (v7.0 o superior):** **Requisito obligatorio** para el funcionamiento de Celery, procesamiento asíncrono de tareas de IA y caché del catálogo bibliométrico.
  - *Windows con Docker:* `docker run -d --name guios-redis -p 6379:6379 redis:alpine`
  - *Windows nativo:* Memurai o Redis bajo WSL2 (`sudo service redis-server start`)
  - *Linux (Ubuntu/Debian):* `sudo apt install redis-server && sudo systemctl start redis-server`
  - *macOS:* `brew install redis && brew services start redis`

---

## 5. Clonación del Repositorio

Abra su terminal y clone el proyecto:

```bash
git clone https://github.com/LuisArguello1/GUIOS.git
cd GUIOS
```

---

## 6. Configuración de Variables de Entorno

Copie la plantilla `.env.example` en la raíz del proyecto para crear el archivo `.env`:

En Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

En Linux / macOS:
```bash
cp .env.example .env
```

Abra el archivo `.env` y ajuste los parámetros principales:

```ini
# Seguridad y Entorno
SECRET_KEY=clave-secreta-de-desarrollo-cambiar-en-produccion
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8050
JWT_COOKIE_SECURE=False
PORT=8050

# Base de Datos (Si omite DB_ENGINE, usará SQLite3 por defecto)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=guios_db
DB_USER=postgres
DB_PASSWORD=su_password
DB_HOST=localhost
DB_PORT=5432

# Correo SMTP
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_HOST_USER="tucorreo@gmail.com"
EMAIL_HOST_PASSWORD="xxxx xxxx xxxx xxxx"
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL="tucorreo@gmail.com"

# URLs del Frontend y Backend
VITE_API_URL=/api/v1/
VITE_BACKEND_URL=http://localhost:8050/

# Redis y Celery
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_CACHE_URL=redis://127.0.0.1:6379/1
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0

# Proveedor de Inteligencia Artificial (azure, groq, cohere)
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://tu-recurso.services.ai.azure.com/models
AZURE_OPENAI_API_KEY=tu_clave_azure_openai_aqui
AZURE_OPENAI_MODEL=gpt-5-mini
GROQ_API_KEY=tu_clave_api_groq_aqui
GROQ_MODEL=qwen/qwen3.8-27b
COHERE_API_KEY=tu_clave_api_cohere_aqui
COHERE_MODEL=command-r-plus-08-2024
AI_TIMEOUT_SECONDS=30

# Motor Bibliométrico OpenAlex
OPENALEX_API_URL=https://api.openalex.org/works
OPENALEX_MAILTO=soporte@guios.org
OPENALEX_TIMEOUT_SECONDS=15
OPENALEX_MAX_RESULTS=80
```

---

## 7. Instalación y Configuración del Backend

### 7.1 Creación y activación del entorno virtual

Desde la raíz del proyecto (`GUIOS/`):

En Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

En Linux / macOS:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 7.2 Instalación de dependencias Python

Con el entorno virtual activo:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 7.3 Base de datos y migraciones

Aplique las migraciones en la base de datos configurada:

```bash
python backend/manage.py migrate
```

### 7.4 Creación de superusuario y carga de catálogos

1. Cree el usuario administrador:
   ```bash
   python backend/manage.py createsuperuser
   ```

2. Inicialice los catálogos de menús, el árbol de permisos y el catálogo metodológico oficial:
   ```bash
   python backend/manage.py setup_menus
   python backend/manage.py setup_permissions
   python backend/manage.py seed_guios_catalog
   ```

> *Nota:* El comando `seed_guios_catalog` siembra de manera idempotente las 3 Dimensiones (*Tecnológica, Organizacional, Económica*), los 18 Factores y los Subfactores base de GUIOS con sus palabras clave para la búsqueda bibliométrica y de IA.

### 7.5 Servicio de Redis (Broker y Caché)

Asegúrese de que Redis esté activo en `127.0.0.1:6379`. Con Docker:

```bash
docker run -d --name guios-redis -p 6379:6379 redis:alpine
```

Compruebe la conectividad:
```bash
redis-cli ping
# Salida esperada: PONG
```

### 7.6 Worker de Celery para Tareas de IA

Desde la carpeta `backend/` y con el entorno virtual activo:

- **En Windows:** *(Requiere el pool `solo` para compatibilidad)*
  ```bash
  celery -A config worker --pool=solo -l info
  ```

- **En Linux / macOS:**
  ```bash
  celery -A config worker -l info
  ```

### 7.7 Ejecución del servidor backend (puerto 8050)

Inicie el servidor de desarrollo en el puerto 8050:

```bash
python backend/manage.py runserver 8050
```

La API estará disponible en `http://127.0.0.1:8050/api/v1/`.

---

## 8. Instalación y Configuración del Frontend

Abra una segunda terminal y navegue al directorio `frontend/`:

```bash
cd frontend
```

### 8.1 Instalación de paquetes npm

```bash
npm install
```

### 8.2 Configuración del Hook pre-push

Active los hooks de calidad de código locales:

```bash
git config core.hooksPath .githooks
```

### 8.3 Ejecución del servidor de desarrollo Vite

```bash
npm run dev
```

La aplicación web estará disponible en `http://localhost:5173/`.

---

## 9. Guía de Ejecución Concurrente en Tres Terminales

Para contar con todo el flujo operativo en desarrollo (API REST, Asistente de Inteligencia Artificial asíncrono y Frontend reactivo), ejecute los procesos en tres terminales concurrentes con el servicio de Redis activo:

```text
┌─────────────────────────────────┐  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│     TERMINAL 1: Backend API     │  │   TERMINAL 2: Celery Worker     │  │      TERMINAL 3: Frontend       │
├─────────────────────────────────┤  ├─────────────────────────────────┤  ├─────────────────────────────────┤
│ cd backend                      │  │ cd backend                      │  │ cd frontend                     │
│ .\venv\Scripts\Activate.ps1     │  │ .\venv\Scripts\Activate.ps1     │  │ npm run dev                     │
│ python manage.py runserver 8050 │  │ celery -A config worker         │  │                                 │
│                                 │  │        --pool=solo -l info      │  │                                 │
│ -> http://127.0.0.1:8050        │  │ -> Escuchando tareas de IA      │  │ -> http://localhost:5173        │
└─────────────────────────────────┘  └─────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 10. Políticas de Calidad de Código y CI/CD

El repositorio implementa dos barreras de control de calidad automático:

1. **Hook Local pre-push (`.githooks/pre-push`):**
   Antes de permitir cualquier `git push`, valida automáticamente:
   - Diagnóstico de sanidad de Django (`python backend/manage.py check`).
   - Linter de frontend (`npm run lint`).
   - Verificación de tipos TypeScript y empaquetado de producción (`npm run build`).

2. **Pipeline de Integración Continua (GitHub Actions en `.github/workflows/ci.yml`):**
   Ejecuta las pruebas unitarias y de integración de backend y frontend en contenedores limpios antes de autorizar fusiones hacia la rama principal.

---

## 11. Estructura del Repositorio

```text
GUIOS/
├── .github/
│   └── workflows/
│       └── ci.yml               # Pipeline de CI/CD para GitHub Actions
├── .githooks/
│   └── pre-push                 # Hook de validación local antes de push
├── backend/
│   ├── apps/
│   │   ├── auth/                # Autenticación, 2FA/TOTP y auditoría
│   │   ├── core/                # Organización, roles, menús y permisos
│   │   └── guios/               # Motor GUIOS: evaluaciones, cálculo FODA e IA
│   ├── config/                  # Configuración central Django (settings, urls, celery)
│   ├── logs/                    # Bitácoras de servidor y errores
│   └── manage.py                # Punto de entrada de administración
├── frontend/
│   ├── src/
│   │   ├── api/                 # Clientes HTTP y endpoints
│   │   ├── app/                 # Stores globales (Zustand)
│   │   ├── components/          # Componentes reutilizables UI
│   │   ├── features/
│   │   │   ├── auth/            # Login, recuperación y 2FA
│   │   │   ├── dashboard/       # Métricas y balance general
│   │   │   ├── guios/           # Vistas administrativas del catálogo
│   │   │   ├── landing/         # Landing page institucional
│   │   │   ├── publicEvaluation/# Asistente público multicriterio (Wizard)
│   │   │   └── settings/        # Configuración de roles y permisos
│   │   ├── hooks/               # Custom hooks de React
│   │   └── index.css            # Tokens de diseño y estilos globales
│   ├── package.json             # Dependencias del frontend
│   └── vite.config.ts           # Configuración de empaquetado Vite
├── docs/                        # Documentación metodológica y técnica
├── requirements.txt             # Dependencias Python
├── .env.example                 # Plantilla de variables de entorno
└── README.md                    # Documentación principal
```
