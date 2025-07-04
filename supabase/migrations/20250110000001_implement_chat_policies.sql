-- Implementação das Políticas do Módulo de Chat Interno
-- Data: 10/01/2025
-- Baseado nas regras e políticas definidas

-- 1. Atualizar tabela de usuários para incluir níveis de agentes
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_level INTEGER CHECK (agent_level IN (1, 2));
UPDATE users SET agent_level = 1 WHERE role = 'agent' AND agent_level IS NULL;

-- 2. Adicionar campos para controle de chat
ALTER TABLE ticket_chats ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
ALTER TABLE ticket_chats ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- 3. Adicionar controle de mensagens (para moderação futura)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_moderated BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edit_deadline TIMESTAMPTZ;

-- 4. Adicionar campo para silenciar participantes temporariamente
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS is_silenced BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS silenced_until TIMESTAMPTZ;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS silenced_by UUID REFERENCES users(id);

-- 5. Função para desabilitar chat quando ticket for fechado ou resolvido
CREATE OR REPLACE FUNCTION disable_chat_on_ticket_closure()
RETURNS TRIGGER AS $$
BEGIN
    -- Verifica se o status mudou para closed ou resolved
    IF NEW.status IN ('closed', 'resolved') AND (OLD.status IS NULL OR OLD.status NOT IN ('closed', 'resolved')) THEN
        UPDATE ticket_chats 
        SET 
            is_disabled = TRUE,
            disabled_reason = 'Ticket ' || NEW.status
        WHERE ticket_id = NEW.id;
    END IF;
    
    -- Reabilita chat se ticket for reaberto
    IF NEW.status NOT IN ('closed', 'resolved') AND OLD.status IN ('closed', 'resolved') THEN
        UPDATE ticket_chats 
        SET 
            is_disabled = FALSE,
            disabled_reason = NULL
        WHERE ticket_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger para desabilitar chat automaticamente
DROP TRIGGER IF EXISTS trigger_disable_chat_on_closure ON tickets_new;
CREATE TRIGGER trigger_disable_chat_on_closure
    AFTER UPDATE OF status ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION disable_chat_on_ticket_closure();

-- 7. Função para verificar permissões baseadas nas regras do chat
CREATE OR REPLACE FUNCTION has_chat_permission(
    chat_id_param UUID,
    chat_type_param TEXT,
    user_id_param UUID,
    permission_type TEXT -- 'read', 'write', 'moderate', 'add_member'
)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
    ticket_record RECORD;
    chat_disabled BOOLEAN := FALSE;
BEGIN
    -- Buscar informações do usuário
    SELECT role, agent_level INTO user_record
    FROM users WHERE id = user_id_param;
    
    IF user_record.role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Se for chat de ticket, verificar se está desabilitado
    IF chat_type_param = 'ticket' THEN
        SELECT tc.is_disabled, t.user_id, t.assigned_to, t.status
        INTO chat_disabled, ticket_record.user_id, ticket_record.assigned_to, ticket_record.status
        FROM ticket_chats tc
        JOIN tickets_new t ON tc.ticket_id = t.id
        WHERE tc.id = chat_id_param;
        
        -- Chat desabilitado = sem permissões (exceto admins para auditoria)
        IF chat_disabled AND user_record.role != 'admin' THEN
            RETURN FALSE;
        END IF;
        
        -- Regras para usuários comuns
        IF user_record.role = 'user' THEN
            -- Só têm acesso ao chat de seus próprios tickets
            IF ticket_record.user_id != user_id_param THEN
                RETURN FALSE;
            END IF;
            
            -- Podem ler e escrever, mas não moderar ou adicionar membros
            RETURN permission_type IN ('read', 'write');
        END IF;
        
        -- Regras para Agentes Nível 1
        IF user_record.role = 'agent' AND user_record.agent_level = 1 THEN
            -- Acesso total aos chats dos tickets atribuídos a si mesmos
            IF ticket_record.assigned_to = user_id_param THEN
                RETURN TRUE;
            END IF;
            
            -- Sem acesso a outros tickets
            RETURN FALSE;
        END IF;
        
        -- Regras para Agentes Nível 2
        IF user_record.role = 'agent' AND user_record.agent_level = 2 THEN
            -- Pode consultar histórico se ticket for reatribuído
            IF ticket_record.assigned_to = user_id_param THEN
                RETURN TRUE;
            END IF;
            
            -- Pode participar se foi adicionado como participante
            IF EXISTS (
                SELECT 1 FROM chat_participants 
                WHERE chat_id = chat_id_param AND user_id = user_id_param
            ) THEN
                -- Pode moderar conversas e adicionar membros
                RETURN TRUE;
            END IF;
            
            -- Sem acesso por padrão
            RETURN FALSE;
        END IF;
        
        -- Regras para Administradores
        IF user_record.role = 'admin' THEN
            -- Acesso total a todos os chats
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Para chats diretos, usar as regras existentes
    IF chat_type_param = 'direct' THEN
        -- Admins têm acesso total
        IF user_record.role = 'admin' THEN
            RETURN TRUE;
        END IF;
        
        -- Verificar se é participante
        RETURN EXISTS (
            SELECT 1 FROM chat_participants 
            WHERE chat_id = chat_id_param AND user_id = user_id_param
        );
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Atualizar políticas RLS para usar a nova função de permissões

