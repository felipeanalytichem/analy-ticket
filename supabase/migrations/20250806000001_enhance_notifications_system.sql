-- Enhanced Notifications System Migration
-- This migration adds all the necessary enhancements for the improved notification system

-- Add new notification types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assignment_changed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'sla_warning';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'sla_breach';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_closed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_reopened';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'first_response_action';

-- Add new columns to notifications table for enhanced functionality
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS grouped_id UUID,
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'retrying')),
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_ip INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_notifications_grouped_id ON notifications(grouped_id);
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type_user ON notifications(type, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_type ON notifications(ticket_id, type);

-- Create notification queue table for offline/retry handling
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_data JSONB NOT NULL,
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notification queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_next_attempt ON notification_queue(next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_attempts ON notification_queue(attempts);

-- Create notification groups table for intelligent grouping
CREATE TABLE IF NOT EXISTS notification_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets_new(id) ON DELETE CASCADE,
  group_type VARCHAR(50) NOT NULL,
  group_key VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  notification_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  latest_notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, group_key)
);

-- Create indexes for notification groups
CREATE INDEX IF NOT EXISTS idx_notification_groups_user_id ON notification_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_groups_ticket_id ON notification_groups(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notification_groups_group_type ON notification_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_notification_groups_updated_at ON notification_groups(updated_at DESC);

-- Create notification templates table for i18n support
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  title_template TEXT NOT NULL,
  message_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(type, language)
);

-- Create indexes for notification templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_language ON notification_templates(language);

-- Create notification delivery log table for tracking
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('realtime', 'email', 'push', 'sms')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  attempt_count INTEGER DEFAULT 1,
  error_message TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for delivery log
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_method ON notification_delivery_log(delivery_method);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_created_at ON notification_delivery_log(created_at);

-- Enable RLS on new tables
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_queue
CREATE POLICY "Users can view their own notification queue" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage notification queue" ON notification_queue
  FOR ALL WITH CHECK (true);

-- RLS policies for notification_groups
CREATE POLICY "Users can view their own notification groups" ON notification_groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification groups" ON notification_groups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can manage notification groups" ON notification_groups
  FOR ALL WITH CHECK (true);

-- RLS policies for notification_templates
CREATE POLICY "Everyone can read notification templates" ON notification_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage notification templates" ON notification_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- RLS policies for notification_delivery_log
CREATE POLICY "Users can view delivery logs for their notifications" ON notification_delivery_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.id = notification_id 
      AND n.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all delivery logs" ON notification_delivery_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can manage delivery logs" ON notification_delivery_log
  FOR ALL WITH CHECK (true);

