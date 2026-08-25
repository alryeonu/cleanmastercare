from __future__ import annotations

import hashlib
import json
import re
import uuid
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "cleaning_knowledge_seed.json"
SNAPSHOT_PATH = ROOT / "data" / "cleaning_knowledge_snapshot.json"
MIGRATION_PATH = ROOT / "supabase" / "migrations" / "20260825000400_seed_cleaning_knowledge_release.sql"
NAMESPACE = uuid.UUID("0b3b5456-19b9-4a6d-a918-e8d16697be33")

STAGES = {"prepare", "protect", "preclean", "act", "rinse", "dry", "finish", "pause_check"}
PUBLICATION_FORBIDDEN = (
    "청결도 점수",
    "성실하지",
    "정신질환",
    "관리 부족",
    "사용자 잘못",
    "락스",
    "염소계",
    "표백제",
    "세정제",
    "희석비",
    "접촉 시간",
)
ARBITRARY_DURATION = re.compile(r"\b\d+\s*(초|분|시간)\b")
ARBITRARY_RATIO = re.compile(r"\b\d+\s*(?::|대)\s*\d+\b")


def stable_uuid(kind: str, key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{key}"))


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def sql_quote(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def sql_bool(value: bool) -> str:
    return "true" if value else "false"


def sql_array(values: list[str] | None) -> str:
    if not values:
        return "'{}'::text[]"
    return "array[" + ", ".join(sql_quote(value) for value in values) + "]::text[]"


def values_sql(rows: list[list[str]]) -> str:
    return ",\n  ".join("(" + ", ".join(row) + ")" for row in rows)


def validate_seed(seed: dict[str, Any]) -> None:
    source_keys = {item["key"] for item in seed["sources"]}
    risk_keys = {item["key"] for item in seed["risks"]}
    procedure_keys = {item["key"] for item in seed["procedures"]}
    space_codes = {item["code"] for item in seed["spaces"]}
    target_map = {item["code"]: item["space_code"] for item in seed["targets"]}
    part_map = {item["code"]: item["target_code"] for item in seed["parts"]}
    route_keys: set[tuple[Any, ...]] = set()

    if len(source_keys) != len(seed["sources"]):
        raise ValueError("source key가 중복됐습니다.")
    if len(procedure_keys) != len(seed["procedures"]):
        raise ValueError("procedure key가 중복됐습니다.")

    for procedure in seed["procedures"]:
        steps = procedure["steps"]
        if not steps:
            raise ValueError(f"{procedure['key']}: 단계가 없습니다.")
        if procedure["key"].startswith("bathroom-") and len(steps) != 6:
            raise ValueError(f"{procedure['key']}: 욕실 절차는 정확히 6단계여야 합니다.")
        if not set(procedure.get("risk_keys", [])).issubset(risk_keys):
            raise ValueError(f"{procedure['key']}: 알 수 없는 risk key가 있습니다.")
        for index, step in enumerate(steps, start=1):
            if step["stage_code"] not in STAGES:
                raise ValueError(f"{procedure['key']} {index}: stage_code가 잘못됐습니다.")
            if not step.get("source_keys") or not set(step["source_keys"]).issubset(source_keys):
                raise ValueError(f"{procedure['key']} {index}: 출처 연결이 없거나 잘못됐습니다.")
            user_text = " ".join(str(step.get(field) or "") for field in ("instruction", "detail", "completion_cue", "caution"))
            if any(term in user_text for term in PUBLICATION_FORBIDDEN):
                raise ValueError(f"{procedure['key']} {index}: 금지 평가 문구가 있습니다.")
            if ARBITRARY_DURATION.search(user_text) or ARBITRARY_RATIO.search(user_text):
                raise ValueError(f"{procedure['key']} {index}: 임의 시간 또는 비율이 있습니다.")
        for route in procedure["routes"]:
            if route["space_code"] not in space_codes:
                raise ValueError(f"{procedure['key']}: 알 수 없는 space route입니다.")
            target = route.get("target_code")
            part = route.get("part_code")
            if target and target_map.get(target) != route["space_code"]:
                raise ValueError(f"{procedure['key']}: target과 space가 맞지 않습니다.")
            if part and part_map.get(part) != target:
                raise ValueError(f"{procedure['key']}: part와 target이 맞지 않습니다.")
            route_key = (
                route["space_code"], target, part, route["care_task_code"], route.get("focus_code"), procedure["key"]
            )
            if route_key in route_keys:
                raise ValueError(f"{procedure['key']}: route가 중복됐습니다.")
            route_keys.add(route_key)

    for risk in seed["risks"]:
        if not risk.get("source_keys") or not set(risk["source_keys"]).issubset(source_keys):
            raise ValueError(f"{risk['key']}: 위험 규칙 출처가 잘못됐습니다.")
        if not risk.get("required_phrases"):
            raise ValueError(f"{risk['key']}: required_phrases가 없습니다.")
        risk_text = " ".join(str(risk.get(field) or "") for field in ("user_action", "escalation_target"))
        if any(term in risk_text for term in PUBLICATION_FORBIDDEN):
            raise ValueError(f"{risk['key']}: 위험 규칙에 금지 문구가 있습니다.")

    for tip in seed["tips"]:
        if tip["procedure_key"] not in procedure_keys:
            raise ValueError(f"{tip['key']}: 연결할 절차가 없습니다.")
        procedure = next(item for item in seed["procedures"] if item["key"] == tip["procedure_key"])
        if not 1 <= int(tip["step_no"]) <= len(procedure["steps"]):
            raise ValueError(f"{tip['key']}: 연결할 단계가 없습니다.")
        if not tip.get("source_keys") or not set(tip["source_keys"]).issubset(source_keys):
            raise ValueError(f"{tip['key']}: 팁 출처가 잘못됐습니다.")


def build_snapshot(seed: dict[str, Any]) -> dict[str, Any]:
    source_versions: list[dict[str, Any]] = []
    source_version_by_key: dict[str, str] = {}
    for source in seed["sources"]:
        source_id = stable_uuid("source", source["key"])
        version_id = stable_uuid("source_version", source["key"])
        source_version_by_key[source["key"]] = version_id
        source_versions.append(
            {
                "id": version_id,
                "source_id": source_id,
                "key": source["key"],
                "title": source["title"],
                "publisher": source["publisher"],
                "url": source["url"],
                "source_date": source.get("source_date"),
                "accessed_at": "2026-08-25",
                "locale": source["locale"],
            }
        )

    risks: list[dict[str, Any]] = []
    risk_version_by_key: dict[str, str] = {}
    for risk in seed["risks"]:
        version_id = stable_uuid("risk_version", risk["key"])
        risk_version_by_key[risk["key"]] = version_id
        risks.append(
            {
                "id": version_id,
                "risk_id": stable_uuid("risk", risk["key"]),
                "key": risk["key"],
                "trigger_code": risk["trigger_code"],
                "user_action": risk["user_action"],
                "escalation_target": risk.get("escalation_target"),
                "required_phrases": risk["required_phrases"],
                "source_ids": [source_version_by_key[key] for key in risk["source_keys"]],
            }
        )

    tips: list[dict[str, Any]] = []
    tip_version_by_key: dict[str, str] = {}
    for tip in seed["tips"]:
        version_id = stable_uuid("tip_version", tip["key"])
        tip_version_by_key[tip["key"]] = version_id
        tips.append(
            {
                "id": version_id,
                "tip_id": stable_uuid("tip", tip["key"]),
                "key": tip["key"],
                "procedure_key": tip["procedure_key"],
                "step_no": tip["step_no"],
                "locale": seed["locale"],
                "space_code": tip["space_code"],
                "target_code": tip.get("target_code"),
                "part_code": tip.get("part_code"),
                "care_task_code": tip["care_task_code"],
                "focus_code": tip.get("focus_code"),
                "stage_code": tip.get("stage_code"),
                "tip_text": tip["tip_text"],
                "search_text": tip["search_text"],
                "tags": tip.get("tags", []),
                "content_hash": canonical_hash({key: value for key, value in tip.items() if key not in {"procedure_key", "step_no"}}),
                "source_ids": [source_version_by_key[key] for key in tip["source_keys"]],
            }
        )

    tips_by_step: dict[tuple[str, int], list[str]] = {}
    for tip in tips:
        tips_by_step.setdefault((tip["procedure_key"], int(tip["step_no"])), []).append(tip["id"])

    procedures: list[dict[str, Any]] = []
    for procedure in seed["procedures"]:
        version_id = stable_uuid("procedure_version", procedure["key"])
        steps = []
        for step_no, step in enumerate(procedure["steps"], start=1):
            steps.append(
                {
                    "id": stable_uuid("procedure_step", f"{procedure['key']}:{step_no}"),
                    "step_no": step_no,
                    "stage_code": step["stage_code"],
                    "instruction": step["instruction"],
                    "detail": step["detail"],
                    "completion_cue": step["completion_cue"],
                    "caution": step.get("caution"),
                    "speech_text": f"{step['instruction']} {step['detail']}",
                    "tip_version_ids": tips_by_step.get((procedure["key"], step_no), []),
                    "source_ids": [source_version_by_key[key] for key in step["source_keys"]],
                }
            )
        procedures.append(
            {
                "id": version_id,
                "procedure_id": stable_uuid("procedure", procedure["key"]),
                "key": procedure["key"],
                "revision": 1,
                "locale": seed["locale"],
                "title": procedure["title"],
                "summary": procedure["summary"],
                "required_step_count": len(steps),
                "content_hash": canonical_hash({"title": procedure["title"], "summary": procedure["summary"], "steps": procedure["steps"]}),
                "routes": procedure["routes"],
                "risk_rule_version_ids": [risk_version_by_key[key] for key in procedure.get("risk_keys", [])],
                "steps": steps,
            }
        )

    release_id = stable_uuid("release", seed["release_key"])
    snapshot: dict[str, Any] = {
        "schema_version": 1,
        "release": {
            "id": release_id,
            "release_key": seed["release_key"],
            "locale": seed["locale"],
            "artifact_path": "data/cleaning_knowledge_snapshot.json",
            "reviewed_at": seed["reviewed_at"],
        },
        "taxonomy": {
            "spaces": seed["spaces"],
            "targets": seed["targets"],
            "parts": seed["parts"],
            "care_tasks": seed["care_tasks"],
            "focuses": seed["focuses"],
            "aliases": seed["aliases"],
        },
        "procedures": procedures,
        "tips": tips,
        "risk_rules": risks,
        "sources": source_versions,
        "embedding_profile": {
            "profile_key": "openai-e3large-1024-v1",
            "provider": "openai",
            "model": "text-embedding-3-large",
            "dimensions": 1024,
            "distance_metric": "cosine",
            "input_template_version": "tip-ko-v1",
        },
    }
    snapshot["release"]["manifest_hash"] = canonical_hash(snapshot)
    return snapshot


def build_migration(seed: dict[str, Any], snapshot: dict[str, Any]) -> str:
    lines = ["begin;", ""]

    lines.append("insert into kb.spaces(code, label_ko, locale, active) values")
    lines.append(values_sql([[sql_quote(item["code"]), sql_quote(item["label_ko"]), sql_quote(seed["locale"]), "true"] for item in seed["spaces"]]) + ";\n")

    lines.append("insert into kb.targets(code, space_code, label_ko, aliases_ko, model_match_required, active) values")
    lines.append(values_sql([[sql_quote(item["code"]), sql_quote(item["space_code"]), sql_quote(item["label_ko"]), sql_array(item.get("aliases_ko")), "false", "true"] for item in seed["targets"]]) + ";\n")

    lines.append("insert into kb.target_parts(code, target_code, label_ko, aliases_ko, active) values")
    lines.append(values_sql([[sql_quote(item["code"]), sql_quote(item["target_code"]), sql_quote(item["label_ko"]), sql_array(item.get("aliases_ko")), "true"] for item in seed["parts"]]) + ";\n")

    lines.append("insert into kb.care_tasks(code, label_ko, active) values")
    lines.append(values_sql([[sql_quote(item["code"]), sql_quote(item["label_ko"]), "true"] for item in seed["care_tasks"]]) + ";\n")
    lines.append("insert into kb.focuses(code, label_ko, search_terms_ko, active) values")
    lines.append(values_sql([[sql_quote(item["code"]), sql_quote(item["label_ko"]), sql_array(item.get("search_terms_ko")), "true"] for item in seed["focuses"]]) + ";\n")

    lines.append("insert into kb.app_route_aliases(namespace, input_code, space_code, target_code, care_task_code, focus_code) values")
    lines.append(values_sql([[sql_quote(item["namespace"]), sql_quote(item["input_code"]), sql_quote(item.get("space_code")), sql_quote(item.get("target_code")), sql_quote(item.get("care_task_code")), sql_quote(item.get("focus_code"))] for item in seed["aliases"]]) + ";\n")

    source_version_by_key: dict[str, str] = {}
    for source in seed["sources"]:
        source_id = stable_uuid("source", source["key"])
        version_id = stable_uuid("source_version", source["key"])
        source_version_by_key[source["key"]] = version_id
        lines.append(
            "insert into kb.sources(id, canonical_url, publisher, source_kind) values "
            f"({sql_quote(source_id)}::uuid, {sql_quote(source['url'])}, {sql_quote(source['publisher'])}, {sql_quote(source['source_kind'])});"
        )
        source_hash = canonical_hash({"url": source["url"], "title": source["title"], "evidence_summary": source["evidence_summary"]})
        lines.append(
            "insert into kb.source_versions(id, source_id, revision, title, source_date, accessed_at, license_status, content_hash, locale) values "
            f"({sql_quote(version_id)}::uuid, {sql_quote(source_id)}::uuid, 1, {sql_quote(source['title'])}, {sql_quote(source.get('source_date'))}, '2026-08-25', 'metadata_only', {sql_quote(source_hash)}, {sql_quote(source['locale'])});\n"
        )

    procedure_version_by_key: dict[str, str] = {}
    for procedure in seed["procedures"]:
        procedure_id = stable_uuid("procedure", procedure["key"])
        version_id = stable_uuid("procedure_version", procedure["key"])
        procedure_version_by_key[procedure["key"]] = version_id
        content_hash = canonical_hash({"title": procedure["title"], "summary": procedure["summary"], "steps": procedure["steps"]})
        lines.append(f"insert into kb.procedures(id, procedure_key) values ({sql_quote(procedure_id)}::uuid, {sql_quote(procedure['key'])});")
        lines.append(
            "insert into kb.procedure_versions(id, procedure_id, revision, status, locale, title, summary, required_step_count, content_hash) values "
            f"({sql_quote(version_id)}::uuid, {sql_quote(procedure_id)}::uuid, 1, 'draft', {sql_quote(seed['locale'])}, {sql_quote(procedure['title'])}, {sql_quote(procedure['summary'])}, {len(procedure['steps'])}, {sql_quote(content_hash)});"
        )
        for step_no, step in enumerate(procedure["steps"], start=1):
            step_id = stable_uuid("procedure_step", f"{procedure['key']}:{step_no}")
            speech_text = f"{step['instruction']} {step['detail']}"
            lines.append(
                "insert into kb.procedure_steps(id, procedure_version_id, step_no, stage_code, instruction, detail, completion_cue, caution, speech_text) values "
                f"({sql_quote(step_id)}::uuid, {sql_quote(version_id)}::uuid, {step_no}, {sql_quote(step['stage_code'])}, {sql_quote(step['instruction'])}, {sql_quote(step['detail'])}, {sql_quote(step['completion_cue'])}, {sql_quote(step.get('caution'))}, {sql_quote(speech_text)});"
            )
            for source_key in step["source_keys"]:
                lines.append(
                    "insert into kb.step_source_links(procedure_version_id, step_no, source_version_id, section_locator, support_note) values "
                    f"({sql_quote(version_id)}::uuid, {step_no}, {sql_quote(source_version_by_key[source_key])}::uuid, {sql_quote('verified-scope:' + source_key)}, {sql_quote('검수자가 단계 문안과 출처의 적용 범위를 대조함')});"
                )
        review_id = stable_uuid("review", f"procedure:{procedure['key']}")
        lines.append(
            "insert into kb.review_events(id, entity_type, entity_version_id, decision, reason, reviewer_ref, created_at) values "
            f"({sql_quote(review_id)}::uuid, 'procedure_version', {sql_quote(version_id)}::uuid, 'approved', '단계 순서·출처 범위·안전 문구·실행 가능성 검수 완료', {sql_quote(seed['reviewer_ref'])}, {sql_quote(seed['reviewed_at'])}::timestamptz);\n"
        )

    tip_version_by_key: dict[str, str] = {}
    for tip in seed["tips"]:
        tip_id = stable_uuid("tip", tip["key"])
        version_id = stable_uuid("tip_version", tip["key"])
        tip_version_by_key[tip["key"]] = version_id
        content_hash = canonical_hash({key: value for key, value in tip.items() if key not in {"procedure_key", "step_no"}})
        lines.append(f"insert into kb.tips(id, tip_key) values ({sql_quote(tip_id)}::uuid, {sql_quote(tip['key'])});")
        lines.append(
            "insert into kb.tip_versions(id, tip_id, revision, status, locale, space_code, target_code, part_code, care_task_code, focus_code, stage_code, tip_text, search_text, tags, content_hash) values "
            f"({sql_quote(version_id)}::uuid, {sql_quote(tip_id)}::uuid, 1, 'draft', {sql_quote(seed['locale'])}, {sql_quote(tip['space_code'])}, {sql_quote(tip.get('target_code'))}, {sql_quote(tip.get('part_code'))}, {sql_quote(tip['care_task_code'])}, {sql_quote(tip.get('focus_code'))}, {sql_quote(tip.get('stage_code'))}, {sql_quote(tip['tip_text'])}, {sql_quote(tip['search_text'])}, {sql_array(tip.get('tags'))}, {sql_quote(content_hash)});"
        )
        for source_key in tip["source_keys"]:
            lines.append(
                "insert into kb.tip_source_links(tip_version_id, source_version_id, section_locator, support_note) values "
                f"({sql_quote(version_id)}::uuid, {sql_quote(source_version_by_key[source_key])}::uuid, {sql_quote('verified-scope:' + source_key)}, '검수자가 팁 문안과 출처의 적용 범위를 대조함');"
            )
        lines.append(
            "insert into kb.review_events(id, entity_type, entity_version_id, decision, reason, reviewer_ref, created_at) values "
            f"({sql_quote(stable_uuid('review', 'tip:' + tip['key']))}::uuid, 'tip_version', {sql_quote(version_id)}::uuid, 'approved', '팁 출처·범위·검색 태그 검수 완료', {sql_quote(seed['reviewer_ref'])}, {sql_quote(seed['reviewed_at'])}::timestamptz);"
        )
        lines.append(
            "update kb.tip_versions set status = 'published', reviewed_at = "
            f"{sql_quote(seed['reviewed_at'])}::timestamptz, published_at = {sql_quote(seed['reviewed_at'])}::timestamptz where id = {sql_quote(version_id)}::uuid;\n"
        )

    for tip in seed["tips"]:
        lines.append(
            "insert into kb.procedure_step_tips(procedure_version_id, step_no, tip_version_id, display_order) values "
            f"({sql_quote(procedure_version_by_key[tip['procedure_key']])}::uuid, {tip['step_no']}, {sql_quote(tip_version_by_key[tip['key']])}::uuid, 1);"
        )
    lines.append("")

    risk_version_by_key: dict[str, str] = {}
    for risk in seed["risks"]:
        risk_id = stable_uuid("risk", risk["key"])
        version_id = stable_uuid("risk_version", risk["key"])
        risk_version_by_key[risk["key"]] = version_id
        content_hash = canonical_hash(risk)
        lines.append(f"insert into kb.risk_rules(id, risk_key) values ({sql_quote(risk_id)}::uuid, {sql_quote(risk['key'])});")
        lines.append(
            "insert into kb.risk_rule_versions(id, risk_rule_id, revision, status, locale, trigger_code, user_action, escalation_target, required_phrases, content_hash) values "
            f"({sql_quote(version_id)}::uuid, {sql_quote(risk_id)}::uuid, 1, 'draft', {sql_quote(seed['locale'])}, {sql_quote(risk['trigger_code'])}, {sql_quote(risk['user_action'])}, {sql_quote(risk.get('escalation_target'))}, {sql_array(risk['required_phrases'])}, {sql_quote(content_hash)});"
        )
        for source_key in risk["source_keys"]:
            lines.append(
                "insert into kb.risk_source_links(risk_rule_version_id, source_version_id, section_locator, support_note) values "
                f"({sql_quote(version_id)}::uuid, {sql_quote(source_version_by_key[source_key])}::uuid, {sql_quote('verified-scope:' + source_key)}, '검수자가 위험 문구와 출처의 적용 범위를 대조함');"
            )
        lines.append(
            "insert into kb.review_events(id, entity_type, entity_version_id, decision, reason, reviewer_ref, created_at) values "
            f"({sql_quote(stable_uuid('review', 'risk:' + risk['key']))}::uuid, 'risk_rule_version', {sql_quote(version_id)}::uuid, 'approved', '위험 조건·사용자 행동·중단 기준 검수 완료', {sql_quote(seed['reviewer_ref'])}, {sql_quote(seed['reviewed_at'])}::timestamptz);"
        )
        lines.append(
            "update kb.risk_rule_versions set status = 'published', reviewed_at = "
            f"{sql_quote(seed['reviewed_at'])}::timestamptz, published_at = {sql_quote(seed['reviewed_at'])}::timestamptz where id = {sql_quote(version_id)}::uuid;\n"
        )

    for procedure in seed["procedures"]:
        version_id = procedure_version_by_key[procedure["key"]]
        for order, risk_key in enumerate(procedure.get("risk_keys", []), start=1):
            lines.append(
                "insert into kb.procedure_risk_rules(procedure_version_id, risk_rule_version_id, display_order, required) values "
                f"({sql_quote(version_id)}::uuid, {sql_quote(risk_version_by_key[risk_key])}::uuid, {order}, true);"
            )
        lines.append(
            "update kb.procedure_versions set status = 'published', reviewed_at = "
            f"{sql_quote(seed['reviewed_at'])}::timestamptz, published_at = {sql_quote(seed['reviewed_at'])}::timestamptz where id = {sql_quote(version_id)}::uuid;"
        )
        for index, route in enumerate(procedure["routes"], start=1):
            route_id = stable_uuid("route", f"{procedure['key']}:{index}")
            lines.append(
                "insert into kb.procedure_routes(id, locale, space_code, target_code, part_code, care_task_code, focus_code, specificity, priority, is_fallback, procedure_version_id) values "
                f"({sql_quote(route_id)}::uuid, {sql_quote(seed['locale'])}, {sql_quote(route['space_code'])}, {sql_quote(route.get('target_code'))}, {sql_quote(route.get('part_code'))}, {sql_quote(route['care_task_code'])}, {sql_quote(route.get('focus_code'))}, {int(route.get('specificity', 0))}, {int(route.get('priority', 100))}, {sql_bool(bool(route.get('is_fallback', False)))}, {sql_quote(version_id)}::uuid);"
            )
        lines.append("")

    profile = snapshot["embedding_profile"]
    lines.append(
        "insert into kb.embedding_profiles(profile_key, provider, model, dimensions, distance_metric, input_template_version, active) values "
        f"({sql_quote(profile['profile_key'])}, {sql_quote(profile['provider'])}, {sql_quote(profile['model'])}, {profile['dimensions']}, {sql_quote(profile['distance_metric'])}, {sql_quote(profile['input_template_version'])}, true);\n"
    )

    release = snapshot["release"]
    lines.append(
        "insert into kb.release_snapshots(id, release_key, locale, manifest_hash, artifact_path, is_active) values "
        f"({sql_quote(release['id'])}::uuid, {sql_quote(release['release_key'])}, {sql_quote(release['locale'])}, {sql_quote(release['manifest_hash'])}, {sql_quote(release['artifact_path'])}, false);"
    )
    lines.append("insert into kb.release_procedures(release_snapshot_id, procedure_version_id) values")
    lines.append(values_sql([[sql_quote(release["id"]) + "::uuid", sql_quote(item["id"]) + "::uuid"] for item in snapshot["procedures"]]) + ";")
    lines.append("insert into kb.release_tips(release_snapshot_id, tip_version_id) values")
    lines.append(values_sql([[sql_quote(release["id"]) + "::uuid", sql_quote(item["id"]) + "::uuid"] for item in snapshot["tips"]]) + ";")
    lines.append("insert into kb.release_risks(release_snapshot_id, risk_rule_version_id) values")
    lines.append(values_sql([[sql_quote(release["id"]) + "::uuid", sql_quote(item["id"]) + "::uuid"] for item in snapshot["risk_rules"]]) + ";")
    lines.append(f"select kb.activate_release({sql_quote(release['release_key'])});")
    lines.append("")
    lines.append("commit;")
    return "\n".join(lines) + "\n"


def main() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    validate_seed(seed)
    snapshot = build_snapshot(seed)
    migration = build_migration(seed, snapshot)
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MIGRATION_PATH.write_text(migration, encoding="utf-8")
    print(
        json.dumps(
            {
                "release_key": snapshot["release"]["release_key"],
                "manifest_hash": snapshot["release"]["manifest_hash"],
                "procedures": len(snapshot["procedures"]),
                "steps": sum(len(item["steps"]) for item in snapshot["procedures"]),
                "tips": len(snapshot["tips"]),
                "risks": len(snapshot["risk_rules"]),
                "sources": len(snapshot["sources"]),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
