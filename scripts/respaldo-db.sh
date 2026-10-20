#!/usr/bin/env bash
# ============================================================
#  Respaldo cifrado de la base de datos
#
#  Uso (desde la raíz del proyecto, en Git Bash):
#    ./scripts/respaldo-db.sh                      → crea un respaldo
#    ./scripts/respaldo-db.sh restaurar <archivo>  → restaura uno (¡reemplaza los datos!)
#
#  Cifrado AES-256 con la frase BACKUP_PASSPHRASE del .env de la raíz.
#  Sin esa frase el respaldo NO se puede abrir: guárdala también fuera
#  de esta computadora (gestor de contraseñas).
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

DIR="respaldos"
CONSERVAR=14   # cuántos respaldos guardar antes de borrar los más viejos

leer_env() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r'; }

BACKUP_PASSPHRASE="$(leer_env BACKUP_PASSPHRASE)"
if [ ${#BACKUP_PASSPHRASE} -lt 20 ]; then
  echo "Falta BACKUP_PASSPHRASE en .env (mínimo 20 caracteres)." >&2
  exit 1
fi
export BACKUP_PASSPHRASE

CIFRADO=(-aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE)

if [ "${1:-}" = "restaurar" ]; then
  ARCHIVO="${2:?Indica el archivo .dump.enc a restaurar}"
  read -r -p "Esto REEMPLAZA los datos actuales con $ARCHIVO. Escribe 'restaurar' para continuar: " ok
  [ "$ok" = "restaurar" ] || { echo "Cancelado."; exit 1; }
  openssl enc -d "${CIFRADO[@]}" -in "$ARCHIVO" |
    docker compose exec -T postgres sh -c \
      'pg_restore --clean --if-exists --no-owner --role="$POSTGRES_USER" -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  echo "Restaurado. Si es una base nueva, vuelve a correr migrations/003_rol_app.sh para los permisos del API."
  exit 0
fi

mkdir -p "$DIR"
DESTINO="$DIR/ganaderia_$(date +%Y%m%d_%H%M%S).dump.enc"

# El dump nunca toca el disco sin cifrar
docker compose exec -T postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' |
  openssl enc "${CIFRADO[@]}" -out "$DESTINO"

# Verificar que se puede descifrar y leer antes de dar el respaldo por bueno
openssl enc -d "${CIFRADO[@]}" -in "$DESTINO" |
  docker compose exec -T postgres pg_restore --list > /dev/null

echo "Respaldo creado y verificado: $DESTINO ($(du -h "$DESTINO" | cut -f1))"

# Rotación
ls -1t "$DIR"/ganaderia_*.dump.enc | tail -n +$((CONSERVAR + 1)) | xargs -r rm --
