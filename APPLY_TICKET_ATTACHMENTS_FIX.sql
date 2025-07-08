-- ============================================================================
-- APPLY TICKET ATTACHMENTS FIX
-- ============================================================================
-- Run this script in your Supabase SQL Editor to fix:
-- 1. Create ticket-attachments storage bucket
-- 2. Add missing country column to tickets_new table  
-- 3. Ensure all employee onboarding fields are present
-- 4. Create proper ticket_attachments table structure
-- ============================================================================

-- 1. Create the ticket-attachments storage bucket
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

-- 2. Add missing columns to tickets_new table
DO $$ 
BEGIN
    -- Add country column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'country') THEN
        ALTER TABLE tickets_new ADD COLUMN country TEXT;
        RAISE NOTICE 'Added country column to tickets_new';
    ELSE
        RAISE NOTICE 'Country column already exists in tickets_new';
    END IF;

    -- Add subcategory_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'subcategory_id') THEN
        ALTER TABLE tickets_new ADD COLUMN subcategory_id UUID;
        RAISE NOTICE 'Added subcategory_id column to tickets_new';
    ELSE
        RAISE NOTICE 'Subcategory_id column already exists in tickets_new';
    END IF;

    -- Add employee onboarding fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'first_name') THEN
        ALTER TABLE tickets_new ADD COLUMN first_name TEXT;
        RAISE NOTICE 'Added first_name column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'last_name') THEN
        ALTER TABLE tickets_new ADD COLUMN last_name TEXT;
        RAISE NOTICE 'Added last_name column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'username') THEN
        ALTER TABLE tickets_new ADD COLUMN username TEXT;
        RAISE NOTICE 'Added username column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'display_name') THEN
        ALTER TABLE tickets_new ADD COLUMN display_name TEXT;
        RAISE NOTICE 'Added display_name column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'job_title') THEN
        ALTER TABLE tickets_new ADD COLUMN job_title TEXT;
        RAISE NOTICE 'Added job_title column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'manager') THEN
        ALTER TABLE tickets_new ADD COLUMN manager TEXT;
        RAISE NOTICE 'Added manager column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'company_name') THEN
        ALTER TABLE tickets_new ADD COLUMN company_name TEXT;
        RAISE NOTICE 'Added company_name column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'department') THEN
        ALTER TABLE tickets_new ADD COLUMN department TEXT;
        RAISE NOTICE 'Added department column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'office_location') THEN
        ALTER TABLE tickets_new ADD COLUMN office_location TEXT;
        RAISE NOTICE 'Added office_location column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'business_phone') THEN
        ALTER TABLE tickets_new ADD COLUMN business_phone TEXT;
        RAISE NOTICE 'Added business_phone column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'mobile_phone') THEN
        ALTER TABLE tickets_new ADD COLUMN mobile_phone TEXT;
        RAISE NOTICE 'Added mobile_phone column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'start_date') THEN
        ALTER TABLE tickets_new ADD COLUMN start_date DATE;
        RAISE NOTICE 'Added start_date column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'signature_group') THEN
        ALTER TABLE tickets_new ADD COLUMN signature_group TEXT;
        RAISE NOTICE 'Added signature_group column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'usage_location') THEN
        ALTER TABLE tickets_new ADD COLUMN usage_location TEXT;
        RAISE NOTICE 'Added usage_location column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'country_distribution_list') THEN
        ALTER TABLE tickets_new ADD COLUMN country_distribution_list TEXT;
        RAISE NOTICE 'Added country_distribution_list column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'license_type') THEN
        ALTER TABLE tickets_new ADD COLUMN license_type TEXT;
        RAISE NOTICE 'Added license_type column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'mfa_setup') THEN
        ALTER TABLE tickets_new ADD COLUMN mfa_setup TEXT;
        RAISE NOTICE 'Added mfa_setup column to tickets_new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'attached_form') THEN
        ALTER TABLE tickets_new ADD COLUMN attached_form TEXT;
        RAISE NOTICE 'Added attached_form column to tickets_new';
    END IF;
END $$;

-- 3. Create ticket_attachments table if it doesn't exist
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

-- 4. Enable RLS on ticket_attachments
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist and create new ones
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

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_at ON public.ticket_attachments(uploaded_at);

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_tickets_new_country ON tickets_new(country);
CREATE INDEX IF NOT EXISTS idx_tickets_new_subcategory_id ON tickets_new(subcategory_id);

-- 7. Add comments for documentation
COMMENT ON COLUMN tickets_new.country IS 'Country where the ticket was created from';
COMMENT ON COLUMN tickets_new.subcategory_id IS 'Reference to subcategory for better categorization';

-- 8. Create storage policies for the ticket-attachments bucket
DO $$
BEGIN
    -- Check if policies exist and create them if they don't
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can view ticket attachments'
    ) THEN
        CREATE POLICY "Users can view ticket attachments" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'ticket-attachments' AND (
                    auth.uid() IS NOT NULL
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload ticket attachments'
    ) THEN
        CREATE POLICY "Users can upload ticket attachments" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'ticket-attachments' AND
                auth.uid() IS NOT NULL
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update ticket attachments'
    ) THEN
        CREATE POLICY "Users can update ticket attachments" ON storage.objects
            FOR UPDATE USING (
                bucket_id = 'ticket-attachments' AND
                auth.uid() IS NOT NULL
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete ticket attachments'
    ) THEN
        CREATE POLICY "Users can delete ticket attachments" ON storage.objects
            FOR DELETE USING (
                bucket_id = 'ticket-attachments' AND
                auth.uid() IS NOT NULL
            );
    END IF;
END $$;

-- Success message
SELECT 'SUCCESS: Ticket attachments and missing fields have been configured!' as status;
SELECT 'You can now create tickets with attachments and all employee onboarding fields.' as next_steps;

-- Verify the setup
SELECT 
    'ticket-attachments bucket created' as bucket_status,
    (SELECT COUNT(*) FROM storage.buckets WHERE id = 'ticket-attachments') as bucket_exists
UNION ALL
SELECT 
    'tickets_new country column' as column_status,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets_new' AND column_name = 'country'
    ) THEN 1 ELSE 0 END as column_exists
UNION ALL
SELECT 
    'ticket_attachments table' as table_status,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ticket_attachments'
    ) THEN 1 ELSE 0 END as table_exists; 