"""AI服务层 - 统一的AI模型调用接口
支持OpenAI、Anthropic等多种模型提供商
基于环境变量的动态配置管理,符合OpenAI API格式统一接口规范
"""

import os
import json
import asyncio
import aiohttp
import logging
from typing import Dict, Any, Optional, List, AsyncGenerator
from functools import lru_cache
from datetime import datetime

# Import cache service
from .cache_service import get_cache

from contracts import ModelProvider, ModelConfigContract, ErrorCode
from api_framework import ApiException
from config import get_settings

logger = logging.getLogger(__name__)

class ModelConfig:
    """模型配置类,基于环境变量动态管理"""
    
    @staticmethod
    def get_supported_models() -> Dict[str, Dict[str, Any]]:
        """获取支持的模型配置"""
        return {
            # OpenAI Models
            "gpt-4": {
                "provider": "openai",
                "model_name": "gpt-4",
                "api_key_env": "OPENAI_API_KEY",
                "base_url_env": "OPENAI_API_BASE_URL",
                "default_base_url": "https://api.openai.com/v1",
                "supports_streaming": True,
                "max_tokens": 8192
            },
            "gpt-4-turbo": {
                "provider": "openai",
                "model_name": "gpt-4-turbo",
                "api_key_env": "OPENAI_API_KEY",
                "base_url_env": "OPENAI_API_BASE_URL",
                "default_base_url": "https://api.openai.com/v1",
                "supports_streaming": True,
                "max_tokens": 4096
            },
            "gpt-3.5-turbo": {
                "provider": "openai",
                "model_name": "gpt-3.5-turbo",
                "api_key_env": "OPENAI_API_KEY",
                "base_url_env": "OPENAI_API_BASE_URL",
                "default_base_url": "https://api.openai.com/v1",
                "supports_streaming": True,
                "max_tokens": 4096
            },
            
            # Azure OpenAI Models
            "azure-gpt-4": {
                "provider": "openai",
                "model_name": "gpt-4",
                "api_key_env": "AZURE_OPENAI_API_KEY",
                "base_url_env": "AZURE_OPENAI_API_BASE_URL",
                "default_base_url": "https://your-resource.openai.azure.com/v1",
                "supports_streaming": True,
                "max_tokens": 8192
            },
            
            # Kimi/Moonshot Models (OpenAI Compatible)
            "moonshot-v1-8k": {
                "provider": "openai",
                "model_name": "moonshot-v1-8k",
                "api_key_env": "KIMI_API_KEY",
                "base_url_env": "KIMI_API_BASE_URL",
                "default_base_url": "https://api.moonshot.cn/v1",
                "supports_streaming": True,
                "max_tokens": 8192
            },
            "moonshot-v1-32k": {
                "provider": "openai",
                "model_name": "moonshot-v1-32k",
                "api_key_env": "KIMI_API_KEY",
                "base_url_env": "KIMI_API_BASE_URL",
                "default_base_url": "https://api.moonshot.cn/v1",
                "supports_streaming": True,
                "max_tokens": 32768
            },
            
            # DeepSeek Models (OpenAI Compatible)
            "deepseek-chat": {
                "provider": "openai",
                "model_name": "deepseek-chat",
                "api_key_env": "DEEPSEEK_API_KEY",
                "base_url_env": "DEEPSEEK_API_BASE_URL",
                "default_base_url": "https://api.deepseek.com/v1",
                "supports_streaming": True,
                "max_tokens": 4096
            },
            "deepseek-coder": {
                "provider": "openai",
                "model_name": "deepseek-coder",
                "api_key_env": "DEEPSEEK_API_KEY",
                "base_url_env": "DEEPSEEK_API_BASE_URL",
                "default_base_url": "https://api.deepseek.com/v1",
                "supports_streaming": True,
                "max_tokens": 4096
            },
            
            # Anthropic Claude Models
            "claude-3-sonnet": {
                "provider": "anthropic",
                "model_name": "claude-3-sonnet-20240229",
                "api_key_env": "ANTHROPIC_API_KEY",
                "base_url_env": "ANTHROPIC_API_BASE_URL",
                "default_base_url": "https://api.anthropic.com/v1",
                "supports_streaming": True,
                "max_tokens": 4096
            },
            "claude-3-haiku": {
                "provider": "anthropic",
                "model_name": "claude-3-haiku-20240307",
                "api_key_env": "ANTHROPIC_API_KEY",
                "base_url_env": "ANTHROPIC_API_BASE_URL",
                "default_base_url": "https://api.anthropic.com/v1",
                "supports_streaming": True,
                "max_tokens": 4096
            },
            
            # Mistral Models (OpenAI Compatible via one-api)
            "mistral-large": {
                "provider": "openai",
                "model_name": "mistral-large-latest",
                "api_key_env": "MISTRAL_API_KEY",
                "base_url_env": "MISTRAL_API_BASE_URL",
                "default_base_url": "https://api.mistral.ai/v1",
                "supports_streaming": True,
                "max_tokens": 4096
            }
            ,
            # OpenAI Embedding Models
            "text-embedding-ada-002": {
                "provider": "openai",
                "model_name": "text-embedding-ada-002",
                "api_key_env": "OPENAI_API_KEY",
                "base_url_env": "OPENAI_API_BASE_URL",
                "default_base_url": "https://api.openai.com/v1",
                "supports_streaming": False,
                "embedding_dimension": 1536
            },
            "text-embedding-3-small": {
                "provider": "openai",
                "model_name": "text-embedding-3-small",
                "api_key_env": "OPENAI_API_KEY",
                "base_url_env": "OPENAI_API_BASE_URL",
                "default_base_url": "https://api.openai.com/v1",
                "supports_streaming": False,
                "embedding_dimension": 1536
            },
            "text-embedding-3-large": {
                "provider": "openai",
                "model_name": "text-embedding-3-large",
                "api_key_env": "OPENAI_API_KEY",
                "base_url_env": "OPENAI_API_BASE_URL",
                "default_base_url": "https://api.openai.com/v1",
                "supports_streaming": False,
                "embedding_dimension": 3072
            }
        }
    
    @staticmethod
    @lru_cache(maxsize=256)
    def get_model_config(model_id: str) -> Dict[str, Any]:
        """获取模型配置(带缓存)"""
        supported_models = ModelConfig.get_supported_models()
        
        if model_id not in supported_models:
            raise ApiException(
                status_code=404,
                code=ErrorCode.MODEL_CONFIG_ERROR,
                message=f"Unsupported model: {model_id}. Supported models: {list(supported_models.keys())}"
            )
        
        config = supported_models[model_id].copy()
        
        # 优先从 Settings(AISettings) 读取 OPENAI 配置,避免 .env 嵌套命名不匹配
        settings = get_settings()
        provider = config.get("provider")
        api_key: Optional[str]
        base_url: str

        if provider == "openai":
            api_key = settings.ai.openai_api_key
            base_url = settings.ai.openai_base_url or config["default_base_url"]
        else:
            # 其他提供商暂保持环境变量读取,兼容已有配置
            api_key = os.getenv(config["api_key_env"])  # type: ignore
            base_url = os.getenv(config["base_url_env"], config["default_base_url"])  # type: ignore

        if not api_key:
            # 不直接抛错,交由调用方决定是否走开发回退
            config.update({
                "api_key": None,
                "base_url": base_url
            })
            return config

        config.update({
            "api_key": api_key,
            "base_url": base_url
        })
        
        return config
    
    @staticmethod
    def clear_cache():
        """清除模型配置缓存"""
        ModelConfig.get_model_config.cache_clear()

