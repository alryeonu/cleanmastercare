# 한국형 청소 지식베이스와 Grounded LLM 설계

## 무엇을 만들었는지

- 실제 웹앱 경로를 기준으로 한국형 청소 지식베이스의 관계형 ERD, pgvector 보조 검색, 검수·발행, RLS, 장애 대체 구조를 `docs/CLEANING_KNOWLEDGE_ERD_AND_PLAN.md`에 정리했다.
- 현재 앱의 `area_hint`, `visible_categories`, `cleaning_focus`를 정규화된 공간·대상·부위·과업 taxonomy로 매핑하는 호환 계약을 설계했다.
- canonical procedure는 exact route로 고르고, pgvector는 같은 taxonomy 안의 검수 완료 단계 팁에만 사용하는 원칙을 확정했다.
- 검색 결과를 OpenAI Responses API의 grounding context로 전달하고, LLM의 strict JSON 출력에서 단계·순서·팁·위험·출처 ID를 서버가 검증하는 계약을 추가했다.
- `/api/cleaning-guide`의 입력·출력, `llm_grounded`·`canonical`·`local_fallback` 모드와 Supabase/OpenAI 장애 대체 경로를 정의했다.
- `PRD.md`에 FR-021~024와 AC-018~020을 추가하고, `AGENTS.md`와 개발 우선순위에 다음 세션의 구현 규칙과 K01~K06 순서를 반영했다.
- 욕실, 한국형 주방, 거실·침실·현관·발코니·다용도실의 초기 coverage 목록과 공공기관·공식 제조사 중심 출처 정책을 정리했다.

## 문제·막힌 지점

- 세션 시작 작업 경로와 사용자가 뒤에 알려준 실제 앱 경로가 달랐고, 두 앱의 PRD와 코드 구조도 서로 달랐다.
- 실제 앱의 `area_hint`에는 `bathroom` 같은 공간과 `sink`, `sofa`, `bed` 같은 대상이 섞여 있어 그대로 DB taxonomy로 쓰기 어려웠다.
- 현재 청소 안내는 프런트엔드 `buildCarePlan()`에 하드코딩되어 있고 사진 분석용 Responses API와 연결되지 않아, 검색 지식을 LLM에 안전하게 전달할 서버 경계가 없었다.
- `PRD.md`의 모델 표기와 `server.py`의 실제 모델 설정이 달라 다음 구현 전에 확인이 필요하다.
- 이번 세션은 사용자의 요청에 따라 Supabase 원격 프로젝트 연결과 DDL 실행을 범위에서 제외했다.

## 해결

- 사용자가 지정한 실제 앱 경로의 PRD, AGENTS, 개발 우선순위, INDEX와 최신 025 개발일지를 다시 읽고 그 코드 계약으로 설계를 재작성했다.
- `app_route_aliases`를 두어 기존 앱 enum을 유지하면서 정규 공간·대상 taxonomy로 변환하도록 했다.
- canonical procedure와 보조 tip 검색을 분리해 벡터 유사도가 정답 단계나 안전 규칙을 선택하지 못하게 했다.
- LLM이 검색 지식을 읽어 사용자에게 맞는 세부 설명을 만들 수 있게 하되, context 밖 ID·사실, 단계 변경과 위험 문구 누락을 서버가 거부하도록 했다.
- 검증 실패 시 모델 출력 일부를 노출하지 않고 canonical DB 문구, last-known-good JSON, 현재 로컬 계획 순서로 대체하도록 했다.
- 발행 버전 불변성, source coverage 100%, content/embedding hash 일치, 브라우저 service-role 비노출과 사진·사용자 원문 비저장 규칙을 명문화했다.

## 검증 결과

- 변경 문서 4개의 존재, 줄 수와 핵심 계약 키워드를 PowerShell과 `rg`로 확인했다.
- `PRD.md`에 `/api/cleaning-guide`, FR-021~024, AC-018~020이 연결된 것을 확인했다.
- `AGENTS.md`, 설계 문서와 개발 우선순위에 K01, strict JSON, grounded LLM, canonical fallback이 모두 존재하는 것을 확인했다.
- 설계 문서의 Markdown fence 수가 14개로 짝수이며 코드블록이 닫힌 것을 확인했다.
- 코드와 원격 Supabase 상태는 변경하지 않았으므로 Python/JavaScript 실행 테스트와 DB migration 테스트는 이번 작업의 검증 대상이 아니다.

## 남은 위험과 제한

- 실제 Supabase 프로젝트의 schema, extension 버전, migration history, exposed schema와 RLS 상태는 아직 확인하지 않았다.
- embedding 모델과 1024차원 후보는 한국어 골든 질의 평가 전까지 최종 확정이 아니다.
- 초기 corpus 문구는 공식 출처와 사람이 단계별로 대조·검수해야 하며, 현재 `buildCarePlan()`의 블로그 기반 근거를 그대로 옮기면 안 된다.
- LLM 출력 validator와 canonical snapshot이 구현되기 전에는 하드코딩 계획을 제거하면 안 된다.
- PRD와 코드의 OpenAI 모델명 불일치를 K04 전에 해결해야 한다.

## 다음 작업 시 참고

- 다음 세션은 K01 하나만 수행한다. 먼저 Supabase 플러그인 연결과 개발 프로젝트를 읽기 전용으로 확인한다.
- 실제 schema, migration history, extension, exposed schema와 RLS를 조회한 뒤에만 migration을 작성한다.
- K01 migration에는 taxonomy, versioned procedure/step/tip/risk/source, release/review, embedding profile과 RLS를 포함한다.
- migration 적용 후 FK/check/unique, 단계 연속성, 발행 전 데이터 차단, 익명 base table 접근 거부와 재적용 가능성을 검증한다.
- K01이 완료되기 전에 corpus 적재, LLM 호출 변경 또는 프런트 연결로 넘어가지 않는다.
