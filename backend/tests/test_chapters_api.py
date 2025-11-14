"""
Test suite for chapters API
Run with: pytest backend/tests/test_chapters_api.py
"""

import pytest
import asyncio
from pathlib import Path
import json
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.chapter_service import ChapterService


@pytest.fixture
def service():
    """Create ChapterService instance"""
    return ChapterService()


@pytest.mark.asyncio
async def test_create_chapter(service):
    """Test chapter creation"""
    chapter = await service.create_chapter(
        project_id="test_project_001",
        chapter_number=1,
        title="Test Chapter 1",
        content="# Chapter 1\n\nThis is a test chapter with **bold** text.",
        tags=["test", "first"]
    )
    
    assert chapter is not None
    assert chapter["projectId"] == "test_project_001"
    assert chapter["chapterNumber"] == 1
    assert chapter["title"] == "Test Chapter 1"
    assert chapter["wordCount"] > 0
    assert "test" in chapter["tags"]
    
    # Verify file was created
    file_path = service._get_chapter_file_path("test_project_001", 1)
    assert file_path.exists()
    
    # Cleanup
    await service.delete_chapter(chapter["id"])


@pytest.mark.asyncio
async def test_get_chapter(service):
    """Test chapter retrieval"""
    # Create test chapter
    created = await service.create_chapter(
        project_id="test_project_002",
        chapter_number=1,
        title="Retrieval Test"
    )
    
    # Retrieve it
    retrieved = await service.get_chapter(created["id"])
    
    assert retrieved is not None
    assert retrieved["id"] == created["id"]
    assert retrieved["title"] == "Retrieval Test"
    
    # Cleanup
    await service.delete_chapter(created["id"])


@pytest.mark.asyncio
async def test_update_chapter(service):
    """Test chapter update"""
    # Create test chapter
    chapter = await service.create_chapter(
        project_id="test_project_003",
        chapter_number=1,
        title="Original Title",
        content="Original content"
    )
    
    # Update it
    updated = await service.update_chapter(
        chapter["id"],
        {
            "title": "Updated Title",
            "content": "Updated content with more words"
        }
    )
    
    assert updated is not None
    assert updated["title"] == "Updated Title"
    assert updated["content"] == "Updated content with more words"
    assert updated["wordCount"] > chapter["wordCount"]
    
    # Cleanup
    await service.delete_chapter(chapter["id"])


@pytest.mark.asyncio
async def test_list_chapters(service):
    """Test listing chapters for a project"""
    project_id = "test_project_004"
    
    # Create multiple chapters
    chapter1 = await service.create_chapter(project_id, 1, "Chapter 1")
    chapter2 = await service.create_chapter(project_id, 2, "Chapter 2")
    chapter3 = await service.create_chapter(project_id, 3, "Chapter 3")
    
    # List them
    chapters = await service.list_chapters(project_id)
    
    assert len(chapters) == 3
    assert chapters[0]["chapterNumber"] == 1
    assert chapters[1]["chapterNumber"] == 2
    assert chapters[2]["chapterNumber"] == 3
    
    # Cleanup
    await service.delete_chapter(chapter1["id"])
    await service.delete_chapter(chapter2["id"])
    await service.delete_chapter(chapter3["id"])


