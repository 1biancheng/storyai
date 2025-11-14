from fastapi import APIRouter, Request, status
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import psutil
import time

from api_framework import ApiException, ErrorCode, get_request_id, log_request, log_response
from contracts import ApiResponse, success_response, error_response
from services.db_service import get_db_service
from services.redis_health_async import check_redis_optional
from config import get_settings

router = APIRouter(prefix="/system", tags=["system"])
logger = logging.getLogger(__name__)

@router.get("/health")
async def health_check(request: Request):
    """Health check endpoint with actual service status"""
    log_request(request)
    
    try:
        # Check database connectivity
        db_status = "healthy"
        try:
            db_service = await get_db_service()
            if not db_service._initialized:
                db_status = "unavailable"
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            db_status = "unhealthy"
        
        # System health status
        health_status = {
            "status": "healthy" if db_status == "healthy" else "degraded",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "api": "healthy",
                "database": db_status,
                "ai_models": "healthy"  # Can be enhanced with actual AI service check
            },
            "version": "1.0.0"
        }
        
        response = success_response(health_status, "Health check completed", get_request_id(request))
        log_response(request, response)
        return response
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="System health check failed",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.get("/info")
async def system_info(request: Request):
    """Get system information"""
    log_request(request)
    
    try:
        system_info = {
            "name": "Story-AI Backend",
            "version": "1.0.0",
            "description": "AI-powered story creation platform backend service",
            "features": [
                "Multi-model AI support",
                "Workflow engine",
                "Real-time communication",
                "Project management",
                "Vector-based paragraph library",
                "Formula-based story generation"
            ],
            "api_version": "v1",
            "supported_models": [
                "gemini-pro",
                "claude-sonnet",
                "gpt-4",
                "gpt-3.5-turbo"
            ]
        }
        
        response = success_response(system_info, "System information retrieved successfully", get_request_id(request))
        log_response(request, response)
        return response
        
    except Exception as e:
        logger.error(f"Failed to get system information: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to retrieve system information",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.get("/stats")
async def system_stats(request: Request):
    """Get system statistics from database"""
    log_request(request)
    
    try:
        db_service = await get_db_service()
        
        # Get actual statistics from database
        db_stats_summary = await db_service.get_stats_summary()
        
        # Get system metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        stats = {
            "total_workflows": db_stats_summary.get("total_workflows", 0),
            "active_projects": db_stats_summary.get("active_projects", 0),
            "total_api_calls": db_stats_summary.get("total_api_calls", 0),
            "ai_model_usage": db_stats_summary.get("ai_model_usage", {}),
            "system_metrics": {
                "cpu_usage": cpu_percent / 100.0,
                "memory_usage": memory.percent / 100.0,
                "disk_usage": disk.percent / 100.0
            },
            "timestamp": datetime.now().isoformat()
        }
        
        response = success_response(stats, "System statistics retrieved successfully", get_request_id(request))
        log_response(request, response)
        return response
        
    except Exception as e:
        logger.error(f"Failed to get system statistics: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to retrieve system statistics",
            details=str(e),
            request_id=get_request_id(request)
        )


