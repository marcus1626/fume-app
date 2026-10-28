#!/usr/bin/env bash
# Prints the whole cycle's rule tests as one transaction that ends in ROLLBACK, to run against a real Supabase project
# (live data stays as it was). It counts the passed checks and prints the last one; any failure stops it with FAIL.
#   tools/db/rehearsal.sh > /tmp/rehearsal.sql   # then run it with the SQL editor or the Management API
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "begin;"
grep -v '^\\' supabase/tests/05_helpers.sql |
  sed "s/insert into auth.users (email) values (p_email) returning id into uid;/insert into auth.users (id, email, aud, role, raw_user_meta_data) values (gen_random_uuid(), p_email, 'authenticated', 'authenticated', '{}') returning id into uid;/"
cat <<'SQL'
create table test.log (n serial, what text);
grant insert, select on test.log to authenticated;
grant usage on sequence test.log_n_seq to authenticated;
create or replace function test.ok(p_cond boolean, p_what text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL %', p_what; end if;
  insert into test.log (what) values (p_what);
end $$;
SQL
for f in 10_rules 20_campaigns 30_production_check 40_review_delivery 70_fume_plans 80_file_checks; do grep -v '^\\' "supabase/tests/$f.sql"; done
echo "reset role;"
echo "select count(*) as passed, (select what from test.log order by n desc limit 1) as last from test.log;"
echo "rollback;"
