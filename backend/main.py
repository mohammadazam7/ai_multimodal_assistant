from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import torch
import cv2
import transformers
import numpy as np
import base64
from PIL import Image
import io
import uvicorn

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable for YOLO model
yolo_model = None

def initialize_yolo():
    """Initialize YOLO model"""
    global yolo_model
    try:
        from ultralytics import YOLO
        yolo_model = YOLO('yolov8n.pt')
        print("✅ YOLO model loaded successfully")
        return True
    except Exception as e:
        print(f"❌ YOLO not available: {e}")
        return False

def detect_objects_yolo(image):
    """YOLO object detection"""
    global yolo_model
    
    if yolo_model is None:
        return detect_objects_simple(image)
    
    try:
        img_array = np.array(image)
        results = yolo_model(img_array, verbose=False)
        
        detected_objects = []
        
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    
                    if confidence > 0.5:
                        object_name = yolo_model.names[class_id]
                        detected_objects.append(f"{object_name} ({confidence:.1%})")
        
        return detected_objects if detected_objects else ["No objects detected"]
        
    except Exception as e:
        print(f"YOLO detection failed: {e}")
        return detect_objects_simple(image)

def detect_objects_simple(image):
    """Simple edge detection fallback"""
    opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_pixels = np.sum(edges > 0)
    
    objects = []
    if edge_pixels > 10000:
        objects.append("Complex Scene")
    elif edge_pixels > 5000:
        objects.append("Objects Detected")
    else:
        objects.append("Simple Scene")
    
    return objects

# Initialize YOLO on startup
@app.on_event("startup")
async def startup_event():
    print("🚀 Starting AI Assistant Backend...")
    success = initialize_yolo()
    if success:
        print("✅ Advanced object detection ready")
    else:
        print(⚠️ Using simple edge detection")

# API Endpoints
@app.get("/")
def health_check():
    global yolo_model
    model_status = "YOLO Ready" if yolo_model else "Simple Detection"
    return {
        "message": "AI Assistant Backend Online", 
        "status": "ready",
        "detection_mode": model_status
    }

@app.get("/ai/status")
def ai_status():
    global yolo_model
    return {
        "pytorch": torch.__version__,
        "opencv": cv2.__version__,
        "transformers": transformers.__version__,
        "cuda": torch.cuda.is_available(),
        "yolo_available": yolo_model is not None,
        "detection_classes": len(yolo_model.names) if yolo_model else 0,
        "message": "AI systems operational"
    }

@app.get("/ai/test")
def test_ai():
    global yolo_model
    mode = "Advanced YOLO" if yolo_model else "Basic Edge Detection"
    return {
        "response": f"AI brain working with {mode}!", 
        "status": "success"
    }

@app.get("/ai/capabilities")
def get_capabilities():
    global yolo_model
    
    if yolo_model:
        detectable_objects = list(yolo_model.names.values())
        return {
            "detection_method": "YOLO v8",
            "total_classes": len(detectable_objects),
            "objects": detectable_objects,
            "examples": [
                "person", "bicycle", "car", "motorcycle", "airplane",
                "bus", "train", "truck", "boat", "traffic light",
                "fire hydrant", "stop sign", "parking meter", "bench",
                "bird", "cat", "dog", "horse", "sheep", "cow",
                "elephant", "bear", "zebra", "giraffe", "backpack",
                "umbrella", "handbag", "tie", "suitcase", "frisbee",
                "skis", "snowboard", "sports ball", "kite", "baseball bat",
                "baseball glove", "skateboard", "surfboard", "tennis racket",
                "bottle", "wine glass", "cup", "fork", "knife",
                "spoon", "bowl", "banana", "apple", "sandwich",
                "orange", "broccoli", "carrot", "hot dog", "pizza",
                "donut", "cake", "chair", "couch", "potted plant",
                "bed", "dining table", "toilet", "tv", "laptop",
                "mouse", "remote", "keyboard", "cell phone", "microwave",
                "oven", "toaster", "sink", "refrigerator", "book",
                "clock", "scissors", "teddy bear", "hair drier", "toothbrush"
            ]
        }
    else:
        return {
            "detection_method": "Simple Edge Detection",
            "total_classes": 3,
            "objects": ["Simple Scene", "Objects Detected", "Complex Scene"],
            "note": "Install ultralytics for advanced object detection"
        }

@app.post("/ai/analyze-frame")
def analyze_frame(request: dict):
    """Analyze camera frame for object detection"""
    try:
        image_data = request.get("image", "")
        
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        detected_objects = detect_objects_yolo(image)
        
        return {
            "status": "success",
            "objects": detected_objects,
            "object_count": len(detected_objects),
            "detection_method": "YOLO v8" if yolo_model else "Edge Detection",
            "message": f"Analysis complete: {len(detected_objects)} objects found",
            "image_size": f"{image.width}x{image.height}",
            "timestamp": "real-time"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "objects": [],
            "message": f"Analysis failed: {str(e)}",
            "detection_method": "error"
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)