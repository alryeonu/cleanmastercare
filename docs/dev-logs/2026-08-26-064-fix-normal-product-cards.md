# NORMAL 제품 추천 카드 표시 수정

## 무엇을 만들었는지

- NORMAL 청소 방법 아래에 `AI 제품 추천` 카드가 실제로 표시되도록 수정했다.
- 첫 설정에서는 장소만 선택하고, 계획 생성 뒤 오늘의 돌봄 카드에서 모드를 고르게 바꿨다.
- 침대·침구 경로에는 돌돌이와 패브릭용 극세사 천 카드를 추가했다.

## 문제·막힌 지점

- NORMAL을 선택해도 청소 절차 아래에 제품 추천 카드가 나타나지 않았다.

## 직접 원인과 근본 원인

- `static/product-links.js`가 `const PRODUCT_CATALOG`으로 선언돼 있었고, 앱은 `globalThis.PRODUCT_CATALOG`에서 데이터를 찾았다. 전역 렉시컬 선언은 `globalThis` 속성이 아니므로 카탈로그가 빈 값으로 처리됐다.

## 해결

- 카탈로그를 `globalThis.PRODUCT_CATALOG`에 명시적으로 등록했다.
- 정상 계획 화면에서는 한 곳의 모드 선택만 유지하고, NORMAL일 때만 사진 확인 안내와 실제 제품 카드 두 개를 청소 방법 바로 아래에 표시한다.
- 카드에는 제품 사진, 제품명, 사용 목적, 주의, 제품명 기반 쿠팡 검색 버튼을 포함한다.

## 테스트

- `node --check static/product-links.js` — 성공.
- `node --check static/app.js` — 성공.
- `py -B -m pytest -q -p no:cacheprovider` — 48 passed.
- `git diff --check` — 성공.

## 다음 작업 시 참고

- 제품 카탈로그 파일은 `globalThis.PRODUCT_CATALOG` 계약을 유지해야 한다. 이후 제휴 링크를 바꿀 때도 이 파일의 데이터만 수정한다.
