"""Health check endpoint."""

from fastapi import APIRouter
from app.services.model_loader import model_loader

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy" if model_loader.is_loaded else "loading",
        "modelLoaded": model_loader.is_loaded,
        "version": "1.0.0",
    }
