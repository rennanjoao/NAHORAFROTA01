#!/bin/bash
# Testes de comportamento (RLS, triggers e RPCs) da migration
# 20261028120000_trial_billing_funnel_and_ops.sql e 20261028130000_fix_driver_access_rpcs_and_realtime.sql
# em um Postgres local.
#
# Uso: PGURL=postgres://postgres@localhost:5432/postgres ./supabase/tests/run.sh
# O banco "nahora_rls_tests" e recriado a cada execucao (nunca aponte para producao).
# O schema e gerado a partir de src/integrations/supabase/types.ts (versao anterior a
# migration), que espelha o banco real.
set -euo pipefail

: "${PGURL:?Defina PGURL apontando para um Postgres local (superusuario)}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TESTS="$ROOT/supabase/tests"
DB=nahora_rls_tests
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

psql "$PGURL" -q -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 2>/dev/null


# Schema "antes da migration": types.ts do commit anterior ao que criou a migration.
MIGRATION=supabase/migrations/20261028120000_trial_billing_funnel_and_ops.sql
ADDED_IN="$(git -C "$ROOT" log --diff-filter=A --format=%H -- "$MIGRATION" | tail -1)"
if [ -n "$ADDED_IN" ]; then
  git -C "$ROOT" show "$ADDED_IN^:src/integrations/supabase/types.ts" > "$TMP/types_before.ts"
else
  cp "$ROOT/src/integrations/supabase/types.ts" "$TMP/types_before.ts"
fi
python3 -I "$TESTS/gen_schema.py" "$TMP/types_before.ts" \
  billing_notices funnel_events trial_registrations > "$TMP/01_schema.sql"
sed -n '/^CREATE OR REPLACE FUNCTION public.has_role/,$p' \
  "$ROOT/supabase/migrations/20260427110000_bootstrap_mhn_app_schema.sql" > "$TMP/03_bootstrap_functions.sql"

for f in "$TESTS/00_supabase_stubs.sql" "$TMP/01_schema.sql" "$TESTS/02_extras.sql" "$TMP/03_bootstrap_functions.sql" \
  "$ROOT/supabase/migrations/20260527100000_enforce_tenant_isolation.sql" \
  "$ROOT/supabase/migrations/20260527103000_plan_limits_status_rpc.sql" \
  "$ROOT/supabase/migrations/20261028120000_trial_billing_funnel_and_ops.sql" \
  "$ROOT/supabase/migrations/20261028130000_fix_driver_access_rpcs_and_realtime.sql"; do
  psql "$PGURL" -q -v ON_ERROR_STOP=1 -c "\\connect $DB" -f "$f" > /dev/null 2>&1 || { echo "Falhou ao aplicar $f"; exit 1; }
done

failed=0
# Os arquivos compartilham fixtures e rodam em ordem (test_10, test_20, ...).
for t in "$TESTS"/test_*.sql; do
  if out=$(psql "$PGURL" -q -c "\\connect $DB" -f "$t" 2>&1) && ! grep -q "ERROR" <<< "$out"; then
    echo "ok   $(basename "$t") ($(grep -c 'ok:' <<< "$out") verificacoes)"
  else
    echo "FAIL $(basename "$t")"; grep -E "ERROR|FAIL" <<< "$out" | head -5; failed=1
  fi
done
exit $failed
