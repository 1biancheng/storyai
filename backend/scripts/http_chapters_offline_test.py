"""
Offline HTTP test for /api/v1/chapters using FastAPI TestClient.

Run:
  python backend/scripts/http_chapters_offline_test.py
"""
import sys
from pathlib import Path
import json
import os

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Ensure minimal env for Settings validation (secret_key >= 32 chars)
os.environ.setdefault("SECRET_KEY", "offline-test-secret-key-0123456789abcdef0123456789")
# Normalize DB credentials for offline tests
os.environ["DATABASE__USERNAME"] = "postgres"
os.environ["DATABASE__PASSWORD"] = "1234"
os.environ["DATABASE__HOST"] = "localhost"
os.environ["DATABASE__PORT"] = "5432"
os.environ["DATABASE__NAME"] = "story_ai"

from fastapi.testclient import TestClient
from main import app


def main():
    client = TestClient(app)
    payload = {
        "project_id": "test-offline-http",
        "chapter_number": 1,
        "title": "Offline HTTP Test",
        "content": "Hello via TestClient",
        "tags": ["test"],
        "notes": "none"
    }
    resp = client.post("/api/v1/chapters", json=payload)
    print("STATUS:", resp.status_code)
    try:
        print(json.dumps(resp.json(), ensure_ascii=False))
    except Exception as e:
        print("JSON_PARSE_ERROR:", e)
        print("TEXT:", resp.text)


if __name__ == "__main__":
    main()
