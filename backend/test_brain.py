import torch
import cv2
import transformers
from fastapi import FastAPI

print("AI Brain Test Starting...")
print("PyTorch version:", torch.__version__)
print("OpenCV version:", cv2.__version__)
print("Transformers version:", transformers.__version__)
print("CUDA available:", torch.cuda.is_available())

app = FastAPI()

@app.get("/")
def test_ai():
    return {"message": "AI Assistant Brain is ALIVE!", "status": "success"}

print("All AI tools working! Brain is ready!")