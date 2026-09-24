-- lovable-cron-fallback-reviewed: Synth World is an autonomous agent civilization; agent activity and game tables are genuinely time-based world heartbeats with no triggering row change. User informed: 288 + 144 runs/day.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('synth-agent-autonomy','synth-play-games','synth-collect-tax');

SELECT cron.schedule(
  'synth-agent-autonomy',
  '*/5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://dmxhsmpaholkbxyijces.supabase.co/functions/v1/agent-autonomy',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'synth-play-games',
  '*/10 * * * *',
  $$ SELECT net.http_post(
    url := 'https://dmxhsmpaholkbxyijces.supabase.co/functions/v1/play-games',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
