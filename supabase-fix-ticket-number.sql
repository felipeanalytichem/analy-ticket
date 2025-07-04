-- =====================================================
-- CORREÇÃO DA NOMENCLATURA DOS TICKETS
-- Padrão: ACS-TK-YYYYMM-NNNNN
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Função para gerar ticket_number no padrão correto
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    year_month TEXT;
    seq INTEGER;
    new_ticket_number TEXT;
BEGIN
    -- Ano e mês atual (YYYYMM)
    year_month := TO_CHAR(NOW(), 'YYYYMM');

    -- Busca o próximo número sequencial para o mês atual
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'ACS-TK-' || year_month || '-(\d+)')::INTEGER)), 0) + 1
    INTO seq
    FROM tickets_new
    WHERE ticket_number LIKE 'ACS-TK-' || year_month || '-%';

    -- Se não encontrou nenhum, começa do 1
    IF seq IS NULL THEN
        seq := 1;
    END IF;

    -- Monta o ticket_number no padrão ACS-TK-YYYYMM-NNNNN
    new_ticket_number := 'ACS-TK-' || year_month || '-' || LPAD(seq::TEXT, 5, '0');
    
    RETURN new_ticket_number;
END;
$$ LANGUAGE plpgsql;

-- 2. Função do trigger para definir ticket_number automaticamente
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Se ticket_number não foi fornecido ou está vazio, gerar automaticamente
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar o trigger para garantir que funciona
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON public.tickets_new;
CREATE TRIGGER trigger_set_ticket_number
    BEFORE INSERT ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();

-- 4. Teste da função
DO $$
DECLARE
    test_number TEXT;
BEGIN
    test_number := generate_ticket_number();
    RAISE NOTICE 'Próximo ticket number será: %', test_number;
END
$$;

RAISE NOTICE 'Nomenclatura de tickets corrigida para o padrão ACS-TK-YYYYMM-NNNNN'; 