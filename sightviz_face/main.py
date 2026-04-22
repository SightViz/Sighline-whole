from facenet_pytorch import MTCNN, InceptionResnetV1
import torch
import numpy as np

# Load models
mtcnn = MTCNN()
model = InceptionResnetV1(pretrained='vggface2').eval()

print("✅ MTCNN loaded!")
print("✅ FaceNet model loaded!")
print("✅ PyTorch version:", torch.__version__)
print("✅ Setup complete! Ready to go.")