"""
JSON 修复与解析工具

优先使用第三方库 json-repair (可选依赖):
- pip install json-repair

如不可用则回退至内置简易修复策略:
- 尝试补全缺失的括号/引号
- 去除末尾多余逗号

提供统一接口: repair_and_load(text) -> object
"""

import json
import re
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

def _fallback_repair(text: str) -> str:
    """内置简易修复策略"""
    # 去除 BOM
    if text and text[0] == '\ufeff':
        text = text[1:]
    
    # 去除首尾空白字符
    text = text.strip()
    
    # 去除多余逗号
    text = re.sub(r",\s*([}\]])", r"\1", text)
    
    # 尝试补全结尾缺失的括号
    opens = text.count("{") + text.count("[")
    closes = text.count("}") + text.count("]")
    if opens > closes:
        text += "}" * max(0, text.count("{") - text.count("}"))
        text += "]" * max(0, text.count("[") - text.count("]"))
    
    # 尝试补全开头可能缺失的括号
    if text and text[0] not in ['{', '[', '"']:
        # 如果开头不是JSON结构字符，尝试包装成对象
        if text.endswith('"') and text.startswith('"'):
            text = '{"value": ' + text + '}'
        elif text.replace('.', '').replace('-', '').isdigit():
            text = '{"value": ' + text + '}'
        else:
            text = '{"value": "' + text + '"}'
    
    return text


def repair_and_load(text: str, default_value: Optional[Any] = None) -> Any:
    """
    使用 json-repair 修复损坏的JSON字符串
    - 优先使用 json_repair.repair_json + ensure_ascii=False 保留中文
    - 回退策略使用内置简易修复
    - 支持异常捕获,确保程序稳定运行
    
    Args:
        text: 要修复的JSON字符串
        default_value: 当修复失败时返回的默认值，默认为None，可设置为{}或[]
        
    Returns:
        修复后的对象，如果修复失败则返回default_value
    """
    if not text or not isinstance(text, str):
        return default_value if default_value is not None else {}
    
    try:
        from json_repair import repair_json  # type: ignore
        # 保留非拉丁字符(中文)
        repaired = repair_json(text, ensure_ascii=False)
        # repair_json 可能返回已解析对象或字符串
        if isinstance(repaired, str):
            return json.loads(repaired)
        return repaired
    except ImportError:
        # json-repair 未安装,使用回退策略
        logger.warning("json-repair库未安装，使用内置修复策略")
        repaired = _fallback_repair(text)
        return json.loads(repaired)
    except Exception as e:
        # 修复失败,尝试回退策略
        logger.warning(f"json-repair修复失败: {e}，尝试回退策略")
        try:
            repaired = _fallback_repair(text)
            return json.loads(repaired)
        except Exception as e2:
            # 彻底失败,返回默认值避免崩溃
            logger.error(f"JSON修复完全失败: {e2}")
            return default_value if default_value is not None else {}


def safe_json_loads(text: str, default_value: Optional[Any] = None) -> Any:
    """
    安全的JSON解析函数，包装了repair_and_load
    
    Args:
        text: 要解析的JSON字符串
        default_value: 当解析失败时返回的默认值
        
    Returns:
        解析后的对象，如果解析失败则返回default_value
    """
    return repair_and_load(text, default_value)