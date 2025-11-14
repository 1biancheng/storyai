"""语义段落拆分器

实现特性:
1. 语义完整性评分
2. 自适应长度控制(基于UTF-8字节数)
3. 章节边界识别
4. 场景切换检测
5. 单行格式清洗
"""

import re
from typing import List, Dict, Any
from .text_cleaner import TextCleaner


class SemanticParagraphSplitter:
    """语义段落拆分器
    
    特点:
    - 按语义边界拆分(对话、场景、时间等)
    - 自适应长度控制(120-1800字节)
    - 自动清洗为单行格式
    - 丰富的元数据标注
    """
    
    def __init__(self, min_bytes: int = 120, max_bytes: int = 1800):
        """初始化拆分器
        
        Args:
            min_bytes: 最小段落长度(UTF-8字节数)
            max_bytes: 最大段落长度(UTF-8字节数)
        """
        self.min_bytes = min_bytes
        self.max_bytes = max_bytes
        self.cleaner = TextCleaner(strict_mode=True)
        
    def split(self, text: str) -> List[Dict[str, Any]]:
        """拆分文本为语义段落
        
        Returns:
            List of paragraphs with metadata
        """
        # 步骤1: 文本规范化
        text = self._normalize_text(text)
        
        # 步骤2: 章节识别
        blocks = self._split_by_chapters(text)
        
        # 步骤3: 语义边界拆分
        paragraphs = []
        for block in blocks:
            paragraphs.extend(self._split_block_by_semantics(block))
        
        # 步骤4: 清洗为单行
        cleaned_paragraphs = []
        for idx, para in enumerate(paragraphs):
            cleaned = self.cleaner.clean_to_single_line(para["content"])
            is_valid, errors = self.cleaner.validate_cleaned(cleaned)
            
            if is_valid:
                cleaned_paragraphs.append({
                    "index": idx,
                    "content": cleaned["content"],
                    "length_bytes": cleaned["length_bytes"],
                    "length_chars": cleaned["length_chars"],
                    "length_chinese": cleaned["length_chinese"],
                    "meta": {
                        **para.get("meta", {}),
                        "cleaned": True,
                        "original_line_count": para["content"].count('\n') + 1,
                        "cleaning_operations": cleaned["operations"]
                    }
                })
        
        return cleaned_paragraphs
    
    def _normalize_text(self, text: str) -> str:
        """文本规范化"""
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()
    
    def _split_by_chapters(self, text: str) -> List[Dict[str, Any]]:
        """按章节拆分"""
        chapter_pattern = r'^(第[\u4e00-\u9fa5\d]+章|Chapter\s+\d+|^\d+\.)'
        lines = text.split('\n')
        
        blocks = []
        current_chapter = None
        current_block = []
        
        for line in lines:
            line_stripped = line.strip()
            if re.match(chapter_pattern, line_stripped, re.IGNORECASE):
                if current_block:
                    blocks.append({
                        "content": '\n'.join(current_block),
                        "meta": {"chapter": current_chapter}
                    })
                current_chapter = line_stripped
                current_block = []
                # 章节标题也作为一个块
                blocks.append({
                    "content": line_stripped,
                    "meta": {
                        "chapter": line_stripped,
                        "position_type": "chapter_start"
                    }
                })
            else:
                current_block.append(line)
        
        if current_block:
            blocks.append({
                "content": '\n'.join(current_block),
                "meta": {"chapter": current_chapter}
            })
        
        return blocks
    
    def _split_block_by_semantics(self, block: Dict) -> List[Dict]:
        """语义边界拆分"""
        content = block["content"]
        base_meta = block.get("meta", {})
        
        # 步骤1: 按句子切分
        sentences = self._split_into_sentences(content)
        
        # 步骤2: 聚合为段落(基于字节数和语义评分)
        paragraphs = []
        buffer = []
        buffer_bytes = 0
        
        for i, sentence in enumerate(sentences):
            sentence_bytes = len(sentence.encode('utf-8'))
            
            # 计算当前位置的语义完整性评分
            prev_sentence = buffer[-1] if buffer else ""
            completeness_score = self._calculate_completeness_score(
                sentence, prev_sentence
            )
            
            # 决策: 是否切分
            should_split = False
            
            if buffer_bytes + sentence_bytes > self.max_bytes:
                should_split = True
            elif buffer_bytes + sentence_bytes >= self.min_bytes and completeness_score >= 0.6:
                should_split = True
            
            if should_split and buffer:
                # 输出当前段落
                para_content = ''.join(buffer)
                paragraphs.append({
                    "content": para_content,
                    "meta": {
                        **base_meta,
                        "completeness_score": completeness_score,
                        "semantic_tags": self._extract_semantic_tags(para_content)
                    }
                })
                buffer = [sentence]
                buffer_bytes = sentence_bytes
            else:
                buffer.append(sentence)
                buffer_bytes += sentence_bytes
        
        # 处理剩余内容
        if buffer:
            para_content = ''.join(buffer)
            paragraphs.append({
                "content": para_content,
                "meta": {
                    **base_meta,
                    "completeness_score": 1.0,
                    "semantic_tags": self._extract_semantic_tags(para_content)
                }
            })
        
        return paragraphs
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """按句子拆分(保留标点)"""
        pattern = r'(?<=[.!?！？。;；:：,，、…])'
        parts = re.split(pattern, text)
        return [p for p in parts if p and p.strip()]
    
    def _calculate_completeness_score(self, sentence: str, prev_sentence: str) -> float:
        """计算语义完整性评分
        
        评分规则(基于最佳实践):
        - 对话结束点: +0.3
        - 时间标记: +0.4
        - 人物名+动词: -0.2
        - 情感词突变: +0.2
        - 场景词: +0.3
        """
        score = 0.5  # 基础分
        
        # 对话结束点
        if re.search(r'["""''「」]$', sentence.strip()):
            score += 0.3
        
        # 时间标记
        time_markers = r'(第二天|翌日|数日后|多年后|次日|清晨|傍晚)'
        if re.search(time_markers, sentence):
            score += 0.4
        
        # 人物名+动词(降低分数)
        if re.search(r'[\u4e00-\u9fa5]{2,3}(说|道|想|看|走|跑)', sentence):
            score -= 0.2
        
        # 情感词突变
        if re.search(r'(突然|忽然|猛然|顿时|瞬间)', sentence):
            score += 0.2
        
        # 场景词
        if re.search(r'(山顶|密室|战场|宫殿|森林|河边)', sentence):
            score += 0.3
        
        return max(0.0, min(1.0, score))
    
    def _extract_semantic_tags(self, text: str) -> List[str]:
        """提取语义标签"""
        tags = []
        
        if re.search(r'["""''「」]|(说道|问道|答道)', text):
            tags.append("dialogue")
        if re.search(r'(第二天|翌日|一周后)', text):
            tags.append("time_marker")
        if re.search(r'(山顶|密室|战场|宫殿)', text):
            tags.append("space_marker")
        if re.search(r'(看|走|跑|拿|打|追)', text):
            tags.append("action")
        if re.search(r'(突然|忽然|猛然)', text):
            tags.append("emotion_shift")
        
        return tags
