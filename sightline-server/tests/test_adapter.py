"""
Unit tests for DetectionAdapter
Tests direction and distance calculation logic
"""

import pytest
import sys
sys.path.insert(0, '..')

from engine.adapter import DetectionAdapter
from engine.models import Direction, DepthBucket, BoundingBox


class TestDirectionCalculation:
    """Test horizontal position → direction mapping"""
    
    def test_left_third(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Object in left third (x < 213)
        bbox_left = BoundingBox(x=50, y=100, w=100, h=200)
        assert adapter._calculate_direction(bbox_left) == Direction.LEFT
    
    def test_center_front(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Object in center (213 < x < 427)
        bbox_front = BoundingBox(x=270, y=100, w=100, h=200)
        assert adapter._calculate_direction(bbox_front) == Direction.FRONT
    
    def test_right_third(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Object in right third (x > 427)
        bbox_right = BoundingBox(x=500, y=100, w=100, h=200)
        assert adapter._calculate_direction(bbox_right) == Direction.RIGHT
    
    def test_edge_cases(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Far left edge
        bbox_edge_left = BoundingBox(x=0, y=100, w=50, h=200)
        assert adapter._calculate_direction(bbox_edge_left) == Direction.LEFT
        
        # Far right edge
        bbox_edge_right = BoundingBox(x=590, y=100, w=50, h=200)
        assert adapter._calculate_direction(bbox_edge_right) == Direction.RIGHT


class TestDistanceCalculation:
    """Test bbox height → distance bucket mapping"""
    
    def test_very_close(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Height > 50% of frame (240+ pixels)
        bbox_very_close = BoundingBox(x=100, y=0, w=100, h=300)
        assert adapter._calculate_distance(bbox_very_close) == DepthBucket.VERY_CLOSE
    
    def test_close(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Height > 25% but < 50% (120-240 pixels)
        bbox_close = BoundingBox(x=100, y=100, w=100, h=150)
        assert adapter._calculate_distance(bbox_close) == DepthBucket.CLOSE
    
    def test_medium(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Height > 10% but < 25% (48-120 pixels)
        bbox_medium = BoundingBox(x=100, y=200, w=100, h=80)
        assert adapter._calculate_distance(bbox_medium) == DepthBucket.MEDIUM
    
    def test_far(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Height < 10% of frame (<48 pixels)
        bbox_far = BoundingBox(x=100, y=200, w=50, h=30)
        assert adapter._calculate_distance(bbox_far) == DepthBucket.FAR
    
    def test_boundary_cases(self):
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # Exactly 50% threshold
        bbox_boundary = BoundingBox(x=100, y=0, w=100, h=240)
        # 240/480 = 0.5, which is NOT > 0.5, so should be CLOSE
        assert adapter._calculate_distance(bbox_boundary) == DepthBucket.CLOSE


class TestFullConversion:
    """Test complete YOLO → Detection conversion"""
    
    def test_integration(self):
        """Mock YOLO output and verify full conversion"""
        adapter = DetectionAdapter(image_width=640, image_height=480)
        
        # This would require mocking YOLO boxes
        # For now, just verify adapter initializes correctly
        assert adapter.img_w == 640
        assert adapter.img_h == 480


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
