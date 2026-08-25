from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from cleaning_knowledge import get_knowledge_repository
from grounded_guide import (
    GROUNDING_INSTRUCTIONS,
    build_guide_response,
    build_openai_input,
)


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
OPENAI_URL = "https://api.openai.com/v1/responses"
MAX_BODY_BYTES = 22 * 1024 * 1024


def load_env_file() -> None:
    path = ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.6-luna").strip() or "gpt-5.6-luna"


ANALYSIS_SCHEMAS: dict[str, dict[str, Any]] = {
    "cleaning_area": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "area_hint": {"type": "string", "enum": ["desk", "sink", "sofa", "bed", "shoe_rack", "bathroom", "kitchen", "other"]},
            "visible_categories": {"type": "array", "items": {"type": "string", "enum": ["organize", "clean", "laundry"]}},
            "cleaning_focus": {"type": "string", "enum": ["water_scale", "soap_scum", "grease", "dust", "clutter", "laundry", "unknown"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "observations": {"type": "array", "items": {"type": "string"}},
            "needs_user_confirmation": {"type": "boolean"},
        },
        "required": ["area_hint", "visible_categories", "cleaning_focus", "confidence", "observations", "needs_user_confirmation"],
    },
    "bathroom_check": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "is_bathroom": {"type": "boolean"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "observations": {"type": "array", "items": {"type": "string"}},
            "needs_user_confirmation": {"type": "boolean"},
        },
        "required": ["is_bathroom", "confidence", "observations", "needs_user_confirmation"],
    },
    "before_after": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "same_target": {"type": "boolean"},
            "observable_change": {"type": "boolean"},
            "changes": {"type": "array", "items": {"type": "string"}},
            "remaining_areas": {"type": "array", "items": {"type": "string"}},
            "mission_checks": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "organize": {"type": "boolean"},
                    "clean": {"type": "boolean"},
                    "laundry": {"type": "boolean"},
                },
                "required": ["organize", "clean", "laundry"],
            },
            "mission_evidence": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "organize": {"type": "array", "items": {"type": "string"}},
                    "clean": {"type": "array", "items": {"type": "string"}},
                    "laundry": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["organize", "clean", "laundry"],
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["same_target", "observable_change", "changes", "remaining_areas", "mission_checks", "mission_evidence", "confidence"],
    },
}


PROMPTS = {
    "cleaning_area": """당신은 집안 공간 사진에서 관찰 가능한 정리·청소·세탁 후보를 설명하는 시각 관찰 도우미입니다. area_hint는 사진에서 가장 중심적으로 보이는 공간을 하나 고르세요. 특히 싱크볼, 배수구, 수전, 설거지 그릇, 싱크대 상판이 중심이면 반드시 sink를 고르세요. kitchen은 싱크대가 중심이 아닌 조리대·가스레인지·수납장·주방 전체가 중심인 사진에만 고르세요. visible_categories에는 사진에서 실제로 할 일이 보이는 organize(물건 분류·제자리 정리), clean(먼지·얼룩·부스러기 등 표면 정리), laundry(세탁이 필요한 천·의류·침구)가 있으면 넣으세요. cleaning_focus는 사진의 가장 뚜렷한 문제 하나로 고르세요: water_scale은 수전·타일·유리의 하얗고 딱딱한 물자국/광물 자국, soap_scum은 뿌연 비누막, grease는 끈적한 기름막, dust는 마른 먼지·부스러기, clutter는 물건이 섞여 정리가 필요한 상태, laundry는 세탁할 천·의류·침구입니다. 근거가 부족하면 unknown을 반환하세요. observations에는 보이는 위치·물건·상태를 한국어로 2~4개 적으세요. 사람의 성실성·정신건강·청결도 점수는 절대 만들지 말고, 보이지 않는 재질·세제 정보는 만들지 마세요. 사용자가 최종 확인해야 합니다.""",
    "bathroom_check": """당신은 사진이 욕실인지 여부만 관찰하는 도우미입니다. 타일, 세면대, 변기, 욕조, 샤워기, 욕실 거울, 배수구처럼 사진에서 보이는 욕실 단서가 충분할 때만 is_bathroom을 true로 반환하세요. 방, 책상, 수납장, 주방, 거실처럼 욕실 단서가 없거나 사진만으로 확신할 수 없으면 false를 반환하세요. observations에는 보이는 단서만 1~3개 한국어로 적으세요. 청소 방법, 사람 평가, 재질·제품 판단, 사진에 없는 사실은 만들지 마세요.""",
    "before_after": "두 사진을 반드시 비교 관찰하세요. 먼저 싱크대 모서리·수도꼭지·배수구, 책상 모서리·서랍, 소파 쿠션·팔걸이처럼 같은 위치임을 보여 주는 고정 기준점을 2개 이상 찾으세요. 기준점이 충분히 일치하지 않으면 same_target은 false입니다. 조명·촬영 거리·그림자만 달라진 경우에는 변화로 단정하지 마세요. same_target이 false이거나 관찰 근거가 부족하면 mission_checks의 세 값은 모두 false이고 mission_evidence의 세 배열은 모두 빈 배열입니다. same_target이 true면 BEFORE와 AFTER의 같은 영역을 항목별로 다시 확인하세요. organize는 물건이 분류되거나 제자리에 놓여 공간이 정리된 경우, clean은 보이는 먼지·부스러기·얼룩·물때가 줄어든 경우, laundry는 세탁 대상 천·의류·침구가 분리·수거되거나 정돈된 경우에만 true입니다. true인 항목은 mission_evidence에 사진에서 확인한 짧은 근거 1~2개를 적고, false 항목은 빈 배열로 반환하세요. 선택하지 않은 범주는 반드시 false와 빈 배열입니다. 청결도 점수, 순위, 사람의 노력이나 성실성 평가는 금지합니다.",
}


