# Supabase 청소 지식 스키마와 보안

## 무엇을 만들었는지

- 연결된 빈 개발 Supabase 프로젝트에 비공개 `kb` 스키마와 28개 관계형 테이블을 만들었다.
- 공간·대상·부위·과업·focus taxonomy, 절차·단계·팁·위험 규칙·출처의 버전, 검수 이벤트, 발행 릴리스와 1024차원 pgvector 임베딩 테이블을 구현했다.
- 단계 연속성, 단계별 출처 100%, 승인 검수, published 상태, 릴리스 포함 관계를 검사하는 validation 함수를 구현했다.
- 앱 enum을 taxonomy로 바꾸고 발행 릴리스 안에서만 exact route를 선택하는 `kb.resolve_procedure_route`를 구현했다.
- published version의 본문·단계·출처 링크·라우팅과 활성 릴리스 manifest를 수정하지 못하게 하는 트리거를 추가했다.
- `anon`과 `authenticated`의 `kb` schema/base table 권한을 철회하고 모든 테이블에 RLS와 FORCE RLS를 적용했다. 서버의 `service_role`만 최소 DB 권한을 가진다.
- 재현 가능한 migration 3개와 트랜잭션 롤백형 DB 계약 테스트를 저장소에 추가했다.

## 문제·막힌 지점

- 로컬에 Supabase CLI가 없어 `supabase migration new`와 로컬 DB 재현 절차를 실행할 수 없었다.
- 첫 migration에서 tag 배열을 포함한 생성형 `tsvector` 식이 PostgreSQL의 immutable 조건을 만족하지 않아 전체 적용이 롤백됐다.
- 첫 계약 테스트는 테스트 전용 care task 코드가 실제 앱 enum `clean`과 달라 exact route가 선택되지 않았다.
- 초기 성능 어드바이저가 composite FK와 별개인 중복 단일 FK, FK 선두 열 인덱스 누락을 정보성 문제로 보고했다.

## 직접 원인과 근본 원인

- `array_to_string(tags, ...)`는 생성 열에서 요구되는 immutable 식으로 인정되지 않았다.
- 라우팅 함수는 오염 확정 후 서버 enum 계약인 `organize|clean|laundry`만 선택하는데 계약 테스트가 임시 문자열을 사용했다.
- PostgreSQL은 FK 열에 인덱스를 자동 생성하지 않으며, 검색용 복합 인덱스는 모든 FK의 선두 열 조건을 대신하지 못한다.

## 해결

- migration 파일은 저장소에 명시적으로 만들고, 원격 변경은 추적 가능한 Supabase migration 도구로만 적용했다.
- 검색 벡터는 검수된 `search_text`만 `simple` 설정으로 생성하고 tags는 구조화 필터로 분리했다.
- 테스트 care task를 실제 앱 코드 `clean`으로 바꿔 enum 계약 자체를 검증했다.
- 중복 단일 FK를 제거하고 각 composite/single FK 경로의 선두 열 인덱스를 보강했다.
- 릴리스가 활성화된 뒤 route, source link와 manifest 구성까지 잠그도록 후속 hardening migration을 추가했다.

## 실행한 테스트와 실제 결과

- migration 3개 원격 적용: 모두 성공.
- `supabase/tests/001_cleaning_kb_contract.sql`: 성공. source/review 없는 절차 거부, 발행 절차 승인, active release validation, exact route 적중, published version/route/manifest 불변성, 익명 base 접근 거부를 확인하고 전체 테스트 데이터를 ROLLBACK했다.
- 계약 테스트 후 `spaces=0`, `procedure_versions=0`, `releases=0`: 임시 데이터가 남지 않음을 확인했다.
- catalog 권한: `anon_schema_usage=false`, `authenticated_schema_usage=false`, `service_role_schema_usage=true`; base table select도 공개 역할은 false, service role은 true.
- 28/28 `kb` 테이블 RLS 활성화 확인.
- Security Advisor: ERROR/WARN 0, 의도한 deny-all 테이블의 `rls_enabled_no_policy` INFO 28건만 남음.
- Performance Advisor: unindexed FK 0, 비어 있는 새 DB라 `unused_index` INFO만 남음.

## 남은 위험과 제한

- 현재 원격 스키마는 비어 있으며 실제 corpus와 active release는 K02에서 적재해야 한다.
- RLS 정책이 없는 상태는 의도된 deny-all이다. 이후 공개 읽기 경로는 base table grant가 아니라 서버 전용 최소 RPC 또는 직접 DB 연결로만 추가해야 한다.
- 임베딩 HNSW는 작은 초기 corpus에 불필요하므로 추가하지 않았다. 데이터와 지연 측정 전에는 생성하지 않는다.
- CLI 부재 때문에 로컬 Supabase 컨테이너 재현 대신 원격 트랜잭션 계약 테스트로 검증했다.

## 다음 작업과 다음 세션의 첫 행동

- K02에서 공식·공공 출처를 조사하고 현재 핵심 경로, 욕실 6단계와 싱크대 거름망 절차를 자체 문안으로 작성한다.
- source/step/tip/risk 연결, review event, published 상태와 release manifest를 만든 뒤 `kb.validate_release`를 통과시킨다.
- 같은 release를 `data/cleaning_knowledge_snapshot.json`으로 내보내 DB 장애 fallback의 단일 기준으로 사용한다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- `supabase/migrations/20260825000100_create_cleaning_knowledge_base.sql`
- `supabase/migrations/20260825000200_add_cleaning_kb_fk_indexes.sql`
- `supabase/migrations/20260825000300_harden_cleaning_kb_release_immutability.sql`
- `supabase/tests/001_cleaning_kb_contract.sql`
- 발행 전에는 procedure step마다 source link가 있어야 하고, review event를 먼저 만든 뒤 status를 `published`로 바꿔야 한다.
- 활성 릴리스의 구성은 수정할 수 없으므로 K02 적재 검증을 끝낸 뒤 마지막에 `kb.activate_release`를 호출한다.