-- Create function to group notifications intelligently
CREATE OR REPLACE FUNCTION group_notification(
  p_user_id UUID,
  p_notification_id UUID,
  p_ticket_id UUID DEFAULT NULL,
  p_notification_type notification_type DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
  group_key VARCHAR(255);
  group_id UUID;
  group_title TEXT;
BEGIN
  -- Determine group key based on notification type and ticket
  IF p_ticket_id IS NOT NULL THEN
    group_key := 'ticket_' || p_ticket_id::TEXT;
    group_title := 'Ticket #' || (SELECT ticket_number FROM tickets_new WHERE id = p_ticket_id);
  ELSE
    group_key := 'type_' || p_notification_type::TEXT;
    group_title := CASE p_notification_type
      WHEN 'ticket_created' THEN 'New Tickets'
      WHEN 'ticket_updated' THEN 'Ticket Updates'
      WHEN 'ticket_assigned' THEN 'Ticket Assignments'
      WHEN 'comment_added' THEN 'New Comments'
      WHEN 'status_changed' THEN 'Status Changes'
      WHEN 'priority_changed' THEN 'Priority Changes'
      WHEN 'assignment_changed' THEN 'Assignment Changes'
      WHEN 'sla_warning' THEN 'SLA Warnings'
      WHEN 'sla_breach' THEN 'SLA Breaches'
      ELSE 'System Notifications'
    END;
  END IF;

  -- Insert or update notification group
  INSERT INTO notification_groups (
    user_id,
    ticket_id,
    group_type,
    group_key,
    title,
    notification_count,
    unread_count,
    latest_notification_id
  ) VALUES (
    p_user_id,
    p_ticket_id,
    CASE WHEN p_ticket_id IS NOT NULL THEN 'ticket' ELSE 'type' END,
    group_key,
    group_title,
    1,
    1,
    p_notification_id
  )
  ON CONFLICT (user_id, group_key) 
  DO UPDATE SET
    notification_count = notification_groups.notification_count + 1,
    unread_count = notification_groups.unread_count + 1,
    latest_notification_id = p_notification_id,
    updated_at = NOW()
  RETURNING id INTO group_id;

  -- Update the notification with the group ID
  UPDATE notifications 
  SET grouped_id = group_id 
  WHERE id = p_notification_id;

  RETURN group_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark notification group as read
CREATE OR REPLACE FUNCTION mark_notification_group_read(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $
DECLARE
  affected_count INTEGER;
BEGIN
  -- Mark all notifications in the group as read
  UPDATE notifications 
  SET read = true, read_at = NOW(), updated_at = NOW()
  WHERE grouped_id = p_group_id 
    AND user_id = p_user_id 
    AND read = false;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Update the group's unread count
  UPDATE notification_groups 
  SET unread_count = 0, updated_at = NOW()
  WHERE id = p_group_id AND user_id = p_user_id;
  
  RETURN affected_count > 0;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get notification statistics
CREATE OR REPLACE FUNCTION get_notification_stats(p_user_id UUID)
RETURNS TABLE (
  total_notifications BIGINT,
  unread_notifications BIGINT,
  total_groups BIGINT,
  unread_groups BIGINT,
  notifications_by_type JSONB,
  recent_activity JSONB
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND read = false),
    (SELECT COUNT(*) FROM notification_groups WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM notification_groups WHERE user_id = p_user_id AND unread_count > 0),
    (SELECT jsonb_object_agg(type, count) 
     FROM (
       SELECT type, COUNT(*) as count 
       FROM notifications 
       WHERE user_id = p_user_id 
       GROUP BY type
     ) t),
    (SELECT jsonb_agg(
       jsonb_build_object(
         'date', DATE(created_at),
         'count', count
       )
     )
     FROM (
       SELECT DATE(created_at) as created_at, COUNT(*) as count
       FROM notifications 
       WHERE user_id = p_user_id 
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) DESC
     ) recent);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired notifications
  DELETE FROM notifications 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up empty groups
  DELETE FROM notification_groups 
  WHERE notification_count = 0 
    OR NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE grouped_id = notification_groups.id
    );
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically group notifications
CREATE OR REPLACE FUNCTION trigger_group_notification()
RETURNS TRIGGER AS $
BEGIN
  -- Only group notifications for certain types
  IF NEW.type IN ('ticket_created', 'ticket_updated', 'ticket_assigned', 'comment_added', 'status_changed', 'priority_changed', 'assignment_changed') THEN
    PERFORM group_notification(NEW.user_id, NEW.id, NEW.ticket_id, NEW.type);
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_group_notifications
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_group_notification();

-- Create trigger to update group counts when notifications are read
CREATE OR REPLACE FUNCTION trigger_update_group_read_count()
RETURNS TRIGGER AS $
BEGIN
  -- If notification was marked as read
  IF OLD.read = false AND NEW.read = true AND NEW.grouped_id IS NOT NULL THEN
    UPDATE notification_groups 
    SET unread_count = GREATEST(0, unread_count - 1),
        updated_at = NOW()
    WHERE id = NEW.grouped_id;
  END IF;
  
  -- If notification was marked as unread
  IF OLD.read = true AND NEW.read = false AND NEW.grouped_id IS NOT NULL THEN
    UPDATE notification_groups 
    SET unread_count = unread_count + 1,
        updated_at = NOW()
    WHERE id = NEW.grouped_id;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_group_read_count
  AFTER UPDATE ON notifications
  FOR EACH ROW
  WHEN (OLD.read IS DISTINCT FROM NEW.read)
  EXECUTE FUNCTION trigger_update_group_read_count();

-- Insert default notification templates
INSERT INTO notification_templates (type, language, title_template, message_template, variables) VALUES
-- English templates
('ticket_created', 'en', 'New Ticket Created', 'Ticket #{ticket_number} has been created: {title}', '["ticket_number", "title"]'),
('ticket_updated', 'en', 'Ticket Updated', 'Ticket #{ticket_number} has been updated', '["ticket_number"]'),
('ticket_assigned', 'en', 'Ticket Assigned', 'Ticket #{ticket_number} has been assigned to you', '["ticket_number"]'),
('comment_added', 'en', 'New Comment', 'New comment added to ticket #{ticket_number}', '["ticket_number"]'),
('status_changed', 'en', 'Status Changed', 'Ticket #{ticket_number} status changed to {status}', '["ticket_number", "status"]'),
('priority_changed', 'en', 'Priority Changed', 'Ticket #{ticket_number} priority changed to {priority}', '["ticket_number", "priority"]'),
('assignment_changed', 'en', 'Assignment Changed', 'Ticket #{ticket_number} has been reassigned', '["ticket_number"]'),
('sla_warning', 'en', 'SLA Warning', 'Ticket #{ticket_number} is approaching SLA deadline', '["ticket_number"]'),
('sla_breach', 'en', 'SLA Breach', 'Ticket #{ticket_number} has breached SLA deadline', '["ticket_number"]'),

