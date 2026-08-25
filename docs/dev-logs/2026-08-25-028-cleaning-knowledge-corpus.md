# 검수형 청소 지식 corpus와 릴리스

## 무엇을 만들었는지

- 공식·공공기관 9개 출처를 근거로 한국어 청소 절차 14개, 단계 77개, 단계 팁 12개, 위험·중단 규칙 6개를 자체 문안으로 구축했다.
- 기존 앱의 장소·청소 유형·집중 항목 enum을 Supabase taxonomy로 연결하고, 욕실 오염 4종과 현재 주요 공간 경로를 포함한 exact route를 만들었다.
- 모든 단계·팁·위험 규칙을 출처 version에 연결하고 승인 review event를 포함한 발행 릴리스 `ko-kr-2026-08-001`을 만들었다.
- 하나의 seed에서 stable UUID, SHA-256 manifest, Supabase migration과 로컬 장애 대체 snapshot을 함께 생성하는 빌드 스크립트를 추가했다.
- 특정 제품·성분·사용량·희석비·접촉시간과 평가 문구를 발행 전에 거부하는 corpus lint와 재현성 테스트를 추가했다.

## 문제·막힌 지점

- 최초 조사 문안 일부가 기존 제품 안전지침을 직접 안내하는 범위까지 넓어져 현재 저장소의 제품·성분 비의존 청소 계약과 충돌했다.
- 원격 Supabase에 seed를 넣기 전에 이 충돌을 발견했고, 해당 migration 적용은 승인 검토에서 중단됐다.
- 로컬 Supabase CLI가 없어 생성 migration을 로컬 컨테이너에 적용하는 검증은 할 수 없었다.

## 직접 원인과 근본 원인

- 공신력 있는 출처의 안전 정보를 충분히 담는 목표와, 이 제품이 특정 제품·화학 성분을 안내하지 않는다는 상위 제품 계약을 corpus 작성 단계에서 분리하지 못했다.
- 외부 권고를 그대로 기능 범위로 옮기면 출처가 공식적이어도 제품이 허용하지 않는 조작 지침이 될 수 있다.

## 해결

- 제품·성분·비율·시간 지시를 모두 제거하고, 환기·보호구·부드러운 도구·물로 닦기·헹굼·건조·범위가 크면 전문가 도움 요청처럼 제품 비의존 행동만 남겼다.
- 생성기에 금지 문구, 임의 시간, 임의 비율 검사를 추가해 이후 seed 변경도 같은 계약을 통과해야만 migration과 snapshot을 만들 수 있게 했다.
- 데이터베이스와 로컬 snapshot을 별도로 작성하지 않고 한 seed에서 생성해 장애 대체 경로의 내용과 발행 릴리스가 어긋나지 않게 했다.
- Supabase migration 도구로 원격 적용한 뒤 릴리스 검증, 건수, 출처 연결, 욕실 6단계, 금지 문구와 대표 route를 SQL로 재검증했다.

## 실행한 테스트와 실제 결과

- `py scripts/build_knowledge_release.py`: 성공. manifest `0407c72e256437bea28b3f8367fb4e55396f3bc27faffdd4c705470f7495e811`, 절차 14, 단계 77, 팁 12, 위험 규칙 6, 출처 9.
- `py -m pytest -q tests/test_knowledge_release.py`: 3 passed.
- 원격 migration `seed_cleaning_knowledge_release`: 성공.
- `kb.validate_release('ko-kr-2026-08-001')`: true.
- 원격 검증: source 없는 단계 0, 6단계가 아닌 욕실 절차 0, 금지 문구 단계 0.
- 대표 route 6건: 욕실 곰팡이·비누막, 침실 세탁, 현관 정리, 싱크대 일반·물때가 모두 의도한 절차 version으로 연결됨.

## 남은 위험과 제한

- 초기 corpus는 현재 앱의 핵심 경로를 우선한 최소 검수 릴리스다. 발코니·다용도실과 세부 대상은 K06에서 별도 작업 단위로 확장해야 한다.
- tip embedding은 profile만 발행했고 실제 vector는 아직 만들지 않았다. 적은 corpus에서는 exact route와 구조화 필터를 우선하고, 검색 품질·지연 측정 뒤 embedding을 도입한다.
- 데이터베이스와 snapshot의 일치 여부는 생성 테스트로 검증하지만, 앱 런타임 라우팅과 응답 계약 연결은 K03~K05에서 추가 검증해야 한다.

## 다음 작업과 다음 세션의 첫 행동

- K03에서 앱 입력을 taxonomy로 정규화하고 snapshot/원격 저장소가 같은 exact route 결과를 내는 repository를 만든다.
- 절차는 exact route로만 고르고, 팁 검색은 선택된 절차의 보조 정보에 한정한다.
- 단계·고정 팁·위험 규칙·출처와 release/context ID를 포함한 canonical context builder를 구현한다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- `data/cleaning_knowledge_seed.json`
- `data/cleaning_knowledge_snapshot.json`
- `scripts/build_knowledge_release.py`
- `supabase/migrations/20260825000400_seed_cleaning_knowledge_release.sql`
- `tests/test_knowledge_release.py`
- snapshot과 migration은 직접 고치지 않고 seed 변경 후 생성기를 실행해야 한다.
- exact route가 절차를 결정해야 하며 embedding이나 LLM이 절차·단계 순서를 바꾸게 해서는 안 된다.
