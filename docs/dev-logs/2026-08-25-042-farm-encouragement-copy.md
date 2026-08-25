# 농장 응원 문구 변경

## 무엇을 만들었는지

- 돌봄 농장의 `손가락으로 농장을 둘러보세요` 조작 안내를 제거했다.
- 같은 위치에 `오늘의 작은 돌봄도 충분해요`라는 응원 문구를 표시했다.

## 문제·막힌 지점

- 농장 하단 문구가 농장의 돌봄·응원 성격보다 조작 방법을 먼저 강조했다.

## 해결

- 농장 시각 요소와 배치는 유지하고 문구만 행동 평가 없는 응원 표현으로 바꿨다.

## 실행한 테스트와 실제 결과

- `py -B -m pytest -q -p no:cacheprovider`: 35 passed.
- `node --check static/app.js`: 성공.
- `node --check static/room3d.js`: 성공.
- `node --check static/room-canvas3d.js`: 성공.
- Vercel Production 배포 완료.

## 다음 작업과 다음 세션의 첫 행동

- 응원 문구 변경 작업은 완료되었다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- 확인 파일: `static/index.html`, `test_rules.py`.
- 농장 문구는 조작 지시보다 작은 돌봄을 응원하는 표현을 우선한다.
