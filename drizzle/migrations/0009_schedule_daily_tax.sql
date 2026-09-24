SELECT cron.schedule(
  'synth-collect-tax',
  '0 0 * * *',
  $$ SELECT net.http_post(
    url := 'https://dmxhsmpaholkbxyijces.supabase.co/functions/v1/collect-tax',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
