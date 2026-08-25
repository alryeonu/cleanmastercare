from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable


NULLABLE_STRING = {"anyOf": [{"type": "string"}, {"type": "null"}]}
GROUND_GUIDE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "procedure_version_id",
        "release_key",
        "title",
        "summary",
        "steps",
        "stop_rules",
        "needs_user_confirmation",
    ],
    "properties": {
        "procedure_version_id": {"type": "string"},
        "release_key": {"type": "string"},
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "step_id",
                    "step_no",
                    "stage_code",
                    "instruction",
                    "detail",
                    "completion_cue",
                    "caution",
                    "tip_version_ids",
                    "risk_rule_version_ids",
                    "source_ids",
                ],
                "properties": {
                    "step_id": {"type": "string"},
                    "step_no": {"type": "integer", "minimum": 1},
                    "stage_code": {"type": "string"},
                    "instruction": {"type": "string"},
                    "detail": {"type": "string"},
                    "completion_cue": {"type": "string"},
                    "caution": NULLABLE_STRING,
                    "tip_version_ids": {"type": "array", "items": {"type": "string"}},
                    "risk_rule_version_ids": {"type": "array", "items": {"type": "string"}},
                    "source_ids": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "stop_rules": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "risk_rule_version_id",
                    "trigger_code",
                    "user_action",
                    "escalation_target",
                    "required_phrases",
                    "source_ids",
                ],
                "properties": {
                    "risk_rule_version_id": {"type": "string"},
                    "trigger_code": {"type": "string"},
                    "user_action": {"type": "string"},
                    "escalation_target": NULLABLE_STRING,
                    "required_phrases": {"type": "array", "items": {"type": "string"}},
                    "source_ids": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "needs_user_confirmation": {"type": "boolean"},
    },
}

GROUNDING_INSTRUCTIONS = """당신은 검수된 청소 지식 JSON을 전달하는 변환기입니다.
retrieval에 있는 절차와 문구를 한 글자도 바꾸거나 보충하지 마세요.
절차 ID, 단계 ID, 순서, stage, 팁·위험·출처 ID를 그대로 복사하세요.
제품, 세제, 성분, 사용량, 희석비, 접촉 시간, 재질 적합성이나 다른 방법을 추가하지 마세요.
검색된 사실을 설명하거나 재작성하지 말고 요청된 JSON 구조로만 반환하세요.
"""


def canonical_llm_output(context: dict[str, Any]) -> dict[str, Any]:
    retrieval = context["retrieval"]
    procedure = retrieval["procedure_version"]
    steps = [
        {
            "step_id": step["id"],
            "step_no": step["step_no"],
            "stage_code": step["stage_code"],
            "instruction": step["instruction"],
            "detail": step["detail"],
            "completion_cue": step["completion_cue"],
            "caution": step.get("caution"),
            "tip_version_ids": list(step.get("tip_version_ids", [])),
            "risk_rule_version_ids": [],
            "source_ids": list(step["source_ids"]),
        }
        for step in retrieval["steps"]
    ]
    stop_rules = [
        {
            "risk_rule_version_id": risk["id"],
            "trigger_code": risk["trigger_code"],
            "user_action": risk["user_action"],
            "escalation_target": risk.get("escalation_target"),
            "required_phrases": list(risk["required_phrases"]),
            "source_ids": list(risk["source_ids"]),
        }
        for risk in retrieval["risk_rules"]
    ]
    return {
        "procedure_version_id": procedure["id"],
        "release_key": retrieval["release_key"],
        "title": procedure["title"],
        "summary": procedure["summary"],
        "steps": steps,
        "stop_rules": stop_rules,
        "needs_user_confirmation": False,
    }


def validate_grounded_output(context: dict[str, Any], candidate: Any) -> bool:
    """LLM은 canonical 값을 그대로 운반할 때만 채택한다."""
    return isinstance(candidate, dict) and candidate == canonical_llm_output(context)


def response_from_output(context: dict[str, Any], output: dict[str, Any], mode: str) -> dict[str, Any]:
    retrieval = context["retrieval"]
    tips_by_id = {tip["id"]: tip for tip in retrieval["step_tips"]}
    steps = []
    for step in output["steps"]:
        tips = [
            {
                "tip_version_id": tip_id,
                "text": tips_by_id[tip_id]["tip_text"],
                "source_ids": list(tips_by_id[tip_id]["source_ids"]),
            }
            for tip_id in step["tip_version_ids"]
        ]
        steps.append({**deepcopy(step), "tips": tips})
    return {
        "mode": mode,
        "context_id": context["context_id"],
        "release_key": output["release_key"],
        "manifest_hash": retrieval["manifest_hash"],
        "procedure_version_id": output["procedure_version_id"],
        "procedure_key": retrieval["procedure_version"]["key"],
        "title": output["title"],
        "summary": output["summary"],
        "steps": steps,
        "stop_rules": deepcopy(output["stop_rules"]),
        "sources": deepcopy(retrieval["sources"]),
        "needs_user_confirmation": output["needs_user_confirmation"],
    }


def build_guide_response(
    context: dict[str, Any],
    generate: Callable[[dict[str, Any], dict[str, Any]], Any] | None = None,
    canonical_mode: str = "canonical",
) -> dict[str, Any]:
    canonical = canonical_llm_output(context)
    if generate is None:
        return response_from_output(context, canonical, canonical_mode)
    try:
        candidate = generate(context, GROUND_GUIDE_SCHEMA)
    except Exception:
        return response_from_output(context, canonical, canonical_mode)
    if not validate_grounded_output(context, candidate):
        return response_from_output(context, canonical, canonical_mode)
    return response_from_output(context, candidate, "llm_grounded")


def build_openai_input(context: dict[str, Any]) -> str:
    """관찰 원문은 제외하고 검수 retrieval만 모델 입력으로 보낸다."""
    import json

    return json.dumps({"retrieval": context["retrieval"]}, ensure_ascii=False, separators=(",", ":"))
