-- Fix ticket attachments and missing fields
-- This migration addresses:
-- 1. Creates the ticket-attachments storage bucket
-- 2. Adds missing country column to tickets_new table
-- 3. Ensures all employee onboarding fields are present
-- 4. Creates ticket_attachments table with proper structure

-- Create the ticket-attachments storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ticket-attachments', 
    'ticket-attachments', 
    false, 
    10485760, -- 10MB limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
        'application/pdf',
        'text/plain', 'text/csv', 'text/html', 'text/markdown',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm',
        'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Add missing columns to tickets_new table
DO $$ 
BEGIN
    -- Add country column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'country') THEN
        ALTER TABLE tickets_new ADD COLUMN country TEXT;
    END IF;

    -- Add subcategory_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'subcategory_id') THEN
        ALTER TABLE tickets_new ADD COLUMN subcategory_id UUID REFERENCES public.subcategories(id);
    END IF;

    -- Add employee onboarding fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'first_name') THEN
        ALTER TABLE tickets_new ADD COLUMN first_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'last_name') THEN
        ALTER TABLE tickets_new ADD COLUMN last_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'username') THEN
        ALTER TABLE tickets_new ADD COLUMN username TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'display_name') THEN
        ALTER TABLE tickets_new ADD COLUMN display_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'job_title') THEN
        ALTER TABLE tickets_new ADD COLUMN job_title TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'manager') THEN
        ALTER TABLE tickets_new ADD COLUMN manager TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'company_name') THEN
        ALTER TABLE tickets_new ADD COLUMN company_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'department') THEN
        ALTER TABLE tickets_new ADD COLUMN department TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'office_location') THEN
        ALTER TABLE tickets_new ADD COLUMN office_location TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'business_phone') THEN
        ALTER TABLE tickets_new ADD COLUMN business_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'mobile_phone') THEN
        ALTER TABLE tickets_new ADD COLUMN mobile_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'start_date') THEN
        ALTER TABLE tickets_new ADD COLUMN start_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'signature_group') THEN
        ALTER TABLE tickets_new ADD COLUMN signature_group TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'usage_location') THEN
        ALTER TABLE tickets_new ADD COLUMN usage_location TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'country_distribution_list') THEN
        ALTER TABLE tickets_new ADD COLUMN country_distribution_list TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'license_type') THEN
        ALTER TABLE tickets_new ADD COLUMN license_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'mfa_setup') THEN
        ALTER TABLE tickets_new ADD COLUMN mfa_setup TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'attached_form') THEN
        ALTER TABLE tickets_new ADD COLUMN attached_form TEXT;
    END IF;
END $$;

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

-- Enable RLS on ticket_attachments
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view attachments for accessible tickets" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Users can upload attachments to accessible tickets" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.ticket_attachments;

-- RLS Policies for ticket_attachments
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

CREATE POLICY "Users can delete their own attachments" ON public.ticket_attachments
    FOR DELETE USING (
        uploaded_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('agent', 'admin')
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_at ON public.ticket_attachments(uploaded_at);

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_tickets_new_country ON tickets_new(country);
CREATE INDEX IF NOT EXISTS idx_tickets_new_subcategory_id ON tickets_new(subcategory_id);

-- Add comments for documentation
COMMENT ON COLUMN tickets_new.country IS 'Country where the ticket was created from';
COMMENT ON COLUMN tickets_new.subcategory_id IS 'Reference to subcategory for better categorization';

-- Storage policies for ticket-attachments bucket
INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('ticket-attachments', '.emptyFolderPlaceholder', NULL, '{}') ON CONFLICT DO NOTHING;

-- Create storage policies for the ticket-attachments bucket
CREATE POLICY IF NOT EXISTS "Users can view attachments for accessible tickets" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'ticket-attachments' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('agent', 'admin')
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Users can upload attachments" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'ticket-attachments' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY IF NOT EXISTS "Users can update their own attachments" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'ticket-attachments' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('agent', 'admin')
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Users can delete their own attachments" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'ticket-attachments' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('agent', 'admin')
            )
        )
    );

-- Success message
SELECT 'Ticket attachments and missing fields have been successfully configured.' as status; 