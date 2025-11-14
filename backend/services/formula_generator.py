"""
公式生成器 - 从段落序列提取多维度公式
功能:
1. 总公式(BookFormula)生成
2. 剧情公式提取
3. 描写公式提取
4. 情绪曲线提取
5. 词汇公式提取
"""

import json
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np


class FormulaGenerator:
    """公式生成器主类"""
    
    def __init__(self):
        self.formula_version = "v2.0"
    
    def generate_master_formula(
        self,
        paragraphs: List[Dict[str, Any]],
        book_id: str,
        book_title: str = "未命名"
    ) -> Dict[str, Any]:
        """
        生成总公式(BookFormula)
        
        Args:
            paragraphs: 增强后的段落列表
            book_id: 书籍ID
            book_title: 书籍标题
        
        Returns:
            总公式字典
        """
        # 生成公式ID
        formula_id = f"formula_{book_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 提取各子公式
        paragraph_sequence = self._extract_paragraph_sequence(paragraphs, book_id)
        plot_formula = self._extract_plot_formula(paragraphs)
        description_formula = self._extract_description_formula(paragraphs)
        emotion_formula = self._extract_emotion_formula(paragraphs)
        vocabulary_formula = self._extract_vocabulary_formula(paragraphs)
        neural_parameters = self._extract_neural_parameters(paragraphs)
        
        # 构建总公式
        master_formula = {
            "formula_id": formula_id,
            "book_id": book_id,
            "book_title": book_title,
            "formula_type": "master_formula",
            "created_at": datetime.now().isoformat(),
            
            # 核心子公式
            "paragraph_sequence": paragraph_sequence,
            "plot_formula": plot_formula,
            "description_formula": description_formula,
            "emotion_formula": emotion_formula,
            "vocabulary_formula": vocabulary_formula,
            "neural_parameters": neural_parameters,
            
            # 元信息
            "metadata": {
                "genre": "未分类",
                "total_paragraphs": len(paragraphs),
                "word_count": sum(len(p.get("content", "")) for p in paragraphs),
                "extraction_timestamp": datetime.now().isoformat(),
                "extractor_version": self.formula_version
            }
        }
        
        return master_formula
    
    def _extract_paragraph_sequence(
        self,
        paragraphs: List[Dict[str, Any]],
        book_id: str
    ) -> Dict[str, Any]:
        """提取段落序列公式"""
        sequence = []
        
        for idx, para in enumerate(paragraphs):
            sequence.append({
                "index": idx,
                "paragraph_id": para.get("id", f"para_{book_id}_{idx}"),
                "chapter_index": para.get("chapter_index", 0),
                "weight": para.get("sequence_weight", 1.0),
                "bias": para.get("paragraph_bias", [0.0] * 1536)[:10],  # 仅存储前10维作为指纹
                "global_position": para.get("global_position", idx / len(paragraphs))
            })
        
        # 生成序列指纹(用于快速校验)
        sequence_str = json.dumps([s["index"] for s in sequence])
        fingerprint = hashlib.sha256(sequence_str.encode()).hexdigest()
        
        return {
            "total_paragraphs": len(paragraphs),
            "sequence": sequence,
            "sequence_fingerprint": fingerprint
        }
    
    def _extract_plot_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取剧情公式"""
        total = len(paragraphs)
        
        # 简单的三幕结构识别
        acts = [
            {
                "act_name": "起",
                "paragraph_range": [0, int(total * 0.25)],
                "plot_points": ["opening", "inciting_incident"],
                "emotional_arc": "rising"
            },
            {
                "act_name": "承",
                "paragraph_range": [int(total * 0.25), int(total * 0.75)],
                "plot_points": ["rising_action", "midpoint", "complications"],
                "emotional_arc": "fluctuating"
            },
            {
                "act_name": "转",
                "paragraph_range": [int(total * 0.75), int(total * 0.9)],
                "plot_points": ["climax", "falling_action"],
                "emotional_arc": "peak"
            },
            {
                "act_name": "合",
                "paragraph_range": [int(total * 0.9), total],
                "plot_points": ["resolution", "ending"],
                "emotional_arc": "declining"
            }
        ]
        
        # 提取节奏曲线(采样10个点)
        pacing_curve = []
        sample_points = 10
        for i in range(sample_points):
            pos = int(i * total / sample_points)
            if pos < len(paragraphs):
                # 使用权重作为节奏强度的近似
                weight = paragraphs[pos].get("sequence_weight", 1.0)
                pacing_curve.append(float(weight))
        
        return {
            "narrative_structure": "three_act_structure",
            "acts": acts,
            "conflict_pattern": "unknown",
            "pacing_curve": pacing_curve
        }
    
    def _extract_description_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取描写公式"""
        total = len(paragraphs)
        
        # 统计各类描写比例(简化版)
        action_count = 0
        dialogue_count = 0
        description_count = 0
        
        for para in paragraphs:
            content = para.get("content", "")
            # 简单判断
            if '"' in content or '"' in content:
                dialogue_count += 1
            elif any(word in content for word in ['看', '走', '跑', '拿', '打']):
                action_count += 1
            else:
                description_count += 1
        
        # 归一化比例
        action_ratio = action_count / total if total > 0 else 0
        dialogue_ratio = dialogue_count / total if total > 0 else 0
        env_ratio = description_count / total if total > 0 else 0
        
        # 风格模式
        avg_length = sum(len(p.get("content", "")) for p in paragraphs) / total if total > 0 else 0
        
        return {
            "action_description_ratio": round(action_ratio, 2),
            "dialogue_ratio": round(dialogue_ratio, 2),
            "environment_ratio": round(env_ratio, 2),
            "psychological_ratio": round(max(0, 1 - action_ratio - dialogue_ratio - env_ratio), 2),
            "style_patterns": {
                "sentence_length_avg": round(avg_length, 1),
                "clause_complexity": 0.5,
                "metaphor_density": 0.1,
                "rhetoric_devices": []
            }
        }
    
    def _extract_emotion_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取情绪曲线公式"""
        total = len(paragraphs)
        
        # 采样10个情绪点
        emotion_sequence = []
        sample_points = 10
        
        for i in range(sample_points):
            pos = int(i * total / sample_points)
            if pos < len(paragraphs):
                para = paragraphs[pos]
                meta = para.get("meta", {})
                
                # 获取情感强度
                intensity = meta.get("emotion_intensity", 0.5)
                
                # 简单判断情感类型
                emotion_type = "neutral"
                if intensity > 0.6:
                    emotion_type = "positive"
                elif intensity < 0.4:
                    emotion_type = "negative"
                
                emotion_sequence.append({
                    "position": round(i / sample_points, 2),
                    "emotion": emotion_type,
                    "intensity": round(float(intensity), 2)
                })
        
        return {
            "curve_type": "波动型",
            "emotion_sequence": emotion_sequence,
            "dominant_emotions": ["neutral"],
            "emotion_transitions": []
        }
    
    def _extract_vocabulary_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取词汇成语公式"""
        # 收集所有关键词和成语
        all_keywords = []
        all_idioms = []
        
        for para in paragraphs:
            keywords = para.get("keywords", [])
            idioms = para.get("idioms", [])
            all_keywords.extend(keywords)
            all_idioms.extend(idioms)
        
        # 统计频率
        keyword_freq = {}
        for kw in all_keywords:
            keyword_freq[kw] = keyword_freq.get(kw, 0) + 1
        
        idiom_freq = {}
        idiom_positions = {}
        for idx, para in enumerate(paragraphs):
            for idiom in para.get("idioms", []):
                idiom_freq[idiom] = idiom_freq.get(idiom, 0) + 1
                if idiom not in idiom_positions:
                    idiom_positions[idiom] = []
                idiom_positions[idiom].append(idx / len(paragraphs))
        
        # 按频率排序,取前20
        top_keywords = sorted(keyword_freq.items(), key=lambda x: -x[1])[:20]
        
        # 构建成语列表
        idioms_list = []
        for idiom, freq in sorted(idiom_freq.items(), key=lambda x: -x[1])[:20]:
            idioms_list.append({
                "text": idiom,
                "frequency": freq,
                "positions": [round(p, 2) for p in idiom_positions[idiom][:5]]
            })
        
        # 词汇丰富度(去重后的关键词数量)
        unique_keywords = len(set(all_keywords))
        vocabulary_richness = min(1.0, unique_keywords / (len(paragraphs) * 2))
        
        return {
            "keywords": {
                "高频词": [kw for kw, _ in top_keywords[:10]]
            },
            "idioms": idioms_list,
            "vocabulary_richness": round(vocabulary_richness, 2),
            "unique_words_count": unique_keywords
        }
    
    def _extract_neural_parameters(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取神经网络参数"""
        weights = [p.get("sequence_weight", 1.0) for p in paragraphs]
        
        # 计算统计量
        weight_mean = np.mean(weights) if weights else 1.0
        weight_std = np.std(weights) if weights else 0.0
        
        return {
            "global_weight_vector": [round(w, 2) for w in weights[:100]],  # 仅保存前100个
            "normalization_params": {
                "mean": round(float(weight_mean), 3),
                "std": round(float(weight_std), 3)
            },
            "parameter_count": len(paragraphs) * (1 + 1536)  # weight + bias
        }


def generate_sub_formula(
    master_formula: Dict[str, Any],
    formula_type: str
) -> Dict[str, Any]:
    """
    从总公式提取子公式
    
    Args:
        master_formula: 总公式
        formula_type: 子公式类型 (plot_formula, description_formula, etc.)
    
    Returns:
        子公式字典
    """
    if formula_type not in master_formula:
        raise ValueError(f"Unknown formula type: {formula_type}")
    
    return {
        "formula_id": f"{master_formula['formula_id']}_{formula_type}",
        "book_id": master_formula["book_id"],
        "formula_type": formula_type,
        "parent_formula_id": master_formula["formula_id"],
        "expression": master_formula[formula_type],
        "created_at": datetime.now().isoformat(),
        "validation_status": "valid"
    }
"""
公式生成器 - 从段落序列提取多维度公式
功能:
1. 总公式(BookFormula)生成
2. 剧情公式提取
3. 描写公式提取
4. 情绪曲线提取
5. 词汇公式提取
"""

import json
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np


class FormulaGenerator:
    """公式生成器主类"""
    
    def __init__(self):
        self.formula_version = "v2.0"
    
    def generate_master_formula(
        self,
        paragraphs: List[Dict[str, Any]],
        book_id: str,
        book_title: str = "未命名"
    ) -> Dict[str, Any]:
        """
        生成总公式(BookFormula)
        
        Args:
            paragraphs: 增强后的段落列表
            book_id: 书籍ID
            book_title: 书籍标题
        
        Returns:
            总公式字典
        """
        # 生成公式ID
        formula_id = f"formula_{book_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 提取各子公式
        paragraph_sequence = self._extract_paragraph_sequence(paragraphs, book_id)
        plot_formula = self._extract_plot_formula(paragraphs)
        description_formula = self._extract_description_formula(paragraphs)
        emotion_formula = self._extract_emotion_formula(paragraphs)
        vocabulary_formula = self._extract_vocabulary_formula(paragraphs)
        neural_parameters = self._extract_neural_parameters(paragraphs)
        
        # 构建总公式
        master_formula = {
            "formula_id": formula_id,
            "book_id": book_id,
            "book_title": book_title,
            "formula_type": "master_formula",
            "created_at": datetime.now().isoformat(),
            
            # 核心子公式
            "paragraph_sequence": paragraph_sequence,
            "plot_formula": plot_formula,
            "description_formula": description_formula,
            "emotion_formula": emotion_formula,
            "vocabulary_formula": vocabulary_formula,
            "neural_parameters": neural_parameters,
            
            # 元信息
            "metadata": {
                "genre": "未分类",
                "total_paragraphs": len(paragraphs),
                "word_count": sum(len(p.get("content", "")) for p in paragraphs),
                "extraction_timestamp": datetime.now().isoformat(),
                "extractor_version": self.formula_version
            }
        }
        
        return master_formula
    
    def _extract_paragraph_sequence(
        self,
        paragraphs: List[Dict[str, Any]],
        book_id: str
    ) -> Dict[str, Any]:
        """提取段落序列公式"""
        sequence = []
        
        for idx, para in enumerate(paragraphs):
            sequence.append({
                "index": idx,
                "paragraph_id": para.get("id", f"para_{book_id}_{idx}"),
                "chapter_index": para.get("chapter_index", 0),
                "weight": para.get("sequence_weight", 1.0),
                "bias": para.get("paragraph_bias", [0.0] * 1536)[:10],  # 仅存储前10维作为指纹
                "global_position": para.get("global_position", idx / len(paragraphs))
            })
        
        # 生成序列指纹(用于快速校验)
        sequence_str = json.dumps([s["index"] for s in sequence])
        fingerprint = hashlib.sha256(sequence_str.encode()).hexdigest()
        
        return {
            "total_paragraphs": len(paragraphs),
            "sequence": sequence,
            "sequence_fingerprint": fingerprint
        }
    
    def _extract_plot_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取剧情公式"""
        total = len(paragraphs)
        
        # 简单的三幕结构识别
        acts = [
            {
                "act_name": "起",
                "paragraph_range": [0, int(total * 0.25)],
                "plot_points": ["opening", "inciting_incident"],
                "emotional_arc": "rising"
            },
            {
                "act_name": "承",
                "paragraph_range": [int(total * 0.25), int(total * 0.75)],
                "plot_points": ["rising_action", "midpoint", "complications"],
                "emotional_arc": "fluctuating"
            },
            {
                "act_name": "转",
                "paragraph_range": [int(total * 0.75), int(total * 0.9)],
                "plot_points": ["climax", "falling_action"],
                "emotional_arc": "peak"
            },
            {
                "act_name": "合",
                "paragraph_range": [int(total * 0.9), total],
                "plot_points": ["resolution", "ending"],
                "emotional_arc": "declining"
            }
        ]
        
        # 提取节奏曲线(采样10个点)
        pacing_curve = []
        sample_points = 10
        for i in range(sample_points):
            pos = int(i * total / sample_points)
            if pos < len(paragraphs):
                # 使用权重作为节奏强度的近似
                weight = paragraphs[pos].get("sequence_weight", 1.0)
                pacing_curve.append(float(weight))
        
        return {
            "narrative_structure": "three_act_structure",
            "acts": acts,
            "conflict_pattern": "unknown",
            "pacing_curve": pacing_curve
        }
    
    def _extract_description_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取描写公式"""
        total = len(paragraphs)
        
        # 统计各类描写比例(简化版)
        action_count = 0
        dialogue_count = 0
        description_count = 0
        
        for para in paragraphs:
            content = para.get("content", "")
            # 简单判断
            if '"' in content or '"' in content:
                dialogue_count += 1
            elif any(word in content for word in ['看', '走', '跑', '拿', '打']):
                action_count += 1
            else:
                description_count += 1
        
        # 归一化比例
        action_ratio = action_count / total if total > 0 else 0
        dialogue_ratio = dialogue_count / total if total > 0 else 0
        env_ratio = description_count / total if total > 0 else 0
        
        # 风格模式
        avg_length = sum(len(p.get("content", "")) for p in paragraphs) / total if total > 0 else 0
        
        return {
            "action_description_ratio": round(action_ratio, 2),
            "dialogue_ratio": round(dialogue_ratio, 2),
            "environment_ratio": round(env_ratio, 2),
            "psychological_ratio": round(max(0, 1 - action_ratio - dialogue_ratio - env_ratio), 2),
            "style_patterns": {
                "sentence_length_avg": round(avg_length, 1),
                "clause_complexity": 0.5,
                "metaphor_density": 0.1,
                "rhetoric_devices": []
            }
        }
    
    def _extract_emotion_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取情绪曲线公式"""
        total = len(paragraphs)
        
        # 采样10个情绪点
        emotion_sequence = []
        sample_points = 10
        
        for i in range(sample_points):
            pos = int(i * total / sample_points)
            if pos < len(paragraphs):
                para = paragraphs[pos]
                meta = para.get("meta", {})
                
                # 获取情感强度
                intensity = meta.get("emotion_intensity", 0.5)
                
                # 简单判断情感类型
                emotion_type = "neutral"
                if intensity > 0.6:
                    emotion_type = "positive"
                elif intensity < 0.4:
                    emotion_type = "negative"
                
                emotion_sequence.append({
                    "position": round(i / sample_points, 2),
                    "emotion": emotion_type,
                    "intensity": round(float(intensity), 2)
                })
        
        return {
            "curve_type": "波动型",
            "emotion_sequence": emotion_sequence,
            "dominant_emotions": ["neutral"],
            "emotion_transitions": []
        }
    
    def _extract_vocabulary_formula(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取词汇成语公式"""
        # 收集所有关键词和成语
        all_keywords = []
        all_idioms = []
        
        for para in paragraphs:
            keywords = para.get("keywords", [])
            idioms = para.get("idioms", [])
            all_keywords.extend(keywords)
            all_idioms.extend(idioms)
        
        # 统计频率
        keyword_freq = {}
        for kw in all_keywords:
            keyword_freq[kw] = keyword_freq.get(kw, 0) + 1
        
        idiom_freq = {}
        idiom_positions = {}
        for idx, para in enumerate(paragraphs):
            for idiom in para.get("idioms", []):
                idiom_freq[idiom] = idiom_freq.get(idiom, 0) + 1
                if idiom not in idiom_positions:
                    idiom_positions[idiom] = []
                idiom_positions[idiom].append(idx / len(paragraphs))
        
        # 按频率排序,取前20
        top_keywords = sorted(keyword_freq.items(), key=lambda x: -x[1])[:20]
        
        # 构建成语列表
        idioms_list = []
        for idiom, freq in sorted(idiom_freq.items(), key=lambda x: -x[1])[:20]:
            idioms_list.append({
                "text": idiom,
                "frequency": freq,
                "positions": [round(p, 2) for p in idiom_positions[idiom][:5]]
            })
        
        # 词汇丰富度(去重后的关键词数量)
        unique_keywords = len(set(all_keywords))
        vocabulary_richness = min(1.0, unique_keywords / (len(paragraphs) * 2))
        
        return {
            "keywords": {
                "高频词": [kw for kw, _ in top_keywords[:10]]
            },
            "idioms": idioms_list,
            "vocabulary_richness": round(vocabulary_richness, 2),
            "unique_words_count": unique_keywords
        }
    
    def _extract_neural_parameters(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提取神经网络参数"""
        weights = [p.get("sequence_weight", 1.0) for p in paragraphs]
        
        # 计算统计量
        weight_mean = np.mean(weights) if weights else 1.0
        weight_std = np.std(weights) if weights else 0.0
        
        return {
            "global_weight_vector": [round(w, 2) for w in weights[:100]],  # 仅保存前100个
            "normalization_params": {
                "mean": round(float(weight_mean), 3),
                "std": round(float(weight_std), 3)
            },
            "parameter_count": len(paragraphs) * (1 + 1536)  # weight + bias
        }


def generate_sub_formula(
    master_formula: Dict[str, Any],
    formula_type: str
) -> Dict[str, Any]:
    """
    从总公式提取子公式
    
    Args:
        master_formula: 总公式
        formula_type: 子公式类型 (plot_formula, description_formula, etc.)
    
    Returns:
        子公式字典
    """
    if formula_type not in master_formula:
        raise ValueError(f"Unknown formula type: {formula_type}")
    
    return {
        "formula_id": f"{master_formula['formula_id']}_{formula_type}",
        "book_id": master_formula["book_id"],
        "formula_type": formula_type,
        "parent_formula_id": master_formula["formula_id"],
        "expression": master_formula[formula_type],
        "created_at": datetime.now().isoformat(),
        "validation_status": "valid"
    }
