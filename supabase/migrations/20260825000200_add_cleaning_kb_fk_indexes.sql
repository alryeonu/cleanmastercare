begin;

-- Composite foreign keys already enforce target/part ownership. Remove duplicate
-- single-column constraints so each relationship has one clear indexed path.
alter table kb.app_route_aliases drop constraint app_route_aliases_target_code_fkey;
alter table kb.procedure_routes drop constraint procedure_routes_target_code_fkey;
alter table kb.procedure_routes drop constraint procedure_routes_part_code_fkey;
alter table kb.tip_versions drop constraint tip_versions_target_code_fkey;
alter table kb.tip_versions drop constraint tip_versions_part_code_fkey;

create index app_route_aliases_space_idx on kb.app_route_aliases(space_code);
create index app_route_aliases_target_space_idx on kb.app_route_aliases(target_code, space_code);
create index app_route_aliases_task_idx on kb.app_route_aliases(care_task_code);
create index app_route_aliases_focus_idx on kb.app_route_aliases(focus_code);

create index procedure_routes_space_idx on kb.procedure_routes(space_code);
create index procedure_routes_target_space_idx on kb.procedure_routes(target_code, space_code);
create index procedure_routes_part_target_idx on kb.procedure_routes(part_code, target_code);
create index procedure_routes_task_idx on kb.procedure_routes(care_task_code);
create index procedure_routes_focus_idx on kb.procedure_routes(focus_code);

create index tip_versions_space_idx on kb.tip_versions(space_code);
create index tip_versions_target_space_idx on kb.tip_versions(target_code, space_code);
create index tip_versions_part_target_idx on kb.tip_versions(part_code, target_code);
create index tip_versions_task_idx on kb.tip_versions(care_task_code);
create index tip_versions_focus_idx on kb.tip_versions(focus_code);

create index tip_embeddings_profile_idx on kb.tip_embeddings_e3large_1024(profile_key);

commit;
