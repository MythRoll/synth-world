CREATE TABLE public.registration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_registration_log_ip_created ON public.registration_log (ip_address, created_at DESC);