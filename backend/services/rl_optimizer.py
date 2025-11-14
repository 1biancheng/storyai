"""
强化学习优化器 (Reinforcement Learning Optimizer)
实现生成→入库→再生成→更准确的闭环学习机制

核心功能:
1. Q-Learning算法: 为每个段落维护在不同查询下的预期质量Q值
2. 查询聚类: 使用K-Means将相似查询分组,降低状态空间复杂度
3. UCB探索策略: 平衡探索(exploration)与利用(exploitation)
4. 段落选择优化: 基于Q值和UCB分数选择最优段落组合
5. 生成内容入库: 高质量生成内容自动入库,形成正向反馈循环

技术原理:
- Q值表: 记录段落在不同查询类下的表现(存储在meta.q_values)
- 查询聚类: K-Means(50个簇),映射无限查询空间到有限状态空间
- UCB公式: score = Q + c × sqrt(ln(total_visits) / visit_count)
- 奖励函数: reward = 0.7 × LLM_score + 0.3 × user_feedback
- 更新公式: Q_new = Q_old + α × (reward - Q_old)

作者: AI Assistant
日期: 2024-01-15
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sklearn.cluster import KMeans
import json
from datetime import datetime
import math

logger = logging.getLogger(__name__)


class ReinforcementLearningOptimizer:
    """强化学习优化器"""
    
    def __init__(self, db_pool, num_clusters: int = 50):
        """
        初始化RL优化器
        
        Args:
            db_pool: 数据库连接池
            num_clusters: 查询聚类数量(默认50)
        """
        self.db_pool = db_pool
        self.num_clusters = num_clusters
        self.kmeans_model: Optional[KMeans] = None
        self.cluster_centers: Optional[np.ndarray] = None
        
        # Q-Learning超参数
        self.alpha = 0.1  # 学习率
        self.gamma = 0.9  # 折扣因子(暂未使用,单步任务简化为0)
        self.epsilon = 0.1  # Epsilon-greedy探索率
        self.ucb_constant = 2.0  # UCB探索常数
        
        # 入库质量阈值
        self.high_quality_threshold = 0.8
        self.medium_quality_threshold = 0.6
        
        # 去重相似度阈值
        self.duplicate_threshold = 0.95
    
    
    async def initialize_query_clusters(self, sample_size: int = 1000):
        """
        初始化查询聚类模型
        从历史查询中采样,训练K-Means模型
        
        Args:
            sample_size: 采样数量
        """
        logger.info(f"Initializing query clusters (K={self.num_clusters})...")
        
        async with self.db_pool.acquire() as conn:
            # 从历史段落中随机采样embedding
            query = """
                SELECT embedding 
                FROM paragraphs 
                WHERE embedding IS NOT NULL 
                ORDER BY RANDOM() 
                LIMIT $1
            """
            rows = await conn.fetch(query, sample_size)
        
        if not rows:
            logger.warning("No embeddings found, using default clusters")
            # 创建默认聚类中心(随机初始化)
            self.cluster_centers = np.random.randn(self.num_clusters, 1536) * 0.1
            self.kmeans_model = KMeans(n_clusters=self.num_clusters, random_state=42)
            self.kmeans_model.cluster_centers_ = self.cluster_centers
            return
        
        # 提取向量
        embeddings = np.array([row['embedding'] for row in rows])
        
        # 训练K-Means
        self.kmeans_model = KMeans(n_clusters=self.num_clusters, random_state=42)
        self.kmeans_model.fit(embeddings)
        self.cluster_centers = self.kmeans_model.cluster_centers_
        
        logger.info(f"Query clusters initialized with {len(embeddings)} samples")
    
    
    def get_query_cluster(self, query_vec: np.ndarray) -> str:
        """
        将查询向量映射到查询簇
        
        Args:
            query_vec: 查询向量(1536维)
        
        Returns:
            查询簇ID, 格式: "query_cluster_0" ~ "query_cluster_49"
        """
        if self.kmeans_model is None:
            raise RuntimeError("Query clusters not initialized. Call initialize_query_clusters() first.")
        
        cluster_id = self.kmeans_model.predict([query_vec])[0]
        return f"query_cluster_{cluster_id}"
    
    
    async def get_paragraph_q_value(
        self, 
        paragraph_id: str, 
        query_cluster: str
    ) -> Tuple[float, int]:
        """
        获取段落在特定查询簇下的Q值和访问次数
        
        Args:
            paragraph_id: 段落ID
            query_cluster: 查询簇ID
        
        Returns:
            (Q值, 访问次数)
        """
        async with self.db_pool.acquire() as conn:
            query = """
                SELECT meta 
                FROM paragraphs 
                WHERE id = $1
            """
            row = await conn.fetchrow(query, paragraph_id)
        
        if not row or not row['meta']:
            return 0.5, 0  # 默认Q值0.5,未访问
        
        meta = row['meta']
        q_values = meta.get('q_values', {})
        visit_count = meta.get('visit_count', {})
        
        q_value = q_values.get(query_cluster, 0.5)
        visits = visit_count.get(query_cluster, 0)
        
        return q_value, visits
    
    
    async def calculate_ucb_score(
        self,
        paragraph_id: str,
        query_cluster: str,
        total_visits_all_paragraphs: int
    ) -> float:
        """
        计算UCB (Upper Confidence Bound) 分数
        公式: UCB = Q + c × sqrt(ln(N) / n)
        
        Args:
            paragraph_id: 段落ID
            query_cluster: 查询簇ID
            total_visits_all_paragraphs: 所有段落的总访问次数
        
        Returns:
            UCB分数
        """
        q_value, visit_count = await self.get_paragraph_q_value(paragraph_id, query_cluster)
        
        if visit_count == 0:
            # 未访问段落给予极高UCB,鼓励探索
            return float('inf')
        
        # UCB公式
        exploration_bonus = self.ucb_constant * math.sqrt(
            math.log(total_visits_all_paragraphs + 1) / visit_count
        )
        
        ucb_score = q_value + exploration_bonus
        return ucb_score
    
    
    async def select_paragraphs_with_rl(
        self,
        candidate_paragraphs: List[Dict[str, Any]],
        query_vec: np.ndarray,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        使用强化学习策略选择段落
        结合Q值和UCB探索奖励,选择最优段落
        
        Args:
            candidate_paragraphs: 候选段落列表(已通过向量检索筛选)
            query_vec: 查询向量
            top_k: 选择数量
        
        Returns:
            优化后的段落列表
        """
        if not candidate_paragraphs:
            return []
        
        # 获取查询簇
        query_cluster = self.get_query_cluster(query_vec)
        
        # 计算总访问次数(用于UCB)
        total_visits = 0
        for para in candidate_paragraphs:
            _, visits = await self.get_paragraph_q_value(para['id'], query_cluster)
            total_visits += visits
        
        # Epsilon-greedy策略
        if np.random.random() < self.epsilon:
            # 探索:随机选择
            np.random.shuffle(candidate_paragraphs)
            selected = candidate_paragraphs[:top_k]
            logger.debug(f"RL: Exploration mode (random selection)")
        else:
            # 利用:基于UCB选择
            paragraph_scores = []
            for para in candidate_paragraphs:
                ucb_score = await self.calculate_ucb_score(
                    para['id'], 
                    query_cluster, 
                    total_visits
                )
                paragraph_scores.append({
                    'paragraph': para,
                    'ucb_score': ucb_score,
                    'q_value': await self.get_paragraph_q_value(para['id'], query_cluster)
                })
            
            # 按UCB分数排序
            paragraph_scores.sort(key=lambda x: x['ucb_score'], reverse=True)
            selected = [item['paragraph'] for item in paragraph_scores[:top_k]]
            
            logger.debug(f"RL: Exploitation mode (UCB selection)")
            logger.debug(f"Top UCB scores: {[round(item['ucb_score'], 3) for item in paragraph_scores[:top_k]]}")
        
        # 添加RL元信息
        for para in selected:
            q_value, visits = await self.get_paragraph_q_value(para['id'], query_cluster)
            para['rl_info'] = {
                'query_cluster': query_cluster,
                'q_value': q_value,
                'visit_count': visits
            }
        
        return selected
    
    
    async def update_q_values(
        self,
        paragraph_ids: List[str],
        query_vec: np.ndarray,
        reward: float
    ):
        """
        更新段落的Q值
        Q-Learning更新公式: Q_new = Q_old + α × (reward - Q_old)
        
        Args:
            paragraph_ids: 段落ID列表
            query_vec: 查询向量
            reward: 奖励值(0-1之间)
        """
        query_cluster = self.get_query_cluster(query_vec)
        
        async with self.db_pool.acquire() as conn:
            for pid in paragraph_ids:
                # 获取当前Q值和访问次数
                q_old, visit_count = await self.get_paragraph_q_value(pid, query_cluster)
                
                # Q-Learning更新
                q_new = q_old + self.alpha * (reward - q_old)
                q_new = max(0.0, min(1.0, q_new))  # 限制在[0, 1]
                
                # 更新meta字段
                update_query = """
                    UPDATE paragraphs
                    SET meta = jsonb_set(
                        jsonb_set(
                            COALESCE(meta, '{}'::jsonb),
                            ARRAY['q_values', $2],
                            to_jsonb($3::float)
                        ),
                        ARRAY['visit_count', $2],
                        to_jsonb($4::int)
                    ),
                    updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """
                await conn.execute(
                    update_query,
                    pid,
                    query_cluster,
                    q_new,
                    visit_count + 1
                )
                
                logger.debug(f"Updated Q-value: {pid} | {query_cluster} | {q_old:.3f} → {q_new:.3f}")
        
        logger.info(f"Q-values updated for {len(paragraph_ids)} paragraphs (reward={reward:.3f})")
    
    
    async def calculate_reward(
        self,
        spliced_content: str,
        contexts: List[str],
        llm_score: Optional[float] = None,
        user_feedback: Optional[str] = None
    ) -> float:
        """
        计算综合奖励
        reward = 0.7 × LLM_score + 0.3 × user_feedback_score
        
        Args:
            spliced_content: 拼接内容
            contexts: 上下文段落列表
            llm_score: LLM评分(0-1),若为None则不使用
            user_feedback: 用户反馈("thumbs_up"/"thumbs_down"/None)
        
        Returns:
            综合奖励(0-1之间)
        """
        reward = 0.0
        
        # LLM评分部分(权重0.7)
        if llm_score is not None:
            reward += 0.7 * llm_score
        else:
            # 默认中等分数
            reward += 0.7 * 0.5
        
        # 用户反馈部分(权重0.3)
        if user_feedback == "thumbs_up":
            reward += 0.3 * 1.0
        elif user_feedback == "thumbs_down":
            reward += 0.3 * 0.0
        else:
            # 无反馈,默认中等
            reward += 0.3 * 0.5
        
        return min(1.0, max(0.0, reward))
    
    
    async def should_store_generated_content(
        self,
        reward: float,
        spliced_content: str
    ) -> Tuple[bool, str]:
        """
        判断是否应将生成内容入库
        
        Args:
            reward: 奖励分数
            spliced_content: 生成内容
        
        Returns:
            (是否入库, 质量标签)
        """
        # 质量检查
        if reward >= self.high_quality_threshold:
            quality_tag = "high"
            should_store = True
        elif reward >= self.medium_quality_threshold:
            quality_tag = "medium"
            should_store = False  # 中等质量暂不入库
        else:
            quality_tag = "low"
            should_store = False
        
        # 去重检查(简化:检查长度,实际应检查语义相似度)
        if should_store and len(spliced_content) < 50:
            should_store = False
            logger.debug("Content too short, skip storing")
        
        return should_store, quality_tag
    
    
    async def store_generated_paragraph(
        self,
        content: str,
        embedding: np.ndarray,
        source_paragraph_ids: List[str],
        query_vec: np.ndarray,
        reward: float,
        book_id: str
    ) -> Optional[str]:
        """
        将生成内容作为新段落入库
        继承源段落的Q值,加速冷启动
        
        Args:
            content: 生成内容
            embedding: 内容向量
            source_paragraph_ids: 源段落ID列表
            query_vec: 查询向量
            reward: 奖励分数
            book_id: 书籍ID
        
        Returns:
            新段落ID,若入库失败则返回None
        """
        # 判断是否应入库
        should_store, quality_tag = await self.should_store_generated_content(reward, content)
        
        if not should_store:
            logger.debug(f"Skip storing: quality={quality_tag}, reward={reward:.3f}")
            return None
        
        # 计算源段落的平均Q值(继承机制)
        query_cluster = self.get_query_cluster(query_vec)
        avg_q_value = 0.0
        for pid in source_paragraph_ids:
            q_value, _ = await self.get_paragraph_q_value(pid, query_cluster)
            avg_q_value += q_value
        avg_q_value /= len(source_paragraph_ids) if source_paragraph_ids else 1.0
        
        # 构造meta字段
        meta = {
            "is_generated": True,
            "generation_source": source_paragraph_ids,
            "generation_time": datetime.utcnow().isoformat(),
            "quality": quality_tag,
            "generation_reward": reward,
            "q_values": {query_cluster: avg_q_value},
            "visit_count": {query_cluster: 0},
            "avg_reward": reward,
            "total_visits": 0
        }
        
        # 插入数据库
        async with self.db_pool.acquire() as conn:
            query = """
                INSERT INTO paragraphs (
                    book_id, content, embedding, enhanced_embedding,
                    meta, sequence_weight, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                RETURNING id
            """
            row = await conn.fetchrow(
                query,
                book_id,
                content,
                embedding.tolist(),
                embedding.tolist(),  # 初始增强向量=原始向量
                json.dumps(meta),
                1.0  # 初始权重1.0
            )
            new_paragraph_id = row['id']
        
        logger.info(f"Stored generated paragraph: {new_paragraph_id} | quality={quality_tag} | reward={reward:.3f}")
        
        return new_paragraph_id
    
    
    async def async_evaluate_and_optimize(
        self,
        spliced_content: str,
        paragraphs: List[Dict[str, Any]],
        query_vec: np.ndarray,
        query_text: str,
        llm_score: Optional[float] = None,
        user_feedback: Optional[str] = None,
        store_generated: bool = False,
        book_id: Optional[str] = None
    ):
        """
        异步评估与优化(后台任务,不阻塞用户响应)
        
        流程:
        1. 计算综合奖励
        2. 更新Q值
        3. (可选)将高质量内容入库
        
        Args:
            spliced_content: 拼接内容
            paragraphs: 使用的段落列表
            query_vec: 查询向量
            query_text: 查询文本
            llm_score: LLM评分(可选)
            user_feedback: 用户反馈(可选)
            store_generated: 是否入库
            book_id: 书籍ID(入库时必需)
        """
        try:
            # 1. 计算奖励
            contexts = [p['content'] for p in paragraphs]
            reward = await self.calculate_reward(
                spliced_content, 
                contexts, 
                llm_score, 
                user_feedback
            )
            
            # 2. 更新Q值
            paragraph_ids = [p['id'] for p in paragraphs]
            await self.update_q_values(paragraph_ids, query_vec, reward)
            
            # 3. 高质量内容入库
            if store_generated and book_id:
                # 生成embedding(简化:使用查询向量作为近似)
                # 实际应调用OpenAI API生成真实embedding
                embedding = query_vec
                
                new_pid = await self.store_generated_paragraph(
                    content=spliced_content,
                    embedding=embedding,
                    source_paragraph_ids=paragraph_ids,
                    query_vec=query_vec,
                    reward=reward,
                    book_id=book_id
                )
                
                if new_pid:
                    logger.info(f"Generated content stored: {new_pid}")
            
            logger.info(f"RL optimization completed: query='{query_text[:50]}...' | reward={reward:.3f}")
        
        except Exception as e:
            logger.error(f"RL optimization failed: {e}", exc_info=True)
            # 静默失败,不影响用户体验


