-- Motivos de ocorrencia cadastrados por empresa.
-- O motorista so escolhe entre os motivos ativos da empresa (a observacao continua livre).
-- Cada empresa recebe a lista padrao, e o painel (Configuracoes > Ocorrencias) inclui,
-- renomeia e desativa motivos. A ocorrencia gravada com um motivo fora da lista e recusada.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.occurrence_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT occurrence_reasons_code_format CHECK (code ~ '^[a-z0-9_]{2,48}$'),
  CONSTRAINT occurrence_reasons_label_length CHECK (char_length(btrim(label)) BETWEEN 2 AND 60),
  CONSTRAINT occurrence_reasons_tenant_code_key UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_occurrence_reasons_tenant ON public.occurrence_reasons(tenant_id, sort_order);

-- Tabela criada antes (sem os padroes desta migration): motivo novo nasce ligado.
ALTER TABLE public.occurrence_reasons ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.occurrence_reasons ALTER COLUMN active SET DEFAULT true;
ALTER TABLE public.occurrence_reasons ALTER COLUMN sort_order SET DEFAULT 100;
ALTER TABLE public.occurrence_reasons ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.occurrence_reasons ALTER COLUMN updated_at SET DEFAULT now();

-- Tabela criada antes sem a chave por empresa: a lista padrao depende dela.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.occurrence_reasons'::regclass AND contype IN ('u', 'p')
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.occurrence_reasons'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.occurrence_reasons'::regclass AND attname = 'code')
      ]::int2[]
  ) THEN
    ALTER TABLE public.occurrence_reasons ADD CONSTRAINT occurrence_reasons_tenant_code_key UNIQUE (tenant_id, code);
  END IF;
END $$;

ALTER TABLE public.occurrence_reasons ENABLE ROW LEVEL SECURITY;

-- Le: equipe e motoristas da empresa (o app do motorista monta a lista com isso).
DROP POLICY IF EXISTS "occurrence_reasons_read" ON public.occurrence_reasons;
CREATE POLICY "occurrence_reasons_read"
ON public.occurrence_reasons
FOR SELECT TO authenticated
USING (public.can_access_tenant(tenant_id, auth.uid()));

-- Cadastra, renomeia e desativa: quem administra a operacao.
DROP POLICY IF EXISTS "occurrence_reasons_manage" ON public.occurrence_reasons;
CREATE POLICY "occurrence_reasons_manage"
ON public.occurrence_reasons
FOR ALL TO authenticated
USING (public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.occurrence_reasons TO authenticated;

-- Lista padrao de uma empresa (nao mexe no que ela ja tem).
CREATE OR REPLACE FUNCTION public.seed_occurrence_reasons(p_tenant_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.occurrence_reasons (tenant_id, code, label, sort_order, active)
  SELECT p_tenant_id, d.code, d.label, d.sort_order, true
  FROM (VALUES
    ('cliente_ausente', 'Cliente ausente', 10),
    ('estabelecimento_fechado', 'Estabelecimento fechado', 20),
    ('recusado', 'Cliente recusou', 30),
    ('endereco_errado', 'Endereço não encontrado', 40),
    ('horario_restrito', 'Fora do horário de recebimento', 50),
    ('avaria', 'Mercadoria avariada', 60),
    ('falta_mercadoria', 'Falta de mercadoria', 70),
    ('area_risco', 'Área de risco', 80),
    ('extravio', 'Mercadoria extraviada', 90)
  ) AS d(code, label, sort_order)
  ON CONFLICT (tenant_id, code) DO NOTHING
$$;

REVOKE EXECUTE ON FUNCTION public.seed_occurrence_reasons(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_occurrence_reasons(uuid) TO service_role;

-- Empresas que ja existem.
DO $$
DECLARE
  t uuid;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    IF NOT EXISTS (SELECT 1 FROM public.occurrence_reasons r WHERE r.tenant_id = t) THEN
      PERFORM public.seed_occurrence_reasons(t);
    END IF;
  END LOOP;
END $$;

-- Empresas novas (cadastro, compra ou Painel Master).
CREATE OR REPLACE FUNCTION public.seed_occurrence_reasons_for_new_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_occurrence_reasons(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_occurrence_reasons ON public.tenants;
CREATE TRIGGER trg_seed_occurrence_reasons
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_occurrence_reasons_for_new_tenant();

-- Em producao a tabela veio do bootstrap com a coluna "type" (NOT NULL) e sem
-- occurrence_type, que e o que o app grava e le: o detalhe da ocorrencia nao era salvo.
-- Cria occurrence_type, copia o que ja existe e mantem as duas iguais.
ALTER TABLE public.delivery_occurrences ADD COLUMN IF NOT EXISTS occurrence_type text;

CREATE OR REPLACE FUNCTION public.sync_delivery_occurrence_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.type IS DISTINCT FROM OLD.type
    AND NEW.occurrence_type IS NOT DISTINCT FROM OLD.occurrence_type THEN
    NEW.occurrence_type := NEW.type;
  ELSE
    NEW.occurrence_type := COALESCE(NEW.occurrence_type, NEW.type);
    NEW.type := NEW.occurrence_type;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'delivery_occurrences' AND column_name = 'type'
  ) THEN
    UPDATE public.delivery_occurrences SET occurrence_type = type
    WHERE occurrence_type IS NULL AND type IS NOT NULL;
    -- O nome faz este gatilho rodar antes da validacao do motivo (ordem alfabetica).
    DROP TRIGGER IF EXISTS trg_sync_delivery_occurrence_type ON public.delivery_occurrences;
    CREATE TRIGGER trg_sync_delivery_occurrence_type
    BEFORE INSERT OR UPDATE ON public.delivery_occurrences
    FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_occurrence_type();
  END IF;
END $$;

-- Ocorrencia registrada pelo motorista so com motivo ativo da empresa. A equipe e as
-- integracoes (sem login de motorista) nao passam por aqui. Empresa sem nenhum motivo
-- cadastrado (nao deveria acontecer) nao fica impedida de registrar.
CREATE OR REPLACE FUNCTION public.validate_delivery_occurrence_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.occurrence_type IS NOT DISTINCT FROM OLD.occurrence_type THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.current_driver_ids()) THEN
    RETURN NEW;
  END IF;
  v_tenant := COALESCE(
    NEW.tenant_id,
    (SELECT d.tenant_id FROM public.drivers d WHERE d.id = NEW.driver_id),
    (SELECT i.tenant_id FROM public.invoices i WHERE i.id = NEW.invoice_id)
  );
  IF v_tenant IS NULL OR NOT EXISTS (SELECT 1 FROM public.occurrence_reasons r WHERE r.tenant_id = v_tenant) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.occurrence_reasons r
    WHERE r.tenant_id = v_tenant AND r.code = NEW.occurrence_type AND r.active
  ) THEN
    RAISE EXCEPTION 'Escolha um motivo de ocorrência da lista da empresa.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_delivery_occurrence_reason ON public.delivery_occurrences;
CREATE TRIGGER trg_validate_delivery_occurrence_reason
BEFORE INSERT OR UPDATE OF occurrence_type ON public.delivery_occurrences
FOR EACH ROW EXECUTE FUNCTION public.validate_delivery_occurrence_reason();

-- O painel atualiza a lista do app na hora.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables)
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'occurrence_reasons'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.occurrence_reasons;
  END IF;
END $$;
