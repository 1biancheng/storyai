import os
import json
import time
import hashlib
import asyncio
from typing import AsyncGenerator, Dict, Any, List, Optional

from functools import lru_cache

from services.file_parser_service import parse_file
from services.paragraph_service import split_into_semantic_paragraphs, embed_paragraphs
from services.classify_service import classify_paragraphs
from services.db_service import get_db_service
from errors import DomainError, sse_error_event


def _md5_file(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


@lru_cache(maxsize=500)
def _cached_parse(bucket: int, md5_hex: str, format: str, ext: str, path: str, encoding_override: Optional[str]) -> Dict[str, Any]:
    # 使用 7 天"时间桶"实现近似 TTL:桶变化时缓存键失效
    return parse_file(path, format=format, encoding_override=encoding_override)


async def ingest_file_stream(path: str, model_id: str = "text-embedding-3-small", format: str = "text", encoding: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
    """
    统一文本接入管线(SSE 生成器):
    - 解析(带缓存)→ 段落拆分 → 批处理(分类+向量化) → 入库
    - 事件:parsed/progress/batch_error/complete/error
    - parsed 事件携带 encoding/confidence 与 2KB preview
    """
    try:
        ext = os.path.splitext(path)[1].lower()
        bucket = int(time.time() // (7 * 24 * 3600))  # 7 天桶
        md5_hex = _md5_file(path)

        parsed = _cached_parse(bucket, md5_hex, format, ext, path, encoding)
        meta = parsed.get("meta", {})
        text_full = parsed.get("text", "")
        preview = text_full[:2048] if text_full else ""
        yield {"event": "parsed", "data": json.dumps({
            "path": path,
            "encoding": meta.get("encoding"),
            "confidence": meta.get("confidence"),
            "meta": meta,
            "preview": preview,
        })}

        text = text_full
        if not text.strip():
            yield sse_error_event(DomainError.EMPTY_TEXT, "无法从文件中提取文本")
            return

        paragraphs = split_into_semantic_paragraphs(text)

        if not paragraphs:
            yield sse_error_event(DomainError.NO_PARAGRAPHS, "未能拆分得到有效段落")
            return

        # 批处理:按段落分批(100 段/批),仅输出 batch 级进度与错误
        BATCH_SIZE = 100
        total_batches = (len(paragraphs) + BATCH_SIZE - 1) // BATCH_SIZE
        all_metas: List[Dict[str, Any]] = []
        all_vectors: List[List[float]] = []
        for batch_idx in range(total_batches):
            start = batch_idx * BATCH_SIZE
            end = min(start + BATCH_SIZE, len(paragraphs))
            part = paragraphs[start:end]

            # 进度事件:当前批次/总批次
            percent = int(round((batch_idx + 1) * 100 / max(total_batches, 1)))
            yield {"event": "progress", "data": json.dumps({
                "batchIndex": batch_idx + 1,
                "totalBatches": total_batches,
                "percent": percent
            })}

            # 分类(指数退避)
            try:
                metas: List[Dict[str, Any]] = []
                for attempt in (1, 2, 3):
                    try:
                        metas = await classify_paragraphs(part)
                        break
                    except Exception as e:
                        if attempt == 3:
                            raise e
                        await asyncio.sleep(2 ** (attempt - 1))
                all_metas.extend(metas)
            except Exception as e:
                ts = time.strftime("%Y-%m-%d %H:%M:%S")
                summary = f"{ts} 第{batch_idx + 1}批 {str(e)}"
                yield {"event": "batch_error", "data": json.dumps({
                    "batchIndex": batch_idx + 1,
                    "message": str(e),
                    "error": summary
                })}

            # 向量化(指数退避)
            try:
                vectors: List[List[float]] = []
                for attempt in (1, 2, 3):
                    try:
                        vectors = await embed_paragraphs(part, embedding_model=model_id)
                        break
                    except Exception as e:
                        if attempt == 3:
                            raise e
                        await asyncio.sleep(2 ** (attempt - 1))
                all_vectors.extend(vectors)
            except Exception as e:
                ts = time.strftime("%Y-%m-%d %H:%M:%S")
                summary = f"{ts} 第{batch_idx + 1}批 {str(e)}"
                yield {"event": "batch_error", "data": json.dumps({
                    "batchIndex": batch_idx + 1,
                    "message": str(e),
                    "error": summary
                })}

        # 入库
        db = await get_db_service()
        title = meta.get("title") or os.path.basename(path)
        doc_id = await db.insert_document(
            title=title,
            content=text,
            embedding=None,
            content_type="book",
            source=path,
            doc_metadata=meta,
        )

        rows: List[Dict[str, Any]] = []
        book_id = f"doc-{doc_id}"
        for idx, content in enumerate(paragraphs):
            row_meta = all_metas[idx] if idx < len(all_metas) else {}
            rows.append({
                "book_id": book_id,
                "chapter_index": None,
                "section_index": None,
                "paragraph_index": idx,
                "content": content,
                "meta": row_meta,
                "embedding": all_vectors[idx] if idx < len(all_vectors) else None,
                "embedding_model": model_id,
            })
        await db.insert_paragraphs(rows)

        yield {"event": "complete", "data": json.dumps({"docId": doc_id})}
    except Exception as e:
        yield sse_error_event(DomainError.INGEST_ERROR, str(e))
