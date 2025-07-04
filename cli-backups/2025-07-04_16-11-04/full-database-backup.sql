

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'Final RLS fix applied - all recursion eliminated';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."notification_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE "public"."notification_priority" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'ticket_created',
    'ticket_updated',
    'ticket_assigned',
    'comment_added',
    'status_changed',
    'priority_changed',
    'feedback_request',
    'feedback_received',
    'task_assigned',
    'task_overdue',
    'task_completed',
    'task_commented',
    'closed'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."ticket_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE "public"."ticket_priority" OWNER TO "postgres";


CREATE TYPE "public"."ticket_status" AS ENUM (
    'open',
    'pending',
    'in_progress',
    'resolved',
    'closed'
);


ALTER TYPE "public"."ticket_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'agent',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_initial_chat_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_ticket_user_id UUID;
    v_ticket_assigned_to UUID;
BEGIN
    -- Get ticket details using the correct column names
    SELECT user_id, assigned_to
    INTO v_ticket_user_id, v_ticket_assigned_to
    FROM tickets_new
    WHERE id = NEW.ticket_id;

    -- Add ticket creator if found
    IF v_ticket_user_id IS NOT NULL THEN
        INSERT INTO chat_participants (
            chat_id,
            user_id,
            can_write,
            joined_at
        ) VALUES (
            NEW.id,
            v_ticket_user_id,
            true,
            NOW()
        ) ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;

    -- Add assigned agent if exists and different from creator
    IF v_ticket_assigned_to IS NOT NULL AND v_ticket_assigned_to != v_ticket_user_id THEN
        INSERT INTO chat_participants (
            chat_id,
            user_id,
            can_write,
            joined_at
        ) VALUES (
            NEW.id,
            v_ticket_assigned_to,
            true,
            NOW()
        ) ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add participants to chat %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_initial_chat_participants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assigned_agent"("p_ticket_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT assigned_to FROM public.tickets_new WHERE id = p_ticket_id;
$$;


ALTER FUNCTION "public"."assigned_agent"("p_ticket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_close_resolved_tickets"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket_title TEXT;
    v_ticket_number TEXT;
    v_user_id UUID;
    v_resolved_at TIMESTAMPTZ;
    v_resolved_by UUID;
    closed_count INTEGER := 0;
BEGIN
    -- Use a cursor to loop through tickets safely
    FOR v_ticket_id, v_ticket_title, v_ticket_number, v_user_id, v_resolved_at, v_resolved_by IN
        SELECT id, title, ticket_number, user_id, resolved_at, resolved_by
        FROM public.tickets_new
        WHERE status = 'resolved'
        AND resolved_at < NOW() - INTERVAL '2 days'
    LOOP
        -- Update the ticket status to 'closed'
        UPDATE public.tickets_new
        SET status = 'closed', closed_at = NOW(), closed_by = v_resolved_by, updated_at = NOW()
        WHERE id = v_ticket_id;

        -- Create a notification for the user
        INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
        VALUES (v_user_id, 'status_changed', 'Ticket Fechado Automaticamente',
                'Seu ticket ' || COALESCE(v_ticket_number, v_ticket_id::TEXT) || ' foi fechado automaticamente.',
                'low', v_ticket_id);

        closed_count := closed_count + 1;
    END LOOP;

    RETURN closed_count;
END;
$$;


ALTER FUNCTION "public"."auto_close_resolved_tickets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_reading_time"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.reading_time_minutes := GREATEST(1,
    CEIL(
      ARRAY_LENGTH(
        REGEXP_SPLIT_TO_ARRAY(
          REGEXP_REPLACE(NEW.content, '<[^>]*>', '', 'g'),
          '\s+'
        ),
        1
      )::FLOAT / 200
    )::INTEGER
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_reading_time"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_sla_elapsed_time"("p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_business_hours_only" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_elapsed INTEGER;
    v_pause_duration INTEGER;
BEGIN
    -- Get total pause duration from pause periods
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (
            LEAST(end_time, p_end_time) - 
            GREATEST(start_time, p_start_time)
        ))/60
    )::INTEGER, 0)
    INTO v_pause_duration
    FROM sla_pause_periods
    WHERE start_time < p_end_time 
    AND end_time > p_start_time;

    IF p_business_hours_only THEN
        -- Calculate elapsed time only during business hours
        WITH time_ranges AS (
            SELECT 
                generate_series(
                    date_trunc('day', p_start_time),
                    date_trunc('day', p_end_time),
                    '1 day'::interval
                ) AS day
        )
        SELECT COALESCE(SUM(
            CASE 
                WHEN bh.is_working_day THEN
                    LEAST(
                        EXTRACT(EPOCH FROM (
                            LEAST(
                                p_end_time,
                                day + bh.end_time::interval
                            ) -
                            GREATEST(
                                p_start_time,
                                day + bh.start_time::interval
                            )
                        ))/60,
                        EXTRACT(EPOCH FROM (bh.end_time - bh.start_time))/60
                    )::INTEGER
                ELSE 0
            END
        ), 0)
        INTO v_elapsed
        FROM time_ranges tr
        JOIN business_hours bh ON bh.day_of_week = EXTRACT(DOW FROM tr.day);
    ELSE
        -- Calculate total elapsed time
        v_elapsed := EXTRACT(EPOCH FROM (p_end_time - p_start_time))/60;
    END IF;

    -- Subtract pause duration
    RETURN GREATEST(v_elapsed - v_pause_duration, 0);
END;
$$;