-- Portuguese templates
('ticket_created', 'pt', 'Novo Ticket Criado', 'Ticket #{ticket_number} foi criado: {title}', '["ticket_number", "title"]'),
('ticket_updated', 'pt', 'Ticket Atualizado', 'Ticket #{ticket_number} foi atualizado', '["ticket_number"]'),
('ticket_assigned', 'pt', 'Ticket Atribuído', 'Ticket #{ticket_number} foi atribuído a você', '["ticket_number"]'),
('comment_added', 'pt', 'Novo Comentário', 'Novo comentário adicionado ao ticket #{ticket_number}', '["ticket_number"]'),
('status_changed', 'pt', 'Status Alterado', 'Status do ticket #{ticket_number} alterado para {status}', '["ticket_number", "status"]'),
('priority_changed', 'pt', 'Prioridade Alterada', 'Prioridade do ticket #{ticket_number} alterada para {priority}', '["ticket_number", "priority"]'),
('assignment_changed', 'pt', 'Atribuição Alterada', 'Ticket #{ticket_number} foi reatribuído', '["ticket_number"]'),
('sla_warning', 'pt', 'Aviso de SLA', 'Ticket #{ticket_number} está se aproximando do prazo SLA', '["ticket_number"]'),
('sla_breach', 'pt', 'Violação de SLA', 'Ticket #{ticket_number} violou o prazo SLA', '["ticket_number"]'),

-- Spanish templates
('ticket_created', 'es', 'Nuevo Ticket Creado', 'Ticket #{ticket_number} ha sido creado: {title}', '["ticket_number", "title"]'),
('ticket_updated', 'es', 'Ticket Actualizado', 'Ticket #{ticket_number} ha sido actualizado', '["ticket_number"]'),
('ticket_assigned', 'es', 'Ticket Asignado', 'Ticket #{ticket_number} ha sido asignado a usted', '["ticket_number"]'),
('comment_added', 'es', 'Nuevo Comentario', 'Nuevo comentario añadido al ticket #{ticket_number}', '["ticket_number"]'),
('status_changed', 'es', 'Estado Cambiado', 'Estado del ticket #{ticket_number} cambiado a {status}', '["ticket_number", "status"]'),
('priority_changed', 'es', 'Prioridad Cambiada', 'Prioridad del ticket #{ticket_number} cambiada a {priority}', '["ticket_number", "priority"]'),
('assignment_changed', 'es', 'Asignación Cambiada', 'Ticket #{ticket_number} ha sido reasignado', '["ticket_number"]'),
('sla_warning', 'es', 'Advertencia de SLA', 'Ticket #{ticket_number} se acerca al plazo SLA', '["ticket_number"]'),
('sla_breach', 'es', 'Violación de SLA', 'Ticket #{ticket_number} ha violado el plazo SLA', '["ticket_number"]')

ON CONFLICT (type, language) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_groups TO authenticated;
GRANT SELECT ON notification_templates TO authenticated;
GRANT SELECT ON notification_delivery_log TO authenticated;

GRANT EXECUTE ON FUNCTION group_notification(UUID, UUID, UUID, notification_type) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_group_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications() TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE notification_queue IS 'Queue for notifications that need to be delivered or retried';
COMMENT ON TABLE notification_groups IS 'Groups related notifications together for better UX';
COMMENT ON TABLE notification_templates IS 'Templates for notification messages in different languages';
COMMENT ON TABLE notification_delivery_log IS 'Log of notification delivery attempts and results';

COMMENT ON FUNCTION group_notification(UUID, UUID, UUID, notification_type) IS 'Automatically groups a notification with related notifications';
COMMENT ON FUNCTION mark_notification_group_read(UUID, UUID) IS 'Marks all notifications in a group as read';
COMMENT ON FUNCTION get_notification_stats(UUID) IS 'Returns comprehensive notification statistics for a user';
COMMENT ON FUNCTION cleanup_expired_notifications() IS 'Removes expired notifications and cleans up empty groups';