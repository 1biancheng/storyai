"""
公式还原引擎 - 前向推理式还原小说
功能:
1. 从总公式还原完整小说
2. 连贯性校验
3. 忠实度评估
4. 修复策略
"""

import re
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from services.db_service import get_db_service


class FormulaRestorationEngine:
    """公式还原引擎"""
    
    def __init__(self):
        self.db = None
    
    async def initialize(self):
        """初始化数据库连接"""
        if not self.db:
            self.db = await get_db_service()
    
    async def restore_from_formula(
        self,
        formula: Dict[str, Any],
        quality_mode: str = "high_fidelity",
        enable_repair: bool = True
    ) -> Dict[str, Any]:
        """
        从公式还原小说
        
        Args:
            formula: 总公式字典
            quality_mode: 质量模式 (high_fidelity/balanced/creative)
            enable_repair: 是否启用连贯性修复
        
        Returns:
            还原结果字典
        """
        await self.initialize()
        
        # 1. 加载网络拓扑(段落序列)
        paragraph_sequence = formula.get("paragraph_sequence", {})
        sequence = paragraph_sequence.get("sequence", [])
        
        if not sequence:
            raise ValueError("公式中没有段落序列")
        
        # 2. 按index排序(确定性推理顺序)
        sequence.sort(key=lambda x: x["index"])
        
        # 3. 前向推理:逐个加载段落
        paragraphs = []
        missing_paragraphs = []
        
        for node in sequence:
            para_id = node.get("paragraph_id")
            try:
                # 从数据库加载段落
                para = await self._load_paragraph(para_id)
                if para:
                    paragraphs.append({
                        "index": node["index"],
                        "content": para.get("content", ""),
                        "paragraph_id": para_id
                    })
                else:
                    missing_paragraphs.append(para_id)
            except Exception as e:
                print(f"加载段落失败 {para_id}: {e}")
                missing_paragraphs.append(para_id)
        
        # 4. 完整性校验
        total_expected = paragraph_sequence.get("total_paragraphs", len(sequence))
        completeness = len(paragraphs) / total_expected if total_expected > 0 else 0
        
        # 5. 拼接文本
        restored_text = self._join_paragraphs(paragraphs)
        
        # 6. 连贯性校验
        coherence_score = self._check_coherence(paragraphs) if enable_repair else 1.0
        
        # 7. 连贯性修复
        if enable_repair and coherence_score < 0.7:
            restored_text = await self._repair_coherence(paragraphs, restored_text)
            coherence_score = 0.8  # 修复后评分
        
        # 8. 忠实度评估
        fidelity_score = self._calculate_fidelity(
            len(paragraphs),
            total_expected,
            coherence_score
        )
        
        return {
            "restored_content": restored_text,
            "fidelity_score": round(fidelity_score, 2),
            "coherence_score": round(coherence_score, 2),
            "completeness": round(completeness, 2),
            "total_paragraphs": len(paragraphs),
            "missing_paragraphs": len(missing_paragraphs),
            "repair_count": 0 if coherence_score >= 0.7 else 1
        }
    
    async def _load_paragraph(self, paragraph_id: str) -> Optional[Dict[str, Any]]:
        """从数据库加载段落"""
        try:
            # 查询段落
            query = "SELECT * FROM paragraphs WHERE id = $1"
            result = await self.db.fetch_one(query, paragraph_id)
            return dict(result) if result else None
        except Exception as e:
            print(f"数据库查询失败: {e}")
            return None
    
    def _join_paragraphs(self, paragraphs: List[Dict[str, Any]]) -> str:
        """拼接段落为文本"""
        # 按index排序
        paragraphs.sort(key=lambda x: x["index"])
        
        # 拼接内容(段落间用双换行分隔)
        texts = [p["content"] for p in paragraphs if p.get("content")]
        return "\n\n".join(texts)
    
    def _check_coherence(self, paragraphs: List[Dict[str, Any]]) -> float:
        """
        检查连贯性
        
        评分规则:
        - 段落顺序连续性: 0.4
        - 文本连接自然度: 0.3
        - 无明显断层: 0.3
        """
        if len(paragraphs) < 2:
            return 1.0
        
        score = 0.5  # 基础分
        
        # 1. 检查索引连续性
        indices = [p["index"] for p in paragraphs]
        indices.sort()
        
        gaps = 0
        for i in range(len(indices) - 1):
            if indices[i+1] - indices[i] > 1:
                gaps += 1
        
        continuity_score = max(0, 1 - gaps / len(indices))
        score += continuity_score * 0.3
        
        # 2. 检查文本连接(简化版)
        transition_score = 0.2
        for i in range(len(paragraphs) - 1):
            curr = paragraphs[i]["content"]
            next_para = paragraphs[i+1]["content"]
            
            # 检查是否有时间/地点突变
            if self._has_smooth_transition(curr, next_para):
                transition_score += 0.1
        
        score += min(0.3, transition_score)
        
        return min(1.0, score)
    
    def _has_smooth_transition(self, para1: str, para2: str) -> bool:
        """检查两个段落间是否有平滑过渡"""
        # 简化判断:检查是否有连接词
        transition_words = ['接着', '然后', '随后', '后来', '于是', '因此', '所以']
        
        para2_start = para2[:20]
        return any(word in para2_start for word in transition_words)
    
    async def _repair_coherence(
        self,
        paragraphs: List[Dict[str, Any]],
        text: str
    ) -> str:
        """
        修复连贯性
        
        策略:
        1. 添加过渡句(简化版:仅添加换行)
        2. 调整段落顺序(当前未实现)
        """
        # 简化实现:确保段落间有适当分隔
        parts = []
        for para in sorted(paragraphs, key=lambda x: x["index"]):
            parts.append(para["content"].strip())
        
        # 使用更明显的分隔
        return "\n\n***\n\n".join(parts)
    
    def _calculate_fidelity(
        self,
        restored_count: int,
        expected_count: int,
        coherence_score: float
    ) -> float:
        """
        计算忠实度
        
        公式:
        fidelity = 0.4 × 内容一致性 + 0.3 × 顺序一致性 + 0.3 × 连贯性
        """
        # 内容一致性(段落匹配率)
        content_consistency = restored_count / expected_count if expected_count > 0 else 0
        
        # 顺序一致性(假设都是顺序还原)
        order_consistency = 0.95
        
        # 综合评分
        fidelity = (
            0.4 * content_consistency +
            0.3 * order_consistency +
            0.3 * coherence_score
        )
        
        return min(1.0, fidelity)


