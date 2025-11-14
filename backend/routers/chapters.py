"""
Chapter Management API Router
Handles CRUD operations for chapters with PostgreSQL + JSON file storage
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field, ConfigDict

from services.chapter_service import ChapterService

from config import get_settings

logger = logging.getLogger(__name__)

# Keep router relative prefix, main.py mounts it under /api/v1
router = APIRouter(prefix="/chapters", tags=["Chapters"])

# Get settings and initialize service with correct workspace path
settings = get_settings()
chapter_service = ChapterService(workspace_dir=str(settings.workspace_dir / "chapters"))


# Pydantic models for request/response
class ChapterCreate(BaseModel):
    """Request model for creating a new chapter"""
    project_id: str = Field(..., description="Project ID")
    chapter_number: int = Field(..., ge=1, description="Chapter number (starts from 1)")
    title: str = Field(..., min_length=1, max_length=200, description="Chapter title")
    content: str = Field(default="", description="Chapter content in Markdown format")
    tags: Optional[List[str]] = Field(default=None, description="Optional tags")
    notes: Optional[str] = Field(default=None, description="Author notes")


class ChapterUpdate(BaseModel):
    """Request model for updating an existing chapter"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    summary: Optional[str] = None
    display_order: Optional[int] = Field(None, alias="displayOrder")

    model_config = ConfigDict(populate_by_name=True)


class ChapterResponse(BaseModel):
    """Response model for chapter data (aliases map camelCase from service layer)"""
    id: str
    project_id: str = Field(alias="projectId")
    chapter_number: int = Field(alias="chapterNumber")
    title: str
    content: str = Field(default="")  # Allow empty content
    summary: Optional[str] = None
    word_count: int = Field(default=0, alias="wordCount")
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    display_order: Optional[int] = Field(None, alias="displayOrder")
    created_at: int = Field(alias="createdAt")
    updated_at: int = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


@router.post("", response_model=ChapterResponse, status_code=201)
async def create_chapter(data: ChapterCreate):
    """
    Create a new chapter
    - Validates project_id and chapter_number
    - Creates chapter in database and JSON file
    - Returns created chapter with generated ID
    """
    try:
        logger.info(f"Creating chapter for project {data.project_id}, number {data.chapter_number}")
        chapter = await chapter_service.create_chapter(
            project_id=data.project_id,
            chapter_number=data.chapter_number,
            title=data.title,
            content=data.content,
            tags=data.tags,
            notes=data.notes
        )
        logger.info(f"Chapter created successfully: {chapter.get('id')}")
        return chapter
    except ValueError as e:
        logger.error(f"ValueError creating chapter: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating chapter: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create chapter: {str(e)}")


@router.get("/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(chapter_id: str):
    """
    Get chapter by ID
    - Loads metadata from database
    - Loads full content from JSON file
    - Returns complete chapter data
    """
    try:
        chapter = await chapter_service.get_chapter(chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        return chapter
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving chapter {chapter_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chapter")


@router.get("/project/{project_id}", response_model=List[ChapterResponse])
async def list_chapters(project_id: str):
    """
    List all chapters for a project
    - Returns chapters ordered by display_order
    - Includes full content for each chapter
    """
    try:
        chapters = await chapter_service.list_chapters(project_id)
        return chapters
    except Exception as e:
        logger.error(f"Error listing chapters for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list chapters")


@router.put("/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(chapter_id: str, data: ChapterUpdate):
    """
    Update chapter data
    - Updates database metadata
    - Updates JSON file content
    - Automatically recalculates word count if content changed
    """
    try:
        logger.info(f"Updating chapter {chapter_id} with data: {data.dict(exclude_unset=True)}")
        update_data = data.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        chapter = await chapter_service.update_chapter(chapter_id, update_data)
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        logger.info(f"Chapter updated successfully, returning: {chapter}")
        return chapter
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating chapter {chapter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update chapter: {str(e)}")


@router.delete("/{chapter_id}", status_code=204)
async def delete_chapter(chapter_id: str):
    """
    Delete a chapter
    - Removes database record
    - Deletes JSON file
    - Returns 204 No Content on success
    """
    try:
        success = await chapter_service.delete_chapter(chapter_id)
        if not success:
            raise HTTPException(status_code=404, detail="Chapter not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chapter {chapter_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete chapter")


@router.post("/batch", response_model=List[ChapterResponse], status_code=201)
async def batch_create_chapters(chapters: List[ChapterCreate]):
    """
    Batch create multiple chapters
    - Creates multiple chapters in sequence
    - Returns list of created chapters
    - Stops on first error and returns partial results
    """
    try:
        created_chapters = []
        for chapter_data in chapters:
            chapter = await chapter_service.create_chapter(
                project_id=chapter_data.project_id,
                chapter_number=chapter_data.chapter_number,
                title=chapter_data.title,
                content=chapter_data.content,
                tags=chapter_data.tags,
                notes=chapter_data.notes
            )
            created_chapters.append(chapter)
        return created_chapters
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in batch chapter creation: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chapters")


@router.post("/project/{project_id}/reorder")
async def reorder_chapters(project_id: str, chapter_ids: List[str] = Body(..., embed=True)):
    """
    Reorder chapters in a project
    - Takes ordered list of chapter IDs
    - Updates display_order for each chapter
    - Preserves user-defined chapter numbers
    """
    try:
        await chapter_service.reorder_chapters(project_id, chapter_ids)
        return {"success": True, "message": "Chapters reordered successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error reordering chapters for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to reorder chapters")


@router.post("/project/{project_id}/validate")
async def validate_chapters(project_id: str):
    """
    Validate chapter display order for a project
    - Checks if chapters have valid display order
    - Returns validation result
    """
    try:
        # Get all chapters for the project
        chapters = await chapter_service.list_chapters(project_id)
        
        # Check if all chapters have required fields
        is_valid = True
        for chapter in chapters:
            # Check if chapter has required fields
            if not chapter.get('id') or not chapter.get('chapterNumber'):
                is_valid = False
                break
        
        return {"valid": is_valid}
    except Exception as e:
        logger.error(f"Error validating chapters for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate chapters")


@router.post("/project/{project_id}/fix_numbers")
async def fix_chapter_numbers(project_id: str):
    """
    Fix chapter display order for a project
    - Reorders chapters by display order while preserving user-defined chapter numbers
    - Returns fix result
    """
    try:
        # Get all chapters for the project
        chapters = await chapter_service.list_chapters(project_id)
        
        # Sort chapters by current display order (or chapter number if display order not set)
        sorted_chapters = sorted(chapters, key=lambda ch: ch.get('displayOrder', ch['chapterNumber']))
        
        # Get chapter IDs in order
        chapter_ids = [ch['id'] for ch in sorted_chapters]
        
        # Reorder chapters by display order, preserving user-defined chapter numbers
        await chapter_service.reorder_chapters(project_id, chapter_ids)
        
        return {"success": True, "message": f"Fixed chapter display order for {len(chapters)} chapters"}
    except Exception as e:
        logger.error(f"Error fixing chapter display order for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fix chapter display order")


@router.post("/sync/{project_id}")
async def sync_chapters_with_files(project_id: str):
    """
    手动触发文件系统 ↔ 数据库同步
    - 扫描 workspace/{project_id} 下所有 JSON
    - 缺失文件自动标记 status='missing'
    - 新增/更新文件同步元数据
    - 返回同步统计
    """
    try:
        report = await chapter_service.sync_files_to_db(project_id)
        if not report.get("ok"):
            raise HTTPException(status_code=400, detail=report.get("reason", "Sync failed"))
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing chapters for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync chapters")