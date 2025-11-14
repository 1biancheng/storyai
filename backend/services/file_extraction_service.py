"""文件提取服务 - 简化版本

支持:
- 文本文件直接读取
- 编码自动检测
- 基本元数据返回
"""

import io
from typing import Dict, Any, Optional


class FileExtractionService:
    """文件提取服务"""
    
    async def extract_text(
        self,
        file_bytes: bytes,
        filename: str,
        detected_encoding: Optional[str] = None,
        preserve_structure: bool = False
    ) -> Dict[str, Any]:
        """提取文本内容
        
        Args:
            file_bytes: 文件字节内容
            filename: 文件名
            detected_encoding: 前端检测的编码
            preserve_structure: 是否保留文档结构
            
        Returns:
            {
                "text": "提取的文本",
                "encoding": "UTF-8",
                "confidence": 0.98,
                "method": "direct"
            }
        """
        # 尝试多种编码
        encodings_to_try = []
        
        if detected_encoding:
            encodings_to_try.append(detected_encoding)
        
        encodings_to_try.extend(['utf-8', 'utf-8-sig', 'gbk', 'gb18030', 'big5', 'latin-1'])
        
        text = None
        used_encoding = None
        
        for encoding in encodings_to_try:
            try:
                text = file_bytes.decode(encoding)
                used_encoding = encoding
                break
            except (UnicodeDecodeError, LookupError):
                continue
        
        if text is None:
            # 最后尝试忽略错误
            text = file_bytes.decode('utf-8', errors='ignore')
            used_encoding = 'utf-8'
        
        # 计算置信度（简化版）
        confidence = 0.95 if detected_encoding == used_encoding else 0.85
        
        return {
            "text": text,
            "encoding": used_encoding.upper() if used_encoding else "UTF-8",
            "confidence": confidence,
            "method": "direct"
        }
