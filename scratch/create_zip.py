import os
import zipfile
from pathlib import Path

source_dir = Path("D:/Kavin/CampusSchedulingAndVenueManagement_Final")
zip_path = Path("D:/Kavin/CampusSchedulingAndVenueManagement_Final.zip")

EXCLUDE_DIRS = {
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".git",
    ".venv",
    "venv",
    ".gemini",
    "dist",
    "coverage",
    ".turbo",
    ".next"
}

EXCLUDE_EXTS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".log"
}

print(f"Creating zip {zip_path} from {source_dir}...")

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(source_dir):
        # Filter out directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".git")]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in EXCLUDE_EXTS:
                continue
            file_path = Path(root) / file
            # Relative path inside the zip file
            rel_path = file_path.relative_to(source_dir.parent)
            zipf.write(file_path, rel_path)

print(f"Zip created successfully! Size: {zip_path.stat().st_size / 1024 / 1024:.2f} MB")

