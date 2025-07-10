-- =====================================================
-- CORREÇÃO DO ERRO COALESCE NA FUNÇÃO DE FEEDBACK
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- Corrigir função notify_feedback_received para resolver erro de COALESCE
CREATE OR REPLACE FUNCTION notify_feedback_received()
RETURNS TRIGGER AS $$
DECLARE
    ticket_record RECORD;
    agent_id UUID;
    admin_user RECORD;
    ticket_identifier TEXT;
BEGIN
    -- Get ticket information
    SELECT * INTO ticket_record 
    FROM public.tickets_new 
    WHERE id = NEW.ticket_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Create ticket identifier (convert UUID to text if needed)
    ticket_identifier := COALESCE(ticket_record.ticket_number, ticket_record.id::TEXT);
    
    -- Notify the assigned agent (if exists)
    IF ticket_record.assigned_to IS NOT NULL THEN
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
            ticket_record.assigned_to,
            'feedback_received',
            'Feedback recebido',
            'Você recebeu uma avaliação para o chamado ' || ticket_identifier || '. Clique para ver os detalhes.',
            'medium',
            NEW.ticket_id,
            FALSE,
            NOW()
        );
    END IF;
    
    -- Notify all admins
    FOR admin_user IN 
        SELECT id FROM public.users WHERE role = 'admin'
    LOOP
        -- Don't duplicate notification if admin is also the assigned agent
        IF admin_user.id != ticket_record.assigned_to THEN
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
                admin_user.id,
                'feedback_received',
                'Feedback recebido',
                'Foi recebida uma avaliação para o chamado ' || ticket_identifier || '. Clique para ver os detalhes.',
                'low',
                NEW.ticket_id,
                FALSE,
                NOW()
            );
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Feedback received notifications sent for ticket %', NEW.ticket_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mensagem de sucesso
SELECT 'Função notify_feedback_received corrigida com sucesso!' as status; 