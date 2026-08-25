from __future__ import annotations

from copy import deepcopy

from cleaning_knowledge import SnapshotKnowledgeRepository
from grounded_guide import build_guide_response, canonical_llm_output, validate_grounded_output


def bathroom_context():
    return SnapshotKnowledgeRepository().build_context(
        {
            "locale": "ko-KR",
            "area_hint": "bathroom",
            "visible_categories": ["clean"],
            "cleaning_focus": "mold",
            "user_confirmed": True,
            "observations": ["검은 점 모양 흔적"],
        }
    )


def test_no_generator_returns_complete_canonical_guide() -> None:
    context = bathroom_context()
    response = build_guide_response(context)

    assert response["mode"] == "canonical"
    assert response["procedure_version_id"] == context["retrieval"]["procedure_version"]["id"]
    assert len(response["steps"]) == 6
    assert response["stop_rules"]
    assert response["sources"]
    assert response["needs_user_confirmation"] is False


def test_exact_candidate_can_be_marked_llm_grounded() -> None:
    context = bathroom_context()
    response = build_guide_response(context, lambda supplied, schema: canonical_llm_output(supplied))

    assert response["mode"] == "llm_grounded"


def test_any_changed_instruction_discards_the_entire_candidate() -> None:
    context = bathroom_context()
    malicious = canonical_llm_output(context)
    malicious["steps"][0]["detail"] += " 검수되지 않은 다른 방법을 추가합니다."
    response = build_guide_response(context, lambda supplied, schema: malicious)

    assert response["mode"] == "canonical"
    assert response["steps"][0]["detail"] == context["retrieval"]["steps"][0]["detail"]


def test_context_outside_ids_and_missing_risk_are_rejected() -> None:
    context = bathroom_context()
    bad_id = canonical_llm_output(context)
    bad_id["steps"][0]["source_ids"] = ["outside-context"]
    missing_risk = canonical_llm_output(context)
    missing_risk["stop_rules"] = []

    assert validate_grounded_output(context, bad_id) is False
    assert validate_grounded_output(context, missing_risk) is False


def test_generator_error_never_blocks_the_canonical_guide() -> None:
    context = bathroom_context()

    def fail(supplied, schema):
        raise RuntimeError("forced model error")

    response = build_guide_response(context, fail)
    assert response["mode"] == "canonical"
    assert response["steps"]


def test_canonical_output_is_not_affected_by_candidate_mutation() -> None:
    context = bathroom_context()
    candidate = deepcopy(canonical_llm_output(context))
    response = build_guide_response(context, lambda supplied, schema: candidate)
    candidate["steps"][0]["instruction"] = "mutated"

    assert response["steps"][0]["instruction"] != "mutated"
