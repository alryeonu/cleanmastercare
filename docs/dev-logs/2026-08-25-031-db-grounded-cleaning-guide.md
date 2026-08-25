# DB 기반 상세 청소 안내 연결

## 무엇을 만들었는지

- `POST /api/cleaning-guide`를 추가해 사용자 확인 뒤에 taxonomy 정규화, exact route, 발행 절차·단계·팁·중단 규칙·출처를 한 응답으로 반환하게 했다.
- server 전용 `public.resolve_cleaning_procedure` RPC를 추가하고 `anon`·`authenticated` 실행 권한은 철회, `service_role`만 active release route와 manifest를 확인할 수 있게 했다.
- 서버가 원격 route의 release key·manifest·procedure version·단계 수를 로컬 snapshot과 대조한 뒤에만 `canonical`으로 표시하도록 했다.
- Supabase 환경변수나 RPC가 실패하면 로컬 snapshot의 같은 검수 릴리스로 `local_fallback` 안내를 반환해 미션을 막지 않게 했다.
- 프런트의 하드코딩 `buildCarePlan()`과 Google 외부 검색 경로를 제거하고, DB 응답의 상세 단계·완료 기준·단계 팁·중단 규칙·공식 출처 링크를 표시하도록 교체했다.
- 제품 라벨·제품 혼합·성분·재질 적합성의 이전 서버 계약을 제거하고 관련 테스트를 DB 안내 계약으로 바꿨다.

## 문제·막힌 지점

- Supabase `kb` schema는 의도적으로 Data API에 노출하지 않아 브라우저에서 직접 table을 읽을 수 없었다.
- 현재 배포 환경에는 Supabase service-role 환경변수가 없어서 원격 경로를 실제 HTTP로 호출해 볼 수 없었다.
- 사진을 브라우저로 올려 전체 사진 흐름을 시험하면 외부 사진 분석으로 전송될 수 있어, 테스트에서는 사진 업로드를 수행하지 않았다.

## 직접 원인과 근본 원인

- 공개 base table 권한은 검수 이력과 source link를 외부에 노출할 위험이 있어 private RLS 설계와 맞지 않는다.
- 서비스가 원격 DB만 의존하면 키 누락·네트워크 오류가 기본 청소 미션을 막아 제품 불변 조건을 위반한다.

## 해결

- DB에는 active release route만 반환하는 최소 security-definer RPC를 두고, 서버가 service-role로만 호출하게 했다. full KB table은 계속 비공개다.
- release manifest가 일치할 때만 원격 route를 신뢰하고, 실제 사용자 문구는 동일 seed에서 만든 local snapshot의 검수 문구로 구성했다.
- LLM feature flag는 기본 false이며, 켜도 strict JSON과 canonical 완전 일치 검증을 통과하지 못하면 전체 DB 안내로 대체한다.
- 외부 검색 버튼 대신 사용자가 실제로 볼 수 있는 단계별 출처를 표시했다.

## 실행한 테스트와 실제 결과

- 원격 migration `add_server_route_rpc`: 성공.
- SQL 권한 검증: `anon_execute=false`, `authenticated_execute=false`, `service_execute=true`.
- SQL RPC 욕실 곰팡이 route: release `ko-kr-2026-08-001`, manifest 일치, `bathroom-mold-v1`, 6단계.
- 실제 `POST /api/cleaning-guide`: `local_fallback`, `bathroom-mold-v1`, 단계 6, 위험 규칙 3, 출처 5 반환.
- `py -m compileall server.py cleaning_knowledge.py grounded_guide.py`: 성공.
- `py -m pytest -q`: 24 passed.
- `node --check static/app.js`, `node --check static/room3d.js`, `node --check static/room-canvas3d.js`: 성공.
- 브라우저 검증: 1440px, 768px, 360px에서 가로 스크롤 0, 주요 버튼 최소 높이 52px, 지식 DB 안내 문구와 콘솔 error/warn 0 확인.
- Security Advisor: ERROR/WARN 0, 비공개 `kb` table의 의도된 deny-all `rls_enabled_no_policy` INFO만 존재. Performance Advisor는 새 corpus라 unused index INFO만 존재.

## 남은 위험과 제한

- 실제 배포에서 `canonical` 원격 검증을 쓰려면 hosting 환경에 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 설정해야 한다. 미설정이어도 local release snapshot 안내는 정상 동작한다.
- 현재 14개 절차는 기존 앱의 주요 경로와 욕실 6단계 우선 릴리스다. 세부 욕실 설비·발코니·다용도실 coverage 확장은 K06에서 별도 검수·발행해야 한다.
- 실제 사진 업로드·외부 AI 분석을 포함한 end-to-end 브라우저 검증은 사진 전송 동의가 있는 별도 검증에서 수행한다.

## 다음 작업과 다음 세션의 첫 행동

- K06에서 coverage matrix의 빈칸을 기준으로 세부 욕실·주방·발코니·다용도실 절차를 source/review/release 단위로 확장한다.
- embedding을 도입하기 전에는 retrieval 로그의 품질·지연을 개인정보 없이 집계하고, 작은 corpus에서는 현재 구조화 tip 검색을 유지한다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- `server.py`
- `cleaning_knowledge.py`
- `grounded_guide.py`
- `static/app.js`
- `static/index.html`
- `supabase/migrations/20260825000500_add_server_route_rpc.sql`
- `render.yaml`과 `.env.example`
- browser에 service-role key를 넣지 말고, DB base table을 공개하지 않는다.
- `buildCarePlan()` 또는 외부 검색 경로를 다시 복원하지 않으며, API 오류에서도 기본 미션 진행을 막지 않는다.
