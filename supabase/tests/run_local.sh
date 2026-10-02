#!/usr/bin/env bash
# Runs the database migrations and the privacy rule tests against a throwaway database.
# Needs a local Postgres you can connect to with psql; pass connection flags as arguments,
# e.g.  supabase/tests/run_local.sh -h /tmp -p 54329 -U postgres
set -euo pipefail
cd "$(dirname "$0")/.."
DB="pallet_quote_test_$$"
psql "$@" -q -c "create database $DB"
cleanup() { psql "$@" -q -c "drop database if exists $DB" -c "drop role if exists anon" -c "drop role if exists authenticated" >/dev/null 2>&1 || true; }
trap 'cleanup "$@"' EXIT
psql "$@" -q -c "drop role if exists anon" -c "drop role if exists authenticated" >/dev/null 2>&1 || true
psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql
for f in migrations/*.sql; do psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/privacy_rules_test.sql
