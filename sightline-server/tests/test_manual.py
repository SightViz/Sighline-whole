"""
Manual testing script
Sends live requests to all SightViz backend endpoints.

Usage:
  cd sightline-server
  python tests/test_manual.py
  PORT=6969 python tests/test_manual.py        # custom port
"""

import os
import requests
import time
import json

PORT = os.environ.get("PORT", "6969")
API_URL = os.environ.get("API_URL", f"http://localhost:{PORT}")


def _print_sep(title: str):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def test_health():
    _print_sep("Health check  GET /")
    try:
        r = requests.get(f"{API_URL}/", timeout=5)
        r.raise_for_status()
        print(f"[OK] {json.dumps(r.json(), indent=2)}")
    except Exception as e:
        print(f"[ERROR] Backend not reachable at {API_URL}: {e}")
        print("  Start it with:  ./start_server.sh")
        raise SystemExit(1)


def test_detect_endpoint():
    _print_sep("Detection  POST /detect")
    test_images = ["test_images/cut_paddings.webp"]
    for img_path in test_images:
        try:
            with open(img_path, "rb") as f:
                r = requests.post(f"{API_URL}/detect", files={"file": f}, timeout=15)
                data = r.json()
                print(f"[{img_path}] {len(data.get('detections', []))} objects  "
                      f"({data.get('inference_ms')}ms)")
                for d in data.get("detections", []):
                    print(f"  - {d['label']}  conf={d['confidence']:.2f}")
        except FileNotFoundError:
            print(f"[SKIP] {img_path} not found")
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(0.3)


def test_analyze_endpoint():
    _print_sep("Spatial Engine  POST /analyze")
    test_images = ["test_images/cut_paddings.webp"]
    for img_path in test_images:
        try:
            with open(img_path, "rb") as f:
                r = requests.post(f"{API_URL}/analyze", files={"file": f}, timeout=15)
                data = r.json()
                speech = data.get("speech")
                print(f"[{img_path}] speech = {repr(speech)}")
                if data.get("debug"):
                    print(f"  debug: {json.dumps(data['debug'], indent=4)}")
        except FileNotFoundError:
            print(f"[SKIP] {img_path} not found")
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(0.3)


def test_faces_list():
    _print_sep("Face List  GET /faces/list")
    try:
        r = requests.get(f"{API_URL}/faces/list", timeout=5)
        data = r.json()
        faces = data.get("faces", {})
        if faces:
            for name, count in faces.items():
                print(f"  {name}: {count} embeddings")
        else:
            print("  (no enrolled faces)")
    except Exception as e:
        print(f"[ERROR] {e}")


def test_faces_enroll():
    """
    Enroll test faces if sample images are present.
    Place 3-4 test images at:
      test_images/face_vansh_1.jpg
      test_images/face_vansh_2.jpg
      test_images/face_vansh_3.jpg
    """
    _print_sep("Face Enroll  POST /faces/enroll")
    name = "TestPerson"
    face_images = [
        "test_images/face_test_1.jpg",
        "test_images/face_test_2.jpg",
        "test_images/face_test_3.jpg",
    ]
    available = [p for p in face_images if os.path.exists(p)]
    if len(available) < 3:
        print(f"[SKIP] Need 3 face images in test_images/  (found {len(available)})")
        return

    files = [("images", open(p, "rb")) for p in available]
    try:
        r = requests.post(
            f"{API_URL}/faces/enroll",
            data={"name": name},
            files=files,
            timeout=30,
        )
        print(f"[{r.status_code}] {r.json()}")
    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        for _, fh in files:
            fh.close()


def test_faces_delete():
    _print_sep("Face Delete  DELETE /faces/TestPerson")
    try:
        r = requests.delete(f"{API_URL}/faces/TestPerson", timeout=5)
        print(f"[{r.status_code}] {r.json()}")
    except Exception as e:
        print(f"[ERROR] {e}")


if __name__ == "__main__":
    test_health()
    test_detect_endpoint()
    test_analyze_endpoint()
    test_faces_list()
    test_faces_enroll()
    test_faces_list()     # confirm enroll worked
    test_faces_delete()
    test_faces_list()     # confirm delete worked

