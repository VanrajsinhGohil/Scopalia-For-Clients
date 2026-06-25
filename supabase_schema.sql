-- Create tables for the Client Management Portal

-- 1. Profiles (Extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')) DEFAULT 'client',
  full_name TEXT,
  company_name TEXT,
  phone_number TEXT,
  address TEXT,
  gst_number TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  project_type TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Shooting', 'Editing', 'Review', 'Delivered', 'Completed')) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Videos (Deliverables)
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  is_client_uploaded BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Petrol Expenses
CREATE TABLE petrol_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Optional, could be general
  date DATE NOT NULL,
  vehicle_type TEXT NOT NULL,
  starting_km NUMERIC NOT NULL,
  ending_km NUMERIC NOT NULL,
  total_km NUMERIC GENERATED ALWAYS AS (ending_km - starting_km) STORED,
  petrol_cost NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. General Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Petrol', 'Travel', 'Miscellaneous', 'Software', 'Equipment')),
  amount NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL,
  amount_received NUMERIC NOT NULL,
  remaining_amount NUMERIC GENERATED ALWAYS AS (total_amount - amount_received) STORED,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SET UP ROW LEVEL SECURITY (RLS)

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE petrol_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Admins can do everything on profiles" ON profiles FOR ALL USING (is_admin());
CREATE POLICY "Clients can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);

-- Projects Policies
CREATE POLICY "Admins can do everything on projects" ON projects FOR ALL USING (is_admin());
CREATE POLICY "Clients can view their own projects" ON projects FOR SELECT USING (client_id = auth.uid());

-- Videos Policies
CREATE POLICY "Admins can do everything on videos" ON videos FOR ALL USING (is_admin());
CREATE POLICY "Clients can view videos of their projects" ON videos FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = videos.project_id AND projects.client_id = auth.uid())
);
CREATE POLICY "Clients can insert videos for their own projects" ON videos FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM projects WHERE client_id = auth.uid())
);

-- Petrol Expenses Policies
CREATE POLICY "Admins can do everything on petrol_expenses" ON petrol_expenses FOR ALL USING (is_admin());
CREATE POLICY "Clients can view their own petrol_expenses" ON petrol_expenses FOR SELECT USING (client_id = auth.uid());

-- General Expenses Policies
CREATE POLICY "Admins can do everything on expenses" ON expenses FOR ALL USING (is_admin());

-- Payments Policies
CREATE POLICY "Admins can do everything on payments" ON payments FOR ALL USING (is_admin());
CREATE POLICY "Clients can view their own payments" ON payments FOR SELECT USING (client_id = auth.uid());

-- Notifications Policies
CREATE POLICY "Admins can do everything on notifications" ON notifications FOR ALL USING (is_admin());
CREATE POLICY "Clients can view their own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Clients can update their own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Set up Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('profile_photos', 'profile_photos', true);

-- Storage Policies for Videos
CREATE POLICY "Admins can upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos' AND is_admin());
CREATE POLICY "Admins can view and delete videos" ON storage.objects FOR ALL USING (bucket_id = 'videos' AND is_admin());
-- Allow authenticated users to view videos (needed for downloads)
CREATE POLICY "Authenticated users can view videos" ON storage.objects FOR SELECT USING (bucket_id = 'videos' AND auth.role() = 'authenticated');
-- Allow authenticated users to upload videos (needed for client uploads)
CREATE POLICY "Authenticated users can upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

-- Trigger to automatically create a profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'client'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
