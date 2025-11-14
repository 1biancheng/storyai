"""
系统时间服务模块
用于统一管理系统时间的获取和格式化
"""

import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class TimeService:
    """系统时间服务类,提供统一的时间获取和格式化功能"""
    
    def __init__(self):
        self._initialized = False
        self._time_offset = 0  # 服务器时间偏移量,用于同步服务器时间
    
    async def initialize(self):
        """初始化时间服务"""
        if self._initialized:
            return
        
        # 这里可以添加与外部时间源同步的逻辑
        # 例如:从NTP服务器或系统API获取准确时间
        self._initialized = True
        logger.info("Time service initialized")
    
    def get_current_time(self) -> datetime:
        """
        获取当前系统时间(UTC)
        
        Returns:
            datetime: 当前UTC时间
        """
        # 使用系统时间,加上偏移量(如果有的话)
        return datetime.now(timezone.utc)
    
    def get_current_timestamp_ms(self) -> int:
        """
        获取当前时间戳(毫秒)
        
        Returns:
            int: 当前时间戳(毫秒)
        """
        return int(time.time() * 1000)
    
    def get_current_timestamp_s(self) -> int:
        """
        获取当前时间戳(秒)
        
        Returns:
            int: 当前时间戳(秒)
        """
        return int(time.time())
    
    def get_current_iso_string(self) -> str:
        """
        获取当前时间的ISO 8601格式字符串
        
        Returns:
            str: ISO 8601格式的时间字符串
        """
        return self.get_current_time().isoformat()
    
    def get_time_data(self) -> Dict[str, Any]:
        """
        获取完整的时间数据,与前端TimeDisplay组件兼容
        
        Returns:
            Dict[str, Any]: 包含多种格式的时间数据
        """
        now = self.get_current_time()
        return {
            "server_time": now.isoformat(),
            "timezone": "UTC",
            "unix_timestamp": int(now.timestamp())
        }
    
    def sync_with_server_time(self, server_time_data: Dict[str, Any]) -> bool:
        """
        与服务器时间同步
        
        Args:
            server_time_data: 服务器时间数据
            
        Returns:
            bool: 同步是否成功
        """
        try:
            server_time_str = server_time_data.get("server_time")
            if not server_time_str:
                return False
                
            server_time = datetime.fromisoformat(server_time_str.replace('Z', '+00:00'))
            local_time = self.get_current_time()
            
            # 计算时间偏移量
            self._time_offset = (server_time - local_time).total_seconds()
            logger.info(f"Time sync completed, offset: {self._time_offset} seconds")
            return True
        except Exception as e:
            logger.error(f"Failed to sync with server time: {e}")
            return False


# 全局时间服务实例
_time_service = None


async def get_time_service() -> TimeService:
    """获取时间服务实例"""
    global _time_service
    if _time_service is None:
        _time_service = TimeService()
        await _time_service.initialize()
    return _time_service


def get_current_time() -> datetime:
    """获取当前时间的便捷函数"""
    return datetime.now(timezone.utc)


def get_current_timestamp_ms() -> int:
    """获取当前时间戳(毫秒)的便捷函数"""
    return int(time.time() * 1000)


def get_current_iso_string() -> str:
    """获取当前ISO时间字符串的便捷函数"""
    return datetime.now(timezone.utc).isoformat()