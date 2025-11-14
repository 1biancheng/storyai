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
    
    def __init__(self, workspace_dir: Optional[str] = None):
        self.db_pool = None
        # 优先使用传入的workspace_dir,否则使用默认值
        if workspace_dir:
            self.workspace_dir = Path(workspace_dir)
        else:
            # 使用配置的workspace_dir而非硬编码路径
            from config import get_settings
            settings = get_settings()
            self.workspace_dir = settings.workspace_dir / "chapters"
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
        return DEPENDENCIES_AVAILABLE and bool(get_settings().database.enabled) and asyncpg is not None

    async def _get_db_pool(self):
        """Get or create database connection pool; return None if disabled or init fails."""
        if not self._db_enabled() or asyncpg is None:
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
        Create a new chapter (file system only)
        
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
            # Check if file already exists
            file_path = self._get_chapter_file_path(project_id, chapter_number)
            if file_path.exists():
                raise ValueError(f"Chapter number {chapter_number} already exists for project {project_id}")

            # Write JSON file
            if aiofiles is not None:
                async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(chapter_data, ensure_ascii=False, indent=2))
            else:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(chapter_data, f, ensure_ascii=False, indent=2)

            logger.info(f"Created chapter {chapter_id} for project {project_id} (file system only)")
            return chapter_data

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating chapter: {e}")
            raise
    
    async def get_chapter(self, chapter_id: str) -> Optional[Dict[str, Any]]:
        """
        Get chapter by ID (file system only)
        
        Args:
            chapter_id: Chapter ID
            
        Returns:
            Chapter data with full content, or None if not found
        """
        try:
            # Scan workspace for matching id
            for project_dir in self.workspace_dir.iterdir():
                if not project_dir.is_dir():
                    continue
                for file in sorted(project_dir.glob("chap_*.json")):
                    if aiofiles is not None:
                        async with aiofiles.open(file, 'r', encoding='utf-8') as f:
                            content = await f.read()
                    else:
                        with open(file, 'r', encoding='utf-8') as f:
                            content = f.read()
                    data = repair_and_load(content)
                    if data.get('id') == chapter_id:
                        return data
            return None
        except Exception as e:
            logger.error(f"Error retrieving chapter {chapter_id}: {e}")
            raise
    
    async def list_chapters(self, project_id: str) -> List[Dict[str, Any]]:
        """
        List all chapters for a project (file system only)
        
        Args:
            project_id: Project ID
            
        Returns:
            List of chapters ordered by displayOrder or chapterNumber
        """
        try:
            project_dir = self.workspace_dir / project_id
            if not project_dir.exists():
                return []
            
            chapters = []
            for file in sorted(project_dir.glob("chap_*.json")):
                if aiofiles is not None:
                    async with aiofiles.open(file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                else:
                    with open(file, 'r', encoding='utf-8') as f:
                        content = f.read()
                chapter_data = repair_and_load(content)
                chapters.append(chapter_data)
            
            # Sort by displayOrder if available, otherwise by chapterNumber
            chapters.sort(key=lambda ch: ch.get('displayOrder', ch.get('chapterNumber', 0)))
            return chapters
        except Exception as e:
            logger.error(f"Error listing chapters for project {project_id}: {e}")
            raise
    
    async def update_chapter(self, chapter_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update chapter data (file system only)
        
        Args:
            chapter_id: Chapter ID
            update_data: Fields to update (title, content, tags, notes, summary)
            
        Returns:
            Updated chapter data, or None if not found
        """
        try:
            # Get current chapter data
            chapter = await self.get_chapter(chapter_id)
            if not chapter:
                return None

            # Only update the fields that are provided in update_data
            if 'title' in update_data:
                chapter['title'] = update_data['title']
            if 'content' in update_data:
                chapter['content'] = update_data['content']
                # Recalculate word count when content changes
                chapter['wordCount'] = self._calculate_word_count(chapter['content'])
            if 'summary' in update_data:
                chapter['summary'] = update_data['summary']
            if 'tags' in update_data:
                chapter['tags'] = update_data['tags']
            if 'notes' in update_data:
                chapter['notes'] = update_data['notes']
            
            chapter['updatedAt'] = int(time.time() * 1000)

            # Write updated JSON file
            file_path = self._get_chapter_file_path(chapter['projectId'], chapter['chapterNumber'])
            if aiofiles is not None:
                async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(chapter, ensure_ascii=False, indent=2))
            else:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(chapter, f, ensure_ascii=False, indent=2)

            logger.info(f"Updated chapter {chapter_id} (file system only)")
            return chapter

        except Exception as e:
            logger.error(f"Error updating chapter {chapter_id}: {e}")
            raise
    
    async def delete_chapter(self, chapter_id: str) -> bool:
        """
        Delete a chapter (file system only)
        
        Args:
            chapter_id: Chapter ID
            
        Returns:
            True if deleted, False if not found
        """
        try:
            chapter = await self.get_chapter(chapter_id)
            if not chapter:
                return False
                
            file_path = self._get_chapter_file_path(chapter['projectId'], chapter['chapterNumber'])
            if file_path.exists():
                file_path.unlink()
            logger.info(f"Deleted chapter {chapter_id} (file system only)")
            return True
        except Exception as e:
            logger.error(f"Error deleting chapter {chapter_id}: {e}")
            raise
    
    async def reorder_chapters(self, project_id: str, chapter_ids: List[str]) -> None:
        """
        Reorder chapters by updating ONLY displayOrder in JSON files (file system only)
        不修改章节的其他字段(如title、content等),避免覆盖用户正在编辑的内容
        
        Args:
            project_id: Project ID
            chapter_ids: Ordered list of chapter IDs
        """
        try:
            # Get all chapters and validate IDs
            chapters = await self.list_chapters(project_id)
            chapter_map = {ch['id']: ch for ch in chapters}
            
            # Validate all IDs exist
            if not all(cid in chapter_map for cid in chapter_ids):
                raise ValueError("Some chapter IDs do not belong to this project")
            
            # Update displayOrder in each chapter file
            # 关键:只修改 displayOrder 字段,不触碰其他字段
            for idx, chapter_id in enumerate(chapter_ids, start=1):
                chapter = chapter_map[chapter_id]
                file_path = self._get_chapter_file_path(chapter['projectId'], chapter['chapterNumber'])
                
                # 重新读取文件以获取最新内容(可能被自动保存更新了)
                if aiofiles is not None:
                    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                        content = await f.read()
                else:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                
                current_data = repair_and_load(content)
                
                # 只更新 displayOrder,保持其他字段不变
                current_data['displayOrder'] = idx
                # 不更新 updatedAt,避免触发不必要的UI更新
                
                # 写回文件
                if aiofiles is not None:
                    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                        await f.write(json.dumps(current_data, ensure_ascii=False, indent=2))
                else:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(current_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Reordered {len(chapter_ids)} chapters for project {project_id} (file system only, displayOrder updated)")
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
                
            return False
        except Exception as e:
            logger.error(f"Error validating chapters for project {project_id}: {e}")
            return False

    # === 文件系统 ↔ 数据库同步 === #

    async def sync_files_to_db(self, project_id: str) -> Dict[str, Any]:
        """
        扫描 workspace/{project_id} 下所有 chap_*.json,
        与数据库 chapters 表双向同步:
          - 文件存在但库无记录 → 插入元数据
          - 库有记录但文件丢失 → 标记 status='missing', word_count=0
          - 文件更新则刷新 file_mtime / file_size / word_count
        返回同步报告
        """
        pool = await self._get_db_pool()
        if not pool:
            return {"ok": False, "reason": "DB not available"}

        project_dir: Path = self.workspace_dir / project_id
        if not project_dir.exists():
            return {"ok": False, "reason": "Project directory not found"}

        # 1) 收集磁盘文件信息
        disk_map: Dict[int, Dict[str, Any]] = {}  # chapterNumber -> {path, mtime, size, data}
        for file in sorted(project_dir.glob("chap_*.json")):
            try:
                num = int(file.stem.split("_")[1])
                stat = file.stat()
                mtime = stat.st_mtime
                size = stat.st_size
                if aiofiles:
                    async with aiofiles.open(file, "r", encoding="utf-8") as f:
                        data = repair_and_load(await f.read())
                else:
                    with open(file, "r", encoding="utf-8") as f:
                        data = repair_and_load(f.read())
                disk_map[num] = {"path": file, "mtime": mtime, "size": size, "data": data}
            except Exception as e:
                logger.warning(f"Skipping malformed JSON {file}: {e}")

        async with pool.acquire() as conn:
            # 2) 加载库内记录
            rows = await conn.fetch(
                "SELECT id, chapter_number, title, word_count, status, file_mtime, file_size "
                "FROM chapters WHERE project_id = $1",
                project_id
            )
            db_map: Dict[int, Dict[str, Any]] = {r["chapter_number"]: dict(r) for r in rows}

            insert_cnt = update_cnt = missing_cnt = 0

            # 3) 遍历磁盘,插入或更新
            for num, info in disk_map.items():
                data = info["data"]
                title = data.get("title", f"第{num}章")
                wc = self._calculate_word_count(data.get("content", ""))
                mtime = info["mtime"]
                size = info["size"]
                if num not in db_map:
                    # 新文件
                    await conn.execute(
                        """
                        INSERT INTO chapters(id, project_id, chapter_number, title, summary, word_count,
                                             tags, notes, display_order, created_at, updated_at,
                                             file_mtime, file_size, status)
                        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,
                               to_timestamp($10/1000.0), to_timestamp($11/1000.0), $12, $13, 'active')
                        """,
                        data.get("id", self._generate_id()),
                        project_id, num, title, data.get("summary", ""), wc,
                        json.dumps(data.get("tags", [])), data.get("notes", ""), data.get("displayOrder", num),
                        data.get("createdAt", int(time.time() * 1000)),
                        data.get("updatedAt", int(time.time() * 1000)),
                        mtime, size
                    )
                    insert_cnt += 1
                else:
                    # 文件存在,更新元数据 & 状态
                    await conn.execute(
                        """
                        UPDATE chapters
                           SET title = $1, summary = $2, word_count = $3,
                               tags = $4, notes = $5, updated_at = to_timestamp($6/1000.0),
                               file_mtime = $7, file_size = $8, status = 'active'
                         WHERE project_id = $9 AND chapter_number = $10
                        """,
                        title, data.get("summary", ""), wc,
                        json.dumps(data.get("tags", [])), data.get("notes", ""),
                        int(time.time() * 1000), mtime, size,
                        project_id, num
                    )
                    update_cnt += 1

            # 4) 标记缺失文件
            for num, rec in db_map.items():
                if num not in disk_map and rec.get("status") != "missing":
                    await conn.execute(
                        "UPDATE chapters SET status='missing', word_count=0 WHERE project_id=$1 AND chapter_number=$2",
                        project_id, num
                    )
                    missing_cnt += 1

        logger.info(f"sync_files_to_db project={project_id} inserts={insert_cnt} updates={update_cnt} missing={missing_cnt}")
        return {"ok": True, "inserts": insert_cnt, "updates": update_cnt, "missing": missing_cnt}

    async def update_file_meta_after_write(self, project_id: str, chapter_number: int) -> None:
        """写完 JSON 后立即刷新库内 file_mtime / file_size / status"""
        pool = await self._get_db_pool()
        if not pool:
            return
        path = self._get_chapter_file_path(project_id, chapter_number)
        if not path.exists():
            # 文件被外部删除,标记缺失
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE chapters SET status='missing', word_count=0 WHERE project_id=$1 AND chapter_number=$2",
                    project_id, chapter_number
                )
            return
        stat = path.stat()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE chapters SET file_mtime=$1, file_size=$2, status='active' "
                "WHERE project_id=$3 AND chapter_number=$4",
                stat.st_mtime, stat.st_size, project_id, chapter_number
            )