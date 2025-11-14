"""工具相关API路由
提供网络搜索等工具功能的API端点
"""

import os
import json
import asyncio
import aiohttp
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from api_framework import ApiResponse
from config import get_settings
from errors import DomainError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["tools"])

# 请求和响应模型
class WebSearchRequest(BaseModel):
    query: str = Field(..., description="搜索查询词")
    num_results: int = Field(default=10, description="返回结果数量,最大为20")
    safe_search: str = Field(default="moderate", description="安全搜索级别: off, moderate, strict")

class SearchResult(BaseModel):
    title: str = Field(..., description="结果标题")
    url: str = Field(..., description="结果URL")
    snippet: str = Field(..., description="结果摘要")
    domain: str = Field(..., description="域名")
    published_time: Optional[str] = Field(None, description="发布时间")
    relevance_score: Optional[float] = Field(None, description="相关度分数")

class WebSearchResponse(BaseModel):
    results: List[SearchResult] = Field(..., description="搜索结果列表")
    total_results: Optional[int] = Field(None, description="总结果数")
    search_time: float = Field(..., description="搜索耗时(秒)")

# 搜索引擎配置
class SearchEngineConfig:
    """搜索引擎配置"""
    
    @staticmethod
    def get_config() -> Dict[str, Any]:
        """获取搜索引擎配置"""
        settings = get_settings()
        
        config = {
            "engine": settings.search_engine.default_engine,
            "timeout": settings.search_engine.timeout,
            "max_retries": settings.search_engine.max_retries,
            "enable_proxy": settings.search_engine.enable_proxy,
            "proxy_url": settings.search_engine.proxy_url
        }
        
        # 如果配置了Google Custom Search API,则使用Google
        if settings.search_engine.google_api_key and settings.search_engine.google_search_engine_id:
            config.update({
                "engine": "google",
                "base_url": "https://www.googleapis.com/customsearch/v1",
                "api_key": settings.search_engine.google_api_key,
                "search_engine_id": settings.search_engine.google_search_engine_id
            })
            return config
        
        # 如果配置了Bing Search API,则使用Bing
        if settings.search_engine.bing_api_key:
            config.update({
                "engine": "bing",
                "base_url": "https://api.bing.microsoft.com/v7.0/search",
                "api_key": settings.search_engine.bing_api_key
            })
        
        return config

# 网络搜索实现
class WebSearchService:
    """网络搜索服务"""
    
    @staticmethod
    async def search_duckduckgo(query: str, num_results: int = 10) -> Dict[str, Any]:
        """使用DuckDuckGo进行搜索 (无需API密钥)"""
        import time
        start_time = time.time()
        
        # DuckDuckGo即时答案API
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query,
            "format": "json",
            "no_html": 1,
            "skip_disambig": 1
        }
        
        try:
            # 创建支持代理的会话
            connector = aiohttp.TCPConnector(ssl=False, limit=100)
            timeout = aiohttp.ClientTimeout(total=15.0, connect=5.0)
            
            async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # 转换结果格式
                        results = []
                        
                        # 处理主要结果
                        if data.get("Abstract"):
                            results.append(SearchResult(
                                title=data.get("Heading", query),
                                url=data.get("AbstractURL", ""),
                                snippet=data.get("Abstract", ""),
                                domain=data.get("AbstractURL", "").split("/")[2] if data.get("AbstractURL") else "",
                                relevance_score=95.0
                            ))
                        
                        # 处理相关主题
                        for topic in data.get("RelatedTopics", [])[:num_results-1]:
                            if "Text" in topic and "FirstURL" in topic:
                                results.append(SearchResult(
                                    title=topic.get("Text", "").split(" - ")[0],
                                    url=topic.get("FirstURL", ""),
                                    snippet=topic.get("Text", ""),
                                    domain=topic.get("FirstURL", "").split("/")[2] if topic.get("FirstURL") else "",
                                    relevance_score=80.0
                                ))
                        
                        search_time = time.time() - start_time
                        
                        return {
                            "results": results,
                            "total_results": len(results),
                            "search_time": search_time
                        }
                    else:
                        logger.warning(f"DuckDuckGo搜索返回非200状态码: {response.status}")
                        # 返回空结果而不是报错
                        return {
                            "results": [],
                            "total_results": 0,
                            "search_time": time.time() - start_time
                        }
        except asyncio.TimeoutError:
            logger.error("DuckDuckGo搜索超时")
            # 返回空结果而不是报错
            return {
                "results": [],
                "total_results": 0,
                "search_time": time.time() - start_time
            }
        except aiohttp.ClientError as e:
            logger.error(f"DuckDuckGo网络连接错误: {str(e)}")
            # 返回空结果而不是报错
            return {
                "results": [],
                "total_results": 0,
                "search_time": time.time() - start_time
            }
        except Exception as e:
            logger.error(f"DuckDuckGo搜索错误: {str(e)}")
            # 返回空结果而不是报错
            return {
                "results": [],
                "total_results": 0,
                "search_time": time.time() - start_time
            }
    
    @staticmethod
    async def search_google(query: str, num_results: int = 10, api_key: str = "", search_engine_id: str = "") -> Dict[str, Any]:
        """使用Google Custom Search API进行搜索"""
        import time
        start_time = time.time()
        
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": api_key,
            "cx": search_engine_id,
            "q": query,
            "num": min(num_results, 10)  # Google API限制最多10个结果
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10.0) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # 转换结果格式
                        results = []
                        
                        for item in data.get("items", []):
                            results.append(SearchResult(
                                title=item.get("title", ""),
                                url=item.get("link", ""),
                                snippet=item.get("snippet", ""),
                                domain=item.get("displayLink", ""),
                                relevance_score=85.0
                            ))
                        
                        search_time = time.time() - start_time
                        
                        return {
                            "results": results,
                            "total_results": data.get("searchInformation", {}).get("totalResults", len(results)),
                            "search_time": search_time
                        }
                    else:
                        error_data = await response.json() if response.content_type == "application/json" else await response.text()
                        raise HTTPException(
                            status_code=response.status,
                            detail=f"Google搜索失败: {error_data}"
                        )
        except Exception as e:
            logger.error(f"Google搜索错误: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"搜索服务错误: {str(e)}"
            )
    
    @staticmethod
    async def search_bing(query: str, num_results: int = 10, api_key: str = "") -> Dict[str, Any]:
        """使用Bing Search API进行搜索"""
        import time
        start_time = time.time()
        
        url = "https://api.bing.microsoft.com/v7.0/search"
        headers = {
            "Ocp-Apim-Subscription-Key": api_key
        }
        params = {
            "q": query,
            "count": min(num_results, 50),  # Bing API限制最多50个结果
            "mkt": "zh-CN",  # 中文市场
            "safesearch": "Moderate"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params, timeout=10.0) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # 转换结果格式
                        results = []
                        
                        for item in data.get("webPages", {}).get("value", []):
                            results.append(SearchResult(
                                title=item.get("name", ""),
                                url=item.get("url", ""),
                                snippet=item.get("snippet", ""),
                                domain=item.get("displayUrl", "").split("/")[0] if item.get("displayUrl") else "",
                                relevance_score=85.0
                            ))
                        
                        search_time = time.time() - start_time
                        
                        return {
                            "results": results,
                            "total_results": data.get("webPages", {}).get("totalEstimatedMatches", len(results)),
                            "search_time": search_time
                        }
                    else:
                        error_data = await response.json() if response.content_type == "application/json" else await response.text()
                        raise HTTPException(
                            status_code=response.status,
                            detail=f"Bing搜索失败: {error_data}"
                        )
        except Exception as e:
            logger.error(f"Bing搜索错误: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"搜索服务错误: {str(e)}"
            )

