"""
时间工具MCP客户端
提供便捷的方法调用时间工具API
"""

import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime


class TimeToolsClient:
    """时间工具MCP客户端"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """
        初始化时间工具客户端
        
        Args:
            base_url: API基础URL
        """
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        """关闭HTTP客户端"""
        await self.client.aclose()
    
    async def get_current_time(
        self, 
        timezone: Optional[str] = None, 
        format: str = "readable"
    ) -> Dict[str, Any]:
        """
        获取当前时间
        
        Args:
            timezone: 时区字符串,如 'Asia/Shanghai', 'UTC', 'America/New_York'
            format: 时间格式,支持 'iso', 'unix', 'readable'
            
        Returns:
            包含时间信息的字典
        """
        params = {}
        if timezone:
            params["timezone"] = timezone
        if format:
            params["format"] = format
            
        response = await self.client.get(
            f"{self.base_url}/api/system/time/current",
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    async def calculate_time(
        self,
        operation: str,
        base_time: Optional[str] = None,
        value: Optional[int] = None,
        unit: str = "minutes",
        target_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        时间计算
        
        Args:
            operation: 操作类型,支持 'add', 'subtract', 'diff'
            base_time: ISO格式时间,可选,默认为当前时间
            value: 数值,用于add/subtract操作
            unit: 时间单位,支持 'seconds', 'minutes', 'hours', 'days'
            target_time: 目标时间,用于diff操作
            
        Returns:
            计算结果字典
        """
        data = {"operation": operation}
        
        if base_time:
            data["base_time"] = base_time
        if value is not None:
            data["value"] = value
        if unit:
            data["unit"] = unit
        if target_time:
            data["target_time"] = target_time
            
        response = await self.client.post(
            f"{self.base_url}/api/system/time/calculate",
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    async def list_timezones(self) -> Dict[str, Any]:
        """
        获取常用时区列表
        
        Returns:
            包含时区列表的字典
        """
        response = await self.client.get(
            f"{self.base_url}/api/system/time/timezones"
        )
        response.raise_for_status()
        return response.json()
    
    # 便捷方法
    async def add_time(
        self, 
        value: int, 
        unit: str = "minutes",
        base_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """时间加法便捷方法"""
        return await self.calculate_time(
            operation="add",
            base_time=base_time,
            value=value,
            unit=unit
        )
    
    async def subtract_time(
        self, 
        value: int, 
        unit: str = "minutes",
        base_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """时间减法便捷方法"""
        return await self.calculate_time(
            operation="subtract",
            base_time=base_time,
            value=value,
            unit=unit
        )
    
    async def time_diff(
        self, 
        time1: str, 
        time2: str
    ) -> Dict[str, Any]:
        """计算时间差便捷方法"""
        return await self.calculate_time(
            operation="diff",
            base_time=time1,
            target_time=time2
        )
    
    async def measure_execution_time(self, func, *args, **kwargs):
        """
        测量函数执行时间
        
        Args:
            func: 要测量的函数
            *args, **kwargs: 函数参数
            
        Returns:
            包含执行时间和函数返回值的字典
        """
        start_time = await self.get_current_time(format="unix")
        result = await func(*args, **kwargs)
        end_time = await self.get_current_time(format="unix")
        
        start_ts = start_time["data"]["unix_timestamp"]
        end_ts = end_time["data"]["unix_timestamp"]
        
        diff = await self.calculate_time(
            operation="diff",
            base_time=datetime.fromtimestamp(start_ts).isoformat(),
            target_time=datetime.fromtimestamp(end_ts).isoformat()
        )
        
        return {
            "execution_time": diff["data"]["result"],
            "function_result": result
        }


# 使用示例
async def example_usage():
    """时间工具使用示例"""
    client = TimeToolsClient()
    
    try:
        # 获取当前时间
        current = await client.get_current_time(timezone="Asia/Shanghai")
        print(f"当前时间: {current['data']['formatted']}")
        
        # 时间加法
        future = await client.add_time(30, "minutes")
        print(f"30分钟后: {future['data']['result']}")
        
        # 计算时间差
        diff = await client.time_diff(
            "2025-11-03T12:00:00",
            "2025-11-03T14:30:00"
        )
        print(f"时间差: {diff['data']['result']['formatted']}")
        
        # 获取时区列表
        timezones = await client.list_timezones()
        print(f"支持的时区数量: {len(timezones['data']['timezones'])}")
        
    finally:
        await client.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(example_usage())