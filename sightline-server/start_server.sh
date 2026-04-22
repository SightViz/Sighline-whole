#!/bin/bash

# SightViz Backend Startup Script

echo "======================================"
echo "SightViz Backend Starting..."
echo "======================================"

cd "$(dirname "$0")"

# Ensure face DB data directory exists
mkdir -p data

# Check if virtual environment exists
if [ ! -d "sightenv" ]; then
    echo "Virtual environment not found. Creating it..."
    python3 -m venv sightenv
    source sightenv/bin/activate
    pip install -r requirements.txt
else
    source sightenv/bin/activate
fi

# Install / sync requirements if anything is missing
if ! python -c "import fastapi" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

if ! python -c "import facenet_pytorch" 2>/dev/null; then
    echo "Installing face recognition dependencies..."
    pip install -r requirements.txt
fi

# Check for YOLO model
if [ ! -f "src/yolo26s.pt" ]; then
    echo "WARNING: YOLO model not found at src/yolo26s.pt"
    echo "The server will fail on detection requests."
fi

PORT="${PORT:-6969}"

echo ""
echo "Starting server on port $PORT..."
echo "   Local:   http://0.0.0.0:$PORT"
echo "   Docs:    http://0.0.0.0:$PORT/docs"
echo "   Faces:   http://0.0.0.0:$PORT/faces/list"
echo ""
echo "Press Ctrl+C to stop"
echo "======================================"
echo ""

DEBUG="${DEBUG:-0}" uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload
