-- =====================================================
-- SECURITY FIX: Comprehensive RLS Policy Hardening
-- =====================================================

-- 1. FIX PRODUCERS TABLE (CRITICAL - CPF and phone exposed)
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Producers viewable by authenticated" ON public.producers;

-- Only admins and operators can view producers (contains PII: CPF, phone)
CREATE POLICY "Admins and operators can view producers" 
ON public.producers 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'operator')
);

-- 2. FIX PROFILES TABLE (Email exposure)
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Admins can view all profiles (needed for user management)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 3. FIX USER_ROLES TABLE (Admins need visibility)
-- Add policy for admins to view all roles
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 4. FIX SERVICES TABLE (Contains GPS coordinates and notes)
DROP POLICY IF EXISTS "Services viewable by authenticated" ON public.services;

-- Only admins and operators can view services
CREATE POLICY "Admins and operators can view services" 
ON public.services 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'operator')
);

-- 5. FIX SERVICE_PHOTOS TABLE (Contains geolocation)
DROP POLICY IF EXISTS "Photos viewable by authenticated" ON public.service_photos;

-- Only admins and operators can view service photos
CREATE POLICY "Admins and operators can view service photos" 
ON public.service_photos 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'operator')
);

-- 6. FIX PRODUCER_DEMANDS TABLE (Links producers to demands)
DROP POLICY IF EXISTS "Producer demands viewable by authenticated" ON public.producer_demands;

-- Only admins and operators can view producer demands
CREATE POLICY "Admins and operators can view producer demands" 
ON public.producer_demands 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'operator')
);

-- 7. FIX STORAGE BUCKET (Make service-photos private)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'service-photos';

-- 8. FIX STORAGE POLICIES
DROP POLICY IF EXISTS "Photos publicly viewable" ON storage.objects;

-- Only authenticated admins and operators can view photos
CREATE POLICY "Authenticated users can view service photos" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'service-photos' AND 
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
);