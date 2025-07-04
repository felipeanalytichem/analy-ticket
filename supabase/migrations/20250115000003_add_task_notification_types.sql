-- Add new notification types for task management
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_overdue';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_commented'; 