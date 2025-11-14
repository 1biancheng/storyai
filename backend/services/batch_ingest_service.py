"""Batch Ingest Service - Async task processing for large file ingestion
Handles paragraph splitting, embedding, and database insertion with:
- Async task management with UUID-based task IDs
- Batch processing (64 paragraphs per batch)
- Real-time progress tracking via SSE
- Graceful cancellation support
- Overlength paragraph detection (>1000 chars)
"""

import asyncio
import uuid
import logging
import hashlib
import time
from typing import Dict, Any, List, Optional, AsyncGenerator
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
import json

from services.file_parser_service import parse_file
from services.paragraph_service import split_into_semantic_paragraphs, embed_paragraphs
from services.classify_service import classify_paragraphs
from services.db_service import get_db_service
from services.ai_service import AIService
from config import get_settings

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Task status enum"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskProgress:
    """Task progress data structure"""
    task_id: str
    status: TaskStatus
    total_paragraphs: int
    processed_paragraphs: int
    current_batch: int
    total_batches: int
    percent: int
    eta_seconds: Optional[float] = None
    error_message: Optional[str] = None
    overlength_count: int = 0  # Number of paragraphs >1000 chars
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['status'] = self.status.value
        return data


class BatchIngestTask:
    """Single batch ingest task with cancellation support"""
    
    def __init__(self, task_id: str, file_path: str, book_id: Optional[str] = None, 
                 model_id: str = "text-embedding-3-small", batch_size: int = 64,
                 overlength_threshold: int = 1000):
        self.task_id = task_id
        self.file_path = file_path
        self.book_id = book_id
        self.model_id = model_id
        self.batch_size = batch_size
        self.overlength_threshold = overlength_threshold
        self.progress = TaskProgress(
            task_id=task_id,
            status=TaskStatus.PENDING,
            total_paragraphs=0,
            processed_paragraphs=0,
            current_batch=0,
            total_batches=0,
            percent=0,
            start_time=time.time()
        )
        self.cancelled = False
        self.doc_id: Optional[int] = None
        
    def cancel(self):
        """Request cancellation"""
        self.cancelled = True
        logger.info(f"Task {self.task_id} cancellation requested")
        
    async def execute(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute batch ingest task with progress updates"""
        try:
            self.progress.status = TaskStatus.RUNNING
            self.progress.start_time = time.time()
            yield {"event": "started", "data": self.progress.to_dict()}
            
            # Step 1: Parse file
            if self.cancelled:
                self.progress.status = TaskStatus.CANCELLED
                yield {"event": "cancelled", "data": self.progress.to_dict()}
                return
                
            parsed = parse_file(self.file_path)
            yield {"event": "parsed", "data": {"path": self.file_path, "meta": parsed.get("meta", {})}}
            
            text = parsed.get("text", "")
            if not text.strip():
                raise ValueError("No text content extracted from file")
            
            # Step 2: Split into paragraphs
            if self.cancelled:
                self.progress.status = TaskStatus.CANCELLED
                yield {"event": "cancelled", "data": self.progress.to_dict()}
                return
                
            paragraphs = split_into_semantic_paragraphs(text)
            self.progress.total_paragraphs = len(paragraphs)
            self.progress.total_batches = (len(paragraphs) + self.batch_size - 1) // self.batch_size
            
            # Detect overlength paragraphs
            overlength_indices = []
            for idx, para in enumerate(paragraphs):
                if len(para) > self.overlength_threshold:
                    overlength_indices.append(idx)
                    self.progress.overlength_count += 1
            
            yield {
                "event": "split", 
                "data": {
                    "count": len(paragraphs), 
                    "overlength_count": self.progress.overlength_count,
                    "overlength_indices": overlength_indices[:10]  # First 10 for preview
                }
            }
            
            if not paragraphs:
                raise ValueError("No paragraphs extracted from text")
            
            # Step 3: Batch classify paragraphs
            if self.cancelled:
                self.progress.status = TaskStatus.CANCELLED
                yield {"event": "cancelled", "data": self.progress.to_dict()}
                return
                
            metas = await classify_paragraphs(paragraphs)
            
            # Add overlength flag to meta
            for idx in overlength_indices:
                if idx < len(metas):
                    metas[idx]["overlength"] = True
                    metas[idx]["char_count"] = len(paragraphs[idx])
            
            yield {"event": "classified", "data": {"count": len(metas)}}
            
            # Step 4: Insert document first
            db = await get_db_service()
            title = parsed.get("meta", {}).get("title") or f"Document {datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.doc_id = await db.insert_document(
                title=title,
                content=text,
                embedding=None,
                content_type="book",
                source=self.file_path,
                doc_metadata=parsed.get("meta", {})
            )
            
            if not self.book_id:
                self.book_id = f"doc-{self.doc_id}"
            
            yield {"event": "document_created", "data": {"doc_id": self.doc_id, "book_id": self.book_id}}
            
            # Step 5: Batch processing - embedding + database insert
            async with AIService() as ai:
                for batch_idx in range(self.progress.total_batches):
                    if self.cancelled:
                        self.progress.status = TaskStatus.CANCELLED
                        yield {"event": "cancelled", "data": self.progress.to_dict()}
                        return
                    
                    start_idx = batch_idx * self.batch_size
                    end_idx = min(start_idx + self.batch_size, len(paragraphs))
                    batch_paragraphs = paragraphs[start_idx:end_idx]
                    batch_metas = metas[start_idx:end_idx]
                    
                    self.progress.current_batch = batch_idx + 1
                    
                    # Batch embedding
                    batch_start_time = time.time()
                    vectors = await ai.get_embeddings(batch_paragraphs, model_id=self.model_id)
                    batch_embed_time = time.time() - batch_start_time
                    
                    # Batch database insert
                    rows: List[Dict[str, Any]] = []
                    for i, content in enumerate(batch_paragraphs):
                        global_idx = start_idx + i
                        meta = batch_metas[i] if i < len(batch_metas) else {}
                        rows.append({
                            "book_id": self.book_id,
                            "chapter_index": None,
                            "section_index": None,
                            "paragraph_index": global_idx,
                            "content": content,
                            "meta": meta,
                            "embedding": vectors[i] if i < len(vectors) else None,
                            "embedding_model": self.model_id,
                        })
                    
                    batch_db_start = time.time()
                    await db.insert_paragraphs(rows)
                    batch_db_time = time.time() - batch_db_start
                    
                    self.progress.processed_paragraphs = end_idx
                    self.progress.percent = int((self.progress.processed_paragraphs / self.progress.total_paragraphs) * 100)
                    
                    # Calculate ETA based on average batch time
                    avg_batch_time = batch_embed_time + batch_db_time
                    remaining_batches = self.progress.total_batches - self.progress.current_batch
                    self.progress.eta_seconds = remaining_batches * avg_batch_time
                    
                    yield {
                        "event": "progress",
                        "data": {
                            **self.progress.to_dict(),
                            "batch_embed_time": round(batch_embed_time, 2),
                            "batch_db_time": round(batch_db_time, 2),
                        }
                    }
            
            # Complete
            self.progress.status = TaskStatus.COMPLETED
            self.progress.percent = 100
            self.progress.end_time = time.time()
            total_time = self.progress.end_time - self.progress.start_time
            
            yield {
                "event": "complete",
                "data": {
                    **self.progress.to_dict(),
                    "doc_id": self.doc_id,
                    "total_time": round(total_time, 2),
                    "avg_time_per_paragraph": round(total_time / self.progress.total_paragraphs, 3),
                }
            }
            
        except Exception as e:
            logger.error(f"Task {self.task_id} failed: {str(e)}", exc_info=True)
            self.progress.status = TaskStatus.FAILED
            self.progress.error_message = str(e)
            self.progress.end_time = time.time()
            yield {"event": "error", "data": self.progress.to_dict()}


class BatchIngestService:
    """Batch ingest service manager - handles multiple concurrent tasks"""
    
    def __init__(self):
        self.tasks: Dict[str, BatchIngestTask] = {}
        self.settings = get_settings()
        
    def create_task(self, file_path: str, book_id: Optional[str] = None,
                   model_id: str = "text-embedding-3-small") -> str:
        """Create new batch ingest task and return task ID"""
        task_id = str(uuid.uuid4())
        
        # Get batch size and overlength threshold from settings
        batch_size = getattr(self.settings, 'batch_size', 64)
        overlength_threshold = getattr(self.settings, 'overlength_threshold', 1000)
        
        task = BatchIngestTask(
            task_id=task_id,
            file_path=file_path,
            book_id=book_id,
            model_id=model_id,
            batch_size=batch_size,
            overlength_threshold=overlength_threshold
        )
        
        self.tasks[task_id] = task
        logger.info(f"Created batch ingest task {task_id} for file: {file_path}")
        return task_id
    
    async def run_task(self, task_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute task and yield progress events"""
        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.tasks[task_id]
        
        try:
            async for event in task.execute():
                yield event
        finally:
            # Keep task in memory for status queries for 5 minutes
            # In production, use Redis or database for persistence
            pass
    
    def cancel_task(self, task_id: str) -> bool:
        """Request task cancellation"""
        if task_id not in self.tasks:
            return False
        
        self.tasks[task_id].cancel()
        return True
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get current task status"""
        if task_id not in self.tasks:
            return None
        
        return self.tasks[task_id].progress.to_dict()
    
    def cleanup_completed_tasks(self, max_age_seconds: int = 300):
        """Remove completed tasks older than max_age_seconds"""
        now = time.time()
        to_remove = []
        
        for task_id, task in self.tasks.items():
            if task.progress.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                if task.progress.end_time and (now - task.progress.end_time) > max_age_seconds:
                    to_remove.append(task_id)
        
        for task_id in to_remove:
            del self.tasks[task_id]
            logger.info(f"Cleaned up task {task_id}")
        
        return len(to_remove)


# Global service instance
_batch_ingest_service: Optional[BatchIngestService] = None


def get_batch_ingest_service() -> BatchIngestService:
    """Get global batch ingest service instance"""
    global _batch_ingest_service
    if _batch_ingest_service is None:
        _batch_ingest_service = BatchIngestService()
    return _batch_ingest_service
"""Batch Ingest Service - Async task processing for large file ingestion
Handles paragraph splitting, embedding, and database insertion with:
- Async task management with UUID-based task IDs
- Batch processing (64 paragraphs per batch)
- Real-time progress tracking via SSE
- Graceful cancellation support
- Overlength paragraph detection (>1000 chars)
"""

import asyncio
import uuid
import logging
import hashlib
import time
from typing import Dict, Any, List, Optional, AsyncGenerator
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
import json

from services.file_parser_service import parse_file
from services.paragraph_service import split_into_semantic_paragraphs, embed_paragraphs
from services.classify_service import classify_paragraphs
from services.db_service import get_db_service
from services.ai_service import AIService
from config import get_settings

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Task status enum"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskProgress:
    """Task progress data structure"""
    task_id: str
    status: TaskStatus
    total_paragraphs: int
    processed_paragraphs: int
    current_batch: int
    total_batches: int
    percent: int
    eta_seconds: Optional[float] = None
    error_message: Optional[str] = None
    overlength_count: int = 0  # Number of paragraphs >1000 chars
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['status'] = self.status.value
        return data


class BatchIngestTask:
    """Single batch ingest task with cancellation support"""
    
    def __init__(self, task_id: str, file_path: str, book_id: Optional[str] = None, 
                 model_id: str = "text-embedding-3-small", batch_size: int = 64,
                 overlength_threshold: int = 1000):
        self.task_id = task_id
        self.file_path = file_path
        self.book_id = book_id
        self.model_id = model_id
        self.batch_size = batch_size
        self.overlength_threshold = overlength_threshold
        self.progress = TaskProgress(
            task_id=task_id,
            status=TaskStatus.PENDING,
            total_paragraphs=0,
            processed_paragraphs=0,
            current_batch=0,
            total_batches=0,
            percent=0,
            start_time=time.time()
        )
        self.cancelled = False
        self.doc_id: Optional[int] = None
        
    def cancel(self):
        """Request cancellation"""
        self.cancelled = True
        logger.info(f"Task {self.task_id} cancellation requested")
        
    async def execute(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute batch ingest task with progress updates"""
        try:
            self.progress.status = TaskStatus.RUNNING
            self.progress.start_time = time.time()
            yield {"event": "started", "data": self.progress.to_dict()}
            
            # Step 1: Parse file
            if self.cancelled:
                self.progress.status = TaskStatus.CANCELLED
                yield {"event": "cancelled", "data": self.progress.to_dict()}
                return
                
            parsed = parse_file(self.file_path)
            yield {"event": "parsed", "data": {"path": self.file_path, "meta": parsed.get("meta", {})}}
            
            text = parsed.get("text", "")
            if not text.strip():
                raise ValueError("No text content extracted from file")
            
            # Step 2: Split into paragraphs
            if self.cancelled:
                self.progress.status = TaskStatus.CANCELLED
                yield {"event": "cancelled", "data": self.progress.to_dict()}
                return
                
            paragraphs = split_into_semantic_paragraphs(text)
            self.progress.total_paragraphs = len(paragraphs)
            self.progress.total_batches = (len(paragraphs) + self.batch_size - 1) // self.batch_size
            
            # Detect overlength paragraphs
            overlength_indices = []
            for idx, para in enumerate(paragraphs):
                if len(para) > self.overlength_threshold:
                    overlength_indices.append(idx)
                    self.progress.overlength_count += 1
            
            yield {
                "event": "split", 
                "data": {
                    "count": len(paragraphs), 
                    "overlength_count": self.progress.overlength_count,
                    "overlength_indices": overlength_indices[:10]  # First 10 for preview
                }
            }
            
            if not paragraphs:
                raise ValueError("No paragraphs extracted from text")
            
            # Step 3: Batch classify paragraphs
            if self.cancelled:
                self.progress.status = TaskStatus.CANCELLED
                yield {"event": "cancelled", "data": self.progress.to_dict()}
                return
                
            metas = await classify_paragraphs(paragraphs)
            
            # Add overlength flag to meta
            for idx in overlength_indices:
                if idx < len(metas):
                    metas[idx]["overlength"] = True
                    metas[idx]["char_count"] = len(paragraphs[idx])
            
            yield {"event": "classified", "data": {"count": len(metas)}}
            
            # Step 4: Insert document first
            db = await get_db_service()
            title = parsed.get("meta", {}).get("title") or f"Document {datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.doc_id = await db.insert_document(
                title=title,
                content=text,
                embedding=None,
                content_type="book",
                source=self.file_path,
                doc_metadata=parsed.get("meta", {})
            )
            
            if not self.book_id:
                self.book_id = f"doc-{self.doc_id}"
            
            yield {"event": "document_created", "data": {"doc_id": self.doc_id, "book_id": self.book_id}}
            
            # Step 5: Batch processing - embedding + database insert
            async with AIService() as ai:
                for batch_idx in range(self.progress.total_batches):
                    if self.cancelled:
                        self.progress.status = TaskStatus.CANCELLED
                        yield {"event": "cancelled", "data": self.progress.to_dict()}
                        return
                    
                    start_idx = batch_idx * self.batch_size
                    end_idx = min(start_idx + self.batch_size, len(paragraphs))
                    batch_paragraphs = paragraphs[start_idx:end_idx]
                    batch_metas = metas[start_idx:end_idx]
                    
                    self.progress.current_batch = batch_idx + 1
                    
                    # Batch embedding
                    batch_start_time = time.time()
                    vectors = await ai.get_embeddings(batch_paragraphs, model_id=self.model_id)
                    batch_embed_time = time.time() - batch_start_time
                    
                    # Batch database insert
                    rows: List[Dict[str, Any]] = []
                    for i, content in enumerate(batch_paragraphs):
                        global_idx = start_idx + i
                        meta = batch_metas[i] if i < len(batch_metas) else {}
                        rows.append({
                            "book_id": self.book_id,
                            "chapter_index": None,
                            "section_index": None,
                            "paragraph_index": global_idx,
                            "content": content,
                            "meta": meta,
                            "embedding": vectors[i] if i < len(vectors) else None,
                            "embedding_model": self.model_id,
                        })
                    
                    batch_db_start = time.time()
                    await db.insert_paragraphs(rows)
                    batch_db_time = time.time() - batch_db_start
                    
                    self.progress.processed_paragraphs = end_idx
                    self.progress.percent = int((self.progress.processed_paragraphs / self.progress.total_paragraphs) * 100)
                    
                    # Calculate ETA based on average batch time
                    avg_batch_time = batch_embed_time + batch_db_time
                    remaining_batches = self.progress.total_batches - self.progress.current_batch
                    self.progress.eta_seconds = remaining_batches * avg_batch_time
                    
                    yield {
                        "event": "progress",
                        "data": {
                            **self.progress.to_dict(),
                            "batch_embed_time": round(batch_embed_time, 2),
                            "batch_db_time": round(batch_db_time, 2),
                        }
                    }
            
            # Complete
            self.progress.status = TaskStatus.COMPLETED
            self.progress.percent = 100
            self.progress.end_time = time.time()
            total_time = self.progress.end_time - self.progress.start_time
            
            yield {
                "event": "complete",
                "data": {
                    **self.progress.to_dict(),
                    "doc_id": self.doc_id,
                    "total_time": round(total_time, 2),
                    "avg_time_per_paragraph": round(total_time / self.progress.total_paragraphs, 3),
                }
            }
            
        except Exception as e:
            logger.error(f"Task {self.task_id} failed: {str(e)}", exc_info=True)
            self.progress.status = TaskStatus.FAILED
            self.progress.error_message = str(e)
            self.progress.end_time = time.time()
            yield {"event": "error", "data": self.progress.to_dict()}


