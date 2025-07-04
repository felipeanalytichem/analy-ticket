-- ====================================================
-- SCRIPT PARA REMOVER COMPLETAMENTE SISTEMA DE CHAT
-- ====================================================
-- Este script remove todas as tabelas, funções, triggers 
-- e políticas relacionadas ao sistema de chat.
-- 
-- ATENÇÃO: Este script é IRREVERSÍVEL!
-- Execute apenas se tiver certeza de que deseja remover 
-- completamente o sistema de chat.
-- ====================================================

-- Remover tabelas do NOVO sistema de chat (se existirem)
DROP TABLE IF EXISTS chat_message_reactions CASCADE;
DROP TABLE IF EXISTS chat_message_mentions CASCADE;
DROP TABLE IF EXISTS chat_message_attachments CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;

-- Remover tabelas do sistema ANTIGO de chat (se existirem)
DROP TABLE IF EXISTS direct_chats CASCADE;
DROP TABLE IF EXISTS ticket_chats CASCADE;
DROP TABLE IF EXISTS chat_message_reactions_old CASCADE;
DROP TABLE IF EXISTS chat_message_mentions_old CASCADE;

-- Remover funções relacionadas ao chat
DROP FUNCTION IF EXISTS get_or_create_ticket_chat_room(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_or_create_direct_chat_room(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_unread_messages_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_messages_as_read(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_chat_participants(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_room_last_message() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_unread_chat_messages_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_chat_messages_as_read(UUID, UUID) CASCADE;

-- Remover triggers relacionados ao chat
DROP TRIGGER IF EXISTS trigger_update_room_last_message ON chat_messages;
DROP TRIGGER IF EXISTS trigger_chat_rooms_updated_at ON chat_rooms;
DROP TRIGGER IF EXISTS trigger_chat_messages_updated_at ON chat_messages;

-- Remover policies de RLS relacionadas ao chat (se existirem)
-- Nota: As policies são removidas automaticamente quando as tabelas são dropadas

-- Remover bucket de storage do chat (se existir)
DELETE FROM storage.buckets WHERE id = 'chat-files';

-- Limpar qualquer referência a chat em outras tabelas (se necessário)
-- Nota: Como não temos foreign keys diretas para chat em outras tabelas, 
-- não é necessário limpar referências

-- ====================================================
-- VERIFICAÇÃO FINAL
-- ====================================================
-- Execute as queries abaixo para verificar se tudo foi removido:

-- Verificar se ainda existem tabelas de chat
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name LIKE '%chat%';

-- Verificar se ainda existem funções de chat
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name LIKE '%chat%';

-- ====================================================
-- RESULTADO ESPERADO
-- ====================================================
-- Após executar este script:
-- ✅ Todas as tabelas de chat removidas
-- ✅ Todas as funções de chat removidas  
-- ✅ Todos os triggers de chat removidos
-- ✅ Todas as policies de chat removidas
-- ✅ Bucket de storage removido
-- ✅ Sistema de chat completamente removido
-- ✅ Outras funcionalidades permanecem intactas

COMMIT; 