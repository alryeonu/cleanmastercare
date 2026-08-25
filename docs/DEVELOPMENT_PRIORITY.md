# 개발 우선순위

최신 사용자 요청에 따라 한국형 청소 지식베이스와 grounded LLM 안내를 최우선으로 진행한다. 세부 계약과 완료 조건은 `docs/CLEANING_KNOWLEDGE_ERD_AND_PLAN.md`를 따른다.

1. K01 — Supabase schema, migration, 발행 validation, RLS와 권한 — 완료
2. K02 — 현재 핵심 청소 경로·욕실·싱크대 거름망 corpus, 출처 검수와 로컬 snapshot — 완료
3. K03 — 앱 입력 정규화, exact route, 제한된 tip retrieval와 LLM context builder — 완료
4. K04 — Responses API strict JSON 청소 안내, context ID·순서·위험 규칙 validator와 canonical fallback — 완료
5. K05 — `POST /api/cleaning-guide`와 프런트 연결, `buildCarePlan()` 대체 경로 전환 — 완료
6. K06 — 한국형 욕실·주방·거실·침실·현관·발코니·다용도실 coverage 확장
7. 사진 전후 비교와 3단계 체크리스트의 정확한 동작 회귀 검증
8. OpenAI 연결 오류와 수동 진행 흐름의 사용자 안내 개선
9. 욕실 오염 안내의 PRD 범위 밖 세제·성분·재질 판정 코드 정리
10. 전후 비교 결과와 기록 화면의 연결 개선
11. 접근성·모바일 화면 회귀 검증

K01~K05가 완료되어 다음 작업은 K06 한국형 세부 공간 coverage 확장이다. 새 절차는 source·review·release·snapshot을 함께 발행하고 route 계약을 먼저 검증한다.
