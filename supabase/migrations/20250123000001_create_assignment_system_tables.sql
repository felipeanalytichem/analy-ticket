-- Create assignment rules table
CREATE TABLE IF NOT EXISTS public.assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create assignment configuration table
CREATE TABLE IF NOT EXISTS public.assignment_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workload_weight INTEGER NOT NULL DEFAULT 40,
  performance_weight INTEGER NOT NULL DEFAULT 30,
  availability_weight INTEGER NOT NULL DEFAULT 30,
  max_concurrent_tickets INTEGER NOT NULL DEFAULT 10,
  business_hours JSONB NOT NULL DEFAULT '{"start": "09:00", "end": "17:00", "timezone": "UTC"}'::jsonb,
  auto_rebalance BOOLEAN NOT NULL DEFAULT false,
  rebalance_threshold INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default configuration if none exists
INSERT INTO public.assignment_config (
  workload_weight,
  performance_weight,
  availability_weight,
  max_concurrent_tickets,
  business_hours,
  auto_rebalance,
  rebalance_threshold
)
SELECT 40, 30, 30, 10, '{"start": "09:00", "end": "17:00", "timezone": "UTC"}'::jsonb, false, 80
WHERE NOT EXISTS (SELECT 1 FROM public.assignment_config);

-- Insert default assignment rules
INSERT INTO public.assignment_rules (name, description, priority, enabled, conditions, actions) VALUES
(
  'Urgent Tickets to Senior Agents',
  'Assign urgent priority tickets to experienced agents',
  1,
  true,
  '{"priorities": ["urgent"]}'::jsonb,
  '{"requireSkills": ["senior"], "maxResponseTime": 15, "notifyManager": true}'::jsonb
),
(
  'Technical Issues to IT Team',
  'Route technical category tickets to IT specialists',
  2,
  true,
  '{"categories": ["technical", "software"], "keywords": ["server", "network", "database", "api", "bug", "error"]}'::jsonb,
  '{"assignToTeam": "it-team", "requireSkills": ["technical"], "maxResponseTime": 30}'::jsonb
),
(
  'High Priority Business Hours',
  'Assign high priority tickets during business hours to available agents',
  3,
  true,
  '{"priorities": ["high"], "timeOfDay": {"start": "09:00", "end": "17:00"}}'::jsonb,
  '{"maxResponseTime": 20, "notifyManager": false}'::jsonb
),
(
  'After Hours to On-Call',
  'Assign tickets outside business hours to on-call agents',
  4,
  false,
  '{"timeOfDay": {"start": "18:00", "end": "08:00"}}'::jsonb,
  '{"assignToTeam": "on-call", "escalateAfter": 60, "notifyManager": true}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Add RLS policies
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_config ENABLE ROW LEVEL SECURITY;

-- Admin can read/write assignment rules
CREATE POLICY assignment_rules_admin_policy ON public.assignment_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Admin can read/write assignment configuration
CREATE POLICY assignment_config_admin_policy ON public.assignment_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_rules_priority ON public.assignment_rules(priority);
CREATE INDEX IF NOT EXISTS idx_assignment_rules_enabled ON public.assignment_rules(enabled);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_assignment_rules_updated_at 
  BEFORE UPDATE ON public.assignment_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignment_config_updated_at 
  BEFORE UPDATE ON public.assignment_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();