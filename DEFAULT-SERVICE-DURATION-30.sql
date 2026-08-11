-- Default service duration to 30 minutes.
-- Run this once in Supabase SQL Editor.

UPDATE public.services
SET duration_minutes = 30
WHERE duration_minutes IS NULL OR duration_minutes <= 0;

ALTER TABLE public.services
ALTER COLUMN duration_minutes SET DEFAULT 30;

-- Optional but recommended: prevent negative/zero durations.
ALTER TABLE public.services
DROP CONSTRAINT IF EXISTS services_duration_minutes_positive;

ALTER TABLE public.services
ADD CONSTRAINT services_duration_minutes_positive
CHECK (duration_minutes IS NULL OR duration_minutes > 0);
