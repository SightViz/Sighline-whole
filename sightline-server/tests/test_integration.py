"""
Integration tests for Spatial Engine and Face Recognition module
Tests delta behavior, silence logic, priority rules, and face DB operations.
"""

import os
import sys
import pytest
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.engine import SpatialEngine
from engine.models import Detection, Direction, DepthBucket, BoundingBox


class TestDeltaBehavior:
    """Test that engine responds to changes, not static state"""
    
    def test_silence_on_repeated_detections(self):
        """Same detection should not repeat speech immediately"""
        engine = SpatialEngine()
        
        detections = [
            Detection("person", Direction.FRONT, DepthBucket.CLOSE, 0.9, 
                      BoundingBox(0, 0, 100, 100))
        ]
        
        # First frame: should speak
        result1 = engine.process_frame(detections)
        assert result1 is not None
        assert "person" in result1.lower() or "obstacle" in result1.lower()
        
        # Immediate second frame: should be silent (cooldown)
        result2 = engine.process_frame(detections)
        assert result2 is None
    
    def test_speaks_after_cooldown(self):
        """After cooldown, same message should still be silent"""
        engine = SpatialEngine()
        
        detections = [
            Detection("person", Direction.FRONT, DepthBucket.CLOSE, 0.9, 
                      BoundingBox(0, 0, 100, 100))
        ]
        
        # First frame
        result1 = engine.process_frame(detections)
        assert result1 is not None
        
        # Wait for cooldown
        time.sleep(2.1)
        
        # Same detection = same message, should still be silent
        result2 = engine.process_frame(detections)
        assert result2 is None


class TestPathClearTransition:
    """Test transition from busy → empty"""
    
    def test_path_clear_message(self):
        """When objects disappear, should announce 'Path clear'"""
        engine = SpatialEngine()
        
        # Frame 1: Person detected
        detections = [
            Detection("person", Direction.FRONT, DepthBucket.CLOSE, 0.9,
                      BoundingBox(0, 0, 100, 100))
        ]
        result1 = engine.process_frame(detections)
        assert result1 is not None
        
        # Wait for cooldown
        time.sleep(2.1)
        
        # Frame 2: Empty frame
        result2 = engine.process_frame([])
        assert result2 == "Path clear"
    
    def test_no_path_clear_if_never_busy(self):
        """Empty frames when never busy should stay silent"""
        engine = SpatialEngine()
        
        # Start with empty frame
        result = engine.process_frame([])
        assert result is None


class TestPriorityRules:
    """Test object priority: SAFETY > NAVIGATION > DECORATIVE"""
    
    def test_safety_over_decorative(self):
        """Stairs (safety) should beat chair (decorative)"""
        engine = SpatialEngine()
        
        detections = [
            Detection("chair", Direction.FRONT, DepthBucket.CLOSE, 0.8,
                      BoundingBox(0, 0, 50, 50)),
            Detection("stairs", Direction.FRONT, DepthBucket.MEDIUM, 0.8,
                      BoundingBox(0, 0, 20, 20))
        ]
        
        result = engine.process_frame(detections)
        assert result is not None
        assert "stairs" in result.lower()
    
    def test_closer_wins_same_category(self):
        """Within same category, closer object wins"""
        engine = SpatialEngine()
        
        detections = [
            Detection("person", Direction.FRONT, DepthBucket.FAR, 0.9,
                      BoundingBox(0, 0, 10, 10)),
            Detection("person", Direction.LEFT, DepthBucket.CLOSE, 0.9,
                      BoundingBox(0, 0, 100, 100))
        ]
        
        result = engine.process_frame(detections)
        assert result is not None
        # Should mention the closer person (left)
        assert "left" in result.lower()


class TestCrowdedPath:
    """Test density detection"""
    
    def test_crowded_message(self):
        """Multiple objects in front should trigger crowded message"""
        engine = SpatialEngine()
        
        detections = [
            Detection("person", Direction.FRONT, DepthBucket.CLOSE, 0.8,
                      BoundingBox(0, 0, 100, 100)),
            Detection("chair", Direction.FRONT, DepthBucket.CLOSE, 0.8,
                      BoundingBox(0, 0, 80, 80))
        ]
        
        result = engine.process_frame(detections)
        assert result is not None
        assert "crowded" in result.lower()


class TestConfidenceFiltering:
    """Test low confidence detections are filtered"""
    
    def test_low_confidence_ignored(self):
        """Detections below threshold should be filtered out"""
        engine = SpatialEngine()
        
        detections = [
            Detection("person", Direction.FRONT, DepthBucket.CLOSE, 0.3,
                      BoundingBox(0, 0, 100, 100))  # Below 0.5 threshold
        ]
        
        result = engine.process_frame(detections)
        # Should be silent (no valid detections after filtering)
        assert result is None


class TestFaceDatabase:
    """Test face enrollment and recognition in isolation (no GPU needed)."""

    def setup_method(self):
        """Use a temp DB path so tests don't pollute the real database."""
        import tempfile
        from engine import face_recognition
        self._orig_db_path = face_recognition.DB_PATH
        self._tmpdir = tempfile.mkdtemp()
        face_recognition.DB_PATH = os.path.join(self._tmpdir, "test_face_db.pkl")

    def teardown_method(self):
        """Restore the real DB path."""
        from engine import face_recognition
        face_recognition.DB_PATH = self._orig_db_path

    def test_empty_db_returns_empty(self):
        from engine.face_recognition import list_enrolled
        assert list_enrolled() == {}

    def test_enroll_and_list(self):
        """Enrollment with no real images returns failure gracefully."""
        from engine.face_recognition import enroll_person, list_enrolled
        from PIL import Image

        # Blank 160x160 image — MTCNN won't find a face in it
        blank = Image.new("RGB", (160, 160), color=(128, 128, 128))
        result = enroll_person("NoFacePerson", [blank, blank, blank])
        # Should fail gracefully: no face detected
        assert result["success"] is False
        assert result["enrolled"] == 0
        assert list_enrolled() == {}

    def test_delete_nonexistent_person(self):
        from engine.face_recognition import delete_person
        assert delete_person("GhostPerson") is False

    def test_recognize_empty_db_returns_none(self):
        from engine.face_recognition import recognize_person
        from PIL import Image
        blank = Image.new("RGB", (160, 160), color=(100, 100, 100))
        result = recognize_person(blank)
        assert result is None

    def test_recognized_name_in_engine_message(self):
        """When recognized_name is set, engine uses it in the announcement."""
        engine = SpatialEngine()
        det = Detection(
            label="person",
            direction=Direction.FRONT,
            distance=DepthBucket.CLOSE,
            confidence=0.9,
            bbox=BoundingBox(0, 0, 100, 100),
            recognized_name="Vansh",
        )
        result = engine.process_frame([det])
        assert result is not None
        assert "Vansh" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
