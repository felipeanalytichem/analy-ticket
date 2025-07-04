-- Fix ticket attachments table
DO $$
BEGIN
    -- Create ticket_attachments table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.ticket_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies
    DROP POLICY IF EXISTS "Users can view attachments for accessible tickets" ON public.ticket_attachments;
    CREATE POLICY "Users can view attachments for accessible tickets" ON public.ticket_attachments
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.tickets_new t
                WHERE t.id = ticket_id AND (
                    t.user_id = auth.uid() OR 
                    t.assigned_to = auth.uid() OR
                    EXISTS (
                        SELECT 1 FROM public.users 
                        WHERE id = auth.uid() AND role IN ('agent', 'admin')
                    )
                )
            )
        );

    DROP POLICY IF EXISTS "Users can upload attachments to accessible tickets" ON public.ticket_attachments;
    CREATE POLICY "Users can upload attachments to accessible tickets" ON public.ticket_attachments
        FOR INSERT WITH CHECK (
            uploaded_by = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.tickets_new t
                WHERE t.id = ticket_id AND (
                    t.user_id = auth.uid() OR 
                    t.assigned_to = auth.uid() OR
                    EXISTS (
                        SELECT 1 FROM public.users 
                        WHERE id = auth.uid() AND role IN ('agent', 'admin')
                    )
                )
            )
        );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_at ON public.ticket_attachments(uploaded_at);

    -- Grant necessary permissions
    GRANT ALL ON public.ticket_attachments TO authenticated;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

    -- Refresh PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
END $$; 