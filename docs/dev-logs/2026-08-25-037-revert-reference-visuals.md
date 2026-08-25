# 참고 시각 자산 되돌리기

## 무엇을 만들었는지

- 사용자 요청에 따라 빗자루·새 일러스트를 추가하기 전 상태로 되돌렸다.
- Git의 `revert` 커밋으로 자산·마크업·스타일·관련 개발일지 변경만 취소했다.

## 문제·막힌 지점

- 참고 자산이 기존 UI 언어와 맞지 않아 사용자가 원래 상태 복원을 요청했다.

## 해결

- `Animate transparent farm bird`, `Remove hero broom accent`, `Adopt reference visual assets` 커밋을 역순으로 되돌렸다.
- Supabase 마이그레이션, 테이블, 지식 릴리스 및 데이터에는 변경하지 않았다.

## 실행한 테스트와 실제 결과

- `rg`로 빗자루·새 UI 선택자가 남아 있지 않음을 확인했다.
- `node --check static/app.js`: 성공.
- `py -B -m pytest -q -p no:cacheprovider`: 28 passed.
- Vercel 프로덕션 재배포 완료.

## DB 연결 점검

- 현재 Vercel Production에는 `OPENAI_API_KEY`만 등록되어 있다.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 없어서 `/health`의 `supabase_configured`는 `false`다.
- 로컬 서버도 Supabase 환경변수가 없어 서버 전용 RPC 검증은 대체 경로를 사용한다.
- 이는 연결 설정 누락 상태이며 DB 데이터 손상이나 삭제는 발생하지 않았다.

## 다음 작업과 다음 세션의 첫 행동

- DB 기반 조회를 활성화하려면 Vercel Production 환경변수에 서버 전용 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 등록한 뒤 재배포하고 RPC 일치 검증을 다시 실행한다.
