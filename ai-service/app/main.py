"""
AI Service - Face Recognition for Attendance System
FastAPI service wrapping MediaPipe + FaceNet for face detection and recognition.
"""

import os
import logging
from contextlib import asynccontextmanager

# Load .env (camera credentials, etc.) before anything else touches env vars.
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
except Exception:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import recognition, encodings, health, camera, feedback
from app.services.model_loader import model_loader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup, cleanup on shutdown."""
    logger.info("Loading ML models...")
    model_loader.load_models()
    logger.info("Models loaded successfully.")
    yield
    logger.info("Shutting down AI service...")
    model_loader.cleanup()


app = FastAPI(
    title="Attendance AI Service",
    description="Face detection and recognition service for Smart Attendance System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health.router, tags=["Health"])
app.include_router(recognition.router, prefix="/api/v1", tags=["Recognition"])
app.include_router(encodings.router, prefix="/api/v1", tags=["Encodings"])
app.include_router(camera.router, prefix="/api/v1", tags=["Camera"])
app.include_router(feedback.router, prefix="/api/v1", tags=["Feedback"])
