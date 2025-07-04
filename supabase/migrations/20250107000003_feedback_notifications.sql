-- Add feedback notification types
-- This migration adds new notification types for the feedback system

-- Add new notification types for feedback
DO $$ BEGIN
    -- Extend the notification_type enum with feedback-related types
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'feedback_request';
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'feedback_received';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to automatically request feedback when ticket is resolved or closed
CREATE OR REPLACE FUNCTION request_feedback_on_ticket_close()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if status changed to 'resolved' or 'closed'
    IF (NEW.status = 'resolved' OR NEW.status = 'closed') AND 
       (OLD.status IS NULL OR (OLD.status != 'resolved' AND OLD.status != 'closed')) THEN
        -- Insert feedback request notification for the ticket creator
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
            NEW.user_id,
            'feedback_request',
            'Avalie seu atendimento',
            'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.',
            'medium',
            NEW.id,
            FALSE,
            NOW()
        );
        
        -- Log the action
        RAISE NOTICE 'Feedback request notification created for user % on ticket %', NEW.user_id, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for feedback request on ticket close
DROP TRIGGER IF EXISTS trigger_request_feedback_on_close ON public.tickets_new;
CREATE TRIGGER trigger_request_feedback_on_close
    AFTER UPDATE ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION request_feedback_on_ticket_close();

-- Function to notify agents/admins when feedback is received
CREATE OR REPLACE FUNCTION notify_feedback_received()
RETURNS TRIGGER AS $$
DECLARE
    ticket_record RECORD;
    agent_id UUID;
    admin_user RECORD;
BEGIN
    -- Get ticket information
    SELECT * INTO ticket_record 
    FROM public.tickets_new 
    WHERE id = NEW.ticket_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
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
            'Você recebeu uma avaliação para o chamado ' || COALESCE(ticket_record.ticket_number, ticket_record.id) || '. Clique para ver os detalhes.',
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
                'Foi recebida uma avaliação para o chamado ' || COALESCE(ticket_record.ticket_number, ticket_record.id) || '. Clique para ver os detalhes.',
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

-- Create trigger for feedback received notifications
DROP TRIGGER IF EXISTS trigger_notify_feedback_received ON public.ticket_feedback;
CREATE TRIGGER trigger_notify_feedback_received
    AFTER INSERT ON public.ticket_feedback
    FOR EACH ROW
    EXECUTE FUNCTION notify_feedback_received(); 