-- Add missing columns to site_config
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing row to have default values
UPDATE public.site_config SET theme = 'light', metadata = '{}'::jsonb WHERE id = 'main' AND theme IS NULL;
