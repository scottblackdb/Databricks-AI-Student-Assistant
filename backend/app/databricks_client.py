"""Client for Databricks REST APIs.

Ports two iOS services:
  * DatabricksSQLService     -> Statement Execution API (today's schedule)
  * MissingAssignmentsService -> model serving /invocations (agent chat)

The token is read server-side from settings; it never reaches the browser.
"""
import asyncio
import json
from typing import Any

import httpx

from .config import get_settings


class DatabricksError(Exception):
    """Raised for any Databricks call failure; carries an HTTP-ish status for the API layer."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


_BASE_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}


def _sql_string_literal(value: str) -> str:
    """Escape a value for use inside a SQL single-quoted string literal."""
    return value.replace("'", "''")


def _resolve_host_and_headers() -> tuple[str, dict[str, str]]:
    """Resolve the workspace host and auth headers.

    Local dev: a PAT in DATABRICKS_TOKEN (backend/.env).
    Databricks App: no token — fall back to the app's service-principal OAuth via
    the Databricks SDK, which reads the auto-injected DATABRICKS_HOST and
    DATABRICKS_CLIENT_ID/DATABRICKS_CLIENT_SECRET.
    """
    settings = get_settings()

    if settings.databricks_token:
        host = settings.databricks_host.rstrip("/")
        if not host:
            raise DatabricksError("DATABRICKS_HOST is not set.", status_code=500)
        return host, {**_BASE_HEADERS, "Authorization": f"Bearer {settings.databricks_token}"}

    try:
        from databricks.sdk.core import Config
    except ImportError as exc:  # pragma: no cover - only when sdk missing
        raise DatabricksError(
            "No DATABRICKS_TOKEN set and databricks-sdk is not installed.",
            status_code=500,
        ) from exc

    cfg = Config(host=settings.databricks_host or None)
    host = (cfg.host or "").rstrip("/")
    if not host:
        raise DatabricksError("Could not resolve the Databricks host.", status_code=500)
    return host, {**_BASE_HEADERS, **cfg.authenticate()}


# --------------------------------------------------------------------------- #
# SQL Statement Execution API
# --------------------------------------------------------------------------- #


async def _execute_statement(statement: str) -> str:
    """Execute SQL and return the result as a display string (ported from DatabricksSQLService)."""
    settings = get_settings()
    if not settings.warehouse_id:
        raise DatabricksError("WAREHOUSE_ID is not set.", status_code=500)
    host, headers = _resolve_host_and_headers()
    statements_url = f"{host}/api/2.0/sql/statements"
    body = {"warehouse_id": settings.warehouse_id, "statement": statement}

    async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
        resp = await client.post(statements_url, headers=headers, json=body)
        if resp.status_code != 200:
            raise DatabricksError(f"Server error {resp.status_code}: {resp.text}", status_code=502)
        data = resp.json()

        state = (data.get("status") or {}).get("state")
        statement_id = data.get("statement_id")

        if state == "SUCCEEDED" and "result" in data:
            return _format_result(data["result"], data.get("manifest"))
        if state in ("PENDING", "RUNNING") and statement_id:
            return await _poll_for_result(client, statements_url, headers, statement_id)
        if state == "FAILED":
            message = (data.get("status") or {}).get("description") or "Statement failed."
            raise DatabricksError(message, status_code=502)
        raise DatabricksError("Could not parse response.", status_code=502)


async def _poll_for_result(
    client: httpx.AsyncClient, statements_url: str, headers: dict[str, str], statement_id: str
) -> str:
    """Poll GET /sql/statements/{id} until SUCCEEDED (ported from pollForResult)."""
    url = f"{statements_url}/{statement_id}"
    for _ in range(60):
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            raise DatabricksError(f"Server error {resp.status_code}: {resp.text}", status_code=502)
        data = resp.json()
        state = (data.get("status") or {}).get("state")
        if state == "SUCCEEDED" and "result" in data:
            return _format_result(data["result"], data.get("manifest"))
        if state == "FAILED":
            message = (data.get("status") or {}).get("description") or "Statement failed."
            raise DatabricksError(message, status_code=502)
        await asyncio.sleep(0.5)
    raise DatabricksError("Request timed out.", status_code=504)


def _format_result(result: dict[str, Any], manifest: dict[str, Any] | None) -> str:
    """Turn API result (data_array + manifest) into a readable string (ported from formatResult)."""
    data_array = result.get("data_array")
    if not isinstance(data_array, list):
        return json.dumps(result)

    columns = None
    if manifest:
        schema = manifest.get("schema") or {}
        columns = schema.get("columns")

    if not columns:
        if not data_array:
            return json.dumps(result)
        if len(data_array) == 1 and len(data_array[0]) == 1 and isinstance(data_array[0][0], str):
            return data_array[0][0]
        return json.dumps(data_array)

    column_names = [c.get("name") for c in columns if c.get("name")]
    rows: list[dict[str, Any]] = []
    for row in data_array:
        rows.append({column_names[i]: val for i, val in enumerate(row) if i < len(column_names)})

    if len(rows) == 1 and len(rows[0]) == 1:
        value = next(iter(rows[0].values()))
        return value if isinstance(value, str) else json.dumps(value)
    return json.dumps(rows)


_NAME_KEYS = [
    "name", "class_name", "title", "course", "subject", "event_name",
    "course_name", "class", "display_name", "label", "event_title", "course_title",
]


def _schedule_items(value: Any) -> list[tuple[str, str | None]]:
    """Extract (name, meeting_time) from schedule JSON of various shapes (ported from scheduleItems)."""
    if isinstance(value, list) and all(isinstance(v, str) for v in value):
        return [(v, None) for v in value if v]

    items: list[dict[str, Any]] = []
    if isinstance(value, list):
        items = [v for v in value if isinstance(v, dict)]
    elif isinstance(value, dict):
        # Prefer first nested list of dicts, then first nested dict.
        for v in value.values():
            if isinstance(v, list) and any(isinstance(x, dict) for x in v):
                items = [x for x in v if isinstance(x, dict)]
                break
        if not items:
            nested_dicts = [v for v in value.values() if isinstance(v, dict)]
            if nested_dicts:
                items = nested_dicts
        if not items:
            for v in value.values():
                nested = _schedule_items(v)
                if nested:
                    return nested

    out: list[tuple[str, str | None]] = []
    for item in items:
        name = None
        for key in _NAME_KEYS:
            val = item.get(key)
            if isinstance(val, str) and val:
                name = val
                break
        if name is None:
            for val in item.values():
                if isinstance(val, str) and val and val != "null" and not val.startswith(("{", "[")):
                    name = val
                    break
        if not name:
            continue
        meeting_time = item.get("meeting_time")
        if isinstance(meeting_time, str):
            meeting_time = meeting_time.strip() or None
        else:
            meeting_time = None
        out.append((name, meeting_time))
    return out


async def fetch_todays_schedule(student_id: str) -> str:
    """Run today's-schedule query and format it (ported from fetchTodaysSchedule)."""
    statement = f"select unt.bronze.today_classes('{_sql_string_literal(student_id)}')"
    text = (await _execute_statement(statement)).strip()

    if text in ("", "[]", "{}", "null", "No data"):
        return "No Classes Today"

    try:
        parsed: Any = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return text

    # Column may be a double-encoded JSON string; parse again.
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except (json.JSONDecodeError, ValueError):
            pass

    items = _schedule_items(parsed)
    if not items:
        return "No Classes Today"

    lines = []
    for name, meeting_time in items:
        if meeting_time:
            lines.append(f"• {name} — {meeting_time}  \n")
        else:
            lines.append(f"• {name}  \n")
    return "**Today's Classes**\n\n" + "".join(lines)


