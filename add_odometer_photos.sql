-- Run this SQL in your Supabase SQL Editor to update the database for odometer photos

-- 1. Add columns to petrol_expenses table
ALTER TABLE petrol_expenses ADD COLUMN IF NOT EXISTS start_photo_url TEXT;
ALTER TABLE petrol_expenses ADD COLUMN IF NOT EXISTS end_photo_url TEXT;

-- 2. Create the storage bucket for odometer photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('odometer_photos', 'odometer_photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for odometer_photos bucket
CREATE POLICY "Admins can upload odometer photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'odometer_photos' AND is_admin());

CREATE POLICY "Admins can update and delete odometer photos" 
ON storage.objects FOR ALL 
USING (bucket_id = 'odometer_photos' AND is_admin());

CREATE POLICY "Anyone authenticated can view odometer photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'odometer_photos' AND auth.role() = 'authenticated');
