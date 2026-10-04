-- Account self-service (docs/DESIGN.md §2).
--
--   * Nickname changes are limited: at most 3 in any 7 days, at least 3 minutes
--     apart. Enforced here so a client can't skip it. Setting the first
--     nickname is free; the change log is the server's, never the client's.
--   * delete_my_account(): the signed-in player removes their own auth user.
--     profiles and items go with it (on delete cascade).

alter table public.profiles
  add column nickname_changes timestamptz[] not null default '{}';

create function public.limit_nickname_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent timestamptz[];
  n int;
begin
  -- Whatever the client sent for the log is ignored.
  new.nickname_changes := old.nickname_changes;

  if new.nickname is distinct from old.nickname and old.nickname is not null then
    select coalesce(array_agg(t order by t), '{}') into recent
      from unnest(old.nickname_changes) as t
     where t > now() - interval '7 days';
    n := cardinality(recent);

    if n > 0 and recent[n] > now() - interval '3 minutes' then
      raise exception 'nickname_cooldown'
        using hint = (recent[n] + interval '3 minutes')::text;
    end if;
    if n >= 3 then
      raise exception 'nickname_weekly_limit'
        using hint = (recent[1] + interval '7 days')::text;
    end if;

    new.nickname_changes := recent || now();
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_nickname_changes() from public, anon, authenticated;

create trigger profiles_limit_nickname
  before update on public.profiles
  for each row execute function public.limit_nickname_changes();

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
