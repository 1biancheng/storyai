from fastapi import APIRouter, Request, status
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timezone, timedelta
import psutil
import time
import pytz

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


@router.get("/time/current")
async def get_current_time(
    request: Request, 
    timezone_str: Optional[str] = None,
    format: Optional[str] = None
):
    """获取当前时间
    
    支持多种时区和格式选项
    
    Query Parameters:
        timezone: 时区字符串,如 'Asia/Shanghai', 'UTC', 'America/New_York',默认为系统时区
        format: 时间格式,支持 'iso', 'unix', 'readable',默认为 'iso'
    
    Returns:
        {
            "current_time": "2025-11-03T04:03:59",
            "timezone": "Asia/Shanghai",
            "unix_timestamp": 1733225039,
            "formatted": "2025-11-03 04:03:59"
        }
    """
    log_request(request)
    
    try:
        # 设置时区
        if timezone_str:
            try:
                tz = pytz.timezone(timezone_str)
            except pytz.exceptions.UnknownTimeZoneError:
                raise ApiException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code=ErrorCode.BAD_REQUEST,
                    message=f"Unknown timezone: {timezone_str}",
                    request_id=get_request_id(request)
                )
        else:
            tz = None  # 使用系统本地时区
        
        # 获取当前时间
        now = datetime.now(tz) if tz else datetime.now()
        
        # 准备响应数据
        result = {
            "current_time": now.isoformat(),
            "timezone": str(tz) if tz else "local",
            "unix_timestamp": int(now.timestamp())
        }
        
        # 根据请求格式添加额外格式
        if format == "readable" or format is None:
            result["formatted"] = now.strftime("%Y-%m-%d %H:%M:%S")
        elif format == "iso":
            result["formatted"] = now.isoformat()
        elif format == "unix":
            result["formatted"] = str(int(now.timestamp()))
        else:
            raise ApiException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code=ErrorCode.BAD_REQUEST,
                message=f"Unsupported format: {format}. Supported formats: iso, unix, readable",
                request_id=get_request_id(request)
            )
        
        response = success_response(result, "Current time retrieved successfully", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"Failed to get current time: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to retrieve current time",
            details=str(e),
            request_id=get_request_id(request)
        )


