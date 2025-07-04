-- Enhance SLA System

-- Add escalation_time to sla_rules table
ALTER TABLE sla_rules
ADD COLUMN IF NOT EXISTS escalation_time INTEGER NOT NULL DEFAULT 1, -- in hours
ADD COLUMN IF NOT EXISTS escalation_threshold INTEGER NOT NULL DEFAULT 75, -- percentage
ADD COLUMN IF NOT EXISTS warning_threshold INTEGER NOT NULL DEFAULT 75, -- percentage
ADD COLUMN IF NOT EXISTS business_hours_only BOOLEAN NOT NULL DEFAULT false;

-- Create SLA history table to track SLA status changes
CREATE TABLE IF NOT EXISTS public.sla_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE,
    status_type VARCHAR(50) NOT NULL CHECK (status_type IN ('response', 'resolution')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('ok', 'warning', 'overdue', 'met', 'stopped')),
    elapsed_time INTEGER NOT NULL, -- in minutes
    target_time INTEGER NOT NULL, -- in minutes
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SLA pause periods table (for holidays, maintenance windows, etc.)
CREATE TABLE IF NOT EXISTS public.sla_pause_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create business hours table for SLA calculation
CREATE TABLE IF NOT EXISTS public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_working_day BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(day_of_week)
);

-- Create SLA escalation rules table
CREATE TABLE IF NOT EXISTS public.sla_escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sla_rule_id UUID REFERENCES public.sla_rules(id) ON DELETE CASCADE,
    threshold_percentage INTEGER NOT NULL,
    notify_roles VARCHAR(50)[] NOT NULL DEFAULT ARRAY['admin'],
    notification_template TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add SLA tracking columns to tickets table
ALTER TABLE tickets_new
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS first_response_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sla_pause_reason TEXT,
ADD COLUMN IF NOT EXISTS total_pause_duration INTEGER DEFAULT 0; -- in minutes

-- Create function to calculate SLA status considering business hours and pause periods
CREATE OR REPLACE FUNCTION calculate_sla_elapsed_time(
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_business_hours_only BOOLEAN DEFAULT false
) RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to check and update SLA status
CREATE OR REPLACE FUNCTION check_and_update_sla_status() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for SLA status updates
DROP TRIGGER IF EXISTS update_sla_status ON tickets_new;
CREATE TRIGGER update_sla_status
    AFTER INSERT OR UPDATE OF status, priority, first_response_at
    ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION check_and_update_sla_status();

-- Insert default business hours
INSERT INTO business_hours (day_of_week, start_time, end_time, is_working_day) VALUES
    (1, '09:00', '18:00', true),  -- Monday
    (2, '09:00', '18:00', true),  -- Tuesday
    (3, '09:00', '18:00', true),  -- Wednesday
    (4, '09:00', '18:00', true),  -- Thursday
    (5, '09:00', '18:00', true),  -- Friday
    (6, '00:00', '00:00', false), -- Saturday
    (0, '00:00', '00:00', false)  -- Sunday
ON CONFLICT (day_of_week) DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    is_working_day = EXCLUDED.is_working_day,
    updated_at = NOW();

-- Enable RLS on new tables
ALTER TABLE sla_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_pause_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_escalation_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for SLA history
CREATE POLICY "Everyone can view SLA history" ON sla_history FOR SELECT USING (true);
CREATE POLICY "Only admins can modify SLA history" ON sla_history FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Create RLS policies for SLA pause periods
CREATE POLICY "Everyone can view SLA pause periods" ON sla_pause_periods FOR SELECT USING (true);
CREATE POLICY "Only admins can modify SLA pause periods" ON sla_pause_periods FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Create RLS policies for business hours
CREATE POLICY "Everyone can view business hours" ON business_hours FOR SELECT USING (true);
CREATE POLICY "Only admins can modify business hours" ON business_hours FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Create RLS policies for SLA escalation rules
CREATE POLICY "Everyone can view SLA escalation rules" ON sla_escalation_rules FOR SELECT USING (true);
CREATE POLICY "Only admins can modify SLA escalation rules" ON sla_escalation_rules FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sla_history_ticket_id ON sla_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_history_status ON sla_history(status);
CREATE INDEX IF NOT EXISTS idx_sla_history_recorded_at ON sla_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_sla_pause_periods_time_range ON sla_pause_periods(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_tickets_first_response ON tickets_new(first_response_at);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_paused ON tickets_new(sla_paused_at);

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 