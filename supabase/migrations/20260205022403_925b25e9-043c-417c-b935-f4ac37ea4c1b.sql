-- Add regiao_logistica column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS regiao_logistica text;

-- Create index for better query performance on region filtering
CREATE INDEX IF NOT EXISTS idx_invoices_regiao_logistica ON public.invoices (regiao_logistica);

-- Create function to calculate regiao_logistica from CEP
CREATE OR REPLACE FUNCTION public.calculate_regiao_logistica(cep_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
  cep_number integer;
  cep_clean text;
BEGIN
  -- Remove hífen e espaços do CEP
  cep_clean := regexp_replace(cep_input, '[^0-9]', '', 'g');
  
  -- Se o CEP não tiver 8 dígitos, retornar null
  IF length(cep_clean) != 8 THEN
    RETURN NULL;
  END IF;
  
  -- Converter para número inteiro (primeiros 5 dígitos para comparação de faixa)
  cep_number := substring(cep_clean, 1, 5)::integer;
  
  -- SÃO PAULO CAPITAL
  IF cep_number BETWEEN 01000 AND 01599 THEN RETURN 'SP - Zona Central'; END IF;
  IF cep_number BETWEEN 02000 AND 02999 THEN RETURN 'SP - Zona Norte'; END IF;
  IF cep_number BETWEEN 03000 AND 03999 THEN RETURN 'SP - Zona Leste'; END IF;
  IF cep_number BETWEEN 04000 AND 04999 THEN RETURN 'SP - Zona Sul'; END IF;
  IF cep_number BETWEEN 05000 AND 05799 THEN RETURN 'SP - Zona Oeste'; END IF;
  IF cep_number BETWEEN 05800 AND 05899 THEN RETURN 'SP - Zona Sul (Extremo)'; END IF;
  IF cep_number BETWEEN 08000 AND 08499 THEN RETURN 'SP - Zona Leste (Extremo)'; END IF;
  
  -- GRANDE SÃO PAULO
  IF cep_number BETWEEN 06000 AND 06699 THEN RETURN 'GSP - Oeste (Osasco/Barueri)'; END IF;
  IF cep_number BETWEEN 07000 AND 07999 THEN RETURN 'GSP - Norte (Guarulhos)'; END IF;
  IF cep_number BETWEEN 08500 AND 08999 THEN RETURN 'GSP - Leste (Mogi/Suzano)'; END IF;
  IF cep_number BETWEEN 09000 AND 09999 THEN RETURN 'GSP - ABC Paulista'; END IF;
  
  -- INTERIOR E LITORAL
  IF cep_number BETWEEN 11000 AND 11899 THEN RETURN 'Litoral - Baixada Santista'; END IF;
  IF cep_number BETWEEN 11900 AND 11999 THEN RETURN 'Interior - RA Registro'; END IF;
  IF cep_number BETWEEN 12000 AND 12999 THEN RETURN 'Interior - RA Vale do Paraíba'; END IF;
  IF cep_number BETWEEN 13000 AND 13499 THEN RETURN 'Interior - RA Campinas'; END IF;
  IF cep_number BETWEEN 13500 AND 13999 THEN RETURN 'Interior - RA Central (Araraquara/S. Carlos)'; END IF;
  IF cep_number BETWEEN 14000 AND 14999 THEN RETURN 'Interior - RA Ribeirão Preto'; END IF;
  IF cep_number BETWEEN 15000 AND 15999 THEN RETURN 'Interior - RA S. José do Rio Preto'; END IF;
  IF cep_number BETWEEN 16000 AND 16399 THEN RETURN 'Interior - RA Araçatuba'; END IF;
  IF cep_number BETWEEN 16400 AND 17199 THEN RETURN 'Interior - RA Bauru'; END IF;
  IF cep_number BETWEEN 17200 AND 17999 THEN RETURN 'Interior - RA Marília'; END IF;
  IF cep_number BETWEEN 18000 AND 18999 THEN RETURN 'Interior - RA Sorocaba'; END IF;
  IF cep_number BETWEEN 19000 AND 19999 THEN RETURN 'Interior - RA Pres. Prudente'; END IF;
  
  -- Se não corresponder a nenhuma faixa de SP
  RETURN 'Outra Região';
END;
$function$;

-- Create trigger to automatically calculate regiao_logistica on insert/update
CREATE OR REPLACE FUNCTION public.set_regiao_logistica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  -- Calcular região logística baseado no CEP
  NEW.regiao_logistica := public.calculate_regiao_logistica(NEW.address_zip);
  RETURN NEW;
END;
$function$;

-- Create trigger on invoices table
DROP TRIGGER IF EXISTS trigger_set_regiao_logistica ON public.invoices;
CREATE TRIGGER trigger_set_regiao_logistica
BEFORE INSERT OR UPDATE OF address_zip ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_regiao_logistica();

-- Update existing invoices with regiao_logistica
UPDATE public.invoices 
SET regiao_logistica = public.calculate_regiao_logistica(address_zip)
WHERE regiao_logistica IS NULL;