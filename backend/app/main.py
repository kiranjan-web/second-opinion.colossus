from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import websockets, routes
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI Coercion & Digital Arrest Detection Engine — Colossus 3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(websockets.router, prefix="/api/v1")
app.include_router(routes.router, prefix="/api/v1")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Shield Exception. Fail-safe engaged.", "details": str(exc)},
    )

@app.get("/health")
async def health_check():
    return {"status": "ONLINE", "engine": "SecondVoice-Core", "version": settings.VERSION}