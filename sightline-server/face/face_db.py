"""
Face Database
Handles storing and loading face embeddings (pickle-based, file-backed)
"""

import os
import pickle
from typing import Dict, List, Optional
import numpy as np


DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "face_db.pkl")


class FaceDB:
    """
    Persistent face embedding store.

    Structure: { name: [embedding_np_array, ...] }
    """

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

    # ------------------------------------------------------------------
    # Internal load / save
    # ------------------------------------------------------------------

    def _load(self) -> Dict[str, List[np.ndarray]]:
        if os.path.exists(self.db_path):
            with open(self.db_path, "rb") as f:
                return pickle.load(f)
        return {}

    def _save(self, db: Dict[str, List[np.ndarray]]) -> None:
        with open(self.db_path, "wb") as f:
            pickle.dump(db, f)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def enroll(self, name: str, embeddings: List[np.ndarray]) -> int:
        """
        Store embeddings for a person. Overwrites existing entry.

        Returns: number of embeddings saved.
        """
        db = self._load()
        db[name] = embeddings
        self._save(db)
        return len(embeddings)

    def get_all(self) -> Dict[str, List[np.ndarray]]:
        """Return the full database (name → list of embeddings)."""
        return self._load()

    def list_names(self) -> List[str]:
        return list(self._load().keys())

    def delete(self, name: str) -> bool:
        db = self._load()
        if name in db:
            del db[name]
            self._save(db)
            return True
        return False

    def count(self) -> int:
        return len(self._load())
