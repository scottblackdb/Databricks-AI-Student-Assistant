"""FastAPI app exposing the myUNT student-assistant endpoints."""
import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
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
from .students import STUDENTS, require_student

logger = logging.getLogger(__name__)

app = FastAPI(title="myUNT Student Assistant API")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
_STATIC_INDEX = _STATIC_DIR / "index.html"


@app.exception_handler(db.DatabricksError)
async def databricks_error_handler(_request, exc: db.DatabricksError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


def _new_conversation_id(existing: str | None) -> str:
    return existing if existing else str(uuid.uuid4())


@app.get("/api/health")
async def health() -> dict[str, object]:
    # In a Databricks App there is no PAT; auth comes from the service principal (OAuth).
    auth_mode = "pat" if settings.databricks_token else "service-principal-oauth"
    return {
        "ok": True,
        "auth_mode": auth_mode,
        "token_configured": bool(settings.databricks_token),
    }


@app.get("/api/students", response_model=list[StudentOut])
async def list_students() -> list[StudentOut]:
    return [StudentOut(**s) for s in STUDENTS]


def _validate_student_id(student_id: str) -> None:
    try:
        require_student(student_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/schedule/today", response_model=TextResponse)
async def schedule_today(req: ScheduleRequest) -> TextResponse:
    _validate_student_id(req.student_id)
    text = await db.fetch_todays_schedule(req.student_id)
    return TextResponse(text=text)


@app.post("/api/missing-assignments", response_model=AgentResponse)
async def missing_assignments(req: MissingAssignmentsRequest) -> AgentResponse:
    _validate_student_id(req.student_id)
    conversation_id = _new_conversation_id(req.conversation_id)
    text = await db.fetch_missing_assignments(req.student_id, conversation_id)
    return AgentResponse(text=text, conversation_id=conversation_id)


@app.post("/api/agent/ask", response_model=AgentResponse)
async def agent_ask(req: AskRequest) -> AgentResponse:
    _validate_student_id(req.student_id)
    conversation_id = _new_conversation_id(req.conversation_id)
    prior = [(t.is_from_user, t.text) for t in req.prior_turns]
    text = await db.ask_question(req.student_id, req.message, prior, conversation_id)
    return AgentResponse(text=text, conversation_id=conversation_id)


@app.on_event("startup")
async def _log_static_status() -> None:
    if _STATIC_INDEX.is_file():
        logger.info("Serving React UI from %s", _STATIC_DIR)
    else:
        logger.warning(
            "Frontend not found at %s — run build_frontend.sh and redeploy. "
            "Only /api/* routes are available until static/ is present.",
            _STATIC_INDEX,
        )


def _missing_frontend_html() -> str:
    return """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>myUNT — frontend not deployed</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem;">
  <h1>Frontend not deployed</h1>
  <p>The React UI was not included in this deployment. Build it locally, then redeploy:</p>
  <pre style="background: #f4f4f4; padding: 1rem; border-radius: 8px;">bash build_frontend.sh</pre>
  <p>Ensure <code>backend/static/</code> is uploaded with the app (Git deploy requires committing that folder).</p>
  <p>API health check: <a href="/api/health">/api/health</a></p>
</body>
</html>"""


# Serve the built React frontend (frontend/dist copied to backend/static by build_frontend.sh).
# Mounted last so the /api/* routes above take precedence. In local dev the Vite server on
# :5173 serves the UI instead, so this directory may not exist.
if _STATIC_INDEX.is_file():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
else:

    @app.get("/")
    async def missing_frontend() -> HTMLResponse:
        return HTMLResponse(_missing_frontend_html(), status_code=503)
