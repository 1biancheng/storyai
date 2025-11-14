"""
@license
SPDX-License-Identifier: Apache-2.0
"""

"""
时间工具函数模块
提供统一的时间处理功能,用于项目和章节创建时间的生成和格式化
"""

import time
from datetime import datetime
from typing import Union


def get_current_timestamp() -> int:
    """
    获取当前时间戳(毫秒)
    
    Returns:
        当前时间戳(毫秒)
    """
    return int(time.time() * 1000)


def get_current_iso_time() -> str:
    """
    获取当前ISO格式时间字符串
    
    Returns:
        当前ISO格式时间字符串
    """
    return datetime.now().isoformat()


def get_current_utc_timestamp() -> int:
    """
    获取当前UTC时间戳(毫秒)
    
    Returns:
        当前UTC时间戳(毫秒)
    """
    return int(time.time() * 1000)


def get_current_utc_iso_time() -> str:
    """
    获取当前UTC ISO格式时间字符串
    
    Returns:
        当前UTC ISO格式时间字符串
    """
    return datetime.utcnow().isoformat()


def format_timestamp(timestamp: Union[int, float], format_type: str = 'full') -> str:
    """
    格式化时间戳为可读字符串
    
    Args:
        timestamp: 时间戳(毫秒)
        format_type: 格式类型 ('full', 'date', 'time')
        
    Returns:
        格式化后的时间字符串
    """
    dt = datetime.fromtimestamp(timestamp / 1000)
    
    if format_type == 'date':
        return dt.strftime('%Y-%m-%d')
    elif format_type == 'time':
        return dt.strftime('%H:%M:%S')
    else:  # full
        return dt.strftime('%Y-%m-%d %H:%M:%S')