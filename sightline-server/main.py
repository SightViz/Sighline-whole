"""
SightViz Backend Server
FastAPI server exposing object detection, spatial engine, and face recognition APIs.
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import uuid
import time
import os
from typing import List, Optional
from pydantic import BaseModel

from engine import SpatialEngine, DetectionAdapter
from engine.face_recognition import enroll_person, recognize_person, list_enrolled, delete_person

# ============================================================================
# APP INIT
# ============================================================================

app = FastAPI(
    title="SightViz Backend",
    description="Real-time spatial guidance and face recognition for visually impaired users",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# GLOBAL SINGLETONS
# ============================================================================

model = YOLO("src/yolo26s.pt")
spatial_engine = SpatialEngine()

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class AnalyzeResponse(BaseModel):
    speech: Optional[str]
    debug: Optional[dict] = None


class DetectResponse(BaseModel):
    frame_id: str
    timestamp_ms: int
    image_size: dict
    detections: list
    inference_ms: int


class EnrollResponse(BaseModel):
    success: bool
    enrolled: int
    failed: int
    message: str


class FaceListResponse(BaseModel):
    faces: dict  # name -> photo count


# ============================================================================
# HELPERS
# ============================================================================

def _run_yolo(image: Image.Image):
    return model(image, verbose=False)[0]


def _enrich_with_faces(detections, image: Image.Image):
    """
    For every 'person' Detection, crop the bbox, run face recognition,
    and set detection.recognized_name when a match is found.
    """
    try:
        for d in detections:
            if d.label.lower() != "person" or d.bbox is None:
                continue
            x1 = max(0, int(d.bbox.x))
            y1 = max(0, int(d.bbox.y))
            x2 = min(image.width, int(d.bbox.x + d.bbox.w))
            y2 = min(image.height, int(d.bbox.y + d.bbox.h))
            if x2 <= x1 or y2 <= y1:
                continue
            crop = image.crop((x1, y1, x2, y2))
            name = recognize_person(crop)
            if name:
                d.recognized_name = name
    except Exception as e:
        print(f"[WARN] Face enrichment skipped: {e}")


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/")
def health():
    return {
        "status": "SightViz Backend Online",
        "version": "3.0.0",
        "endpoints": {
            "detection": ["POST /detect", "POST /analyze"],
            "faces": [
                "POST /faces/enroll",
                "GET /faces/list",
                "DELETE /faces/{name}",
            ],
        },
    }


# --- Normal scan mode: raw object detections ---

@app.post("/detect", response_model=DetectResponse)
async def detect(file: UploadFile = File(...)):
    """
    Run YOLO inference and return raw detections.
    Used by the app normal scan mode.
    """
    start_time = time.time()
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        results = _run_yolo(image)

        detections_out = []
        for box in results.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections_out.append({
                "id": str(uuid.uuid4()),
                "label": label,
                "confidence": round(confidence, 3),
                "bbox": {
                    "x": round(x1, 1),
                    "y": round(y1, 1),
                    "width": round(x2 - x1, 1),
                    "height": round(y2 - y1, 1),
                },
            })

        inference_ms = int((time.time() - start_time) * 1000)
        return DetectResponse(
            frame_id=str(uuid.uuid4()),
            timestamp_ms=int(time.time() * 1000),
            image_size={"width": image.width, "height": image.height},
            detections=detections_out,
            inference_ms=inference_ms,
        )
    except Exception as e:
        print(f"[ERROR] /detect failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Spatial engine mode: speech guidance with face recognition ---

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...)):
    """
    Analyze a frame through the Spatial Engine and return speech guidance.
    Person detections are enriched with face recognition so the engine
    says 'Vansh ahead' instead of 'Person ahead' when a known face is seen.
    """
    start_time = time.time()
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        results = _run_yolo(image)
        adapter = DetectionAdapter(image.width, image.height)
        detections = adapter.convert(results.boxes, model)

        _enrich_with_faces(detections, image)

        speech_output = spatial_engine.process_frame(detections)
        latency_ms = int((time.time() - start_time) * 1000)

        debug_info = None
        if os.getenv("DEBUG", "0") == "1":
            debug_info = {
                "latency_ms": latency_ms,
                "num_detections": len(detections),
                "raw_yolo_count": len(results.boxes),
                "detections": [
                    {
                        "label": d.label,
                        "recognized_name": d.recognized_name,
                        "direction": d.direction.value,
                        "distance": d.distance.value,
                        "confidence": round(d.confidence, 2),
                    }
                    for d in detections
                ],
            }

        return AnalyzeResponse(speech=speech_output, debug=debug_info)

    except Exception as e:
        print(f"[ERROR] /analyze failed: {e}")
        debug_info = {"error": str(e)} if os.getenv("DEBUG", "0") == "1" else None
        return AnalyzeResponse(speech=None, debug=debug_info)


# --- Face recognition CRUD ---

@app.post("/faces/enroll", response_model=EnrollResponse)
async def faces_enroll(
    name: str = Form(...),
    images: List[UploadFile] = File(...),
):
    """
    Enroll a person with 3-4 face images from different angles.
    Generates and stores 512-d FaceNet embeddings in the face database.
    """
    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name must not be empty.")
    if len(images) < 3:
        raise HTTPException(status_code=422, detail="At least 3 images are required.")

    pil_images = []
    for img_file in images:
        data = await img_file.read()
        pil_images.append(Image.open(io.BytesIO(data)).convert("RGB"))

    result = enroll_person(name, pil_images)
    return EnrollResponse(**result)


@app.get("/faces/list", response_model=FaceListResponse)
def faces_list():
    """Return all enrolled people and how many embeddings each has."""
    return FaceListResponse(faces=list_enrolled())


@app.delete("/faces/{name}")
def faces_delete(name: str):
    """Remove a person from the face database."""
    if not delete_person(name):
        raise HTTPException(status_code=404, detail=f"'{name}' not found in database.")
    return {"success": True, "message": f"'{name}' removed from database."}


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("[STARTUP] SightViz Backend v3.0")
    print(f"   YOLO model: yolo26s.pt")
    print(f"   Spatial Engine: ready")
    print(f"   Face Recognition: ready (models lazy-load on first call)")
    print(f"   Debug: {os.getenv('DEBUG', '0')}")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    print("[SHUTDOWN] SightViz Backend shutting down.")
