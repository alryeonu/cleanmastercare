from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_SNAPSHOT_PATH = ROOT / "data" / "cleaning_knowledge_snapshot.json"
SUPPORTED_LOCALE = "ko-KR"
VISIBLE_CATEGORIES = {"organize", "clean", "laundry"}
WORD_PATTERN = re.compile(r"[0-9A-Za-z가-힣]{2,}")


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True)
class NormalizedGuideRequest:
    locale: str
    area_hint: str
    visible_categories: tuple[str, ...]
    cleaning_focus: str
    space_code: str
    target_code: str | None
    part_code: str | None
    care_task_code: str
    user_confirmed: bool
    observations: tuple[str, ...]

    def as_context_dict(self) -> dict[str, Any]:
        return {
            "locale": self.locale,
            "area_hint": self.area_hint,
            "visible_categories": list(self.visible_categories),
            "cleaning_focus": self.cleaning_focus,
            "space_code": self.space_code,
            "target_code": self.target_code,
            "part_code": self.part_code,
            "care_task_code": self.care_task_code,
            "user_confirmed": self.user_confirmed,
            "observations": list(self.observations),
        }


class SnapshotKnowledgeRepository:
    """검수 릴리스 snapshot을 읽는 결정론적 장애 대체 저장소."""

    def __init__(self, snapshot_path: Path | str = DEFAULT_SNAPSHOT_PATH):
        self.snapshot_path = Path(snapshot_path)
        self.snapshot = json.loads(self.snapshot_path.read_text(encoding="utf-8"))
        self._validate_snapshot()
        self._procedures_by_id = {item["id"]: item for item in self.snapshot["procedures"]}
        self._tips_by_id = {item["id"]: item for item in self.snapshot["tips"]}
        self._risks_by_id = {item["id"]: item for item in self.snapshot["risk_rules"]}
        self._sources_by_id = {item["id"]: item for item in self.snapshot["sources"]}

    @property
    def release_key(self) -> str:
        return str(self.snapshot["release"]["release_key"])

    def _validate_snapshot(self) -> None:
        if self.snapshot.get("schema_version") != 1:
            raise RuntimeError("지원하지 않는 청소 지식 snapshot 형식입니다.")
        release = self.snapshot.get("release")
        if not isinstance(release, dict) or not release.get("manifest_hash"):
            raise RuntimeError("청소 지식 릴리스 정보가 없습니다.")
        without_hash = json.loads(json.dumps(self.snapshot, ensure_ascii=False))
        expected_hash = without_hash["release"].pop("manifest_hash")
        if canonical_hash(without_hash) != expected_hash:
            raise RuntimeError("청소 지식 snapshot 무결성 검증에 실패했습니다.")

    def normalize_request(self, payload: Any) -> NormalizedGuideRequest:
        if not isinstance(payload, dict):
            raise ValueError("청소 안내 요청 형식을 확인해주세요.")
        if payload.get("user_confirmed") is not True:
            raise ValueError("실제 공간과 비교했다는 확인이 필요해요.")

        locale = str(payload.get("locale") or SUPPORTED_LOCALE)
        if locale != SUPPORTED_LOCALE or locale != self.snapshot["release"]["locale"]:
            raise ValueError("현재 지원하는 안내 언어는 한국어입니다.")

        aliases = self.snapshot["taxonomy"]["aliases"]
        alias_by_key = {(item["namespace"], item["input_code"]): item for item in aliases}
        area_hint = str(payload.get("area_hint") or "")
        area_alias = alias_by_key.get(("area_hint", area_hint))
        if area_alias is None:
            raise ValueError("지원하는 청소 장소를 선택해주세요.")

        categories_value = payload.get("visible_categories")
        if not isinstance(categories_value, list):
            raise ValueError("정리·청소·세탁 중 할 일을 선택해주세요.")
        visible_categories = tuple(dict.fromkeys(str(item) for item in categories_value))
        if not visible_categories or any(item not in VISIBLE_CATEGORIES for item in visible_categories):
            raise ValueError("정리·청소·세탁 중 지원하는 할 일을 선택해주세요.")

        cleaning_focus = str(payload.get("cleaning_focus") or "unknown")
        focus_alias = alias_by_key.get(("cleaning_focus", cleaning_focus))
        if focus_alias is None:
            raise ValueError("지원하는 관찰 후보를 선택해주세요.")

        if cleaning_focus == "laundry" and "laundry" in visible_categories:
            care_task_code = "laundry"
        elif cleaning_focus == "clutter" and "organize" in visible_categories:
            care_task_code = "organize"
        elif "clean" in visible_categories:
            care_task_code = "clean"
        elif "organize" in visible_categories:
            care_task_code = "organize"
        else:
            care_task_code = "laundry"

        spaces = {item["code"] for item in self.snapshot["taxonomy"]["spaces"]}
        targets = {item["code"]: item for item in self.snapshot["taxonomy"]["targets"]}
        parts = {item["code"]: item for item in self.snapshot["taxonomy"]["parts"]}
        space_code = str(area_alias.get("space_code") or "")
        if space_code not in spaces:
            raise RuntimeError("청소 지식 장소 분류가 올바르지 않습니다.")

        target_code = payload.get("target_code") or area_alias.get("target_code")
        target_code = str(target_code) if target_code else None
        part_code = str(payload.get("part_code")) if payload.get("part_code") else None
        if target_code not in targets or targets[target_code]["space_code"] != space_code:
            raise ValueError("선택한 장소와 청소 대상이 맞지 않아요.")
        if part_code and (part_code not in parts or parts[part_code]["target_code"] != target_code):
            raise ValueError("선택한 대상과 세부 부위가 맞지 않아요.")

        observations_value = payload.get("observations", [])
        if not isinstance(observations_value, list):
            raise ValueError("관찰된 흔적 형식을 확인해주세요.")
        observations: list[str] = []
        for value in observations_value[:5]:
            compact = " ".join(str(value).split())[:160]
            if compact:
                observations.append(compact)

        return NormalizedGuideRequest(
            locale=locale,
            area_hint=area_hint,
            visible_categories=visible_categories,
            cleaning_focus=str(focus_alias.get("focus_code") or "unknown"),
            space_code=space_code,
            target_code=target_code,
            part_code=part_code,
            care_task_code=care_task_code,
            user_confirmed=True,
            observations=tuple(observations),
        )

    def resolve_procedure(self, request: NormalizedGuideRequest) -> tuple[dict[str, Any], dict[str, Any]]:
        candidates: list[tuple[tuple[Any, ...], dict[str, Any], dict[str, Any]]] = []
        for procedure in self.snapshot["procedures"]:
            for route_index, route in enumerate(procedure["routes"]):
                if route["space_code"] != request.space_code:
                    continue
                if route["care_task_code"] != request.care_task_code:
                    continue
                if route.get("target_code") not in {None, request.target_code}:
                    continue
                if route.get("part_code") not in {None, request.part_code}:
                    continue
                if route.get("focus_code") not in {None, request.cleaning_focus, "unknown"}:
                    continue
                rank = (
                    -int(route.get("target_code") is not None and route.get("target_code") == request.target_code),
                    -int(route.get("part_code") is not None and route.get("part_code") == request.part_code),
                    -int(route.get("focus_code") is not None and route.get("focus_code") == request.cleaning_focus),
                    int(bool(route.get("is_fallback", False))),
                    -int(route.get("specificity", 0)),
                    int(route.get("priority", 100)),
                    procedure["id"],
                    route_index,
                )
                candidates.append((rank, procedure, route))
        if not candidates:
            raise RuntimeError("검수된 청소 절차를 찾지 못했습니다.")
        _, procedure, route = min(candidates, key=lambda item: item[0])
        return procedure, route

    @staticmethod
    def _search_terms(request: NormalizedGuideRequest) -> set[str]:
        text = " ".join(
            [request.area_hint, request.cleaning_focus, request.target_code or "", request.part_code or "", *request.observations]
        ).lower()
        return set(WORD_PATTERN.findall(text))

    def _supplemental_tip_ids(
        self,
        request: NormalizedGuideRequest,
        procedure: dict[str, Any],
        fixed_tip_ids: set[str],
    ) -> dict[int, list[str]]:
        terms = self._search_terms(request)
        if not terms:
            return {}
        ranked: list[tuple[tuple[Any, ...], dict[str, Any]]] = []
        for tip in self.snapshot["tips"]:
            if tip["id"] in fixed_tip_ids or tip["locale"] != request.locale:
                continue
            if tip["space_code"] != request.space_code or tip["care_task_code"] != request.care_task_code:
                continue
            if tip.get("target_code") not in {None, request.target_code}:
                continue
            if tip.get("part_code") not in {None, request.part_code}:
                continue
            if tip.get("focus_code") not in {None, request.cleaning_focus, "unknown"}:
                continue
            haystack = f"{tip['search_text']} {' '.join(tip.get('tags', []))}".lower()
            overlap = sum(1 for term in terms if term in haystack)
            if overlap == 0:
                continue
            ranked.append(
                (
                    (
                        -overlap,
                        -int(tip.get("target_code") == request.target_code),
                        -int(tip.get("part_code") == request.part_code),
                        -int(tip.get("focus_code") == request.cleaning_focus),
                        tip["id"],
                    ),
                    tip,
                )
            )

        stage_to_steps: dict[str, list[int]] = {}
        for step in procedure["steps"]:
            stage_to_steps.setdefault(step["stage_code"], []).append(int(step["step_no"]))
        selected: dict[int, list[str]] = {}
        for _, tip in sorted(ranked, key=lambda item: item[0]):
            stage_steps = stage_to_steps.get(str(tip.get("stage_code") or ""), [])
            if not stage_steps:
                continue
            step_no = stage_steps[0]
            if len(selected.get(step_no, [])) < 1:
                selected.setdefault(step_no, []).append(tip["id"])
        return selected

    def build_context(self, payload: Any) -> dict[str, Any]:
        request = self.normalize_request(payload)
        procedure, route = self.resolve_procedure(request)
        fixed_tip_ids = {
            tip_id
            for step in procedure["steps"]
            for tip_id in step.get("tip_version_ids", [])
        }
        supplemental = self._supplemental_tip_ids(request, procedure, fixed_tip_ids)

        steps: list[dict[str, Any]] = []
        used_tip_ids: list[str] = []
        used_source_ids: set[str] = set()
        for source_step in procedure["steps"]:
            tip_ids = list(source_step.get("tip_version_ids", []))
            for tip_id in supplemental.get(int(source_step["step_no"]), []):
                if len(tip_ids) >= 2:
                    break
                tip_ids.append(tip_id)
            used_tip_ids.extend(tip_ids)
            used_source_ids.update(source_step["source_ids"])
            for tip_id in tip_ids:
                used_source_ids.update(self._tips_by_id[tip_id]["source_ids"])
            steps.append({**source_step, "tip_version_ids": tip_ids})

        risk_rules = [self._risks_by_id[risk_id] for risk_id in procedure["risk_rule_version_ids"]]
        for risk in risk_rules:
            used_source_ids.update(risk["source_ids"])
        step_tips = [self._tips_by_id[tip_id] for tip_id in dict.fromkeys(used_tip_ids)]
        sources = [self._sources_by_id[source_id] for source_id in sorted(used_source_ids)]

        context = {
            "request": request.as_context_dict(),
            "retrieval": {
                "release_key": self.release_key,
                "manifest_hash": self.snapshot["release"]["manifest_hash"],
                "procedure_version": {
                    "id": procedure["id"],
                    "key": procedure["key"],
                    "title": procedure["title"],
                    "summary": procedure["summary"],
                    "required_step_count": procedure["required_step_count"],
                },
                "matched_route": route,
                "steps": steps,
                "step_tips": step_tips,
                "risk_rules": risk_rules,
                "sources": sources,
            },
        }
        context["context_id"] = canonical_hash(context)
        return context


_DEFAULT_REPOSITORY: SnapshotKnowledgeRepository | None = None


def get_knowledge_repository() -> SnapshotKnowledgeRepository:
    global _DEFAULT_REPOSITORY
    if _DEFAULT_REPOSITORY is None:
        _DEFAULT_REPOSITORY = SnapshotKnowledgeRepository()
    return _DEFAULT_REPOSITORY
