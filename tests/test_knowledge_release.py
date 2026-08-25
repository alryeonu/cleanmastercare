from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "cleaning_knowledge_seed.json"
SNAPSHOT_PATH = ROOT / "data" / "cleaning_knowledge_snapshot.json"
GENERATOR_PATH = ROOT / "scripts" / "build_knowledge_release.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("build_knowledge_release", GENERATOR_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_seed_rebuilds_the_committed_snapshot_exactly() -> None:
    generator = load_generator()
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))

    generator.validate_seed(seed)
    assert generator.build_snapshot(seed) == snapshot


def test_release_contract_and_source_coverage() -> None:
    generator = load_generator()
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    release_without_hash = json.loads(json.dumps(snapshot, ensure_ascii=False))
    expected_hash = release_without_hash["release"].pop("manifest_hash")

    assert generator.canonical_hash(release_without_hash) == expected_hash
    assert len(snapshot["procedures"]) == 14
    assert sum(len(item["steps"]) for item in snapshot["procedures"]) == 77
    assert len(snapshot["tips"]) == 12
    assert len(snapshot["risk_rules"]) == 6
    assert len(snapshot["sources"]) == 9

    for procedure in snapshot["procedures"]:
        if procedure["key"].startswith("bathroom-"):
            assert procedure["required_step_count"] == 6
        assert procedure["required_step_count"] == len(procedure["steps"])
        assert all(step["source_ids"] for step in procedure["steps"])

    assert all(tip["source_ids"] for tip in snapshot["tips"])
    assert all(risk["source_ids"] for risk in snapshot["risk_rules"])


def test_user_facing_corpus_excludes_unreviewed_product_instructions() -> None:
    generator = load_generator()
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    user_texts: list[str] = []

    for procedure in snapshot["procedures"]:
        for step in procedure["steps"]:
            user_texts.append(
                " ".join(
                    str(step.get(field) or "")
                    for field in ("instruction", "detail", "completion_cue", "caution")
                )
            )
    for tip in snapshot["tips"]:
        user_texts.append(tip["tip_text"])
    for risk in snapshot["risk_rules"]:
        user_texts.append(
            " ".join(str(risk.get(field) or "") for field in ("user_action", "escalation_target"))
        )

    for text in user_texts:
        assert not any(term in text for term in generator.PUBLICATION_FORBIDDEN)
        assert generator.ARBITRARY_DURATION.search(text) is None
        assert generator.ARBITRARY_RATIO.search(text) is None
