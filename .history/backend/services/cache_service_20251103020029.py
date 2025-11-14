"""Simplified cache service - Redis only with in-memory fallback
Removed: MemoryCache class, HybridCache L1 layer, lru_cache decorators
Kept: RedisCache with automatic fallback to dict-based cache when Redis unavailable
"""

import json
import logging
from typing import Any, Optional, Dict
import os

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logging.warning("redis.asyncio not available, will use in-memory fallback")

from config import get_settings

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis cache implementation with automatic in-memory fallback
    
    Fallback Strategy:
    - When REDIS__ENABLED=false or Redis connection fails, automatically falls back to dict-based cache
    - Fallback cache is only valid within a single request lifecycle, cleared on service restart
    - Production environment requires Redis, development environment allows fallback
    """
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False
        self._fallback_cache: Dict[str, str] = {}  # Simple dict for fallback
        self._using_fallback = False
        
    async def _ensure_connection(self) -> bool:
        """Ensure Redis connection with fallback detection"""
        settings = get_settings()
        
        # Check if Redis is enabled
        if not settings.redis.enabled:
            if not self._using_fallback:
                logger.info("Redis disabled in config, using in-memory fallback cache (not persistent)")
                self._using_fallback = True
            return False
        
        if not REDIS_AVAILABLE:
            if not self._using_fallback:
                logger.warning("Redis unavailable, using in-memory fallback cache (not persistent)")
                self._using_fallback = True
            return False
        
        # Try to connect to Redis
        if self._connected and self._redis:
            try:
                await self._redis.ping()
                return True
            except Exception:
                self._connected = False
        
        try:
            self._redis = await aioredis.from_url(
                self.redis_url,
                encoding='utf-8',
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            await self._redis.ping()
            self._connected = True
            self._using_fallback = False
            logger.info("Redis connection established")
            return True
        except Exception as e:
            if not self._using_fallback:
                logger.error(f"Failed to connect to Redis: {e}, using in-memory fallback")
                self._using_fallback = True
            self._connected = False
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        """Get cache value with fallback support"""
        if await self._ensure_connection():
            try:
                value = await self._redis.get(key)
                if value:
                    # 使用安全的JSON解析
                    from services.json_repairer import safe_json_loads
                    return safe_json_loads(value)
            except Exception as e:
                logger.error(f"Redis get error: {e}, trying fallback")
                self._using_fallback = True
        
        # Fallback to in-memory dict
        if self._using_fallback:
            value = self._fallback_cache.get(key)
            if value:
                # 使用安全的JSON解析
                from services.json_repairer import safe_json_loads
                return safe_json_loads(value)
        
        return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set cache value with fallback support"""
        serialized_value = json.dumps(value, ensure_ascii=False)
        
        if await self._ensure_connection():
            try:
                if ttl:
                    await self._redis.setex(key, ttl, serialized_value)
                else:
                    await self._redis.set(key, serialized_value)
                return True
            except Exception as e:
                logger.error(f"Redis set error: {e}, using fallback")
                self._using_fallback = True
        
        # Fallback to in-memory dict (ignoring TTL in fallback mode)
        if self._using_fallback:
            self._fallback_cache[key] = serialized_value
            return True
        
        return False
    
    async def delete(self, key: str) -> bool:
        """Delete cache item with fallback support"""
        if await self._ensure_connection():
            try:
                result = await self._redis.delete(key)
                return result > 0
            except Exception as e:
                logger.error(f"Redis delete error: {e}")
                self._using_fallback = True
        
        # Fallback
        if self._using_fallback and key in self._fallback_cache:
            del self._fallback_cache[key]
            return True
        
        return False
    
    async def clear(self, pattern: str = "*") -> int:
        """Clear cache (supports pattern matching)"""
        if await self._ensure_connection():
            try:
                keys = await self._redis.keys(pattern)
                if keys:
                    return await self._redis.delete(*keys)
                return 0
            except Exception as e:
                logger.error(f"Redis clear error: {e}")
        
        # Fallback: clear all (pattern matching not supported in dict)
        if self._using_fallback:
            count = len(self._fallback_cache)
            self._fallback_cache.clear()
            return count
        
        return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if await self._ensure_connection():
            try:
                return await self._redis.exists(key) > 0
            except Exception as e:
                logger.error(f"Redis exists error: {e}")
        
        # Fallback
        if self._using_fallback:
            return key in self._fallback_cache
        
        return False
    
    async def ttl(self, key: str) -> int:
        """Get TTL of key"""
        if await self._ensure_connection():
            try:
                return await self._redis.ttl(key)
            except Exception as e:
                logger.error(f"Redis ttl error: {e}")
        
        # Fallback: TTL not supported in dict mode
        return -1
    
    async def hgetall(self, key: str) -> Dict[str, str]:
        """Get all fields in hash (for metadata storage)"""
        if await self._ensure_connection():
            try:
                return await self._redis.hgetall(key)
            except Exception as e:
                logger.error(f"Redis hgetall error: {e}")
                self._using_fallback = True
        
        # Fallback: simulate hash with nested dict
        if self._using_fallback:
            value = self._fallback_cache.get(key)
            if value:
                try:
                    return json.loads(value)
                except:
                    pass
        
        return {}
    
    async def hmset(self, key: str, mapping: Dict[str, Any]) -> bool:
        """Set multiple hash fields (for metadata storage)"""
        if await self._ensure_connection():
            try:
                await self._redis.hset(key, mapping=mapping)
                return True
            except Exception as e:
                logger.error(f"Redis hmset error: {e}")
                self._using_fallback = True
        
        # Fallback: store as JSON
        if self._using_fallback:
            self._fallback_cache[key] = json.dumps(mapping, ensure_ascii=False)
            return True
        
        return False
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Set key expiration"""
        if await self._ensure_connection():
            try:
                return await self._redis.expire(key, seconds)
            except Exception as e:
                logger.error(f"Redis expire error: {e}")
        
        # Fallback: expiration not supported in dict mode
        return False
    
    async def close(self):
        """Close Redis connection"""
        if self._redis:
            await self._redis.close()
            self._connected = False


# Global Redis cache instance (singleton)
_redis_cache: Optional[RedisCache] = None


async def get_redis_cache() -> RedisCache:
    """Get Redis cache instance (singleton pattern)"""
    global _redis_cache
    if _redis_cache is None:
        _redis_cache = RedisCache()
    return _redis_cache


async def get_cache() -> RedisCache:
    """Get cache instance (recommended, alias for get_redis_cache)"""
    return await get_redis_cache()


# Helper functions for file paragraph caching (dual-key pattern)
async def cache_file_paragraphs(file_md5: str, paragraphs: list, metadata: dict) -> bool:
    """Cache file paragraphs using dual-key pattern
    
    Keys:
    - file:{md5}:paragraphs -> JSON array of paragraphs
    - file:{md5}:metadata -> Hash with metadata fields
    """
    redis = await get_redis_cache()
    ttl = 7 * 24 * 3600  # 7 days
    
    try:
        # Cache paragraphs as JSON array
        await redis.set(f"file:{file_md5}:paragraphs", paragraphs, ttl=ttl)
        
        # Cache metadata as hash
        await redis.hmset(f"file:{file_md5}:metadata", metadata)
        await redis.expire(f"file:{file_md5}:metadata", ttl)
        
        return True
    except Exception as e:
        logger.error(f"Failed to cache file paragraphs: {e}")
        return False


async def get_file_paragraphs(file_md5: str) -> Optional[Dict]:
    """Get cached file paragraphs using dual-key pattern
    
    Returns:
    {
        "paragraphs": List[Dict],
        "metadata": Dict[str, str]
    }
    """
    redis = await get_redis_cache()
    
    try:
        paragraphs = await redis.get(f"file:{file_md5}:paragraphs")
        metadata = await redis.hgetall(f"file:{file_md5}:metadata")
        
        if paragraphs and metadata:
            return {
                "paragraphs": paragraphs,
                "metadata": metadata
            }
    except Exception as e:
        logger.error(f"Failed to get file paragraphs: {e}")
    
    return None


async def clear_file_cache(file_md5: str) -> int:
    """Clear all cache for a specific file"""
    redis = await get_redis_cache()
    
    try:
        count = await redis.delete(
            f"file:{file_md5}:paragraphs",
            f"file:{file_md5}:metadata"
        )
        return count
    except Exception as e:
        logger.error(f"Failed to clear file cache: {e}")
        return 0


# Utility function for model name slugification (avoid special chars in Redis keys)
def slugify_model_name(model_name: str) -> str:
    """Slugify model name to avoid special characters in Redis keys
    
    Examples:
    - "text-embedding-3-small" -> "text-embedding-3-small" (no change)
    - "models/text-embedding:v1" -> "models_text-embedding_v1"
    """
    return model_name.replace('/', '_').replace(':', '_').replace(' ', '_')


# 从cache_service_old_backup.py迁移的函数
from functools import lru_cache

@lru_cache(maxsize=128)
def get_model_config_cached(model_id: str) -> dict:
    """缓存的模型配置获取"""
    from services.ai_service import ModelConfig
    return ModelConfig.get_model_config(model_id)

def clear_model_config_cache():
    """清空模型配置缓存"""
    get_model_config_cached.cache_clear()

# 缓存统计信息
async def get_cache_stats() -> dict:
    """获取缓存统计信息"""
    from services.cache_service import _redis_cache
    import asyncio
    
    stats = {
        "l1_cache": {
            "size": 0,  # 需要实现实际的缓存大小统计
            "max_size": 1000,
            "keys": []
        },
        "redis_available": True,  # 需要检查实际的Redis可用性
        "redis_connected": False
    }
    
    # Redis统计
    if _redis_cache:
        try:
            stats["redis_connected"] = await _redis_cache._ensure_connection()
        except Exception:
            pass
    
    return stats
