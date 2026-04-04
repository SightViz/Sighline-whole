"""
Detection Adapter Layer
Converts YOLO raw output to Spatial Engine Detection format
"""

from typing import List
from .models import Detection, Direction, DepthBucket, BoundingBox


class DetectionAdapter:
    """Converts YOLO raw output to Spatial Engine format"""
    
    def __init__(self, image_width: int, image_height: int):
        self.img_w = image_width
        self.img_h = image_height
    
    def convert(self, yolo_boxes, yolo_model) -> List[Detection]:
        """
        Convert YOLO detections to Spatial Engine Detection objects
        
        Args:
            yolo_boxes: results.boxes from YOLO inference
            yolo_model: YOLO model instance (for .names attribute)
        
        Returns:
            List[Detection] ready for spatial engine processing
        """
        detections = []
        
        for box in yolo_boxes:
            cls_id = int(box.cls[0])
            label = yolo_model.names[cls_id]
            confidence = float(box.conf[0])
            
            # Extract bounding box coordinates
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            # Create BoundingBox object
            bbox = BoundingBox(
                x=x1,
                y=y1,
                w=x2 - x1,
                h=y2 - y1
            )
            
            # Calculate spatial properties
            direction = self._calculate_direction(bbox)
            distance = self._calculate_distance(bbox)
            
            detections.append(Detection(
                label=label,
                direction=direction,
                distance=distance,
                confidence=confidence,
                bbox=bbox
            ))
        
        return detections
    
    def _calculate_direction(self, bbox: BoundingBox) -> Direction:
        """
        Determine left/front/right from bbox center X position
        
        Uses frame thirds approach:
        - Left third: LEFT
        - Middle third: FRONT
        - Right third: RIGHT
        """
        center_x = bbox.cx
        
        # Divide frame into thirds
        left_third = self.img_w / 3
        right_third = 2 * self.img_w / 3
        
        if center_x < left_third:
            return Direction.LEFT
        elif center_x > right_third:
            return Direction.RIGHT
        else:
            return Direction.FRONT
    
    def _calculate_distance(self, bbox: BoundingBox) -> DepthBucket:
        """
        Estimate distance from bbox height (larger object = closer)
        
        Heuristic: Objects closer to camera appear taller in frame
        
        Thresholds (tuned empirically):
        - >50% of frame height: VERY_CLOSE
        - >25%: CLOSE
        - >10%: MEDIUM
        - else: FAR
        """
        height_ratio = bbox.h / self.img_h
        
        if height_ratio > 0.5:
            return DepthBucket.VERY_CLOSE
        elif height_ratio > 0.25:
            return DepthBucket.CLOSE
        elif height_ratio > 0.1:
            return DepthBucket.MEDIUM
        else:
            return DepthBucket.FAR
