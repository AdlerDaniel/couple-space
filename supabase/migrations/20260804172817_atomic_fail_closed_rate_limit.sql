create or replace function public.consume_api_rate_limit(
  p_route text,
  p_identity_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table (
  allowed boolean,
  request_count bigint,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cutoff timestamptz;
  current_count bigint;
begin
  if p_route is null or btrim(p_route) = '' then
    raise exception 'p_route must not be empty' using errcode = '22023';
  end if;
  if p_identity_hash is null or p_identity_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'p_identity_hash must be a SHA-256 hex digest' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'p_window_seconds must be between 1 and 86400' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'p_limit must be between 1 and 10000' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_route || ':' || p_identity_hash, 0)
  );

  cutoff := pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => p_window_seconds);

  delete from public.api_rate_limit_events
  where route = p_route
    and identity_hash = p_identity_hash
    and created_at < cutoff;

  insert into public.api_rate_limit_events (route, identity_hash)
  values (p_route, p_identity_hash);

  select count(*)
  into current_count
  from public.api_rate_limit_events
  where route = p_route
    and identity_hash = p_identity_hash
    and created_at >= cutoff;

  return query
  select current_count <= p_limit, current_count, p_window_seconds;
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
