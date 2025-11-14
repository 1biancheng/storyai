"""
关键词RAG - 稀疏激活检索
功能:
1. 关键词倒排索引构建
2. 稀疏激活(快速粗筛)
3. 向量精排(密集计算)
4. 混合检索策略
"""

import jieba.analyse
from typing import List, Dict, Any, Optional, Set
import numpy as np
from services.db_service import get_db_service


class KeywordRAG:
    """关键词检索增强生成"""
    
    def __init__(self):
        self.inverted_index: Dict[str, Set[str]] = {}
        self.db = None
    
    async def initialize(self):
        """初始化"""
        if not self.db:
            self.db = await get_db_service()
    
    async def build_inverted_index(self, book_id: Optional[str] = None):
        """
        构建关键词倒排索引
        
        Args:
            book_id: 书籍ID(可选,不指定则索引所有段落)
        """
        await self.initialize()
        
        # 查询所有段落的关键词
        if book_id:
            query = "SELECT id, keywords FROM paragraphs WHERE book_id = $1 AND keywords IS NOT NULL"
            paragraphs = await self.db.fetch_all(query, book_id)
        else:
            query = "SELECT id, keywords FROM paragraphs WHERE keywords IS NOT NULL"
            paragraphs = await self.db.fetch_all(query)
        
        # 构建倒排索引
        self.inverted_index = {}
        for para in paragraphs:
            para_id = str(para["id"])
            keywords = para.get("keywords", [])
            
            if keywords:
                for keyword in keywords:
                    if keyword not in self.inverted_index:
                        self.inverted_index[keyword] = set()
                    self.inverted_index[keyword].add(para_id)
        
        print(f"倒排索引构建完成: {len(self.inverted_index)} 个关键词")
    
    def extract_query_keywords(self, query: str, topK: int = 10) -> List[str]:
        """
        提取查询关键词
        
        Args:
            query: 查询文本
            topK: 返回前K个关键词
        
        Returns:
            关键词列表
        """
        keywords = jieba.analyse.extract_tags(query, topK=topK, withWeight=False)
        # 过滤单字
        return [kw for kw in keywords if len(kw) > 1]
    
    def keyword_activate(
        self,
        query: str,
        top_k: int = 20
    ) -> List[str]:
        """
        稀疏激活:通过关键词倒排快速定位候选段落
        
        Args:
            query: 查询文本
            top_k: 返回前K个段落ID
        
        Returns:
            激活的段落ID列表
        """
        # 提取查询关键词
        query_keywords = self.extract_query_keywords(query, topK=10)
        
        # 倒排检索
        activated_pids = set()
        keyword_scores = {}
        
        for kw in query_keywords:
            if kw in self.inverted_index:
                pids = self.inverted_index[kw]
                activated_pids.update(pids)
                
                # 记录命中关键词数(用于排序)
                for pid in pids:
                    keyword_scores[pid] = keyword_scores.get(pid, 0) + 1
        
        # 按关键词命中数排序
        sorted_pids = sorted(
            keyword_scores.items(),
            key=lambda x: -x[1]
        )
        
        return [pid for pid, _ in sorted_pids[:top_k]]
    
    async def vector_rerank(
        self,
        query_embedding: List[float],
        candidate_pids: List[str],
        top_n: int = 5,
        use_enhanced_embedding: bool = True
    ) -> List[Dict[str, Any]]:
        """
        向量精排:在激活集合内计算精确相似度
        
        Args:
            query_embedding: 查询向量
            candidate_pids: 候选段落ID列表
            top_n: 返回前N个结果
            use_enhanced_embedding: 是否使用增强向量
        
        Returns:
            排序后的段落列表
        """
        await self.initialize()
        
        if not candidate_pids:
            return []
        
        # 选择向量字段
        vector_field = "enhanced_embedding" if use_enhanced_embedding else "embedding"
        
        # 查询候选段落
        placeholders = ','.join(f'${i+1}' for i in range(len(candidate_pids)))
        query = f"""
            SELECT id, content, {vector_field}, sequence_weight, keywords
            FROM paragraphs 
            WHERE id IN ({placeholders})
            AND {vector_field} IS NOT NULL
        """
        
        paragraphs = await self.db.fetch_all(query, *candidate_pids)
        
        # 计算相似度
        query_vec = np.array(query_embedding)
        candidates = []
        
        for para in paragraphs:
            para_vec = np.array(para[vector_field])
            
            # 余弦相似度
            similarity = np.dot(query_vec, para_vec) / (
                np.linalg.norm(query_vec) * np.linalg.norm(para_vec) + 1e-10
            )
            
            # 综合得分:相似度 × 0.7 + 权重 × 0.3
            weight = para.get("sequence_weight", 1.0)
            combined_score = similarity * 0.7 + (weight / 2.0) * 0.3
            
            candidates.append({
                "id": para["id"],
                "content": para["content"],
                "similarity": float(similarity),
                "weight": float(weight),
                "combined_score": float(combined_score),
                "keywords": para.get("keywords", [])
            })
        
        # 按综合得分排序
        candidates.sort(key=lambda x: -x["combined_score"])
        
        return candidates[:top_n]
    
    async def hybrid_retrieve(
        self,
        query: str,
        query_embedding: List[float],
        top_k_sparse: int = 20,
        top_n_dense: int = 5,
        use_enhanced: bool = True
    ) -> List[Dict[str, Any]]:
        """
        混合检索:稀疏激活 + 向量精排
        
        Args:
            query: 查询文本
            query_embedding: 查询向量
            top_k_sparse: 稀疏激活返回数量
            top_n_dense: 密集精排返回数量
            use_enhanced: 是否使用增强向量
        
        Returns:
            最终结果列表
        """
        # 确保倒排索引已构建
        if not self.inverted_index:
            await self.build_inverted_index()
        
        # 阶段1: 稀疏激活
        activated_pids = self.keyword_activate(query, top_k=top_k_sparse)
        
        if not activated_pids:
            print("稀疏激活未找到候选段落,降级为全局向量搜索")
            # 降级策略:直接向量搜索
            return await self._fallback_vector_search(query_embedding, top_n_dense)
        
        # 阶段2: 向量精排
        results = await self.vector_rerank(
            query_embedding,
            activated_pids,
            top_n=top_n_dense,
            use_enhanced_embedding=use_enhanced
        )
        
        return results
    
    async def _fallback_vector_search(
        self,
        query_embedding: List[float],
        top_n: int = 5
    ) -> List[Dict[str, Any]]:
        """降级策略:全局向量搜索"""
        # 使用pgvector的向量搜索
        results = await self.db.vector_search_paragraphs(
            query_embedding,
            limit=top_n,
            threshold=0.5
        )
        
        return [{
            "id": r["id"],
            "content": r["content"],
            "similarity": r.get("similarity", 0.5),
            "weight": r.get("meta", {}).get("sequence_weight", 1.0),
            "combined_score": r.get("similarity", 0.5),
            "keywords": r.get("keywords", [])
        } for r in results]