# 全局实例(懒加载)
_rl_optimizer_instance: Optional[ReinforcementLearningOptimizer] = None


async def get_rl_optimizer(db_pool) -> ReinforcementLearningOptimizer:
    """
    获取全局RL优化器实例(单例模式)
    
    Args:
        db_pool: 数据库连接池
    
    Returns:
        ReinforcementLearningOptimizer实例
    """
    global _rl_optimizer_instance
    
    if _rl_optimizer_instance is None:
        _rl_optimizer_instance = ReinforcementLearningOptimizer(db_pool)
        # 初始化查询聚类(异步)
        await _rl_optimizer_instance.initialize_query_clusters()
    
    return _rl_optimizer_instance
"""
强化学习优化器 (Reinforcement Learning Optimizer)
实现生成→入库→再生成→更准确的闭环学习机制

核心功能:
1. Q-Learning算法: 为每个段落维护在不同查询下的预期质量Q值
2. 查询聚类: 使用K-Means将相似查询分组,降低状态空间复杂度
3. UCB探索策略: 平衡探索(exploration)与利用(exploitation)
4. 段落选择优化: 基于Q值和UCB分数选择最优段落组合
5. 生成内容入库: 高质量生成内容自动入库,形成正向反馈循环

技术原理:
- Q值表: 记录段落在不同查询类下的表现(存储在meta.q_values)
- 查询聚类: K-Means(50个簇),映射无限查询空间到有限状态空间
- UCB公式: score = Q + c × sqrt(ln(total_visits) / visit_count)
- 奖励函数: reward = 0.7 × LLM_score + 0.3 × user_feedback
- 更新公式: Q_new = Q_old + α × (reward - Q_old)

作者: AI Assistant
日期: 2024-01-15
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sklearn.cluster import KMeans
import json
from datetime import datetime
import math

logger = logging.getLogger(__name__)


class ReinforcementLearningOptimizer:
    """强化学习优化器"""
    
    def __init__(self, db_pool, num_clusters: int = 50):
        """
        初始化RL优化器
        
        Args:
            db_pool: 数据库连接池
            num_clusters: 查询聚类数量(默认50)
        """
        self.db_pool = db_pool
        self.num_clusters = num_clusters
        self.kmeans_model: Optional[KMeans] = None
        self.cluster_centers: Optional[np.ndarray] = None
        
        # Q-Learning超参数
        self.alpha = 0.1  # 学习率
        self.gamma = 0.9  # 折扣因子(暂未使用,单步任务简化为0)
        self.epsilon = 0.1  # Epsilon-greedy探索率
        self.ucb_constant = 2.0  # UCB探索常数
        
        # 入库质量阈值
        self.high_quality_threshold = 0.8
        self.medium_quality_threshold = 0.6
        
        # 去重相似度阈值
        self.duplicate_threshold = 0.95
    
    
    async def initialize_query_clusters(self, sample_size: int = 1000):
        """
        初始化查询聚类模型
        从历史查询中采样,训练K-Means模型
        
        Args:
            sample_size: 采样数量
        """
        logger.info(f"Initializing query clusters (K={self.num_clusters})...")
        
        async with self.db_pool.acquire() as conn:
            # 从历史段落中随机采样embedding
            query = """
                SELECT embedding 
                FROM paragraphs 
                WHERE embedding IS NOT NULL 
                ORDER BY RANDOM() 
                LIMIT $1
            """
            rows = await conn.fetch(query, sample_size)
        
        if not rows:
            logger.warning("No embeddings found, using default clusters")
            # 创建默认聚类中心(随机初始化)
            self.cluster_centers = np.random.randn(self.num_clusters, 1536) * 0.1
            self.kmeans_model = KMeans(n_clusters=self.num_clusters, random_state=42)
            self.kmeans_model.cluster_centers_ = self.cluster_centers
            return
        
        # 提取向量
        embeddings = np.array([row['embedding'] for row in rows])
        
        # 训练K-Means
        self.kmeans_model = KMeans(n_clusters=self.num_clusters, random_state=42)
        self.kmeans_model.fit(embeddings)
        self.cluster_centers = self.kmeans_model.cluster_centers_
        
        logger.info(f"Query clusters initialized with {len(embeddings)} samples")
    
    
    def get_query_cluster(self, query_vec: np.ndarray) -> str:
        """
        将查询向量映射到查询簇
        
        Args:
            query_vec: 查询向量(1536维)
        
        Returns:
            查询簇ID, 格式: "query_cluster_0" ~ "query_cluster_49"
        """
        if self.kmeans_model is None:
            raise RuntimeError("Query clusters not initialized. Call initialize_query_clusters() first.")
        
        cluster_id = self.kmeans_model.predict([query_vec])[0]
        return f"query_cluster_{cluster_id}"
    
    
    async def get_paragraph_q_value(
        self, 
        paragraph_id: str, 
        query_cluster: str
    ) -> Tuple[float, int]:
        """
        获取段落在特定查询簇下的Q值和访问次数
        
        Args:
            paragraph_id: 段落ID
            query_cluster: 查询簇ID
        
        Returns:
            (Q值, 访问次数)
        """
        async with self.db_pool.acquire() as conn:
            query = """
                SELECT meta 
                FROM paragraphs 
                WHERE id = $1
            """
            row = await conn.fetchrow(query, paragraph_id)
        
        if not row or not row['meta']:
            return 0.5, 0  # 默认Q值0.5,未访问
        
        meta = row['meta']
        q_values = meta.get('q_values', {})
        visit_count = meta.get('visit_count', {})
        
        q_value = q_values.get(query_cluster, 0.5)
        visits = visit_count.get(query_cluster, 0)
        
        return q_value, visits
    
    
    async def calculate_ucb_score(
        self,
        paragraph_id: str,
        query_cluster: str,
        total_visits_all_paragraphs: int
    ) -> float:
        """
        计算UCB (Upper Confidence Bound) 分数
        公式: UCB = Q + c × sqrt(ln(N) / n)
        
        Args:
            paragraph_id: 段落ID
            query_cluster: 查询簇ID
            total_visits_all_paragraphs: 所有段落的总访问次数
        
        Returns:
            UCB分数
        """
        q_value, visit_count = await self.get_paragraph_q_value(paragraph_id, query_cluster)
        
        if visit_count == 0:
            # 未访问段落给予极高UCB,鼓励探索
            return float('inf')
        
        # UCB公式
        exploration_bonus = self.ucb_constant * math.sqrt(
            math.log(total_visits_all_paragraphs + 1) / visit_count
        )
        
        ucb_score = q_value + exploration_bonus
        return ucb_score
    
    
    async def select_paragraphs_with_rl(
        self,
        candidate_paragraphs: List[Dict[str, Any]],
        query_vec: np.ndarray,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        使用强化学习策略选择段落
        结合Q值和UCB探索奖励,选择最优段落
        
        Args:
            candidate_paragraphs: 候选段落列表(已通过向量检索筛选)
            query_vec: 查询向量
            top_k: 选择数量
        
        Returns:
            优化后的段落列表
        """
        if not candidate_paragraphs:
            return []
        
        # 获取查询簇
        query_cluster = self.get_query_cluster(query_vec)
        
        # 计算总访问次数(用于UCB)
        total_visits = 0
        for para in candidate_paragraphs:
            _, visits = await self.get_paragraph_q_value(para['id'], query_cluster)
            total_visits += visits
        
        # Epsilon-greedy策略
        if np.random.random() < self.epsilon:
            # 探索:随机选择
            np.random.shuffle(candidate_paragraphs)
            selected = candidate_paragraphs[:top_k]
            logger.debug(f"RL: Exploration mode (random selection)")
        else:
            # 利用:基于UCB选择
            paragraph_scores = []
            for para in candidate_paragraphs:
                ucb_score = await self.calculate_ucb_score(
                    para['id'], 
                    query_cluster, 
                    total_visits
                )
                paragraph_scores.append({
                    'paragraph': para,
                    'ucb_score': ucb_score,
                    'q_value': await self.get_paragraph_q_value(para['id'], query_cluster)
                })
            
            # 按UCB分数排序
            paragraph_scores.sort(key=lambda x: x['ucb_score'], reverse=True)
            selected = [item['paragraph'] for item in paragraph_scores[:top_k]]
            
            logger.debug(f"RL: Exploitation mode (UCB selection)")
            logger.debug(f"Top UCB scores: {[round(item['ucb_score'], 3) for item in paragraph_scores[:top_k]]}")
        
        # 添加RL元信息
        for para in selected:
            q_value, visits = await self.get_paragraph_q_value(para['id'], query_cluster)
            para['rl_info'] = {
                'query_cluster': query_cluster,
                'q_value': q_value,
                'visit_count': visits
            }
        
        return selected
    
    
    async def update_q_values(
        self,
        paragraph_ids: List[str],
        query_vec: np.ndarray,
        reward: float
    ):
        """
        更新段落的Q值
        Q-Learning更新公式: Q_new = Q_old + α × (reward - Q_old)
        
        Args:
            paragraph_ids: 段落ID列表
            query_vec: 查询向量
            reward: 奖励值(0-1之间)
        """
        query_cluster = self.get_query_cluster(query_vec)
        
        async with self.db_pool.acquire() as conn:
            for pid in paragraph_ids:
                # 获取当前Q值和访问次数
                q_old, visit_count = await self.get_paragraph_q_value(pid, query_cluster)
                
                # Q-Learning更新
                q_new = q_old + self.alpha * (reward - q_old)
                q_new = max(0.0, min(1.0, q_new))  # 限制在[0, 1]
                
                # 更新meta字段
                update_query = """
                    UPDATE paragraphs
                    SET meta = jsonb_set(
                        jsonb_set(
                            COALESCE(meta, '{}'::jsonb),
                            ARRAY['q_values', $2],
                            to_jsonb($3::float)
                        ),
                        ARRAY['visit_count', $2],
                        to_jsonb($4::int)
                    ),
                    updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """
                await conn.execute(
                    update_query,
                    pid,
                    query_cluster,
                    q_new,
                    visit_count + 1
                )
                
                logger.debug(f"Updated Q-value: {pid} | {query_cluster} | {q_old:.3f} → {q_new:.3f}")
        
        logger.info(f"Q-values updated for {len(paragraph_ids)} paragraphs (reward={reward:.3f})")
    
    
    async def calculate_reward(
        self,
        spliced_content: str,
        contexts: List[str],
        llm_score: Optional[float] = None,
        user_feedback: Optional[str] = None
    ) -> float:
        """
        计算综合奖励
        reward = 0.7 × LLM_score + 0.3 × user_feedback_score
        
        Args:
            spliced_content: 拼接内容
            contexts: 上下文段落列表
            llm_score: LLM评分(0-1),若为None则不使用
            user_feedback: 用户反馈("thumbs_up"/"thumbs_down"/None)
        
        Returns:
            综合奖励(0-1之间)
        """
        reward = 0.0
        
        # LLM评分部分(权重0.7)
        if llm_score is not None:
            reward += 0.7 * llm_score
        else:
            # 默认中等分数
            reward += 0.7 * 0.5
        
        # 用户反馈部分(权重0.3)
        if user_feedback == "thumbs_up":
            reward += 0.3 * 1.0
        elif user_feedback == "thumbs_down":
            reward += 0.3 * 0.0
        else:
            # 无反馈,默认中等
            reward += 0.3 * 0.5
        
        return min(1.0, max(0.0, reward))
    
    
    async def should_store_generated_content(
        self,
        reward: float,
        spliced_content: str
    ) -> Tuple[bool, str]:
        """
        判断是否应将生成内容入库
        
        Args:
            reward: 奖励分数
            spliced_content: 生成内容
        
        Returns:
            (是否入库, 质量标签)
        """
        # 质量检查
        if reward >= self.high_quality_threshold:
            quality_tag = "high"
            should_store = True
        elif reward >= self.medium_quality_threshold:
            quality_tag = "medium"
            should_store = False  # 中等质量暂不入库
        else:
            quality_tag = "low"
            should_store = False
        
        # 去重检查(简化:检查长度,实际应检查语义相似度)
        if should_store and len(spliced_content) < 50:
            should_store = False
            logger.debug("Content too short, skip storing")
        
        return should_store, quality_tag
    
    
    async def store_generated_paragraph(
        self,
        content: str,
        embedding: np.ndarray,
        source_paragraph_ids: List[str],
        query_vec: np.ndarray,
        reward: float,
        book_id: str
    ) -> Optional[str]:
        """
        将生成内容作为新段落入库
        继承源段落的Q值,加速冷启动
        
        Args:
            content: 生成内容
            embedding: 内容向量
            source_paragraph_ids: 源段落ID列表
            query_vec: 查询向量
            reward: 奖励分数
            book_id: 书籍ID
        
        Returns:
            新段落ID,若入库失败则返回None
        """
        # 判断是否应入库
        should_store, quality_tag = await self.should_store_generated_content(reward, content)
        
        if not should_store:
            logger.debug(f"Skip storing: quality={quality_tag}, reward={reward:.3f}")
            return None
        
        # 计算源段落的平均Q值(继承机制)
        query_cluster = self.get_query_cluster(query_vec)
        avg_q_value = 0.0
        for pid in source_paragraph_ids:
            q_value, _ = await self.get_paragraph_q_value(pid, query_cluster)
            avg_q_value += q_value
        avg_q_value /= len(source_paragraph_ids) if source_paragraph_ids else 1.0
        
        # 构造meta字段
        meta = {
            "is_generated": True,
            "generation_source": source_paragraph_ids,
            "generation_time": datetime.utcnow().isoformat(),
            "quality": quality_tag,
            "generation_reward": reward,
            "q_values": {query_cluster: avg_q_value},
            "visit_count": {query_cluster: 0},
            "avg_reward": reward,
            "total_visits": 0
        }
        
        # 插入数据库
        async with self.db_pool.acquire() as conn:
            query = """
                INSERT INTO paragraphs (
                    book_id, content, embedding, enhanced_embedding,
                    meta, sequence_weight, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                RETURNING id
            """
            row = await conn.fetchrow(
                query,
                book_id,
                content,
                embedding.tolist(),
                embedding.tolist(),  # 初始增强向量=原始向量
                json.dumps(meta),
                1.0  # 初始权重1.0
            )
            new_paragraph_id = row['id']
        
        logger.info(f"Stored generated paragraph: {new_paragraph_id} | quality={quality_tag} | reward={reward:.3f}")
        
        return new_paragraph_id
    
    
    async def async_evaluate_and_optimize(
        self,
        spliced_content: str,
        paragraphs: List[Dict[str, Any]],
        query_vec: np.ndarray,
        query_text: str,
        llm_score: Optional[float] = None,
        user_feedback: Optional[str] = None,
        store_generated: bool = False,
        book_id: Optional[str] = None
    ):
        """
        异步评估与优化(后台任务,不阻塞用户响应)
        
        流程:
        1. 计算综合奖励
        2. 更新Q值
        3. (可选)将高质量内容入库
        
        Args:
            spliced_content: 拼接内容
            paragraphs: 使用的段落列表
            query_vec: 查询向量
            query_text: 查询文本
            llm_score: LLM评分(可选)
            user_feedback: 用户反馈(可选)
            store_generated: 是否入库
            book_id: 书籍ID(入库时必需)
        """
        try:
            # 1. 计算奖励
            contexts = [p['content'] for p in paragraphs]
            reward = await self.calculate_reward(
                spliced_content, 
                contexts, 
                llm_score, 
                user_feedback
            )
            
            # 2. 更新Q值
            paragraph_ids = [p['id'] for p in paragraphs]
            await self.update_q_values(paragraph_ids, query_vec, reward)
            
            # 3. 高质量内容入库
            if store_generated and book_id:
                # 生成embedding(简化:使用查询向量作为近似)
                # 实际应调用OpenAI API生成真实embedding
                embedding = query_vec
                
                new_pid = await self.store_generated_paragraph(
                    content=spliced_content,
                    embedding=embedding,
                    source_paragraph_ids=paragraph_ids,
                    query_vec=query_vec,
                    reward=reward,
                    book_id=book_id
                )
                
                if new_pid:
                    logger.info(f"Generated content stored: {new_pid}")
            
            logger.info(f"RL optimization completed: query='{query_text[:50]}...' | reward={reward:.3f}")
        
        except Exception as e:
            logger.error(f"RL optimization failed: {e}", exc_info=True)
            # 静默失败,不影响用户体验


# 全局实例(懒加载)
_rl_optimizer_instance: Optional[ReinforcementLearningOptimizer] = None


async def get_rl_optimizer(db_pool) -> ReinforcementLearningOptimizer:
    """
    获取全局RL优化器实例(单例模式)
    
    Args:
        db_pool: 数据库连接池
    
    Returns:
        ReinforcementLearningOptimizer实例
    """
    global _rl_optimizer_instance
    
    if _rl_optimizer_instance is None:
        _rl_optimizer_instance = ReinforcementLearningOptimizer(db_pool)
        # 初始化查询聚类(异步)
        await _rl_optimizer_instance.initialize_query_clusters()
    
    return _rl_optimizer_instance
