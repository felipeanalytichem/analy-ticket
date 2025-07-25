-- Create agent category expertise table
CREATE TABLE IF NOT EXISTS public.agent_category_expertise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  expertise_level TEXT NOT NULL CHECK (expertise_level IN ('expert', 'intermediate', 'basic')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_id, category_id)
);

-- Create agent subcategory expertise table
CREATE TABLE IF NOT EXISTS public.agent_subcategory_expertise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  expertise_level TEXT NOT NULL CHECK (expertise_level IN ('expert', 'intermediate', 'basic')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_id, subcategory_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_category_expertise_agent_id ON public.agent_category_expertise(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_category_expertise_category_id ON public.agent_category_expertise(category_id);
CREATE INDEX IF NOT EXISTS idx_agent_category_expertise_level ON public.agent_category_expertise(expertise_level);
CREATE INDEX IF NOT EXISTS idx_agent_category_expertise_primary ON public.agent_category_expertise(is_primary);

CREATE INDEX IF NOT EXISTS idx_agent_subcategory_expertise_agent_id ON public.agent_subcategory_expertise(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_subcategory_expertise_subcategory_id ON public.agent_subcategory_expertise(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_agent_subcategory_expertise_level ON public.agent_subcategory_expertise(expertise_level);
CREATE INDEX IF NOT EXISTS idx_agent_subcategory_expertise_primary ON public.agent_subcategory_expertise(is_primary);

-- Enable RLS
ALTER TABLE public.agent_category_expertise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_subcategory_expertise ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_category_expertise
CREATE POLICY agent_category_expertise_read_policy ON public.agent_category_expertise
  FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can read expertise data

CREATE POLICY agent_category_expertise_admin_write_policy ON public.agent_category_expertise
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- RLS policies for agent_subcategory_expertise
CREATE POLICY agent_subcategory_expertise_read_policy ON public.agent_subcategory_expertise
  FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can read expertise data

CREATE POLICY agent_subcategory_expertise_admin_write_policy ON public.agent_subcategory_expertise
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_agent_category_expertise_updated_at 
  BEFORE UPDATE ON public.agent_category_expertise 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_subcategory_expertise_updated_at 
  BEFORE UPDATE ON public.agent_subcategory_expertise 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- This would be populated by administrators through the UI
INSERT INTO public.agent_category_expertise (agent_id, category_id, expertise_level, is_primary)
SELECT 
  u.id as agent_id,
  c.id as category_id,
  'intermediate' as expertise_level,
  false as is_primary
FROM public.users u
CROSS JOIN public.categories c
WHERE u.role IN ('agent', 'admin')
  AND c.name IN ('Technical Support', 'Billing')
  AND NOT EXISTS (
    SELECT 1 FROM public.agent_category_expertise ace 
    WHERE ace.agent_id = u.id AND ace.category_id = c.id
  )
LIMIT 10; -- Limit to avoid too much sample data

-- Create a view for easy querying of agent expertise with category names
CREATE OR REPLACE VIEW public.agent_expertise_view AS
SELECT 
  ace.id,
  ace.agent_id,
  u.full_name as agent_name,
  u.email as agent_email,
  ace.category_id,
  c.name as category_name,
  ace.expertise_level,
  ace.is_primary,
  ace.created_at,
  ace.updated_at
FROM public.agent_category_expertise ace
JOIN public.users u ON ace.agent_id = u.id
JOIN public.categories c ON ace.category_id = c.id
WHERE u.role IN ('agent', 'admin');

-- Create a view for subcategory expertise
CREATE OR REPLACE VIEW public.agent_subcategory_expertise_view AS
SELECT 
  ase.id,
  ase.agent_id,
  u.full_name as agent_name,
  u.email as agent_email,
  ase.subcategory_id,
  s.name as subcategory_name,
  c.name as category_name,
  ase.expertise_level,
  ase.is_primary,
  ase.created_at,
  ase.updated_at
FROM public.agent_subcategory_expertise ase
JOIN public.users u ON ase.agent_id = u.id
JOIN public.subcategories s ON ase.subcategory_id = s.id
JOIN public.categories c ON s.category_id = c.id
WHERE u.role IN ('agent', 'admin');

-- Grant permissions on views
GRANT SELECT ON public.agent_expertise_view TO authenticated;
GRANT SELECT ON public.agent_subcategory_expertise_view TO authenticated;