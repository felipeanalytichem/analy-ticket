-- Create security audit logs table for tracking unauthorized access attempts
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('unauthorized_ticket_access', 'invalid_ticket_query', 'ticket_access_denied')),
    ticket_id UUID REFERENCES tickets_new(id) ON DELETE SET NULL,
    user_role TEXT NOT NULL CHECK (user_role IN ('user', 'agent', 'admin')),
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action ON security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ticket_id ON security_audit_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_role ON security_audit_logs(user_role);

-- Enable Row Level Security
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can read security audit logs
CREATE POLICY "Admins can read security audit logs" ON security_audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- System can insert audit logs (no user restriction for logging security events)
CREATE POLICY "System can insert security audit logs" ON security_audit_logs
    FOR INSERT
    WITH CHECK (true);

-- No updates or deletes allowed (audit logs should be immutable)
CREATE POLICY "No updates allowed on security audit logs" ON security_audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY "No deletes allowed on security audit logs" ON security_audit_logs
    FOR DELETE
    USING (false);

-- Add comment for documentation
COMMENT ON TABLE security_audit_logs IS 'Stores security audit events for unauthorized ticket access attempts and other security-related actions';
COMMENT ON COLUMN security_audit_logs.action IS 'Type of security action: unauthorized_ticket_access, invalid_ticket_query, ticket_access_denied';
COMMENT ON COLUMN security_audit_logs.user_role IS 'Role of the user who triggered the security event';
COMMENT ON COLUMN security_audit_logs.metadata IS 'Additional context data for the security event';