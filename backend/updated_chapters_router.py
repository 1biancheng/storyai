"""
更新后的章节路由,确保用户对章节序号拥有完全的手动控制权
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, Body

from services.chapter_service import ChapterService

logger = logging.getLogger(__name__)

# Keep router relative prefix, main.py mounts it under /api/v1
router = APIRouter(prefix="/chapters", tags=["Chapters"])

# Initialize service
chapter_service = ChapterService()

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