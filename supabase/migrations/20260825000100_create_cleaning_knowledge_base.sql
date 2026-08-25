begin;

create extension if not exists vector with schema extensions;

create schema if not exists kb;
comment on schema kb is '검수·발행된 청소 지식과 검색 인덱스를 보관하는 비공개 스키마';

create table kb.spaces (
  code text primary key,
  label_ko text not null check (btrim(label_ko) <> ''),
  locale text not null default 'ko-KR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table kb.targets (
  code text primary key,
  space_code text not null references kb.spaces(code),
  label_ko text not null check (btrim(label_ko) <> ''),
  aliases_ko text[] not null default '{}',
  model_match_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, space_code)
);

create table kb.target_parts (
  code text primary key,
  target_code text not null references kb.targets(code),
  label_ko text not null check (btrim(label_ko) <> ''),
  aliases_ko text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, target_code)
);

create table kb.care_tasks (
  code text primary key,
  label_ko text not null check (btrim(label_ko) <> ''),
  active boolean not null default true
);

create table kb.focuses (
  code text primary key,
  label_ko text not null check (btrim(label_ko) <> ''),
  search_terms_ko text[] not null default '{}',
  active boolean not null default true
);

create table kb.app_route_aliases (
  namespace text not null check (namespace in ('area_hint', 'visible_category', 'cleaning_focus')),
  input_code text not null,
  space_code text references kb.spaces(code),
  target_code text references kb.targets(code),
  care_task_code text references kb.care_tasks(code),
  focus_code text references kb.focuses(code),
  primary key (namespace, input_code),
  foreign key (target_code, space_code) references kb.targets(code, space_code),
  constraint app_route_aliases_shape check (
    (namespace = 'area_hint' and space_code is not null and care_task_code is null and focus_code is null)
    or (namespace = 'visible_category' and space_code is null and target_code is null and care_task_code is not null and focus_code is null)
    or (namespace = 'cleaning_focus' and space_code is null and target_code is null and care_task_code is null and focus_code is not null)
  )
);

create table kb.procedures (
  id uuid primary key default gen_random_uuid(),
  procedure_key text not null unique,
  created_at timestamptz not null default now()
);