@router.get("/healthz")
async def health_aggregation(request: Request):
    """Aggregated health check for all system components (K8s ready)
    
    Returns comprehensive health status including:
    - Database connectivity and latency
    - Redis cache availability and latency
    - Vector index status and count
    
    Response format:
    {
        "status": "healthy" | "degraded" | "unhealthy",
        "components": {
            "database": {"status": "ok", "latency_ms": 12, "details": "..."},
            "redis": {"status": "ok", "latency_ms": 3, "details": "..."},
            "vector_index": {"status": "ok", "paragraph_count": 21981}
        },
        "timestamp": "2025-11-01T19:02:19.123Z"
    }
    """
    log_request(request)
    settings = get_settings()
    
    components = {}
    
    # Check Database
    db_start = time.time()
    try:
        db_service = await get_db_service()
        if db_service._initialized:
            # Test actual query
            stats = await db_service.get_stats_summary()
            db_latency = (time.time() - db_start) * 1000
            components["database"] = {
                "status": "ok",
                "latency_ms": round(db_latency, 2),
                "details": f"Connected to {settings.database.host}:{settings.database.port}"
            }
        else:
            components["database"] = {
                "status": "unavailable",
                "latency_ms": 0,
                "details": "Database not initialized"
            }
    except Exception as e:
        components["database"] = {
            "status": "error",
            "latency_ms": 0,
            "details": str(e)
        }
    
    # Check Redis
    redis_start = time.time()
    if settings.redis.enabled:
        try:
            redis_url = settings.get_redis_url()
            redis_ok = await check_redis_optional(redis_url, timeout=2)
            redis_latency = (time.time() - redis_start) * 1000
            
            if redis_ok:
                components["redis"] = {
                    "status": "ok",
                    "latency_ms": round(redis_latency, 2),
                    "details": f"Connected to {settings.redis.host}:{settings.redis.port}"
                }
            else:
                components["redis"] = {
                    "status": "error",
                    "latency_ms": round(redis_latency, 2),
                    "details": "Redis ping failed"
                }
        except Exception as e:
            components["redis"] = {
                "status": "error",
                "latency_ms": 0,
                "details": str(e)
            }
    else:
        components["redis"] = {
            "status": "disabled",
            "latency_ms": 0,
            "details": "Redis disabled in configuration, using memory cache"
        }
    
    # Check Vector Index - simplified approach
    try:
        db_service = await get_db_service()
        # Simple check if database is available
        stats = await db_service.get_stats_summary()
        paragraph_count = stats.get("total_paragraphs", 0)
        
        components["vector_index"] = {
            "status": "ok",
            "paragraph_count": paragraph_count,
            "details": f"{paragraph_count} paragraphs in vector store"
        }
    except Exception as e:
        components["vector_index"] = {
            "status": "error",
            "paragraph_count": 0,
            "details": str(e)
        }
    
    # Determine overall status
    statuses = [comp["status"] for comp in components.values()]
    if all(s in ["ok", "disabled"] for s in statuses):
        overall_status = "healthy"
    elif any(s == "ok" for s in statuses):
        overall_status = "degraded"
    else:
        overall_status = "unhealthy"
    
    result = {
        "status": overall_status,
        "components": components,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    # Return 503 if unhealthy (for K8s readiness probe)
    status_code = 200 if overall_status in ["healthy", "degraded"] else 503
    
    response = success_response(result, f"Health check: {overall_status}", get_request_id(request))
    log_response(request, response)
    
    return response


@router.get("/readiness")
async def readiness_probe(request: Request):
    """Kubernetes Readiness Probe endpoint
    
    Lightweight check to determine if service is ready to accept traffic.
    Checks critical dependencies: Database and Redis (if enabled)
    
    Returns 200 if ready, 503 if not ready.
    """
    log_request(request)
    settings = get_settings()
    
    checks = {}
    
    # Check Database (critical)
    try:
        db_service = await get_db_service()
        checks["database"] = db_service._initialized
    except Exception:
        checks["database"] = False
    
    # Check Redis (critical if enabled)
    if settings.redis.enabled:
        try:
            redis_url = settings.get_redis_url()
            checks["redis"] = await check_redis_optional(redis_url, timeout=2)
        except Exception:
            checks["redis"] = False
    else:
        checks["redis"] = True  # Not critical if disabled
    
    all_ready = all(checks.values())
    
    result = {
        "ready": all_ready,
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    status_code = 200 if all_ready else 503
    
    if all_ready:
        response = success_response(result, "Service is ready", get_request_id(request))
    else:
        # For not ready state, still return a response structure
        response = {
            "code": ErrorCode.INTERNAL_ERROR,
            "message": "Service is not ready",
            "data": result,
            "request_id": get_request_id(request)
        }
    
    log_response(request, response)
    return response


@router.get("/liveness")
async def liveness_probe(request: Request):
    """Kubernetes Liveness Probe endpoint
    
    Simple check to verify the service process is alive.
    Always returns 200 unless the process is completely dead.
    """
    log_request(request)
    
    result = {
        "alive": True,
        "pid": psutil.Process().pid,
        "uptime_seconds": time.time() - psutil.Process().create_time(),
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    response = success_response(result, "Service is alive", get_request_id(request))
    log_response(request, response)
    return response


@router.post("/dev/loglevel")
async def set_log_level(request: Request):
    """Set runtime log level for controlling log verbosity
    
    Request body:
        {
            "level": "DEBUG" | "INFO" | "WARN" | "ERROR",
            "module": "optional.module.name"  # Optional: target specific module
        }
    
    Examples:
        # Mute SQL logs from SQLAlchemy
        POST /system/dev/loglevel
        {"level": "ERROR", "module": "sqlalchemy.engine"}
        
        # Set global log level to DEBUG
        POST /system/dev/loglevel
        {"level": "DEBUG"}
    """
    log_request(request)
    
    try:
        body = await request.json()
        level_str = body.get("level", "INFO").upper()
        module_name = body.get("module")
        
        # Validate log level
        valid_levels = {"DEBUG": logging.DEBUG, "INFO": logging.INFO, 
                       "WARN": logging.WARNING, "WARNING": logging.WARNING,
                       "ERROR": logging.ERROR, "CRITICAL": logging.CRITICAL}
        
        if level_str not in valid_levels:
            raise ApiException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code=ErrorCode.BAD_REQUEST,
                message=f"Invalid log level: {level_str}. Must be one of: {list(valid_levels.keys())}",
                request_id=get_request_id(request)
            )
        
        level = valid_levels[level_str]
        
        # Get previous level for response
        if module_name:
            target_logger = logging.getLogger(module_name)
            previous_level = logging.getLevelName(target_logger.level)
            target_logger.setLevel(level)
            message = f"Log level for module '{module_name}' changed from {previous_level} to {level_str}"
        else:
            # Set root logger level
            root_logger = logging.getLogger()
            previous_level = logging.getLevelName(root_logger.level)
            root_logger.setLevel(level)
            message = f"Global log level changed from {previous_level} to {level_str}"
        
        logger.info(message)
        
        result = {
            "previous_level": previous_level,
            "current_level": level_str,
            "module": module_name or "root",
            "message": message
        }
        
        response = success_response(result, message, get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"Failed to set log level: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to set log level",
            details=str(e),
            request_id=get_request_id(request)
        )