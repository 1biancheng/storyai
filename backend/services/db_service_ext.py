"""Database Service Extensions for Documents Table
Add-on methods for three-articles integration document management
Import and call these from main db_service.py DatabaseService class
"""

import json
import logging
from typing import Dict, Optional
import sqlalchemy as sa

logger = logging.getLogger(__name__)


class DocumentsTableMixin:
    """Mixin class providing documents table operations for DatabaseService
    
    Usage: Add to DatabaseService class inheritance or monkey-patch methods
    """
    
    async def insert_file_document(self, file_hash: str, filename: str, file_size: int,
                                  encoding_detected: str, extraction_method: str,
                                  structure_type: str, source_lib: str,
                                  meta: Dict = None) -> int:
        """Insert file document metadata (for three-articles integration)
        
        Args:
            file_hash: MD5 hash of file (for deduplication)
            filename: Original filename
            file_size: File size in bytes
            encoding_detected: Detected encoding (UTF-8/GBK/Big5/etc)
            extraction_method: Method used (charset-normalizer+direct/textract/markitdown)
            structure_type: Structure preservation (plain/markdown)
            source_lib: Library used (charset-normalizer/textract/markitdown)
            meta: Extended metadata (book_id, chapter_index, confidence, etc)
        
        Returns:
            document_id: Database ID of inserted document
        """
        async with self.get_session() as session:
            # Use raw SQL for documents table
            query = sa.text("""
                INSERT INTO documents (
                    file_hash, filename, file_size, encoding_detected,
                    extraction_method, structure_type, source_lib,
                    meta, total_paragraphs, is_active, created_at, updated_at
                )
                VALUES (
                    :file_hash, :filename, :file_size, :encoding_detected,
                    :extraction_method, :structure_type, :source_lib,
                    :meta, 0, TRUE, NOW(), NOW()
                )
                RETURNING id
            """)
            
            result = await session.execute(query, {
                "file_hash": file_hash,
                "filename": filename,
                "file_size": file_size,
                "encoding_detected": encoding_detected,
                "extraction_method": extraction_method,
                "structure_type": structure_type,
                "source_lib": source_lib,
                "meta": json.dumps(meta or {})
            })
            
            row = result.fetchone()
            document_id = row[0]
            await session.commit()
            
            logger.info(f"Inserted file document: {filename} (ID: {document_id}, hash: {file_hash[:8]}...)")
            return document_id

    async def get_document_by_hash(self, file_hash: str) -> Optional[Dict]:
        """Get document by file hash (for deduplication check)
        
        Args:
            file_hash: MD5 hash of file
        
        Returns:
            Document dict or None if not found
        """
        async with self.get_session() as session:
            query = sa.text("""
                SELECT id, file_hash, filename, file_size, encoding_detected,
                       extraction_method, structure_type, source_lib,
                       total_paragraphs, meta, created_at
                FROM documents
                WHERE file_hash = :file_hash AND is_active = TRUE
                LIMIT 1
            """)
            
            result = await session.execute(query, {"file_hash": file_hash})
            row = result.fetchone()
            
            if row:
                return {
                    "id": row.id,
                    "file_hash": row.file_hash,
                    "filename": row.filename,
                    "file_size": row.file_size,
                    "encoding_detected": row.encoding_detected,
                    "extraction_method": row.extraction_method,
                    "structure_type": row.structure_type,
                    "source_lib": row.source_lib,
                    "total_paragraphs": row.total_paragraphs,
                    "meta": self._safe_load_meta(row.meta),
                    "created_at": row.created_at.isoformat() if row.created_at else None
                }
            
            return None

    def _safe_load_meta(self, meta):
        """安全加载meta字段"""
        if isinstance(meta, str):
            try:
                from services.json_repairer import safe_json_loads
                return safe_json_loads(meta, {})
            except Exception:
                return {}
        return meta if meta is not None else {}

    async def update_document_paragraph_count(self, document_id: int, count: int):
        """Update document's total_paragraphs count
        
        Args:
            document_id: Document ID
            count: New paragraph count
        """
        async with self.get_session() as session:
            query = sa.text("""
                UPDATE documents
                SET total_paragraphs = :count, updated_at = NOW()
                WHERE id = :document_id
            """)
            
            await session.execute(query, {"document_id": document_id, "count": count})
            await session.commit()
            
            logger.info(f"Updated document {document_id} paragraph count to {count}")

    async def delete_document(self, document_id: int):
        """Delete document (cascade deletes paragraphs via FK constraint)
        
        Args:
            document_id: Document ID
        """
        async with self.get_session() as session:
            query = sa.text("""
                UPDATE documents
                SET is_active = FALSE, updated_at = NOW()
                WHERE id = :document_id
            """)
            
            await session.execute(query, {"document_id": document_id})
            await session.commit()
            
            logger.info(f"Soft-deleted document {document_id}")


# Monkey-patch helper function
def extend_database_service_with_documents(db_service_instance):
    """Add documents table methods to an existing DatabaseService instance
    
    Usage:
        from services.db_service_ext import extend_database_service_with_documents
        db = await get_db_service()
        extend_database_service_with_documents(db)
        # Now db.insert_file_document() is available
    """
    mixin = DocumentsTableMixin()
    db_service_instance.insert_file_document = mixin.insert_file_document.__get__(db_service_instance, type(db_service_instance))
    db_service_instance.get_document_by_hash = mixin.get_document_by_hash.__get__(db_service_instance, type(db_service_instance))
    db_service_instance.update_document_paragraph_count = mixin.update_document_paragraph_count.__get__(db_service_instance, type(db_service_instance))
    db_service_instance.delete_document = mixin.delete_document.__get__(db_service_instance, type(db_service_instance))
    
    logger.info("Extended DatabaseService with documents table methods")
