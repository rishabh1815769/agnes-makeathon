import asyncio
import json
import os
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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


class StreamChunk(BaseModel):
    type: str
    session_id: str | None = None
    text: str | None = None
    message: str | None = None
    structured_output: dict[str, Any] | list[Any] | None = None
    detail: str | None = None


class SupplierSummary(BaseModel):
    Id: int
    Name: str
    ProductCount: int


class GroupSummary(BaseModel):
    SKU: str
    HasBOM: bool
    BOMComponentCount: int
    SupplierProductCount: int


class CompanySummary(BaseModel):
    Id: int
    Name: str
    ProductCount: int
    SupplierCount: int
    SupplierNames: list[str] = Field(default_factory=list)


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


async def _get_structured_output(
    *,
    user_id: str,
    session_id: str,
    output_key: str = "agnes_structured_output",
) -> dict[str, Any] | list[Any] | None:
    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if not session or not hasattr(session, "state"):
        return None
    value = session.state.get(output_key)
    jsonable = _to_jsonable(value)
    if isinstance(jsonable, (dict, list)):
        return jsonable
    return None


def _stringify_structured_output(value: dict[str, Any] | list[Any] | None) -> str:
    if value is None:
        return ""
    return json.dumps(value, indent=2)


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
                    p.material_name
                FROM Product p
                LEFT JOIN Company c ON c.Id = p.CompanyId
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


@app.get("/api/suppliers", response_model=list[SupplierSummary])
async def list_suppliers(limit: int = Query(default=500, ge=1, le=2000)) -> list[SupplierSummary]:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail="Suppliers database file is missing.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT
                    s.Id,
                    s.Name,
                    COUNT(DISTINCT sp.ProductId) AS ProductCount
                FROM Supplier s
                LEFT JOIN Supplier_Product sp ON sp.SupplierId = s.Id
                GROUP BY s.Id, s.Name
                ORDER BY s.Name
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [SupplierSummary(**dict(row)) for row in rows]
    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to read suppliers from database.",
        ) from exc


@app.get("/api/groups", response_model=list[GroupSummary])
async def list_groups(limit: int = Query(default=500, ge=1, le=2000)) -> list[GroupSummary]:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail="Groups database file is missing.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT
                    p.SKU,
                    CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM BOM b
                            WHERE b.ProducedProductId = p.Id
                        ) THEN 1
                        ELSE 0
                    END AS HasBOM,
                    (
                        SELECT COUNT(*)
                        FROM BOM_Component bc
                        INNER JOIN BOM b2 ON b2.Id = bc.BOMId
                        WHERE b2.ProducedProductId = p.Id
                    ) AS BOMComponentCount,
                    (
                        SELECT COUNT(*)
                        FROM Supplier_Product sp
                        WHERE sp.ProductId = p.Id
                    ) AS SupplierProductCount
                FROM Product p
                ORDER BY p.SKU
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [GroupSummary(**dict(row)) for row in rows]
    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to read groups from database.",
        ) from exc


@app.get("/api/companies", response_model=list[CompanySummary])
async def list_companies(limit: int = Query(default=500, ge=1, le=2000)) -> list[CompanySummary]:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail="Companies database file is missing.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT
                    c.Id,
                    c.Name,
                    COUNT(DISTINCT p.Id) AS ProductCount,
                    COUNT(DISTINCT s.Id) AS SupplierCount,
                    GROUP_CONCAT(DISTINCT s.Name) AS SupplierNamesCsv
                FROM Company c
                LEFT JOIN Product p ON p.CompanyId = c.Id
                LEFT JOIN Supplier_Product sp ON sp.ProductId = p.Id
                LEFT JOIN Supplier s ON s.Id = sp.SupplierId
                GROUP BY c.Id, c.Name
                ORDER BY c.Name
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        result: list[CompanySummary] = []
        for row in rows:
            row_data = dict(row)
            raw_suppliers = row_data.pop("SupplierNamesCsv", None)
            if isinstance(raw_suppliers, str) and raw_suppliers.strip():
                supplier_names = sorted({name.strip() for name in raw_suppliers.split(",") if name.strip()})
            else:
                supplier_names = []

            result.append(
                CompanySummary(
                    **row_data,
                    SupplierNames=supplier_names,
                )
            )

        return result
    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to read companies from database.",
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

    structured_output = await _get_structured_output(
        user_id=request.user_id,
        session_id=session_id,
    )

    if not final_text and structured_output is not None:
        final_text = _stringify_structured_output(structured_output)

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
        structured_output=structured_output,
        raw_output=raw_output,
    )


@app.post("/api/agents/agnes/chat/stream")
async def agnes_chat_stream(request: ChatRequest) -> StreamingResponse:
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

    async def event_stream() -> Any:
        raw_output: list[dict[str, Any]] = []
        final_text = ""
        streamed_text = ""

        yield f"data: {StreamChunk(type='session', session_id=session_id).model_dump_json()}\n\n"

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

                delta = text
                if text.startswith(streamed_text):
                    delta = text[len(streamed_text) :]

                if delta:
                    streamed_text += delta
                    yield f"data: {StreamChunk(type='delta', text=delta).model_dump_json()}\n\n"

                if hasattr(event, "is_final_response") and event.is_final_response():
                    final_text = text

            structured_output = await _get_structured_output(
                user_id=request.user_id,
                session_id=session_id,
            )

            if not final_text and structured_output is not None:
                final_text = _stringify_structured_output(structured_output)

            if not final_text:
                # Fallback to the most recent textual payload if final marker is absent.
                for item in reversed(raw_output):
                    payload = item.get("content", {})
                    parts = payload.get("parts", []) if isinstance(payload, dict) else []
                    texts = [
                        p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")
                    ]
                    if texts:
                        final_text = "\n".join(texts).strip()
                        break

            if not final_text:
                yield (
                    "data: "
                    f"{StreamChunk(type='error', detail='Agent returned an empty response.').model_dump_json()}\n\n"
                )
                return

            yield (
                "data: "
                f"{StreamChunk(type='final', message=final_text, structured_output=structured_output).model_dump_json()}\n\n"
            )
        except ValueError as exc:
            if "No API key was provided" in str(exc):
                yield (
                    "data: "
                    f"{StreamChunk(type='error', detail='ADK API key is not configured on the backend.').model_dump_json()}\n\n"
                )
                return
            yield f"data: {StreamChunk(type='error', detail=str(exc)).model_dump_json()}\n\n"
        except Exception as exc:
            yield f"data: {StreamChunk(type='error', detail=str(exc)).model_dump_json()}\n\n"
        finally:
            await asyncio.sleep(0)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
