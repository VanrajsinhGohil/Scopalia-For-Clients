-- Migration: Enable Client Video Uploads
-- 1. Add tracking columns to the videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_client_uploaded BOOLEAN DEFAULT false;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Update Row Level Security (RLS) on videos table
-- Allow clients to insert video records, but only for projects that belong to them
CREATE POLICY "Clients can insert videos for their own projects" ON videos 
  FOR INSERT 
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE client_id = auth.uid()
    )
  );

-- 3. Update Storage Policies for the 'videos' bucket
-- Allow authenticated users (both admin and client) to upload files into the videos bucket
CREATE POLICY "Authenticated users can upload videos" ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'videos' AND 
    auth.role() = 'authenticated'
  );