ALTER FUNCTION "public"."calculate_sla_elapsed_time"("p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_business_hours_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_ticket_sla"("p_ticket_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_priority text;
    v_created_at timestamp with time zone;
    v_response_time interval;
    v_resolution_time interval;
    v_first_response timestamp with time zone;
    v_status text;
BEGIN
    -- Get ticket details
    SELECT 
        priority::text,
        created_at,
        status::text
    INTO 
        v_priority,
        v_created_at,
        v_status
    FROM tickets_new 
    WHERE id = p_ticket_id;

    -- Set SLA times based on priority
    CASE v_priority
        WHEN 'urgent' THEN
            v_response_time := interval '1 hour';
            v_resolution_time := interval '4 hours';
        WHEN 'high' THEN
            v_response_time := interval '2 hours';
            v_resolution_time := interval '8 hours';
        WHEN 'medium' THEN
            v_response_time := interval '4 hours';
            v_resolution_time := interval '24 hours';
        ELSE -- low
            v_response_time := interval '8 hours';
            v_resolution_time := interval '48 hours';
    END CASE;

    -- Get first response time
    SELECT MIN(tal.created_at)
    INTO v_first_response
    FROM ticket_activity_logs tal
    JOIN users u ON u.id = tal.user_id
    WHERE tal.ticket_id = p_ticket_id
    AND tal.action_type IN ('comment', 'status_change')
    AND u.role IN ('agent', 'admin');

    -- Update SLA status
    UPDATE tickets_new
    SET 
        sla_response_due = v_created_at + v_response_time,
        sla_resolution_due = v_created_at + v_resolution_time,
        first_response_at = v_first_response,
        sla_response_met = CASE 
            WHEN v_first_response IS NOT NULL THEN
                v_first_response <= (v_created_at + v_response_time)
            ELSE NULL
        END,
        sla_resolution_met = CASE 
            WHEN v_status = 'resolved' OR v_status = 'closed' THEN
                NOW() <= (v_created_at + v_resolution_time)
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = p_ticket_id;
END;
$$;


ALTER FUNCTION "public"."calculate_ticket_sla"("p_ticket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_update_sla_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_sla_rule RECORD;
    v_elapsed_response INTEGER;
    v_elapsed_resolution INTEGER;
    v_response_status VARCHAR(50);
    v_resolution_status VARCHAR(50);
BEGIN
    -- Get applicable SLA rule
    SELECT * FROM sla_rules 
    WHERE priority = NEW.priority AND is_active = true 
    INTO v_sla_rule;

    IF v_sla_rule IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate elapsed times
    IF NEW.first_response_at IS NULL THEN
        v_elapsed_response := calculate_sla_elapsed_time(
            NEW.created_at, 
            NOW(), 
            v_sla_rule.business_hours_only
        );
        
        -- Determine response status
        IF v_elapsed_response >= v_sla_rule.response_time * 60 THEN
            v_response_status := 'overdue';
        ELSIF v_elapsed_response >= v_sla_rule.response_time * 60 * v_sla_rule.warning_threshold / 100 THEN
            v_response_status := 'warning';
        ELSE
            v_response_status := 'ok';
        END IF;

        -- Insert into SLA history
        INSERT INTO sla_history (
            ticket_id,
            status_type,
            status,
            elapsed_time,
            target_time
        ) VALUES (
            NEW.id,
            'response',
            v_response_status,
            v_elapsed_response,
            v_sla_rule.response_time * 60
        );
    END IF;

    IF NEW.status NOT IN ('resolved', 'closed') THEN
        v_elapsed_resolution := calculate_sla_elapsed_time(
            NEW.created_at, 
            NOW(), 
            v_sla_rule.business_hours_only
        );
        
        -- Determine resolution status
        IF v_elapsed_resolution >= v_sla_rule.resolution_time * 60 THEN
            v_resolution_status := 'overdue';
        ELSIF v_elapsed_resolution >= v_sla_rule.resolution_time * 60 * v_sla_rule.warning_threshold / 100 THEN
            v_resolution_status := 'warning';
        ELSE
            v_resolution_status := 'ok';
        END IF;

        -- Insert into SLA history
        INSERT INTO sla_history (
            ticket_id,
            status_type,
            status,
            elapsed_time,
            target_time
        ) VALUES (
            NEW.id,
            'resolution',
            v_resolution_status,
            v_elapsed_resolution,
            v_sla_rule.resolution_time * 60
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_and_update_sla_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_overdue_tasks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_task_id uuid;
    v_task_title text;
    v_assigned_user_id uuid;
    v_ticket_id uuid;
    v_ticket_number text;
BEGIN
    FOR v_task_id, v_task_title, v_assigned_user_id, v_ticket_id, v_ticket_number IN
        SELECT t.id, t.title, t.assigned_to, t.ticket_id, tn.ticket_number
        FROM public.ticket_tasks t JOIN public.tickets_new tn ON t.ticket_id = tn.id
        WHERE t.due_date < NOW() AND t.status <> 'done' AND t.assigned_to IS NOT NULL
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE user_id = v_assigned_user_id
              AND type = 'task_overdue'
              AND ticket_id = v_ticket_id
              AND created_at > NOW() - INTERVAL '1 day'
        ) THEN
            INSERT INTO public.notifications (user_id, type, title, message, ticket_id, priority)
            VALUES (v_assigned_user_id, 'task_overdue', 'Task Overdue',
                    'Task "' || v_task_title || '" on ticket #' || v_ticket_number || ' is overdue.',
                    v_ticket_id, 'high');
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."check_overdue_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_temporary_password"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.users 
    SET 
        temporary_password = NULL,
        temporary_password_created_at = NULL,
        temporary_password_expires_at = NULL,
        must_change_password = FALSE,
        last_password_change = NOW(),
        updated_at = NOW()
    WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."clear_temporary_password"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_article_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only create version for published articles
    IF NEW.status = 'published' AND (
        OLD.status != 'published' OR
        OLD.title != NEW.title OR
        OLD.content != NEW.content OR
        OLD.excerpt != NEW.excerpt
    ) THEN
        INSERT INTO public.knowledge_article_versions (
            article_id,
            title,
            content,
            excerpt,
            version,
            changes_description,
            created_by
        ) VALUES (
            NEW.id,
            NEW.title,
            NEW.content,
            NEW.excerpt,
            NEW.version,
            'Article published or updated',
            auth.uid()
        );
        
        -- Increment version number
        NEW.version := NEW.version + 1;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_article_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_feedback_request_notification"("p_ticket_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_ticket_number text;
    v_title text;
    notification_id UUID;
BEGIN
    -- Get ticket information
    SELECT ticket_number, title 
    INTO v_ticket_number, v_title
    FROM public.tickets_new
    WHERE id = p_ticket_id;
    
    -- Create notification using the generic function
    SELECT create_notification(
        p_user_id,
        'status_changed',
        'Avalie seu atendimento',
        'Seu chamado #' || COALESCE(v_ticket_number, p_ticket_id::text) || ' foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.',
        'medium',
        p_ticket_id
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_feedback_request_notification"("p_ticket_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text" DEFAULT 'medium'::"text", "p_ticket_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    notification_id UUID;
BEGIN
    -- Insert notification directly
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
        p_user_id,
        p_type::notification_type,
        p_title,
        p_message,
        p_priority::notification_priority,
        p_ticket_id,
        FALSE,
        NOW()
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text", "p_ticket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ticket_chat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Simple insert without any complex logic
    INSERT INTO ticket_chats (
        ticket_id,
        chat_type,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        'ticket',
        true,
        NOW(),
        NOW()
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_ticket_chat"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ticket_notification"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text" DEFAULT 'medium'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO notifications (
    ticket_id,
    user_id,
    type,
    title,
    message,
    priority,
    read,
    created_at,
    updated_at
  )
  VALUES (
    p_ticket_id,
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_priority,
    false,
    NOW(),
    NOW()
  );
END;
$$;


ALTER FUNCTION "public"."create_ticket_notification"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_by_admin"("user_email" "text", "user_name" "text", "user_role" "text" DEFAULT 'user'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if current user is admin using the helper function
    IF NOT is_admin_user(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    -- Validate role parameter
    IF user_role NOT IN ('user', 'agent', 'admin') THEN
        RAISE EXCEPTION 'Invalid role. Must be one of: user, agent, admin';
    END IF;
    
    -- Generate a new UUID for the user
    new_user_id := gen_random_uuid();
    
    -- Insert the new user with proper role casting
    INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
    VALUES (
        new_user_id, 
        user_email, 
        user_name, 
        user_role::user_role,  -- Cast text to user_role enum
        NOW(), 
        NOW()
    );
    
    RETURN new_user_id;
END;
$$;


ALTER FUNCTION "public"."create_user_by_admin"("user_email" "text", "user_name" "text", "user_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_user_by_admin"("user_email" "text", "user_name" "text", "user_role" "text") IS 'Helper function for admins to create new users with proper role type casting';



CREATE OR REPLACE FUNCTION "public"."create_user_mention"("p_message_id" "uuid", "p_mentioned_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_sender_id uuid;
    v_mentioned_user_exists boolean;
BEGIN
    SELECT sender_id INTO v_sender_id FROM public.chat_messages WHERE id = p_message_id;
    IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Message not found.'; END IF;

    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_mentioned_user_id) INTO v_mentioned_user_exists;
    IF NOT v_mentioned_user_exists THEN RAISE EXCEPTION 'Mentioned user not found.'; END IF;

    INSERT INTO public.chat_message_mentions (message_id, mentioned_user_id)
    VALUES (p_message_id, p_mentioned_user_id) ON CONFLICT (message_id, mentioned_user_id) DO NOTHING;
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."create_user_mention"("p_message_id" "uuid", "p_mentioned_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_chat_on_ticket_closure"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if status changed to closed
  IF NEW.status::text = 'closed' AND (OLD.status IS NULL OR OLD.status::text != 'closed') THEN
    -- Disable chat for this ticket
    UPDATE ticket_chats tc
    SET is_active = false,
        updated_at = NOW()
    WHERE tc.ticket_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."disable_chat_on_ticket_closure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exec_sql"("sql" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE sql;
END;
$$;


ALTER FUNCTION "public"."exec_sql"("sql" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_article_slug"("title" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER;
BEGIN
    -- Convert to lowercase and replace spaces and special chars with hyphens
    base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    
    -- Try the base slug first
    final_slug := base_slug;
    counter := 1;
    
    -- If slug exists, append numbers until we find a unique one
    WHILE EXISTS (
        SELECT 1 FROM public.knowledge_articles WHERE slug = final_slug
    ) LOOP
        final_slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_article_slug"("title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_slug"("title" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
END;
$$;


ALTER FUNCTION "public"."generate_slug"("title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_temporary_password"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    -- Generate 8 character alphanumeric password
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_temporary_password"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ticket_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_ticket_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feedback_statistics"("agent_uuid" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_feedback', COUNT(*),
        'average_rating', ROUND(AVG(rating)::numeric, 2),
        'satisfaction_breakdown', json_build_object(
            'satisfied', COUNT(*) FILTER (WHERE satisfaction = 'satisfied'),
            'neutral', COUNT(*) FILTER (WHERE satisfaction = 'neutral'),
            'unsatisfied', COUNT(*) FILTER (WHERE satisfaction = 'unsatisfied')
        ),
        'rating_breakdown', json_build_object(
            'rating_5', COUNT(*) FILTER (WHERE rating = 5),
            'rating_4', COUNT(*) FILTER (WHERE rating = 4),
            'rating_3', COUNT(*) FILTER (WHERE rating = 3),
            'rating_2', COUNT(*) FILTER (WHERE rating = 2),
            'rating_1', COUNT(*) FILTER (WHERE rating = 1)
        )
    ) INTO result
    FROM public.ticket_feedback
    WHERE agent_uuid IS NULL OR agent_name = (
        SELECT full_name FROM public.users WHERE id = agent_uuid
    );
    
    RETURN COALESCE(result, '{}'::json);
END;
$$;


ALTER FUNCTION "public"."get_feedback_statistics"("agent_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_chat"("other_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    chat_id UUID;
    user1_id UUID := auth.uid();
    user2_id UUID := other_user_id;
    temp_id UUID;
BEGIN
    -- Ensure user1_id < user2_id for consistent ordering
    IF user1_id > user2_id THEN
        temp_id := user1_id;
        user1_id := user2_id;
        user2_id := temp_id;
    END IF;
    
    -- Try to find existing chat
    SELECT id INTO chat_id
    FROM public.direct_chats
    WHERE participant_1_id = user1_id AND participant_2_id = user2_id
    AND is_active = true;
    
    -- If not found, create new chat
    IF chat_id IS NULL THEN
        INSERT INTO public.direct_chats (participant_1_id, participant_2_id)
        VALUES (user1_id, user2_id)
        RETURNING id INTO chat_id;
    END IF;
    
    RETURN chat_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_direct_chat"("other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_debug_logs"("minutes" integer DEFAULT 5) RETURNS TABLE("function_name" "text", "step" "text", "data" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
    SELECT function_name, step, data, created_at
    FROM debug_logs
    WHERE created_at >= NOW() - (minutes || ' minutes')::interval
    ORDER BY created_at DESC;
$$;


ALTER FUNCTION "public"."get_recent_debug_logs"("minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_chat_messages_count"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO unread_count
    FROM chat_messages cm
    JOIN chat_participants cp ON cm.chat_id = cp.chat_id
    WHERE cp.user_id = user_uuid
    AND cm.sender_id != user_uuid
    AND cm.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamp);
    
    RETURN COALESCE(unread_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_unread_chat_messages_count"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.notifications
        WHERE user_id = user_uuid AND read = FALSE
    );
END;
$$;


ALTER FUNCTION "public"."get_unread_notification_count"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accessible_chats"("p_user_id" "uuid") RETURNS TABLE("chat_id" "uuid", "chat_type" "text", "ticket_id" "uuid", "ticket_number" "text", "ticket_title" "text", "other_participant_name" "text", "last_message_at" timestamp with time zone, "unread_count" integer, "is_disabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_role text;
    v_agent_level int;
BEGIN
    SELECT role, agent_level INTO v_user_role, v_agent_level FROM public.users WHERE id = p_user_id;

    IF v_user_role = 'user' THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE t.user_id = p_user_id ORDER BY tc.updated_at DESC;
    ELSIF v_user_role = 'agent' AND v_agent_level = 1 THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE t.assigned_to = p_user_id ORDER BY tc.updated_at DESC;
    ELSIF v_user_role = 'agent' AND v_agent_level = 2 THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE t.assigned_to = p_user_id OR EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_id = tc.id AND cp.user_id = p_user_id)
        ORDER BY tc.updated_at DESC;
    ELSIF v_user_role = 'admin' THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        ORDER BY tc.updated_at DESC;
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_user_accessible_chats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    default_role user_role;
BEGIN
    -- Set default role
    default_role := 'user'::user_role;

    -- Insert into public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        default_role,
        NOW(),
        NOW()
    );

    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- If email already exists, update the record
        UPDATE public.users
        SET
            id = NEW.id,
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            updated_at = NOW()
        WHERE email = NEW.email;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user_registration: %', SQLERRM;
        RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_task_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If status changed to 'done', set completed_at
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        NEW.completed_at = NOW();
    -- If status changed from 'done' to something else, clear completed_at
    ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_task_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_chat_permission"("p_chat_id" "uuid", "p_chat_type" "text", "p_user_id" "uuid", "p_permission_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_role text;
    v_agent_level int;
    v_is_disabled boolean;
    v_ticket_user_id uuid;
    v_ticket_assigned_to uuid;
    v_ticket_status text;
BEGIN
    SELECT role, agent_level INTO v_user_role, v_agent_level FROM public.users WHERE id = p_user_id;
    IF v_user_role IS NULL THEN RETURN FALSE; END IF;

    IF p_chat_type = 'ticket' THEN
        SELECT tc.is_disabled, t.user_id, t.assigned_to, t.status
        INTO v_is_disabled, v_ticket_user_id, v_ticket_assigned_to, v_ticket_status
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE tc.id = p_chat_id;

        IF v_is_disabled AND v_user_role <> 'admin' THEN RETURN FALSE; END IF;
        IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
        IF v_user_role = 'user' THEN
            RETURN v_ticket_user_id = p_user_id AND p_permission_type IN ('read', 'write');
        END IF;
        IF v_user_role = 'agent' THEN
            IF v_ticket_assigned_to = p_user_id THEN RETURN TRUE; END IF;
            IF v_agent_level = 2 AND EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id) THEN
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    IF p_chat_type = 'direct' THEN
        IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
        RETURN EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."has_chat_permission"("p_chat_id" "uuid", "p_chat_type" "text", "p_user_id" "uuid", "p_permission_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_article_view_count"("article_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.knowledge_articles
    SET view_count = view_count + 1
    WHERE id = article_id;
END;
$$;


ALTER FUNCTION "public"."increment_article_view_count"("article_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Use a direct query without going through RLS
    RETURN (
        SELECT role = 'admin' 
        FROM public.users 
        WHERE id = user_id
        LIMIT 1
    );
END;
$$;


ALTER FUNCTION "public"."is_admin_user"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin_user"("user_id" "uuid") IS 'Check if a user ID belongs to an admin without causing RLS recursion';



CREATE OR REPLACE FUNCTION "public"."is_temporary_password_expired"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT temporary_password_expires_at INTO expiry_time
    FROM public.users 
    WHERE id = user_id;
    
    RETURN (expiry_time IS NOT NULL AND expiry_time < NOW());
END;
$$;


ALTER FUNCTION "public"."is_temporary_password_expired"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_comment_activity"("p_comment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_ticket_id uuid;
    v_user_id uuid;
    v_is_internal boolean;
BEGIN
    SELECT ticket_id, user_id, is_internal INTO v_ticket_id, v_user_id, v_is_internal
    FROM public.ticket_comments_new WHERE id = p_comment_id;

    IF FOUND THEN
        PERFORM public.log_ticket_activity(v_ticket_id, v_user_id, 'comment_added', NULL, NULL, NULL, NULL,
            jsonb_build_object('comment_id', p_comment_id, 'is_internal', v_is_internal));
    END IF;
END;
$$;


ALTER FUNCTION "public"."log_comment_activity"("p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_feedback_activity"("p_feedback_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_ticket_id uuid;
    v_user_id uuid;
    v_rating int;
    v_satisfaction text;
BEGIN
    SELECT ticket_id, user_id, rating, satisfaction INTO v_ticket_id, v_user_id, v_rating, v_satisfaction
    FROM public.ticket_feedback WHERE id = p_feedback_id;

    IF FOUND THEN
        PERFORM public.log_ticket_activity(v_ticket_id, v_user_id, 'feedback_received', NULL, NULL,
            v_rating || ' estrelas (' || v_satisfaction || ')', NULL,
            jsonb_build_object('feedback_id', p_feedback_id, 'rating', v_rating, 'satisfaction', v_satisfaction));
    END IF;
END;
$$;


ALTER FUNCTION "public"."log_feedback_activity"("p_feedback_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_description" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.ticket_activity_logs(
    ticket_id,
    user_id,
    action_type,
    field_name,
    old_value,
    new_value,
    description,
    metadata,
    created_at
  )
  VALUES (
    p_ticket_id,
    p_user_id,
    p_action_type,
    p_field_name,
    p_old_value,
    p_new_value,
    COALESCE(p_description, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    NOW()
  );
END;
$$;


ALTER FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_description" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_description" "text", "p_metadata" "jsonb") IS 'Logs ticket activity with proper type handling';



CREATE OR REPLACE FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "public"."ticket_status", "p_new_value" "public"."ticket_status", "p_description" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.ticket_activity_logs(
    ticket_id,
    user_id,
    action_type,
    field_name,
    old_value,
    new_value,
    description,
    metadata,
    created_at
  )
  VALUES (
    p_ticket_id,
    p_user_id,
    p_action_type,
    p_field_name,
    p_old_value::text,
    p_new_value::text,
    COALESCE(p_description, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    NOW()
  );
END;
$$;


ALTER FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "public"."ticket_status", "p_new_value" "public"."ticket_status", "p_description" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_chat_as_read"("chat_uuid" "uuid", "user_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE chat_participants 
    SET last_read_at = NOW()
    WHERE chat_id = chat_uuid AND user_id = user_uuid;
END;
$$;


ALTER FUNCTION "public"."mark_chat_as_read"("chat_uuid" "uuid", "user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_feedback_received"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket_number TEXT;
    v_assigned_to UUID;
    v_admin_id UUID;
BEGIN
    -- Get ticket details safely into variables
    SELECT id, ticket_number, assigned_to
    INTO v_ticket_id, v_ticket_number, v_assigned_to
    FROM public.tickets_new
    WHERE id = NEW.ticket_id;

    IF v_ticket_id IS NULL THEN
        RETURN NEW; -- Exit if ticket not found
    END IF;

    -- Notify the assigned agent
    IF v_assigned_to IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
        VALUES (v_assigned_to, 'feedback_received', 'Feedback Recebido',
                'Você recebeu uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::TEXT) || '. Clique para ver os detalhes.',
                'medium', NEW.ticket_id);
    END IF;

    -- Notify all admins
    FOR v_admin_id IN SELECT id FROM public.users WHERE role = 'admin'
    LOOP
        -- Avoid duplicate notifications if the admin is the assigned agent
        IF v_admin_id <> v_assigned_to THEN
            INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
            VALUES (v_admin_id, 'feedback_received', 'Feedback Recebido',
                    'Foi recebida uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::TEXT) || '. Clique para ver os detalhes.',
                    'low', NEW.ticket_id);
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_feedback_received"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_task_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Send notification when a task is assigned to someone
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            ticket_id,
            priority,
            created_at
        ) VALUES (
            NEW.assigned_to,
            'task_assigned',
            'New Task Assigned',
            'You have been assigned a new task: "' || NEW.title || '" on ticket #' || 
            (SELECT ticket_number FROM tickets_new WHERE id = NEW.ticket_id),
            NEW.ticket_id,
            'medium',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_task_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_feedback_on_ticket_close"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only proceed if status changed to 'resolved'
    IF (NEW.status = 'resolved') AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
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
$$;


ALTER FUNCTION "public"."request_feedback_on_ticket_close"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_temporary_password"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN set_temporary_password(user_id);
END;
$$;


ALTER FUNCTION "public"."reset_temporary_password"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_direct_message"("other_user_id" "uuid", "message_content" "text", "is_internal_msg" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    chat_id UUID;
    message_id UUID;
BEGIN
    -- Get or create direct chat
    chat_id := get_or_create_direct_chat(other_user_id);
    
    -- Insert message
    INSERT INTO public.chat_messages (
        chat_id,
        sender_id,
        content,
        is_internal,
        chat_type,
        message_type
    ) VALUES (
        chat_id,
        auth.uid(),
        message_content,
        is_internal_msg,
        'direct',
        'text'
    ) RETURNING id INTO message_id;
    
    -- Update direct chat timestamp
    UPDATE public.direct_chats 
    SET updated_at = NOW() 
    WHERE id = chat_id;
    
    RETURN message_id;
END;
$$;


ALTER FUNCTION "public"."send_direct_message"("other_user_id" "uuid", "message_content" "text", "is_internal_msg" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_article_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_article_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_category_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_category_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_message_edit_deadline"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Define deadline de 2 minutos para edição
    NEW.edit_deadline := NEW.created_at + INTERVAL '2 minutes';
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_message_edit_deadline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_temporary_password"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    temp_password TEXT;
    expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate temporary password
    temp_password := generate_temporary_password();
    
    -- Set expiry to 24 hours from now
    expiry_time := NOW() + INTERVAL '24 hours';
    
    -- Update user record
    UPDATE public.users 
    SET 
        temporary_password = temp_password,
        temporary_password_created_at = NOW(),
        temporary_password_expires_at = expiry_time,
        must_change_password = TRUE,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN temp_password;
END;
$$;


ALTER FUNCTION "public"."set_temporary_password"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ticket_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Se ticket_number não foi fornecido ou está vazio, gerar automaticamente
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_ticket_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."silence_chat_participant"("p_chat_id" "uuid", "p_user_id" "uuid", "p_duration_minutes" integer DEFAULT 60) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_moderator_id uuid := auth.uid();
    v_moderator_role text;
    v_moderator_agent_level int;
BEGIN
    SELECT role, agent_level INTO v_moderator_role, v_moderator_agent_level FROM public.users WHERE id = v_moderator_id;

    IF NOT ((v_moderator_role = 'agent' AND v_moderator_agent_level = 2) OR v_moderator_role = 'admin') THEN
        RAISE EXCEPTION 'Permission denied to silence users.';
    END IF;
    IF NOT public.has_chat_permission(p_chat_id, 'ticket', v_moderator_id, 'moderate') THEN
        RAISE EXCEPTION 'No moderation permission in this chat.';
    END IF;

    UPDATE public.chat_participants
    SET is_silenced = TRUE, silenced_until = NOW() + (p_duration_minutes || ' minutes')::interval, silenced_by = v_moderator_id
    WHERE chat_id = p_chat_id AND user_id = p_user_id;
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."silence_chat_participant"("p_chat_id" "uuid", "p_user_id" "uuid", "p_duration_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_priority_to_text"("v" "public"."ticket_priority") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN v::text;
END;
$$;


ALTER FUNCTION "public"."ticket_priority_to_text"("v" "public"."ticket_priority") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_status_to_text"("v" "public"."ticket_status") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN v::text;
END;
$$;


ALTER FUNCTION "public"."ticket_status_to_text"("v" "public"."ticket_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_category_enabled"("category_id" "uuid", "new_status" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE categories
    SET is_enabled = new_status,
        updated_at = NOW()
    WHERE id = category_id;
END;
$$;


ALTER FUNCTION "public"."toggle_category_enabled"("category_id" "uuid", "new_status" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_log_comment_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_comment_activity(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_log_comment_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_log_feedback_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_feedback_activity(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_log_feedback_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_log_ticket_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."trigger_log_ticket_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_article_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.knowledge_articles
  SET 
    helpful_count = (
      SELECT COUNT(*) 
      FROM public.knowledge_article_feedback 
      WHERE article_id = NEW.article_id AND rating = 1
    ),
    not_helpful_count = (
      SELECT COUNT(*) 
      FROM public.knowledge_article_feedback 
      WHERE article_id = NEW.article_id AND rating = -1
    )
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_article_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_category_form_schema"("category_id" "uuid", "new_schema" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE categories
    SET dynamic_form_schema = new_schema,
        updated_at = NOW()
    WHERE id = category_id;
END;
$$;


ALTER FUNCTION "public"."update_category_form_schema"("category_id" "uuid", "new_schema" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_category_sort_order"("category_id" "uuid", "new_sort_order" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update the target category
    UPDATE categories
    SET sort_order = new_sort_order,
        updated_at = NOW()
    WHERE id = category_id;
END;
$$;


ALTER FUNCTION "public"."update_category_sort_order"("category_id" "uuid", "new_sort_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE ticket_chats
    SET updated_at = NOW()
    WHERE id = NEW.chat_id;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to update chat timestamp for chat %: %', NEW.chat_id, SQLERRM;
        RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_direct_chat_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.chat_type = 'direct' THEN
        -- Update the direct chat's timestamp when a new message is added
        UPDATE public.direct_chats 
        SET updated_at = NOW() 
        WHERE id = NEW.chat_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_direct_chat_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sla_rules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sla_rules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subcategory_sort_order"("subcategory_id" "uuid", "new_sort_order" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update the target subcategory
    UPDATE subcategories
    SET sort_order = new_sort_order,
        updated_at = NOW()
    WHERE id = subcategory_id;
END;
$$;


ALTER FUNCTION "public"."update_subcategory_sort_order"("subcategory_id" "uuid", "new_sort_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ticket_sla_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only update SLA status on status changes or new tickets
  IF (TG_OP = 'UPDATE' AND OLD.status::text != NEW.status::text) OR TG_OP = 'INSERT' THEN
    -- Calculate SLA times
    PERFORM calculate_ticket_sla(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ticket_sla_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_todo_tasks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set completed_at when status changes to completed
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_todo_tasks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;


ALTER FUNCTION "public"."user_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_ticket_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If assigned_to is provided, ensure the user exists and is an agent/admin
    IF NEW.assigned_to IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = NEW.assigned_to 
            AND role IN ('agent', 'admin')
        ) THEN
            RAISE EXCEPTION 'Cannot assign ticket to non-existent user or user without agent/admin role';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_ticket_assignment"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_working_day" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "business_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."business_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#6B7280'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0,
    "icon" character varying(50) DEFAULT 'folder'::character varying,
    "is_enabled" boolean DEFAULT true,
    "dynamic_form_schema" "jsonb"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_message_mentions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "mentioned_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_message_mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text",
    "file_path" "text",
    "file_name" "text",
    "file_size" integer,
    "mime_type" "text",
    "is_read" boolean DEFAULT false,
    "is_internal" boolean DEFAULT false,
    "message_type" character varying(20) DEFAULT 'text'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "chat_type" character varying(20) DEFAULT 'ticket'::character varying,
    "is_moderated" boolean DEFAULT false,
    "moderated_by" "uuid",
    "moderated_at" timestamp with time zone,
    "edit_deadline" timestamp with time zone,
    CONSTRAINT "chat_messages_chat_type_check" CHECK ((("chat_type")::"text" = ANY ((ARRAY['ticket'::character varying, 'direct'::character varying])::"text"[]))),
    CONSTRAINT "chat_messages_message_type_check" CHECK ((("message_type")::"text" = ANY ((ARRAY['text'::character varying, 'file'::character varying, 'system'::character varying])::"text"[])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "last_read_at" timestamp with time zone,
    "can_write" boolean DEFAULT true,
    "is_silenced" boolean DEFAULT false,
    "silenced_until" timestamp with time zone,
    "silenced_by" "uuid"
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debug_logs" (
    "id" integer NOT NULL,
    "function_name" "text",
    "step" "text",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debug_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."debug_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."debug_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."debug_logs_id_seq" OWNED BY "public"."debug_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."direct_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_1_id" "uuid" NOT NULL,
    "participant_2_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    CONSTRAINT "different_participants" CHECK (("participant_1_id" <> "participant_2_id")),
    CONSTRAINT "unique_participants" CHECK (("participant_1_id" < "participant_2_id"))
);


ALTER TABLE "public"."direct_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_article_attachments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "article_id" "uuid",
    "filename" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "alt_text" "text",
    "caption" "text",
    "sort_order" integer DEFAULT 0,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_article_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_article_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "article_id" "uuid",
    "user_id" "uuid",
    "rating" integer,
    "feedback_text" "text",
    "is_anonymous" boolean DEFAULT false,
    "user_ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "knowledge_article_feedback_rating_check" CHECK (("rating" = ANY (ARRAY[1, '-1'::integer])))
);


ALTER TABLE "public"."knowledge_article_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_article_versions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "article_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "version" integer NOT NULL,
    "changes_description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_article_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "featured" boolean DEFAULT false,
    "view_count" integer DEFAULT 0,
    "helpful_count" integer DEFAULT 0,
    "not_helpful_count" integer DEFAULT 0,
    "tags" "text"[],
    "meta_title" "text",
    "meta_description" "text",
    "author_id" "uuid",
    "knowledge_category_id" "uuid",
    "category_id" "uuid",
    "sort_order" integer DEFAULT 0,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reading_time_minutes" integer DEFAULT 1,
    "version" integer DEFAULT 1,
    CONSTRAINT "knowledge_articles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);

ALTER TABLE ONLY "public"."knowledge_articles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."knowledge_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#6B7280'::"text",
    "icon" "text" DEFAULT 'BookOpen'::"text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid"
);


ALTER TABLE "public"."knowledge_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "priority" "public"."notification_priority" DEFAULT 'medium'::"public"."notification_priority",
    "read" boolean DEFAULT false,
    "ticket_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Table for storing user notifications with RLS policies to control access';



CREATE TABLE IF NOT EXISTS "public"."reopen_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reopen_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."reopen_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sla_escalation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sla_rule_id" "uuid",
    "threshold_percentage" integer NOT NULL,
    "notify_roles" character varying(50)[] DEFAULT ARRAY['admin'::"text"] NOT NULL,
    "notification_template" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sla_escalation_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sla_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid",
    "status_type" character varying(50) NOT NULL,
    "status" character varying(50) NOT NULL,
    "elapsed_time" integer NOT NULL,
    "target_time" integer NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sla_history_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ok'::character varying, 'warning'::character varying, 'overdue'::character varying, 'met'::character varying, 'stopped'::character varying])::"text"[]))),
    CONSTRAINT "sla_history_status_type_check" CHECK ((("status_type")::"text" = ANY ((ARRAY['response'::character varying, 'resolution'::character varying])::"text"[])))
);


ALTER TABLE "public"."sla_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sla_pause_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sla_pause_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sla_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "priority" character varying(50) NOT NULL,
    "response_time" integer NOT NULL,
    "resolution_time" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "escalation_time" integer DEFAULT 1 NOT NULL,
    "escalation_threshold" integer DEFAULT 75 NOT NULL,
    "warning_threshold" integer DEFAULT 75 NOT NULL,
    "business_hours_only" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."sla_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "name" character varying(100) NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "response_time_hours" integer DEFAULT 24,
    "resolution_time_hours" integer DEFAULT 72,
    "specialized_agents" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."subcategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "field_name" "text",
    "old_value" "text",
    "new_value" "text",
    "description" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ticket_activity_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['created'::"text", 'status_changed'::"text", 'priority_changed'::"text", 'assigned'::"text", 'unassigned'::"text", 'comment_added'::"text", 'resolution_added'::"text", 'reopened'::"text", 'closed'::"text", 'feedback_received'::"text", 'category_changed'::"text", 'title_changed'::"text", 'description_changed'::"text", 'first_response'::"text"])))
);


ALTER TABLE "public"."ticket_activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "is_disabled" boolean DEFAULT false,
    "disabled_reason" "text",
    "chat_type" character varying(20) DEFAULT 'ticket'::character varying,
    CONSTRAINT "ticket_chats_chat_type_check" CHECK ((("chat_type")::"text" = ANY ((ARRAY['ticket'::character varying, 'direct'::character varying])::"text"[])))
);


ALTER TABLE "public"."ticket_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_comments_new" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_comments_new" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "satisfaction" "text" NOT NULL,
    "comment" "text",
    "categories" "text"[],
    "agent_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ticket_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "ticket_feedback_satisfaction_check" CHECK (("satisfaction" = ANY (ARRAY['satisfied'::"text", 'neutral'::"text", 'unsatisfied'::"text"])))
);


ALTER TABLE "public"."ticket_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_sequences" (
    "year_month" "text" NOT NULL,
    "last_sequence" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_task_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "status" character varying(20) DEFAULT 'open'::character varying,
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "due_date" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "ticket_tasks_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "ticket_tasks_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'done'::character varying, 'blocked'::character varying])::"text"[])))
);


ALTER TABLE "public"."ticket_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets_new" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."ticket_status" DEFAULT 'open'::"public"."ticket_status",
    "priority" "public"."ticket_priority" DEFAULT 'medium'::"public"."ticket_priority",
    "category_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "resolution" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "feedback_received" boolean DEFAULT false,
    "reopen_reason" "text",
    "reopened_at" timestamp with time zone,
    "reopened_by" "uuid",
    "subcategory_id" "uuid",
    "creator_id" "uuid",
    "attached_form" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "business_phone" "text",
    "mobile_phone" "text",
    "start_date" "text",
    "signature_group" "text",
    "usage_location" "text",
    "country_distribution_list" "text",
    "license_type" "text",
    "mfa_setup" "text",
    "company_name" "text",
    "first_name" "text",
    "last_name" "text",
    "username" "text",
    "display_name" "text",
    "job_title" "text",
    "manager" "text",
    "department" "text",
    "office_location" "text",
    "first_response_at" timestamp with time zone,
    "first_response_by" "uuid",
    "sla_paused_at" timestamp with time zone,
    "sla_pause_reason" "text",
    "total_pause_duration" integer DEFAULT 0,
    "sla_response_due" timestamp with time zone,
    "sla_resolution_due" timestamp with time zone,
    "sla_response_met" boolean,
    "sla_resolution_met" boolean
);


ALTER TABLE "public"."tickets_new" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tickets_new"."attached_form" IS 'Reference to attached form document';



COMMENT ON COLUMN "public"."tickets_new"."attachments" IS 'JSON array containing attachment information for the ticket';



COMMENT ON COLUMN "public"."tickets_new"."business_phone" IS 'Business phone number for employee onboarding';



COMMENT ON COLUMN "public"."tickets_new"."mobile_phone" IS 'Mobile phone number for employee onboarding';



COMMENT ON COLUMN "public"."tickets_new"."start_date" IS 'Employee start date';



COMMENT ON COLUMN "public"."tickets_new"."signature_group" IS 'Email signature group for employee';



COMMENT ON COLUMN "public"."tickets_new"."usage_location" IS 'Usage location for license assignment';



COMMENT ON COLUMN "public"."tickets_new"."country_distribution_list" IS 'Country distribution list for employee';



COMMENT ON COLUMN "public"."tickets_new"."license_type" IS 'Type of license to assign to employee';



COMMENT ON COLUMN "public"."tickets_new"."mfa_setup" IS 'Multi-factor authentication setup status';



COMMENT ON COLUMN "public"."tickets_new"."company_name" IS 'Company name for employee onboarding';



COMMENT ON COLUMN "public"."tickets_new"."first_name" IS 'Employee first name for onboarding';



COMMENT ON COLUMN "public"."tickets_new"."last_name" IS 'Employee last name for onboarding';



COMMENT ON COLUMN "public"."tickets_new"."username" IS 'Employee username/login for onboarding';



COMMENT ON COLUMN "public"."tickets_new"."display_name" IS 'Employee display name for onboarding';



COMMENT ON COLUMN "public"."tickets_new"."job_title" IS 'Employee job title for onboarding';



COMMENT ON COLUMN "public"."tickets_new"."manager" IS 'Employee manager for onboarding';



COMMENT ON COLUMN "public"."tickets_new"."department" IS 'Employee department for onboarding';



COMMENT ON COLUMN "public"."tickets_new"."office_location" IS 'Employee office location for onboarding';



CREATE TABLE IF NOT EXISTS "public"."todo_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "priority" character varying(50) DEFAULT 'medium'::character varying,
    "assigned_to" "uuid" NOT NULL,
    "ticket_id" "uuid",
    "time_tracking_total" integer DEFAULT 0,
    "time_tracking_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "due_date" "date",
    "estimated_hours" numeric(5,2),
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "todo_tasks_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "todo_tasks_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."todo_tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."todo_tasks"."due_date" IS 'Target completion date for the task';



COMMENT ON COLUMN "public"."todo_tasks"."estimated_hours" IS 'Estimated time to complete the task in hours (supports decimals like 2.5)';



COMMENT ON COLUMN "public"."todo_tasks"."tags" IS 'JSON array of tags for categorizing and filtering tasks';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "temporary_password" "text",
    "temporary_password_created_at" timestamp with time zone,
    "temporary_password_expires_at" timestamp with time zone,
    "must_change_password" boolean DEFAULT false,
    "last_password_change" timestamp with time zone,
    "agent_level" integer,
    CONSTRAINT "users_agent_level_check" CHECK (("agent_level" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."temporary_password" IS 'Encrypted temporary password for new users';



COMMENT ON COLUMN "public"."users"."temporary_password_created_at" IS 'When the temporary password was created';



COMMENT ON COLUMN "public"."users"."temporary_password_expires_at" IS 'When the temporary password expires (24h from creation)';



COMMENT ON COLUMN "public"."users"."must_change_password" IS 'Whether user must change password on next login';



COMMENT ON COLUMN "public"."users"."last_password_change" IS 'When user last changed their password';



ALTER TABLE ONLY "public"."debug_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."debug_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_day_of_week_key" UNIQUE ("day_of_week");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_message_mentions"
    ADD CONSTRAINT "chat_message_mentions_message_id_mentioned_user_id_key" UNIQUE ("message_id", "mentioned_user_id");



ALTER TABLE ONLY "public"."chat_message_mentions"
    ADD CONSTRAINT "chat_message_mentions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_chat_id_user_id_key" UNIQUE ("chat_id", "user_id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debug_logs"
    ADD CONSTRAINT "debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."direct_chats"
    ADD CONSTRAINT "direct_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_article_attachments"
    ADD CONSTRAINT "knowledge_article_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_article_feedback"
    ADD CONSTRAINT "knowledge_article_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_article_versions"
    ADD CONSTRAINT "knowledge_article_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_articles"
    ADD CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_articles"
    ADD CONSTRAINT "knowledge_articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."knowledge_categories"
    ADD CONSTRAINT "knowledge_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."knowledge_categories"
    ADD CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_categories"
    ADD CONSTRAINT "knowledge_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reopen_requests"
    ADD CONSTRAINT "reopen_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sla_escalation_rules"
    ADD CONSTRAINT "sla_escalation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sla_history"
    ADD CONSTRAINT "sla_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sla_pause_periods"
    ADD CONSTRAINT "sla_pause_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sla_rules"
    ADD CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sla_rules"
    ADD CONSTRAINT "sla_rules_priority_key" UNIQUE ("priority");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_name_key" UNIQUE ("category_id", "name");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_activity_logs"
    ADD CONSTRAINT "ticket_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_attachments"
    ADD CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_chats"
    ADD CONSTRAINT "ticket_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_comments_new"
    ADD CONSTRAINT "ticket_comments_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_feedback"
    ADD CONSTRAINT "ticket_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_feedback"
    ADD CONSTRAINT "ticket_feedback_ticket_id_user_id_key" UNIQUE ("ticket_id", "user_id");



ALTER TABLE ONLY "public"."ticket_sequences"
    ADD CONSTRAINT "ticket_sequences_pkey" PRIMARY KEY ("year_month");



ALTER TABLE ONLY "public"."ticket_task_comments"
    ADD CONSTRAINT "ticket_task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_tasks"
    ADD CONSTRAINT "ticket_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_ticket_number_key" UNIQUE ("ticket_number");



ALTER TABLE ONLY "public"."todo_tasks"
    ADD CONSTRAINT "todo_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_categories_is_enabled" ON "public"."categories" USING "btree" ("is_enabled");



CREATE INDEX "idx_categories_sort" ON "public"."categories" USING "btree" ("sort_order");



CREATE INDEX "idx_categories_sort_order" ON "public"."categories" USING "btree" ("sort_order");



CREATE INDEX "idx_chat_message_mentions_message_id" ON "public"."chat_message_mentions" USING "btree" ("message_id");



CREATE INDEX "idx_chat_message_mentions_user_id" ON "public"."chat_message_mentions" USING "btree" ("mentioned_user_id");



CREATE INDEX "idx_chat_messages_chat_id" ON "public"."chat_messages" USING "btree" ("chat_id");



CREATE INDEX "idx_chat_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at");



CREATE INDEX "idx_chat_messages_sender_id" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_chat_participants_chat_id" ON "public"."chat_participants" USING "btree" ("chat_id");



CREATE INDEX "idx_chat_participants_user_id" ON "public"."chat_participants" USING "btree" ("user_id");



CREATE INDEX "idx_direct_chats_participant_1" ON "public"."direct_chats" USING "btree" ("participant_1_id");



CREATE INDEX "idx_direct_chats_participant_2" ON "public"."direct_chats" USING "btree" ("participant_2_id");



CREATE INDEX "idx_direct_chats_participants" ON "public"."direct_chats" USING "btree" ("participant_1_id", "participant_2_id");



CREATE INDEX "idx_knowledge_articles_author" ON "public"."knowledge_articles" USING "btree" ("author_id");



CREATE INDEX "idx_knowledge_articles_category" ON "public"."knowledge_articles" USING "btree" ("knowledge_category_id");



CREATE INDEX "idx_knowledge_articles_published" ON "public"."knowledge_articles" USING "btree" ("published_at");



CREATE INDEX "idx_knowledge_articles_reading_time" ON "public"."knowledge_articles" USING "btree" ("reading_time_minutes");



CREATE INDEX "idx_knowledge_articles_slug" ON "public"."knowledge_articles" USING "btree" ("slug");



CREATE INDEX "idx_knowledge_articles_status" ON "public"."knowledge_articles" USING "btree" ("status");



CREATE INDEX "idx_knowledge_categories_active" ON "public"."knowledge_categories" USING "btree" ("is_active");



CREATE INDEX "idx_knowledge_categories_parent_id" ON "public"."knowledge_categories" USING "btree" ("parent_id");



CREATE INDEX "idx_knowledge_categories_slug" ON "public"."knowledge_categories" USING "btree" ("slug");



CREATE INDEX "idx_knowledge_categories_sort" ON "public"."knowledge_categories" USING "btree" ("sort_order");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_sla_history_recorded_at" ON "public"."sla_history" USING "btree" ("recorded_at");



CREATE INDEX "idx_sla_history_status" ON "public"."sla_history" USING "btree" ("status");



CREATE INDEX "idx_sla_history_ticket_id" ON "public"."sla_history" USING "btree" ("ticket_id");



CREATE INDEX "idx_sla_pause_periods_time_range" ON "public"."sla_pause_periods" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_subcategories_category" ON "public"."subcategories" USING "btree" ("category_id", "sort_order");



CREATE INDEX "idx_ticket_activity_logs_action_type" ON "public"."ticket_activity_logs" USING "btree" ("action_type");



CREATE INDEX "idx_ticket_activity_logs_created_at" ON "public"."ticket_activity_logs" USING "btree" ("created_at");



CREATE INDEX "idx_ticket_activity_logs_ticket_id" ON "public"."ticket_activity_logs" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_activity_logs_user_id" ON "public"."ticket_activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_ticket_attachments_ticket_id" ON "public"."ticket_attachments" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_attachments_uploaded_at" ON "public"."ticket_attachments" USING "btree" ("uploaded_at");



CREATE INDEX "idx_ticket_attachments_uploaded_by" ON "public"."ticket_attachments" USING "btree" ("uploaded_by");



CREATE INDEX "idx_ticket_chats_chat_type" ON "public"."ticket_chats" USING "btree" ("chat_type");



CREATE INDEX "idx_ticket_chats_ticket_id" ON "public"."ticket_chats" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_comments_created_at" ON "public"."ticket_comments_new" USING "btree" ("created_at");



CREATE INDEX "idx_ticket_comments_ticket_id" ON "public"."ticket_comments_new" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_feedback_rating" ON "public"."ticket_feedback" USING "btree" ("rating");



CREATE INDEX "idx_ticket_feedback_satisfaction" ON "public"."ticket_feedback" USING "btree" ("satisfaction");



CREATE INDEX "idx_ticket_feedback_ticket_id" ON "public"."ticket_feedback" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_feedback_user_id" ON "public"."ticket_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_ticket_task_comments_task_id" ON "public"."ticket_task_comments" USING "btree" ("task_id");



CREATE INDEX "idx_ticket_tasks_assigned_to" ON "public"."ticket_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_ticket_tasks_due_date" ON "public"."ticket_tasks" USING "btree" ("due_date");



CREATE INDEX "idx_ticket_tasks_status" ON "public"."ticket_tasks" USING "btree" ("status");



CREATE INDEX "idx_ticket_tasks_ticket_id" ON "public"."ticket_tasks" USING "btree" ("ticket_id");



CREATE INDEX "idx_tickets_assigned_to" ON "public"."tickets_new" USING "btree" ("assigned_to");



CREATE INDEX "idx_tickets_category" ON "public"."tickets_new" USING "btree" ("category_id");



CREATE INDEX "idx_tickets_created_at" ON "public"."tickets_new" USING "btree" ("created_at");



CREATE INDEX "idx_tickets_first_response" ON "public"."tickets_new" USING "btree" ("first_response_at");



CREATE INDEX "idx_tickets_reopened_at" ON "public"."tickets_new" USING "btree" ("reopened_at");



CREATE INDEX "idx_tickets_sla_paused" ON "public"."tickets_new" USING "btree" ("sla_paused_at");



CREATE INDEX "idx_tickets_status" ON "public"."tickets_new" USING "btree" ("status");



CREATE INDEX "idx_tickets_subcategory" ON "public"."tickets_new" USING "btree" ("subcategory_id");



CREATE INDEX "idx_tickets_user_id" ON "public"."tickets_new" USING "btree" ("user_id");



CREATE INDEX "idx_todo_tasks_assigned_to" ON "public"."todo_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_todo_tasks_due_date" ON "public"."todo_tasks" USING "btree" ("due_date");



CREATE INDEX "idx_todo_tasks_estimated_hours" ON "public"."todo_tasks" USING "btree" ("estimated_hours");



CREATE INDEX "idx_todo_tasks_priority" ON "public"."todo_tasks" USING "btree" ("priority");



CREATE INDEX "idx_todo_tasks_status" ON "public"."todo_tasks" USING "btree" ("status");



CREATE INDEX "idx_todo_tasks_tags" ON "public"."todo_tasks" USING "gin" ("tags");



CREATE INDEX "idx_todo_tasks_ticket_id" ON "public"."todo_tasks" USING "btree" ("ticket_id");



CREATE INDEX "idx_users_must_change_password" ON "public"."users" USING "btree" ("must_change_password");



CREATE INDEX "idx_users_temporary_password_expires_at" ON "public"."users" USING "btree" ("temporary_password_expires_at");



CREATE OR REPLACE TRIGGER "article_version_trigger" BEFORE UPDATE ON "public"."knowledge_articles" FOR EACH ROW EXECUTE FUNCTION "public"."create_article_version"();



CREATE OR REPLACE TRIGGER "calculate_reading_time_trigger" BEFORE INSERT OR UPDATE ON "public"."knowledge_articles" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_reading_time"();



CREATE OR REPLACE TRIGGER "comment_activity_log_trigger" AFTER INSERT ON "public"."ticket_comments_new" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_log_comment_activity"();



CREATE OR REPLACE TRIGGER "feedback_activity_log_trigger" AFTER INSERT ON "public"."ticket_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_log_feedback_activity"();



CREATE OR REPLACE TRIGGER "handle_task_completion_trigger" BEFORE UPDATE ON "public"."ticket_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_task_completion"();



CREATE OR REPLACE TRIGGER "notify_task_assignment_trigger" AFTER INSERT OR UPDATE ON "public"."ticket_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."notify_task_assignment"();



CREATE OR REPLACE TRIGGER "set_article_slug_trigger" BEFORE INSERT OR UPDATE ON "public"."knowledge_articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_article_slug"();



CREATE OR REPLACE TRIGGER "set_category_slug_trigger" BEFORE INSERT OR UPDATE ON "public"."knowledge_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_category_slug"();



CREATE OR REPLACE TRIGGER "trigger_add_initial_chat_participants" AFTER INSERT ON "public"."ticket_chats" FOR EACH ROW EXECUTE FUNCTION "public"."add_initial_chat_participants"();



CREATE OR REPLACE TRIGGER "trigger_disable_chat_on_closure" AFTER UPDATE ON "public"."tickets_new" FOR EACH ROW EXECUTE FUNCTION "public"."disable_chat_on_ticket_closure"();



CREATE OR REPLACE TRIGGER "trigger_notify_feedback_received" AFTER INSERT ON "public"."ticket_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."notify_feedback_received"();



CREATE OR REPLACE TRIGGER "trigger_set_edit_deadline" BEFORE INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_message_edit_deadline"();



CREATE OR REPLACE TRIGGER "trigger_update_chat_timestamp" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_direct_chat_timestamp" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_direct_chat_timestamp"();



CREATE OR REPLACE TRIGGER "update_article_stats_on_feedback" AFTER INSERT OR DELETE OR UPDATE ON "public"."knowledge_article_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_article_stats"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_messages_updated_at" BEFORE UPDATE ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_knowledge_articles_updated_at" BEFORE UPDATE ON "public"."knowledge_articles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_knowledge_categories_updated_at" BEFORE UPDATE ON "public"."knowledge_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notifications_updated_at" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sla_rules_updated_at_trigger" BEFORE UPDATE ON "public"."sla_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_sla_rules_updated_at"();



CREATE OR REPLACE TRIGGER "update_sla_status" AFTER INSERT OR UPDATE ON "public"."tickets_new" FOR EACH ROW EXECUTE FUNCTION "public"."update_ticket_sla_status"();



CREATE OR REPLACE TRIGGER "update_subcategories_updated_at" BEFORE UPDATE ON "public"."subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ticket_chats_updated_at" BEFORE UPDATE ON "public"."ticket_chats" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ticket_comments_updated_at" BEFORE UPDATE ON "public"."ticket_comments_new" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ticket_feedback_updated_at" BEFORE UPDATE ON "public"."ticket_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ticket_task_comments_updated_at" BEFORE UPDATE ON "public"."ticket_task_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ticket_tasks_updated_at" BEFORE UPDATE ON "public"."ticket_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_todo_tasks_updated_at_trigger" BEFORE UPDATE ON "public"."todo_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_todo_tasks_updated_at"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."chat_message_mentions"
    ADD CONSTRAINT "chat_message_mentions_mentioned_user_id_fkey" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_mentions"
    ADD CONSTRAINT "chat_message_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."ticket_chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."ticket_chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_silenced_by_fkey" FOREIGN KEY ("silenced_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_chats"
    ADD CONSTRAINT "direct_chats_participant_1_id_fkey" FOREIGN KEY ("participant_1_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_chats"
    ADD CONSTRAINT "direct_chats_participant_2_id_fkey" FOREIGN KEY ("participant_2_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_article_attachments"
    ADD CONSTRAINT "knowledge_article_attachments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_article_attachments"
    ADD CONSTRAINT "knowledge_article_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."knowledge_article_feedback"
    ADD CONSTRAINT "knowledge_article_feedback_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_article_feedback"
    ADD CONSTRAINT "knowledge_article_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."knowledge_article_versions"
    ADD CONSTRAINT "knowledge_article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_article_versions"
    ADD CONSTRAINT "knowledge_article_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."knowledge_articles"
    ADD CONSTRAINT "knowledge_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_articles"
    ADD CONSTRAINT "knowledge_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_articles"
    ADD CONSTRAINT "knowledge_articles_knowledge_category_id_fkey" FOREIGN KEY ("knowledge_category_id") REFERENCES "public"."knowledge_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_categories"
    ADD CONSTRAINT "knowledge_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_categories"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reopen_requests"
    ADD CONSTRAINT "reopen_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reopen_requests"
    ADD CONSTRAINT "reopen_requests_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reopen_requests"
    ADD CONSTRAINT "reopen_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sla_escalation_rules"
    ADD CONSTRAINT "sla_escalation_rules_sla_rule_id_fkey" FOREIGN KEY ("sla_rule_id") REFERENCES "public"."sla_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sla_history"
    ADD CONSTRAINT "sla_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sla_pause_periods"
    ADD CONSTRAINT "sla_pause_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_activity_logs"
    ADD CONSTRAINT "ticket_activity_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_activity_logs"
    ADD CONSTRAINT "ticket_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ticket_attachments"
    ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_attachments"
    ADD CONSTRAINT "ticket_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ticket_chats"
    ADD CONSTRAINT "ticket_chats_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_comments_new"
    ADD CONSTRAINT "ticket_comments_new_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_comments_new"
    ADD CONSTRAINT "ticket_comments_new_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ticket_feedback"
    ADD CONSTRAINT "ticket_feedback_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_feedback"
    ADD CONSTRAINT "ticket_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ticket_task_comments"
    ADD CONSTRAINT "ticket_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."ticket_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_task_comments"
    ADD CONSTRAINT "ticket_task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ticket_tasks"
    ADD CONSTRAINT "ticket_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ticket_tasks"
    ADD CONSTRAINT "ticket_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ticket_tasks"
    ADD CONSTRAINT "ticket_tasks_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_first_response_by_fkey" FOREIGN KEY ("first_response_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id");



ALTER TABLE ONLY "public"."tickets_new"
    ADD CONSTRAINT "tickets_new_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."todo_tasks"
    ADD CONSTRAINT "todo_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_tasks"
    ADD CONSTRAINT "todo_tasks_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets_new"("id") ON DELETE CASCADE;



CREATE POLICY "Activity logs can only be inserted by system" ON "public"."ticket_activity_logs" FOR INSERT WITH CHECK (false);



CREATE POLICY "Admins and agents can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role" = 'admin'::"public"."user_role") OR ("users"."role" = 'agent'::"public"."user_role"))))));



CREATE POLICY "Admins can do everything" ON "public"."tickets_new" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can manage all articles" ON "public"."knowledge_articles" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can manage categories" ON "public"."categories" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can manage knowledge categories" ON "public"."knowledge_categories" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can manage subcategories" ON "public"."subcategories" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Agents and admins can create chats" ON "public"."ticket_chats" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'agent'::"public"."user_role"]))))));



CREATE POLICY "Agents and admins can update chats" ON "public"."ticket_chats" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'agent'::"public"."user_role"]))))));



CREATE POLICY "Agents and admins can update reopen requests" ON "public"."reopen_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))));



CREATE POLICY "Agents and admins can update tickets" ON "public"."tickets_new" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))));



CREATE POLICY "Anyone can view active knowledge categories" ON "public"."knowledge_categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Anyone can view published articles" ON "public"."knowledge_articles" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Anyone can view subcategories" ON "public"."subcategories" FOR SELECT USING (true);



CREATE POLICY "Article versions viewable by article authors and admins" ON "public"."knowledge_article_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_articles"
  WHERE (("knowledge_articles"."id" = "knowledge_article_versions"."article_id") AND (("knowledge_articles"."author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))))))));



CREATE POLICY "Attachments viewable by everyone for published articles" ON "public"."knowledge_article_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_articles"
  WHERE (("knowledge_articles"."id" = "knowledge_article_attachments"."article_id") AND (("knowledge_articles"."status" = 'published'::"text") OR ("knowledge_articles"."author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))))));



CREATE POLICY "Authors and admins can manage articles" ON "public"."knowledge_articles" USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "Authors can manage their own articles" ON "public"."knowledge_articles" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "Categories are viewable by everyone" ON "public"."categories" FOR SELECT USING (
CASE
    WHEN (EXISTS ( SELECT 1
       FROM "public"."users"
      WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))) THEN true
    ELSE ("is_enabled" = true)
END);



CREATE POLICY "Categories are viewable by everyone" ON "public"."knowledge_categories" FOR SELECT USING (true);



CREATE POLICY "Everyone can view SLA escalation rules" ON "public"."sla_escalation_rules" FOR SELECT USING (true);



CREATE POLICY "Everyone can view SLA history" ON "public"."sla_history" FOR SELECT USING (true);



CREATE POLICY "Everyone can view SLA pause periods" ON "public"."sla_pause_periods" FOR SELECT USING (true);



CREATE POLICY "Everyone can view SLA rules" ON "public"."sla_rules" FOR SELECT USING (true);



CREATE POLICY "Everyone can view business hours" ON "public"."business_hours" FOR SELECT USING (true);



CREATE POLICY "Feedback submittable by authenticated users" ON "public"."knowledge_article_feedback" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Feedback viewable by article authors and admins" ON "public"."knowledge_article_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."knowledge_articles"
  WHERE (("knowledge_articles"."id" = "knowledge_article_feedback"."article_id") AND (("knowledge_articles"."author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))))))));



CREATE POLICY "Only admins can manage categories" ON "public"."categories" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can manage categories" ON "public"."knowledge_categories" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can manage subcategories" ON "public"."subcategories" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can modify SLA escalation rules" ON "public"."sla_escalation_rules" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can modify SLA history" ON "public"."sla_history" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can modify SLA pause periods" ON "public"."sla_pause_periods" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can modify SLA rules" ON "public"."sla_rules" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can modify business hours" ON "public"."business_hours" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Published articles are viewable by everyone" ON "public"."knowledge_articles" FOR SELECT USING ((("status" = 'published'::"text") OR ("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))));



CREATE POLICY "Restricted comment insert" ON "public"."ticket_comments_new" FOR INSERT WITH CHECK ((("auth"."uid"() = ( SELECT "tickets_new"."user_id"
   FROM "public"."tickets_new"
  WHERE ("tickets_new"."id" = "ticket_comments_new"."ticket_id"))) OR ("auth"."uid"() = "public"."assigned_agent"("ticket_id")) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "Service role can manage all notifications" ON "public"."notifications" USING (true) WITH CHECK (true);



CREATE POLICY "Subcategories are viewable by everyone" ON "public"."subcategories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "subcategories"."category_id") AND (("c"."is_enabled" = true) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))))));



CREATE POLICY "System can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create comments on accessible tickets" ON "public"."ticket_comments_new" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_comments_new"."ticket_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))))))));



CREATE POLICY "Users can create feedback for their tickets" ON "public"."ticket_feedback" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_feedback"."ticket_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create mentions in messages they send" ON "public"."chat_message_mentions" FOR INSERT WITH CHECK (("message_id" IN ( SELECT "cm"."id"
   FROM "public"."chat_messages" "cm"
  WHERE ("cm"."sender_id" = "auth"."uid"()))));



CREATE POLICY "Users can create reopen requests for own tickets" ON "public"."reopen_requests" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "reopen_requests"."ticket_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create tasks assigned to themselves, agents can creat" ON "public"."todo_tasks" FOR INSERT WITH CHECK ((("assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))));



CREATE POLICY "Users can create tickets" ON "public"."tickets_new" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own tasks and admins can delete all" ON "public"."todo_tasks" FOR DELETE USING ((("assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT WITH CHECK ((("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "Users can insert ticket sequences" ON "public"."ticket_sequences" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can manage their own reactions" ON "public"."chat_message_reactions" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read ticket sequences" ON "public"."ticket_sequences" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING ((("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "Users can update their own feedback" ON "public"."ticket_feedback" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tasks and admins can update all" ON "public"."todo_tasks" FOR UPDATE USING ((("assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "Users can update ticket sequences" ON "public"."ticket_sequences" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can upload attachments to accessible tickets" ON "public"."ticket_attachments" FOR INSERT WITH CHECK ((("uploaded_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_attachments"."ticket_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))))))));



CREATE POLICY "Users can view activity logs for accessible tickets" ON "public"."ticket_activity_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_activity_logs"."ticket_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))))));



CREATE POLICY "Users can view all profiles" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can view attachments for accessible tickets" ON "public"."ticket_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_attachments"."ticket_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))))));



