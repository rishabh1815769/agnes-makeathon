import json
import os
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agnes.agent import root_agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

APP_NAME = "agnes_api"
DEFAULT_USER_ID = "agnes-web-user"
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "database" / "db.sqlite"


def _load_local_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


_load_local_env_file(BASE_DIR / ".env")
_load_local_env_file(BASE_DIR / "agnes" / ".env")
if os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

session_service = InMemorySessionService()
runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=session_service)

app = FastAPI(title="Agnes API", version="0.1.0")

allowed_origins = [os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: str | None = None
    user_id: str = DEFAULT_USER_ID


class ChatResponse(BaseModel):
    session_id: str
    message: str
    structured_output: dict[str, Any] | list[Any] | None = None
    raw_output: list[dict[str, Any]]


class ProductSummary(BaseModel):
    Id: int
    SKU: str
    CompanyId: int | None = None
    CompanyName: str | None = None
    Type: str | None = None
    material_name: str | None = None
    SupplierCount: int


def _part_text(part: Any) -> str:
    text = getattr(part, "text", None)
    if isinstance(text, str):
        return text
    return ""


def _to_jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    return value


async def _ensure_session(user_id: str, session_id: str) -> None:
    try:
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
        )
    except Exception:
        # Session may already exist; that's okay for continued chats.
        return


def _parse_structured_output(text: str) -> dict[str, Any] | list[Any] | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    if not (cleaned.startswith("{") or cleaned.startswith("[")):
        return None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, (dict, list)):
        return parsed
    return None


def _adk_credentials_configured() -> bool:
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        return True

    use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not use_vertex:
        return False

    return bool(os.getenv("GOOGLE_CLOUD_PROJECT") and os.getenv("GOOGLE_CLOUD_LOCATION"))


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/products", response_model=list[ProductSummary])
async def list_products(limit: int = Query(default=500, ge=1, le=2000)) -> list[ProductSummary]:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail="Products database file is missing.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT
                    p.Id,
                    p.SKU,
                    p.CompanyId,
                    c.Name AS CompanyName,
                    p.Type,
                    p.material_name,
                    COUNT(DISTINCT sp.SupplierId) AS SupplierCount
                FROM Product p
                LEFT JOIN Company c ON c.Id = p.CompanyId
                LEFT JOIN Supplier_Product sp ON sp.ProductId = p.Id
                GROUP BY p.Id, p.SKU, p.CompanyId, c.Name, p.Type, p.material_name
                ORDER BY p.Id
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [ProductSummary(**dict(row)) for row in rows]
    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to read products from database.",
        ) from exc


@app.post("/api/agents/agnes/chat", response_model=ChatResponse)
async def agnes_chat(request: ChatRequest) -> ChatResponse:
    prompt = request.message.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if not _adk_credentials_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "ADK credentials are not configured. Set GOOGLE_API_KEY or configure "
                "Vertex AI credentials (GOOGLE_GENAI_USE_VERTEXAI, GOOGLE_CLOUD_PROJECT, "
                "GOOGLE_CLOUD_LOCATION)."
            ),
        )

    session_id = request.session_id or str(uuid.uuid4())
    await _ensure_session(user_id=request.user_id, session_id=session_id)

    raw_output: list[dict[str, Any]] = []
    final_text = ""

    try:
        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=session_id,
            new_message=types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)],
            ),
        ):
            event_json = _to_jsonable(event)
            if isinstance(event_json, dict):
                raw_output.append(event_json)
            else:
                raw_output.append({"event": str(event_json)})

            content = getattr(event, "content", None)
            if not content or not getattr(content, "parts", None):
                continue

            text = "\n".join(filter(None, (_part_text(part) for part in content.parts))).strip()
            if not text:
                continue

            if hasattr(event, "is_final_response") and event.is_final_response():
                final_text = text
    except ValueError as exc:
        if "No API key was provided" in str(exc):
            raise HTTPException(
                status_code=503,
                detail="ADK API key is not configured on the backend.",
            ) from exc
        raise

    if not final_text:
        # Fallback to the most recent textual payload if final marker is absent.
        for item in reversed(raw_output):
            payload = item.get("content", {})
            parts = payload.get("parts", []) if isinstance(payload, dict) else []
            texts = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")]
            if texts:
                final_text = "\n".join(texts).strip()
                break

    if not final_text:
        raise HTTPException(status_code=502, detail="Agent returned an empty response.")

    return ChatResponse(
        session_id=session_id,
        message=final_text,
        structured_output=_parse_structured_output(final_text),
        raw_output=raw_output,
    )
