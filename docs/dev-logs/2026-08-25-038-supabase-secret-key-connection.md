# Supabase 새 Secret Key 연결

## 무엇을 만들었는지

- Vercel에 등록한 `SUPABASE_SECRET_KEY`를 FastAPI 서버가 우선 인식하도록 연결했다.
- 기존 `SUPABASE_SERVICE_ROLE_KEY` 환경변수도 대체 경로로 계속 지원했다.
- `/health`의 `supabase_configured`가 새 Secret Key 설정을 반영하도록 수정했다.
- 배포 설정 예시를 새 Secret Key 기준으로 갱신했다.

## 문제·막힌 지점

- Vercel에는 새 `SUPABASE_SECRET_KEY`가 등록되어 있었지만 서버는 기존 `SUPABASE_SERVICE_ROLE_KEY`만 읽고 있었다.
- 새 `sb_secret_...` 키는 JWT가 아니므로 기존 service-role 키처럼 `Authorization: Bearer` 헤더에 넣으면 인증 오류가 발생할 수 있었다.

## 직접 원인과 근본 원인

- 직접 원인은 애플리케이션과 배포 환경의 환경변수 이름 불일치였다.
- 근본 원인은 Supabase의 새 API 키 체계와 기존 JWT 키 체계의 인증 헤더 차이를 서버가 구분하지 않은 것이었다.

## 어떻게 해결했는지

- 서버 전용 키 선택 함수를 추가해 새 Secret Key를 우선 사용하고 기존 service-role 키를 호환 경로로 남겼다.
- 새 Secret Key는 `apikey` 헤더에만 전달하고, 기존 service-role 키에만 `Authorization: Bearer` 헤더를 추가하도록 분리했다.
- 키 값은 응답, UI, 로그, 개발일지에 노출하지 않았다.
- Supabase 스키마, 테이블, RLS, 지식 데이터는 변경하지 않았다.

## 실행한 테스트와 실제 결과

- `py -B -m pytest -q -p no:cacheprovider`: 31 passed.
- 새 Secret Key 우선 선택, `apikey` 전용 헤더, 기존 service-role 호환, `/health` 설정 인식을 자동 테스트로 검증했다.
- `node --check static/app.js`: 성공.
- `node --check static/room3d.js`: 성공.
- `node --check static/room-canvas3d.js`: 성공.

## 남은 위험과 제한

- Vercel 환경변수 변경은 새 배포부터 반영되므로 프로덕션 재배포가 필요하다.
- Supabase 프로젝트 정지, 네트워크 장애 또는 RPC 장애 시에는 검수된 로컬 6단계 스냅샷으로 계속 진행한다.

## 다음 작업과 다음 세션의 첫 행동

- 프로덕션 재배포 후 `/health`에서 Supabase 설정 상태를 확인한다.
- 실제 `/api/cleaning-guide` 요청이 `supabase_release`를 반환하는지 확인한다.

## 다음 세션이 확인할 파일과 회귀 주의사항

- 확인 파일: `server.py`, `.env.example`, `render.yaml`, `test_rules.py`.
- 새 Secret Key를 브라우저 JavaScript나 정적 HTML에 전달하지 않는다.
- 새 Secret Key에 `Authorization: Bearer` 헤더를 다시 추가하지 않는다.
