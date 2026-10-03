-- Player One: character sheet profiles.
--
-- Privacy model (docs/DESIGN.md §2):
--   * profiles is readable/writable only by its owner (RLS).
--   * visibility is a per-field jsonb map; true = public.
--   * Others read through get_public_profile(handle), a SECURITY DEFINER RPC that
--     returns only public fields. Private body stats are never returned, so the
--     client cannot build a body morph from them.
--   * Wealth is stored as a tier index only, never an amount.

create table public.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  handle              text unique check (handle ~ '^[a-z0-9_]{3,20}$'),

  -- Profile
  nickname            text check (char_length(nickname) <= 24),
  title               text check (char_length(title) <= 32),
  birth_date          date,

  -- Class
  class_key           text check (class_key in ('warrior', 'mage', 'tank', 'healer', 'ranger', 'merchant', 'bard')),
  job_title           text check (char_length(job_title) <= 48),

  -- Base stats
  height_cm           numeric(4, 1) check (height_cm between 50 and 250),
  weight_kg           numeric(4, 1) check (weight_kg between 20 and 300),
  skeletal_muscle_kg  numeric(4, 1) check (skeletal_muscle_kg between 5 and 100),
  body_fat_pct        numeric(3, 1) check (body_fat_pct between 1 and 70),

  -- Equipment slots
  head_cm             numeric(4, 1) check (head_cm between 40 and 70),
  hat_size            text check (char_length(hat_size) <= 8),
  top_size            text check (char_length(top_size) <= 8),
  waist_cm            numeric(4, 1) check (waist_cm between 40 and 200),
  bottom_size         text check (char_length(bottom_size) <= 8),
  shoe_mm             smallint check (shoe_mm between 150 and 350),

  -- Wealth tier index (see src/lib/game.ts WEALTH_TIERS)
  wealth_tier         smallint check (wealth_tier between 0 and 19),

  visibility          jsonb not null default '{
    "nickname": true,
    "title": true,
    "level": true,
    "class": true,
    "job_title": false,
    "height": false,
    "weight": false,
    "skeletal_muscle": false,
    "body_fat": false,
    "head": false,
    "top": false,
    "bottom": false,
    "shoes": false,
    "wealth": false
  }'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "owner can read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profiles from anon;

-- updated_at

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create an empty character on sign-up.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Public view: only fields whose visibility flag is true.
-- Equipment slots always report whether they are filled ("slot appearance is public"),
-- but sizes only when that slot is public.

create function public.get_public_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.profiles;
  v jsonb;
begin
  select * into p from public.profiles where handle = lower(p_handle);
  if not found then
    return null;
  end if;
  v := p.visibility;

  return jsonb_strip_nulls(jsonb_build_object(
    'handle', p.handle,
    'nickname', case when (v ->> 'nickname')::boolean then p.nickname end,
    'title', case when (v ->> 'title')::boolean then p.title end,
    'level', case when (v ->> 'level')::boolean and p.birth_date is not null
                  then extract(year from age(p.birth_date))::int end,
    'class_key', case when (v ->> 'class')::boolean then p.class_key end,
    'job_title', case when (v ->> 'job_title')::boolean then p.job_title end,
    'height_cm', case when (v ->> 'height')::boolean then p.height_cm end,
    'weight_kg', case when (v ->> 'weight')::boolean then p.weight_kg end,
    'skeletal_muscle_kg', case when (v ->> 'skeletal_muscle')::boolean then p.skeletal_muscle_kg end,
    'body_fat_pct', case when (v ->> 'body_fat')::boolean then p.body_fat_pct end,
    'wealth_tier', case when (v ->> 'wealth')::boolean then p.wealth_tier end,
    'equipment', jsonb_build_object(
      'head', jsonb_build_object(
        'equipped', p.head_cm is not null or p.hat_size is not null,
        'head_cm', case when (v ->> 'head')::boolean then p.head_cm end,
        'hat_size', case when (v ->> 'head')::boolean then p.hat_size end),
      'top', jsonb_build_object(
        'equipped', p.top_size is not null,
        'top_size', case when (v ->> 'top')::boolean then p.top_size end),
      'bottom', jsonb_build_object(
        'equipped', p.waist_cm is not null or p.bottom_size is not null,
        'waist_cm', case when (v ->> 'bottom')::boolean then p.waist_cm end,
        'bottom_size', case when (v ->> 'bottom')::boolean then p.bottom_size end),
      'shoes', jsonb_build_object(
        'equipped', p.shoe_mm is not null,
        'shoe_mm', case when (v ->> 'shoes')::boolean then p.shoe_mm end)
    )
  ));
end;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
