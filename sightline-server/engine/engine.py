import time
from typing import List, Optional
from .models import Detection, Direction, DepthBucket, EngineState, ObjectClass
from .config import DEFAULT_CONFIG

class SpatialEngine:
    def __init__(self, config=DEFAULT_CONFIG):
        self.state = EngineState()
        self.config = config

    def process_frame(self, detections: List[Detection]) -> Optional[str]:
        filtered = [d for d in detections if d.confidence >= self.config.confidence_threshold]
        
        if not filtered:
            if self.state.was_busy:
                self.state.was_busy = False
                return self._trigger_path_clear()
            return None

        self.state.was_busy = True
        
        crowded = self._check_path_density(filtered)
        if crowded:
            return self._handle_output("Path ahead is crowded")

        target = self._select_best_object(filtered)
        if not target:
            return None

        message = self._generate_enhanced_message(target)
        return self._handle_output(message)

    def _handle_output(self, message: str) -> Optional[str]:
        if message == self.state.last_spoken_message:
            return None
        now = time.time()
        if now - self.state.last_spoken_timestamp < self.config.cooldown_seconds:
            return None
        self.state.last_spoken_message = message
        self.state.last_spoken_timestamp = now
        return message

    def _trigger_path_clear(self) -> Optional[str]:
        return self._handle_output("Path clear")

    def _check_path_density(self, detections: List[Detection]) -> bool:
        front_close = [d for d in detections if d.direction == Direction.FRONT and d.distance in [DepthBucket.VERY_CLOSE, DepthBucket.CLOSE]]
        return len(front_close) >= 2

    def _select_best_object(self, detections: List[Detection]) -> Optional[Detection]:
        scored = []
        for d in detections:
            cat_name = self.config.label_categories.get(d.label.lower(), "DECORATIVE")
            cat_priority = getattr(ObjectClass, cat_name).value
            dist_priority = {DepthBucket.VERY_CLOSE: 1, DepthBucket.CLOSE: 2, DepthBucket.MEDIUM: 3, DepthBucket.FAR: 4}.get(d.distance, 10)
            dir_priority = {Direction.FRONT: 1, Direction.LEFT: 2, Direction.RIGHT: 2}.get(d.direction, 5)
            scored.append((cat_priority, dist_priority, dir_priority, d))
        
        scored.sort(key=lambda x: (x[0], x[1], x[2]))
        
        if scored and scored[0][1] <= 3:
            return scored[0][3]
        return None

    def _generate_enhanced_message(self, detection: Detection) -> str:
        label = detection.label.capitalize()
        direction = detection.direction.value
        
        feet = self._estimate_feet(detection)
        dist_str = f"{feet} feet" if feet else detection.distance.value.replace("_", " ")

        if detection.distance == DepthBucket.VERY_CLOSE:
            if detection.direction == Direction.FRONT:
                return "Obstacle very close in front"
            return f"{label} very close on your {direction}"
        
        if detection.direction == Direction.FRONT:
            return f"{label} {dist_str} ahead"
        
        return f"{label} on your {direction}, {dist_str} away"

    def _estimate_feet(self, detection: Detection) -> Optional[int]:
        if not detection.bbox:
            return None
        return max(2, int(self.config.height_to_feet_factor / (detection.bbox.h + 1)))
