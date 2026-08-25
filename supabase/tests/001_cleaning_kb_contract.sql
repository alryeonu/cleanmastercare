begin;

insert into kb.spaces(code, label_ko) values ('kb_test_space', '계약 테스트 공간');
insert into kb.targets(code, space_code, label_ko) values ('kb_test_target', 'kb_test_space', '계약 테스트 대상');
insert into kb.target_parts(code, target_code, label_ko) values ('kb_test_part', 'kb_test_target', '계약 테스트 부위');
insert into kb.care_tasks(code, label_ko) values ('clean', '계약 테스트 청소');
insert into kb.focuses(code, label_ko) values ('kb_test_unknown', '계약 테스트 확인 필요');

insert into kb.app_route_aliases(namespace, input_code, space_code, target_code)
values ('area_hint', 'kb_test_area', 'kb_test_space', 'kb_test_target');
insert into kb.app_route_aliases(namespace, input_code, care_task_code)
values ('visible_category', 'clean', 'clean');
insert into kb.app_route_aliases(namespace, input_code, focus_code)
values ('cleaning_focus', 'kb_test_focus', 'kb_test_unknown');

insert into kb.procedures(id, procedure_key)
values ('00000000-0000-0000-0000-000000000101', 'kb-contract-procedure');
insert into kb.procedure_versions(
  id, procedure_id, revision, title, summary, required_step_count, content_hash
) values (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000101',
  1,
  '계약 테스트 절차',
  '계약 테스트용 요약',
  2,
  repeat('a', 64)
);
insert into kb.procedure_steps(
  id, procedure_version_id, step_no, stage_code, instruction, detail, completion_cue, speech_text
) values
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', 1, 'prepare', '준비해요.', '준비를 확인해요.', '준비됨', '준비해요.'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000102', 2, 'finish', '마무리해요.', '마무리를 확인해요.', '마무리됨', '마무리해요.');

do $$
declare
  v_validation jsonb;
begin
  v_validation := kb.validate_procedure_version('00000000-0000-0000-0000-000000000102');
  if coalesce((v_validation->>'valid')::boolean, true) then
    raise exception 'source/review가 없는 절차가 검증을 통과했습니다';
  end if;
end;
$$;

insert into kb.sources(id, canonical_url, publisher, source_kind)
values ('00000000-0000-0000-0000-000000000105', 'https://example.com/kb-contract-source', '계약 테스트 기관', 'government');
insert into kb.source_versions(
  id, source_id, title, accessed_at, license_status, content_hash, locale
) values (
  '00000000-0000-0000-0000-000000000106',
  '00000000-0000-0000-0000-000000000105',
  '계약 테스트 출처',
  current_date,
  'metadata_only',
  repeat('b', 64),
  'ko-KR'
);
insert into kb.step_source_links(procedure_version_id, step_no, source_version_id, section_locator, support_note)
values
  ('00000000-0000-0000-0000-000000000102', 1, '00000000-0000-0000-0000-000000000106', 'section-1', '준비 단계 근거'),
  ('00000000-0000-0000-0000-000000000102', 2, '00000000-0000-0000-0000-000000000106', 'section-2', '마무리 단계 근거');
insert into kb.review_events(
  id, entity_type, entity_version_id, decision, reason, reviewer_ref
) values (
  '00000000-0000-0000-0000-000000000107',
  'procedure_version',
  '00000000-0000-0000-0000-000000000102',
  'approved',
  '스키마 계약 테스트 승인',
  'automated-contract-test'
);

update kb.procedure_versions
set status = 'published', reviewed_at = now(), published_at = now()
where id = '00000000-0000-0000-0000-000000000102';

insert into kb.procedure_routes(
  id, space_code, target_code, part_code, care_task_code, focus_code,
  specificity, priority, procedure_version_id
) values (
  '00000000-0000-0000-0000-000000000108',
  'kb_test_space', 'kb_test_target', 'kb_test_part', 'clean', 'kb_test_unknown',
  4, 1, '00000000-0000-0000-0000-000000000102'
);

insert into kb.release_snapshots(
  id, release_key, manifest_hash, artifact_path
) values (
  '00000000-0000-0000-0000-000000000109',
  'kb-contract-release',
  repeat('c', 64),
  'data/kb-contract-release.json'
);
insert into kb.release_procedures(release_snapshot_id, procedure_version_id)
values ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000102');

do $$
declare
  v_validation jsonb;
begin
  v_validation := kb.validate_release('00000000-0000-0000-0000-000000000109');
  if not coalesce((v_validation->>'valid')::boolean, false) then
    raise exception '유효한 릴리스가 검증에 실패했습니다: %', v_validation;
  end if;
end;
$$;

select kb.activate_release('kb-contract-release');

do $$
declare
  v_route record;
begin
  select * into v_route
  from kb.resolve_procedure_route(
    'kb-contract-release', 'ko-KR', 'kb_test_area', array['clean'],
    'kb_test_focus', 'kb_test_target', 'kb_test_part'
  );
  if v_route.procedure_version_id is distinct from '00000000-0000-0000-0000-000000000102'::uuid then
    raise exception 'exact route가 발행 절차를 반환하지 않았습니다';
  end if;
end;
$$;

do $$
begin
  begin
    update kb.procedure_versions
    set title = '변경되면 안 되는 제목'
    where id = '00000000-0000-0000-0000-000000000102';
    raise exception 'published procedure update was not blocked';
  exception
    when others then
      if sqlerrm = 'published procedure update was not blocked' then
        raise;
      end if;
  end;

  begin
    update kb.procedure_routes
    set priority = 2
    where id = '00000000-0000-0000-0000-000000000108';
    raise exception 'released route update was not blocked';
  exception
    when others then
      if sqlerrm = 'released route update was not blocked' then
        raise;
      end if;
  end;

  begin
    delete from kb.release_procedures
    where release_snapshot_id = '00000000-0000-0000-0000-000000000109';
    raise exception 'active release membership delete was not blocked';
  exception
    when others then
      if sqlerrm = 'active release membership delete was not blocked' then
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  if has_schema_privilege('anon', 'kb', 'usage')
     or has_schema_privilege('authenticated', 'kb', 'usage')
     or has_table_privilege('anon', 'kb.procedure_versions', 'select')
     or has_table_privilege('authenticated', 'kb.procedure_versions', 'select') then
    raise exception 'public role has direct knowledge base access';
  end if;
  if not has_schema_privilege('service_role', 'kb', 'usage')
     or not has_table_privilege('service_role', 'kb.procedure_versions', 'select') then
    raise exception 'service role does not have required server access';
  end if;
end;
$$;

rollback;
