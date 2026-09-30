# GUIOS - Guia Unificada de Interfaz y Operacion de Sistemas

Plataforma empresarial de gestion administrativa, evaluacion y control de acceso basada en una arquitectura desacoplada con backend en Django REST Framework y frontend en React con Vite y TypeScript.

---

## Indice de Contenidos

1. [Descripcion del Proyecto](#1-descripcion-del-proyecto)
2. [Arquitectura y Tecnologias](#2-arquitectura-y-tecnologias)
3. [Requisitos Previos del Sistema](#3-requisitos-previos-del-sistema)
4. [Clonacion del Repositorio](#4-clonacion-del-repositorio)
5. [Configuracion de Variables de Entorno](#5-configuracion-de-variables-de-entorno)
6. [Instalacion y Configuracion del Backend](#6-instalacion-y-configuracion-del-backend)
   - [6.1 Creacion y activacion del entorno virtual](#61-creacion-y-activacion-del-entorno-virtual)
   - [6.2 Instalacion de dependencias](#62-instalacion-de-dependencias)
   - [6.3 Base de datos y migraciones locales](#63-base-de-datos-y-migraciones-locales)
   - [6.4 Creacion de superusuario y datos iniciales](#64-creacion-de-superusuario-y-datos-iniciales)
   - [6.5 Ejecucion del servidor backend en puerto 8050](#65-ejecucion-del-servidor-backend-en-puerto-8050)
7. [Instalacion y Configuracion del Frontend](#7-instalacion-y-configuracion-del-frontend)
   - [7.1 Instalacion de paquetes npm](#71-instalacion-de-paquetes-npm)
   - [7.2 Configuracion del Hook pre-push](#72-configuracion-del-hook-pre-push)
   - [7.3 Ejecucion del servidor de desarrollo frontend](#73-ejecucion-del-servidor-de-desarrollo-frontend)
8. [Guia de Ejecucion en Dos Terminales](#8-guia-de-ejecucion-en-dos-terminales)
9. [Politicas de Calidad de Codigo y CI/CD](#9-politicas-de-calidad-de-codigo-y-cicd)
10. [Estructura del Proyecto](#10-estructura-del-proyecto)

---

## 1. Descripcion del Proyecto

GUIOS es una plataforma web modular disenada para la gestion organizacional, administracion de usuarios con autenticacion de dos factores (2FA / TOTP), control granular de accesos por roles y permisos dinamicos, pistas de auditoria y generacion de evaluaciones de conformidad.

---

## 2. Arquitectura y Tecnologias

### Backend
- Lenguaje: Python 3.12+
- Framework: Django 6.0 con Django REST Framework (DRF)
- Autenticacion: SimpleJWT con soporte de cookies seguras y rotacion de tokens
- Tareas Asincronas y Cache: Celery con Redis
- Base de Datos: PostgreSQL (con fallback automatico a SQLite en desarrollo)

### Frontend
- Biblioteca: React 19 con TypeScript
- Herramienta de compilacion: Vite 8
- Enrutamiento: React Router v7
- Estado Global: Zustand
- Diseno y Estilos: Tailwind CSS v4, Lucide React, Framer Motion
- Calidad: ESLint 9

---

## 3. Requisitos Previos del Sistema

Antes de iniciar la instalacion, asegurese de tener instaladas las siguientes herramientas en su sistema operativo:

- Git (2.40 o superior)
- Python (3.11 o 3.12)
- Node.js (v20.x o v22.x LTS) y npm (v10.x o superior)
- PostgreSQL (v14 o superior, opcional si utiliza SQLite para desarrollo local)
- Redis Server (requerido para cola de tareas y cache en tiempo real)
- Dependencias de sistema para compilacion (en Linux/Ubuntu: `libcairo2-dev pkg-config python3-dev`)

---

## 4. Clonacion del Repositorio

Abra una terminal y ejecute el siguiente comando para clonar el repositorio:

```bash
git clone https://github.com/LuisArguello1/GUIOS.git
cd GUIOS
```

---

## 5. Configuracion de Variables de Entorno

El proyecto incluye una plantilla `.env.example` en la raiz del repositorio con la estructura requerida.

1. Copie el archivo `.env.example` creando el archivo `.env`:

   En Windows (PowerShell):
   ```powershell
   Copy-Item .env.example .env
   ```

   En Linux / macOS / Git Bash:
   ```bash
   cp .env.example .env
   ```

2. Abra el archivo `.env` y ajuste los parametros segun su entorno local:

```ini
# Seguridad
SECRET_KEY=clave-secreta-de-desarrollo-cambiar-en-produccion
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Puerto del Backend
PORT=8050

# Base de Datos (Si no define DB_ENGINE, usara db.sqlite3 por defecto)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=guios_db
DB_USER=postgres
DB_PASSWORD=su_password
DB_HOST=localhost
DB_PORT=5432

# Configuracion de Correo (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=su_correo@gmail.com
EMAIL_HOST_PASSWORD=su_app_password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=su_correo@gmail.com
DAILY_EMAIL_LIMIT=500

# Configuracion del Frontend
VITE_API_URL=/api/v1/
VITE_BACKEND_URL=http://localhost:8050/

# Redis y Celery
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_CACHE_URL=redis://127.0.0.1:6379/1
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
```

---

## 6. Instalacion y Configuracion del Backend

### 6.1 Creacion y activacion del entorno virtual

Desde la raiz del proyecto (`GUIOS/`):

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

### 6.2 Instalacion de dependencias

Con el entorno virtual activo, actualice `pip` e instale los paquetes de Python:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 6.3 Base de datos y migraciones locales

> **Importante sobre migraciones:** Las migraciones de modelos no se encuentran versionadas en el repositorio para evitar conflictos entre desarrolladores. Cada clon genera y aplica sus migraciones locales:

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### 6.4 Creacion de superusuario y datos iniciales

1. Cree el usuario administrador para acceder al panel de control:
   ```bash
   python backend/manage.py createsuperuser
   ```

2. Inicialice los catalogos de menus del sistema y el arbol de permisos:
   ```bash
   python backend/manage.py setup_menus
   python backend/manage.py setup_permissions
   ```

### 6.5 Ejecucion del servidor backend en puerto 8050

Inicie el servidor de desarrollo de Django especificando el puerto 8050:

```bash
python manage.py runserver 8050
```

El servicio estara disponible en `http://127.0.0.1:8050/`. 

---

## 7. Instalacion y Configuracion del Frontend

Abra una segunda terminal y navegue hasta el directorio `frontend/`:

```bash
cd frontend
```

### 7.1 Instalacion de paquetes npm

Ejecute la instalacion limpia de dependencias:

```bash
npm install
```

### 7.2 Configuracion del Hook pre-push

Al ejecutar `npm install`, el script `prepare` configurara automaticamente la ruta de hooks de Git hacia `.githooks`. Si desea activarlo manualmente desde la raiz, ejecute:

```bash
git config core.hooksPath .githooks
```

### 7.3 Ejecucion del servidor de desarrollo frontend

Inicie el entorno de desarrollo con Vite:

```bash
npm run dev
```

El frontend se expondra habitualmente en `http://localhost:5173/`.

---

## 8. Guia de Ejecucion en Dos Terminales

Para trabajar en el entorno de desarrollo se requieren dos terminales abiertas simultaneamente:

### Terminal 1: Backend (Django REST Framework en puerto 8050)
```bash
venv\Scripts\Activate
cd backend
python manage.py runserver 8050
```

### Terminal 2: Frontend (React + Vite)
```bash
venv\Scripts\Activate
cd frontend
npm run dev
```

---

## 9. Politicas de Calidad de Codigo y CI/CD

El repositorio cuenta con dos capas de verificacion automatica para garantizar que ningun cambio con errores llegue al codigo base:

### Verificacion Local (Hook pre-push)
Cada vez que un desarrollador ejecuta `git push origin <rama>`, se dispara el script `.githooks/pre-push` que valida:
1. Comprobacion de sanidad de Django (`python backend/manage.py check`).
2. Analisis estatico de codigo en frontend (`npm run lint`).
3. Verificacion de tipos TypeScript y construccion de bundle (`npm run build`).

Si cualquiera de estas tres pruebas falla, el comando `git push` se cancela inmediatamente y notifica el motivo en consola.

### Verificacion en la Nube (GitHub Actions)
Definida en `.github/workflows/ci.yml`. Ejecuta de forma paralela en contenedores limpios de Ubuntu:
- **Backend Validation:** Validacion de dependencias y `manage.py check`.
- **Frontend Validation:** Instalacion de dependencias, ESLint y compilacion TypeScript.

Los estados de aprobacion se reflejan con indicadores en cada commit y bloquean Pull Requests defectuosos.

---

## 10. Estructura del Proyecto

```text
GUIOS/
├── .github/
│   └── workflows/
│       └── ci.yml               # Pipeline de CI/CD para GitHub Actions
├── .githooks/
│   └── pre-push                 # Hook de validacion local antes de push
├── backend/
│   ├── apps/
│   │   ├── auth/                # Autenticacion, 2FA/TOTP y auditoria
│   │   ├── core/                # Organizacion, roles, menus y permisos
│   │   └── guios/               # Modulo de negocio y evaluaciones
│   ├── config/                  # Configuracion central de Django (settings, urls, asgi, wsgi)
│   └── manage.py                # Punto de entrada de administracion Django
├── frontend/
│   ├── src/
│   │   ├── api/                 # Clientes y servicios HTTP (Axios)
│   │   ├── app/                 # Almacenamiento de estado global (Zustand)
│   │   ├── components/          # Componentes reutilizables de UI y layouts
│   │   ├── features/            # Modulos funcionales y paginas
│   │   ├── hooks/               # Custom hooks de React
│   │   └── index.css            # Estilos globales y tokens
│   ├── package.json             # Dependencias y scripts de Node.js
│   └── vite.config.ts           # Configuracion del empaquetador Vite
├── docs/                        # Documentacion funcional y tecnica
├── requirements.txt             # Dependencias de paquetes Python
├── .env.example                 # Plantilla de variables de entorno
└── README.md                    # Documentacion principal del proyecto
```
