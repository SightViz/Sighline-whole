import time
from engine import SpatialEngine
from models import Detection, Direction, DepthBucket, BoundingBox

def run_enhanced_demo():
    engine = SpatialEngine()
    
    print("--- Priority: Safety (Stairs) > Decorative (Chair) ---")
    scenarios = [
        ([
            Detection("chair", Direction.FRONT, DepthBucket.CLOSE, 0.8, BoundingBox(0,0,50,50)),
            Detection("stairs", Direction.FRONT, DepthBucket.MEDIUM, 0.8, BoundingBox(0,0,20,20))
        ], "Stairs ahead (Safety Priority)"),
        
        ([
            Detection("person", Direction.FRONT, DepthBucket.CLOSE, 0.8, BoundingBox(0,0,100,100)),
            Detection("chair", Direction.FRONT, DepthBucket.CLOSE, 0.8, BoundingBox(0,0,80,80))
        ], "Path ahead is crowded (Density)"),

        ([], "Path clear (Transition)"),

        ([Detection("exit", Direction.FRONT, DepthBucket.MEDIUM, 0.8, BoundingBox(0,0,10,10))], "Exit 10 feet ahead (Distance Estimation)"),
    ]

    for detections, desc in scenarios:
        print(f"\nScenario: {desc}")
        result = engine.process_frame(detections)
        print(f"Output: {result}")
        time.sleep(2.1)

if __name__ == "__main__":
    run_enhanced_demo()
