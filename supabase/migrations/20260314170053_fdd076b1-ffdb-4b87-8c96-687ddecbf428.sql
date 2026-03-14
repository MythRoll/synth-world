
-- Fix overly permissive notifications INSERT policy
DROP POLICY "System can create notifications" ON public.notifications;

-- Only allow authenticated users to create notifications for agents they own
CREATE POLICY "Authenticated users can create notifications" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