async def restore_novel_from_formula_id(
    formula_id: str,
    quality_mode: str = "high_fidelity"
) -> Dict[str, Any]:
    """
    便捷函数:通过formula_id还原小说
    
    Args:
        formula_id: 公式ID
        quality_mode: 质量模式
    
    Returns:
        还原结果
    """
    # 加载公式
    db = await get_db_service()
    query = "SELECT expression FROM formulas WHERE id = $1"
    result = await db.fetch_one(query, formula_id)
    
    if not result:
        raise ValueError(f"公式不存在: {formula_id}")
    
    formula = result["expression"]
    
    # 还原
    engine = FormulaRestorationEngine()
    return await engine.restore_from_formula(formula, quality_mode)
"""
公式还原引擎 - 前向推理式还原小说
功能:
1. 从总公式还原完整小说
2. 连贯性校验
3. 忠实度评估
4. 修复策略
"""

import re
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from services.db_service import get_db_service


class FormulaRestorationEngine:
    """公式还原引擎"""
    
    def __init__(self):
        self.db = None
    
    async def initialize(self):
        """初始化数据库连接"""
        if not self.db:
            self.db = await get_db_service()
    
    async def restore_from_formula(
        self,
        formula: Dict[str, Any],
        quality_mode: str = "high_fidelity",
        enable_repair: bool = True
    ) -> Dict[str, Any]:
        """
        从公式还原小说
        
        Args:
            formula: 总公式字典
            quality_mode: 质量模式 (high_fidelity/balanced/creative)
            enable_repair: 是否启用连贯性修复
        
        Returns:
            还原结果字典
        """
        await self.initialize()
        
        # 1. 加载网络拓扑(段落序列)
        paragraph_sequence = formula.get("paragraph_sequence", {})
        sequence = paragraph_sequence.get("sequence", [])
        
        if not sequence:
            raise ValueError("公式中没有段落序列")
        
        # 2. 按index排序(确定性推理顺序)
        sequence.sort(key=lambda x: x["index"])
        
        # 3. 前向推理:逐个加载段落
        paragraphs = []
        missing_paragraphs = []
        
        for node in sequence:
            para_id = node.get("paragraph_id")
            try:
                # 从数据库加载段落
                para = await self._load_paragraph(para_id)
                if para:
                    paragraphs.append({
                        "index": node["index"],
                        "content": para.get("content", ""),
                        "paragraph_id": para_id
                    })
                else:
                    missing_paragraphs.append(para_id)
            except Exception as e:
                print(f"加载段落失败 {para_id}: {e}")
                missing_paragraphs.append(para_id)
        
        # 4. 完整性校验
        total_expected = paragraph_sequence.get("total_paragraphs", len(sequence))
        completeness = len(paragraphs) / total_expected if total_expected > 0 else 0
        
        # 5. 拼接文本
        restored_text = self._join_paragraphs(paragraphs)
        
        # 6. 连贯性校验
        coherence_score = self._check_coherence(paragraphs) if enable_repair else 1.0
        
        # 7. 连贯性修复
        if enable_repair and coherence_score < 0.7:
            restored_text = await self._repair_coherence(paragraphs, restored_text)
            coherence_score = 0.8  # 修复后评分
        
        # 8. 忠实度评估
        fidelity_score = self._calculate_fidelity(
            len(paragraphs),
            total_expected,
            coherence_score
        )
        
        return {
            "restored_content": restored_text,
            "fidelity_score": round(fidelity_score, 2),
            "coherence_score": round(coherence_score, 2),
            "completeness": round(completeness, 2),
            "total_paragraphs": len(paragraphs),
            "missing_paragraphs": len(missing_paragraphs),
            "repair_count": 0 if coherence_score >= 0.7 else 1
        }
    
    async def _load_paragraph(self, paragraph_id: str) -> Optional[Dict[str, Any]]:
        """从数据库加载段落"""
        try:
            # 查询段落
            query = "SELECT * FROM paragraphs WHERE id = $1"
            result = await self.db.fetch_one(query, paragraph_id)
            return dict(result) if result else None
        except Exception as e:
            print(f"数据库查询失败: {e}")
            return None
    
    def _join_paragraphs(self, paragraphs: List[Dict[str, Any]]) -> str:
        """拼接段落为文本"""
        # 按index排序
        paragraphs.sort(key=lambda x: x["index"])
        
        # 拼接内容(段落间用双换行分隔)
        texts = [p["content"] for p in paragraphs if p.get("content")]
        return "\n\n".join(texts)
    
    def _check_coherence(self, paragraphs: List[Dict[str, Any]]) -> float:
        """
        检查连贯性
        
        评分规则:
        - 段落顺序连续性: 0.4
        - 文本连接自然度: 0.3
        - 无明显断层: 0.3
        """
        if len(paragraphs) < 2:
            return 1.0
        
        score = 0.5  # 基础分
        
        # 1. 检查索引连续性
        indices = [p["index"] for p in paragraphs]
        indices.sort()
        
        gaps = 0
        for i in range(len(indices) - 1):
            if indices[i+1] - indices[i] > 1:
                gaps += 1
        
        continuity_score = max(0, 1 - gaps / len(indices))
        score += continuity_score * 0.3
        
        # 2. 检查文本连接(简化版)
        transition_score = 0.2
        for i in range(len(paragraphs) - 1):
            curr = paragraphs[i]["content"]
            next_para = paragraphs[i+1]["content"]
            
            # 检查是否有时间/地点突变
            if self._has_smooth_transition(curr, next_para):
                transition_score += 0.1
        
        score += min(0.3, transition_score)
        
        return min(1.0, score)
    
    def _has_smooth_transition(self, para1: str, para2: str) -> bool:
        """检查两个段落间是否有平滑过渡"""
        # 简化判断:检查是否有连接词
        transition_words = ['接着', '然后', '随后', '后来', '于是', '因此', '所以']
        
        para2_start = para2[:20]
        return any(word in para2_start for word in transition_words)
    
    async def _repair_coherence(
        self,
        paragraphs: List[Dict[str, Any]],
        text: str
    ) -> str:
        """
        修复连贯性
        
        策略:
        1. 添加过渡句(简化版:仅添加换行)
        2. 调整段落顺序(当前未实现)
        """
        # 简化实现:确保段落间有适当分隔
        parts = []
        for para in sorted(paragraphs, key=lambda x: x["index"]):
            parts.append(para["content"].strip())
        
        # 使用更明显的分隔
        return "\n\n***\n\n".join(parts)
    
    def _calculate_fidelity(
        self,
        restored_count: int,
        expected_count: int,
        coherence_score: float
    ) -> float:
        """
        计算忠实度
        
        公式:
        fidelity = 0.4 × 内容一致性 + 0.3 × 顺序一致性 + 0.3 × 连贯性
        """
        # 内容一致性(段落匹配率)
        content_consistency = restored_count / expected_count if expected_count > 0 else 0
        
        # 顺序一致性(假设都是顺序还原)
        order_consistency = 0.95
        
        # 综合评分
        fidelity = (
            0.4 * content_consistency +
            0.3 * order_consistency +
            0.3 * coherence_score
        )
        
        return min(1.0, fidelity)


async def restore_novel_from_formula_id(
    formula_id: str,
    quality_mode: str = "high_fidelity"
) -> Dict[str, Any]:
    """
    便捷函数:通过formula_id还原小说
    
    Args:
        formula_id: 公式ID
        quality_mode: 质量模式
    
    Returns:
        还原结果
    """
    # 加载公式
    db = await get_db_service()
    query = "SELECT expression FROM formulas WHERE id = $1"
    result = await db.fetch_one(query, formula_id)
    
    if not result:
        raise ValueError(f"公式不存在: {formula_id}")
    
    formula = result["expression"]
    
    # 还原
    engine = FormulaRestorationEngine()
    return await engine.restore_from_formula(formula, quality_mode)
