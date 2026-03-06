"""
FastAPI application — serves the API and (in production) the built React frontend.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routers.api import router as api_router
from app import db

app = FastAPI(title="UK Housing Data Pipeline API")
app.include_router(api_router)


@app.on_event("startup")
def on_startup():
    """Warmup: open the DB connection and pre-load overview data."""
    db.warmup()

# Serve the built React frontend in production
_dist = Path(__file__).parent / "frontend" / "dist"
if _dist.is_dir():
    # Static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    # Catch-all for client-side routing — serve index.html for any non-API path
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = _dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_dist / "index.html")
