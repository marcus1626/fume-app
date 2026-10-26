#!/usr/bin/env bash
# Runs the database migrations, the seed and the rule tests on a throwaway Postgres database.
# DATABASE_URL points at a Postgres server you may create databases on (never a Supabase project).
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres tools/db/test.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?Set DATABASE_URL to a disposable Postgres server}"
db="${FUME_TEST_DB:-fume_rules_test}"
psql "$DATABASE_URL" -qX -v ON_ERROR_STOP=1 -c "drop database if exists $db" -c "create database $db"
url="${DATABASE_URL%/*}/$db"
run() { psql "$url" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
# The helpers, then every rule test file in name order, in one session (later files build on earlier ones).
cat supabase/tests/05_helpers.sql supabase/tests/[1-9]*.sql | psql "$url" -qX -v ON_ERROR_STOP=1 2>&1 | sed -n 's/^\(psql:[^ ]* \)\{0,1\}NOTICE:  //p; /FAIL\|ERROR/p'
test "${PIPESTATUS[1]}" -eq 0