def validate_images(images: Any, expected_max: int = 2) -> list[str]:
    if not isinstance(images, list) or not images or len(images) > expected_max:
        raise ValueError(f"사진은 1~{expected_max}장까지 사용할 수 있습니다.")
    total = 0
    allowed = ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")
    for image in images:
        if not isinstance(image, str) or not image.startswith(allowed):
            raise ValueError("JPG, PNG, WEBP 이미지만 사용할 수 있습니다.")
        total += len(image)
    if total > MAX_BODY_BYTES:
        raise ValueError("사진 용량이 너무 큽니다.")
    return images


def extract_output_text(response: dict[str, Any]) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]
    for item in response.get("output", []):
        if item.get("type") == "message":
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    return str(content.get("text", ""))
    raise RuntimeError("AI 응답에서 결과를 찾지 못했습니다.")


def call_openai(mode: str, images: list[str], context: dict[str, Any] | None = None) -> tuple[dict[str, Any], str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")
    # 제품 요구사항상 사진 분석은 항상 gpt-5.6-luna를 사용한다.
    models = [OPENAI_MODEL]
    selected = context if isinstance(context, dict) else {}
    area = str(selected.get("area", "other"))
    categories = [item for item in selected.get("categories", []) if item in {"organize", "clean", "laundry"}] if isinstance(selected.get("categories", []), list) else []
    focus = str(selected.get("focus", "unknown"))
    if mode == "bathroom_check":
        context_text = f"\n사용자 계획 장소: {area}. 이 값은 사진 판정의 정답이 아닙니다. 사진에서 욕실 단서가 충분할 때만 true를, 그 밖에는 false를 반환하세요."
    elif mode == "cleaning_area":
        context_text = f"\n사용자 계획 장소: {area}. 이 값은 사진 판정의 정답이 아닙니다. 사진에서 실제로 관찰되는 공간을 먼저 판단하고, 보이지 않으면 unknown을 반환하세요."
    else:
        context_text = f"\n사용자 선택 장소: {area}. 사용자 선택 분류: {', '.join(categories) or '없음'}. 사용자 선택 핵심 문제: {focus}. 이 선택 범위만 고려하세요."
    content: list[dict[str, Any]] = [{"type": "input_text", "text": PROMPTS[mode] + context_text}]
    image_detail = "low" if mode in {"cleaning_area", "bathroom_check"} else "high"
    content.extend({"type": "input_image", "image_url": image, "detail": image_detail} for image in images)
    last_error = "AI 분석에 실패했습니다."
    for model in models[:2]:
        payload = {
            "model": model,
            "store": False,
            "reasoning": {"effort": "low" if mode in {"cleaning_area", "bathroom_check"} else "high"},
            "input": [{"role": "user", "content": content}],
            "text": {"format": {"type": "json_schema", "name": f"clean_master_{mode}", "strict": True, "schema": ANALYSIS_SCHEMAS[mode]}},
            "max_output_tokens": 1200,
        }
        req = urllib.request.Request(OPENAI_URL, data=json.dumps(payload).encode(), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                body = json.loads(response.read().decode())
            result = json.loads(extract_output_text(body))
            if mode in {"cleaning_area", "bathroom_check"}:
                result["needs_user_confirmation"] = True
            return result, model
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode()).get("error", {}).get("message", "")
            except Exception:
                detail = ""
            last_error = f"{model} 호출 실패({exc.code})" + (f": {detail[:160]}" if detail else "")
        except Exception as exc:
            last_error = f"{model} 호출 실패: {str(exc)[:160]}"
    raise RuntimeError(last_error)


def analyze_images(mode: str, images: Any, context: Any = None) -> dict[str, Any]:
    if mode not in ANALYSIS_SCHEMAS:
        raise ValueError("지원하지 않는 분석 유형입니다.")
    checked = validate_images(images, 2)
    if not os.getenv("OPENAI_API_KEY", "").strip():
        return {"manual_required": True, "message": "AI 연결 전이라 직접 선택 모드로 계속합니다.", "model": None}
    result, model = call_openai(mode, checked, context if isinstance(context, dict) else None)
    return {**result, "manual_required": False, "model": model}


def env_enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def call_grounded_openai(context: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")
    payload = {
        "model": OPENAI_MODEL,
        "store": False,
        "reasoning": {"effort": "low"},
        "instructions": GROUNDING_INSTRUCTIONS,
        "input": build_openai_input(context),
        "text": {
            "format": {
                "type": "json_schema",
                "name": "clean_master_grounded_guide",
                "strict": True,
                "schema": schema,
            }
        },
        "max_output_tokens": 6000,
    }
    request = urllib.request.Request(
        OPENAI_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode("utf-8"))
    return json.loads(extract_output_text(body))


def get_supabase_server_key() -> tuple[str, str]:
    """서버 전용 Supabase 키와 키 형식을 반환한다."""
    secret_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    if secret_key:
        return secret_key, "secret"
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if service_role_key:
        return service_role_key, "service_role"
    return "", "none"


def verify_supabase_route(context: dict[str, Any]) -> bool:
    """서버 전용 RPC의 active release가 번들 snapshot과 같은지 확인한다."""
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    server_key, key_type = get_supabase_server_key()
    if not supabase_url or not server_key:
        return False
    normalized = context["request"]
    payload = {
        "p_locale": normalized["locale"],
        "p_area_hint": normalized["area_hint"],
        "p_visible_categories": normalized["visible_categories"],
        "p_cleaning_focus": normalized["cleaning_focus"],
        "p_target_code": normalized["target_code"],
        "p_part_code": normalized["part_code"],
    }
    headers = {
        "apikey": server_key,
        "Content-Type": "application/json",
    }
    if key_type == "service_role":
        headers["Authorization"] = f"Bearer {server_key}"
    request = urllib.request.Request(
        f"{supabase_url}/rest/v1/rpc/resolve_cleaning_procedure",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        remote = json.loads(response.read().decode("utf-8"))
    retrieval = context["retrieval"]
    return bool(
        isinstance(remote, dict)
        and remote.get("release_key") == retrieval["release_key"]
        and remote.get("manifest_hash") == retrieval["manifest_hash"]
        and remote.get("procedure_version_id") == retrieval["procedure_version"]["id"]
        and remote.get("required_step_count") == retrieval["procedure_version"]["required_step_count"]
    )


def create_cleaning_guide(payload: Any) -> dict[str, Any]:
    context = get_knowledge_repository().build_context(payload)
    try:
        supabase_verified = verify_supabase_route(context)
    except Exception:
        supabase_verified = False
    generate = None
    if env_enabled("ENABLE_GROUNDED_GUIDE_LLM") and os.getenv("OPENAI_API_KEY", "").strip():
        generate = call_grounded_openai
    response = build_guide_response(
        context,
        generate=generate,
        canonical_mode="canonical" if supabase_verified else "local_fallback",
    )
    response["knowledge_source"] = "supabase_release" if supabase_verified else "local_release_snapshot"
    return response


RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)

# 로그인·계정·사진 없이 운영하는 MVP 익명 게시판입니다. 별도 데이터베이스를
# 아직 도입하지 않았으므로 서버 재시작 시 작성글은 초기화됩니다.
COMMUNITY_POSTS: deque[dict[str, Any]] = deque(maxlen=100)
COMMUNITY_SEED = [
    {"id": "welcome-tip", "title": "작은 구역부터 시작해도 충분해요", "body": "타이머를 5분만 맞추고 눈앞의 한 칸부터 정리해요. 끝내지 못해도 다음 시작점이 생겨요.", "created_at": "방금 전"},
    {"id": "welcome-story", "title": "오늘은 싱크대 한쪽을 비웠어요", "body": "쌓인 그릇을 한 번에 해결하지 않고, 컵부터 제자리에 뒀어요. 다음에는 물기 닦기에 도전하려고요.", "created_at": "오늘"},
]
COMMUNITY_COMMENTS: dict[str, deque[dict[str, Any]]] = {
    "welcome-tip": deque(
        [
            {"id": "welcome-comment-1", "body": "한 칸만 정해도 시작하기가 훨씬 편하더라고요.", "created_at": "방금 전"},
        ],
        maxlen=100,
    ),
    "welcome-story": deque(
        [
            {"id": "welcome-comment-2", "body": "컵부터 시작한 선택이 좋아 보여요. 저도 작은 것부터 해볼게요.", "created_at": "오늘"},
        ],
        maxlen=100,
    ),
}


def public_community_post(post: dict[str, Any]) -> dict[str, Any]:
    return {key: post[key] for key in ("id", "title", "body", "created_at", "photo") if key in post} | {"can_delete": bool(post.get("delete_hash"))}


def find_community_post(post_id: str) -> dict[str, Any]:
    for post in (*COMMUNITY_POSTS, *COMMUNITY_SEED):
        if post["id"] == post_id:
            return post
    raise ValueError("게시글을 찾지 못했어요.")


def public_community_comment(comment: dict[str, Any]) -> dict[str, Any]:
    return {key: comment[key] for key in ("id", "body", "created_at")}


def community_thread(post_id: str) -> dict[str, Any]:
    post = find_community_post(post_id)
    comments = COMMUNITY_COMMENTS.get(post_id, ())
    return {"post": public_community_post(post), "comments": [public_community_comment(comment) for comment in comments], "ephemeral": True}


def community_comment(post_id: str, payload: Any) -> dict[str, Any]:
    find_community_post(post_id)
    if not isinstance(payload, dict):
        raise ValueError("댓글 형식을 확인해주세요.")
    body = "\n".join(line.strip() for line in str(payload.get("body", "")).splitlines() if line.strip())
    if not 2 <= len(body) <= 300:
        raise ValueError("댓글은 2~300자로 적어주세요.")
    comment = {
        "id": hashlib.sha256(f"{time.time_ns()}:{post_id}:{body}".encode()).hexdigest()[:12],
        "body": body,
        "created_at": "방금 전",
    }
    COMMUNITY_COMMENTS.setdefault(post_id, deque(maxlen=100)).appendleft(comment)
    return public_community_comment(comment)


def community_post(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("게시글 형식을 확인해주세요.")
    title = " ".join(str(payload.get("title", "")).split())
    body = "\n".join(line.strip() for line in str(payload.get("body", "")).splitlines() if line.strip())
    password = str(payload.get("delete_password", ""))
    if not 2 <= len(title) <= 60:
        raise ValueError("제목은 2~60자로 적어주세요.")
    if not 5 <= len(body) <= 600:
        raise ValueError("내용은 5~600자로 적어주세요.")
    if not 4 <= len(password) <= 64:
        raise ValueError("삭제용 비밀번호는 4~64자로 설정해주세요.")
    photo = payload.get("photo")
    if photo is not None:
        if not isinstance(photo, str) or not photo.startswith("data:image/jpeg;base64,") or len(photo) > 1_100_000:
            raise ValueError("첨부 사진 형식을 확인해주세요.")
        try:
            if len(base64.b64decode(photo.split(",", 1)[1], validate=True)) > 800_000:
                raise ValueError("첨부 사진은 더 작은 크기로 올려주세요.")
        except (ValueError, binascii.Error):
            raise ValueError("첨부 사진 형식을 확인해주세요.")
    salt = os.urandom(16)
    password_hash = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1).hex()
    post = {"id": hashlib.sha256(f"{time.time_ns()}:{title}".encode()).hexdigest()[:12], "title": title, "body": body, "created_at": "방금 전", "delete_salt": salt.hex(), "delete_hash": password_hash}
    if photo:
        post["photo"] = photo
    COMMUNITY_POSTS.appendleft(post)
    return public_community_post(post)


def delete_community_post(post_id: str, password: str) -> None:
    if not 4 <= len(password) <= 64:
        raise ValueError("삭제용 비밀번호를 다시 입력해주세요.")
    for post in COMMUNITY_POSTS:
        if post["id"] != post_id:
            continue
        candidate = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(post["delete_salt"]), n=2**14, r=8, p=1).hex()
        if not hmac.compare_digest(candidate, post["delete_hash"]):
            raise ValueError("삭제용 비밀번호가 일치하지 않아요.")
        COMMUNITY_POSTS.remove(post)
        COMMUNITY_COMMENTS.pop(post_id, None)
        return
    raise ValueError("삭제할 게시글을 찾지 못했어요.")


def rate_allowed(client: str, limit: int = 40, window: int = 3600) -> bool:
    now = time.time()
    bucket = RATE_BUCKETS[client]
    while bucket and bucket[0] < now - window:
        bucket.popleft()
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    return True


app = FastAPI(title="오늘의 자리", docs_url=None, redoc_url=None)


@app.middleware("http")
async def security_and_limits(request: Request, call_next):
    if request.method in {"POST", "DELETE"}:
        if int(request.headers.get("content-length", "0") or 0) > MAX_BODY_BYTES:
            return JSONResponse({"error": "요청 용량이 너무 큽니다."}, status_code=413)
        if not rate_allowed(request.client.host if request.client else "unknown"):
            return JSONResponse({"error": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."}, status_code=429)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=()"
    return response


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return JSONResponse({"error": str(exc)}, status_code=400)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError):
    # OpenAI 오류 문자열에는 키가 포함되지 않으므로 사용자가 연결 문제를
    # 직접 해결할 수 있도록 모델명/상태 코드/짧은 원인을 전달한다.
    return JSONResponse({"error": str(exc)}, status_code=502)


@app.exception_handler(Exception)
async def exception_handler(_: Request, exc: Exception):
    error_id = hashlib.sha256(f"{time.time()}:{exc}".encode()).hexdigest()[:8]
    print(f"ERROR {error_id}: {exc}")
    return JSONResponse({"error": "처리 중 오류가 발생했습니다.", "error_id": error_id}, status_code=500)


@app.get("/health")
def health() -> dict[str, Any]:
    repository = get_knowledge_repository()
    return {
        "status": "ok",
        "service": "오늘의 자리",
        "openai_configured": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "grounded_llm_enabled": env_enabled("ENABLE_GROUNDED_GUIDE_LLM"),
        "supabase_configured": bool(os.getenv("SUPABASE_URL", "").strip() and get_supabase_server_key()[0]),
        "knowledge_release": repository.release_key,
        "model": OPENAI_MODEL,
    }


@app.post("/api/analyze")
async def analyze(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
        return analyze_images(str(payload.get("mode", "")), payload.get("images", []), payload.get("context"))
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception:
        return JSONResponse(status_code=503, content={"error": "AI 분석을 완료하지 못했어요. 직접 선택해서 계속할 수 있어요."})


@app.post("/api/cleaning-guide")
async def cleaning_guide_endpoint(request: Request) -> dict[str, Any]:
    return create_cleaning_guide(await request.json())


@app.get("/api/community/posts")
def list_community_posts() -> dict[str, Any]:
    return {"posts": [*(public_community_post(post) for post in COMMUNITY_POSTS), *COMMUNITY_SEED], "ephemeral": True}


@app.post("/api/community/posts")
async def create_community_post(request: Request) -> dict[str, Any]:
    return {"post": community_post(await request.json()), "ephemeral": True}


@app.get("/api/community/posts/{post_id}")
def get_community_thread(post_id: str) -> dict[str, Any]:
    return community_thread(post_id)


@app.post("/api/community/posts/{post_id}/comments")
async def create_community_comment(post_id: str, request: Request) -> dict[str, Any]:
    return {"comment": community_comment(post_id, await request.json()), "ephemeral": True}


@app.delete("/api/community/posts/{post_id}")
async def delete_community_post_endpoint(post_id: str, request: Request) -> dict[str, Any]:
    payload = await request.json()
    delete_community_post(post_id, str(payload.get("delete_password", "")) if isinstance(payload, dict) else "")
    return {"deleted": post_id, "ephemeral": True}


app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")


@app.get("/{path:path}")
def spa(path: str):
    target = (STATIC_DIR / path).resolve() if path else STATIC_DIR / "index.html"
    if STATIC_DIR.resolve() not in target.parents or not target.is_file():
        target = STATIC_DIR / "index.html"
    return FileResponse(target)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
