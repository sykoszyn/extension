-- SykosTracker · initial schema
-- Tables are only reachable through the Edge Function (service role).
-- RLS is ENABLED with NO policies, so the public `anon`/`authenticated`
-- roles cannot read or write anything, even with the public anon key.

create table if not exists public.api_cache (
  key         text primary key,
  body        jsonb       not null,
  status      smallint    not null default 200,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists api_cache_expires_idx on public.api_cache (expires_at);

create table if not exists public.rate_limits (
  subject      text        not null,          -- sha256(install id | ip); no raw IPs stored
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (subject, window_start)
);

alter table public.api_cache   enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.api_cache, public.rate_limits from anon, authenticated;

-- Atomic per-minute counter. Returns false when the subject exceeded p_limit.
create or replace function public.sykos_hit_rate_limit(p_subject text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := date_trunc('minute', now());
  n integer;
begin
  insert into public.rate_limits (subject, window_start, hits)
  values (p_subject, w, 1)
  on conflict (subject, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end;
$$;

-- Housekeeping: drop expired cache rows and old rate-limit windows.
create or replace function public.sykos_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.api_cache   where expires_at < now();
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;

revoke execute on function public.sykos_hit_rate_limit(text, integer) from public, anon, authenticated;
revoke execute on function public.sykos_cleanup() from public, anon, authenticated;
grant  execute on function public.sykos_hit_rate_limit(text, integer) to service_role;
grant  execute on function public.sykos_cleanup() to service_role;
