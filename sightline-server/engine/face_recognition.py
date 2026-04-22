"""
Face Recognition Module
Handles face enrollment and recognition using FaceNet (InceptionResnetV1) + MTCNN
"""

import os
import pickle
import numpy as np
from typing import Optional
from PIL import Image
import torch

# Lazy-load heavy models to avoid cold-start delay on first request
_mtcnn = None
_facenet = None

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "face_db.pkl")


def _get_models():
    global _mtcnn, _facenet
    if _mtcnn is None:
        from facenet_pytorch import MTCNN, InceptionResnetV1
        _mtcnn = MTCNN(keep_all=False, device="cpu", post_process=True)
        _facenet = InceptionResnetV1(pretrained="vggface2").eval()
    return _mtcnn, _facenet


def _load_db() -> dict:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if os.path.exists(DB_PATH):
        with open(DB_PATH, "rb") as f:
            return pickle.load(f)
    return {}


def _save_db(db: dict):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(DB_PATH, "wb") as f:
        pickle.dump(db, f)


def _get_embedding(image: Image.Image) -> Optional[np.ndarray]:
    """Extract 512-d face embedding from a PIL image. Returns None if no face detected."""
    mtcnn, facenet = _get_models()
    face = mtcnn(image)
    if face is None:
        return None
    with torch.no_grad():
        embedding = facenet(face.unsqueeze(0))
    return embedding.numpy()


def enroll_person(name: str, images: list) -> dict:
    """
    Enroll a person with multiple face images.

    Args:
        name: Display name for the person (e.g. "Vansh")
        images: List of PIL.Image objects (3-4 angles recommended)

    Returns:
        dict with keys: success, enrolled, failed, message
    """
    db = _load_db()
    db[name] = []
    enrolled = 0
    failed = 0

    for img in images:
        emb = _get_embedding(img)
        if emb is not None:
            db[name].append(emb)
            enrolled += 1
        else:
            failed += 1

    if enrolled == 0:
        # Don't persist if no usable face was found in any image
        db.pop(name, None)
        return {
            "success": False,
            "enrolled": 0,
            "failed": failed,
            "message": "No faces detected in any of the provided images.",
        }

    _save_db(db)
    return {
        "success": True,
        "enrolled": enrolled,
        "failed": failed,
        "message": f"Enrolled {enrolled} embeddings for '{name}'.",
    }


def recognize_person(image: Image.Image, threshold: float = 0.5) -> Optional[str]:
    """
    Attempt to recognize a person in an image against the enrolled database.

    Args:
        image: PIL.Image to recognize
        threshold: Minimum cosine similarity to count as a match (0-1)

    Returns:
        Name string if recognized, None if unknown or no face detected.
    """
    db = _load_db()
    if not db:
        return None

    from sklearn.metrics.pairwise import cosine_similarity

    emb = _get_embedding(image)
    if emb is None:
        return None

    best_name = None
    best_score = -1.0

    for name, embeddings in db.items():
        for stored_emb in embeddings:
            score = float(cosine_similarity(emb, stored_emb)[0][0])
            if score > best_score:
                best_score = score
                best_name = name

    if best_score >= threshold:
        return best_name
    return None


def list_enrolled() -> dict:
    """Return a mapping of name -> number of enrolled embeddings."""
    db = _load_db()
    return {name: len(embeddings) for name, embeddings in db.items()}


def delete_person(name: str) -> bool:
    """
    Remove an enrolled person from the database.

    Returns:
        True if found and deleted, False if not found.
    """
    db = _load_db()
    if name not in db:
        return False
    del db[name]
    _save_db(db)
    return True
