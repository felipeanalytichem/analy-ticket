-- =====================================================
-- FECHAMENTO AUTOMÁTICO DE TICKETS RESOLVED APÓS 2 DIAS
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- Função para fechar automaticamente tickets resolved há mais de 2 dias
CREATE OR REPLACE FUNCTION auto_close_resolved_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ticket_record RECORD;
    closed_count INTEGER := 0;
BEGIN
    -- Buscar tickets que estão resolved há mais de 2 dias
    FOR ticket_record IN 
        SELECT id, title, ticket_number, user_id, resolved_at, resolved_by
        FROM public.tickets_new 
        WHERE status = 'resolved' 
        AND resolved_at IS NOT NULL
        AND resolved_at < NOW() - INTERVAL '2 days'
    LOOP
        -- Fechar o ticket automaticamente
        UPDATE public.tickets_new 
        SET 
            status = 'closed',
            closed_at = NOW(),
            closed_by = resolved_by, -- Usar o mesmo usuário que resolveu
            updated_at = NOW()
        WHERE id = ticket_record.id;
        
        -- Criar notificação para o usuário
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            priority,
            ticket_id,
            read,
            created_at
        ) VALUES (
            ticket_record.user_id,
            'status_changed',
            'Ticket Fechado Automaticamente',
            'Seu ticket ' || COALESCE(ticket_record.ticket_number, ticket_record.id::TEXT) || ' foi fechado automaticamente após 2 dias de resolução.',
            'low',
            ticket_record.id,
            FALSE,
            NOW()
        );
        
        -- Log da atividade
        PERFORM log_ticket_activity(
            ticket_record.id,
            ticket_record.resolved_by,
            'closed',
            'status',
            'resolved',
            'closed',
            'Ticket fechado automaticamente após 2 dias de resolução',
            jsonb_build_object('auto_closed', true, 'reason', 'auto_close_after_2_days')
        );
        
        closed_count := closed_count + 1;
        
        RAISE NOTICE 'Ticket % fechado automaticamente', COALESCE(ticket_record.ticket_number, ticket_record.id::TEXT);
    END LOOP;
    
    RAISE NOTICE 'Total de tickets fechados automaticamente: %', closed_count;
    RETURN closed_count;
END;
$$;

-- Criar extensão pg_cron se não existir (para agendamento)
-- Nota: Esta extensão precisa ser habilitada pelo administrador do Supabase
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar a função para executar diariamente às 02:00
-- Descomente a linha abaixo após habilitar pg_cron
-- SELECT cron.schedule('auto-close-resolved-tickets', '0 2 * * *', 'SELECT auto_close_resolved_tickets();');

-- Função alternativa usando trigger para verificar na atualização de tickets
CREATE OR REPLACE FUNCTION check_auto_close_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se o ticket foi marcado como resolved, agendar verificação futura
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        -- Criar uma entrada na tabela de agendamentos (implementação alternativa)
        INSERT INTO public.auto_close_schedule (
            ticket_id,
            scheduled_close_at,
            created_at
        ) VALUES (
            NEW.id,
            NOW() + INTERVAL '2 days',
            NOW()
        )
        ON CONFLICT (ticket_id) DO UPDATE SET
            scheduled_close_at = NOW() + INTERVAL '2 days',
            created_at = NOW();
    END IF;
    
    -- Se o ticket foi reaberto, cancelar agendamento
    IF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
        DELETE FROM public.auto_close_schedule WHERE ticket_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar tabela para agendamento de fechamento automático
CREATE TABLE IF NOT EXISTS public.auto_close_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
    scheduled_close_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticket_id)
);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_auto_close_schedule_time ON public.auto_close_schedule(scheduled_close_at);

-- Criar trigger para agendar fechamento automático
DROP TRIGGER IF EXISTS trigger_schedule_auto_close ON public.tickets_new;
CREATE TRIGGER trigger_schedule_auto_close
    AFTER UPDATE ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION check_auto_close_on_update();

-- Função para processar agendamentos pendentes (alternativa ao cron)
CREATE OR REPLACE FUNCTION process_auto_close_schedule()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    schedule_record RECORD;
    closed_count INTEGER := 0;
BEGIN
    -- Processar tickets agendados para fechamento
    FOR schedule_record IN 
        SELECT s.*, t.title, t.ticket_number, t.user_id, t.resolved_by, t.status
        FROM public.auto_close_schedule s
        JOIN public.tickets_new t ON s.ticket_id = t.id
        WHERE s.scheduled_close_at <= NOW()
        AND t.status = 'resolved'
    LOOP
        -- Fechar o ticket
        UPDATE public.tickets_new 
        SET 
            status = 'closed',
            closed_at = NOW(),
            closed_by = schedule_record.resolved_by,
            updated_at = NOW()
        WHERE id = schedule_record.ticket_id;
        
        -- Criar notificação
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            priority,
            ticket_id,
            read,
            created_at
        ) VALUES (
            schedule_record.user_id,
            'status_changed',
            'Ticket Fechado Automaticamente',
            'Seu ticket ' || COALESCE(schedule_record.ticket_number, schedule_record.ticket_id::TEXT) || ' foi fechado automaticamente após 2 dias de resolução.',
            'low',
            schedule_record.ticket_id,
            FALSE,
            NOW()
        );
        
        -- Log da atividade
        PERFORM log_ticket_activity(
            schedule_record.ticket_id,
            schedule_record.resolved_by,
            'closed',
            'status',
            'resolved',
            'closed',
            'Ticket fechado automaticamente após 2 dias de resolução',
            jsonb_build_object('auto_closed', true, 'reason', 'auto_close_after_2_days')
        );
        
        -- Remover da agenda
        DELETE FROM public.auto_close_schedule WHERE id = schedule_record.id;
        
        closed_count := closed_count + 1;
        
        RAISE NOTICE 'Ticket % fechado automaticamente', COALESCE(schedule_record.ticket_number, schedule_record.ticket_id::TEXT);
    END LOOP;
    
    RAISE NOTICE 'Total de tickets fechados automaticamente: %', closed_count;
    RETURN closed_count;
END;
$$;

-- Habilitar RLS na tabela de agendamento
ALTER TABLE public.auto_close_schedule ENABLE ROW LEVEL SECURITY;

-- Política RLS para agendamento (apenas sistema pode acessar)
CREATE POLICY "Only system can access auto close schedule" ON public.auto_close_schedule
    FOR ALL USING (false);

-- Comentários e instruções
COMMENT ON FUNCTION auto_close_resolved_tickets() IS 'Fecha automaticamente tickets que estão resolved há mais de 2 dias';
COMMENT ON FUNCTION process_auto_close_schedule() IS 'Processa agendamentos de fechamento automático (alternativa ao cron)';
COMMENT ON TABLE public.auto_close_schedule IS 'Tabela para agendar fechamento automático de tickets resolved';

-- Mensagem de sucesso
SELECT 'Sistema de fechamento automático configurado com sucesso!' as status,
       'Execute process_auto_close_schedule() periodicamente ou configure cron job' as instrucoes; 