-- Drop políticas existentes
DO $$
BEGIN
    DROP POLICY IF EXISTS "tc_select_v2" ON ticket_chats;
    DROP POLICY IF EXISTS "cm_select_v2" ON chat_messages;
    DROP POLICY IF EXISTS "cm_insert_v2" ON chat_messages;
    DROP POLICY IF EXISTS "cp_select_v2" ON chat_participants;
    DROP POLICY IF EXISTS "cp_insert_v2" ON chat_participants;
EXCEPTION
    WHEN others THEN
        NULL;
END
$$;

-- Política para visualizar chats
CREATE POLICY "chat_access_policy_v3" ON ticket_chats
    FOR SELECT USING (
        has_chat_permission(id, 'ticket', auth.uid(), 'read')
    );

-- Política para mensagens - visualização
CREATE POLICY "chat_messages_read_policy_v3" ON chat_messages
    FOR SELECT USING (
        has_chat_permission(chat_id, 'ticket', auth.uid(), 'read')
    );

-- Política para mensagens - envio
CREATE POLICY "chat_messages_write_policy_v3" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        has_chat_permission(chat_id, 'ticket', auth.uid(), 'write') AND
        -- Verificar se usuário não está silenciado
        NOT EXISTS (
            SELECT 1 FROM chat_participants 
            WHERE chat_id = chat_messages.chat_id 
            AND user_id = auth.uid() 
            AND is_silenced = TRUE 
            AND (silenced_until IS NULL OR silenced_until > NOW())
        )
    );

-- Política para edição de mensagens próprias (dentro de 2 minutos)
CREATE POLICY "chat_messages_edit_policy_v3" ON chat_messages
    FOR UPDATE USING (
        sender_id = auth.uid() AND
        (edit_deadline IS NULL OR edit_deadline > NOW())
    );

-- Política para participantes - visualização
CREATE POLICY "chat_participants_read_policy_v3" ON chat_participants
    FOR SELECT USING (
        has_chat_permission(chat_id, 'ticket', auth.uid(), 'read')
    );

-- Política para adicionar participantes
CREATE POLICY "chat_participants_add_policy_v3" ON chat_participants
    FOR INSERT WITH CHECK (
        has_chat_permission(chat_id, 'ticket', auth.uid(), 'add_member')
    );

-- Política para moderação de participantes
CREATE POLICY "chat_participants_moderate_policy_v3" ON chat_participants
    FOR UPDATE USING (
        has_chat_permission(chat_id, 'ticket', auth.uid(), 'moderate')
    );

-- 9. Função para definir deadline de edição ao enviar mensagem
CREATE OR REPLACE FUNCTION set_message_edit_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- Define deadline de 2 minutos para edição
    NEW.edit_deadline := NEW.created_at + INTERVAL '2 minutes';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para definir deadline automaticamente
DROP TRIGGER IF EXISTS trigger_set_edit_deadline ON chat_messages;
CREATE TRIGGER trigger_set_edit_deadline
    BEFORE INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION set_message_edit_deadline();

