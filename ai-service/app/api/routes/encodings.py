"""
Face encoding management endpoints.
Generate, store, and delete face encodings for students.
"""

import os
import json
import logging
import tempfile
from typing import List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services.model_loader import model_loader
from app.services.recognition_service import generate_encodings_for_images
from app.services.encoding_store import encoding_store
from app.services.classifier import face_classifier

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/encodings/generate")
async def generate_encodings(
    student_id: str = Form(...),
    images: List[UploadFile] = File(...),
    registration_number: str = Form(""),
    name: str = Form(""),
):
    """
    Generate face encodings from uploaded images for a student.

    - **student_id**: Student UUID
    - **images**: One or more face images (JPEG/PNG)
    - **registration_number**: Student registration number (for metadata)
    - **name**: Student name (for metadata)
    """
    if not model_loader.is_loaded:
        raise HTTPException(status_code=503, detail="Models are still loading")

    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required")

    # Save uploaded images to temp files
    temp_paths = []
    try:
        for img_file in images:
            if img_file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
                continue

            contents = await img_file.read()
            suffix = ".jpg" if "jpeg" in (img_file.content_type or "") else ".png"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp.write(contents)
            tmp.close()
            temp_paths.append(tmp.name)

        if not temp_paths:
            raise HTTPException(status_code=400, detail="No valid image files provided")

        # Generate encodings
        encodings = generate_encodings_for_images(temp_paths)

        if not encodings:
            return {
                "studentId": student_id,
                "encodingsGenerated": 0,
                "success": False,
                "error": "No faces detected in any of the provided images",
            }

        # Store encodings
        metadata = {
            "registrationNumber": registration_number,
            "name": name,
        }
        encoding_store.save_encodings(student_id, encodings, metadata)

        return {
            "studentId": student_id,
            "encodingsGenerated": len(encodings),
            "success": True,
        }

    finally:
        # Cleanup temp files
        for p in temp_paths:
            try:
                os.unlink(p)
            except OSError:
                pass


@router.get("/encodings")
async def list_students_with_encodings():
    """List all students that have stored face encodings."""
    student_ids = encoding_store.get_all_student_ids()
    return {
        "totalStudents": len(student_ids),
        "studentIds": student_ids,
    }


@router.get("/encodings/students")
async def list_all_students_with_metadata():
    """List all students with full metadata (name, registration number, encoding count)."""
    student_ids = encoding_store.get_all_student_ids()
    students = []
    for sid in student_ids:
        data = encoding_store.get_encodings(sid)
        if data:
            students.append({
                "studentId": sid,
                "name": data.get("name", ""),
                "registrationNumber": data.get("registrationNumber", ""),
                "encodingCount": len(data.get("encodings", [])),
            })
    students.sort(key=lambda s: s["name"])
    return {"totalStudents": len(students), "students": students}


@router.delete("/encodings/{student_id}")
async def delete_encodings(student_id: str):
    """Delete all face encodings for a student."""
    deleted = encoding_store.delete_encodings(student_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="No encodings found for this student")

    return {"studentId": student_id, "deleted": True}


@router.get("/encodings/{student_id}")
async def get_encoding_info(student_id: str):
    """Get encoding information for a student (without the actual vectors)."""
    data = encoding_store.get_encodings(student_id)
    if not data:
        raise HTTPException(status_code=404, detail="No encodings found for this student")

    return {
        "studentId": student_id,
        "encodingCount": len(data.get("encodings", [])),
        "registrationNumber": data.get("registrationNumber", ""),
        "name": data.get("name", ""),
    }


@router.post("/classifier/train")
async def train_classifier():
    """
    Train the SVM classifier on all stored encodings.
    Requires at least 2 students with encodings.
    """
    student_ids = encoding_store.get_all_student_ids()
    if len(student_ids) < 2:
        return {
            "success": False,
            "reason": "Need at least 2 students with encodings to train SVM",
            "studentsAvailable": len(student_ids),
        }

    import numpy as np

    encodings_by_student = {}
    for sid in student_ids:
        data = encoding_store.get_encodings(sid)
        if data and data.get("encodings_np") is not None and len(data["encodings_np"]) > 0:
            encodings_by_student[sid] = data["encodings_np"]

    if len(encodings_by_student) < 2:
        return {
            "success": False,
            "reason": "Not enough students with valid encodings",
            "studentsAvailable": len(encodings_by_student),
        }

    result = face_classifier.train(encodings_by_student)
    return result
