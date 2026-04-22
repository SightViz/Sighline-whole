from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image
import torch
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

mtcnn = MTCNN()
model = InceptionResnetV1(pretrained='vggface2').eval()

def get_embedding(image_path):
    img = Image.open(image_path)
    face = mtcnn(img)
    if face is None:
        print(f"❌ No face found in {image_path}")
        return None
    with torch.no_grad():
        embedding = model(face.unsqueeze(0))
    return embedding.numpy()

# ---- ENROLLMENT ----
# Store multiple embeddings for same person
print("📸 Enrolling person with multiple photos...")

enrolled_embeddings = []
photos = ["test.jpg", "test2.jpg"]  # add more if you have them

for photo in photos:
    emb = get_embedding(photo)
    if emb is not None:
        enrolled_embeddings.append(emb)
        print(f"✅ Enrolled: {photo}")

print(f"Total enrolled photos: {len(enrolled_embeddings)}")

# ---- RECOGNITION ----
# Test against the same photos
print("\n🔍 Testing recognition...")

test_photo = "test5.jpg"
test_emb = get_embedding(test_photo)

# Compare against ALL enrolled embeddings
scores = []
for stored_emb in enrolled_embeddings:
    score = cosine_similarity(test_emb, stored_emb)[0][0]
    scores.append(score)
    print(f"Individual score: {score:.4f}")

# Take the BEST score (not average)
best_score = max(scores)
avg_score = np.mean(scores)

print(f"\n📊 Results:")
print(f"Best score:    {best_score:.4f}")
print(f"Average score: {avg_score:.4f}")

# Use lower threshold for SightViz
threshold = 0.5
if best_score >= threshold:
    print(f"✅ SAME PERSON RECOGNIZED! (best score: {best_score:.4f})")
else:
    print(f"❌ NOT RECOGNIZED (best score: {best_score:.4f})")