"""语义段落拆分器

实现特性:
1. 语义完整性评分
2. 自适应长度控制(基于UTF-8字节数)
3. 章节边界识别
4. 场景切换检测
5. 单行格式清洗
"""

import re
from typing import List, Dict, Any
from .text_cleaner import TextCleaner


class SemanticParagraphSplitter:
    """语义段落拆分器
    
    特点:
    - 按语义边界拆分(对话、场景、时间等)
    - 自适应长度控制(120-1800字节)
    - 自动清洗为单行格式
    - 丰富的元数据标注
    """
    
    def __init__(self, min_bytes: int = 120, max_bytes: int = 1800):
        """初始化拆分器
        
        Args:
            min_bytes: 最小段落长度(UTF-8字节数)
            max_bytes: 最大段落长度(UTF-8字节数)
        """
        self.min_bytes = min_bytes
        self.max_bytes = max_bytes
        self.cleaner = TextCleaner(strict_mode=True)
        
    def split(self, text: str) -> List[Dict[str, Any]]:
        """拆分文本为语义段落
        
        Returns:
            List of paragraphs with metadata
        """
        # 步骤1: 文本规范化
        text = self._normalize_text(text)
        
        # 步骤2: 章节识别
        blocks = self._split_by_chapters(text)
        
        # 步骤3: 语义边界拆分
        paragraphs = []
        for block in blocks:
            paragraphs.extend(self._split_block_by_semantics(block))
        
        # 步骤4: 清洗为单行
        cleaned_paragraphs = []
        for idx, para in enumerate(paragraphs):
            cleaned = self.cleaner.clean_to_single_line(para["content"])
            is_valid, errors = self.cleaner.validate_cleaned(cleaned)
            
            if is_valid:
                cleaned_paragraphs.append({
                    "index": idx,
                    "content": cleaned["content"],
                    "length_bytes": cleaned["length_bytes"],
                    "length_chars": cleaned["length_chars"],
                    "length_chinese": cleaned["length_chinese"],
                    "meta": {
                        **para.get("meta", {}),
                        "cleaned": True,
                        "original_line_count": para["content"].count('\n') + 1,
                        "cleaning_operations": cleaned["operations"]
                    }
                })
        
        return cleaned_paragraphs
    
    def _normalize_text(self, text: str) -> str:
        """文本规范化"""
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()
    
    def _split_by_chapters(self, text: str) -> List[Dict[str, Any]]:
        """按章节拆分"""
        chapter_pattern = r'^(第[\u4e00-\u9fa5\d]+章|Chapter\s+\d+|^\d+\.)'
        lines = text.split('\n')
        
        blocks = []
        current_chapter = None
        current_block = []
        
        for line in lines:
            line_stripped = line.strip()
            if re.match(chapter_pattern, line_stripped, re.IGNORECASE):
                if current_block:
                    blocks.append({
                        "content": '\n'.join(current_block),
                        "meta": {"chapter": current_chapter}
                    })
                current_chapter = line_stripped
                current_block = []
                # 章节标题也作为一个块
                blocks.append({
                    "content": line_stripped,
                    "meta": {
                        "chapter": line_stripped,
                        "position_type": "chapter_start"
                    }
                })
            else:
                current_block.append(line)
        
        if current_block:
            blocks.append({
                "content": '\n'.join(current_block),
                "meta": {"chapter": current_chapter}
            })
        
        return blocks
    
    def _split_block_by_semantics(self, block: Dict) -> List[Dict]:
        """语义边界拆分"""
        content = block["content"]
        base_meta = block.get("meta", {})
        
        # 步骤1: 按句子切分
        sentences = self._split_into_sentences(content)
        
        # 步骤2: 聚合为段落(基于字节数和语义评分)
        paragraphs = []
        buffer = []
        buffer_bytes = 0
        
        for i, sentence in enumerate(sentences):
            sentence_bytes = len(sentence.encode('utf-8'))
            
            # 计算当前位置的语义完整性评分
            prev_sentence = buffer[-1] if buffer else ""
            completeness_score = self._calculate_completeness_score(
                sentence, prev_sentence
            )
            
            # 决策: 是否切分
            should_split = False
            
            if buffer_bytes + sentence_bytes > self.max_bytes:
                should_split = True
            elif buffer_bytes + sentence_bytes >= self.min_bytes and completeness_score >= 0.6:
                should_split = True
            
            if should_split and buffer:
                # 输出当前段落
                para_content = ''.join(buffer)
                paragraphs.append({
                    "content": para_content,
                    "meta": {
                        **base_meta,
                        "completeness_score": completeness_score,
                        "semantic_tags": self._extract_semantic_tags(para_content)
                    }
                })
                buffer = [sentence]
                buffer_bytes = sentence_bytes
            else:
                buffer.append(sentence)
                buffer_bytes += sentence_bytes
        
        # 处理剩余内容
        if buffer:
            para_content = ''.join(buffer)
            paragraphs.append({
                "content": para_content,
                "meta": {
                    **base_meta,
                    "completeness_score": 1.0,
                    "semantic_tags": self._extract_semantic_tags(para_content)
                }
            })
        
        return paragraphs
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """按句子拆分(保留标点)"""
        pattern = r'(?<=[.!?！？。;；:：,，、…])'
        parts = re.split(pattern, text)
        return [p for p in parts if p and p.strip()]
    
    def _calculate_completeness_score(self, sentence: str, prev_sentence: str) -> float:
        """计算语义完整性评分
        
        评分规则(基于最佳实践):
        - 对话结束点: +0.3
        - 时间标记: +0.4
        - 人物名+动词: -0.2
        - 情感词突变: +0.2
        - 场景词: +0.3
        """
        score = 0.5  # 基础分
        
        # 对话结束点
        if re.search(r'["""''「」]$', sentence.strip()):
            score += 0.3
        
        # 时间标记
        time_markers = r'(第二天|翌日|数日后|多年后|次日|清晨|傍晚)'
        if re.search(time_markers, sentence):
            score += 0.4
        
        # 人物名+动词(降低分数)
        if re.search(r'[\u4e00-\u9fa5]{2,3}(说|道|想|看|走|跑)', sentence):
            score -= 0.2
        
        # 情感词突变
        if re.search(r'(突然|忽然|猛然|顿时|瞬间)', sentence):
            score += 0.2
        
        # 场景词
        if re.search(r'(山顶|密室|战场|宫殿|森林|河边)', sentence):
            score += 0.3
        
        return max(0.0, min(1.0, score))
    
    def _extract_semantic_tags(self, text: str) -> List[str]:
        """提取语义标签"""
        tags = []
        
        if re.search(r'["""''「」]|(说道|问道|答道)', text):
            tags.append("dialogue")
        if re.search(r'(第二天|翌日|一周后)', text):
            tags.append("time_marker")
        if re.search(r'(山顶|密室|战场|宫殿)', text):
            tags.append("space_marker")
        if re.search(r'(看|走|跑|拿|打|追)', text):
            tags.append("action")
        if re.search(r'(突然|忽然|猛然)', text):
            tags.append("emotion_shift")
        
        return tags
