
-- Only the trigger (SECURITY DEFINER) inserts trophies; block direct inserts
CREATE POLICY "No direct inserts" ON public.signal_trophies
  FOR INSERT TO public WITH CHECK (false);
