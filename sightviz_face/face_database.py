from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image
import torch
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pickle
import os

# Load models
mtcnn = MTCNN()
model = InceptionResnetV1(pretrained='vggface2').eval()

DB_PATH = "face_db.pkl"


# ---- LOAD DATABASE ----
def load_db():
    if os.path.exists(DB_PATH):
        with open(DB_PATH, "rb") as f:
            return pickle.load(f)
    return {}  # empty db if no file exists


# ---- SAVE DATABASE ----
def save_db(db):
    with open(DB_PATH, "wb") as f:
        pickle.dump(db, f)
    print(f" Database saved! ({len(db)} people enrolled)")


# ---- GET EMBEDDING ----
def get_embedding(image_path):
    img = Image.open(image_path)
    face = mtcnn(img)
    if face is None:
        return None
    with torch.no_grad():
        embedding = model(face.unsqueeze(0))
    return embedding.numpy()


# ---- ENROLL A PERSON ----
def enroll_person(name, image_paths):
    db = load_db()
    db[name] = []

    for path in image_paths:
        emb = get_embedding(path)
        if emb is not None:
            db[name].append(emb)
            print(f" Enrolled photo for {name}: {path}")
        else:
            print(f" No face found in {path}")

    print(f"Total photos enrolled for {name}: {len(db[name])}")
    save_db(db)


# ---- RECOGNIZE A PERSON ----
def recognize_person(image_path, threshold=0.5):
    db = load_db()

    if len(db) == 0:
        return " Database is empty! Enroll someone first."

    test_emb = get_embedding(image_path)
    if test_emb is None:
        return " No face detected in image!"

    best_name = "Unknown"
    best_score = -1

    for name, embeddings in db.items():
        for stored_emb in embeddings:
            score = cosine_similarity(test_emb, stored_emb)[0][0]
            if score > best_score:
                best_score = score
                best_name = name

    if best_score >= threshold:
        return f" Recognized: {best_name} (score: {best_score:.4f})"
    else:
        return f" Unknown person (best score: {best_score:.4f})"


# ---- LIST ALL ENROLLED PEOPLE ----
def list_enrolled():
    db = load_db()
    if len(db) == 0:
        print("Database is empty!")
        return
    print(f"\n👥 Enrolled people ({len(db)} total):")
    for name, embeddings in db.items():
        print(f"  - {name}: {len(embeddings)} photos")


# ========== TEST IT ==========
if __name__ == "__main__":
    # Step 1 - Enroll yourself
    print("=== ENROLLING ===")
    enroll_person("Me", ["test.jpg", "test2.jpg"])

    # Step 2 - List enrolled people
    print("\n=== DATABASE ===")
    list_enrolled()

    # Step 3 - Recognize using NEW photo
    print("\n=== RECOGNIZING ===")
    result = recognize_person("test4.jpg")
    print(result)