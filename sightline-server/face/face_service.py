"""
Face Service
Wraps MTCNN + FaceNet model for embedding generation, enrollment, and recognition.
Models are loaded lazily on first use to avoid slowing down server startup.
"""

from __future__ import annotations

import io
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image

from .face_db import FaceDB


class FaceService:
    """
    Singleton-style service for face operations.
    MTCNN and InceptionResnetV1 are loaded once and reused.
    """

    def __init__(self, db: Optional[FaceDB] = None, threshold: float = 0.50):
        self.db = db or FaceDB()
        self.threshold = threshold
        self._mtcnn = None
        self._model = None

    # ------------------------------------------------------------------
    # Lazy model loading
    # ------------------------------------------------------------------

    def _ensure_models(self):
        if self._mtcnn is None:
            try:
                import torch
                from facenet_pytorch import MTCNN, InceptionResnetV1

                device = "cuda" if torch.cuda.is_available() else "cpu"
                self._mtcnn = MTCNN(device=device, keep_all=False)
                self._model = InceptionResnetV1(pretrained="vggface2").eval().to(device)
                self._device = device
                print(f"[FaceService] Models loaded on {device}")
            except ImportError as e:
                raise RuntimeError(
                    "facenet-pytorch is not installed. "
                    "Run: pip install facenet-pytorch"
                ) from e

    # ------------------------------------------------------------------
    # Core: get embedding from a PIL Image
    # ------------------------------------------------------------------

    def get_embedding(self, image: Image.Image) -> Optional[np.ndarray]:
        """
        Detect a face in the image and return its 512-d embedding.
        Returns None if no face is detected.
        """
        self._ensure_models()

        import torch

        face_tensor = self._mtcnn(image)
        if face_tensor is None:
            return None

        with torch.no_grad():
            embedding = self._model(face_tensor.unsqueeze(0).to(self._device))

        return embedding.cpu().numpy()  # shape (1, 512)

    # ------------------------------------------------------------------
    # Enroll
    # ------------------------------------------------------------------

    def enroll_from_images(
        self, name: str, image_bytes_list: List[bytes]
    ) -> Tuple[int, int]:
        """
        Generate embeddings from a list of raw image bytes and store them.

        Returns: (enrolled_count, skipped_count)
        """
        self._ensure_models()

        embeddings = []
        skipped = 0

        for raw in image_bytes_list:
            image = Image.open(io.BytesIO(raw)).convert("RGB")
            emb = self.get_embedding(image)
            if emb is not None:
                embeddings.append(emb)
            else:
                skipped += 1

        if embeddings:
            self.db.enroll(name, embeddings)

        return len(embeddings), skipped

    # ------------------------------------------------------------------
    # Recognize
    # ------------------------------------------------------------------

    def recognize(self, image: Image.Image) -> Tuple[str, float]:
        """
        Identify the person in the image against the stored database.

        Returns: (name, score)  — name is "Unknown" if below threshold.
        """
        self._ensure_models()

        from sklearn.metrics.pairwise import cosine_similarity

        db = self.db.get_all()
        if not db:
            return "Unknown", 0.0

        query_emb = self.get_embedding(image)
        if query_emb is None:
            return "Unknown", 0.0

        best_name = "Unknown"
        best_score = -1.0

        for name, stored_embeddings in db.items():
            for stored_emb in stored_embeddings:
                score = float(cosine_similarity(query_emb, stored_emb)[0][0])
                if score > best_score:
                    best_score = score
                    best_name = name

        if best_score >= self.threshold:
            return best_name, best_score
        return "Unknown", best_score

    def recognize_from_bytes(self, raw_bytes: bytes) -> Tuple[str, float]:
        """Convenience wrapper accepting raw image bytes."""
        image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        return self.recognize(image)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def list_enrolled(self) -> List[str]:
        return self.db.list_names()

    def delete_person(self, name: str) -> bool:
        return self.db.delete(name)
