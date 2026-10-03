-- Inventory: things bought to last, recorded so they can be found, rebought or
-- topped up later (docs/DESIGN.md §1 인벤토리).
--
-- Privacy model (docs/DESIGN.md §2):
--   * items is readable/writable only by its owner (RLS).
--   * Everything is private by default. The owner can put a few items on display
--     (trophy shelf); others read only those, through get_public_trophies(handle),
--     and only icon-level fields: category, name, brand, year bought.
--   * Price, store, notes, quantities and custom category names never leave the owner.

create table public.items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Built-in category (src/lib/items.ts CATEGORIES), or 'custom' with its own label.
  category          text not null check (category in ('digital', 'camera', 'bag', 'kitchen', 'living', 'hobby', 'care', 'custom')),
  custom_category   text check (char_length(custom_category) between 1 and 16),

  name              text not null check (char_length(name) between 1 and 48),
  brand             text check (char_length(brand) <= 32),
  model             text check (char_length(model) <= 48),
  bought_on         date,
  price             integer check (price between 0 and 1000000000),
  store_url         text check (char_length(store_url) <= 500),

  -- Stock-kept things (towels, plates, cables): have / want.
  qty               smallint check (qty between 0 and 999),
  qty_target        smallint check (qty_target between 0 and 999),

  status            text not null default 'using' check (status in ('using', 'spare', 'gone')),
  verdict           text check (verdict in ('again', 'other', 'never')),
  note              text check (char_length(note) <= 200),

  displayed         boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  check ((category = 'custom') = (custom_category is not null))
);

create index items_user_id_idx on public.items (user_id);

alter table public.items enable row level security;

create policy "owner can read own items"
  on public.items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can add items"
  on public.items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner can update own items"
  on public.items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner can delete own items"
  on public.items for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.items from anon;

create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.touch_updated_at();

-- The shelf holds six. Checked here so a client can't overfill it.

create function public.check_trophy_shelf()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.displayed and (
    select count(*) from public.items
    where user_id = new.user_id and displayed and id <> new.id
  ) >= 6 then
    raise exception 'trophy shelf is full (6)' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger items_trophy_shelf
  before insert or update of displayed on public.items
  for each row when (new.displayed) execute function public.check_trophy_shelf();

-- Public view: the displayed items only, icon-level fields only. A custom
-- category is reported as 'custom' without its label.

create function public.get_public_trophies(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'category', i.category,
    'name', i.name,
    'brand', i.brand,
    'since', extract(year from i.bought_on)::int
  )) order by i.created_at), '[]'::jsonb)
  from public.items i
  join public.profiles p on p.user_id = i.user_id
  where p.handle = lower(p_handle) and i.displayed;
$$;

revoke all on function public.get_public_trophies(text) from public;
grant execute on function public.get_public_trophies(text) to anon, authenticated;
