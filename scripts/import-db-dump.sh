#!/usr/bin/env sh
set -eu

DUMP_PATH="${1:-}"

if [ -z "$DUMP_PATH" ]; then
  echo "Usage: ./scripts/import-db-dump.sh <dump.sql>" >&2
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$DUMP_PATH" ]; then
  echo "Dump introuvable: $DUMP_PATH" >&2
  exit 1
fi

DUMP_FILE_NAME="$(basename "$DUMP_PATH")"
CONTAINER_DUMP_PATH="/tmp/$DUMP_FILE_NAME"
case "$DUMP_PATH" in
  *.dump|*.backup|*.bak)
    DUMP_MODE="custom"
    ;;
  *)
    DUMP_MODE="sql"
    ;;
esac

echo "Demarrage de PostgreSQL..."
docker compose -f "$ROOT_DIR/compose.yaml" up -d postgres >/dev/null

echo "Attente de la disponibilite de PostgreSQL..."
i=0
while [ "$i" -lt 30 ]; do
  if docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 || {
  echo "PostgreSQL n'est pas pret a recevoir le dump." >&2
  exit 1
}

echo "Recreation de la base cible..."
docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\''$POSTGRES_DB'\'' AND pid <> pg_backend_pid();" -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" -c "CREATE DATABASE \"$POSTGRES_DB\";"'

echo "Copie du dump dans le conteneur..."
docker compose -f "$ROOT_DIR/compose.yaml" cp "$DUMP_PATH" "postgres:$CONTAINER_DUMP_PATH" >/dev/null

if [ "$DUMP_MODE" = "custom" ]; then
  echo "Restauration du dump PostgreSQL custom..."
  docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres sh -lc "pg_restore --verbose --clean --if-exists --no-owner --no-privileges -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" \"$CONTAINER_DUMP_PATH\""
else
  echo "Import du dump SQL..."
  docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres sh -lc "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -f \"$CONTAINER_DUMP_PATH\""
fi

echo "Import termine."
