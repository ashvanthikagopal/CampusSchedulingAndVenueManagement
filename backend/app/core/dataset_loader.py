"""
Authoritative dataset loader and synchronization utility.
Ensures the active database dataset is the single source of truth across all operations,
with deterministic fallback to the starter dataset file.
"""
import json
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.core.config import get_starter_dataset_path
from backend.app.models.entities import DatasetModel


def get_active_dataset_dict(db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Returns the authoritative active dataset dictionary.
    First checks the active database DatasetModel.
    Falls back to cit_public.json if no active database record exists.
    """
    if db is not None:
        try:
            active_ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
            if active_ds and active_ds.raw_json:
                return active_ds.raw_json
        except Exception:
            pass

    path = get_starter_dataset_path()
    with open(path, encoding="utf-8") as f:
        return json.load(f)

