"""Text Cleaning Service - Convert paragraphs to single-line format

Reference best practices:
- LLM data preprocessing standards
- Unicode normalization (NFC normalization)
- Control character removal
"""

import re
import unicodedata
from typing import Dict, List, Tuple, Any


class TextCleaner:
    """Text Cleaner - Convert paragraphs to single-line format
    
    Functions:
    1. Remove line breaks and tabs
    2. Merge consecutive spaces
    3. Unicode normalization
    4. UTF-8 byte counting
    5. Quality validation
    """
    
    def __init__(self, strict_mode: bool = False):
        """Initialize cleaner
        
        Args:
            strict_mode: Strict mode, remove more noise characters
        """
        self.strict_mode = strict_mode
        self.stats = {"cleaned": 0, "operations": []}
    
    def clean_to_single_line(self, text: str) -> Dict[str, Any]:
        """Clean text to single-line format
        
        Args:
            text: Original paragraph text
            
        Returns:
            {
                "content": "Cleaned single-line text",
                "length_bytes": 156,
                "length_chars": 52,
                "length_chinese": 28,
                "cleaned": True,
                "operations": ["removed_line_breaks", ...],
                "reduction_rate": 0.054
            }
        """
        if not text:
            return self._empty_result()
        
        original_bytes = len(text.encode('utf-8'))
        operations = []
        
        # 步骤1: Unicode标准化(NFC)
        text = unicodedata.normalize('NFC', text)
        operations.append("unicode_normalized_nfc")
        
        # 步骤2: 移除或替换换行符
        line_break_count = text.count('\n') + text.count('\r')
        if line_break_count > 0:
            # 替换为空格,保留语义边界
            text = text.replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ')
            operations.append(f"removed_{line_break_count}_line_breaks")
        
        # 步骤3: 移除或替换制表符
        tab_count = text.count('\t')
        if tab_count > 0:
            text = text.replace('\t', ' ')
            operations.append(f"replaced_{tab_count}_tabs")
        
        # 步骤4: 合并连续空格(保留全角空格)
        original_len = len(text)
        text = re.sub(r' {2,}', ' ', text)  # 仅合并半角空格
        space_reduced = original_len - len(text)
        if space_reduced > 0:
            operations.append(f"merged_{space_reduced}_spaces")
        
        # 步骤5: 移除控制字符(保留必要的空格)
        if self.strict_mode:
            control_chars = sum(1 for c in text if ord(c) < 32 and c not in [' '])
            if control_chars > 0:
                text = ''.join(c for c in text if ord(c) >= 32 or c == ' ')
                operations.append(f"removed_{control_chars}_control_chars")
        
        # 步骤6: 去除首尾空白
        text = text.strip()
        operations.append("trimmed_whitespace")
        
        # 计算各种长度指标
        final_bytes = len(text.encode('utf-8'))
        length_chars = len(text)
        length_chinese = len(re.findall(r'[\u4e00-\u9fa5]', text))
        
        return {
            "content": text,
            "length_bytes": final_bytes,
            "length_chars": length_chars,
            "length_chinese": length_chinese,
            "cleaned": True,
            "operations": operations,
            "original_bytes": original_bytes,
            "reduction_rate": round((original_bytes - final_bytes) / max(original_bytes, 1), 3)
        }
    
    def batch_clean(self, paragraphs: List[str]) -> List[Dict[str, Any]]:
        """批量清洗段落"""
        return [self.clean_to_single_line(p) for p in paragraphs]
    
    def validate_cleaned(self, result: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """验证清洗质量
        
        Returns:
            (is_valid, error_messages)
        """
        errors = []
        content = result.get("content", "")
        
        # 检查1: 不包含换行符
        if '\n' in content or '\r' in content:
            errors.append("Contains line breaks")
        
        # 检查2: 字节数范围(120-1800)
        bytes_len = result.get("length_bytes", 0)
        if bytes_len < 120:
            errors.append(f"Too short: {bytes_len} bytes < 120")
        elif bytes_len > 1800:
            errors.append(f"Too long: {bytes_len} bytes > 1800")
        
        # 检查3: 非空
        if not content or content.isspace():
            errors.append("Empty or whitespace-only")
        
        # 检查4: 控制字符残留(严格模式)
        if self.strict_mode:
            control_count = sum(1 for c in content if ord(c) < 32 and c not in [' '])
            if control_count > 0:
                errors.append(f"Contains {control_count} control characters")
        
        return len(errors) == 0, errors
    
    def _empty_result(self) -> Dict[str, Any]:
        return {
            "content": "",
            "length_bytes": 0,
            "length_chars": 0,
            "length_chinese": 0,
            "cleaned": False,
            "operations": [],
            "original_bytes": 0,
            "reduction_rate": 0.0
        }
"""文本清洗服务 - 将段落转换为单行格式

参考最佳实践:
- LLM数据预处理标准
- Unicode标准化(NFC normalization)
- 控制字符移除
"""

import re
import unicodedata
from typing import Dict, List, Tuple, Any


class TextCleaner:
    """文本清洗器 - 将段落转换为单行格式
    
    功能:
    1. 移除换行符和制表符
    2. 合并连续空格
    3. Unicode标准化
    4. UTF-8字节计数
    5. 质量验证
    """
    
    def __init__(self, strict_mode: bool = False):
        """初始化清洗器
        
        Args:
            strict_mode: 严格模式,移除更多噪声字符
        """
        self.strict_mode = strict_mode
        self.stats = {"cleaned": 0, "operations": []}
    
    def clean_to_single_line(self, text: str) -> Dict[str, Any]:
        """清洗文本为单行格式
        
        Args:
            text: 原始段落文本
            
        Returns:
            {
                "content": "清洗后的单行文本",
                "length_bytes": 156,
                "length_chars": 52,
                "length_chinese": 28,
                "cleaned": True,
                "operations": ["removed_line_breaks", ...],
                "reduction_rate": 0.054
            }
        """
        if not text:
            return self._empty_result()
        
        original_bytes = len(text.encode('utf-8'))
        operations = []
        
        # 步骤1: Unicode标准化(NFC)
        text = unicodedata.normalize('NFC', text)
        operations.append("unicode_normalized_nfc")
        
        # 步骤2: 移除或替换换行符
        line_break_count = text.count('\n') + text.count('\r')
        if line_break_count > 0:
            # 替换为空格,保留语义边界
            text = text.replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ')
            operations.append(f"removed_{line_break_count}_line_breaks")
        
        # 步骤3: 移除或替换制表符
        tab_count = text.count('\t')
        if tab_count > 0:
            text = text.replace('\t', ' ')
            operations.append(f"replaced_{tab_count}_tabs")
        
        # 步骤4: 合并连续空格(保留全角空格)
        original_len = len(text)
        text = re.sub(r' {2,}', ' ', text)  # 仅合并半角空格
        space_reduced = original_len - len(text)
        if space_reduced > 0:
            operations.append(f"merged_{space_reduced}_spaces")
        
        # 步骤5: 移除控制字符(保留必要的空格)
        if self.strict_mode:
            control_chars = sum(1 for c in text if ord(c) < 32 and c not in [' '])
            if control_chars > 0:
                text = ''.join(c for c in text if ord(c) >= 32 or c == ' ')
                operations.append(f"removed_{control_chars}_control_chars")
        
        # 步骤6: 去除首尾空白
        text = text.strip()
        operations.append("trimmed_whitespace")
        
        # 计算各种长度指标
        final_bytes = len(text.encode('utf-8'))
        length_chars = len(text)
        length_chinese = len(re.findall(r'[\u4e00-\u9fa5]', text))
        
        return {
            "content": text,
            "length_bytes": final_bytes,
            "length_chars": length_chars,
            "length_chinese": length_chinese,
            "cleaned": True,
            "operations": operations,
            "original_bytes": original_bytes,
            "reduction_rate": round((original_bytes - final_bytes) / max(original_bytes, 1), 3)
        }
    
    def batch_clean(self, paragraphs: List[str]) -> List[Dict[str, Any]]:
        """批量清洗段落"""
        return [self.clean_to_single_line(p) for p in paragraphs]
    
    def validate_cleaned(self, result: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """验证清洗质量
        
        Returns:
            (is_valid, error_messages)
        """
        errors = []
        content = result.get("content", "")
        
        # 检查1: 不包含换行符
        if '\n' in content or '\r' in content:
            errors.append("Contains line breaks")
        
        # 检查2: 字节数范围(120-1800)
        bytes_len = result.get("length_bytes", 0)
        if bytes_len < 120:
            errors.append(f"Too short: {bytes_len} bytes < 120")
        elif bytes_len > 1800:
            errors.append(f"Too long: {bytes_len} bytes > 1800")
        
        # 检查3: 非空
        if not content or content.isspace():
            errors.append("Empty or whitespace-only")
        
        # 检查4: 控制字符残留(严格模式)
        if self.strict_mode:
            control_count = sum(1 for c in content if ord(c) < 32 and c not in [' '])
            if control_count > 0:
                errors.append(f"Contains {control_count} control characters")
        
        return len(errors) == 0, errors
    
    def _empty_result(self) -> Dict[str, Any]:
        return {
            "content": "",
            "length_bytes": 0,
            "length_chars": 0,
            "length_chinese": 0,
            "cleaned": False,
            "operations": [],
            "original_bytes": 0,
            "reduction_rate": 0.0
        }
