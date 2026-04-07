# Sightline Server

YOLO-based object detection inference server built with FastAPI.

## Prerequisites

- Python 3.8 or higher
- Virtual environment (recommended)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd sightline-server
```

### 2. Create and Activate Virtual Environment

The project uses a virtual environment named `sightenv`:

```bash
python3 -m venv sightenv
source sightenv/bin/activate
```

On Windows:
```bash
sightenv\Scripts\activate
```

### 3. Install Dependencies

Install the minimal required dependencies:

```bash
pip install -e .
```

**Core Dependencies:**
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `ultralytics` - YOLOv8 (includes numpy, torch, opencv-python, etc.)
- `pillow` - Image processing
- `python-multipart` - File upload support

For development dependencies:
```bash
pip install -e ".[dev]"
```

### 4. Verify Installation

Check that all dependencies are installed:
```bash
python -c "import fastapi, ultralytics, PIL; print('All dependencies installed successfully')"
```

## Running the Server

### Start the FastAPI Server

```bash
uvicorn src.server:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`

### API Endpoints

#### Health Check
```bash
GET /
```

Response:
```json
{
  "status": "Sightline inference server running"
}
```

#### Object Detection
```bash
POST /detect
```

Upload an image file for object detection.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: Image file

**Response:**
```json
{
  "frame_id": "uuid",
  "timestamp_ms": 1234567890,
  "image_size": {
    "width": 1920,
    "height": 1080
  },
  "detections": [
    {
      "id": "uuid",
      "label": "person",
      "confidence": 0.95,
      "bbox": {
        "x": 100,
        "y": 200,
        "width": 150,
        "height": 300
      }
    }
  ],
  "inference_ms": 45
}
```

### Example Request (cURL)

```bash
curl -X POST "http://localhost:8000/detect" \
  -F "file=@path/to/image.jpg"
```

## Project Structure

```
sightline-server/
 src/
    server.py              # FastAPI server and endpoints
    basetrack.py           # Base tracking classes
    byte_tracker.py        # ByteTrack implementation
    bytetrack_all80.yaml   # Tracker configuration
    yolo26s.pt             # YOLO model weights
 sightenv/                  # Virtual environment
 pyproject.toml            # Project configuration
 README.md                 # This file
```

## Development

### Code Formatting

Format code with Black:
```bash
black src/
```

### Linting

Lint code with Ruff:
```bash
ruff check src/
```

## Model Information

The server uses YOLO26s (small) model for object detection. The model file `yolo26s.pt` should be present in the `src/` directory.

**Model Performance:**
- Better accuracy than YOLOv8n
- mAP: 48.6 (vs 37.3 for YOLOv8n)
- Params: 9.5M (vs 3.2M for YOLOv8n)
- Speed: ~2.5ms per image on GPU

## CORS Configuration

The server is configured to accept requests from any origin (`*`). For production deployments, configure specific allowed origins in `src/server.py`.

## Troubleshooting

### Virtual Environment Not Activating

Make sure you're in the project root directory and the virtual environment exists:
```bash
ls sightenv/bin/activate
```

### Missing Dependencies

If you encounter import errors, reinstall dependencies:
```bash
pip install --upgrade -e .
```

### YOLO Model Not Found

Ensure `yolo26s.pt` is in the `src/` directory. Download it from Ultralytics if missing.

## License

See project license for details.