class BatchIngestService:
    """Batch ingest service manager - handles multiple concurrent tasks"""
    
    def __init__(self):
        self.tasks: Dict[str, BatchIngestTask] = {}
        self.settings = get_settings()
        
    def create_task(self, file_path: str, book_id: Optional[str] = None,
                   model_id: str = "text-embedding-3-small") -> str:
        """Create new batch ingest task and return task ID"""
        task_id = str(uuid.uuid4())
        
        # Get batch size and overlength threshold from settings
        batch_size = getattr(self.settings, 'batch_size', 64)
        overlength_threshold = getattr(self.settings, 'overlength_threshold', 1000)
        
        task = BatchIngestTask(
            task_id=task_id,
            file_path=file_path,
            book_id=book_id,
            model_id=model_id,
            batch_size=batch_size,
            overlength_threshold=overlength_threshold
        )
        
        self.tasks[task_id] = task
        logger.info(f"Created batch ingest task {task_id} for file: {file_path}")
        return task_id
    
    async def run_task(self, task_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute task and yield progress events"""
        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.tasks[task_id]
        
        try:
            async for event in task.execute():
                yield event
        finally:
            # Keep task in memory for status queries for 5 minutes
            # In production, use Redis or database for persistence
            pass
    
    def cancel_task(self, task_id: str) -> bool:
        """Request task cancellation"""
        if task_id not in self.tasks:
            return False
        
        self.tasks[task_id].cancel()
        return True
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get current task status"""
        if task_id not in self.tasks:
            return None
        
        return self.tasks[task_id].progress.to_dict()
    
    def cleanup_completed_tasks(self, max_age_seconds: int = 300):
        """Remove completed tasks older than max_age_seconds"""
        now = time.time()
        to_remove = []
        
        for task_id, task in self.tasks.items():
            if task.progress.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                if task.progress.end_time and (now - task.progress.end_time) > max_age_seconds:
                    to_remove.append(task_id)
        
        for task_id in to_remove:
            del self.tasks[task_id]
            logger.info(f"Cleaned up task {task_id}")
        
        return len(to_remove)


# Global service instance
_batch_ingest_service: Optional[BatchIngestService] = None


def get_batch_ingest_service() -> BatchIngestService:
    """Get global batch ingest service instance"""
    global _batch_ingest_service
    if _batch_ingest_service is None:
        _batch_ingest_service = BatchIngestService()
    return _batch_ingest_service
