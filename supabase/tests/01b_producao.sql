-- Onde o banco de producao difere do types.ts (conferido em 30/10/2026 pedindo cada
-- coluna a API com a chave publica: "nao existe" x "sem permissao"). A atualizacao
-- tem que passar neste formato, nao so no do types.ts.

-- Ocorrencias de entrega: tabela do bootstrap, com "type" NOT NULL e sem occurrence_type/lat/lng.
ALTER TABLE public.delivery_occurrences DROP COLUMN IF EXISTS occurrence_type;
ALTER TABLE public.delivery_occurrences DROP COLUMN IF EXISTS lat;
ALTER TABLE public.delivery_occurrences DROP COLUMN IF EXISTS lng;
ALTER TABLE public.delivery_occurrences ADD COLUMN IF NOT EXISTS type text NOT NULL;
ALTER TABLE public.delivery_occurrences ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE public.delivery_occurrences ADD COLUMN IF NOT EXISTS solved boolean DEFAULT false;
ALTER TABLE public.delivery_occurrences ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.deliveries DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS customer_name, DROP COLUMN IF EXISTS notes;
ALTER TABLE public.driver_occurrences DROP COLUMN IF EXISTS latitude, DROP COLUMN IF EXISTS longitude;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS full_name, DROP COLUMN IF EXISTS username;
DROP TABLE IF EXISTS public.occurrences, public.system_users;
