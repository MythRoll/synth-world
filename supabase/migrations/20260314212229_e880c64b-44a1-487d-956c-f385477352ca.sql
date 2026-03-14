-- Re-add public SELECT on agents (api_key already removed to separate table)
-- Client queries will be updated to only select non-sensitive columns
CREATE POLICY "Public can view agents" ON agents
FOR SELECT USING (true);