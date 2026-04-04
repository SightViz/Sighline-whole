from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class EngineConfig:
    confidence_threshold: float = 0.5
    cooldown_seconds: float = 2.0
    height_to_feet_factor: float = 100.0
    
    label_categories: Optional[dict] = None
    def __post_init__(self):
        if self.label_categories is None:
            object.__setattr__(self, 'label_categories', {
                "stairs": "SAFETY",
                "person": "SAFETY",
                "door": "NAVIGATION",
                "exit": "NAVIGATION",
                "sign": "NAVIGATION",
                "chair": "DECORATIVE",
                "table": "DECORATIVE",
                "plant": "DECORATIVE"
            })

DEFAULT_CONFIG = EngineConfig()
