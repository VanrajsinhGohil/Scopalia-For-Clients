-- Run this SQL in your Supabase SQL Editor to update RLS policies
-- This replaces "FOR ALL" policies with explicit SELECT, INSERT, UPDATE, and DELETE policies to fix the RLS violation error on inserts.

-- 1. Profiles Table Policies
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can view their own profile" ON profiles;

CREATE POLICY "Admins can select profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE USING (is_admin());

CREATE POLICY "Clients can select their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Clients can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- 2. Projects Table Policies
DROP POLICY IF EXISTS "Admins can do everything on projects" ON projects;
DROP POLICY IF EXISTS "Clients can view their own projects" ON projects;

CREATE POLICY "Admins can insert projects" ON projects FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Anyone authenticated can select projects" ON projects FOR SELECT USING (is_admin() OR client_id = auth.uid());
CREATE POLICY "Admins can update projects" ON projects FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete projects" ON projects FOR DELETE USING (is_admin());


-- 3. Videos Table Policies
DROP POLICY IF EXISTS "Admins can do everything on videos" ON videos;
DROP POLICY IF EXISTS "Clients can view videos of their projects" ON videos;

CREATE POLICY "Admins can insert videos" ON videos FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Anyone authenticated can select videos" ON videos FOR SELECT USING (
  is_admin() OR 
  EXISTS (SELECT 1 FROM projects WHERE projects.id = videos.project_id AND projects.client_id = auth.uid())
);
CREATE POLICY "Admins can update videos" ON videos FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete videos" ON videos FOR DELETE USING (is_admin());


-- 4. Petrol Expenses Table Policies
DROP POLICY IF EXISTS "Admins can do everything on petrol_expenses" ON petrol_expenses;
DROP POLICY IF EXISTS "Clients can view their own petrol_expenses" ON petrol_expenses;

CREATE POLICY "Admins can insert petrol_expenses" ON petrol_expenses FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Anyone authenticated can select petrol_expenses" ON petrol_expenses FOR SELECT USING (is_admin() OR client_id = auth.uid());
CREATE POLICY "Admins can update petrol_expenses" ON petrol_expenses FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete petrol_expenses" ON petrol_expenses FOR DELETE USING (is_admin());


-- 5. General Expenses Table Policies
DROP POLICY IF EXISTS "Admins can do everything on expenses" ON expenses;

CREATE POLICY "Admins can insert expenses" ON expenses FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can select expenses" ON expenses FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update expenses" ON expenses FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete expenses" ON expenses FOR DELETE USING (is_admin());


-- 6. Payments Table Policies
DROP POLICY IF EXISTS "Admins can do everything on payments" ON payments;
DROP POLICY IF EXISTS "Clients can view their own payments" ON payments;

CREATE POLICY "Admins can insert payments" ON payments FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Anyone authenticated can select payments" ON payments FOR SELECT USING (is_admin() OR client_id = auth.uid());
CREATE POLICY "Admins can update payments" ON payments FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete payments" ON payments FOR DELETE USING (is_admin());


-- 7. Notifications Table Policies
DROP POLICY IF EXISTS "Admins can do everything on notifications" ON notifications;
DROP POLICY IF EXISTS "Clients can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Clients can update their own notifications" ON notifications;

CREATE POLICY "Admins can insert notifications" ON notifications FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Anyone authenticated can select notifications" ON notifications FOR SELECT USING (is_admin() OR user_id = auth.uid());
CREATE POLICY "Anyone authenticated can update notifications" ON notifications FOR UPDATE USING (is_admin() OR user_id = auth.uid()) WITH CHECK (is_admin() OR user_id = auth.uid());
CREATE POLICY "Admins can delete notifications" ON notifications FOR DELETE USING (is_admin());
