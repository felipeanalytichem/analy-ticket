-- Create activity logs table for ticket history tracking
CREATE TABLE IF NOT EXISTS public.ticket_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'created', 'status_changed', 'priority_changed', 'assigned', 
        'unassigned', 'comment_added', 'resolution_added', 'reopened',
        'closed', 'feedback_received', 'category_changed', 'title_changed',
        'description_changed'
    )),
    field_name TEXT, -- Field that was changed (status, priority, etc.)
    old_value TEXT, -- Previous value
    new_value TEXT, -- New value
    description TEXT, -- Human readable description
    metadata JSONB, -- Additional data (e.g., comment_id, attachment info)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ticket_activity_logs_ticket_id ON public.ticket_activity_logs(ticket_id);
CREATE INDEX idx_ticket_activity_logs_user_id ON public.ticket_activity_logs(user_id);
CREATE INDEX idx_ticket_activity_logs_action_type ON public.ticket_activity_logs(action_type);
CREATE INDEX idx_ticket_activity_logs_created_at ON public.ticket_activity_logs(created_at);

-- RLS Policies for activity logs
ALTER TABLE public.ticket_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs for tickets they have access to
CREATE POLICY "Users can view activity logs for accessible tickets" ON public.ticket_activity_logs
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

-- Only system functions can insert activity logs (via SECURITY DEFINER functions)
CREATE POLICY "Activity logs can only be inserted by system" ON public.ticket_activity_logs
    FOR INSERT WITH CHECK (false); -- Block direct inserts

-- Function to log ticket activity
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
END;
$$;

-- Trigger function to automatically log ticket changes
CREATE OR REPLACE FUNCTION trigger_log_ticket_activity()
RETURNS TRIGGER
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
            jsonb_build_object('title', NEW.title, 'priority', NEW.priority, 'status', NEW.status)
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
                OLD.status,
                NEW.status
            );
        END IF;
        
        -- Priority change
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            PERFORM log_ticket_activity(
                NEW.id,
                COALESCE(activity_user_id, NEW.user_id),
                'priority_changed',
                'priority',
                OLD.priority,
                NEW.priority
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
        
        -- Reopened
        IF OLD.status IN ('resolved', 'closed') AND NEW.status = 'open' THEN
            PERFORM log_ticket_activity(
                NEW.id,
                COALESCE(activity_user_id, NEW.reopened_by),
                'reopened',
                NULL,
                NULL,
                NULL,
                NULL,
                jsonb_build_object('reason', NEW.reopen_reason)
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create trigger on tickets table
DROP TRIGGER IF EXISTS ticket_activity_log_trigger ON public.tickets_new;
CREATE TRIGGER ticket_activity_log_trigger
    AFTER INSERT OR UPDATE ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_ticket_activity();

-- Function to log comment activity
CREATE OR REPLACE FUNCTION log_comment_activity(comment_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    comment_rec RECORD;
BEGIN
    SELECT tc.ticket_id, tc.user_id, tc.is_internal
    INTO comment_rec
    FROM ticket_comments_new tc
    WHERE tc.id = comment_id;
    
    IF FOUND THEN
        PERFORM log_ticket_activity(
            comment_rec.ticket_id,
            comment_rec.user_id,
            'comment_added',
            NULL,
            NULL,
            NULL,
            NULL,
            jsonb_build_object('comment_id', comment_id, 'is_internal', comment_rec.is_internal)
        );
    END IF;
END;
$$;

-- Trigger for comment logging
CREATE OR REPLACE FUNCTION trigger_log_comment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_comment_activity(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger on comments table
DROP TRIGGER IF EXISTS comment_activity_log_trigger ON public.ticket_comments_new;
CREATE TRIGGER comment_activity_log_trigger
    AFTER INSERT ON public.ticket_comments_new
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_comment_activity();

-- Function to log feedback activity
CREATE OR REPLACE FUNCTION log_feedback_activity(feedback_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    feedback_rec RECORD;
BEGIN
    SELECT tf.ticket_id, tf.user_id, tf.rating, tf.satisfaction
    INTO feedback_rec
    FROM ticket_feedback tf
    WHERE tf.id = feedback_id;
    
    IF FOUND THEN
        PERFORM log_ticket_activity(
            feedback_rec.ticket_id,
            feedback_rec.user_id,
            'feedback_received',
            NULL,
            NULL,
            feedback_rec.rating || ' estrelas (' || feedback_rec.satisfaction || ')',
            NULL,
            jsonb_build_object('feedback_id', feedback_id, 'rating', feedback_rec.rating, 'satisfaction', feedback_rec.satisfaction)
        );
    END IF;
END;
$$;

-- Trigger for feedback logging
CREATE OR REPLACE FUNCTION trigger_log_feedback_activity()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_feedback_activity(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger on feedback table
DROP TRIGGER IF EXISTS feedback_activity_log_trigger ON public.ticket_feedback;
CREATE TRIGGER feedback_activity_log_trigger
    AFTER INSERT ON public.ticket_feedback
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_feedback_activity(); 