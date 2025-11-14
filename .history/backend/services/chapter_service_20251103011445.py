"""
Chapter Service - Business logic for chapter management
Handles PostgreSQL database operations and JSON file storage
"""

import logging
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
import time

# Conditional imports with proper handling
try:
    import aiofiles
    import asyncpg
    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False
    aiofiles = None
    asyncpg = None
    logging.warning("Chapter service dependencies not available")

# nanoid is optional; fall back to a secure random ID if unavailable
try:
    from nanoid import generate as nanoid_generate
except Exception:
    nanoid_generate = None

# Import JSON repair utility
from services.json_repairer import repair_and_load

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ChapterService:
    """Service for managing chapters with PostgreSQL + JSON file storage"""
    
    def __init__(self):
        self.db_pool = None
        self.workspace_dir = Path("workspace/chapters")
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        self._db_init_failed = False
    
    def _generate_id(self, size: int = 8) -> str:
        """Generate a short, URL-safe ID. Uses nanoid when available, otherwise a secure random fallback."""
        if nanoid_generate:
            return nanoid_generate(size=size)
        import secrets, string
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(size))
    
    def _db_enabled(self) -> bool:
        """Return whether database usage is enabled and dependencies are available."""
        return DEPENDENCIES_AVAILABLE and bool(get_settings().database.enabled)

    async def _get_db_pool(self):
        """Get or create database connection pool; return None if disabled or init fails."""
        if not self._db_enabled():
            return None

        if self.db_pool or self._db_init_failed:
            return self.db_pool

        try:
            self.db_pool = await asyncpg.create_pool(
                settings.database.url,
                min_size=1,
                max_size=10
            )
            return self.db_pool
        except Exception as e:
            logger.warning(f"DB pool init failed, falling back to file storage: {e}")
            self._db_init_failed = True
            self.db_pool = None
            return None
    
    def _get_chapter_file_path(self, project_id: str, chapter_number: int) -> Path:
        """Get file path for chapter JSON file"""
        project_dir = self.workspace_dir / project_id
        project_dir.mkdir(exist_ok=True)
        return project_dir / f"chap_{chapter_number:03d}.json"
    
    def _calculate_word_count(self, content: str) -> int:
        """Calculate word count (removes whitespace for CJK text)"""
        return len(content.replace(' ', '').replace('\n', '').replace('\t', ''))
    
    async def create_chapter(
        self,
        project_id: str,
        chapter_number: int,
        title: str,
        content: str = "",
        tags: Optional[List[str]] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new chapter
        
        Args:
            project_id: Project ID
            chapter_number: User-defined chapter number
            title: Chapter title
            content: Markdown content (optional)
            tags: Optional list of tags
            notes: Optional author notes
            
        Returns:
            Created chapter data
            
        Raises:
            ValueError: If chapter number already exists for project
        """
        pool = await self._get_db_pool()
        
        # Generate unique ID
        chapter_id = self._generate_id(size=8)
        word_count = self._calculate_word_count(content)
        created_at = int(time.time() * 1000)
        updated_at = created_at
        
        # Prepare chapter data
        chapter_data = {
            "id": chapter_id,
            "projectId": project_id,
            "chapterNumber": chapter_number,
            "title": title,
            "content": content,
            "summary": "",
            "wordCount": word_count,
            "tags": tags or [],
            "notes": notes or "",
            "displayOrder": chapter_number,  # Default display order to chapter number
            "createdAt": created_at,
            "updatedAt": updated_at
        }
        
        try:
            # Duplicate check: DB when available, else file existence
            if pool:
                async with pool.acquire() as conn:
                    existing = await conn.fetchval(
                        "SELECT id FROM chapters WHERE project_id = $1 AND chapter_number = $2",
                        project_id, chapter_number
                    )
                    if existing:
                        raise ValueError(f"Chapter number {chapter_number} already exists for project {project_id}")
                    # Insert database record
                    await conn.execute(
                        """
                        INSERT INTO chapters (id, project_id, chapter_number, title, summary, word_count, tags, notes, display_order, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10/1000.0), to_timestamp($11/1000.0))
                        """,
                        chapter_id, project_id, chapter_number, title, "",
                        word_count, json.dumps(tags or []), notes, chapter_number, created_at, updated_at
                    )
            else:
                file_path = self._get_chapter_file_path(project_id, chapter_number)
                if file_path.exists():
                    raise ValueError(f"Chapter number {chapter_number} already exists for project {project_id}")

            # Write JSON file regardless of DB
            file_path = self._get_chapter_file_path(project_id, chapter_number)
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(chapter_data, ensure_ascii=False, indent=2))

            logger.info(f"Created chapter {chapter_id} for project {project_id}")
            return chapter_data

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating chapter: {e}")
            raise
    
    async def get_chapter(self, chapter_id: str) -> Optional[Dict[str, Any]]:
        """
        Get chapter by ID
        
        Args:
            chapter_id: Chapter ID
            
        Returns:
            Chapter data with full content, or None if not found
        """
        pool = await self._get_db_pool()
        
        try:
            if pool:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT project_id, chapter_number FROM chapters WHERE id = $1",
                        chapter_id
                    )
                if not row:
                    return None
                file_path = self._get_chapter_file_path(row['project_id'], row['chapter_number'])
                if not file_path.exists():
                    logger.warning(f"JSON file not found for chapter {chapter_id}")
                    return None
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    # Use JSON repair to handle malformed JSON
                    chapter_data = repair_and_load(content)
                return chapter_data
            else:
                # Fallback: scan workspace for matching id
                for project_dir in self.workspace_dir.iterdir():
                    if not project_dir.is_dir():
                        continue
                    for file in sorted(project_dir.glob("chap_*.json")):
                        async with aiofiles.open(file, 'r', encoding='utf-8') as f:
                            content = await f.read()
                            # Use JSON repair to handle malformed JSON
                            data = repair_and_load(content)
                            if data.get('id') == chapter_id:
                                return data
                return None
        except Exception as e:
            logger.error(f"Error retrieving chapter {chapter_id}: {e}")
            raise
    
    async def list_chapters(self, project_id: str) -> List[Dict[str, Any]]:
        """
        List all chapters for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            List of chapters ordered by display_order
        """
        pool = await self._get_db_pool()
        
        try:
            if pool:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(
                        "SELECT chapter_number, display_order FROM chapters WHERE project_id = $1 ORDER BY display_order",
                        project_id
                    )
                chapters = []
                for row in rows:
                    file_path = self._get_chapter_file_path(project_id, row['chapter_number'])
                    if file_path.exists():
                        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                            content = await f.read()
                            # Use JSON repair to handle malformed JSON and ensure required fields
                            chapter_data = repair_and_load(content)
                            # Ensure displayOrder field exists
                            if 'displayOrder' not in chapter_data:
                                chapter_data['displayOrder'] = chapter_data.get('chapterNumber', row['display_order'])
                            chapters.append(chapter_data)
                return chapters
            else:
                project_dir = self.workspace_dir / project_id
                if not project_dir.exists():
                    return []
                chapters = []
                for file in sorted(project_dir.glob("chap_*.json")):
                    async with aiofiles.open(file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        # Use JSON repair to handle malformed JSON and ensure required fields
                        chapter_data = repair_and_load(content)
                        # Ensure displayOrder field exists
                        if 'displayOrder' not in chapter_data:
                            chapter_data['displayOrder'] = chapter_data.get('chapterNumber', 0)
                        chapters.append(chapter_data)
                # Ensure order by displayOrder (fallback to chapterNumber if not set)
                chapters.sort(key=lambda ch: ch.get('displayOrder', ch.get('chapterNumber', 0)))
                return chapters
        except Exception as e:
            logger.error(f"Error listing chapters for project {project_id}: {e}")
            raise
    
    async def update_chapter(self, chapter_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update chapter data
        
        Args:
            chapter_id: Chapter ID
            update_data: Fields to update (title, content, tags, notes, summary)
            
        Returns:
            Updated chapter data, or None if not found
        """
        pool = await self._get_db_pool()
        
        try:
            # Get current chapter data
            chapter = await self.get_chapter(chapter_id)
            if not chapter:
                return None

            # Update fields
            chapter.update(update_data)
            chapter['updatedAt'] = int(time.time() * 1000)

            # Recalculate word count if content changed
            if 'content' in update_data:
                chapter['wordCount'] = self._calculate_word_count(chapter['content'])

            # Update database when available
            if pool:
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE chapters 
                        SET title = $1, summary = $2, word_count = $3, tags = $4, notes = $5, updated_at = to_timestamp($6/1000.0)
                        WHERE id = $7
                        """,
                        chapter['title'], chapter.get('summary', ''), chapter['wordCount'],
                        json.dumps(chapter.get('tags', [])), chapter.get('notes', ''),
                        chapter['updatedAt'], chapter_id
                    )

            # Write updated JSON file
            file_path = self._get_chapter_file_path(chapter['projectId'], chapter['chapterNumber'])
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(chapter, ensure_ascii=False, indent=2))

            logger.info(f"Updated chapter {chapter_id}")
            return chapter

        except Exception as e:
            logger.error(f"Error updating chapter {chapter_id}: {e}")
            raise
    
    async def delete_chapter(self, chapter_id: str) -> bool:
        """
        Delete a chapter
        
        Args:
            chapter_id: Chapter ID
            
        Returns:
            True if deleted, False if not found
        """
        pool = await self._get_db_pool()
        
        try:
            if pool:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT project_id, chapter_number FROM chapters WHERE id = $1",
                        chapter_id
                    )
                    if not row:
                        return False
                    await conn.execute("DELETE FROM chapters WHERE id = $1", chapter_id)
                file_path = self._get_chapter_file_path(row['project_id'], row['chapter_number'])
                if file_path.exists():
                    file_path.unlink()
                logger.info(f"Deleted chapter {chapter_id}")
                return True
            else:
                chapter = await self.get_chapter(chapter_id)
                if not chapter:
                    return False
                file_path = self._get_chapter_file_path(chapter['projectId'], chapter['chapterNumber'])
                if file_path.exists():
                    file_path.unlink()
                logger.info(f"Deleted chapter {chapter_id} (file-only)")
                return True
        except Exception as e:
            logger.error(f"Error deleting chapter {chapter_id}: {e}")
            raise
    
    async def reorder_chapters(self, project_id: str, chapter_ids: List[str]) -> None:
        """
        Reorder chapters by updating display_order while preserving user-defined chapter numbers
        
        Args:
            project_id: Project ID
            chapter_ids: Ordered list of chapter IDs
        """
        pool = await self._get_db_pool()
        
        try:
            if pool:
                async with pool.acquire() as conn:
                    existing_ids = await conn.fetch(
                        "SELECT id FROM chapters WHERE project_id = $1",
                        project_id
                    )
                    existing_id_set = {row['id'] for row in existing_ids}
                    if not all(cid in existing_id_set for cid in chapter_ids):
                        raise ValueError("Some chapter IDs do not belong to this project")
                    # Update display_order instead of chapter_number
                    for idx, chapter_id in enumerate(chapter_ids, start=1):
                        await conn.execute(
                            "UPDATE chapters SET display_order = $1, updated_at = NOW() WHERE id = $2",
                            idx, chapter_id
                        )
                    # File renaming handled below to keep JSON in sync
            
            # File-only reorder/fallback: rename JSON files to match new order
            project_dir = self.workspace_dir / project_id
            if not project_dir.exists():
                return None
            # Build map from id to chapter
            id_to_chapter: Dict[str, Dict[str, Any]] = {}
            for cid in chapter_ids:
                ch = await self.get_chapter(cid)
                if not ch:
                    raise ValueError(f"Chapter id {cid} not found")
                if ch.get('projectId') != project_id:
                    raise ValueError("Some chapter IDs do not belong to this project")
                id_to_chapter[cid] = ch

            # Use temporary names to avoid collisions
            temp_paths: List[Path] = []
            for idx, cid in enumerate(chapter_ids, start=1):
                ch = id_to_chapter[cid]
                old_path = self._get_chapter_file_path(project_id, ch['chapterNumber'])
                tmp_path = project_dir / f"tmp_reorder_{idx:03d}.json"
                if old_path.exists():
                    old_path.rename(tmp_path)
                temp_paths.append(tmp_path)
                # Update display_order instead of chapterNumber
                ch['displayOrder'] = idx
                ch['updatedAt'] = int(time.time() * 1000)

            # Move temp files to final names and write updated content
            for idx, cid in enumerate(chapter_ids, start=1):
                ch = id_to_chapter[cid]
                final_path = self._get_chapter_file_path(project_id, ch['chapterNumber'])  # Keep original chapterNumber
                tmp_path = temp_paths[idx - 1]
                if tmp_path.exists():
                    tmp_path.unlink()  # will rewrite below
                async with aiofiles.open(final_path, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(ch, ensure_ascii=False, indent=2))

            logger.info(f"Reordered {len(chapter_ids)} chapters for project {project_id} (display order only)")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error reordering chapters for project {project_id}: {e}")
            raise
    
    async def validate_chapter_numbers(self, project_id: str) -> bool:
        """
        Validate that chapters have valid data for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            True if chapters have valid data, False otherwise
        """
        try:
            chapters = await self.list_chapters(project_id)
            
            # Check if all chapters have required fields
            for chapter in chapters:
                # Check if chapter has required fields
                if not chapter.get('id') or not chapter.get('chapterNumber'):
                    logger.warning(f"Chapter missing required fields: {chapter}")
                    return False
            
            # Check for duplicate chapter IDs
            chapter_ids = [ch['id'] for ch in chapters]
            if len(chapter_ids) != len(set(chapter_ids)):
                logger.warning(f"Duplicate chapter IDs found for project {project_id}")
                return False
                
            return True
        except Exception as e:
            logger.error(f"Error validating chapters for project {project_id}: {e}")
            return False