"""
Offline HTTP test suite for /api/v1/chapters using FastAPI TestClient.

Covers:
- POST /chapters (create)
- GET /chapters/{chapter_id} (get)
- GET /chapters/project/{project_id} (list)
- PUT /chapters/{chapter_id} (update)
- POST /chapters/batch (batch create)
- POST /chapters/project/{project_id}/reorder (reorder)
- DELETE /chapters/{chapter_id} (delete)

Run:
  python backend/scripts/http_chapters_offline_suite.py
"""
import sys
import time
import os
from pathlib import Path
import json
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Ensure minimal env for Settings validation (secret_key >= 32 chars)
os.environ.setdefault("SECRET_KEY", "offline-test-secret-key-0123456789abcdef0123456789")
# Normalize DB credentials for offline tests (override any inherited env that may break local pg)
os.environ["DATABASE__USERNAME"] = "postgres"
os.environ["DATABASE__PASSWORD"] = "1234"
os.environ["DATABASE__HOST"] = "localhost"
os.environ["DATABASE__PORT"] = "5432"
os.environ["DATABASE__NAME"] = "story_ai"

from fastapi.testclient import TestClient
from main import app


def pretty(obj):
    return json.dumps(obj, ensure_ascii=False)


def assert_true(cond: bool, msg: str):
    if cond:
        print("PASS:", msg)
    else:
        print("FAIL:", msg)
        raise AssertionError(msg)


def suite():
    client = TestClient(app)
    project_id = f"suite-{int(time.time())}"
    created_ids: List[str] = []

    # 1) Create chapter1
    payload1 = {
        "project_id": project_id,
        "chapter_number": 1,
        "title": "Ch1",
        "content": "Content 1",
        "tags": ["suite"],
        "notes": "n1"
    }
    r1 = client.post("/api/v1/chapters", json=payload1)
    print("CREATE-1 STATUS:", r1.status_code)
    assert_true(r1.status_code == 201, "create chapter1 returns 201")
    c1 = r1.json()
    print(pretty(c1))
    created_ids.append(c1["id"])  # camelCase response
    # Slight delay to avoid pool/connection overlap in constrained environments
    time.sleep(0.2)

    # 2) Create chapter2
    payload2 = {
        "project_id": project_id,
        "chapter_number": 2,
        "title": "Ch2",
        "content": "Content 2",
        "tags": ["suite"],
        "notes": "n2"
    }
    r2 = client.post("/api/v1/chapters", json=payload2)
    print("CREATE-2 STATUS:", r2.status_code)
    assert_true(r2.status_code == 201, "create chapter2 returns 201")
    c2 = r2.json()
    print(pretty(c2))
    created_ids.append(c2["id"])  # camelCase response
    time.sleep(0.2)

    # 3) GET chapter1
    g1 = client.get(f"/api/v1/chapters/{c1['id']}")
    print("GET-1 STATUS:", g1.status_code)
    assert_true(g1.status_code == 200, "get chapter1 returns 200")
    print(pretty(g1.json()))
    time.sleep(0.1)

    # 4) LIST project
    lp = client.get(f"/api/v1/chapters/project/{project_id}")
    print("LIST STATUS:", lp.status_code)
    assert_true(lp.status_code == 200, "list chapters returns 200")
    chapters = lp.json()
    print(pretty(chapters))
    assert_true(len(chapters) >= 2, "list contains at least 2 chapters")
    time.sleep(0.1)

    # 5) UPDATE chapter2
    up = client.put(
        f"/api/v1/chapters/{c2['id']}",
        json={"title": "Ch2-updated", "content": "Content 2 updated"}
    )
    print("UPDATE STATUS:", up.status_code)
    assert_true(up.status_code == 200, "update chapter2 returns 200")
    u2 = up.json()
    print(pretty(u2))
    assert_true(u2["title"] == "Ch2-updated", "title updated")
    assert_true(u2["content"] == "Content 2 updated", "content updated")
    time.sleep(0.1)

    # 6) BATCH create chapter3
    b = client.post(
        "/api/v1/chapters/batch",
        json=[{
            "project_id": project_id,
            "chapter_number": 3,
            "title": "Ch3",
            "content": "Content 3",
            "tags": ["suite"],
            "notes": "n3"
        }]
    )
    print("BATCH STATUS:", b.status_code)
    assert_true(b.status_code == 201, "batch returns 201")
    blist = b.json()
    print(pretty(blist))
    assert_true(isinstance(blist, list) and len(blist) == 1, "batch returned one item")
    c3 = blist[0]
    created_ids.append(c3["id"])  # track created id
    time.sleep(0.1)

    # 7) REORDER chapters to [c2, c3, c1]
    ro = client.post(
        f"/api/v1/chapters/project/{project_id}/reorder",
        json={"chapter_ids": [c2["id"], c3["id"], c1["id"]]}
    )
    print("REORDER STATUS:", ro.status_code)
    assert_true(ro.status_code == 200, "reorder returns 200")
    print(pretty(ro.json()))
    time.sleep(0.1)

    # Verify order by listing again
    lp2 = client.get(f"/api/v1/chapters/project/{project_id}")
    print("LIST-2 STATUS:", lp2.status_code)
    assert_true(lp2.status_code == 200, "list after reorder returns 200")
    chapters2 = lp2.json()
    print(pretty(chapters2))
    # Expect chapterNumbers 1..3, and IDs in the same order we set
    expected_order = [c2["id"], c3["id"], c1["id"]]
    actual_order = [c["id"] for c in chapters2]
    assert_true(actual_order == expected_order, "list order matches reorder input")
    assert_true([c["chapterNumber"] for c in chapters2] == [1, 2, 3], "chapter numbers are sequential 1..3")

    # 8) DELETE chapter3
    d3 = client.delete(f"/api/v1/chapters/{c3['id']}")
    print("DELETE STATUS:", d3.status_code)
    assert_true(d3.status_code == 204, "delete returns 204")
    created_ids.remove(c3["id"])  # track remaining

    # Verify deleted
    g3 = client.get(f"/api/v1/chapters/{c3['id']}")
    print("GET-DELETED STATUS:", g3.status_code)
    assert_true(g3.status_code == 404, "get deleted returns 404")

    # Cleanup: delete remaining created ids to keep DB tidy
    for cid in created_ids:
        _ = client.delete(f"/api/v1/chapters/{cid}")
    print("CLEANUP: deleted remaining chapters")


if __name__ == "__main__":
    suite()
