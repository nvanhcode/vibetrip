-- Migration: Add province_code and ward_code to event_organizers
-- Đơn vị tổ chức được phân phạm vi theo tỉnh và xã.

ALTER TABLE public.event_organizers
  ADD COLUMN IF NOT EXISTS province_code text REFERENCES public.provinces(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ward_code text REFERENCES public.wards(code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_organizers_province_code_idx
  ON public.event_organizers(province_code);

CREATE INDEX IF NOT EXISTS event_organizers_ward_code_idx
  ON public.event_organizers(ward_code);
