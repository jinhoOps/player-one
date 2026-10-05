-- Hide the helmet: the head slot stays equipped (sizes and all) but the 3D
-- character doesn't wear it. Like the hairstyle it's about looks, so it is
-- public: others see the character the way its owner chose.

alter table public.profiles
  add column hide_headwear boolean not null default false;

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
