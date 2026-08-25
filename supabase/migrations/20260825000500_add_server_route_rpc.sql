begin;

create or replace function public.resolve_cleaning_procedure(
  p_locale text,
  p_area_hint text,
  p_visible_categories text[],
  p_cleaning_focus text,
  p_target_code text default null,
  p_part_code text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with resolved as (
    select *
    from kb.resolve_procedure_route(
      null,
      p_locale,
      p_area_hint,
      p_visible_categories,
      p_cleaning_focus,
      p_target_code,
      p_part_code
    )
  )
  select jsonb_build_object(
    'release_key', r.release_key,
    'manifest_hash', rs.manifest_hash,
    'procedure_version_id', r.procedure_version_id,
    'procedure_title', r.procedure_title,
    'required_step_count', r.required_step_count,
    'space_code', r.space_code,
    'target_code', r.target_code,
    'part_code', r.part_code,
    'care_task_code', r.care_task_code,
    'focus_code', r.focus_code
  )
  from resolved r
  join kb.release_snapshots rs on rs.release_key = r.release_key and rs.is_active
  limit 1;
$$;

revoke all on function public.resolve_cleaning_procedure(text, text, text[], text, text, text) from public;
revoke all on function public.resolve_cleaning_procedure(text, text, text[], text, text, text) from anon;
revoke all on function public.resolve_cleaning_procedure(text, text, text[], text, text, text) from authenticated;
grant execute on function public.resolve_cleaning_procedure(text, text, text[], text, text, text) to service_role;

commit;