@pytest.mark.asyncio
async def test_delete_chapter(service):
    """Test chapter deletion"""
    chapter = await service.create_chapter(
        project_id="test_project_005",
        chapter_number=1,
        title="To Be Deleted"
    )
    
    chapter_id = chapter["id"]
    file_path = service._get_chapter_file_path("test_project_005", 1)
    
    # Verify file exists
    assert file_path.exists()
    
    # Delete chapter
    result = await service.delete_chapter(chapter_id)
    assert result is True
    
    # Verify file was deleted
    assert not file_path.exists()
    
    # Verify database record was deleted
    retrieved = await service.get_chapter(chapter_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_duplicate_chapter_number(service):
    """Test that duplicate chapter numbers are rejected"""
    project_id = "test_project_006"
    
    # Create first chapter
    chapter1 = await service.create_chapter(project_id, 1, "Chapter 1")
    
    # Try to create another chapter with same number
    with pytest.raises(ValueError, match="already exists"):
        await service.create_chapter(project_id, 1, "Duplicate Chapter")
    
    # Cleanup
    await service.delete_chapter(chapter1["id"])


@pytest.mark.asyncio
async def test_word_count_calculation(service):
    """Test word count calculation for CJK text"""
    chapter = await service.create_chapter(
        project_id="test_project_007",
        chapter_number=1,
        title="Word Count Test",
        content="测试内容 with English 和中文混合 text"
    )
    
    # Word count should remove spaces
    expected_count = len("测试内容withEnglish和中文混合text")
    assert chapter["wordCount"] == expected_count
    
    # Cleanup
    await service.delete_chapter(chapter["id"])


if __name__ == "__main__":
    # Run tests manually
    pytest.main([__file__, "-v"])
"""
Test suite for chapters API
Run with: pytest backend/tests/test_chapters_api.py
"""

import pytest
import asyncio
from pathlib import Path
import json
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.chapter_service import ChapterService


@pytest.fixture
def service():
    """Create ChapterService instance"""
    return ChapterService()


@pytest.mark.asyncio
async def test_create_chapter(service):
    """Test chapter creation"""
    chapter = await service.create_chapter(
        project_id="test_project_001",
        chapter_number=1,
        title="Test Chapter 1",
        content="# Chapter 1\n\nThis is a test chapter with **bold** text.",
        tags=["test", "first"]
    )
    
    assert chapter is not None
    assert chapter["projectId"] == "test_project_001"
    assert chapter["chapterNumber"] == 1
    assert chapter["title"] == "Test Chapter 1"
    assert chapter["wordCount"] > 0
    assert "test" in chapter["tags"]
    
    # Verify file was created
    file_path = service._get_chapter_file_path("test_project_001", 1)
    assert file_path.exists()
    
    # Cleanup
    await service.delete_chapter(chapter["id"])


@pytest.mark.asyncio
async def test_get_chapter(service):
    """Test chapter retrieval"""
    # Create test chapter
    created = await service.create_chapter(
        project_id="test_project_002",
        chapter_number=1,
        title="Retrieval Test"
    )
    
    # Retrieve it
    retrieved = await service.get_chapter(created["id"])
    
    assert retrieved is not None
    assert retrieved["id"] == created["id"]
    assert retrieved["title"] == "Retrieval Test"
    
    # Cleanup
    await service.delete_chapter(created["id"])


@pytest.mark.asyncio
async def test_update_chapter(service):
    """Test chapter update"""
    # Create test chapter
    chapter = await service.create_chapter(
        project_id="test_project_003",
        chapter_number=1,
        title="Original Title",
        content="Original content"
    )
    
    # Update it
    updated = await service.update_chapter(
        chapter["id"],
        {
            "title": "Updated Title",
            "content": "Updated content with more words"
        }
    )
    
    assert updated is not None
    assert updated["title"] == "Updated Title"
    assert updated["content"] == "Updated content with more words"
    assert updated["wordCount"] > chapter["wordCount"]
    
    # Cleanup
    await service.delete_chapter(chapter["id"])


@pytest.mark.asyncio
async def test_list_chapters(service):
    """Test listing chapters for a project"""
    project_id = "test_project_004"
    
    # Create multiple chapters
    chapter1 = await service.create_chapter(project_id, 1, "Chapter 1")
    chapter2 = await service.create_chapter(project_id, 2, "Chapter 2")
    chapter3 = await service.create_chapter(project_id, 3, "Chapter 3")
    
    # List them
    chapters = await service.list_chapters(project_id)
    
    assert len(chapters) == 3
    assert chapters[0]["chapterNumber"] == 1
    assert chapters[1]["chapterNumber"] == 2
    assert chapters[2]["chapterNumber"] == 3
    
    # Cleanup
    await service.delete_chapter(chapter1["id"])
    await service.delete_chapter(chapter2["id"])
    await service.delete_chapter(chapter3["id"])


@pytest.mark.asyncio
async def test_delete_chapter(service):
    """Test chapter deletion"""
    chapter = await service.create_chapter(
        project_id="test_project_005",
        chapter_number=1,
        title="To Be Deleted"
    )
    
    chapter_id = chapter["id"]
    file_path = service._get_chapter_file_path("test_project_005", 1)
    
    # Verify file exists
    assert file_path.exists()
    
    # Delete chapter
    result = await service.delete_chapter(chapter_id)
    assert result is True
    
    # Verify file was deleted
    assert not file_path.exists()
    
    # Verify database record was deleted
    retrieved = await service.get_chapter(chapter_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_duplicate_chapter_number(service):
    """Test that duplicate chapter numbers are rejected"""
    project_id = "test_project_006"
    
    # Create first chapter
    chapter1 = await service.create_chapter(project_id, 1, "Chapter 1")
    
    # Try to create another chapter with same number
    with pytest.raises(ValueError, match="already exists"):
        await service.create_chapter(project_id, 1, "Duplicate Chapter")
    
    # Cleanup
    await service.delete_chapter(chapter1["id"])


@pytest.mark.asyncio
async def test_word_count_calculation(service):
    """Test word count calculation for CJK text"""
    chapter = await service.create_chapter(
        project_id="test_project_007",
        chapter_number=1,
        title="Word Count Test",
        content="测试内容 with English 和中文混合 text"
    )
    
    # Word count should remove spaces
    expected_count = len("测试内容withEnglish和中文混合text")
    assert chapter["wordCount"] == expected_count
    
    # Cleanup
    await service.delete_chapter(chapter["id"])


if __name__ == "__main__":
    # Run tests manually
    pytest.main([__file__, "-v"])
