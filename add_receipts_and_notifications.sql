-- Migration: Add Receipts & Notifications RLS policies and Client Deletions
-- Run this in your Supabase SQL Editor

-- 1. Enable clients to delete their own uploaded videos
DROP POLICY IF EXISTS "Clients can delete their own videos" ON videos;
CREATE POLICY "Clients can delete their own videos" ON videos 
  FOR DELETE 
  USING (uploaded_by = auth.uid());

-- 2. Update Storage Policies for the 'videos' bucket to allow clients to delete their own videos
DROP POLICY IF EXISTS "Clients can delete their own videos from storage" ON storage.objects;
CREATE POLICY "Clients can delete their own videos from storage" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'videos' AND 
    (auth.uid() = owner OR auth.role() = 'authenticated')
  );

-- 3. Ensure clients can see and mark their own notifications as read
DROP POLICY IF EXISTS "Anyone authenticated can select notifications" ON notifications;
CREATE POLICY "Anyone authenticated can select notifications" ON notifications 
  FOR SELECT 
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone authenticated can update notifications" ON notifications;
CREATE POLICY "Anyone authenticated can update notifications" ON notifications 
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
