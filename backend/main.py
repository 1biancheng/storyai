import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any

# 导入配置
from config import get_settings

# Import routers
from routers import ai, db
from routers import story, workflows, sse, books, chapters
from routers import models, projects, system, tools, workspace

# 导入服务
from services.ai_service import cleanup_ai_service
from services.db_service import init_db
from services.cache_service import get_cache
from services.redis_health_async import check_redis_or_raise, check_redis_optional

# 获取配置
settings = get_settings()

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用程序生命周期管理"""
    logger.info("Starting StoryAI backend server...")
    
    # Redis健康检查(如果启用)
    if settings.redis.enabled:
        redis_url = settings.get_redis_url()
        logger.info(f"Redis enabled, checking connection to {redis_url}...")
        try:
            # 使用强制检查:Redis启用时必须可用
            await check_redis_or_raise(redis_url, timeout=5)
            logger.info("✅ Redis connection verified")
        except Exception as e:
            logger.error(f"❌ Redis health check failed: {e}")
            logger.error("Service startup aborted due to Redis connection failure")
            raise  # 阻止服务启动
    else:
        logger.info("Redis disabled in configuration, using memory-only cache")
    
    # 初始化缓存服务
    cache = await get_cache()
    # HybridCache没有initialize方法,直接使用即可
    
    # 如果数据库可用,初始化数据库
    if settings.database.enabled:
        try:
            await init_db()
            logger.info("数据库初始化完成")
            
            # 初始化项目同步服务并执行同步
            try:
                from services.project_sync_service import ProjectSyncService
                from services.db_service import DatabaseService, get_db_service
                
                # 确保项目目录存在
                projects_dir = settings.workspace_dir / "projects"
                projects_dir.mkdir(parents=True, exist_ok=True)
                
                # 创建同步服务并执行同步(仅文件系统→数据库单向同步)
                db_svc = await get_db_service()
                sync_service = ProjectSyncService(db_svc, str(projects_dir))
                sync_stats = await sync_service.sync_from_filesystem()
                
                logger.info(f"✅ 项目数据同步完成: 新增{sync_stats['added']}, 更新{sync_stats['updated']}, 跳过{sync_stats['skipped']}")
                    
            except Exception as e:
                logger.warning(f"项目同步服务初始化失败: {e}")
                
        except Exception as e:
            logger.warning(f"数据库初始化失败: {e}")
    

    
    yield
    
    logger.info("Shutting down StoryAI backend server...")
    await cleanup_ai_service()

# 创建FastAPI应用
app = FastAPI(
    title="StoryAI Backend",
    description="统一的AI服务后端,支持多模型动态配置",
    version="1.0.0",
    debug=settings.debug,
    lifespan=lifespan
)

# CORS配置 - 使用正则表达式匹配 localhost 和 127.0.0.1 的所有端口
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=settings.cors.allow_credentials,
    allow_methods=settings.cors.allow_methods,
    allow_headers=settings.cors.allow_headers,
)

# 添加中间件禁用浏览器缓存
@app.middleware("http")
async def disable_browser_cache(request, call_next):
    """禁用浏览器端缓存,所有数据通过服务端Redis缓存"""
    response = await call_next(request)
    # 添加禁用缓存的HTTP头
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Register routers
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(db.router, prefix="/api/db", tags=["Database"])
app.include_router(books.router, prefix="/api/v1", tags=["Books"])
app.include_router(story.router, prefix="/api/v1", tags=["Story"])
app.include_router(tools.router, prefix="/api/tools", tags=["Tools"])

# Register workflow and SSE routes following frontend convention /api/v1 path
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["workflows"])
app.include_router(sse.router, prefix="/api/v1/sse", tags=["sse"])

# Register models / projects / system / chapters to /api/v1
app.include_router(models.router, prefix="/api/v1", tags=["models"])
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
app.include_router(system.router, prefix="/api/v1", tags=["system"])
app.include_router(chapters.router, prefix="/api/v1", tags=["chapters"])

# Register workspace router
app.include_router(workspace.router, tags=["workspace"])





@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "StoryAI Backend API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00Z"
    }

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器: 统一为 {code, message} """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.status_code,
            "message": exc.detail
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """通用异常处理器: 统一为 {code, message} """
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "code": 500,
            "message": "Internal server error"
        }
    )



if __name__ == "__main__":
    import uvicorn
    
    # 从环境变量获取配置
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info" if not debug else "debug"
    )