class AIService:
    """统一的AI服务接口,支持多模型动态配置"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self._cache: Dict[str, Any] = {}
    
    async def __aenter__(self):
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=120.0)
            connector = aiohttp.TCPConnector(limit=100, limit_per_host=30)
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers={"User-Agent": "StoryAI/1.0"}
            )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            self.session = None
    
    async def run_agent(
        self, 
        prompt: str, 
        model_id: str = "gpt-3.5-turbo",
        parameters: Optional[Dict[str, Any]] = None,
        stream: bool = False
    ) -> str:
        """运行AI代理,统一接口"""
        try:
            # 获取模型配置
            config = ModelConfig.get_model_config(model_id)
            
            # 检查API密钥,如果没有配置则使用开发回退
            if not config.get("api_key"):
                settings = get_settings()
                if getattr(settings.ai, "enable_dev_embeddings", False):
                    logger.warning(f"Using dev fallback for agent with model {model_id} (API key not configured)")
                    return self._generate_dev_agent_response(prompt, model_id)
                else:
                    raise ApiException(
                        status_code=401,
                        code=ErrorCode.INVALID_API_KEY,
                        message=f"API key not configured for model {model_id}. Please set OPENAI_API_KEY or AI__OPENAI_API_KEY environment variable"
                    )
            
            # 根据提供商调用相应的API
            provider = config.get("provider")
            if provider == "openai":
                return await self._call_openai_compatible(config, prompt, parameters, stream)
            elif provider == "anthropic":
                return await self._call_anthropic(config, prompt, parameters, stream)
            else:
                # {{ line ~290-294 logic+clean fix | 来源: adjust ApiException signature to use proper HTTP status and error code }}
                raise ApiException(
                    status_code=400,
                    code=ErrorCode.UNSUPPORTED_MODEL,
                    message=f"Unsupported model provider: {provider}"
                )
                
        # {{ line ~295-305 logic+clean fix | 来源: dev fallback on ApiException when enabled }}
        except ApiException as e:
            settings = get_settings()
            if getattr(settings.ai, "enable_dev_embeddings", False):
                logger.warning(f"API exception, using dev fallback for agent: {str(e)}")
                return self._generate_dev_agent_response(prompt, model_id)
            raise
        except Exception as e:
            logger.error(f"Error running agent with model {model_id}: {str(e)}")
            # 如果是API错误且开发回退已启用,则使用回退
            settings = get_settings()
            if getattr(settings.ai, "enable_dev_embeddings", False):
                logger.warning(f"API error, using dev fallback for agent: {str(e)}")
                return self._generate_dev_agent_response(prompt, model_id)
            else:
                # {{ line ~308-315 logic+clean fix | 来源: fix ApiException signature to avoid 704 status leak }}
                raise ApiException(
                    status_code=500,
                    code=ErrorCode.AI_SERVICE_ERROR,
                    message=f"AI service error: {str(e)}"
                )
    
    async def run_agent_stream(
        self,
        prompt: str,
        model_id: str = "gpt-3.5-turbo",
        parameters: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """流式运行AI代理"""
        try:
            config = ModelConfig.get_model_config(model_id)
            
            # 检查API密钥,如果没有配置则使用开发回退
            if not config.get("api_key"):
                settings = get_settings()
                if getattr(settings.ai, "enable_dev_embeddings", False):
                    logger.warning(f"Using dev fallback for streaming agent with model {model_id} (API key not configured)")
                    async for chunk in self._generate_dev_agent_stream_response(prompt, model_id):
                        yield chunk
                    return
                else:
                    raise ApiException(
                        status_code=401,
                        code=ErrorCode.INVALID_API_KEY,
                        message=f"API key not configured for model {model_id}. Please set OPENAI_API_KEY or AI__OPENAI_API_KEY environment variable"
                    )
            
            provider = config.get("provider")
            
            if provider == "openai":
                async for chunk in self._call_openai_compatible_stream(config, prompt, parameters):
                    yield chunk
            elif provider == "anthropic":
                async for chunk in self._call_anthropic_stream(config, prompt, parameters):
                    yield chunk
            else:
                # {{ line ~330-334 logic+clean fix | 来源: adjust ApiException signature to use proper HTTP status and error code }}
                raise ApiException(
                    status_code=400,
                    code=ErrorCode.UNSUPPORTED_MODEL,
                    message=f"Unsupported model provider for streaming: {provider}"
                )
        # {{ line ~335-345 logic+clean fix | 来源: dev fallback on ApiException when enabled (stream) }}
        except ApiException as e:
            settings = get_settings()
            if getattr(settings.ai, "enable_dev_embeddings", False):
                logger.warning(f"API exception, using dev fallback for streaming agent: {str(e)}")
                async for chunk in self._generate_dev_agent_stream_response(prompt, model_id):
                    yield chunk
                return
            raise
        except Exception as e:
            logger.error(f"Error in streaming agent with model {model_id}: {str(e)}")
            # 如果是API错误且开发回退已启用,则使用回退
            settings = get_settings()
            if getattr(settings.ai, "enable_dev_embeddings", False):
                logger.warning(f"API error, using dev fallback for streaming agent: {str(e)}")
                async for chunk in self._generate_dev_agent_stream_response(prompt, model_id):
                    yield chunk
            else:
                # {{ line ~352-359 logic+clean fix | 来源: fix ApiException signature to avoid 704 status leak (stream) }}
                raise ApiException(
                    status_code=500,
                    code=ErrorCode.AI_SERVICE_ERROR,
                    message=f"AI streaming service error: {str(e)}"
                )

    async def get_embeddings(
        self,
        texts: List[str],
        model_id: str = "text-embedding-3-small"
    ) -> List[List[float]]:
        """Get text embeddings (unified interface, OpenAI-compatible)
        - Returns 1536-dimensional vectors by default (text-embedding-3-small/ada-002)
        - For text-embedding-3-large, returns 3072 dimensions
        - Supports dev fallback with random/hash vectors when API key is not configured
        """
        try:
            config = ModelConfig.get_model_config(model_id)
            dim = config.get("embedding_dimension", 1536)

            # Get settings for dev fallback check
            settings = get_settings()
            
            # Get API key from settings if not in config
            if not config.get("api_key"):
                if getattr(settings.ai, "openai_api_key", None):
                    config["api_key"] = settings.ai.openai_api_key
                else:
                    # Dev fallback: use deterministic hash-based vectors
                    if getattr(settings.ai, "enable_dev_embeddings", False):
                        logger.warning(f"Using dev fallback embeddings for {len(texts)} texts (API key not configured)")
                        return self._generate_dev_embeddings(texts, dim)
                    else:
                        raise ApiException(
                            status_code=401,
                            code=ErrorCode.INVALID_API_KEY,
                            message=f"API key not configured for model {model_id}. Please set OPENAI_API_KEY or AI__OPENAI_API_KEY environment variable"
                        )

            if config.get("provider") != "openai":
                raise ApiException(
                    status_code=400,
                    code=ErrorCode.UNSUPPORTED_MODEL,
                    message=f"Embeddings only supported for OpenAI-compatible models currently: {model_id}"
                )

            if not self.session:
                await self.__aenter__()

            url = f"{config['base_url']}/embeddings"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config['api_key']}"
            }
            payload = {
                "model": config["model_name"],
                "input": texts
            }

            async with self.session.post(url, headers=headers, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    vectors = [item["embedding"] for item in result.get("data", [])]
                    return vectors
                else:
                    error_text = await response.text()
                    # Try dev fallback on API errors if enabled
                    if getattr(settings.ai, "enable_dev_embeddings", False):
                        logger.warning(f"API error, using dev fallback: {response.status} - {error_text}")
                        return self._generate_dev_embeddings(texts, dim)
                    else:
                        raise ApiException(
                            status_code=response.status,
                            code=ErrorCode.AI_API_ERROR,
                            message=f"Embeddings API error: {response.status} - {error_text}"
                        )
        except ApiException:
            raise
        except Exception as e:
            logger.error(f"Error getting embeddings with model {model_id}: {str(e)}")
            settings = get_settings()
            # Try dev fallback on unexpected errors if enabled
            if getattr(settings.ai, "enable_dev_embeddings", False):
                logger.warning(f"Unexpected error, using dev fallback: {str(e)}")
                config = ModelConfig.get_model_config(model_id)
                dim = config.get("embedding_dimension", 1536)
                return self._generate_dev_embeddings(texts, dim)
            else:
                raise ApiException(
                    status_code=500,
                    code=ErrorCode.AI_SERVICE_ERROR,
                    message=f"Embeddings service error: {str(e)}"
                )
    
    def _generate_dev_embeddings(self, texts: List[str], dimension: int = 1536) -> List[List[float]]:
        """Generate deterministic hash-based embeddings for development
        Uses simple hash function to create consistent vectors for the same text
        """
        import hashlib
        import numpy as np
        
        vectors = []
        for text in texts:
            # Create deterministic seed from text hash
            seed = int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**32)
            np.random.seed(seed)
            
            # Generate random vector and normalize
            vec = np.random.randn(dimension)
            vec = vec / np.linalg.norm(vec)  # L2 normalization
            vectors.append(vec.tolist())
        
        return vectors

    def _generate_dev_agent_response(self, prompt: str, model_id: str) -> str:
        """Generate development fallback response for AI agent
        Returns a consistent mock response based on prompt hash
        """
        import hashlib
        import random
        
        # Create deterministic seed from prompt hash
        seed = int(hashlib.md5(prompt.encode()).hexdigest(), 16) % (2**32)
        random.seed(seed)
        
        # Mock responses for different types of prompts
        mock_responses = [
            "这是一个开发模式下的模拟响应.在实际生产环境中,这里会返回真实的AI模型响应.",
            "开发回退模式:您的请求已收到,这是基于提示词生成的模拟回复.",
            "【开发模式】AI代理模拟响应:根据您的输入,这里提供一个示例回复.",
            "当前处于开发模式,API密钥未配置.这是模拟的AI响应内容.",
            "开发环境提示:这是模拟的AI代理回复,用于测试和开发目的."
        ]
        
        # 根据模型ID添加特定信息
        model_specific = f"[{model_id}] " if model_id != "gpt-3.5-turbo" else ""
        
        # 随机选择一个响应(由于种子固定,对相同提示词返回相同响应)
        selected_response = random.choice(mock_responses)
        
        return f"{model_specific}{selected_response}"

    async def _generate_dev_agent_stream_response(self, prompt: str, model_id: str) -> AsyncGenerator[str, None]:
        """Generate development fallback response for streaming AI agent
        Yields consistent mock response chunks based on prompt hash
        """
        import hashlib
        import random
        import asyncio
        
        # Create deterministic seed from prompt hash
        seed = int(hashlib.md5(prompt.encode()).hexdigest(), 16) % (2**32)
        random.seed(seed)
        
        # Mock streaming responses
        streaming_responses = [
            ["这是", "一个", "开发", "模式", "下的", "模拟", "响应."],
            ["开发", "回退", "模式:", "您的", "请求", "已收到."],
            ["【开发模式】", "AI代理", "模拟响应:", "根据", "您的", "输入."],
            ["当前", "处于", "开发模式,", "API密钥", "未配置."],
            ["开发环境", "提示:", "这是", "模拟的", "AI代理", "回复."]
        ]
        
        # 随机选择一个响应序列
        selected_chunks = random.choice(streaming_responses)
        
        # 添加模型前缀
        if model_id != "gpt-3.5-turbo":
            yield f"[{model_id}] "
        
        # 模拟流式输出
        for chunk in selected_chunks:
            yield chunk
            await asyncio.sleep(0.1)  # 模拟延迟

    async def _call_anthropic(
        self, 
        config: Dict[str, Any], 
        prompt: str, 
        parameters: Optional[Dict[str, Any]] = None
    ) -> str:
        """调用Anthropic API"""
        api_key = config["api_key"]
        url = f"{config['base_url']}/messages"
        
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": config["model_name"],
            "max_tokens": parameters.get("max_tokens", 1000) if parameters else 1000,
            "messages": [{"role": "user", "content": prompt}]
        }
        
        if not self.session:
            await self.__aenter__()
        
        async with self.session.post(url, headers=headers, json=payload) as response:
            if response.status == 200:
                result = await response.json()
                return result["content"][0]["text"]
            else:
                error_text = await response.text()
                raise ApiException(
                    ErrorCode.AI_API_ERROR,
                    f"Anthropic API error: {response.status} - {error_text}"
                )
    
    async def _call_openai_compatible(
        self, 
        config: Dict[str, Any], 
        prompt: str, 
        parameters: Optional[Dict[str, Any]] = None,
        stream: bool = False
    ) -> str:
        """调用OpenAI兼容的API(支持OpenAI、Kimi、DeepSeek、Mistral等)"""
        url = f"{config['base_url']}/chat/completions"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config['api_key']}"
        }
        
        # 构建请求payload
        payload = {
            "model": config["model_name"],
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": parameters.get("max_tokens", config.get("max_tokens", 2048)) if parameters else config.get("max_tokens", 2048),
            "temperature": parameters.get("temperature", 0.7) if parameters else 0.7,
            "stream": stream
        }
        
        # 添加其他参数
        if parameters:
            for key, value in parameters.items():
                if key not in ["max_tokens", "temperature"] and value is not None:
                    payload[key] = value
        
        if not self.session:
            await self.__aenter__()
        
        try:
            async with self.session.post(url, headers=headers, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    if "choices" in result and len(result["choices"]) > 0:
                        return result["choices"][0]["message"]["content"]
                    else:
                        raise ApiException(
                            ErrorCode.AI_API_ERROR,
                            f"Invalid response format from {config['model_name']}"
                        )
                else:
                    error_text = await response.text()
                    raise ApiException(
                        ErrorCode.AI_API_ERROR,
                        f"{config['model_name']} API error: {response.status} - {error_text}"
                    )
        except aiohttp.ClientError as e:
            raise ApiException(
                ErrorCode.AI_API_ERROR,
                f"Network error calling {config['model_name']}: {str(e)}"
            )
    
    async def _call_openai_compatible_stream(
        self,
        config: Dict[str, Any],
        prompt: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """OpenAI兼容API的流式调用"""
        url = f"{config['base_url']}/chat/completions"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config['api_key']}"
        }
        
        payload = {
            "model": config["model_name"],
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": parameters.get("max_tokens", config.get("max_tokens", 2048)) if parameters else config.get("max_tokens", 2048),
            "temperature": parameters.get("temperature", 0.7) if parameters else 0.7,
            "stream": True
        }
        
        if not self.session:
            await self.__aenter__()
        
        try:
            async with self.session.post(url, headers=headers, json=payload) as response:
                if response.status == 200:
                    async for line in response.content:
                        line = line.decode('utf-8').strip()
                        if line.startswith('data: '):
                            data = line[6:]
                            if data == '[DONE]':
                                break
                            try:
                                # 使用安全的JSON解析
                                from services.json_repairer import safe_json_loads
                                chunk = safe_json_loads(data, {})
                                if 'choices' in chunk and len(chunk['choices']) > 0:
                                    delta = chunk['choices'][0].get('delta', {})
                                    if 'content' in delta:
                                        yield delta['content']
                            except Exception as e:
                                logger.warning(f"Failed to parse JSON chunk: {e}")
                                continue
                else:
                    error_text = await response.text()
                    raise ApiException(
                        ErrorCode.AI_API_ERROR,
                        f"{config['model_name']} streaming API error: {response.status} - {error_text}"
                    )
        except aiohttp.ClientError as e:
            raise ApiException(
                ErrorCode.AI_API_ERROR,
                f"Network error in streaming call to {config['model_name']}: {str(e)}"
            )
    
    async def _call_anthropic_stream(
        self,
        config: Dict[str, Any],
        prompt: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """Anthropic API的流式调用"""
        api_key = config["api_key"]
        url = f"{config['base_url']}/messages"
        
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": config["model_name"],
            "max_tokens": parameters.get("max_tokens", config.get("max_tokens", 2048)) if parameters else config.get("max_tokens", 2048),
            "messages": [{"role": "user", "content": prompt}],
            "stream": True
        }
        
        if not self.session:
            await self.__aenter__()
        
        try:
            async with self.session.post(url, headers=headers, json=payload) as response:
                if response.status == 200:
                    async for line in response.content:
                        line = line.decode('utf-8').strip()
                        if line.startswith('data: '):
                            data = line[6:]
                            if data == '[DONE]':
                                break
                            try:
                                # 使用安全的JSON解析
                                from services.json_repairer import safe_json_loads
                                chunk = safe_json_loads(data, {})
                                if 'type' in chunk and chunk['type'] == 'content_block_delta':
                                    if 'delta' in chunk and 'text' in chunk['delta']:
                                        yield chunk['delta']['text']
                            except Exception as e:
                                logger.warning(f"Failed to parse JSON chunk: {e}")
                                continue
                else:
                    error_text = await response.text()
                    raise ApiException(
                        ErrorCode.AI_API_ERROR,
                        f"{config['model_name']} streaming API error: {response.status} - {error_text}"
                    )
        except aiohttp.ClientError as e:
            raise ApiException(
                ErrorCode.AI_API_ERROR,
                f"Network error in streaming call to {config['model_name']}: {str(e)}"
            )

    async def get_available_models(self) -> List[Dict[str, Any]]:
        """获取可用的模型列表"""
        models = []
        supported_models = ModelConfig.get_supported_models()
        
        for model_id, config in supported_models.items():
            # 检查API密钥是否配置
            api_key = os.getenv(config["api_key_env"])
            is_available = bool(api_key and api_key != "PLACEHOLDER_API_KEY")
            
            models.append({
                "id": model_id,
                "name": config["model_name"],
                "provider": config["provider"],
                "available": is_available,
                "supports_streaming": config.get("supports_streaming", False),
                "max_tokens": config.get("max_tokens", 2048),
                "description": f"{config['provider'].title()} - {config['model_name']}"
            })
        
        return models
    
    async def test_model_connection(self, model_id: str) -> Dict[str, Any]:
        """测试模型连接"""
        try:
            config = ModelConfig.get_model_config(model_id)
            
            # 发送测试请求
            test_prompt = "Hello, this is a test message. Please respond with 'Test successful'."
            start_time = datetime.now()
            result = await self.run_agent(test_prompt, model_id)
            end_time = datetime.now()
            
            response_time = (end_time - start_time).total_seconds()
            
            return {
                "success": True,
                "model_id": model_id,
                "provider": config["provider"],
                "response_length": len(result),
                "response_time": response_time,
                "response_preview": result[:100] + "..." if len(result) > 100 else result,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "model_id": model_id,
                "timestamp": datetime.now().isoformat()
            }

# 全局AI服务实例管理
_ai_service = None

async def get_ai_service() -> AIService:
    """获取AI服务实例"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
        await _ai_service.__aenter__()
    return _ai_service

async def cleanup_ai_service():
    """清理AI服务实例"""
    global _ai_service
    if _ai_service:
        await _ai_service.__aexit__(None, None, None)
        _ai_service = None
