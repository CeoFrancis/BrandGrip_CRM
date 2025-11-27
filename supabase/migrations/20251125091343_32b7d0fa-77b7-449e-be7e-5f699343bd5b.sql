-- Fix security warnings: Set search_path for trigger functions

-- Update the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Update the calculate_days_since_follow_up function
CREATE OR REPLACE FUNCTION public.calculate_days_since_follow_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_contacted IS NOT NULL THEN
    NEW.days_since_follow_up = EXTRACT(DAY FROM (NOW() - NEW.last_contacted))::INTEGER;
  ELSE
    NEW.days_since_follow_up = NULL;
  END IF;
  RETURN NEW;
END;
$$;