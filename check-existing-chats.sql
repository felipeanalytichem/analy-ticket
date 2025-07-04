-- Check for orphaned chats (chats without tickets)
DELETE FROM ticket_chats
WHERE ticket_id NOT IN (SELECT id FROM tickets_new);

-- Check for tickets without chats
INSERT INTO ticket_chats (ticket_id, chat_type, is_active, created_at, updated_at)
SELECT id, 'ticket', true, NOW(), NOW()
FROM tickets_new t
WHERE NOT EXISTS (
    SELECT 1 FROM ticket_chats tc WHERE tc.ticket_id = t.id
);

-- Check for chats without participants
INSERT INTO chat_participants (chat_id, user_id, can_write, joined_at)
SELECT DISTINCT tc.id, t.creator_id, true, NOW()
FROM ticket_chats tc
JOIN tickets_new t ON tc.ticket_id = t.id
WHERE NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = tc.id 
    AND cp.user_id = t.creator_id
);

-- Add missing assigned agents to chats
INSERT INTO chat_participants (chat_id, user_id, can_write, joined_at)
SELECT DISTINCT tc.id, t.assigned_to, true, NOW()
FROM ticket_chats tc
JOIN tickets_new t ON tc.ticket_id = t.id
WHERE t.assigned_to IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = tc.id 
    AND cp.user_id = t.assigned_to
);

-- Update all chat timestamps
UPDATE ticket_chats tc
SET updated_at = (
    SELECT MAX(created_at) 
    FROM chat_messages cm 
    WHERE cm.chat_id = tc.id
)
WHERE EXISTS (
    SELECT 1 FROM chat_messages cm 
    WHERE cm.chat_id = tc.id
); 