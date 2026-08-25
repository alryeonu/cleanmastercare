# Grounded 안내 검증과 canonical 대체

## 무엇을 만들었는지

- Responses API용 strict JSON Schema와 최소 grounding 지시문을 구현했다.
- procedure/release, 단계 ID·번호·stage·순서, 본문, 팁·위험·출처 ID를 canonical context와 완전 일치 비교하는 validator를 구현했다.
- DB의 검수 문구를 그대로 사용자용 상세 단계, 단계 팁, 중단 규칙, 출처 목록으로 변환하는 canonical response builder를 구현했다.
- 모델 미사용·호출 오류·JSON 오류·검증 실패 시 일부 모델 문장을 섞지 않고 전체 canonical 응답으로 대체하도록 했다.
- 모델 입력에서 사용자의 관찰 원문을 제외하고 retrieval 객체만 직렬화하도록 했다.

## 문제·막힌 지점

- 설계 문서의 grounded 설명 목표와 제품 불변 조건인 “AI는 검수된 청소 절차를 재작성하지 않는다”를 동시에 만족해야 했다.
- 일반적인 allow-list ID 검사만으로는 같은 ID를 유지하면서 검수 문구에 새로운 제품·시간·방법을 덧붙이는 출력을 막지 못한다.

## 직접 원인과 근본 원인

- ID grounding은 출처 추적에는 필요하지만 자연어 내용 자체가 검수됐음을 보장하지 않는다.
- 청소 실행 문구가 모델 자유 생성 영역에 남으면 모델 성공 여부에 따라 절차가 달라져 DB가 단일 기준이 되지 않는다.

## 해결

- LLM의 역할을 canonical JSON 운반으로 제한하고, 사용자에게 표시되는 절차 문구는 항상 발행 DB 문구와 동일하게 했다.
- 후보 객체 전체를 canonical 객체와 비교해 문구 한 글자, 배열 순서, 필수 위험 규칙 하나라도 다르면 후보 전체를 폐기한다.
- canonical 응답은 모델과 무관하게 단계·팁·중단 규칙·출처를 완전히 포함하므로 키가 없거나 호출이 실패해도 기능이 줄어들지 않는다.

## 실행한 테스트와 실제 결과

- `py -m pytest -q tests/test_grounded_guide.py tests/test_cleaning_knowledge.py tests/test_knowledge_release.py`: 19 passed.
- 모델 함수 없음: 6단계·위험 규칙·출처를 포함한 `canonical` 응답 확인.
- canonical과 완전히 같은 strict JSON 후보만 `llm_grounded`로 채택됨을 확인.
- 단계 문구 변경, context 밖 source ID, 필수 risk 누락을 각각 강제해 전체 canonical 대체를 확인.
- 모델 예외 시 안내가 중단되지 않고 canonical 단계가 반환됨을 확인.
- 채택 후 원본 후보 객체를 변경해도 사용자 응답이 변하지 않음을 확인.

## 남은 위험과 제한

- 실제 Responses API 호출과 환경변수 feature flag 연결은 K05 서버 통합에서 수행한다.
- 모델은 검수 문구를 바꾸지 못하므로 현재 릴리스에서 설명의 상세도를 높이려면 LLM 프롬프트가 아니라 seed 검수·재발행이 필요하다.
- JSON Schema 자체 외에도 서버의 완전 일치 validator를 반드시 유지해야 한다.

## 다음 작업과 다음 세션의 첫 행동

- K05에서 `/api/cleaning-guide`에 repository, optional Responses 호출과 canonical fallback을 연결한다.
- 프런트의 `buildCarePlan()` 기본 경로를 API 응답으로 교체하고 단계 팁·완료 기준·중단 규칙·출처를 표시한다.
- 서버 전용 Supabase 읽기 경로가 실패하면 로컬 release snapshot을 사용하고 mode로 구분한다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- `grounded_guide.py`
- `tests/test_grounded_guide.py`
- `cleaning_knowledge.py`
- strict JSON 통과만 믿지 말고 항상 canonical 완전 일치 검증을 수행한다.
- 검증 실패한 모델 응답의 일부 문장이나 ID를 사용자 응답에 섞지 않는다.