CREATE POLICY "Users can view comments on accessible tickets" ON "public"."ticket_comments_new" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_comments_new"."ticket_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))))) AND ((NOT "is_internal") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))));



CREATE POLICY "Users can view feedback for their tickets" ON "public"."ticket_feedback" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_feedback"."ticket_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))))))));



CREATE POLICY "Users can view mentions they are part of" ON "public"."chat_message_mentions" FOR SELECT USING ((("mentioned_user_id" = "auth"."uid"()) OR ("message_id" IN ( SELECT "cm"."id"
   FROM "public"."chat_messages" "cm"
  WHERE ("cm"."sender_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'agent'::"public"."user_role"])))))));



CREATE POLICY "Users can view own reopen requests and agents/admins can view a" ON "public"."reopen_requests" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))));



CREATE POLICY "Users can view own tickets and agents/admins can view all" ON "public"."tickets_new" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))));



CREATE POLICY "Users can view reactions in chats they are part of" ON "public"."chat_message_reactions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."chat_messages" "cm"
     JOIN "public"."chat_participants" "cp" ON (("cm"."chat_id" = "cp"."chat_id")))
  WHERE (("cm"."id" = "chat_message_reactions"."message_id") AND ("cp"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['admin'::"public"."user_role", 'agent'::"public"."user_role"])))))));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tasks and admins can view all" ON "public"."todo_tasks" FOR SELECT USING ((("assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role"))))));



