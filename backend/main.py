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