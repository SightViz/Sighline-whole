from facenet_pytorch import MTCNN
from PIL import Image
import matplotlib.pyplot as plt

# Initialize MTCNN
mtcnn = MTCNN(keep_all=True)  # keep_all=True detects ALL faces in image

# Load your image
img = Image.open("test.jpg")
print("✅ Image loaded!")
print(f"Image size: {img.size}")  # width x height

# Detect faces
boxes, probs = mtcnn.detect(img)

print(f"\n🔍 Faces detected: {len(boxes)}")
print(f"Face box coordinates: {boxes}")
print(f"Confidence scores: {probs}")

# Draw boxes on image to visualize
import cv2
import numpy as np

img_cv = cv2.imread("test.jpg")

for i, box in enumerate(boxes):
    x1, y1, x2, y2 = [int(b) for b in box]
    cv2.rectangle(img_cv, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.putText(img_cv, f"Face {i+1}: {probs[i]:.2f}",
                (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (0, 255, 0), 2)

cv2.imshow("Detected Faces", img_cv)
cv2.waitKey(0)
cv2.destroyAllWindows()