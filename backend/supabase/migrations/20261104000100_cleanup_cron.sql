-- Optional: schedule hourly cleanup with pg_cron (enable the extension in
-- Dashboard → Database → Extensions first). Safe to skip.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sykos-cleanup', '17 * * * *', 'select public.sykos_cleanup()');
  end if;
end $$;