# API端点
@router.post("/web_search", response_model=ApiResponse[WebSearchResponse])
async def web_search(request: WebSearchRequest):
    """网络搜索API端点"""
    try:
        # 获取搜索引擎配置
        config = SearchEngineConfig.get_config()
        engine = config.get("engine", "duckduckgo")
        
        # 根据配置的搜索引擎执行搜索
        if engine == "google":
            if not config.get("api_key") or not config.get("search_engine_id"):
                raise HTTPException(
                    status_code=400,
                    detail="Google搜索未配置: 需要设置google_search_api_key和google_search_engine_id"
                )
            
            search_result = await WebSearchService.search_google(
                query=request.query,
                num_results=request.num_results,
                api_key=config.get("api_key"),
                search_engine_id=config.get("search_engine_id")
            )
        elif engine == "bing":
            if not config.get("api_key"):
                raise HTTPException(
                    status_code=400,
                    detail="Bing搜索未配置: 需要设置bing_search_api_key"
                )
            
            search_result = await WebSearchService.search_bing(
                query=request.query,
                num_results=request.num_results,
                api_key=config.get("api_key")
            )
        else:  # 默认使用DuckDuckGo
            search_result = await WebSearchService.search_duckduckgo(
                query=request.query,
                num_results=request.num_results
            )
            
            # 如果DuckDuckGo没有返回结果,尝试其他方法
            if not search_result["results"]:
                logger.info("DuckDuckGo搜索无结果,尝试使用本地知识库搜索")
                # 这里可以添加其他搜索逻辑,比如本地知识库搜索
                search_result["results"] = [SearchResult(
                    title=f"本地搜索: {request.query}",
                    url="#",
                    snippet=f"由于网络限制,无法获取在线搜索结果.建议手动搜索: {request.query}",
                    domain="local",
                    relevance_score=50.0
                )]
        
        # 构建响应
        response = WebSearchResponse(
            results=search_result["results"],
            total_results=search_result.get("total_results"),
            search_time=search_result["search_time"]
        )
        
        # 根据结果数量调整消息
        if len(response.results) == 0:
            message = "未找到相关结果,建议检查网络连接或稍后重试"
        elif len(response.results) == 1 and response.results[0].domain == "local":
            message = "由于网络限制,显示本地建议结果"
        else:
            message = f"使用{engine}搜索引擎找到{len(response.results)}个结果"
        
        return ApiResponse(
            code=200,
            data=response,
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"网络搜索API错误: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"搜索服务错误: {str(e)}"
        )

@router.get("/search_config", response_model=ApiResponse[Dict[str, Any]])
async def get_search_config():
    """获取当前搜索引擎配置"""
    try:
        config = SearchEngineConfig.get_config()
        
        # 返回不包含敏感信息的配置
        safe_config = {
            "engine": config.get("engine", "duckduckgo"),
            "configured": True
        }
        
        if config.get("engine") == "google":
            safe_config["has_api_key"] = bool(config.get("api_key"))
            safe_config["has_search_engine_id"] = bool(config.get("search_engine_id"))
        elif config.get("engine") == "bing":
            safe_config["has_api_key"] = bool(config.get("api_key"))
        
        return ApiResponse(
            code=200,
            data=safe_config,
            message="搜索引擎配置信息"
        )
        
    except Exception as e:
        logger.error(f"获取搜索配置错误: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取配置错误: {str(e)}"
        )