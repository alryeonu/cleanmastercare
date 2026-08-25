# 참고 정적 자산 반영

## 무엇을 만들었는지

- `clean-master-export-20260825` 참고본에서 빗자루와 파란 새 일러스트만 선택해 현재 앱의 홈과 돌봄 농장에 반영했다.
- 빗자루는 홈 마스코트 뒤의 장식으로, 파란 새는 농장 하늘의 장식으로 표시했다.
- `prefers-reduced-motion` 환경에서는 새의 부유 애니메이션을 중단하도록 했다.

## 문제·막힌 지점

- 참고본에는 계정/SQLite 저장, 제품 유형·혼합·재질 판정과 같은 기능도 포함되어 있었다.

## 직접 원인과 근본 원인

- 참고본은 현재 PRD보다 넓은 범위의 별도 구현이며, 그대로 병합하면 현재 제품의 localStorage 우선 구조와 제품·성분·혼합 판정 제외 규칙을 위반한다.

## 해결

- 제품 규칙과 충돌하지 않는 시각 자산만 채택했다.
- Supabase 마이그레이션, 원격 테이블, 지식 데이터와 서버 API 계약은 변경하지 않았다.

## 실행한 테스트와 실제 결과

- `py -B -m pytest -q -p no:cacheprovider`: 28 passed.
- `node --check static/app.js`, `node --check static/room3d.js`, `node --check static/room-canvas3d.js`: 성공.
- `py -B -c "compile(...)"`: `server.py syntax OK`.
- `py -B -m compileall server.py`는 실행 중 서버가 점유한 `__pycache__` 권한 문제로 중단됐으며, 파일을 쓰지 않는 구문 컴파일로 대체 확인했다.
- 실제 브라우저에서 홈 빗자루(1086px 원본)와 농장 새(1382px 원본) 로드를 확인했고, 확인 화면 폭에서 가로 넘침이 없었다.

## 다음 작업과 다음 세션의 첫 행동

- K06 coverage matrix를 기준으로 DB 변경을 명시적으로 승인받은 뒤에만 한국형 공간별 지식 범위를 확장한다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- `static/index.html`
- `static/styles.css`
- `static/clean-master-broom.png`
- `static/farm-blue-bird.png`
- 참고본의 계정·SQLite·제품 비교 안전검사 코드를 현재 프로젝트에 다시 도입하지 않는다.
