# Supabase NORMAL 맞춤 청소 안내

## 무엇을 만들었는지

- NORMAL 모드의 비포 사진 분석 응답에 공간·오염 후보뿐 아니라 관찰 가능한 오염 강도와 표면 후보를 추가했다.
- 사용자가 오염 종류·강도·표면 후보를 수정하고 확인한 뒤에만 상세 청소 안내를 불러오도록 변경했다.
- Supabase `kb` 스키마에 검수된 맞춤 안내와 제품 추천 카탈로그를 추가하고, 서버 전용 RPC로 조회하도록 연결했다.
- NORMAL 청소 안내에는 Supabase에서 반환한 맞춤 요약과 제품 사진·이름·목적·안전 주의·쿠팡 검색 링크를 표시한다. EASY는 기존대로 최대 두 행동만 표시하며 제품 추천을 숨긴다.

## 문제·막힌 지점

- 기존 NORMAL 화면은 사진에서 관찰한 후보를 청소 절차 조회에 충분히 반영하지 않았고, 정적 추천 카드가 상황별 상세 안내와 분리돼 있었다.
- 로컬 셸에서는 네트워크 제한 때문에 실제 Supabase 호출을 바로 검증할 수 없었다.

## 직접 원인과 근본 원인

- 청소 절차 지식 릴리스와 제품 카탈로그가 분리된 조회 계약으로 정의되지 않아, 강도와 표면 후보를 안전하게 전달·조회할 경로가 없었다.
- 서버 전용 Supabase 키를 사용하는 실제 네트워크 검증은 샌드박스 네트워크 권한이 필요했다.

## 해결

- `guide_enrichments`, `product_recommendations` 테이블과 `resolve_cleaning_guide_enrichment` RPC를 만들고 RLS·권한을 서비스 역할 전용으로 제한했다.
- 서버가 비밀 키를 프런트엔드나 응답에 노출하지 않고 RPC를 호출해 `guide_enrichment`, `recommendations`만 반환하게 했다.
- AI는 관찰 후보만 제시하고, 구체 청소 문구와 제품 정보는 Supabase의 검수 데이터로만 제공하게 했다. 임의 사용량·희석비율·접촉 시간은 생성하지 않는다.
- 이전 정적 카탈로그 기준을 Supabase 카탈로그 기준으로 PRD에 갱신했다. 이는 사용자의 최신 요구사항으로 이전 제외 항목과 충돌한 부분을 대체한 결정이다.

## 테스트

- `node --check static\\app.js` 통과
- `node --check static\\product-links.js` 통과
- `py -B -m pytest -q -p no:cacheprovider` 통과 (53 passed)
- `py -B -m pytest -q test_rules.py -p no:cacheprovider` 통과 (34 passed)
- `git diff --check` 통과
- 실제 Supabase RPC 조회: 싱크대·기름때·보통·금속 후보에 대해 맞춤 요약과 제품 2개 반환 확인

## 남은 위험과 제한

- 현재 카탈로그는 초기 검수 항목 8개와 추천 제품 9개다. 새 공간·오염 조합은 migration으로 검수 데이터를 늘려야 하며, 일치하는 항목이 없으면 기본 6단계 안내를 유지한다.
- 제품 링크는 쿠팡 검색 링크이며 제휴·쿠폰·결제 기능은 연결하지 않는다.

## 다음 작업

- Vercel에 배포한 뒤 NORMAL에서 사진 분석 후보 확인 → 맞춤 안내·제품 카드 표시 흐름을 실제 화면에서 확인한다.
- 다음 세션은 `server.py`의 `fetch_supabase_guide_enrichment()`와 `static/app.js`의 `confirmPhotoAnalysis`를 먼저 회귀 확인한다.
