-- =====================================================
-- CORREÇÃO DA FUNÇÃO LOG_TICKET_ACTIVITY
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Criar função log_ticket_activity que está faltando
CREATE OR REPLACE FUNCTION log_ticket_activity(
    p_ticket_id UUID,
    p_user_id UUID,
    p_action_type TEXT,
    p_field_name TEXT DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    activity_id UUID;
    user_name TEXT;
    ticket_number TEXT;
BEGIN
    -- Get user name for description
    SELECT full_name INTO user_name FROM users WHERE id = p_user_id;
    IF user_name IS NULL THEN
        user_name := 'Sistema';
    END IF;
    
    -- Get ticket number for description
    SELECT tickets_new.ticket_number INTO ticket_number FROM tickets_new WHERE id = p_ticket_id;
    
    -- Generate description if not provided
    IF p_description IS NULL THEN
        CASE p_action_type
            WHEN 'created' THEN p_description := 'Ticket criado por ' || user_name;
            WHEN 'status_changed' THEN p_description := 'Status alterado de "' || COALESCE(p_old_value, 'N/A') || '" para "' || COALESCE(p_new_value, 'N/A') || '" por ' || user_name;
            WHEN 'priority_changed' THEN p_description := 'Prioridade alterada de "' || COALESCE(p_old_value, 'N/A') || '" para "' || COALESCE(p_new_value, 'N/A') || '" por ' || user_name;
            WHEN 'assigned' THEN p_description := 'Ticket atribuído para ' || COALESCE(p_new_value, 'N/A') || ' por ' || user_name;
            WHEN 'unassigned' THEN p_description := 'Atribuição removida por ' || user_name;
            WHEN 'comment_added' THEN p_description := 'Comentário adicionado por ' || user_name;
            WHEN 'resolution_added' THEN p_description := 'Resolução adicionada por ' || user_name;
            WHEN 'reopened' THEN p_description := 'Ticket reaberto por ' || user_name;
            WHEN 'closed' THEN p_description := 'Ticket fechado por ' || user_name;
            WHEN 'feedback_received' THEN p_description := 'Feedback recebido de ' || user_name;
            ELSE p_description := p_action_type || ' por ' || user_name;
        END CASE;
    END IF;
    
    -- Insert activity log
    INSERT INTO ticket_activity_logs (
        ticket_id, user_id, action_type, field_name, 
        old_value, new_value, description, metadata
    ) VALUES (
        p_ticket_id, p_user_id, p_action_type, p_field_name,
        p_old_value, p_new_value, p_description, p_metadata
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Se der erro, não interromper a operação principal
        RAISE WARNING 'Erro ao criar log de atividade: %', SQLERRM;
        RETURN NULL;
END;
$$;

-- 2. Corrigir função trigger_log_ticket_activity para usar tipos corretos
CREATE OR REPLACE FUNCTION public.trigger_log_ticket_activity()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    activity_user_id UUID;
BEGIN
    -- Get current user ID (might be null for system operations)
    activity_user_id := auth.uid();
    
    -- Handle INSERT (ticket creation)
    IF TG_OP = 'INSERT' THEN
        PERFORM log_ticket_activity(
            NEW.id,
            COALESCE(activity_user_id, NEW.user_id),
            'created',
            NULL,
            NULL,
            NULL,
            NULL,
            jsonb_build_object('title', NEW.title, 'priority', NEW.priority::TEXT, 'status', NEW.status::TEXT)
        );
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Status change
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            PERFORM log_ticket_activity(
                NEW.id,
                COALESCE(activity_user_id, NEW.user_id),
                'status_changed',
                'status',
                OLD.status::TEXT,
                NEW.status::TEXT
            );
        END IF;
        
        -- Priority change
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            PERFORM log_ticket_activity(
                NEW.id,
                COALESCE(activity_user_id, NEW.user_id),
                'priority_changed',
                'priority',
                OLD.priority::TEXT,
                NEW.priority::TEXT
            );
        END IF;
        
        -- Assignment change
        IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            DECLARE
                old_assignee_name TEXT;
                new_assignee_name TEXT;
            BEGIN
                -- Get assignee names
                IF OLD.assigned_to IS NOT NULL THEN
                    SELECT full_name INTO old_assignee_name FROM users WHERE id = OLD.assigned_to;
                END IF;
                IF NEW.assigned_to IS NOT NULL THEN
                    SELECT full_name INTO new_assignee_name FROM users WHERE id = NEW.assigned_to;
                END IF;
                
                IF NEW.assigned_to IS NULL THEN
                    PERFORM log_ticket_activity(
                        NEW.id,
                        COALESCE(activity_user_id, NEW.user_id),
                        'unassigned',
                        'assigned_to',
                        old_assignee_name,
                        NULL
                    );
                ELSE
                    PERFORM log_ticket_activity(
                        NEW.id,
                        COALESCE(activity_user_id, NEW.user_id),
                        'assigned',
                        'assigned_to',
                        old_assignee_name,
                        new_assignee_name
                    );
                END IF;
            END;
        END IF;
        
        -- Resolution added
        IF OLD.resolution IS NULL AND NEW.resolution IS NOT NULL THEN
            PERFORM log_ticket_activity(
                NEW.id,
                COALESCE(activity_user_id, NEW.resolved_by),
                'resolution_added',
                'resolution',
                NULL,
                LEFT(NEW.resolution, 100) || CASE WHEN LENGTH(NEW.resolution) > 100 THEN '...' ELSE '' END
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- 3. Verificar se a tabela ticket_activity_logs existe
CREATE TABLE IF NOT EXISTS public.ticket_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar RLS na tabela de logs
ALTER TABLE public.ticket_activity_logs ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS para logs
CREATE POLICY IF NOT EXISTS "Users can view activity logs for accessible tickets" ON public.ticket_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tickets_new t
            WHERE t.id = ticket_id AND (
                t.user_id = auth.uid() OR 
                t.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND role IN ('agent', 'admin')
                )
            )
        )
    );

RAISE NOTICE 'Função log_ticket_activity criada e trigger corrigido com sucesso!'; 