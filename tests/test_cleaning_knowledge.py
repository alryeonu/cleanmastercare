from __future__ import annotations

import pytest

from cleaning_knowledge import SnapshotKnowledgeRepository


@pytest.fixture(scope="module")
def repository() -> SnapshotKnowledgeRepository:
    return SnapshotKnowledgeRepository()


@pytest.mark.parametrize(
    ("payload", "expected_key"),
    [
        ({"area_hint": "bathroom", "visible_categories": ["clean"], "cleaning_focus": "mold"}, "bathroom-mold-v1"),
        ({"area_hint": "bathroom", "visible_categories": ["clean"], "cleaning_focus": "soap_scum"}, "bathroom-soap-scum-v1"),
        ({"area_hint": "sink", "visible_categories": ["clean"], "cleaning_focus": "water_scale"}, "sink-water-scale-v1"),
        ({"area_hint": "sink", "visible_categories": ["clean"], "cleaning_focus": "unknown"}, "sink-strainer-clean-v1"),
        ({"area_hint": "bed", "visible_categories": ["clean", "laundry"], "cleaning_focus": "laundry"}, "generic-laundry-v1"),
        ({"area_hint": "shoe_rack", "visible_categories": ["organize", "clean"], "cleaning_focus": "clutter"}, "generic-organize-v1"),
    ],
)
def test_golden_routes(repository: SnapshotKnowledgeRepository, payload: dict[str, object], expected_key: str) -> None:
    context = repository.build_context({"locale": "ko-KR", "user_confirmed": True, "observations": [], **payload})
    assert context["retrieval"]["procedure_version"]["key"] == expected_key


def test_part_specific_route_wins(repository: SnapshotKnowledgeRepository) -> None:
    context = repository.build_context(
        {
            "locale": "ko-KR",
            "area_hint": "sink",
            "visible_categories": ["clean"],
            "cleaning_focus": "unknown",
            "target_code": "kitchen_sink",
            "part_code": "drain_strainer",
            "user_confirmed": True,
        }
    )
    assert context["retrieval"]["matched_route"]["part_code"] == "drain_strainer"


def test_context_is_reproducible_and_fully_sourced(repository: SnapshotKnowledgeRepository) -> None:
    payload = {
        "locale": "ko-KR",
        "area_hint": "bathroom",
        "visible_categories": ["clean"],
        "cleaning_focus": "mold",
        "user_confirmed": True,
        "observations": ["실리콘 주변에 검은 점 모양 흔적"],
    }
    first = repository.build_context(payload)
    second = repository.build_context(payload)
    retrieval = first["retrieval"]
    available_sources = {source["id"] for source in retrieval["sources"]}
    available_tips = {tip["id"] for tip in retrieval["step_tips"]}

    assert first == second
    assert len(retrieval["steps"]) == retrieval["procedure_version"]["required_step_count"]
    assert all(set(step["source_ids"]) <= available_sources for step in retrieval["steps"])
    assert all(set(step["tip_version_ids"]) <= available_tips for step in retrieval["steps"])
    assert all(set(risk["source_ids"]) <= available_sources for risk in retrieval["risk_rules"])


def test_cross_space_target_and_unconfirmed_input_are_rejected(repository: SnapshotKnowledgeRepository) -> None:
    base = {
        "locale": "ko-KR",
        "area_hint": "bathroom",
        "visible_categories": ["clean"],
        "cleaning_focus": "unknown",
        "user_confirmed": True,
    }
    with pytest.raises(ValueError, match="장소와 청소 대상"):
        repository.build_context({**base, "target_code": "kitchen_sink"})
    with pytest.raises(ValueError, match="확인이 필요"):
        repository.build_context({**base, "user_confirmed": False})


def test_tip_search_never_crosses_space(repository: SnapshotKnowledgeRepository) -> None:
    context = repository.build_context(
        {
            "locale": "ko-KR",
            "area_hint": "bathroom",
            "visible_categories": ["clean"],
            "cleaning_focus": "water_scale",
            "user_confirmed": True,
            "observations": ["싱크대 수전 물때처럼 하얀 자국"],
        }
    )
    assert all(tip["space_code"] == "bathroom" for tip in context["retrieval"]["step_tips"])
    assert all(len(step["tip_version_ids"]) <= 2 for step in context["retrieval"]["steps"])
