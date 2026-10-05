-- The public sheet frosts over what its owner made private (docs/DESIGN.md §6),
-- so get_public_profile also says which fields are sealed: the visibility keys
-- that are private and hold a value. Private-and-empty stays "—", so the list
-- reveals only that something is there, never what.

create or replace function public.get_public_profile(p_handle text)
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
    'body_type', case when (v ->> 'body_type')::boolean then p.body_type end,
    'hair_style', p.hair_style,
    'hide_headwear', p.hide_headwear,
    'height_cm', case when (v ->> 'height')::boolean then p.height_cm end,
    'weight_kg', case when (v ->> 'weight')::boolean then p.weight_kg end,
    'skeletal_muscle_kg', case when (v ->> 'skeletal_muscle')::boolean then p.skeletal_muscle_kg end,
    'body_fat_pct', case when (v ->> 'body_fat')::boolean then p.body_fat_pct end,
    'wealth_tier', case when (v ->> 'wealth')::boolean then p.wealth_tier end,
    'sealed', (
      select coalesce(jsonb_agg(t.k), '[]'::jsonb)
      from (values
        ('height', p.height_cm is not null),
        ('weight', p.weight_kg is not null),
        ('skeletal_muscle', p.skeletal_muscle_kg is not null),
        ('body_fat', p.body_fat_pct is not null),
        ('head', p.head_cm is not null or p.hat_size is not null),
        ('top', p.top_size is not null),
        ('bottom', p.waist_cm is not null or p.bottom_size is not null),
        ('shoes', p.shoe_mm is not null),
        ('class', p.class_key is not null),
        ('job_title', coalesce(p.job_title, '') <> ''),
        ('wealth', p.wealth_tier is not null)
      ) as t(k, has)
      where t.has and not coalesce((v ->> t.k)::boolean, false)),
    'equipment', jsonb_build_object(
      'head', jsonb_build_object(
        'equipped', p.head_cm is not null or p.hat_size is not null,
        'kind', p.gear ->> 'head',
        'head_cm', case when (v ->> 'head')::boolean then p.head_cm end,
        'hat_size', case when (v ->> 'head')::boolean then p.hat_size end),
      'top', jsonb_build_object(
        'equipped', p.top_size is not null,
        'kind', p.gear ->> 'top',
        'top_size', case when (v ->> 'top')::boolean then p.top_size end),
      'bottom', jsonb_build_object(
        'equipped', p.waist_cm is not null or p.bottom_size is not null,
        'kind', p.gear ->> 'bottom',
        'waist_cm', case when (v ->> 'bottom')::boolean then p.waist_cm end,
        'bottom_size', case when (v ->> 'bottom')::boolean then p.bottom_size end),
      'shoes', jsonb_build_object(
        'equipped', p.shoe_mm is not null,
        'kind', p.gear ->> 'shoes',
        'shoe_mm', case when (v ->> 'shoes')::boolean then p.shoe_mm end)
    )
  ));
end;
$$;
