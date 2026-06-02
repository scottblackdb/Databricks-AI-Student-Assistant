"""Entrypoint for the Databricks App.

Databricks Apps inject DATABRICKS_APP_PORT (and UVICORN_HOST/UVICORN_PORT) and
require the server to bind 0.0.0.0. This launcher reads the injected port and
serves the FastAPI app, which also serves the built React frontend from static/.
"""
import os

import uvicorn


def main() -> None:
    port = int(os.environ.get("DATABRICKS_APP_PORT") or os.environ.get("UVICORN_PORT") or "8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
