-- Script SQL para criar as tabelas de categorias e subcategorias
-- Execute este script no Supabase SQL Editor

-- Adicionar colunas faltantes na tabela categories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder',
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Criar tabela subcategories
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  response_time_hours INTEGER DEFAULT 24,
  resolution_time_hours INTEGER DEFAULT 72,
  specialized_agents UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(category_id, name)
);

-- Adicionar colunas de categoria e subcategoria na tabela tickets_new
ALTER TABLE tickets_new 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id);

-- Habilitar RLS para subcategories
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para subcategories
DROP POLICY IF EXISTS "Anyone can view subcategories" ON subcategories;
CREATE POLICY "Anyone can view subcategories" ON subcategories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage subcategories" ON subcategories;
CREATE POLICY "Admins can manage subcategories" ON subcategories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets_new(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON tickets_new(subcategory_id);

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at em subcategories
DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at
    BEFORE UPDATE ON subcategories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Conceder permissões
GRANT ALL ON subcategories TO authenticated; 