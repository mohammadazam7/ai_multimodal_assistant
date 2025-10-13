from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from ultralytics import YOLO
import shutil
import os
import uuid

# Initialize FastAPI app
app = FastAPI(title="YOLOv8 Object Detection API")

# Load YOLOv8 model (make sure yolov8n.pt is in your project folder)
model = YOLO("yolov8n.pt")

# Create uploads folder if not exists
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def home():
    return {"message": "YOLOv8 Object Detection Backend Running 🚀"}

@app.post("/detect/")
async def detect_object(file: UploadFile = File(...)):
    # Save uploaded image
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run YOLOv8 inference
    results = model(file_path)

    # Extract detection results
    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = model.names[cls_id]
            detections.append({
                "class": label,
                "confidence": round(conf, 3)
            })

    # Return JSON response
    return JSONResponse(content={
        "filename": file.filename,
        "detections": detections
    })