# --------------------------------------------------------------------------- #
# Agent serving endpoint (/invocations)
# --------------------------------------------------------------------------- #


def _parse_invocations_response(data: Any) -> str | None:
    """Extract assistant text from the agent /invocations response (ported from parseInvocationsResponse)."""
    if not isinstance(data, dict):
        if isinstance(data, str):
            t = data.strip()
            return t or None
        return None

    # Agent format: output array of { type: "message", role: "assistant", content: [{type: "output_text", text}] }
    output = data.get("output")
    if isinstance(output, list):
        assistant_texts: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            if item.get("type") != "message" or item.get("role") != "assistant":
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            blocks = [
                b["text"].strip()
                for b in content
                if isinstance(b, dict) and b.get("type") == "output_text" and isinstance(b.get("text"), str) and b["text"]
            ]
            joined = "\n".join(blocks)
            if joined:
                assistant_texts.append(joined)
        if assistant_texts:
            return assistant_texts[-1]

    # Fallback: databricks_output.trace.info.response_preview
    preview = (
        ((data.get("databricks_output") or {}).get("trace") or {}).get("info") or {}
    ).get("response_preview")
    if isinstance(preview, str) and preview.strip():
        return preview.strip()

    # predictions: ["string"] or [{...}]
    predictions = data.get("predictions")
    if isinstance(predictions, list) and predictions:
        first = predictions[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
        if isinstance(first, dict):
            candidates = first.get("candidates")
            if isinstance(candidates, list) and candidates:
                content = candidates[0].get("content")
                if isinstance(content, str) and content.strip():
                    return content.strip()
            for key in ("content", "text", "output", "message"):
                val = first.get(key)
                if isinstance(val, str) and val:
                    return val.strip()

    for key in ("content", "result", "output", "message", "response", "text"):
        val = data.get(key)
        if isinstance(val, str) and val:
            return val.strip()
    return None


async def _send_invocations(input_messages: list[dict[str, str]], conversation_id: str, user_id: str = "app-user") -> str:
    """POST to the agent /invocations endpoint and return the assistant text."""
    settings = get_settings()
    if not settings.serving_endpoint:
        raise DatabricksError("SERVING_ENDPOINT is not set.", status_code=500)
    host, headers = _resolve_host_and_headers()
    invocations_url = f"{host}/serving-endpoints/{settings.serving_endpoint}/invocations"
    body = {
        "input": input_messages,
        "databricks_options": {"conversation_id": conversation_id, "return_trace": True},
        "context": {"conversation_id": conversation_id, "user_id": user_id},
    }
    async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
        resp = await client.post(invocations_url, headers=headers, json=body)
        if resp.status_code != 200:
            raise DatabricksError(f"Server error {resp.status_code}: {resp.text}", status_code=502)
        try:
            data = resp.json()
        except json.JSONDecodeError:
            data = resp.text

    text = _parse_invocations_response(data)
    if not text:
        preview = (resp.text or "")[:500]
        raise DatabricksError(
            f"The server returned a response we couldn't parse. Preview: {preview}",
            status_code=502,
        )
    return text


async def fetch_missing_assignments(student_id: str, conversation_id: str) -> str:
    """Ask the agent for missing assignments (ported from fetchMissingAssignments)."""
    user_message = (
        f"{_student_prefix(student_id)}what are my missing assignments? "
        "Return the list of assignments in JSON format."
    )
    return await _send_invocations([{"role": "user", "content": user_message}], conversation_id)


def _student_prefix(student_id: str) -> str:
    return f"In regards to student_id {student_id}, "


def _student_user_message(student_id: str, message: str) -> str:
    return f"{_student_prefix(student_id)}User question: {message}"


async def ask_question(
    student_id: str,
    message: str,
    prior_turns: list[tuple[bool, str]],
    conversation_id: str,
) -> str:
    """Multi-turn agent question (ported from askQuestion/makePromptInvocationsRequest)."""
    input_messages: list[dict[str, str]] = []
    for is_from_user, text in prior_turns:
        if not text.strip():
            continue
        if is_from_user:
            input_messages.append({"role": "user", "content": _student_user_message(student_id, text)})
        else:
            input_messages.append({"role": "assistant", "content": text})
    input_messages.append({"role": "user", "content": _student_user_message(student_id, message)})
    return await _send_invocations(input_messages, conversation_id)
