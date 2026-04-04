from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import uuid
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("src/yolov8n.pt")

@app.get("/")
def health():
    return {"status": "Sightline inference server running"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    start_time = time.time()

    print("helllo, this works")

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

    return {
        "frame_id": str(uuid.uuid4()),
        "timestamp_ms": int(time.time() * 1000),
        "image_size": {"width": image.width, "height": image.height},
        "detections": detections,
        "inference_ms": int((time.time() - start_time) * 1000),
    }
