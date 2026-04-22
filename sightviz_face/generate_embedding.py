from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image
import torch

# Load models
mtcnn = MTCNN()
model = InceptionResnetV1(pretrained='vggface2').eval()

# Load image
img = Image.open("test.jpg")

# Step 1 - Detect and crop face
face_tensor = mtcnn(img)

print(f"✅ Face detected and cropped!")
print(f"Face tensor shape: {face_tensor.shape}")
# Should be: torch.Size([3, 160, 160])
# 3 = RGB channels, 160x160 = face size FaceNet expects

# Step 2 - Generate embedding
with torch.no_grad():
    embedding = model(face_tensor.unsqueeze(0))

print(f"\n✅ Embedding generated!")
print(f"Embedding shape: {embedding.shape}")
# Should be: torch.Size([1, 512])

print(f"\nFirst 10 numbers of your face fingerprint:")
print(embedding[0][:10])

print(f"\nTotal numbers in fingerprint: {embedding.shape[1]}")