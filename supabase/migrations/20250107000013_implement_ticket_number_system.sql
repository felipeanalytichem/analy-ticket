-- Implementar sistema de numeração de tickets ACS-TK-AAAAMM-NNNN
-- Formato: ACS-TK-202501-0001 (prefixo + ano/mês + sequencial de 4 dígitos)

-- Criar tabela para controlar sequência mensal
CREATE TABLE IF NOT EXISTS ticket_sequences (
    year_month TEXT PRIMARY KEY, -- formato YYYYMM
    last_sequence INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela ticket_sequences
ALTER TABLE ticket_sequences ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura e escrita para usuários autenticados
CREATE POLICY "Users can read ticket sequences" ON ticket_sequences
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert ticket sequences" ON ticket_sequences
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update ticket sequences" ON ticket_sequences
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Função para gerar número do ticket no formato ACS-TK-AAAAMM-NNNN
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    current_year_month TEXT;
    next_sequence INTEGER;
    ticket_number TEXT;
BEGIN
    -- Obter ano e mês atual no formato YYYYMM
    current_year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    -- Inserir ou atualizar a sequência para o mês atual
    INSERT INTO ticket_sequences (year_month, last_sequence)
    VALUES (current_year_month, 1)
    ON CONFLICT (year_month)
    DO UPDATE SET 
        last_sequence = ticket_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_sequence;
    
    -- Gerar o número do ticket no formato ACS-TK-AAAAMM-NNNN
    ticket_number := 'ACS-TK-' || current_year_month || '-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN ticket_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para gerar automaticamente o ticket_number ao inserir um novo ticket
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

-- Criar trigger para executar antes de inserir um ticket
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON tickets_new;
CREATE TRIGGER trigger_set_ticket_number
    BEFORE INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();

-- Atualizar tickets existentes que não têm ticket_number ou têm formato antigo
UPDATE tickets_new 
SET ticket_number = generate_ticket_number()
WHERE ticket_number IS NULL 
   OR ticket_number = '' 
   OR NOT ticket_number ~ '^ACS-TK-[0-9]{6}-[0-9]{4}$'; 