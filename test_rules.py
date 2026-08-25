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
    assert "const CARE_STEP_POINTS = 3;" in source
    assert "안내 미션 한 단계와 같은 +${CARE_STEP_POINTS}P" in source
    assert "reward(`photo-mission-${key}`, CARE_STEP_POINTS" in source
    assert "reward(`photo-mission-${pairHash}-${key}`, 3" not in source


def test_locked_farm_items_do_not_leave_ghost_images() -> None:
    source = (ROOT / "static" / "styles.css").read_text(encoding="utf-8")
    assert ".farm-item{visibility:hidden;opacity:0;" in source
    assert ".farm-item.unlocked{visibility:visible;opacity:1;" in source
    assert ".farm-item{opacity:.12;" not in source


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