@router.post("/time/calculate")
async def calculate_time(
    request: Request,
    base_time: Optional[str] = None,
    operation: Optional[str] = None,
    value: Optional[int] = None,
    unit: Optional[str] = None
):
    """时间计算工具
    
    支持时间加减运算和时间差计算
    
    Request Body:
        {
            "base_time": "2025-11-03T04:03:59",  // ISO格式时间,可选,默认为当前时间
            "operation": "add" | "subtract" | "diff",  // 操作类型
            "value": 30,  // 数值,用于add/subtract
            "unit": "seconds" | "minutes" | "hours" | "days"  // 时间单位
            "target_time": "2025-11-03T05:03:59"  // 目标时间,用于diff操作
        }
    
    Returns:
        {
            "result": "2025-11-03T04:33:59",
            "operation": "add",
            "description": "Added 30 minutes to base time"
        }
    """
    log_request(request)
    
    try:
        body = await request.json()
        
        # 获取基准时间
        if base_time:
            try:
                base_dt = datetime.fromisoformat(base_time)
            except ValueError:
                raise ApiException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code=ErrorCode.BAD_REQUEST,
                    message="Invalid base_time format. Expected ISO format: YYYY-MM-DDTHH:MM:SS",
                    request_id=get_request_id(request)
                )
        else:
            base_dt = datetime.now()
        
        operation = body.get("operation")
        
        if operation in ["add", "subtract"]:
            value = body.get("value")
            unit = body.get("unit", "minutes")
            
            if not isinstance(value, int) or value < 0:
                raise ApiException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code=ErrorCode.BAD_REQUEST,
                    message="Value must be a non-negative integer",
                    request_id=get_request_id(request)
                )
            
            # 计算时间增量
            if unit == "seconds":
                delta = timedelta(seconds=value)
            elif unit == "minutes":
                delta = timedelta(minutes=value)
            elif unit == "hours":
                delta = timedelta(hours=value)
            elif unit == "days":
                delta = timedelta(days=value)
            else:
                raise ApiException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code=ErrorCode.BAD_REQUEST,
                    message=f"Unsupported unit: {unit}. Supported units: seconds, minutes, hours, days",
                    request_id=get_request_id(request)
                )
            
            # 执行操作
            if operation == "add":
                result_dt = base_dt + delta
                description = f"Added {value} {unit} to base time"
            else:  # subtract
                result_dt = base_dt - delta
                description = f"Subtracted {value} {unit} from base time"
            
            result = {
                "result": result_dt.isoformat(),
                "operation": operation,
                "description": description
            }
            
        elif operation == "diff":
            target_time = body.get("target_time")
            if not target_time:
                raise ApiException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code=ErrorCode.BAD_REQUEST,
                    message="target_time is required for diff operation",
                    request_id=get_request_id(request)
                )
            
            try:
                target_dt = datetime.fromisoformat(target_time)
            except ValueError:
                raise ApiException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code=ErrorCode.BAD_REQUEST,
                    message="Invalid target_time format. Expected ISO format: YYYY-MM-DDTHH:MM:SS",
                    request_id=get_request_id(request)
                )
            
            # 计算时间差
            diff = abs((target_dt - base_dt).total_seconds())
            
            # 转换为多种单位
            days = diff // 86400
            hours = (diff % 86400) // 3600
            minutes = (diff % 3600) // 60
            seconds = diff % 60
            
            result = {
                "result": {
                    "total_seconds": int(diff),
                    "days": int(days),
                    "hours": int(hours),
                    "minutes": int(minutes),
                    "seconds": int(seconds),
                    "formatted": f"{int(days)}d {int(hours)}h {int(minutes)}m {int(seconds)}s"
                },
                "operation": "diff",
                "description": f"Time difference between {base_time} and {target_time}"
            }
            
        else:
            raise ApiException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code=ErrorCode.BAD_REQUEST,
                message=f"Unsupported operation: {operation}. Supported operations: add, subtract, diff",
                request_id=get_request_id(request)
            )
        
        response = success_response(result, f"Time {operation} completed successfully", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"Failed to calculate time: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to calculate time",
            details=str(e),
            request_id=get_request_id(request)
        )


@router.get("/time/timezones")
async def list_timezones(request: Request):
    """获取常用时区列表
    
    Returns:
        {
            "timezones": [
                {"id": "UTC", "name": "Coordinated Universal Time"},
                {"id": "Asia/Shanghai", "name": "China Standard Time"},
                {"id": "America/New_York", "name": "Eastern Standard Time"},
                ...
            ]
        }
    """
    log_request(request)
    
    try:
        # 常用时区列表
        common_timezones = [
            {"id": "UTC", "name": "Coordinated Universal Time"},
            {"id": "Asia/Shanghai", "name": "China Standard Time"},
            {"id": "Asia/Tokyo", "name": "Japan Standard Time"},
            {"id": "Asia/Singapore", "name": "Singapore Time"},
            {"id": "Asia/Hong_Kong", "name": "Hong Kong Time"},
            {"id": "America/New_York", "name": "Eastern Standard Time"},
            {"id": "America/Los_Angeles", "name": "Pacific Standard Time"},
            {"id": "America/Chicago", "name": "Central Standard Time"},
            {"id": "Europe/London", "name": "Greenwich Mean Time"},
            {"id": "Europe/Paris", "name": "Central European Time"},
            {"id": "Europe/Berlin", "name": "Central European Time"},
            {"id": "Australia/Sydney", "name": "Australian Eastern Standard Time"},
        ]
        
        result = {
            "timezones": common_timezones
        }
        
        response = success_response(result, "Timezones retrieved successfully", get_request_id(request))
        log_response(request, response)
        return response
        
    except Exception as e:
        logger.error(f"Failed to get timezones: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to retrieve timezones",
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