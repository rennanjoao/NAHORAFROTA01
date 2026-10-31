#!/bin/bash
# Junta em supabase/ATUALIZAR_BANCO.sql as migrations que podem faltar no banco de producao,
# para aplicar tudo de uma vez pelo SQL Editor do Supabase.
#
# Uso: ./supabase/gerar_atualizacao.sh          (gera o arquivo)
#      ./supabase/gerar_atualizacao.sh --check  (so confere se o arquivo esta em dia)
#
# Ao criar uma migration nova, acrescente o nome dela em MIGRATIONS e rode de novo.
set -euo pipefail
cd "$(dirname "$0")"

MIGRATIONS=(
  20260526003000_add_tenants_plan_started_at.sql
  20260526120000_ensure_billing_and_tenant_columns.sql
  20260527100000_enforce_tenant_isolation.sql
  20260527103000_plan_limits_status_rpc.sql
  20261028120000_trial_billing_funnel_and_ops.sql
  20261028130000_fix_driver_access_rpcs_and_realtime.sql
  20261029120000_checkout_orders.sql
  20261029160000_plans_basic_standard_premium.sql
  20261029170000_fixed_freight_pays_kept_invoices.sql
  20261030120000_occurrence_reasons.sql
  20261030130000_company_logo_and_photos.sql
  20261030140000_carriers_and_provider_invoices.sql
)
OUT=ATUALIZAR_BANCO.sql

generate() {
  cat <<'HEADER'
-- ============================================================================
-- Na Hora Frota: atualizacao do banco em um arquivo so
-- ============================================================================
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
--
-- O QUE TEM AQUI
--   As migrations de supabase/migrations que podem ainda nao estar no banco,
--   na ordem certa (lista logo abaixo). As mais antigas da pasta sao do projeto
--   original e ja estao no banco; nao precisam ser rodadas de novo.
--
-- E SEGURO
--   - Roda numa transacao so: se qualquer parte falhar, nada e gravado.
--   - Pode rodar mais de uma vez: o que ja existe e mantido e os ajustes de
--     dados so completam o que ainda falta (nada e duplicado). A unica remocao
--     e o papel "viewer" sobrando em quem ja e da equipe (admin/gestor/despachante).
--   - Antes de tudo confere se o banco tem as tabelas e funcoes do projeto
--     original; se faltar algo, para com uma mensagem dizendo o que falta.
--
-- Arquivo gerado por supabase/gerar_atualizacao.sh. Nao edite a mao: altere a
-- migration e gere de novo.
--
HEADER
  for f in "${MIGRATIONS[@]}"; do echo "--   $f"; done
  cat <<'CHECK'
-- ============================================================================

BEGIN;

-- Conferencia: objetos do projeto original que estas migrations usam.
DO $conferencia$
DECLARE
  faltando text[] := ARRAY[]::text[];
  nome text;
BEGIN
  FOREACH nome IN ARRAY ARRAY[
    'tenants', 'tenant_memberships', 'profiles', 'user_roles', 'platform_admins', 'app_config',
    'drivers', 'company_vehicles', 'invoices', 'manifests', 'manifest_audit_logs', 'deliveries',
    'delivery_proofs', 'delivery_occurrences', 'driver_occurrences', 'driver_wallet', 'fleet_positions'
  ] LOOP
    IF to_regclass('public.' || nome) IS NULL THEN
      faltando := faltando || ('tabela ' || nome);
    END IF;
  END LOOP;

  FOREACH nome IN ARRAY ARRAY['has_role', 'is_platform_admin', 'get_user_tenant_id', 'get_plan_limits'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = nome
    ) THEN
      faltando := faltando || ('funcao ' || nome);
    END IF;
  END LOOP;

  IF to_regtype('public.app_role') IS NULL THEN
    faltando := faltando || 'tipo app_role'::text;
  END IF;

  IF cardinality(faltando) > 0 THEN
    RAISE EXCEPTION 'Este banco nao tem a base do projeto original: falta %. Nada foi alterado.',
      array_to_string(faltando, ', ')
      USING HINT = 'Confira se esta no projeto certo do Supabase. Se estiver, rode antes as migrations antigas da pasta supabase/migrations.';
  END IF;
END
$conferencia$;
CHECK
  for f in "${MIGRATIONS[@]}"; do
    printf '\n\n-- ============================================================================\n'
    printf -- '-- migrations/%s\n' "$f"
    printf -- '-- ============================================================================\n\n'
    cat "migrations/$f"
  done
  printf '\n\n-- A API do Supabase passa a enxergar as funcoes novas na hora.\n'
  printf "NOTIFY pgrst, 'reload schema';\n\nCOMMIT;\n"
}

if [ "${1:-}" = "--check" ]; then
  if ! diff -q <(generate) "$OUT" > /dev/null 2>&1; then
    echo "$OUT esta desatualizado: rode ./supabase/gerar_atualizacao.sh" >&2
    exit 1
  fi
  echo "$OUT em dia"
else
  generate > "$OUT"
  echo "gerado supabase/$OUT ($(wc -l < "$OUT") linhas)"
fi
