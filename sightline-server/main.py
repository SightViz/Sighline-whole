"""
SightViz Backend Server
FastAPI server with integrated Spatial Engine for real-time spatial guidance
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import uuid
import time
import os
from typing import Optional
from pydantic import BaseModel

# Import spatial engine components
from engine import SpatialEngine, DetectionAdapter

# Initialize FastAPI
app = FastAPI(
    title="SightViz Backend",
    description="Real-time spatial guidance for visually impaired users",
    version="2.0.0"
)

# CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# GLOBAL SINGLETONS (initialized at startup)
# ============================================================================

# YOLO model for object detection
model = YOLO("src/yolo26s.pt")

# Spatial Engine - STATEFUL, persists across requests
spatial_engine = SpatialEngine()

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class AnalyzeResponse(BaseModel):
    """Response from /analyze endpoint"""
    speech: Optional[str]  # null = silence, string = speak this
    debug: Optional[dict] = None  # debug info (only when DEBUG=1)


class LegacyDetectionResponse(BaseModel):
    """Legacy /detect endpoint response (backward compatibility)"""
    frame_id: str
    timestamp_ms: int
    image_size: dict
    detections: list
    inference_ms: int


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/")
def health():
    """Health check endpoint"""
    return {
        "status": "SightViz Backend Online",
        "engine": "ready",
        "model": "yolo26s",
        "version": "2.0.0"
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...)):
    """
    Main endpoint: Analyze image and return spatial guidance
    
    Flow:
    1. Load image
    2. Run YOLO detection
    3. Convert to Detection objects (adapter)
    4. Process through Spatial Engine
    5. Return speech output (or null for silence)
    
    Returns:
        AnalyzeResponse with speech field (null or string)
    """
    start_time = time.time()
    
    try:
        # Step 1: Load image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Step 2: YOLO inference
        results = model(image, verbose=False)[0]
        
        # Step 3: Convert to Detection format
        adapter = DetectionAdapter(image.width, image.height)
        detections = adapter.convert(results.boxes, model)
        
        # Step 4: Process through Spatial Engine
        speech_output = spatial_engine.process_frame(detections)
        
        # Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Step 5: Return response
        debug_info = None
        if os.getenv("DEBUG", "0") == "1":
            debug_info = {
                "latency_ms": latency_ms,
                "num_detections": len(detections),
                "raw_yolo_count": len(results.boxes),
                "detections": [
                    {
                        "label": d.label,
                        "direction": d.direction.value,
                        "distance": d.distance.value,
                        "confidence": round(d.confidence, 2)
                    }
                    for d in detections
                ]
            }
        
        return AnalyzeResponse(
            speech=speech_output,
            debug=debug_info
        )
        
    except Exception as e:
        # Graceful failure: return silence on error
        print(f"[ERROR] /analyze failed: {e}")
        
        debug_info = None
        if os.getenv("DEBUG", "0") == "1":
            debug_info = {"error": str(e)}
        
        return AnalyzeResponse(
            speech=None,
            debug=debug_info
        )


@app.post("/detect", response_model=LegacyDetectionResponse)
async def detect(file: UploadFile = File(...)):
    """
    Legacy endpoint for backward compatibility
    Returns raw YOLO detections without spatial processing
    """
    start_time = time.time()

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    results = model(image, verbose=False)[0]

    detections = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        label = model.names[cls_id]

        x1, y1, x2, y2 = box.xyxy[0].tolist()

        detections.append(
            {
                "id": str(uuid.uuid4()),
                "label": label,
                "confidence": float(box.conf[0]),
                "bbox": {"x": int(x1), "y": int(y1), "width": int(x2 - x1), "height": int(y2 - y1)},
            }
        )

    return LegacyDetectionResponse(
        frame_id=str(uuid.uuid4()),
        timestamp_ms=int(time.time() * 1000),
        image_size={"width": image.width, "height": image.height},
        detections=detections,
        inference_ms=int((time.time() - start_time) * 1000)
    )


# ============================================================================
# STARTUP/SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Log startup info"""
    print("=" * 60)
    print("[STARTUP] SightViz Backend Starting...")
    print(f"   Model: YOLO26s")
    print(f"   Spatial Engine: Initialized")
    print(f"   Debug Mode: {os.getenv('DEBUG', '0')}")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("Shutting down SightViz Backend...")
