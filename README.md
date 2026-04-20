# Expense OCR PWA

Aplicacion full stack para capturar o subir facturas, extraer datos con Mistral OCR, guardar gastos en PostgreSQL y sincronizarlos con Odoo 19 usando JSON-RPC. El proyecto usa React + Vite + TailwindCSS en el frontend y FastAPI + SQLAlchemy async en el backend.

## Stack

- Frontend: React, Vite, JavaScript, TailwindCSS, `vite-plugin-pwa`, `react-webcam`
- Backend: FastAPI, SQLAlchemy 2.0 async, `asyncpg`, `httpx`
- Auth: JWT + `passlib[bcrypt]`; recuperacion de contrasena por correo (SMTP opcional)
- OCR: Mistral Document OCR API
- ERP: Odoo 19 / Odoo.sh via JSON-RPC
- Base de datos: PostgreSQL

## Estructura

```text
expenseApp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── email_service.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── ocr.py
│   │   ├── odoo_client.py
│   │   ├── password_reset_service.py
│   │   ├── secrets_crypto.py
│   │   ├── schemas.py
│   │   └── settings_service.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── scripts/
│   └── init_db.sql
└── README.md
```

## Requisitos

- Node.js 20+
- Python 3.11+
- PostgreSQL 14+
- Cuenta en Mistral con API key
- Acceso a Odoo 19 / Odoo.sh con API key habilitada

## Configuracion de PostgreSQL

1. Crea una base de datos (como superusuario o con un usuario con permiso `CREATEDB`):

```sql
CREATE DATABASE expenseapp;
```

En Windows, si el usuario `exp_user_db` ya puede conectarse a `postgres`, puedes usar el script incluido (desde `backend/` con el venv activado):

```powershell
.\.venv\Scripts\python.exe scripts\create_db_expenseapp.py
```

2. Crea las tablas de una de estas maneras:

- Opcion A: deja que FastAPI cree las tablas automaticamente al iniciar.
- Opcion B: ejecuta el script manual:

```bash
psql -U postgres -d expenseapp -f scripts/init_db.sql
```

## Backend

1. Entra en la carpeta:

```bash
cd backend
```

2. Crea y activa un entorno virtual (PowerShell en Windows):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Instala dependencias:

```powershell
pip install -r requirements.txt
```

`requirements.txt` fija `bcrypt` en la serie 4.x por compatibilidad con `passlib` (evita errores 500 al registrar usuarios con `bcrypt` 5).

4. Configura `backend/.env`. En la URL de conexion, codifica caracteres especiales del password (por ejemplo `$` como `%24`):

```env
DATABASE_URL=postgresql+asyncpg://exp_user_db:exp_usr2026%24@localhost:5432/expenseapp
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=720
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ALLOW_OPEN_REGISTRATION=true
MISTRAL_OCR_URL=https://api.mistral.ai/v1/ocr
MISTRAL_OCR_MODEL=mistral-ocr-latest
# Opcional en dev; recomendado en prod (ver backend/.env.example y seccion Seguridad):
# SECRETS_ENCRYPTION_KEYS=<salida_de_Fernet.generate_key()>
# Recuperacion de contrasena: URL del frontend y SMTP (ver backend/.env.example)
# PUBLIC_FRONTEND_URL=http://localhost:5173
```

5. Si PostgreSQL devuelve `role "exp_user_db" is not permitted to log in`, el rol existe pero no tiene `LOGIN`. Conectate como superusuario (por ejemplo `postgres`) y ejecuta el script [`scripts/setup_postgres_exp_user.sql`](scripts/setup_postgres_exp_user.sql), o manualmente: `ALTER ROLE exp_user_db WITH LOGIN;`. Crea la base `expenseapp` si aun no existe y otorga permisos al usuario.

6. Inicia la API (desde `backend/` con el venv activado):

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API base: `http://localhost:8000`

### Comprobacion rapida

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

## Frontend

1. Entra en la carpeta:

```bash
cd frontend
```

2. Instala dependencias:

```bash
npm install
```