ALTER TABLE "public"."business_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_auth_manage" ON "public"."categories" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "categories_open_select" ON "public"."categories" FOR SELECT USING (true);



ALTER TABLE "public"."chat_message_mentions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_messages_insert_safe" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND ((EXISTS ( SELECT 1
   FROM "public"."chat_participants" "cp"
  WHERE (("cp"."chat_id" = "chat_messages"."chat_id") AND ("cp"."user_id" = "auth"."uid"()) AND ("cp"."can_write" = true)))) OR (EXISTS ( SELECT 1
   FROM ("public"."ticket_chats" "tc"
     JOIN "public"."tickets_new" "t" ON (("t"."id" = "tc"."ticket_id")))
  WHERE (("tc"."id" = "chat_messages"."chat_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))));



CREATE POLICY "chat_messages_read_safe" ON "public"."chat_messages" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."chat_participants" "cp"
  WHERE (("cp"."chat_id" = "chat_messages"."chat_id") AND ("cp"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))));



ALTER TABLE "public"."chat_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_participants_delete_safe" ON "public"."chat_participants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))));



CREATE POLICY "chat_participants_insert_safe" ON "public"."chat_participants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))));



CREATE POLICY "chat_participants_read_safe" ON "public"."chat_participants" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))));



CREATE POLICY "chat_participants_update_safe" ON "public"."chat_participants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))));



