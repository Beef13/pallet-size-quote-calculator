#!/usr/bin/env bash
# Starts a throwaway database plus the data API (PostgREST) and runs the end-to-end tests
# against them with the real supabase-js client.
#   POSTGREST=/path/to/postgrest supabase/tests/run_api_local.sh -h /tmp -p 54329 -U postgres
# The psql flags are for a local Postgres superuser; the API connects over the same socket/port.
set -euo pipefail
: "${POSTGREST:?Set POSTGREST to the postgrest binary}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/supabase"
DB="pallet_quote_api_$$"
PORT="${API_PORT:-54330}"
SECRET="local-test-secret-that-is-at-least-32-chars"
HOST="/tmp"; PGPORT="5432"; PGUSER_="postgres"
args=("$@"); for ((i = 0; i < ${#args[@]}; i++)); do case "${args[$i]}" in -h) HOST="${args[$((i + 1))]}";; -p) PGPORT="${args[$((i + 1))]}";; -U) PGUSER_="${args[$((i + 1))]}";; esac; done
psql "$@" -q -c "drop role if exists anon" -c "drop role if exists authenticated" >/dev/null 2>&1 || true
psql "$@" -q -c "create database $DB"
cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  psql "$@" -q -c "drop database if exists $DB with (force)" -c "drop role if exists anon" -c "drop role if exists authenticated" >/dev/null 2>&1 || true
}
trap 'cleanup "$@"' EXIT
psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql
for f in migrations/*.sql; do psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -c "insert into auth.users (id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.com'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.com')" \
  -c "grant anon, authenticated to $PGUSER_"
PGRST_DB_URI="postgres://$PGUSER_@/$DB?host=$HOST&port=$PGPORT" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$SECRET" PGRST_SERVER_PORT="$PORT" PGRST_LOG_LEVEL=crit "$POSTGREST" &
API_PID=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.25; done
cd "$ROOT" && API_URL="http://127.0.0.1:$PORT" JWT_SECRET="$SECRET" node supabase/tests/api_integration.mjs
