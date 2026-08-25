# 결정론적 route와 grounding context

## 무엇을 만들었는지

- 기존 UI의 `area_hint`, 복수 할 일, `cleaning_focus`를 발행 taxonomy의 공간·대상·과업·focus로 바꾸는 입력 adapter를 구현했다.
- DB의 `kb.resolve_procedure_route`와 같은 필터·정렬 계약으로 active release snapshot에서 절차를 결정하는 exact route를 구현했다.
- 선택된 절차의 단계, 고정 팁, 위험·중단 규칙, 직접 연결 출처만 모아 최소 grounding context pack을 만드는 builder를 구현했다.
- 관찰 문구를 최대 5개·각 160자로 제한하고, 같은 공간·과업·대상·부위·focus·stage를 만족하는 보조 팁만 단계당 최대 2개까지 허용했다.
- context 전체에 결정론적 SHA-256 `context_id`를 부여해 같은 입력과 release의 결과를 재현할 수 있게 했다.

## 문제·막힌 지점

- 기존 화면은 여러 할 일을 동시에 선택할 수 있지만 canonical 절차는 한 과업 경로만 선택해야 한다.
- 단순 키워드 검색은 “싱크대 수전” 같은 관찰 문구 때문에 욕실 안내에 주방 팁을 붙일 가능성이 있었다.
- 사용자 확인 전 AI 관찰값을 검색 입력으로 쓰면 후보가 확정 사실처럼 취급될 수 있었다.

## 직접 원인과 근본 원인

- 기존 하드코딩 계획은 여러 범주를 이어 붙였고, 새 DB route는 하나의 검수 절차 version을 선택하는 계약이다.
- 텍스트 유사도만으로는 공간·대상 경계를 보장할 수 없으며 검색 점수는 안전 범위를 표현하지 못한다.

## 해결

- DB 함수와 동일하게 `laundry focus+세탁`, `clutter focus+정리`, 청소, 정리, 세탁 순서로 대표 과업을 정했다.
- 절차 선택에는 텍스트 점수를 사용하지 않고 exact route의 target·part·focus 일치, fallback, specificity, priority만 사용했다.
- 팁 검색 전에 locale·space·task·target·part·focus를 필터링하고, 선택된 절차와 같은 stage가 없는 팁은 버렸다.
- `user_confirmed=true`가 아니면 context를 만들지 않도록 요청 경계에서 차단했다.

## 실행한 테스트와 실제 결과

- `py -m pytest -q tests/test_cleaning_knowledge.py tests/test_knowledge_release.py`: 13 passed.
- 골든 route 6건 모두 적중: 욕실 곰팡이·비누막, 싱크대 물때·일반, 침실 세탁, 현관 정리.
- 싱크대 거름망 part route가 일반 fallback보다 우선함을 확인했다.
- 같은 입력의 context와 `context_id`가 완전히 동일함을 확인했다.
- 단계·팁·위험 규칙의 모든 source ID가 context source 집합에 포함됨을 확인했다.
- 욕실 요청에 주방 팁을 유도하는 관찰 문구를 넣어도 cross-space 팁 0건, 단계별 팁 2개 이하를 확인했다.
- 다른 공간 target과 사용자 미확정 요청이 거부됨을 확인했다.

## 남은 위험과 제한

- 현재 보조 팁 검색은 작은 초기 corpus에 맞춘 구조화 필터+한국어 부분 일치다. 임베딩 장애와 무관하게 동작하지만 의미 검색 품질 측정은 K06 corpus 확장 뒤 필요하다.
- 기본 런타임은 릴리스에서 생성한 로컬 snapshot이다. K05에서 서버 전용 Supabase RPC를 연결하고 실패 시 현재 snapshot으로 대체한다.
- 관찰 문구는 context 생성 중에만 사용한다. API 응답·로그·DB에 원문을 저장하지 않는지 통합 테스트가 필요하다.

## 다음 작업과 다음 세션의 첫 행동

- K04에서 canonical context를 그대로 사용자 응답으로 변환하는 경로를 먼저 만들고 strict JSON validator를 추가한다.
- LLM이 호출되더라도 procedure/release/step ID·순서와 검수 문구가 정확히 일치할 때만 채택하고, 한 항목이라도 다르면 전체 canonical 응답으로 대체한다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- `cleaning_knowledge.py`
- `tests/test_cleaning_knowledge.py`
- `data/cleaning_knowledge_snapshot.json`
- 절차 선택에 embedding·키워드 점수·LLM을 사용하지 않는다.
- 팁은 같은 공간의 보조 정보일 뿐이며 단계 순서·필수 위험 규칙을 바꾸지 못한다.
