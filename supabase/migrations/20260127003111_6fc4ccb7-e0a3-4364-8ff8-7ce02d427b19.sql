-- Add location_name text column to producers table for free-text location input
ALTER TABLE public.producers ADD COLUMN location_name TEXT;