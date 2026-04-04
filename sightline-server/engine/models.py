from dataclasses import dataclass
from enum import Enum
from typing import Optional

class DepthBucket(Enum):
    VERY_CLOSE = "very_close"
    CLOSE = "close"
    MEDIUM = "medium"
    FAR = "far"
    UNKNOWN = "unknown"

class Direction(Enum):
    LEFT = "left"
    FRONT = "front"
    RIGHT = "right"

class ObjectClass(Enum):
    SAFETY = 1
    NAVIGATION = 2
    DECORATIVE = 3

@dataclass
class BoundingBox:
    x: float
    y: float
    w: float
    h: float

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

@dataclass
class Detection:
    label: str
    direction: Direction
    distance: DepthBucket
    confidence: float
    bbox: Optional[BoundingBox] = None

@dataclass
class EngineState:
    last_spoken_message: Optional[str] = None
    last_spoken_timestamp: float = 0.0
    was_busy: bool = False
