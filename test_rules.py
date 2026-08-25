from __future__ import annotations

from pathlib import Path

import pytest

import server


ROOT = Path(__file__).resolve().parent


def request_payload(**overrides):
    payload = {
        "locale": "ko-KR",
        "area_hint": "bathroom",
        "visible_categories": ["clean"],
        "cleaning_focus": "mold",
        "user_confirmed": True,
        "observations": ["검은 점 모양 흔적"],
    }
    payload.update(overrides)
    return payload


def test_api_service_returns_local_release_when_remote_is_unconfigured(monkeypatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("ENABLE_GROUNDED_GUIDE_LLM", raising=False)

    result = server.create_cleaning_guide(request_payload())
    assert result["mode"] == "local_fallback"
    assert result["knowledge_source"] == "local_release_snapshot"
    assert len(result["steps"]) == 6
    assert result["stop_rules"]
    assert result["sources"]


def test_supabase_secret_key_uses_apikey_header_only(monkeypatch) -> None:
    context = server.get_knowledge_repository().build_context(request_payload())
    retrieval = context["retrieval"]
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return server.json.dumps(
                {
                    "release_key": retrieval["release_key"],
                    "manifest_hash": retrieval["manifest_hash"],
                    "procedure_version_id": retrieval["procedure_version"]["id"],
                    "required_step_count": retrieval["procedure_version"]["required_step_count"],
                }
            ).encode("utf-8")

    def urlopen(request, timeout):
        captured["headers"] = {key.lower(): value for key, value in request.header_items()}
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_test-placeholder")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legacy-placeholder")
    monkeypatch.setattr(server.urllib.request, "urlopen", urlopen)

    assert server.verify_supabase_route(context) is True
    assert captured["headers"]["apikey"] == "sb_secret_test-placeholder"
    assert "authorization" not in captured["headers"]
    assert captured["timeout"] == 5


def test_legacy_service_role_key_remains_compatible(monkeypatch) -> None:
    context = server.get_knowledge_repository().build_context(request_payload())
    retrieval = context["retrieval"]
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return server.json.dumps(
                {
                    "release_key": retrieval["release_key"],
                    "manifest_hash": retrieval["manifest_hash"],
                    "procedure_version_id": retrieval["procedure_version"]["id"],
                    "required_step_count": retrieval["procedure_version"]["required_step_count"],
                }
            ).encode("utf-8")

    def urlopen(request, timeout):
        captured["headers"] = {key.lower(): value for key, value in request.header_items()}
        return Response()

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legacy-placeholder")
    monkeypatch.setattr(server.urllib.request, "urlopen", urlopen)

    assert server.verify_supabase_route(context) is True
    assert captured["headers"]["apikey"] == "legacy-placeholder"
    assert captured["headers"]["authorization"] == "Bearer legacy-placeholder"


