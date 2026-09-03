"""Entrypoint for the Databricks App.

Databricks Apps inject DATABRICKS_APP_PORT and require binding to 0.0.0.0.
All Python modules live alongside this file (flat layout) so imports work
reliably in the Apps runtime at /app/python/source_code/.
"""
import os

import uvicorn

from main import app


def main() -> None:
    port = int(os.environ.get("DATABRICKS_APP_PORT") or os.environ.get("UVICORN_PORT") or "8000")
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