# 便捷函数
async def keyword_rag_search(
    query: str,
    query_embedding: List[float],
    top_n: int = 5
) -> List[Dict[str, Any]]:
    """
    便捷函数:关键词RAG检索
    
    Args:
        query: 查询文本
        query_embedding: 查询向量
        top_n: 返回数量
    
    Returns:
        检索结果
    """
    rag = KeywordRAG()
    return await rag.hybrid_retrieve(query, query_embedding, top_n_dense=top_n)
"""
关键词RAG - 稀疏激活检索
功能:
1. 关键词倒排索引构建
2. 稀疏激活(快速粗筛)
3. 向量精排(密集计算)
4. 混合检索策略
"""

import jieba.analyse
from typing import List, Dict, Any, Optional, Set
import numpy as np
from services.db_service import get_db_service


class KeywordRAG:
    """关键词检索增强生成"""
    
    def __init__(self):
        self.inverted_index: Dict[str, Set[str]] = {}
        self.db = None
    
    async def initialize(self):
        """初始化"""
        if not self.db:
            self.db = await get_db_service()
    
    async def build_inverted_index(self, book_id: Optional[str] = None):
        """
        构建关键词倒排索引
        
        Args:
            book_id: 书籍ID(可选,不指定则索引所有段落)
        """
        await self.initialize()
        
        # 查询所有段落的关键词
        if book_id:
            query = "SELECT id, keywords FROM paragraphs WHERE book_id = $1 AND keywords IS NOT NULL"
            paragraphs = await self.db.fetch_all(query, book_id)
        else:
            query = "SELECT id, keywords FROM paragraphs WHERE keywords IS NOT NULL"
            paragraphs = await self.db.fetch_all(query)
        
        # 构建倒排索引
        self.inverted_index = {}
        for para in paragraphs:
            para_id = str(para["id"])
            keywords = para.get("keywords", [])
            
            if keywords:
                for keyword in keywords:
                    if keyword not in self.inverted_index:
                        self.inverted_index[keyword] = set()
                    self.inverted_index[keyword].add(para_id)
        
        print(f"倒排索引构建完成: {len(self.inverted_index)} 个关键词")
    
    def extract_query_keywords(self, query: str, topK: int = 10) -> List[str]:
        """
        提取查询关键词
        
        Args:
            query: 查询文本
            topK: 返回前K个关键词
        
        Returns:
            关键词列表
        """
        keywords = jieba.analyse.extract_tags(query, topK=topK, withWeight=False)
        # 过滤单字
        return [kw for kw in keywords if len(kw) > 1]
    
    def keyword_activate(
        self,
        query: str,
        top_k: int = 20
    ) -> List[str]:
        """
        稀疏激活:通过关键词倒排快速定位候选段落
        
        Args:
            query: 查询文本
            top_k: 返回前K个段落ID
        
        Returns:
            激活的段落ID列表
        """
        # 提取查询关键词
        query_keywords = self.extract_query_keywords(query, topK=10)
        
        # 倒排检索
        activated_pids = set()
        keyword_scores = {}
        
        for kw in query_keywords:
            if kw in self.inverted_index:
                pids = self.inverted_index[kw]
                activated_pids.update(pids)
                
                # 记录命中关键词数(用于排序)
                for pid in pids:
                    keyword_scores[pid] = keyword_scores.get(pid, 0) + 1
        
        # 按关键词命中数排序
        sorted_pids = sorted(
            keyword_scores.items(),
            key=lambda x: -x[1]
        )
        
        return [pid for pid, _ in sorted_pids[:top_k]]
    
    async def vector_rerank(
        self,
        query_embedding: List[float],
        candidate_pids: List[str],
        top_n: int = 5,
        use_enhanced_embedding: bool = True
    ) -> List[Dict[str, Any]]:
        """
        向量精排:在激活集合内计算精确相似度
        
        Args:
            query_embedding: 查询向量
            candidate_pids: 候选段落ID列表
            top_n: 返回前N个结果
            use_enhanced_embedding: 是否使用增强向量
        
        Returns:
            排序后的段落列表
        """
        await self.initialize()
        
        if not candidate_pids:
            return []
        
        # 选择向量字段
        vector_field = "enhanced_embedding" if use_enhanced_embedding else "embedding"
        
        # 查询候选段落
        placeholders = ','.join(f'${i+1}' for i in range(len(candidate_pids)))
        query = f"""
            SELECT id, content, {vector_field}, sequence_weight, keywords
            FROM paragraphs 
            WHERE id IN ({placeholders})
            AND {vector_field} IS NOT NULL
        """
        
        paragraphs = await self.db.fetch_all(query, *candidate_pids)
        
        # 计算相似度
        query_vec = np.array(query_embedding)
        candidates = []
        
        for para in paragraphs:
            para_vec = np.array(para[vector_field])
            
            # 余弦相似度
            similarity = np.dot(query_vec, para_vec) / (
                np.linalg.norm(query_vec) * np.linalg.norm(para_vec) + 1e-10
            )
            
            # 综合得分:相似度 × 0.7 + 权重 × 0.3
            weight = para.get("sequence_weight", 1.0)
            combined_score = similarity * 0.7 + (weight / 2.0) * 0.3
            
            candidates.append({
                "id": para["id"],
                "content": para["content"],
                "similarity": float(similarity),
                "weight": float(weight),
                "combined_score": float(combined_score),
                "keywords": para.get("keywords", [])
            })
        
        # 按综合得分排序
        candidates.sort(key=lambda x: -x["combined_score"])
        
        return candidates[:top_n]
    
    async def hybrid_retrieve(
        self,
        query: str,
        query_embedding: List[float],
        top_k_sparse: int = 20,
        top_n_dense: int = 5,
        use_enhanced: bool = True
    ) -> List[Dict[str, Any]]:
        """
        混合检索:稀疏激活 + 向量精排
        
        Args:
            query: 查询文本
            query_embedding: 查询向量
            top_k_sparse: 稀疏激活返回数量
            top_n_dense: 密集精排返回数量
            use_enhanced: 是否使用增强向量
        
        Returns:
            最终结果列表
        """
        # 确保倒排索引已构建
        if not self.inverted_index:
            await self.build_inverted_index()
        
        # 阶段1: 稀疏激活
        activated_pids = self.keyword_activate(query, top_k=top_k_sparse)
        
        if not activated_pids:
            print("稀疏激活未找到候选段落,降级为全局向量搜索")
            # 降级策略:直接向量搜索
            return await self._fallback_vector_search(query_embedding, top_n_dense)
        
        # 阶段2: 向量精排
        results = await self.vector_rerank(
            query_embedding,
            activated_pids,
            top_n=top_n_dense,
            use_enhanced_embedding=use_enhanced
        )
        
        return results
    
    async def _fallback_vector_search(
        self,
        query_embedding: List[float],
        top_n: int = 5
    ) -> List[Dict[str, Any]]:
        """降级策略:全局向量搜索"""
        # 使用pgvector的向量搜索
        results = await self.db.vector_search_paragraphs(
            query_embedding,
            limit=top_n,
            threshold=0.5
        )
        
        return [{
            "id": r["id"],
            "content": r["content"],
            "similarity": r.get("similarity", 0.5),
            "weight": r.get("meta", {}).get("sequence_weight", 1.0),
            "combined_score": r.get("similarity", 0.5),
            "keywords": r.get("keywords", [])
        } for r in results]


# 便捷函数
async def keyword_rag_search(
    query: str,
    query_embedding: List[float],
    top_n: int = 5
) -> List[Dict[str, Any]]:
    """
    便捷函数:关键词RAG检索
    
    Args:
        query: 查询文本
        query_embedding: 查询向量
        top_n: 返回数量
    
    Returns:
        检索结果
    """
    rag = KeywordRAG()
    return await rag.hybrid_retrieve(query, query_embedding, top_n_dense=top_n)
