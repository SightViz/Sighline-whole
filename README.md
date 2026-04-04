#  SightViz - Assistive Spatial Guidance System

**Real-time spatial guidance for visually impaired users**

---

##  Quick Start (2 Steps)

### 1. Start Backend
```bash
cd sightline-server
./start_server.sh
```
Server will run at `http://0.0.0.0:8000`

### 2. Start Mobile App
```bash
cd sightline-app
npx expo start
```
Scan QR code with Expo Go app on your phone.

---

##  Using the App

1. Open app → Navigate to **"Engine"** tab (bottom right)
2. Press **"Start"**
3. Point camera at your environment
4. **Listen** for spatial guidance

The system will tell you:
- What's in front of you
- How far away it is
- What direction it's in

---

##  What Makes This Different

This is **NOT** an image description app.  
This is a **decision system for navigation and safety**.

### Philosophy
> "Convert perception into guidance, not narration"

- **Silence-first:** Only speaks on changes
- **Priority-based:** Safety objects first
- **Low cognitive load:** One sentence max
- **Real-time:** <500ms latency

---

##  Project Structure

```
sightline-whole/
 sightline-server/      # FastAPI backend + Spatial Engine
    main.py            # Server entry point
    engine/            # Core spatial intelligence
       engine.py      # Decision logic
       adapter.py     # YOLO → Detection converter
       models.py      # Data structures
       config.py      # Configuration
    tests/             # Unit + integration tests
    start_server.sh    # Quick start script

 sightline-app/         # React Native (Expo) mobile app
    app/
       index.tsx      # Main app (with Engine tab)
       pages/
           spatial_engine_demo.tsx  # NEW demo page
    services/
        detectionService.ts  # API client

 docs/
     INTEGRATION_COMPLETE.md    # Quick start guide
     IMPLEMENTATION_SUMMARY.md  # Full technical details
```

---

##  How It Works

```
Camera → YOLO → Adapter → Spatial Engine → Speech
```

1. **Camera** captures frame every 2.5 seconds
2. **YOLO** detects objects with bounding boxes
3. **Adapter** converts bbox → (direction, distance)
4. **Spatial Engine** applies:
   - Confidence filtering
   - Object tracking
   - Priority rules (Safety > Navigation > Decorative)
   - Delta detection
   - Speech gating (cooldown)
5. **Output:** Single sentence OR silence

---

##  Key Features

### Intelligent Silence
System returns **null** (silence) when:
- Same message as before
- Within cooldown period (2s)
- No priority objects
- Low confidence
- Empty scene

### Smart Priority
**Object Classes:**
1. Safety (stairs, person) - **Always priority**
2. Navigation (door, exit, sign)
3. Decorative (chair, table, plant)

**Distance Priority:**  
Very Close > Close > Medium > Far

**Direction Priority:**  
Front > Left/Right

### Path Clear Detection
When objects disappear:
```
"Chair on your right" → (objects gone) → "Path clear"
```

---

##  Performance

| Metric | Target | Typical |
|--------|--------|---------|
| Total latency | <500ms | 200-350ms |
| YOLO inference | <200ms | 100-150ms |
| Frame interval | 2.5s | 2.5s |
| Speech cooldown | 2s | 2s |

---

##  Testing

### Backend Tests
```bash
cd sightline-server
pytest tests/ -v
```

### Manual Testing
```bash
python tests/test_manual.py
```

### API Testing
```bash
# Health check
curl http://localhost:8000/

# Analyze image
curl -X POST http://localhost:8000/analyze -F "file=@test.jpg"
```

---

##  Configuration

### Backend Environment
```bash
DEBUG=1                    # Enable debug output
CONFIDENCE_THRESHOLD=0.5   # Minimum confidence
COOLDOWN_SECONDS=2.0       # Speech cooldown
```

### Mobile App
Edit `sightline-app/services/config.ts` to change server URL.

---

##  Documentation

- [INTEGRATION_COMPLETE.md](./INTEGRATION_COMPLETE.md) - Quick start guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Full technical details
- [sightline-server/BACKEND_README.md](./sightline-server/BACKEND_README.md) - Backend guide

---

##  Troubleshooting

**Backend won't start:**
```bash
pip install -r requirements.txt --force-reinstall
```

**Mobile app can't connect:**
- Ensure phone and computer on same WiFi
- Backend must use `0.0.0.0`, not `127.0.0.1`

**No speech output:**
- Enable DEBUG=1 to see logs
- Wait 2+ seconds between frames
- Point at larger objects

**Import errors:**
```bash
cd sightline-server
python -c "from engine import SpatialEngine; print('OK')"
```

---

##  Technical Highlights

### Detection Adapter
Converts YOLO bounding boxes → semantic spatial properties
```python
direction = horizontal_thirds(bbox.cx)  # left/front/right
distance = height_ratio(bbox.h)         # bucket estimation
```

### Stateful Engine
Maintains context across frames
```python
- last_spoken_message  # Prevent repeats
- last_spoken_timestamp  # Enforce cooldown
- was_busy  # Enable "path clear" transitions
```

### Safe Failure Handling
All errors result in silence (never crash)
```python
try:
    speech = process_frame(...)
except Exception:
    speech = None  # Fail silent
```

---

##  Production Readiness

 Clean architecture  
 Error handling  
 Test coverage  
 Performance optimized  
 Comprehensive documentation  
 Backward compatible  

---

##  Future Enhancements

- [ ] GPU acceleration for YOLO
- [ ] User sessions (multi-user)
- [ ] Voice control
- [ ] Offline mode
- [ ] Redis state storage (scale-out)
- [ ] Monocular depth estimation
- [ ] Custom priority preferences

---

##  License

[Add your license here]

---

##  Acknowledgments

Built for visually impaired users who deserve better spatial awareness technology.

---

** Ready to demo! Start the backend, launch the app, tap "Engine" tab, and experience real-time spatial guidance.**