CREATE POLICY "comments_basic_access" ON "public"."ticket_comments_new" USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."direct_chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "direct_chats_insert_policy" ON "public"."direct_chats" FOR INSERT WITH CHECK ((("participant_1_id" = "auth"."uid"()) OR ("participant_2_id" = "auth"."uid"())));



CREATE POLICY "direct_chats_select_policy" ON "public"."direct_chats" FOR SELECT USING ((("participant_1_id" = "auth"."uid"()) OR ("participant_2_id" = "auth"."uid"())));



CREATE POLICY "direct_chats_update_policy" ON "public"."direct_chats" FOR UPDATE USING ((("participant_1_id" = "auth"."uid"()) OR ("participant_2_id" = "auth"."uid"())));



ALTER TABLE "public"."knowledge_article_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_article_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_article_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_basic_insert" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "notifications_basic_select" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_basic_update" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."reopen_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sla_escalation_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sla_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sla_pause_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sla_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subcategories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_chats_access_policy" ON "public"."ticket_chats" USING ((EXISTS ( SELECT 1
   FROM "public"."tickets_new" "t"
  WHERE (("t"."id" = "ticket_chats"."ticket_id") AND (("t"."user_id" = "auth"."uid"()) OR ("t"."assigned_to" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'agent'::"public"."user_role")))))))));



