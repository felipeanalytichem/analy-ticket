-- Create SLA Rules table
CREATE TABLE IF NOT EXISTS public.sla_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    priority VARCHAR(50) NOT NULL UNIQUE,
    response_time INTEGER NOT NULL, -- in hours
    resolution_time INTEGER NOT NULL, -- in hours
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sla_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Everyone can view SLA rules" ON public.sla_rules;
DROP POLICY IF EXISTS "Only admins can modify SLA rules" ON public.sla_rules;

CREATE POLICY "Everyone can view SLA rules" ON public.sla_rules FOR SELECT USING (true);

CREATE POLICY "Only admins can modify SLA rules" ON public.sla_rules FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Insert default SLA rules
INSERT INTO public.sla_rules (name, priority, response_time, resolution_time, is_active) VALUES
    ('Urgente - 1 hora resposta', 'urgent', 1, 4, true),
    ('Alta - 2 horas resposta', 'high', 2, 8, true),
    ('Média - 4 horas resposta', 'medium', 4, 24, true),
    ('Baixa - 8 horas resposta', 'low', 8, 72, true)
ON CONFLICT (priority) DO UPDATE SET
    name = EXCLUDED.name,
    response_time = EXCLUDED.response_time,
    resolution_time = EXCLUDED.resolution_time,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Create update trigger
CREATE OR REPLACE FUNCTION update_sla_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sla_rules_updated_at_trigger
    BEFORE UPDATE ON public.sla_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_sla_rules_updated_at(); 