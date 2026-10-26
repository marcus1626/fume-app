#!/usr/bin/env bash
# Runs the database migrations, the seed and the rule tests on a throwaway Postgres database.
# DATABASE_URL points at a Postgres server you may create databases on (never a Supabase project).
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres tools/db/test.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?Set DATABASE_URL to a disposable Postgres server}"
db="fume_rules_test"
psql "$DATABASE_URL" -qX -v ON_ERROR_STOP=1 -c "drop database if exists $db" -c "create database $db"
url="${DATABASE_URL%/*}/$db"
run() { psql "$url" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
psql "$url" -qX -v ON_ERROR_STOP=1 -f supabase/tests/10_rules.sql 2>&1 | sed -n 's/^psql:[^ ]* NOTICE:  //p; /FAIL\|ERROR/p'
test "${PIPESTATUS[0]}" -eq 0
