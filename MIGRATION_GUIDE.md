# 🚀 Guia de Migração - Todo Tasks e SLA Rules

Este guia orienta como aplicar manualmente as migrações para habilitar as funcionalidades de **Sistema de Tarefas** e **Regras SLA**.

## 📋 Migrações Necessárias

### 1. Tabela SLA Rules
Execute o SQL abaixo no **SQL Editor** do Supabase Dashboard:

```sql
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
CREATE POLICY "Everyone can view SLA rules" ON public.sla_rules
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify SLA rules" ON public.sla_rules
    FOR ALL USING (
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
```

### 2. Tabela Todo Tasks
Execute o SQL abaixo no **SQL Editor** do Supabase Dashboard:

```sql
-- Create Todo Tasks table
CREATE TABLE IF NOT EXISTS public.todo_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE,
    time_tracking_total INTEGER DEFAULT 0, -- in minutes
    time_tracking_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.todo_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tasks and admins can view all" ON public.todo_tasks
    FOR SELECT USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create tasks assigned to themselves, agents can create for tickets, admins can create any" ON public.todo_tasks
    FOR INSERT WITH CHECK (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('agent', 'admin')
        )
    );

CREATE POLICY "Users can update their own tasks and admins can update all" ON public.todo_tasks
    FOR UPDATE USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can delete their own tasks and admins can delete all" ON public.todo_tasks
    FOR DELETE USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_todo_tasks_assigned_to ON public.todo_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_ticket_id ON public.todo_tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON public.todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_priority ON public.todo_tasks(priority);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_todo_tasks_updated_at()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_todo_tasks_updated_at_trigger
    BEFORE UPDATE ON public.todo_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_tasks_updated_at();
```

## 🎯 Como Aplicar

### Opção 1: Via Supabase Dashboard
1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **SQL Editor**
4. Cole e execute o primeiro SQL (SLA Rules)
5. Cole e execute o segundo SQL (Todo Tasks)

### Opção 2: Via CLI (se Docker funcionar)
```bash
npx supabase db reset
```

## ✅ Verificação

Após aplicar as migrações, verifique se as tabelas foram criadas:

```sql
-- Verificar tabelas criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sla_rules', 'todo_tasks');

-- Verificar dados SLA
SELECT * FROM public.sla_rules;
```

## 🔄 Depois da Migração

1. **Recarregue a aplicação** - As funcionalidades serão habilitadas automaticamente
2. **Sistema de Tarefas** - Totalmente funcional no menu "To-Do"
3. **SLA Inline** - Aparecerá nos tickets não atribuídos
4. **Erro 404 resolvido** - As consultas SLA não retornarão mais erro

## 🛠️ Funcionalidades Habilitadas

### Todo Tasks
- ✅ Criar tarefas no menu To-Do
- ✅ Criar tarefas vinculadas a tickets
- ✅ Editar tarefas (título, descrição, status, prioridade)
- ✅ Excluir tarefas
- ✅ Filtragem por status
- ✅ Controle de acesso (RLS)

### SLA Rules
- ✅ Cálculo automático de SLA
- ✅ Display inline em tickets
- ✅ Status visual (verde/amarelo/vermelho)
- ✅ Regras configuráveis por prioridade

## 🚨 Importante

- **Backup**: Faça backup do banco antes de aplicar
- **Teste**: Execute em ambiente de desenvolvimento primeiro
- **Validação**: Verifique se todas as tabelas e triggers foram criados
- **Restart**: Reinicie a aplicação após aplicar as migrações 