-- 10. Função para obter chats com base no role e nível do usuário
CREATE OR REPLACE FUNCTION get_user_accessible_chats(user_id_param UUID)
RETURNS TABLE (
    chat_id UUID,
    chat_type TEXT,
    ticket_id UUID,
    ticket_number TEXT,
    ticket_title TEXT,
    other_participant_name TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER,
    is_disabled BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Buscar informações do usuário
    SELECT role, agent_level INTO user_record
    FROM users WHERE id = user_id_param;
    
    -- Para usuários comuns: apenas chats de seus próprios tickets
    IF user_record.role = 'user' THEN
        RETURN QUERY
        SELECT 
            tc.id as chat_id,
            'ticket'::TEXT as chat_type,
            tc.ticket_id,
            t.ticket_number,
            t.title as ticket_title,
            NULL::TEXT as other_participant_name,
            tc.updated_at as last_message_at,
            0 as unread_count, -- TODO: implementar contagem de não lidas
            COALESCE(tc.is_disabled, FALSE) as is_disabled
        FROM ticket_chats tc
        JOIN tickets_new t ON tc.ticket_id = t.id
        WHERE t.user_id = user_id_param
        ORDER BY tc.updated_at DESC;
        
    -- Para agentes nível 1: tickets atribuídos
    ELSIF user_record.role = 'agent' AND user_record.agent_level = 1 THEN
        RETURN QUERY
        SELECT 
            tc.id as chat_id,
            'ticket'::TEXT as chat_type,
            tc.ticket_id,
            t.ticket_number,
            t.title as ticket_title,
            NULL::TEXT as other_participant_name,
            tc.updated_at as last_message_at,
            0 as unread_count,
            COALESCE(tc.is_disabled, FALSE) as is_disabled
        FROM ticket_chats tc
        JOIN tickets_new t ON tc.ticket_id = t.id
        WHERE t.assigned_to = user_id_param
        ORDER BY tc.updated_at DESC;
        
    -- Para agentes nível 2: tickets atribuídos + participações
    ELSIF user_record.role = 'agent' AND user_record.agent_level = 2 THEN
        RETURN QUERY
        SELECT 
            tc.id as chat_id,
            'ticket'::TEXT as chat_type,
            tc.ticket_id,
            t.ticket_number,
            t.title as ticket_title,
            NULL::TEXT as other_participant_name,
            tc.updated_at as last_message_at,
            0 as unread_count,
            COALESCE(tc.is_disabled, FALSE) as is_disabled
        FROM ticket_chats tc
        JOIN tickets_new t ON tc.ticket_id = t.id
        WHERE t.assigned_to = user_id_param 
           OR EXISTS (
               SELECT 1 FROM chat_participants cp 
               WHERE cp.chat_id = tc.id AND cp.user_id = user_id_param
           )
        ORDER BY tc.updated_at DESC;
        
    -- Para administradores: todos os chats
    ELSIF user_record.role = 'admin' THEN
        RETURN QUERY
        SELECT 
            tc.id as chat_id,
            'ticket'::TEXT as chat_type,
            tc.ticket_id,
            t.ticket_number,
            t.title as ticket_title,
            NULL::TEXT as other_participant_name,
            tc.updated_at as last_message_at,
            0 as unread_count,
            COALESCE(tc.is_disabled, FALSE) as is_disabled
        FROM ticket_chats tc
        JOIN tickets_new t ON tc.ticket_id = t.id
        ORDER BY tc.updated_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Função para silenciar usuário temporariamente
CREATE OR REPLACE FUNCTION silence_chat_participant(
    p_chat_id UUID,
    p_user_id UUID,
    p_duration_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
    moderator_id UUID := auth.uid();
    moderator_record RECORD;
BEGIN
    -- Verificar se o moderador tem permissão
    SELECT role, agent_level INTO moderator_record
    FROM users WHERE id = moderator_id;
    
    -- Apenas agentes nível 2 e admins podem silenciar
    IF NOT (
        (moderator_record.role = 'agent' AND moderator_record.agent_level = 2) OR
        moderator_record.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Sem permissão para silenciar usuários';
    END IF;
    
    -- Verificar se tem permissão de moderação no chat
    IF NOT has_chat_permission(p_chat_id, 'ticket', moderator_id, 'moderate') THEN
        RAISE EXCEPTION 'Sem permissão de moderação neste chat';
    END IF;
    
    -- Silenciar o usuário
    UPDATE chat_participants
    SET 
        is_silenced = TRUE,
        silenced_until = NOW() + (p_duration_minutes || ' minutes')::INTERVAL,
        silenced_by = moderator_id
    WHERE chat_id = p_chat_id AND user_id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Função para mencionar usuário
CREATE OR REPLACE FUNCTION create_user_mention(
    p_message_id UUID,
    p_mentioned_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    sender_id UUID;
    mentioned_user_record RECORD;
BEGIN
    -- Verificar se a mensagem existe e obter o remetente
    SELECT sender_id INTO sender_id
    FROM chat_messages WHERE id = p_message_id;
    
    IF sender_id IS NULL THEN
        RAISE EXCEPTION 'Mensagem não encontrada';
    END IF;
    
    -- Verificar se o usuário mencionado existe
    SELECT id, full_name INTO mentioned_user_record
    FROM users WHERE id = p_mentioned_user_id;
    
    IF mentioned_user_record.id IS NULL THEN
        RAISE EXCEPTION 'Usuário mencionado não encontrado';
    END IF;
    
    -- Criar a menção
    INSERT INTO chat_message_mentions (message_id, mentioned_user_id)
    VALUES (p_message_id, p_mentioned_user_id)
    ON CONFLICT (message_id, mentioned_user_id) DO NOTHING;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Comentários para documentação
COMMENT ON FUNCTION has_chat_permission IS 'Verifica permissões de chat baseadas nas regras de negócio definidas';
COMMENT ON FUNCTION get_user_accessible_chats IS 'Retorna chats acessíveis baseados no role e nível do usuário';
COMMENT ON FUNCTION silence_chat_participant IS 'Permite que agentes nível 2 e admins silenciem usuários temporariamente';
COMMENT ON FUNCTION create_user_mention IS 'Cria menções de usuários em mensagens (@username)';

-- 14. Atualizar chats existentes de tickets fechados/resolvidos
UPDATE ticket_chats 
SET 
    is_disabled = TRUE,
    disabled_reason = 'Ticket already closed/resolved'
WHERE ticket_id IN (
    SELECT id FROM tickets_new WHERE status IN ('closed', 'resolved')
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION has_chat_permission TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_accessible_chats TO authenticated;
GRANT EXECUTE ON FUNCTION silence_chat_participant TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_mention TO authenticated; 