3. Configura `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

4. Inicia Vite:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

## Flujo de uso

1. Abre la app y crea el primer usuario o inicia sesion.
2. Ve a `Configuracion`.
3. Carga tus credenciales:
   - `Mistral API Key`
   - `Odoo URL`
   - `Odoo DB`
   - `Odoo Login`
   - `Odoo API Key`
   - `Odoo Expense Model` como `hr.expense` o tu modelo custom
4. Usa `Probar conexion Odoo`.
5. Vuelve a `Captura`, toma una foto o sube una factura.
6. Ejecuta OCR, revisa los campos y guarda.

## Endpoints principales

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`
- `GET /api/settings/integrations`
- `PUT /api/settings/integrations`
- `POST /api/settings/test-odoo`
- `GET /api/expenses`
- `POST /api/expenses/process`
- `GET /api/health`

## Recuperacion de contrasena

- En la pantalla de login: **Olvide mi contrasena**; rutas `/forgot-password` y `/reset-password?token=...`.
- La API responde siempre con el mismo mensaje a `POST /api/auth/request-password-reset` (no se revela si el correo existe).
- El token se guarda como hash (SHA-256); un solo uso; caducidad por `PASSWORD_RESET_TTL_MINUTES` (por defecto 60).
- Configura `PUBLIC_FRONTEND_URL` para que el enlace del correo apunte al mismo origen donde sirves el frontend (en local suele ser `http://localhost:5173`).
- Si `SMTP_HOST` esta vacio, no se envia correo: el enlace aparece como **advertencia en el log del servidor** (solo para desarrollo). En produccion configura SMTP (ver [`backend/.env.example`](backend/.env.example)).
- Si el envio SMTP falla, el token no se persiste y el error queda en el log; el usuario sigue viendo el mensaje generico de exito.

## Notas sobre Odoo 19

- La API key de Odoo se usa como password en `authenticate`.
- El cliente JSON-RPC se concentra en `backend/app/odoo_client.py`.
- Para **`hr.expense`**, en muchas bases el campo **`employee_id` es obligatorio** al crear un gasto. Configura **ID empleado Odoo** en la pantalla de configuracion (el ID numerico del registro `hr.employee` vinculado a tu usuario; suele verse en la URL al abrir la ficha en Odoo).
- Si la base de datos ya existia antes de anadir esa columna, ejecuta [`scripts/add_odoo_employee_id.sql`](scripts/add_odoo_employee_id.sql).
- Si la sincronizacion falla, el mensaje de la API incluye ahora el **motivo** devuelto por Odoo (validacion, permisos, campos obligatorios, etc.).
- Otros campos (`product_id`, `company_id`, etc.) pueden ser obligatorios segun tu instancia; ajusta `build_odoo_vals()` en `backend/app/odoo_client.py` si hace falta.

## Seguridad

- Las imagenes no se almacenan en disco ni en PostgreSQL.
- Las claves de Mistral y Odoo no se exponen en el bundle del frontend.
- El backend devuelve los secretos vacios y solo indica si ya estan configurados (`has_*`).
- **Cifrado en base de datos (opcional pero recomendado en produccion):** define `SECRETS_ENCRYPTION_KEYS` en `backend/.env` con una o mas claves Fernet (ver [`backend/.env.example`](backend/.env.example)). La primera clave se usa para cifrar; al descifrar se prueba cada clave en orden (rotacion sin downtime: anade la nueva clave al inicio de la lista, despliega, y tras re-guardar credenciales o un re-cifrado masivo puedes retirar la antigua). Si no configuras la variable, los nuevos valores se guardan en claro (compatible con datos ya existentes; los valores con prefijo `f1:` siguen necesitando la clave correcta para leerse).
- No reutilices `JWT_SECRET_KEY` como clave de cifrado de credenciales; manten rotaciones independientes.
- Usa HTTPS en produccion para frontend y backend.
- Recuperacion de contrasena: no enumerar usuarios por correo; enlaces de un solo uso y TTL acotado (ver seccion anterior).

## Verificacion rapida

- Frontend compilado con `npm run build`
- Backend validado con `python -m compileall app`

## Mejoras futuras

- Script o tarea admin para re-cifrar todas las filas tras rotacion de clave
- Reintentos automáticos para sincronizaciones Odoo fallidas
- Cola de trabajos para OCR/Odoo
- Tests automatizados para OCR heuristico y auth
