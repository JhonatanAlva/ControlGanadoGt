#!/bin/sh
# ============================================================
#  003 — Usuario de base de datos con permisos mínimos para el API
#
#  El API se conecta con APP_DB_USER: puede leer y escribir datos,
#  pero no crear/borrar tablas, ni crear usuarios, ni leer otras bases.
#  POSTGRES_USER queda solo para migraciones y administración.
#
#  Docker lo ejecuta automáticamente al crear el volumen por primera vez.
#  En una base existente se corre a mano (ver README).
# ============================================================
set -e

if [ -z "$APP_DB_USER" ] || [ -z "$APP_DB_PASSWORD" ]; then
  echo "003_rol_app.sh: faltan APP_DB_USER / APP_DB_PASSWORD" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$APP_DB_USER" -v app_pass="$APP_DB_PASSWORD" \
  -v db="$POSTGRES_DB" -v owner="$POSTGRES_USER" <<'SQL'
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') AS crear_rol \gset
\if :crear_rol
  CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
\endif
ALTER ROLE :"app_user" WITH PASSWORD :'app_pass';

-- Nadie más que el dueño puede crear objetos en el esquema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;

GRANT CONNECT ON DATABASE :"db" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_user";

-- Tablas creadas en migraciones futuras quedan con los mismos permisos
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SQL

echo "003_rol_app.sh: rol $APP_DB_USER listo"
