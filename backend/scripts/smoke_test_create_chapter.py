"""
Smoke test: create a chapter via ChapterService and print the result.

Run:
  python backend/scripts/smoke_test_create_chapter.py
"""
import asyncio
import json
import sys
from pathlib import Path
from typing import Optional, List

# Ensure backend directory is on sys.path for imports like `services` and `config`
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from services.chapter_service import ChapterService
except Exception as e:
    print(f"❌ Failed to import ChapterService: {e}")
    raise


async def main():
    service = ChapterService()
    project_id = "test-project"
    chapter_number = 1
    title = "First Chapter"
    content = "Hello world"
    tags: Optional[List[str]] = ["intro"]
    notes = "n/a"

    chapter = await service.create_chapter(
        project_id=project_id,
        chapter_number=chapter_number,
        title=title,
        content=content,
        tags=tags,
        notes=notes,
    )

    print("SMOKE_TEST_CREATE_CHAPTER_OK")
    print(json.dumps(chapter, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
