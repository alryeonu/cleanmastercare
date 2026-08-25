begin;

create or replace function kb.protect_tip_child_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := case when tg_op = 'DELETE' then old.tip_version_id else new.tip_version_id end;
  select status into v_status from kb.tip_versions where id = v_version_id;
  if v_status in ('published', 'retired')
     or exists (select 1 from kb.release_tips where tip_version_id = v_version_id) then
    raise exception 'released tip sources are immutable; create a new revision';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger tip_source_links_mutation_guard
before insert or update or delete on kb.tip_source_links
for each row execute function kb.protect_tip_child_mutation();

create or replace function kb.protect_risk_child_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := case when tg_op = 'DELETE' then old.risk_rule_version_id else new.risk_rule_version_id end;
  select status into v_status from kb.risk_rule_versions where id = v_version_id;
  if v_status in ('published', 'retired')
     or exists (select 1 from kb.release_risks where risk_rule_version_id = v_version_id) then
    raise exception 'released risk sources are immutable; create a new revision';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger risk_source_links_mutation_guard
before insert or update or delete on kb.risk_source_links
for each row execute function kb.protect_risk_child_mutation();

create or replace function kb.protect_released_route_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_version uuid;
  v_new_version uuid;
begin
  v_old_version := case when tg_op = 'INSERT' then null else old.procedure_version_id end;
  v_new_version := case when tg_op = 'DELETE' then null else new.procedure_version_id end;
  if (v_old_version is not null and exists (
        select 1 from kb.release_procedures where procedure_version_id = v_old_version
      ))
     or (v_new_version is not null and exists (
        select 1 from kb.release_procedures where procedure_version_id = v_new_version
      )) then
    raise exception 'routes for a released procedure are immutable; create a new procedure revision';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger procedure_routes_mutation_guard
before insert or update or delete on kb.procedure_routes
for each row execute function kb.protect_released_route_mutation();

create or replace function kb.protect_active_release_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_release_id uuid;
begin
  v_release_id := case when tg_op = 'DELETE' then old.release_snapshot_id else new.release_snapshot_id end;
  if exists (
    select 1 from kb.release_snapshots
    where id = v_release_id and (is_active or activated_at is not null)
  ) then
    raise exception 'an activated release manifest is immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger release_procedures_membership_guard
before insert or update or delete on kb.release_procedures
for each row execute function kb.protect_active_release_membership();
create trigger release_tips_membership_guard
before insert or update or delete on kb.release_tips
for each row execute function kb.protect_active_release_membership();
create trigger release_risks_membership_guard
before insert or update or delete on kb.release_risks
for each row execute function kb.protect_active_release_membership();

create or replace function kb.protect_release_snapshot_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and (old.is_active or old.activated_at is not null) then
    raise exception 'an activated release snapshot cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and old.activated_at is not null and (
    new.release_key is distinct from old.release_key
    or new.locale is distinct from old.locale
    or new.manifest_hash is distinct from old.manifest_hash
    or new.artifact_path is distinct from old.artifact_path
    or new.activated_at is distinct from old.activated_at
  ) then
    raise exception 'activated release metadata is immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger release_snapshots_metadata_guard
before update or delete on kb.release_snapshots
for each row execute function kb.protect_release_snapshot_metadata();

revoke execute on all functions in schema kb from public, anon, authenticated;
grant execute on all functions in schema kb to service_role;

commit;
