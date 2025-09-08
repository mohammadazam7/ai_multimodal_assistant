from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import torch
import cv2
import transformers
import numpy as np
import base64
from PIL import Image
import io
import requests
from ultralytics import YOLO

app = FastAPI()

# CORS Configuration - allows frontend to communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],    # Allow all HTTP methods
    allow_headers=["*"],    # Allow all headers
)

# Global variable to store YOLO model
yolo_model = None

def initialize_yolo():
    """
    Initialize YOLO model for object detection
    
    What this does:
    - Downloads pre-trained YOLO model (trained on millions of images)
    - Loads it into memory for fast inference
    - This model can detect 80 different object types
    
    Why we do this:
    - YOLO is state-of-the-art object detection
    - Pre-trained means we don't need to train it ourselves
    - Can detect specific objects like "person", "car", "dog", etc.
    """
    global yolo_model
    try:
        # Load YOLOv8 nano model (smallest, fastest version)
        # 'yolov8n.pt' will be downloaded automatically first time
        yolo_model = YOLO('yolov8n.pt')
        print("✅ YOLO model loaded successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to load YOLO: {e}")
        return False

def detect_objects_yolo(image):
    """
    Advanced object detection using YOLO
    
    Process:
    1. Convert PIL image to format YOLO understands
    2. Run YOLO inference (AI prediction)
    3. Extract object names and confidence scores
    4. Return list of detected objects
    
    Args:
        image: PIL Image object from camera
    
    Returns:
        list: Detected objects with confidence scores
    """
    global yolo_model
    
    # Fallback to simple detection if YOLO fails
    if yolo_model is None:
        return detect_objects_simple(image)
    
    try:
        # Convert PIL image to numpy array for YOLO
        img_array = np.array(image)
        
        # Run YOLO inference
        # verbose=False: Don't print debug information
        results = yolo_model(img_array, verbose=False)
        
        detected_objects = []
        
        # Process YOLO results
        for result in results:
            # result.boxes contains detection information
            if result.boxes is not None:
                for box in result.boxes:
                    # Get class ID (what object type)
                    class_id = int(box.cls[0])
                    
                    # Get confidence score (how sure the AI is)
                    confidence = float(box.conf[0])
                    
                    # Only include high-confidence detections
                    if confidence > 0.5:  # 50% confidence threshold
                        # Get object name from class ID
                        object_name = yolo_model.names[class_id]
                        
                        # Add confidence percentage to object name
                        detected_objects.append(f"{object_name} ({confidence:.1%})")
        
        # Return detected objects or fallback message
        return detected_objects if detected_objects else ["No objects detected"]
        
    except Exception as e:
        print(f"YOLO detection failed: {e}")
        # Fallback to simple edge detection
        return detect_objects_simple(image)

def detect_objects_simple(image):
    """
    Simple object detection using OpenCV edge detection (backup method)
    
    This is our fallback when YOLO isn't available
    """
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

# Initialize YOLO when server starts
@app.on_event("startup")
async def startup_event():
    """
    Run this function when the server starts
    
    What happens:
    - Server boots up
    - Attempts to load YOLO model
    - If successful: advanced object detection available
    - If failed: falls back to simple edge detection
    
    Why we do this:
    - Loading AI models takes time
    - Better to load once at startup than every request
    - Graceful fallback if YOLO installation fails
    """
    print("🚀 Starting AI Assistant Backend...")
    print("📦 Loading YOLO model...")
    
    success = initialize_yolo()
    if success:
        print("✅ Advanced object detection ready")
    else:
        print("⚠️ Using simple edge detection as fallback")

# API ENDPOINTS

@app.get("/")
def health_check():
    """Basic health check endpoint"""
    global yolo_model
    model_status = "YOLO Ready" if yolo_model else "Simple Detection"
    return {
        "message": "AI Assistant Backend Online", 
        "status": "ready",
        "detection_mode": model_status
    }

@app.get("/ai/status")
def ai_status():
    """Return AI system status and capabilities"""
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
    """Simple test endpoint"""
    global yolo_model
    mode = "Advanced YOLO" if yolo_model else "Basic Edge Detection"
    return {
        "response": f"AI brain working with {mode}!", 
        "status": "success"
    }

@app.get("/ai/capabilities")
def get_capabilities():
    """
    Return what objects the AI can detect
    
    Why this is useful:
    - Frontend can show users what to expect
    - Helps with testing (point camera at known objects)
    - Educational - shows AI's knowledge scope
    """
    global yolo_model
    
    if yolo_model:
        # YOLO can detect 80 different object types
        detectable_objects = list(yolo_model.names.values())
        return {
            "detection_method": "YOLO v8",
            "total_classes": len(detectable_objects),
            "objects": detectable_objects,
            "examples": [
                "person", "bicycle", "car", "motorcycle", "airplane",
                "bus", "train", "truck", "boat", "traffic light",
                "fire hydrant", "stop sign", "parking meter", "bench",
                "bird", "cat", "dog", "horse", "sheep", "cow"
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
    """
    Analyze camera frame for object detection
    
    Enhanced Process:
    1. Receive base64 image from frontend
    2. Decode to PIL Image
    3. Run YOLO object detection (or fallback to simple)
    4. Return detailed analysis with object names and confidence
    
    What's new:
    - Specific object identification instead of just "objects detected"
    - Confidence scores for each detection
    - More detailed analysis results
    """
    try:
        # Extract and decode image (same as before)
        image_data = request.get("image", "")
        
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Perform advanced object detection
        detected_objects = detect_objects_yolo(image)
        
        # Enhanced response with more information
        return   {
            "detection_method": "Simple Edge Detection",
            "total_classes": 3,
            "objects": ["Simple Scene", "Objects Detected", "Complex Scene"],
            "note": "Install ultralytics for advanced object detection"
        }

@app.post("/ai/analyze-frame")
def analyze_frame(request: dict):
    """
    Analyze camera frame for object detection
    
    Enhanced Process:
    1. Receive base64 image from frontend
    2. Decode to PIL Image
    3. Run YOLO object detection (or fallback to simple)
    4. Return detailed analysis with object names and confidence
    
    What's new:
    - Specific object identification instead of just "objects detected"
    - Confidence scores for each detection
    - More detailed analysis results
    """
    try:
        # Extract and decode image (same as before)
        image_data = request.get("image", "")
        
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Perform advanced object detection
        detected_objects = detect_objects_yolo(image)
        
        # Enhanced response with more information
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

# Additional endpoint for real-time streaming (future enhancement)
@app.post("/ai/analyze-stream")
def analyze_stream(request: dict):
    """
    Future endpoint for continuous video stream analysis
    
    This will enable:
    - Real-time object tracking
    - Motion detection
    - Multiple frame analysis for better accuracy
    """
    # Placeholder for future implementation
    return {
        "status": "not_implemented",
        "message": "Stream analysis coming in next version"
    }

# To run: 
# pip install ultralytics
# uvicorn main:app --reload --host 0.0.0.0 --port 8000