ALTER TABLE "public"."ticket_comments_new" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_task_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_task_comments_delete_policy" ON "public"."ticket_task_comments" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "ticket_task_comments_insert_policy" ON "public"."ticket_task_comments" FOR INSERT WITH CHECK (("task_id" IN ( SELECT "ticket_tasks"."id"
   FROM "public"."ticket_tasks"
  WHERE ("ticket_tasks"."ticket_id" IN ( SELECT "tickets_new"."id"
           FROM "public"."tickets_new"
          WHERE (("tickets_new"."user_id" = "auth"."uid"()) OR ("tickets_new"."assigned_to" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "users"."id"
                   FROM "public"."users"
                  WHERE ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))))));



CREATE POLICY "ticket_task_comments_select_policy" ON "public"."ticket_task_comments" FOR SELECT USING (("task_id" IN ( SELECT "ticket_tasks"."id"
   FROM "public"."ticket_tasks"
  WHERE ("ticket_tasks"."ticket_id" IN ( SELECT "tickets_new"."id"
           FROM "public"."tickets_new"
          WHERE (("tickets_new"."user_id" = "auth"."uid"()) OR ("tickets_new"."assigned_to" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "users"."id"
                   FROM "public"."users"
                  WHERE ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"]))))))))));



CREATE POLICY "ticket_task_comments_update_policy" ON "public"."ticket_task_comments" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = 'admin'::"public"."user_role")))));



ALTER TABLE "public"."ticket_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_tasks_delete_policy" ON "public"."ticket_tasks" FOR DELETE USING ((("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = 'admin'::"public"."user_role"))) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "ticket_tasks_insert_policy" ON "public"."ticket_tasks" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."role" = 'admin'::"public"."user_role") OR (("users"."role" = 'agent'::"public"."user_role") AND (("users"."agent_level" >= 2) OR ("users"."agent_level" IS NULL)))))));



CREATE POLICY "ticket_tasks_select_policy" ON "public"."ticket_tasks" FOR SELECT USING ((("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))) AND ("ticket_id" IN ( SELECT "tickets_new"."id"
   FROM "public"."tickets_new"
  WHERE (("tickets_new"."user_id" = "auth"."uid"()) OR ("tickets_new"."assigned_to" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."role" = ANY (ARRAY['agent'::"public"."user_role", 'admin'::"public"."user_role"])))))))));



CREATE POLICY "ticket_tasks_update_policy" ON "public"."ticket_tasks" FOR UPDATE USING ((("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = 'admin'::"public"."user_role"))) OR ("created_by" = "auth"."uid"()) OR ("assigned_to" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."role" = 'agent'::"public"."user_role") AND (("users"."agent_level" >= 2) OR ("users"."agent_level" IS NULL)))))));



CREATE POLICY "tickets_basic_insert" ON "public"."tickets_new" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "tickets_basic_select" ON "public"."tickets_new" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("assigned_to" = "auth"."uid"()) OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "tickets_basic_update" ON "public"."tickets_new" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR ("assigned_to" = "auth"."uid"()) OR ("auth"."uid"() IS NOT NULL)));



ALTER TABLE "public"."tickets_new" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_basic_insert" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "users_basic_select" ON "public"."users" FOR SELECT USING ((("auth"."uid"() = "id") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "users_basic_update" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "users_delete_policy" ON "public"."users" FOR DELETE USING (("public"."is_admin_user"("auth"."uid"()) AND ("id" <> "auth"."uid"())));



CREATE POLICY "users_insert_policy" ON "public"."users" FOR INSERT WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin_user"("auth"."uid"())));



CREATE POLICY "users_select_policy" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."is_admin_user"("auth"."uid"())));



CREATE POLICY "users_update_policy" ON "public"."users" FOR UPDATE USING ((("id" = "auth"."uid"()) OR "public"."is_admin_user"("auth"."uid"()))) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin_user"("auth"."uid"())));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ticket_task_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ticket_tasks";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_initial_chat_participants"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_initial_chat_participants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_initial_chat_participants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assigned_agent"("p_ticket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assigned_agent"("p_ticket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assigned_agent"("p_ticket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_close_resolved_tickets"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_close_resolved_tickets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_close_resolved_tickets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_reading_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_reading_time"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_reading_time"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_sla_elapsed_time"("p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_business_hours_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_sla_elapsed_time"("p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_business_hours_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_sla_elapsed_time"("p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_business_hours_only" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_ticket_sla"("p_ticket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_ticket_sla"("p_ticket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_ticket_sla"("p_ticket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_update_sla_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_update_sla_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_update_sla_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_overdue_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_overdue_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_overdue_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_temporary_password"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."clear_temporary_password"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_temporary_password"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_article_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_article_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_article_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_feedback_request_notification"("p_ticket_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_feedback_request_notification"("p_ticket_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_feedback_request_notification"("p_ticket_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text", "p_ticket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text", "p_ticket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text", "p_ticket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ticket_chat"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_ticket_chat"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ticket_chat"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ticket_notification"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_ticket_notification"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ticket_notification"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_priority" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_by_admin"("user_email" "text", "user_name" "text", "user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_by_admin"("user_email" "text", "user_name" "text", "user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_by_admin"("user_email" "text", "user_name" "text", "user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_mention"("p_message_id" "uuid", "p_mentioned_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_mention"("p_message_id" "uuid", "p_mentioned_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_mention"("p_message_id" "uuid", "p_mentioned_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_chat_on_ticket_closure"() TO "anon";
GRANT ALL ON FUNCTION "public"."disable_chat_on_ticket_closure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_chat_on_ticket_closure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_article_slug"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_article_slug"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_article_slug"("title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_temporary_password"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_temporary_password"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_temporary_password"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_temporary_password"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feedback_statistics"("agent_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feedback_statistics"("agent_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feedback_statistics"("agent_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat"("other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat"("other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_debug_logs"("minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_debug_logs"("minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_debug_logs"("minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_chat_messages_count"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_chat_messages_count"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_chat_messages_count"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_chats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_chats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_chats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_task_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_task_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_task_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_chat_permission"("p_chat_id" "uuid", "p_chat_type" "text", "p_user_id" "uuid", "p_permission_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_chat_permission"("p_chat_id" "uuid", "p_chat_type" "text", "p_user_id" "uuid", "p_permission_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_chat_permission"("p_chat_id" "uuid", "p_chat_type" "text", "p_user_id" "uuid", "p_permission_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_article_view_count"("article_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_article_view_count"("article_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_article_view_count"("article_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_temporary_password_expired"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_temporary_password_expired"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_temporary_password_expired"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_comment_activity"("p_comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."log_comment_activity"("p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_comment_activity"("p_comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_feedback_activity"("p_feedback_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."log_feedback_activity"("p_feedback_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_feedback_activity"("p_feedback_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_description" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_description" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_description" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "text", "p_new_value" "text", "p_description" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "public"."ticket_status", "p_new_value" "public"."ticket_status", "p_description" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "public"."ticket_status", "p_new_value" "public"."ticket_status", "p_description" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_ticket_activity"("p_ticket_id" "uuid", "p_user_id" "uuid", "p_action_type" "text", "p_field_name" "text", "p_old_value" "public"."ticket_status", "p_new_value" "public"."ticket_status", "p_description" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_chat_as_read"("chat_uuid" "uuid", "user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_chat_as_read"("chat_uuid" "uuid", "user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_chat_as_read"("chat_uuid" "uuid", "user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_feedback_received"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_feedback_received"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_feedback_received"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_task_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_task_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_task_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."request_feedback_on_ticket_close"() TO "anon";
GRANT ALL ON FUNCTION "public"."request_feedback_on_ticket_close"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_feedback_on_ticket_close"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_temporary_password"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_temporary_password"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_temporary_password"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_temporary_password"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_direct_message"("other_user_id" "uuid", "message_content" "text", "is_internal_msg" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."send_direct_message"("other_user_id" "uuid", "message_content" "text", "is_internal_msg" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_direct_message"("other_user_id" "uuid", "message_content" "text", "is_internal_msg" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_article_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_article_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_article_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_category_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_category_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_category_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_message_edit_deadline"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_message_edit_deadline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_message_edit_deadline"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_temporary_password"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_temporary_password"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_temporary_password"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_temporary_password"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ticket_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_ticket_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ticket_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."silence_chat_participant"("p_chat_id" "uuid", "p_user_id" "uuid", "p_duration_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."silence_chat_participant"("p_chat_id" "uuid", "p_user_id" "uuid", "p_duration_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."silence_chat_participant"("p_chat_id" "uuid", "p_user_id" "uuid", "p_duration_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ticket_priority_to_text"("v" "public"."ticket_priority") TO "anon";
GRANT ALL ON FUNCTION "public"."ticket_priority_to_text"("v" "public"."ticket_priority") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ticket_priority_to_text"("v" "public"."ticket_priority") TO "service_role";



GRANT ALL ON FUNCTION "public"."ticket_status_to_text"("v" "public"."ticket_status") TO "anon";
GRANT ALL ON FUNCTION "public"."ticket_status_to_text"("v" "public"."ticket_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ticket_status_to_text"("v" "public"."ticket_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_category_enabled"("category_id" "uuid", "new_status" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_category_enabled"("category_id" "uuid", "new_status" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_category_enabled"("category_id" "uuid", "new_status" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_log_comment_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_log_comment_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_log_comment_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_log_feedback_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_log_feedback_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_log_feedback_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_log_ticket_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_log_ticket_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_log_ticket_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_article_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_article_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_article_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_category_form_schema"("category_id" "uuid", "new_schema" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_category_form_schema"("category_id" "uuid", "new_schema" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_category_form_schema"("category_id" "uuid", "new_schema" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_category_sort_order"("category_id" "uuid", "new_sort_order" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_category_sort_order"("category_id" "uuid", "new_sort_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_category_sort_order"("category_id" "uuid", "new_sort_order" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_direct_chat_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_direct_chat_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_direct_chat_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sla_rules_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sla_rules_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sla_rules_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subcategory_sort_order"("subcategory_id" "uuid", "new_sort_order" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_subcategory_sort_order"("subcategory_id" "uuid", "new_sort_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subcategory_sort_order"("subcategory_id" "uuid", "new_sort_order" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ticket_sla_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ticket_sla_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ticket_sla_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_todo_tasks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_todo_tasks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_todo_tasks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ticket_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ticket_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ticket_assignment"() TO "service_role";


















GRANT ALL ON TABLE "public"."business_hours" TO "anon";
GRANT ALL ON TABLE "public"."business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."chat_message_mentions" TO "anon";
GRANT ALL ON TABLE "public"."chat_message_mentions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message_mentions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."chat_message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."direct_chats" TO "anon";
GRANT ALL ON TABLE "public"."direct_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_chats" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_article_attachments" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_article_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_article_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_article_feedback" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_article_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_article_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_article_versions" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_article_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_article_versions" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_articles" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_articles" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_categories" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_categories" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."reopen_requests" TO "anon";
GRANT ALL ON TABLE "public"."reopen_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."reopen_requests" TO "service_role";



GRANT ALL ON TABLE "public"."sla_escalation_rules" TO "anon";
GRANT ALL ON TABLE "public"."sla_escalation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."sla_escalation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."sla_history" TO "anon";
GRANT ALL ON TABLE "public"."sla_history" TO "authenticated";
GRANT ALL ON TABLE "public"."sla_history" TO "service_role";



GRANT ALL ON TABLE "public"."sla_pause_periods" TO "anon";
GRANT ALL ON TABLE "public"."sla_pause_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."sla_pause_periods" TO "service_role";



GRANT ALL ON TABLE "public"."sla_rules" TO "anon";
GRANT ALL ON TABLE "public"."sla_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."sla_rules" TO "service_role";



GRANT ALL ON TABLE "public"."subcategories" TO "anon";
GRANT ALL ON TABLE "public"."subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."ticket_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_attachments" TO "anon";
GRANT ALL ON TABLE "public"."ticket_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_chats" TO "anon";
GRANT ALL ON TABLE "public"."ticket_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_chats" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_comments_new" TO "anon";
GRANT ALL ON TABLE "public"."ticket_comments_new" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_comments_new" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_feedback" TO "anon";
GRANT ALL ON TABLE "public"."ticket_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_sequences" TO "anon";
GRANT ALL ON TABLE "public"."ticket_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_task_comments" TO "anon";
GRANT ALL ON TABLE "public"."ticket_task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_tasks" TO "anon";
GRANT ALL ON TABLE "public"."ticket_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."tickets_new" TO "anon";
GRANT ALL ON TABLE "public"."tickets_new" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets_new" TO "service_role";



GRANT ALL ON TABLE "public"."todo_tasks" TO "anon";
GRANT ALL ON TABLE "public"."todo_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
