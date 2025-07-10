# Storage Bucket Fix Instructions

## Issue
Images fail to load with error: "Bucket not found" for `ticket-attachments` bucket.

## Quick Fix (Manual)

If the automatic migration doesn't work, follow these steps:

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard** → Storage → Create Bucket
2. **Create new bucket with these settings:**
   - **Bucket ID**: `ticket-attachments`
   - **Bucket name**: `ticket-attachments`
   - **Public**: ❌ False (Private)
   - **File size limit**: 10MB (10485760 bytes)
   - **Allowed MIME types**: 
     ```
     image/jpeg, image/png, image/gif, image/webp, image/svg+xml, image/bmp,
     application/pdf, text/plain, text/csv, text/html, text/markdown,
     application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document,
     application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
     application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation,
     video/mp4, video/avi, video/mov, video/wmv, video/webm,
     audio/mp3, audio/wav, audio/ogg, audio/flac, audio/aac
     ```

### Option 2: Using SQL Editor

1. **Go to your Supabase Dashboard** → SQL Editor
2. **Copy and paste this SQL:**

```sql
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

-- Create storage policies for the ticket-attachments bucket
CREATE POLICY "Users can view attachments for accessible tickets" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'ticket-attachments' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('agent', 'admin')
            )
        )
    );

CREATE POLICY "Users can upload attachments" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'ticket-attachments' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can update their own attachments" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'ticket-attachments' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('agent', 'admin')
            )
        )
    );

CREATE POLICY "Users can delete their own attachments" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'ticket-attachments' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role IN ('agent', 'admin')
            )
        )
    );
```

3. **Run the SQL** by clicking the "Run" button

### Option 3: Using Supabase CLI

If you have Supabase CLI setup and linked:

```bash
supabase db push --include-all
```

## Verification

After applying any of these fixes:

1. **Check bucket exists:**
   - Go to Supabase Dashboard → Storage
   - You should see `ticket-attachments` bucket listed

2. **Test image preview:**
   - Go to a ticket with attachments
   - Click the preview (eye) icon on an image
   - The image should now load correctly

## What This Fixes

- ✅ Creates the missing `ticket-attachments` storage bucket
- ✅ Sets proper file size limits (10MB)
- ✅ Configures allowed MIME types for common file formats
- ✅ Sets up proper security policies for bucket access
- ✅ Enables authenticated users to upload/view attachments
- ✅ Restricts access based on ticket permissions

## Troubleshooting

### If bucket already exists but images still don't load:
1. Check if files were uploaded to a different bucket (`attachments` vs `ticket-attachments`)
2. Verify storage policies are correctly set
3. Check browser console for specific error messages

### If you get permission errors:
1. Ensure you're logged in to the application
2. Verify your user has the correct role (user/agent/admin)
3. Check that the ticket belongs to you or you're assigned to it

## Additional Notes

- This bucket is private (not public) for security
- Only authenticated users can access files
- File access is controlled by ticket permissions
- Maximum file size is 10MB per attachment 