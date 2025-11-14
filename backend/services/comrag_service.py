"""ComRAG质心式记忆机制服务
功能:
- 多维度质量评分(LLM评分+用户反馈+使用频率+向量聚类度)
- 质心向量计算与聚类管理
- 高质量/低质量记忆库操作
"""

import hashlib
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from services.db_service import get_db_service
from services.ai_service import AIService


@dataclass
class QualityScore:
    """质量评分结构"""
    final_score: float  # 综合评分(0-1)
    llm_score: float  # LLM评分
    user_feedback_score: float  # 用户反馈评分
    usage_score: float  # 使用频率评分
    cluster_score: float  # 聚类紧密度评分
    quality_level: str  # high | low


def calculate_multidimensional_quality(
    llm_score: float,
    likes: int = 0,
    dislikes: int = 0,
    usage_count: int = 0,
    centroid_distance: float = 0.0
) -> QualityScore:
    """多维度质量评分计算
    
    公式:
    final_score = 0.4 * llm_score 
                + 0.3 * user_feedback_score
                + 0.2 * usage_score
                + 0.1 * cluster_score
    
    Args:
        llm_score: LLM评分(0-1)
        likes: 点赞数
        dislikes: 点踩数
        usage_count: 使用次数
        centroid_distance: 与质心的距离(0-1)
    
    Returns:
        QualityScore对象
    """
    # 用户反馈评分
    total_feedback = likes + dislikes + 1  # +1避免除零
    user_feedback_score = (likes - dislikes) / total_feedback
    user_feedback_score = max(0.0, min(1.0, (user_feedback_score + 1) / 2))  # 归一化到0-1
    
    # 使用频率评分(对数归一化)
    import math
    usage_score = min(1.0, math.log(usage_count + 1) / 5)  # log(1)=0, log(148)≈5
    
    # 聚类紧密度评分(距离越小越好)
    cluster_score = 1.0 - centroid_distance
    
    # 综合评分
    final_score = (
        0.4 * llm_score +
        0.3 * user_feedback_score +
        0.2 * usage_score +
        0.1 * cluster_score
    )
    
    # 质量等级划分
    quality_level = "high" if final_score >= 0.7 else "low"
    
    return QualityScore(
        final_score=final_score,
        llm_score=llm_score,
        user_feedback_score=user_feedback_score,
        usage_score=usage_score,
        cluster_score=cluster_score,
        quality_level=quality_level
    )


def calculate_centroid_vector(embeddings: List[List[float]]) -> List[float]:
    """计算质心向量(多个向量的平均)
    
    Args:
        embeddings: 向量列表
    
    Returns:
        质心向量
    """
    if not embeddings:
        return []
    
    dim = len(embeddings[0])
    centroid = [0.0] * dim
    
    for emb in embeddings:
        for i in range(dim):
            centroid[i] += emb[i]
    
    count = len(embeddings)
    centroid = [c / count for c in centroid]
    
    return centroid


def calculate_cluster_tightness(embeddings: List[List[float]], centroid: List[float]) -> float:
    """计算聚类紧密度(方差)
    
    Args:
        embeddings: 向量列表
        centroid: 质心向量
    
    Returns:
        方差(0-1),越小表示聚类越紧密
    """
    if not embeddings or not centroid:
        return 1.0
    
    import math
    
    # 计算每个向量到质心的欧氏距离
    distances = []
    for emb in embeddings:
        dist = math.sqrt(sum((e - c) ** 2 for e, c in zip(emb, centroid)))
        distances.append(dist)
    
    # 计算方差
    mean_dist = sum(distances) / len(distances)
    variance = sum((d - mean_dist) ** 2 for d in distances) / len(distances)
    
    # 归一化到0-1(经验值:方差通常在0-2之间)
    return min(1.0, variance / 2.0)


def generate_centroid_id(paragraph_ids: List[str]) -> str:
    """生成质心ID(基于段落ID列表的哈希)
    
    Args:
        paragraph_ids: 段落ID列表
    
    Returns:
        质心ID(SHA256前10位)
    """
    combined = '|'.join(sorted(paragraph_ids))
    hash_obj = hashlib.sha256(combined.encode('utf-8'))
    return hash_obj.hexdigest()[:10]


