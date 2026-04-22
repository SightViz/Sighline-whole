"""
SightViz Face Recognition Module
Handles face enrollment and recognition using FaceNet + MTCNN
"""

from .face_db import FaceDB
from .face_service import FaceService

__all__ = ["FaceDB", "FaceService"]
