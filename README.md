# Databricks AI Student Assistant (myUNT)

A React + FastAPI port of the **myUNT** iOS app — a chat-based student assistant
backed by Databricks. It greets the student, auto-loads today's class schedule,
answers questions via a Databricks agent serving endpoint, and surfaces missing
assignments through a notification bell.

```
┌──────────────┐      /api/*       ┌──────────────┐   Bearer token   ┌──────────────┐
│ React (Vite) │ ───────────────▶ │   FastAPI     │ ───────────────▶ │  Databricks  │
│  frontend    │ ◀─────────────── │   backend     │ ◀─────────────── │ (SQL + agent)│
└──────────────┘                   └──────────────┘                   └──────────────┘
```

The Databricks personal access token lives **only on the backend** (in
`backend/.env`) and is never sent to the browser.

## Features (ported from the iOS app)

- **Chat UI** with user/assistant bubbles, Markdown rendering, and structured
  rendering of ```` ```json ```` blocks returned by the agent.
- **Today's schedule** auto-loaded on launch via the Databricks SQL Statement
  Execution API (`unt.bronze.today_classes(<student_id>)`).
- **Agent chat** via a Databricks model serving `/invocations` endpoint, with
  multi-turn history and a per-session conversation id.
- **Missing assignments** panel (the bell) with a badge count, fetched on load.
- **Settings** to switch the active student (Kimberly Dudley, Zachary Hicks,
  Michael Brown).
- **Prompt menu** (hamburger) with preset prompts like "Recommend Me Events".

## Project layout

```
backend/    FastAPI app (proxies all Databricks calls) — also the Databricks App root
  app/
    main.py               FastAPI routes + static UI mount
    config.py             env-based settings
    databricks_client.py  SQL + agent logic; PAT or service-principal OAuth
    students.py           selectable students
    models.py             request/response schemas
  app.yaml              Databricks App manifest
  serve.py              App entrypoint (binds 0.0.0.0:$DATABRICKS_APP_PORT)
  requirements.txt
  .env.example
  static/              built React UI, populated by build_frontend.sh (gitignored)
frontend/   Vite + React + TypeScript SPA
  src/
    App.tsx               main screen + state
    api.ts                backend client
    messageFormatting.ts  json-fence parsing, link/key helpers
    components/
dev.sh             run backend + frontend together (local dev)
build_frontend.sh  build the UI into backend/static (for deployment)
```

## Running it

### Both at once (local dev)

```bash
bash dev.sh
```

Starts the backend on `:8000` and the Vite dev server on `:5173`; Ctrl-C stops
both. (Or run the two steps below in separate terminals.)

### 1. Backend

```bash
cd backend
cp .env.example .env          # then set DATABRICKS_TOKEN
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

The backend serves on `http://localhost:8000`. Check `GET /api/health` —
`token_configured` should be `true` once `.env` has a token (`auth_mode` is
`pat` locally, or `service-principal-oauth` in a Databricks App).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to the backend on port 8000
(see `vite.config.ts`), so no CORS config is needed in development.

## Deploying as a Databricks App

The app ships as a **single web process**: FastAPI serves the `/api/*` routes
*and* the built React UI as static files (no Vite, no CORS in production). The
`backend/` directory is the app source root.

It authenticates with the app's **service principal** (OAuth) — the Apps runtime
injects `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, and `DATABRICKS_CLIENT_SECRET`,
so no PAT is needed. (Locally, `DATABRICKS_TOKEN` in `backend/.env` is used
instead; the backend picks whichever is present.)

**1. Build the UI into the backend:**

```bash
bash build_frontend.sh      # builds frontend/dist -> backend/static
```

**2. Deploy the `backend/` folder.** It contains everything the App needs:

```
backend/
  app.yaml            # command: python serve.py  + WAREHOUSE_ID / SERVING_ENDPOINT
  serve.py            # binds 0.0.0.0:$DATABRICKS_APP_PORT
  requirements.txt    # auto-installed (incl. databricks-sdk)
  app/                # FastAPI code
  static/             # built React UI (from step 1)
```

Using the Databricks CLI:

```bash
databricks apps create myunt-assistant            # once
databricks sync backend /Workspace/Users/<you>/myunt-assistant
databricks apps deploy myunt-assistant \
  --source-code-path /Workspace/Users/<you>/myunt-assistant
```

(Or use the Apps UI: create an app, point it at the synced `backend/` folder.)

**3. Grant the app's service principal access** to the resources it calls — these
are *not* auto-granted:

- **SQL warehouse** (`WAREHOUSE_ID`): `CAN USE`
- **Model serving endpoint** (`SERVING_ENDPOINT`): `CAN QUERY`

Add them under the app's **Resources** (or grant directly to the app's service
principal). You can also reference a warehouse/secret resource from `app.yaml`
via `valueFrom: <resource-key>` instead of hardcoding the id.

## Configuration

All backend config is environment-driven (`backend/.env`, see `.env.example`):

| Variable           | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `DATABRICKS_HOST`  | Workspace base URL                                   |
| `DATABRICKS_TOKEN` | Bearer token (required)                              |
| `WAREHOUSE_ID`     | SQL warehouse for the schedule query                 |
| `SERVING_ENDPOINT` | Model serving endpoint name for the agent            |
| `CORS_ORIGINS`     | Allowed frontend origins (comma-separated)           |

## API

| Method | Path                       | Body                                                       | Returns                              |
| ------ | -------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| GET    | `/api/health`              | —                                                          | `{ ok, auth_mode, token_configured }` |
| GET    | `/api/students`            | —                                                          | `[{ id, display_name, first_name }]` |
| POST   | `/api/schedule/today`      | `{ student_id }`                                           | `{ text }`                           |
| POST   | `/api/missing-assignments` | `{ student_id, conversation_id? }`                         | `{ text, conversation_id }`          |
| POST   | `/api/agent/ask`           | `{ student_id, message, prior_turns[], conversation_id? }` | `{ text, conversation_id }`          |