create table kb.procedure_versions (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references kb.procedures(id),
  revision integer not null check (revision > 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  locale text not null default 'ko-KR',
  title text not null check (btrim(title) <> ''),
  summary text not null check (btrim(summary) <> ''),
  required_step_count smallint not null check (required_step_count between 1 and 12),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (procedure_id, revision),
  constraint procedure_version_publish_dates check (
    status not in ('published', 'retired') or (reviewed_at is not null and published_at is not null)
  )
);

create table kb.procedure_steps (
  id uuid primary key default gen_random_uuid(),
  procedure_version_id uuid not null references kb.procedure_versions(id) on delete cascade,
  step_no smallint not null check (step_no > 0),
  stage_code text not null check (stage_code in ('prepare', 'protect', 'preclean', 'act', 'rinse', 'dry', 'finish', 'pause_check')),
  instruction text not null check (btrim(instruction) <> ''),
  detail text not null check (btrim(detail) <> ''),
  completion_cue text not null check (btrim(completion_cue) <> ''),
  caution text,
  speech_text text not null check (btrim(speech_text) <> ''),
  unique (procedure_version_id, step_no)
);

create table kb.procedure_routes (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'ko-KR',
  space_code text not null references kb.spaces(code),
  target_code text references kb.targets(code),
  part_code text references kb.target_parts(code),
  care_task_code text not null references kb.care_tasks(code),
  focus_code text references kb.focuses(code),
  specificity smallint not null default 0 check (specificity between 0 and 20),
  priority smallint not null default 100 check (priority between 0 and 1000),
  is_fallback boolean not null default false,
  procedure_version_id uuid not null references kb.procedure_versions(id),
  created_at timestamptz not null default now(),
  foreign key (target_code, space_code) references kb.targets(code, space_code),
  foreign key (part_code, target_code) references kb.target_parts(code, target_code),
  constraint procedure_route_part_requires_target check (part_code is null or target_code is not null),
  unique nulls not distinct (locale, space_code, target_code, part_code, care_task_code, focus_code, procedure_version_id)
);

create table kb.tips (
  id uuid primary key default gen_random_uuid(),
  tip_key text not null unique,
  created_at timestamptz not null default now()
);

create table kb.tip_versions (
  id uuid primary key default gen_random_uuid(),
  tip_id uuid not null references kb.tips(id),
  revision integer not null check (revision > 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  locale text not null default 'ko-KR',
  space_code text not null references kb.spaces(code),
  target_code text references kb.targets(code),
  part_code text references kb.target_parts(code),
  care_task_code text not null references kb.care_tasks(code),
  focus_code text references kb.focuses(code),
  stage_code text check (stage_code in ('prepare', 'protect', 'preclean', 'act', 'rinse', 'dry', 'finish', 'pause_check')),
  tip_text text not null check (btrim(tip_text) <> ''),
  search_text text not null check (btrim(search_text) <> ''),
  search_vector tsvector generated always as (to_tsvector('simple', search_text)) stored,
  tags text[] not null default '{}',
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tip_id, revision),
  foreign key (target_code, space_code) references kb.targets(code, space_code),
  foreign key (part_code, target_code) references kb.target_parts(code, target_code),
  constraint tip_part_requires_target check (part_code is null or target_code is not null),
  constraint tip_publish_dates check (
    status not in ('published', 'retired') or (reviewed_at is not null and published_at is not null)
  )
);

create table kb.procedure_step_tips (
  procedure_version_id uuid not null,
  step_no smallint not null,
  tip_version_id uuid not null references kb.tip_versions(id),
  display_order smallint not null default 1 check (display_order > 0),
  primary key (procedure_version_id, step_no, tip_version_id),
  foreign key (procedure_version_id, step_no)
    references kb.procedure_steps(procedure_version_id, step_no) on delete cascade
);

create table kb.risk_rules (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  created_at timestamptz not null default now()
);

create table kb.risk_rule_versions (
  id uuid primary key default gen_random_uuid(),
  risk_rule_id uuid not null references kb.risk_rules(id),
  revision integer not null check (revision > 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  locale text not null default 'ko-KR',
  trigger_code text not null check (btrim(trigger_code) <> ''),
  user_action text not null check (btrim(user_action) <> ''),
  escalation_target text,
  required_phrases text[] not null default '{}',
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (risk_rule_id, revision),
  constraint risk_publish_dates check (
    status not in ('published', 'retired') or (reviewed_at is not null and published_at is not null)
  )
);

create table kb.procedure_risk_rules (
  procedure_version_id uuid not null references kb.procedure_versions(id) on delete cascade,
  risk_rule_version_id uuid not null references kb.risk_rule_versions(id),
  display_order smallint not null default 1 check (display_order > 0),
  required boolean not null default true,
  primary key (procedure_version_id, risk_rule_version_id)
);

create table kb.sources (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique check (canonical_url ~ '^https://'),
  publisher text not null check (btrim(publisher) <> ''),
  source_kind text not null check (source_kind in ('government', 'public_agency', 'manufacturer', 'research', 'standards_body')),
  created_at timestamptz not null default now()
);

create table kb.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references kb.sources(id),
  revision integer not null default 1 check (revision > 0),
  title text not null check (btrim(title) <> ''),
  source_date text,
  accessed_at date not null,
  license_status text not null check (license_status in ('metadata_only', 'open', 'permission_required')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  locale text not null,
  created_at timestamptz not null default now(),
  unique (source_id, revision)
);

create table kb.step_source_links (
  procedure_version_id uuid not null,
  step_no smallint not null,
  source_version_id uuid not null references kb.source_versions(id),
  section_locator text not null check (btrim(section_locator) <> ''),
  support_note text not null check (btrim(support_note) <> ''),
  primary key (procedure_version_id, step_no, source_version_id),
  foreign key (procedure_version_id, step_no)
    references kb.procedure_steps(procedure_version_id, step_no) on delete cascade
);

create table kb.tip_source_links (
  tip_version_id uuid not null references kb.tip_versions(id) on delete cascade,
  source_version_id uuid not null references kb.source_versions(id),
  section_locator text not null check (btrim(section_locator) <> ''),
  support_note text not null check (btrim(support_note) <> ''),
  primary key (tip_version_id, source_version_id)
);

create table kb.risk_source_links (
  risk_rule_version_id uuid not null references kb.risk_rule_versions(id) on delete cascade,
  source_version_id uuid not null references kb.source_versions(id),
  section_locator text not null check (btrim(section_locator) <> ''),
  support_note text not null check (btrim(support_note) <> ''),
  primary key (risk_rule_version_id, source_version_id)
);

create table kb.embedding_profiles (
  profile_key text primary key,
  provider text not null check (btrim(provider) <> ''),
  model text not null check (btrim(model) <> ''),
  dimensions integer not null check (dimensions > 0),
  distance_metric text not null check (distance_metric in ('cosine', 'inner_product', 'l2')),
  input_template_version text not null check (btrim(input_template_version) <> ''),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index embedding_profiles_one_active_per_provider_idx
  on kb.embedding_profiles(provider) where active;

create table kb.tip_embeddings_e3large_1024 (
  tip_version_id uuid primary key references kb.tip_versions(id) on delete cascade,
  profile_key text not null references kb.embedding_profiles(profile_key),
  embedding extensions.vector(1024) not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  embedded_at timestamptz not null default now(),
  constraint tip_embedding_profile check (profile_key = 'openai-e3large-1024-v1')
);

create table kb.review_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('procedure_version', 'tip_version', 'risk_rule_version')),
  entity_version_id uuid not null,
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  reason text not null check (btrim(reason) <> ''),
  reviewer_ref text not null check (btrim(reviewer_ref) <> ''),
  created_at timestamptz not null default now()
);

create table kb.release_snapshots (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  locale text not null default 'ko-KR',
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  artifact_path text not null check (btrim(artifact_path) <> ''),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index release_snapshots_one_active_locale_idx
  on kb.release_snapshots(locale) where is_active;

create table kb.release_procedures (
  release_snapshot_id uuid not null references kb.release_snapshots(id) on delete cascade,
  procedure_version_id uuid not null references kb.procedure_versions(id),
  primary key (release_snapshot_id, procedure_version_id)
);

create table kb.release_tips (
  release_snapshot_id uuid not null references kb.release_snapshots(id) on delete cascade,
  tip_version_id uuid not null references kb.tip_versions(id),
  primary key (release_snapshot_id, tip_version_id)
);

create table kb.release_risks (
  release_snapshot_id uuid not null references kb.release_snapshots(id) on delete cascade,
  risk_rule_version_id uuid not null references kb.risk_rule_versions(id),
  primary key (release_snapshot_id, risk_rule_version_id)
);

create index targets_space_code_idx on kb.targets(space_code);
create index target_parts_target_code_idx on kb.target_parts(target_code);
create index procedure_versions_procedure_id_idx on kb.procedure_versions(procedure_id);
create index procedure_steps_version_order_idx on kb.procedure_steps(procedure_version_id, step_no);
create index procedure_routes_lookup_idx on kb.procedure_routes(locale, space_code, care_task_code, focus_code, target_code, part_code, priority);
create index procedure_routes_version_idx on kb.procedure_routes(procedure_version_id);
create index tip_versions_scope_idx on kb.tip_versions(locale, space_code, care_task_code, focus_code, target_code, part_code)
  where status = 'published';
create index tip_versions_search_vector_idx on kb.tip_versions using gin(search_vector)
  where status = 'published';
create index procedure_step_tips_tip_idx on kb.procedure_step_tips(tip_version_id);
create index risk_rule_versions_rule_idx on kb.risk_rule_versions(risk_rule_id);
create index procedure_risk_rules_risk_idx on kb.procedure_risk_rules(risk_rule_version_id);
create index source_versions_source_idx on kb.source_versions(source_id);
create index step_source_links_source_idx on kb.step_source_links(source_version_id);
create index tip_source_links_source_idx on kb.tip_source_links(source_version_id);
create index risk_source_links_source_idx on kb.risk_source_links(source_version_id);
create index review_events_entity_idx on kb.review_events(entity_type, entity_version_id, created_at desc);
create index release_procedures_version_idx on kb.release_procedures(procedure_version_id);
create index release_tips_version_idx on kb.release_tips(tip_version_id);
create index release_risks_version_idx on kb.release_risks(risk_rule_version_id);

create or replace function kb.validate_procedure_version(p_procedure_version_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_required smallint;
  v_count integer;
  v_min integer;
  v_max integer;
  v_errors text[] := '{}';
begin
  select required_step_count
    into v_required
  from kb.procedure_versions
  where id = p_procedure_version_id;

  if not found then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('procedure_version_not_found'));
  end if;

  select count(*), min(step_no), max(step_no)
    into v_count, v_min, v_max
  from kb.procedure_steps
  where procedure_version_id = p_procedure_version_id;

  if v_count <> v_required or coalesce(v_min, 0) <> 1 or coalesce(v_max, 0) <> v_required then
    v_errors := array_append(v_errors, 'step_sequence_invalid');
  end if;

  if exists (
    select 1
    from kb.procedure_steps ps
    where ps.procedure_version_id = p_procedure_version_id
      and not exists (
        select 1 from kb.step_source_links ssl
        where ssl.procedure_version_id = ps.procedure_version_id
          and ssl.step_no = ps.step_no
      )
  ) then
    v_errors := array_append(v_errors, 'step_source_coverage_incomplete');
  end if;

  if not exists (
    select 1 from kb.review_events re
    where re.entity_type = 'procedure_version'
      and re.entity_version_id = p_procedure_version_id
      and re.decision = 'approved'
  ) then
    v_errors := array_append(v_errors, 'procedure_review_missing');
  end if;

  return jsonb_build_object('valid', cardinality(v_errors) = 0, 'errors', to_jsonb(v_errors));
end;
$$;

create or replace function kb.guard_version_publish()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_validation jsonb;
begin
  if old.status in ('published', 'retired') then
    raise exception 'published versions are immutable; create a new revision';
  end if;

  if new.status = 'published' and old.status <> 'published' then
    if tg_table_name = 'procedure_versions' then
      v_validation := kb.validate_procedure_version(new.id);
      if not coalesce((v_validation->>'valid')::boolean, false) then
        raise exception 'procedure version is not publishable: %', v_validation->'errors';
      end if;
    elsif tg_table_name = 'tip_versions' then
      if not exists (select 1 from kb.tip_source_links where tip_version_id = new.id) then
        raise exception 'tip source coverage is required';
      end if;
      if not exists (
        select 1 from kb.review_events
        where entity_type = 'tip_version' and entity_version_id = new.id and decision = 'approved'
      ) then
        raise exception 'approved tip review is required';
      end if;
    elsif tg_table_name = 'risk_rule_versions' then
      if not exists (select 1 from kb.risk_source_links where risk_rule_version_id = new.id) then
        raise exception 'risk source coverage is required';
      end if;
      if not exists (
        select 1 from kb.review_events
        where entity_type = 'risk_rule_version' and entity_version_id = new.id and decision = 'approved'
      ) then
        raise exception 'approved risk review is required';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger procedure_versions_publish_guard
before update on kb.procedure_versions
for each row execute function kb.guard_version_publish();
create trigger tip_versions_publish_guard
before update on kb.tip_versions
for each row execute function kb.guard_version_publish();
create trigger risk_rule_versions_publish_guard
before update on kb.risk_rule_versions
for each row execute function kb.guard_version_publish();

create or replace function kb.protect_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old record;
begin
  v_old := old;
  if v_old.status in ('published', 'retired') then
    raise exception 'published or retired versions are immutable; create a new revision';
  end if;
  return old;
end;
$$;

create trigger procedure_versions_delete_guard
before delete on kb.procedure_versions
for each row execute function kb.protect_version_mutation();
create trigger tip_versions_delete_guard
before delete on kb.tip_versions
for each row execute function kb.protect_version_mutation();
create trigger risk_rule_versions_delete_guard
before delete on kb.risk_rule_versions
for each row execute function kb.protect_version_mutation();

create or replace function kb.protect_procedure_child_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := case when tg_op = 'DELETE' then old.procedure_version_id else new.procedure_version_id end;
  select status into v_status from kb.procedure_versions where id = v_version_id;
  if v_status in ('published', 'retired')
     or exists (select 1 from kb.release_procedures where procedure_version_id = v_version_id) then
    raise exception 'released procedure children are immutable; create a new revision';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger procedure_steps_mutation_guard
before insert or update or delete on kb.procedure_steps
for each row execute function kb.protect_procedure_child_mutation();
create trigger procedure_step_tips_mutation_guard
before insert or update or delete on kb.procedure_step_tips
for each row execute function kb.protect_procedure_child_mutation();
create trigger procedure_risk_rules_mutation_guard
before insert or update or delete on kb.procedure_risk_rules
for each row execute function kb.protect_procedure_child_mutation();
create trigger step_source_links_mutation_guard
before insert or update or delete on kb.step_source_links
for each row execute function kb.protect_procedure_child_mutation();

create or replace function kb.validate_release(p_release_snapshot_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_errors text[] := '{}';
  v_item record;
  v_validation jsonb;
begin
  if not exists (select 1 from kb.release_snapshots where id = p_release_snapshot_id) then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('release_not_found'));
  end if;

  if not exists (select 1 from kb.release_procedures where release_snapshot_id = p_release_snapshot_id) then
    v_errors := array_append(v_errors, 'release_has_no_procedures');
  end if;

  for v_item in
    select pv.id, pv.status
    from kb.release_procedures rp
    join kb.procedure_versions pv on pv.id = rp.procedure_version_id
    where rp.release_snapshot_id = p_release_snapshot_id
  loop
    if v_item.status <> 'published' then
      v_errors := array_append(v_errors, 'release_contains_unpublished_procedure');
    end if;
    v_validation := kb.validate_procedure_version(v_item.id);
    if not coalesce((v_validation->>'valid')::boolean, false) then
      v_errors := array_append(v_errors, 'release_contains_invalid_procedure');
    end if;
    if not exists (select 1 from kb.procedure_routes where procedure_version_id = v_item.id) then
      v_errors := array_append(v_errors, 'released_procedure_has_no_route');
    end if;
  end loop;

  if exists (
    select 1 from kb.release_tips rt
    join kb.tip_versions tv on tv.id = rt.tip_version_id
    where rt.release_snapshot_id = p_release_snapshot_id
      and (tv.status <> 'published'
        or not exists (select 1 from kb.tip_source_links tsl where tsl.tip_version_id = tv.id))
  ) then
    v_errors := array_append(v_errors, 'release_contains_invalid_tip');
  end if;

  if exists (
    select 1 from kb.release_risks rr
    join kb.risk_rule_versions rv on rv.id = rr.risk_rule_version_id
    where rr.release_snapshot_id = p_release_snapshot_id
      and (rv.status <> 'published'
        or not exists (select 1 from kb.risk_source_links rsl where rsl.risk_rule_version_id = rv.id))
  ) then
    v_errors := array_append(v_errors, 'release_contains_invalid_risk');
  end if;

  return jsonb_build_object('valid', cardinality(v_errors) = 0, 'errors', to_jsonb(v_errors));
end;
$$;

create or replace function kb.activate_release(p_release_key text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_locale text;
  v_validation jsonb;
begin
  select id, locale into v_id, v_locale
  from kb.release_snapshots
  where release_key = p_release_key
  for update;

  if not found then
    raise exception 'release not found';
  end if;

  v_validation := kb.validate_release(v_id);
  if not coalesce((v_validation->>'valid')::boolean, false) then
    raise exception 'release is not valid: %', v_validation->'errors';
  end if;

  update kb.release_snapshots set is_active = false where locale = v_locale and is_active;
  update kb.release_snapshots
    set is_active = true, activated_at = coalesce(activated_at, now())
    where id = v_id;
  return v_id;
end;
$$;

create or replace function kb.resolve_procedure_route(
  p_release_key text,
  p_locale text,
  p_area_hint text,
  p_visible_categories text[],
  p_cleaning_focus text,
  p_target_code text,
  p_part_code text
)
returns table (
  release_key text,
  procedure_version_id uuid,
  procedure_title text,
  required_step_count smallint,
  space_code text,
  target_code text,
  part_code text,
  care_task_code text,
  focus_code text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with selected_release as (
    select rs.id, rs.release_key
    from kb.release_snapshots rs
    where rs.locale = p_locale
      and ((p_release_key is null and rs.is_active) or rs.release_key = p_release_key)
    order by (rs.release_key = p_release_key) desc, rs.activated_at desc nulls last
    limit 1
  ), normalized as (
    select
      area.space_code,
      coalesce(p_target_code, area.target_code) as target_code,
      p_part_code as part_code,
      case
        when p_cleaning_focus = 'laundry' and 'laundry' = any(coalesce(p_visible_categories, '{}')) then 'laundry'
        when p_cleaning_focus = 'clutter' and 'organize' = any(coalesce(p_visible_categories, '{}')) then 'organize'
        when 'clean' = any(coalesce(p_visible_categories, '{}')) then 'clean'
        when 'organize' = any(coalesce(p_visible_categories, '{}')) then 'organize'
        when 'laundry' = any(coalesce(p_visible_categories, '{}')) then 'laundry'
        else null
      end as care_task_code,
      focus.focus_code
    from kb.app_route_aliases area
    left join kb.app_route_aliases focus
      on focus.namespace = 'cleaning_focus' and focus.input_code = p_cleaning_focus
    where area.namespace = 'area_hint' and area.input_code = p_area_hint
  ), ranked as (
    select
      sr.release_key,
      pv.id as procedure_version_id,
      pv.title,
      pv.required_step_count,
      r.space_code,
      r.target_code,
      r.part_code,
      r.care_task_code,
      r.focus_code,
      row_number() over (
        order by
          (r.target_code is not null and r.target_code = n.target_code) desc,
          (r.part_code is not null and r.part_code = n.part_code) desc,
          (r.focus_code is not null and r.focus_code = n.focus_code) desc,
          r.is_fallback asc,
          r.specificity desc,
          r.priority asc,
          r.id
      ) as route_rank
    from selected_release sr
    cross join normalized n
    join kb.procedure_routes r
      on r.locale = p_locale
      and r.space_code = n.space_code
      and r.care_task_code = n.care_task_code
      and (r.target_code is null or r.target_code = n.target_code)
      and (r.part_code is null or r.part_code = n.part_code)
      and (r.focus_code is null or r.focus_code = n.focus_code or r.focus_code = 'unknown')
    join kb.procedure_versions pv on pv.id = r.procedure_version_id and pv.status = 'published'
    join kb.release_procedures rp
      on rp.release_snapshot_id = sr.id and rp.procedure_version_id = pv.id
  )
  select
    ranked.release_key,
    ranked.procedure_version_id,
    ranked.title,
    ranked.required_step_count,
    ranked.space_code,
    ranked.target_code,
    ranked.part_code,
    ranked.care_task_code,
    ranked.focus_code
  from ranked
  where route_rank = 1;
$$;

do $$
declare
  v_table text;
begin
  for v_table in
    select tablename from pg_tables where schemaname = 'kb'
  loop
    execute format('alter table kb.%I enable row level security', v_table);
    execute format('alter table kb.%I force row level security', v_table);
  end loop;
end;
$$;

revoke all on schema kb from public, anon, authenticated;
revoke all on all tables in schema kb from public, anon, authenticated;
revoke all on all sequences in schema kb from public, anon, authenticated;
revoke execute on all functions in schema kb from public, anon, authenticated;

grant usage on schema kb to service_role;
grant select, insert, update, delete on all tables in schema kb to service_role;
grant usage, select on all sequences in schema kb to service_role;
grant execute on all functions in schema kb to service_role;

alter default privileges in schema kb revoke all on tables from public, anon, authenticated;
alter default privileges in schema kb revoke all on sequences from public, anon, authenticated;
alter default privileges in schema kb revoke execute on functions from public, anon, authenticated;

commit;
