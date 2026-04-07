"""
Manual testing script
Send test images to the /analyze endpoint
"""

import requests
import time
import json

# Backend URL
API_URL = "https://sightviz.fabxdev.me"

def test_analyze_endpoint():
    """Test the /analyze endpoint with sample images"""
    
    print("=" * 60)
    print("SightViz Backend Manual Test")
    print("=" * 60)
    
    # Check health
    try:
        response = requests.get(f"{API_URL}/")
        print(f"\n[OK] Health check: {response.json()}")
    except Exception as e:
        print(f"\n[ERROR] Backend not running at {API_URL}")
        print(f"   Start it with: uvicorn main:app --host 0.0.0.0 --port 8000")
        return
    
    # Test with sample images (if they exist)
    test_images = [
        "test_images/cut_paddings.webp",
    ]
    
    print("\n" + "=" * 60)
    print("Testing /analyze endpoint")
    print("=" * 60)
    
    for img_path in test_images:
        try:
            with open(img_path, "rb") as f:
                print(f"\n[SENDING] {img_path}")
                response = requests.post(
                    f"{API_URL}/analyze",
                    files={"file": f}
                )
                
                data = response.json()
                print(f"[SPEECH] {data.get('speech')}")
                if data.get('debug'):
                    print(f"[DEBUG] {json.dumps(data['debug'], indent=2)}")
                
        except FileNotFoundError:
            print(f"[WARNING] Image not found: {img_path}")
            print("   Place test images in test_images/ folder")
        except Exception as e:
            print(f"[ERROR] {e}")
        
        time.sleep(0.5)


def test_sequence():
    """Test a sequence of frames to verify delta behavior"""
    
    print("\n" + "=" * 60)
    print("Testing Delta Behavior (frame sequence)")
    print("=" * 60)
    
    # This requires actual image files
    print("\nTo test delta behavior:")
    print("1. Place images in test_images/:")
    print("   - person_close_front.jpg")
    print("   - person_close_front.jpg (duplicate)")
    print("   - empty_hallway.jpg")
    print("2. Run this test again")


if __name__ == "__main__":
    test_analyze_endpoint()
    test_sequence()
