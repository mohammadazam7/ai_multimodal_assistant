from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import torch
import cv2
import transformers
import numpy as np
import base64
from PIL import Image
import io

app = FastAPI()

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load a simple object detection model (you can enhance this later)
def detect_objects_simple(image):
    """
    Simple object detection using OpenCV
    This is a basic implementation - we'll enhance it with YOLO later
    """
    # Convert PIL image to OpenCV format
    opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Simple edge detection as placeholder
    gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    # Count edge pixels as a simple "object detection"
    edge_pixels = np.sum(edges > 0)
    
    # Simple logic to detect "objects" based on edge density
    objects = []
    if edge_pixels > 10000:
        objects.append("Complex Scene")
    if edge_pixels > 5000:
        objects.append("Objects Detected")
    else:
        objects.append("Simple Scene")
    
    return objects

@app.get("/")
def health_check():
    return {"message": "AI Assistant Backend Online", "status": "ready"}

@app.get("/ai/status")
def ai_status():
    return {
        "pytorch": torch.__version__,
        "opencv": cv2.__version__,
        "transformers": transformers.__version__,
        "cuda": torch.cuda.is_available(),
        "message": "AI systems operational"
    }

@app.get("/ai/test")
def test_ai():
    return {"response": "AI brain is working!", "status": "success"}

@app.post("/ai/analyze-frame")
def analyze_frame(request: dict):
    """
    Analyze camera frame for object detection
    """
    try:
        # Get base64 image from request
        image_data = request.get("image", "")
        
        # Remove data URL prefix if present
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        # Decode base64 to image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Perform object detection
        detected_objects = detect_objects_simple(image)
        
        return {
            "status": "success",
            "objects": detected_objects,
            "message": f"Found {len(detected_objects)} objects",
            "image_size": f"{image.width}x{image.height}"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "objects": [],
            "message": f"Analysis failed: {str(e)}"
        }