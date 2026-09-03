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
- **Suggested questions** panel with one-click prompts (grades, events, graduation plan, etc.).

## Project layout

```
backend/    FastAPI app (proxies all Databricks calls) — also the Databricks App root
  main.py               FastAPI routes + static UI mount
  config.py             env-based settings
  databricks_client.py  SQL + agent logic; PAT or service-principal OAuth
  students.py           selectable students
  models.py             request/response schemas
  app.yaml              Databricks App manifest
  serve.py              App entrypoint (binds 0.0.0.0:$DATABRICKS_APP_PORT)
  requirements.txt
  .env.example
  static/             # built React UI (from step 1; commit for Git deploy)
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
python3 -m uvicorn main:app --reload --port 8000
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

In production the app runs as a **single web process**: FastAPI serves `/api/*`
and the built React UI from `backend/static/`. There is no Vite dev server and no
CORS configuration — the browser talks to the same origin.

Authentication uses the app's **service principal** (OAuth). The Apps runtime
auto-injects `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, and
`DATABRICKS_CLIENT_SECRET`, so **no PAT is required** in the deployed app.
Locally, `DATABRICKS_TOKEN` in `backend/.env` is used instead.

The **`backend/` directory is the app source root.** Deploy only that folder (or
point the app's source-code path at `backend/` in the repo).

### Prerequisites

- Databricks CLI installed and authenticated (`databricks auth login`)
- **CAN USE** on the SQL warehouse used for today's schedule
- **CAN QUERY** on the model serving endpoint used for agent chat
- Node.js and npm (local machine only — to build the frontend before deploy)

### Step 1 — Configure `app.yaml`

Edit `backend/app.yaml` with your workspace resources:

```yaml
command: ["python", "serve.py"]

env:
  - name: WAREHOUSE_ID
    value: "<your-warehouse-id>"
  - name: SERVING_ENDPOINT
    value: "<your-serving-endpoint-name>"
```

Alternatively, attach the warehouse and serving endpoint as **App resources** in
the Databricks UI and reference them with `valueFrom` instead of hardcoding ids:

```yaml
env:
  - name: WAREHOUSE_ID
    valueFrom: sql-warehouse
  - name: SERVING_ENDPOINT
    valueFrom: serving-endpoint
```

`DATABRICKS_HOST` and the service-principal OAuth credentials are injected
automatically — do not set them in `app.yaml`.

To call a warehouse or serving endpoint in a **different workspace**, add
`DATABRICKS_HOST_OVERRIDE` plus `DATABRICKS_CLIENT_ID_OVERRIDE` and
`DATABRICKS_CLIENT_SECRET_OVERRIDE` to the `env` section (see commented example in
`app.yaml`). The override OAuth credentials must belong to a service principal
with access to the target workspace resources.

### Step 2 — Build the frontend

**Run this before every deploy** (and after any frontend change):

```bash
bash build_frontend.sh
```

This runs `npm run build` in `frontend/` and copies the output to
`backend/static/`. Without `backend/static/index.html`, the app URL returns
`{"detail": "Not Found"}` and only `/api/*` routes work.

Verify the build:

```bash
ls backend/static/index.html backend/static/assets/
```

### Step 3 — Include `static/` in the deployment bundle

How you ship `backend/static/` depends on your deploy method:

| Deploy method | How to include `static/` |
| ------------- | ------------------------ |
| **Git repository** | Commit `backend/static/` after running `build_frontend.sh`, then push and deploy |
| **Workspace sync** (`databricks sync`) | Run `build_frontend.sh` locally first; sync copies the folder from disk |
| **UI upload** | Upload the full `backend/` folder including `static/` |

For Git-based deploys, add and commit the built assets whenever the UI changes:

```bash
git add backend/static/
git commit -m "Rebuild frontend for deploy"
git push
```

### Step 4 — Create the app (first time only)

**CLI:**

```bash
databricks apps create myunt-assistant --description "myUNT student assistant"
```

**UI:** Apps → Create app → Custom app → set name and source.

App names must be ≤26 characters, lowercase letters, numbers, and hyphens only.

### Step 5 — Deploy

**Option A — Sync to workspace, then deploy (CLI):**

```bash
# Upload backend/ (must include static/ from step 2)
databricks sync backend /Workspace/Users/<you>/myunt-assistant

# Deploy and start
databricks apps deploy myunt-assistant \
  --source-code-path /Workspace/Users/<you>/myunt-assistant
```

**Option B — Deploy from Git (CLI):**

Configure the app's Git repository in the Databricks UI (Apps → your app →
Configure Git), then deploy with source path `backend/`:

```bash
databricks apps deploy myunt-assistant --source-code-path backend
```

Enable **Auto deploy on push** in the UI if you want each push to `main` to
redeploy automatically (requires a private GitHub repo and Git credential on
the app's service principal).

**Option C — Databricks UI:**

1. Apps → select your app → **Deploy**
2. Choose **From Git** or a **workspace folder**
3. Set **Source code path** to `backend/` (not the repo root)
4. Click **Deploy**

### Step 6 — Grant resource permissions

The app's service principal needs explicit access to the resources it calls.
Add them under the app's **Resources** tab (recommended) or grant directly to
the service principal:

| Resource | Permission |
| -------- | ---------- |
| SQL warehouse (`WAREHOUSE_ID`) | **CAN USE** |
| Model serving endpoint (`SERVING_ENDPOINT`) | **CAN QUERY** |

Without these, the UI may load but schedule and chat requests will fail at
runtime.

### Step 7 — Verify

Open the app URL from the Apps overview page (or **Open app**).

| Check | Expected |
| ----- | -------- |
| App home page | React chat UI loads (not JSON `{"detail": "Not Found"}`) |
| `GET /api/health` | `{ "ok": true, "auth_mode": "service-principal-oauth", "token_configured": false }` |
| Today's schedule | Auto-loads in the chat on launch |
| Suggested questions | Right panel visible on wide screens; clicking sends a prompt |

If the UI is missing, check app **Logs** for `Frontend not found at ...` and
re-run `build_frontend.sh`, then redeploy with `static/` included.

If the app crashes with `ModuleNotFoundError` on startup, confirm the deploy
source path is `backend/` and that all `*.py` files (`main.py`, `config.py`,
etc.) sit alongside `serve.py` in the deployed bundle — the Databricks Apps
runtime does not reliably import nested Python packages.

If API calls fail, check **Logs** for Databricks auth or permission errors and
confirm warehouse/endpoint permissions in step 6.

### Redeploying after changes

**Backend-only changes** — redeploy `backend/` as in step 5.

**Frontend changes** — always run the full cycle:

```bash
bash build_frontend.sh
git add backend/static/          # if using Git deploy
databricks apps deploy myunt-assistant ...
```

### Databricks App vs local dev

| | Local dev | Databricks App |
| - | --------- | -------------- |
| UI | Vite on `:5173` | `backend/static/` served by FastAPI |
| API | FastAPI on `:8000` | Same process as UI |
| Auth | `DATABRICKS_TOKEN` in `backend/.env` | Service principal OAuth (auto-injected) |
| Config | `backend/.env` | `backend/app.yaml` `env` section |
| CORS | Vite proxy (no CORS needed) | Same origin (no CORS needed) |

## Configuration

### Local development (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

| Variable           | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `DATABRICKS_HOST`  | Workspace base URL                                   |
| `DATABRICKS_HOST_OVERRIDE` | Optional — when set, replaces `DATABRICKS_HOST` for API calls |
| `DATABRICKS_CLIENT_ID_OVERRIDE` | OAuth client id for override workspace (with host override, no PAT) |
| `DATABRICKS_CLIENT_SECRET_OVERRIDE` | OAuth client secret for override workspace (with host override, no PAT) |
| `DATABRICKS_TOKEN` | Personal access token (required locally)             |
| `WAREHOUSE_ID`     | SQL warehouse for the schedule query                 |
| `SERVING_ENDPOINT` | Model serving endpoint name for the agent            |
| `CORS_ORIGINS`     | Allowed frontend origins (comma-separated)           |

### Databricks App (`backend/app.yaml`)

| Variable / source | Purpose |
| ----------------- | ------- |
| `WAREHOUSE_ID` | SQL warehouse for today's schedule (set in `env` or via `valueFrom`) |
| `SERVING_ENDPOINT` | Model serving endpoint for agent chat |
| `DATABRICKS_HOST` | Auto-injected by Apps runtime |
| `DATABRICKS_HOST_OVERRIDE` | Optional in `app.yaml` — when set, replaces `DATABRICKS_HOST` for SQL and agent API calls |
| `DATABRICKS_CLIENT_ID_OVERRIDE` | OAuth client id for the override workspace (required with host override, no PAT) |
| `DATABRICKS_CLIENT_SECRET_OVERRIDE` | OAuth client secret for the override workspace (required with host override, no PAT) |
| `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` | Auto-injected service principal OAuth |
| `DATABRICKS_APP_PORT` | Auto-injected; read by `serve.py` |

## API

| Method | Path                       | Body                                                       | Returns                              |
| ------ | -------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| GET    | `/api/health`              | —                                                          | `{ ok, auth_mode, token_configured }` |
| GET    | `/api/students`            | —                                                          | `[{ id, display_name, first_name }]` |
| POST   | `/api/schedule/today`      | `{ student_id }`                                           | `{ text }`                           |
| POST   | `/api/missing-assignments` | `{ student_id, conversation_id? }`                         | `{ text, conversation_id }`          |
| POST   | `/api/agent/ask`           | `{ student_id, message, prior_turns[], conversation_id? }` | `{ text, conversation_id }`          |