async def insert_memory(
    content: str,
    embedding: List[float],
    quality_score: QualityScore,
    meta: Dict[str, Any],
    source_paragraph_ids: Optional[List[str]] = None
) -> int:
    """插入记忆到高质量或低质量库
    
    Args:
        content: 段落内容
        embedding: 向量
        quality_score: 质量评分对象
        meta: 元数据
        source_paragraph_ids: 来源段落ID列表
    
    Returns:
        插入的记忆ID
    """
    db = await get_db_service()
    
    # 确定插入到哪个表
    table_name = "memory_high" if quality_score.quality_level == "high" else "memory_low"
    
    # 生成质心ID
    centroid_id = generate_centroid_id(source_paragraph_ids or [str(int(time.time()))])
    
    # 准备数据
    data = {
        "centroid_id": centroid_id,
        "content": content,
        "embedding": embedding,
        "centroid_embedding": embedding,  # 初始时质心就是自己
        "quality_score": quality_score.final_score,
        "llm_score": quality_score.llm_score,
        "user_feedback_score": quality_score.user_feedback_score,
        "usage_count": 0,
        "cluster_tightness": 0.0,
        "source_paragraph_ids": source_paragraph_ids or [],
        "meta": meta
    }
    
    # 插入数据库
    query = f"""
        INSERT INTO {table_name} 
        (centroid_id, content, embedding, centroid_embedding, quality_score, 
         llm_score, user_feedback_score, usage_count, cluster_tightness, 
         source_paragraph_ids, meta)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
    """
    
    result = await db.execute_query(query, [
        data["centroid_id"],
        data["content"],
        data["embedding"],
        data["centroid_embedding"],
        data["quality_score"],
        data["llm_score"],
        data["user_feedback_score"],
        data["usage_count"],
        data["cluster_tightness"],
        data["source_paragraph_ids"],
        data["meta"]
    ])
    
    return result[0]["id"] if result else 0


async def search_memory_by_vector(
    query_embedding: List[float],
    memory_type: str = "high",
    limit: int = 10,
    threshold: float = 0.7
) -> List[Dict[str, Any]]:
    """从记忆库检索相似段落
    
    Args:
        query_embedding: 查询向量
        memory_type: 'high' | 'low'
        limit: 返回数量
        threshold: 相似度阈值
    
    Returns:
        记忆列表
    """
    db = await get_db_service()
    table_name = f"memory_{memory_type}"
    
    query = f"""
        SELECT id, content, embedding, quality_score, llm_score, 
               user_feedback_score, usage_count, meta,
               1 - (embedding <=> $1::vector) as similarity
        FROM {table_name}
        WHERE 1 - (embedding <=> $1::vector) >= $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
    """
    
    results = await db.execute_query(query, [query_embedding, threshold, limit])
    return results


async def update_usage_count(memory_id: int, memory_type: str = "high") -> None:
    """更新记忆的使用次数
    
    Args:
        memory_id: 记忆ID
        memory_type: 'high' | 'low'
    """
    db = await get_db_service()
    table_name = f"memory_{memory_type}"
    
    query = f"""
        UPDATE {table_name}
        SET usage_count = usage_count + 1,
            last_updated = NOW()
        WHERE id = $1
    """
    
    await db.execute_query(query, [memory_id])


async def record_user_feedback(
    memory_id: int,
    memory_type: str,
    feedback_type: str,
    user_id: str = "anonymous",
    comment: Optional[str] = None
) -> int:
    """记录用户反馈
    
    Args:
        memory_id: 记忆ID
        memory_type: 'high' | 'low'
        feedback_type: 'like' | 'dislike' | 'report'
        user_id: 用户ID
        comment: 评论
    
    Returns:
        反馈ID
    """
    db = await get_db_service()
    
    query = """
        INSERT INTO user_feedback (memory_id, memory_type, feedback_type, comment, user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    """
    
    result = await db.execute_query(query, [
        memory_id,
        memory_type,
        feedback_type,
        comment,
        user_id
    ])
    
    return result[0]["id"] if result else 0


async def update_centroid_clustering(centroid_id: str, memory_type: str = "high") -> None:
    """更新质心聚类信息(重新计算质心向量和紧密度)
    
    Args:
        centroid_id: 质心ID
        memory_type: 'high' | 'low'
    """
    db = await get_db_service()
    table_name = f"memory_{memory_type}"
    
    # 获取该质心下所有成员
    query = f"""
        SELECT id, embedding
        FROM {table_name}
        WHERE centroid_id = $1
    """
    
    members = await db.execute_query(query, [centroid_id])
    
    if not members or len(members) < 2:
        return
    
    # 提取向量
    embeddings = [m["embedding"] for m in members]
    
    # 计算新质心
    new_centroid = calculate_centroid_vector(embeddings)
    
    # 计算聚类紧密度
    tightness = calculate_cluster_tightness(embeddings, new_centroid)
    
    # 更新所有成员的质心向量和紧密度
    update_query = f"""
        UPDATE {table_name}
        SET centroid_embedding = $1,
            cluster_tightness = $2,
            last_updated = NOW()
        WHERE centroid_id = $3
    """
    
    await db.execute_query(update_query, [new_centroid, tightness, centroid_id])
