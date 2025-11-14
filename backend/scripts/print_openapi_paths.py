"""
Offline OpenAPI inspector: import FastAPI app and print all path keys.

Run:
  python backend/scripts/print_openapi_paths.py
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from main import app

def main():
    openapi = app.openapi()
    paths = list(openapi.get("paths", {}).keys())
    print("OPENAPI_PATH_COUNT:", len(paths))
    # Print chapters-related paths specifically
    chapters_paths = [p for p in paths if "/chapters" in p]
    print("OPENAPI_CHAPTERS_PATHS:")
    for p in chapters_paths:
        print(p)

if __name__ == "__main__":
    main()

