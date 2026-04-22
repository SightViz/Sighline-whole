"""
SightViz Spatial Engine
Converts visual detections into spatial guidance
"""

from .engine import SpatialEngine
from .models import Detection, Direction, DepthBucket, BoundingBox, ObjectClass
from .config import EngineConfig, DEFAULT_CONFIG
from .adapter import DetectionAdapter
from .face_recognition import enroll_person, recognize_person, list_enrolled, delete_person

__all__ = [
    'SpatialEngine',
    'Detection',
    'Direction',
    'DepthBucket',
    'BoundingBox',
    'ObjectClass',
    'EngineConfig',
    'DEFAULT_CONFIG',
    'DetectionAdapter',
    'enroll_person',
    'recognize_person',
    'list_enrolled',
    'delete_person',
]
