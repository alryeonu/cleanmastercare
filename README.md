# 오늘의 자리

사진에서 관찰 가능한 후보를 사용자가 직접 확인한 뒤, 검수·발행된 청소 지식 릴리스 기반의 상세 미션을 제공하는 웹 서비스입니다.

## 실행

1. `.env.example`을 `.env`로 복사합니다.
2. 사진 분석을 쓰려면 `.env`의 `OPENAI_API_KEY`를 설정합니다. 키는 브라우저 코드에 넣지 않습니다.
3. Supabase active release를 서버에서 검증하려면 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 설정합니다. service-role 키는 서버 환경변수에서만 읽으며 브라우저에 전달하지 않습니다.
4. `pip install -r requirements.txt` 후 `python server.py`를 실행합니다.
5. 브라우저에서 `http://localhost:8000`을 엽니다.

OpenAI·Supabase 연결이 없어도 사용자는 직접 선택을 마친 뒤, 같은 검수 릴리스에서 생성한 로컬 snapshot 안내로 계속할 수 있습니다.

## 핵심 설계

- 사진 분석: OpenAI Responses API, 기본 `gpt-5.6-luna`
- 오염 확인: 곰팡이 추정 흔적·물때·비누 찌꺼기·확인 필요 중 사용자가 최종 확정
- 청소 안내: `kb` schema의 active release에서 exact route로 절차를 선택하고, 단계별 팁·완료 기준·중단 규칙·출처를 함께 표시합니다. 벡터 검색은 절차 선택이 아닌 보조 팁에만 제한합니다.
- 안전성: 제품·성분·사용량·희석비·접촉시간·재질 적합성은 생성하거나 표시하지 않습니다. 모델 출력은 절차 ID·순서·검수 문구가 canonical context와 완전히 일치할 때만 채택합니다.
- 운영: migration과 corpus는 `supabase/migrations/`, seed는 `data/cleaning_knowledge_seed.json`, 장애 대체 snapshot은 `data/cleaning_knowledge_snapshot.json`에 있습니다.
- 전후 사진: 청소 전·후 사진을 나란히 미리보고, 사진에서 확인되는 `주변 정리 → 흔적 닦기 → 마무리 정리` 3개 미션을 체크리스트로 표시합니다. 각 확인 단계는 3포인트이며 같은 사진 조합은 SHA-256 해시로 중복 적립을 막습니다. 사진 원본은 저장하지 않습니다.
- 기록·행동별 포인트: 브라우저 `localStorage`
- 서버: FastAPI + Uvicorn, 포트 `8000`

사진만으로 판단하기 어려우면 사용자가 후보를 직접 선택할 수 있습니다. 넓게 번지거나 반복되는 곰팡이, 누수·역류, 전기 이상처럼 중단 규칙에 해당하면 무리하지 않고 전문 도움을 권합니다.
