-- Ajustar políticas RLS para permitir inserção de tickets

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can insert their own tickets" ON tickets_new;
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets_new;
DROP POLICY IF EXISTS "Agents can view all tickets" ON tickets_new;
DROP POLICY IF EXISTS "Users can update their own tickets" ON tickets_new;
DROP POLICY IF EXISTS "Agents can update assigned tickets" ON tickets_new;

-- Política para permitir que usuários criem seus próprios tickets
CREATE POLICY "Users can insert their own tickets" ON tickets_new
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para permitir que usuários vejam seus próprios tickets
CREATE POLICY "Users can view their own tickets" ON tickets_new
    FOR SELECT USING (auth.uid() = user_id);

-- Política para permitir que agentes e admins vejam todos os tickets
CREATE POLICY "Agents can view all tickets" ON tickets_new
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('agent', 'admin')
        )
    );

-- Política para permitir que usuários atualizem seus próprios tickets
CREATE POLICY "Users can update their own tickets" ON tickets_new
    FOR UPDATE USING (auth.uid() = user_id);

-- Política para permitir que agentes atualizem tickets atribuídos a eles
CREATE POLICY "Agents can update assigned tickets" ON tickets_new
    FOR UPDATE USING (
        auth.uid() = assigned_to OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('agent', 'admin')
        )
    );

-- Política para permitir que admins façam qualquer operação
CREATE POLICY "Admins can do everything" ON tickets_new
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Garantir que RLS está habilitado
ALTER TABLE tickets_new ENABLE ROW LEVEL SECURITY; 