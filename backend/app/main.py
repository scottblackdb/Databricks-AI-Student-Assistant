"""FastAPI app exposing the myUNT student-assistant endpoints."""
import uuid
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import databricks_client as db
from .config import get_settings
from .models import (
    AgentResponse,
    AskRequest,
    MissingAssignmentsRequest,
    ScheduleRequest,
    StudentOut,
    TextResponse,
)
from .students import STUDENTS

app = FastAPI(title="myUNT Student Assistant API")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(db.DatabricksError)
async def databricks_error_handler(_request, exc: db.DatabricksError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


def _new_conversation_id(existing: str | None) -> str:
    return existing if existing else str(uuid.uuid4())


@app.get("/api/health")
async def health() -> dict[str, object]:
    # In a Databricks App there is no PAT; auth comes from the service principal (OAuth).
    auth_mode = "pat" if settings.databricks_token else "service-principal-oauth"
    return {"ok": True, "auth_mode": auth_mode}


@app.get("/api/students", response_model=list[StudentOut])
async def list_students() -> list[StudentOut]:
    return [StudentOut(**s) for s in STUDENTS]


@app.post("/api/schedule/today", response_model=TextResponse)
async def schedule_today(req: ScheduleRequest) -> TextResponse:
    text = await db.fetch_todays_schedule(req.student_id)
    return TextResponse(text=text)


@app.post("/api/missing-assignments", response_model=AgentResponse)
async def missing_assignments(req: MissingAssignmentsRequest) -> AgentResponse:
    conversation_id = _new_conversation_id(req.conversation_id)
    text = await db.fetch_missing_assignments(req.student_id, conversation_id)
    return AgentResponse(text=text, conversation_id=conversation_id)


@app.post("/api/agent/ask", response_model=AgentResponse)
async def agent_ask(req: AskRequest) -> AgentResponse:
    conversation_id = _new_conversation_id(req.conversation_id)
    prior = [(t.is_from_user, t.text) for t in req.prior_turns]
    text = await db.ask_question(req.student_id, req.message, prior, conversation_id)
    return AgentResponse(text=text, conversation_id=conversation_id)


# Serve the built React frontend (frontend/dist copied to backend/static by build_frontend.sh).
# Mounted last so the /api/* routes above take precedence. In local dev the Vite server on
# :5173 serves the UI instead, so this directory may not exist.
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