def test_health_recognizes_supabase_secret_key(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_test-placeholder")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    assert server.health()["supabase_configured"] is True


def test_api_service_marks_verified_supabase_release_as_canonical(monkeypatch) -> None:
    monkeypatch.setattr(server, "verify_supabase_route", lambda context: True)
    monkeypatch.delenv("ENABLE_GROUNDED_GUIDE_LLM", raising=False)

    result = server.create_cleaning_guide(request_payload(cleaning_focus="water_scale"))
    assert result["mode"] == "canonical"
    assert result["knowledge_source"] == "supabase_release"
    assert result["procedure_key"] == "bathroom-water-scale-v1"


def test_model_failure_cannot_block_the_api(monkeypatch) -> None:
    monkeypatch.setattr(server, "verify_supabase_route", lambda context: True)
    monkeypatch.setenv("ENABLE_GROUNDED_GUIDE_LLM", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "test-placeholder")

    def fail(context, schema):
        raise RuntimeError("forced failure")

    monkeypatch.setattr(server, "call_grounded_openai", fail)
    result = server.create_cleaning_guide(request_payload())
    assert result["mode"] == "canonical"
    assert result["steps"]


def test_user_confirmation_is_required() -> None:
    with pytest.raises(ValueError, match="확인이 필요"):
        server.create_cleaning_guide(request_payload(user_confirmed=False))


def test_removed_product_safety_flow_is_absent_from_server_contract() -> None:
    source = (ROOT / "server.py").read_text(encoding="utf-8")
    assert '\"cleaner_label\"' not in source
    assert "def mix_verdict" not in source
    assert "def material_verdict" not in source
    assert "def combined_verdict" not in source


def test_photo_checklist_reuses_the_care_step_reward_and_daily_key() -> None:
    source = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert "const CARE_STEP_MEMORY = 3;" in source
    assert "안내 미션 한 단계와 같은 기억의 조각 ${CARE_STEP_MEMORY}개" in source
    assert "reward(`photo-mission-${key}`, CARE_STEP_MEMORY" in source
    assert "reward(`photo-mission-${pairHash}-${key}`, 3" not in source


def test_memory_pieces_grow_a_single_garden_without_a_seed_shop() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    source = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert "기억의 조각" in markup
    assert "포인트" not in markup
    assert "포인트" not in source
    assert 'id="seedShop"' not in markup
    assert 'data-spend-tab="seed"' not in markup
    assert "function buySeed" not in source
    assert "data-buy-seed" not in source
    assert "const LEGACY_SEED_VALUES" in source
    assert "기존 씨앗을 기억의 조각으로 전환" in source
    assert "const GARDEN_STAGES" in source
    assert "completedGardenMissions" in source
    assert "기억의 조각 씨앗" in markup
    assert "새싹" in markup
    assert "작은 나무" in markup
    assert "큰 나무" in markup
    assert "과수원" in markup
    assert 'data-crop-plot' not in markup
    assert 'id="plantSeed"' not in markup
    assert 'id="waterCrop"' not in markup


def test_locked_farm_items_do_not_leave_ghost_images() -> None:
    source = (ROOT / "static" / "styles.css").read_text(encoding="utf-8")
    assert ".farm-item{visibility:hidden;opacity:0;" in source
    assert ".farm-item.unlocked{visibility:visible;opacity:1;" in source
    assert ".farm-item{opacity:.12;" not in source


def test_single_garden_starts_as_a_plain_vegetable_patch() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    source = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert 'class="care-room care-farm simple-garden"' in markup
    assert "텃밭에서 시작해요" in source
    assert 'class="unlock-list"' not in markup
    assert 'class="farmer-customizer"' not in markup


def test_weekly_tracker_replaces_step_by_step_cleaning_flow() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    source = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert 'id="planSetup"' in markup
    assert 'id="weeklyCalendar"' in markup
    assert 'id="planPhotoInput"' in source
    assert "createWeeklyPlan" in source
    assert "completePlanTask" in source
    assert 'id="nextScenario"' not in markup
    assert "음성으로 듣기" not in markup
    assert 'data-view="history"' not in markup


def test_weekly_tracker_previews_photos_and_uses_the_published_guide() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert "photoMarkup" in script
    assert 'alt="${label} 미리보기"' in script
    assert 'guide.steps.slice(0, 6)' in script
    assert 'SUPABASE CLEANING GUIDE' in script
    assert 'id="gardenSparkles"' in markup
    assert "state.gardenCelebration = true" in script
    assert 'showView("room")' in script
    assert "coupang" not in script.lower()


def test_care_history_shows_date_item_mode_encouragement_and_after_thumbnail() -> None:
    script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert 'modeLabel: "일반 모드"' in script
    assert 'modeLabel: "주간 돌봄"' in script
    assert "history-record-card" in script
    assert "encouragement" in script
    assert "afterPhotoThumbnail" in script
    assert "afterThumbnail" in script
    assert "history-after-thumbnail" in script


def test_weekly_photo_must_match_the_planned_place_before_loading_a_guide() -> None:
    script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    backend = (ROOT / "server.py").read_text(encoding="utf-8")
    assert "analyzeWeeklyPhotoAndLoadGuide" in script
    assert 'mode: "cleaning_area"' in script
    assert 'context: { area: task.area, categories: [], focus: "unknown" }' in script
    assert "analysis.area_hint !== task.area" in script
    assert 'area: task.area' in script
    assert 'state.planGuide = { area: task.area, invalidPhoto: true' in script
    assert "await loadWeeklyGuide(detected)" in script
    assert '"cleaning_area"' in backend
    assert "사진에서 실제로 관찰되는 공간을 먼저 판단" in backend


def test_photo_analysis_has_timeouts_and_a_manual_fallback() -> None:
    script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    backend = (ROOT / "server.py").read_text(encoding="utf-8")
    vercel = (ROOT / "vercel.json").read_text(encoding="utf-8")
    assert "1280 / Math.max(original.width, original.height)" in script
    assert 'canvas.toDataURL("image/jpeg", .72)' in script
    assert "AbortController" in script
    assert "timeoutMs = 35000" in script
    assert "loading(false);" in script
    assert "욕실 사진을 다시 등록해주세요" in script
    assert 'image_detail = "low" if mode in {"cleaning_area", "bathroom_check"} else "high"' in backend
    assert "PLAN_PHOTO_CHECK_TIMEOUT_MS = 12000" in script
    assert 'duration: PLAN_PHOTO_CHECK_TIMEOUT_MS' in script
    assert 'id="loadingProgress"' in (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert "setLoadingProgress" in script
    assert 'urlopen(req, timeout=10)' in backend
    assert 'status_code=503' in backend
    assert '"maxDuration": 60' in vercel


def test_garden_has_a_house_path_and_crop_plots_without_sprout_captions() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    styles = (ROOT / "static" / "styles.css").read_text(encoding="utf-8")
    assert 'class="garden-house"' in markup
    assert 'class="farm-path"' in markup
    assert 'id="gardenPlantSlots"' in markup
    assert "GARDEN_CROPS" in script
    assert "gardenPlantsForCompletedMissions" in script
    assert 'Array.from({ length: 4 }' in script
    assert 'garden-bed-slot ${plant ? "planted" : ""}' in script
    assert ".garden-bed-grid" in styles
    assert ".garden-sparkles.show" in styles


def test_farm_hint_is_an_encouragement_not_a_gesture_instruction() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert "오늘의 작은 돌봄도 충분해요" in markup
    assert "손가락으로 농장을 둘러보세요" not in markup


def test_home_title_keeps_each_message_on_its_own_desktop_line() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    styles = (ROOT / "static" / "styles.css").read_text(encoding="utf-8")
    assert '<span class="hero-title-line">깨끗함을 평가하지 않고,</span>' in markup
    assert '<span class="hero-title-line"><em>시작할 용기</em>를 돕습니다.</span>' in markup
    assert ".hero-title-line{display:block;word-break:keep-all}" in styles
    assert ".hero-title-line{white-space:nowrap}" in styles


def test_local_nickname_login_scopes_care_progress_without_storing_photos() -> None:
    script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert 'accounts: "clean_master.local_accounts.v1"' in script
    assert 'session: "clean_master.local_session.v1"' in script
    assert 'return account ? `${key}.profile.${account.id}` : key;' in script
    assert 'if ([...password].length !== 4)' in script
    assert 'id="accountNickname"' in markup
    assert 'class="nickname-heart"' in markup
    assert 'id="loginPassword" type="password" maxlength="4" minlength="4"' in markup


def test_community_thread_has_comments_without_exposing_a_card_count() -> None:
    thread = server.community_thread("welcome-tip")
    assert thread["post"]["title"] == "작은 구역부터 시작해도 충분해요"
    assert thread["comments"]
    assert "comment_count" not in thread["post"]
    assert "category" not in thread["post"]


def test_community_comment_is_anonymous_and_validated() -> None:
    comment = server.community_comment("welcome-tip", {"body": "저도 작은 구역부터 시작해볼게요."})
    assert set(comment) == {"id", "body", "created_at"}
    with pytest.raises(ValueError, match="2~300자"):
        server.community_comment("welcome-tip", {"body": "ㅋ"})


def test_community_cards_open_a_thread_without_comment_metadata() -> None:
    source = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert 'data-open-post="${escapeHtml(post.id)}"' in source
    assert "openCommunityThread(card.dataset.openPost)" in source
    assert "comment_count" not in source


def test_community_uses_a_topic_free_bulletin_board_layout() -> None:
    markup = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    styles = (ROOT / "static" / "styles.css").read_text(encoding="utf-8")
    assert 'id="communityCategory"' not in markup
    assert 'class="community-board-header"' in markup
    assert "번호</span><span>제목</span>" in markup
    assert 'class="community-post-number"' in script
    assert "communityCategory" not in script
    assert ".community-board-header,.community-post" in styles

    post = server.community_post({"title": "게시판 형태가 편해요", "body": "주제를 고르지 않고 바로 글을 남겨요.", "delete_password": "1234"})
    assert post["title"] == "게시판 형태가 편해요"
    assert "category" not in post
