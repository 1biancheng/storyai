"""
Redis Health Check Service
Ensures Redis connection is available during application startup
"""
import logging
from typing import Optional

logger = logging.getLogger("services.redis_health")

# Check if redis is available
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("redis.asyncio not available, Redis health check will be skipped")


async def check_redis_or_raise(redis_url: str, timeout: int = 5) -> bool:
    """
    Startup health check for Redis connection.
    Retries 3 times with 1 second delay between attempts.
    
    Args:
        redis_url: Redis connection URL (e.g., redis://localhost:6379/0)
        timeout: Connection timeout in seconds
        
    Returns:
        True if Redis is available
        
    Raises:
        RuntimeError: If Redis is unavailable after retries
    """
    if not REDIS_AVAILABLE:
        logger.warning("Redis client library not installed, skipping health check")
        return False
    
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(1, max_retries + 1):
        redis_client: Optional[aioredis.Redis] = None  # type: ignore
        try:
            logger.info(f"Redis health check attempt {attempt}/{max_retries}...")
            redis_client = await aioredis.from_url(  # type: ignore
                redis_url,
                decode_responses=True,
                socket_connect_timeout=timeout,
                socket_timeout=timeout
            )
            
            pong = await redis_client.ping()
            if not pong:
                raise RuntimeError("Redis ping returned False")
            
            logger.info(f"✅ Redis health check passed (attempt {attempt})")
            await redis_client.close()
            return True
            
        except Exception as e:
            logger.error(f"❌ Redis health check failed (attempt {attempt}/{max_retries}): {e}")
            
            if redis_client:
                try:
                    await redis_client.close()
                except Exception:
                    pass
            
            if attempt < max_retries:
                logger.info(f"Retrying in {retry_delay} second(s)...")
                import asyncio
                await asyncio.sleep(retry_delay)
            else:
                logger.error("Redis is unavailable after all retry attempts")
                raise RuntimeError(
                    f"Redis connection failed: {e}\n"
                    f"Please ensure Redis is running on {redis_url}\n"
                    f"Run setup-redis.bat or set REDIS__ENABLED=false in .env"
                )
    
    return False


async def check_redis_optional(redis_url: str, timeout: int = 5) -> bool:
    """
    Optional Redis health check that doesn't raise on failure.
    Logs warning if Redis is unavailable but allows service to continue.
    
    Returns:
        True if Redis is available, False otherwise
    """
    try:
        return await check_redis_or_raise(redis_url, timeout)
    except Exception as e:
        logger.warning(f"Redis optional check failed: {e}")
        logger.warning("Service will continue with memory-only cache")
        return False
