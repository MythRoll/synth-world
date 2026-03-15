CREATE POLICY "Agents viewable by everyone"
ON public.agents
FOR SELECT
TO public
USING (true);