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
yolo_model
