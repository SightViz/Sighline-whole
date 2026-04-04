#!/bin/bash

# SightViz Backend Startup Script

echo "======================================"
echo "🚀 SightViz Backend Starting..."
echo "======================================"

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "sightenv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please create it first:"
    echo "  python -m venv sightenv"
    echo "  source sightenv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source sightenv/bin/activate

# Check if requirements are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

# Check for YOLO model
if [ ! -f "src/yolov8n.pt" ]; then
    echo "⚠️  WARNING: YOLO model not found at src/yolov8n.pt"
    echo "The server may fail to start."
fi

echo ""
echo "✅ Starting server..."
echo "   URL: http://0.0.0.0:8000"
echo "   API Docs: http://0.0.0.0:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo "======================================"
echo ""

# Start server
DEBUG=1 uvicorn main:app --host 0.0.0.0 --port 6969 --reload
