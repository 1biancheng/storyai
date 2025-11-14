"""
@license
SPDX-License-Identifier: Apache-2.0
"""

from fastapi import APIRouter, Request, status
from typing import Dict, Any, List
import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from api_framework import ApiException, ErrorCode, get_request_id, log_request, log_response
from contracts import ApiResponse, success_response, error_response
from services.db_service import DatabaseService, Project
from services.project_sync_service import ProjectSyncService
from config import get_settings

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)

# 数据库服务实例(使用异步初始化)
from services.db_service import get_db_service

db_service = None

async def get_db():
    """获取数据库服务实例"""
    global db_service
    if db_service is None:
        db_service = await get_db_service()
    return db_service

@router.get("/")
async def get_projects(request: Request):
    """获取项目列表"""
    log_request(request)
    
    try:
        # 获取数据库服务实例
        db = await get_db()
        async with db.session_factory() as session:
            # 查询所有活跃的项目
            result = await session.execute(
                select(Project).where(Project.is_active == True).order_by(Project.created_at.desc())
            )
            projects = result.scalars().all()
            
            # 转换为字典格式
            projects_list = []
            for project in projects:
                projects_list.append({
                    "id": project.id,
                    "name": project.name,
                    "genre": project.genre,
                    "requirements": project.requirements,
                    "workflow_id": project.workflow_id,
                    "settings": project.settings or {},
                    "metadata": project.extra_data or {},
                    "is_active": project.is_active,
                    "created_at": project.created_at.isoformat() if project.created_at else None,
                    "updated_at": project.updated_at.isoformat() if project.updated_at else None
                })
        
        response = success_response(projects_list, "获取项目列表成功", get_request_id(request))
        log_response(request, response)
        return response
        
    except Exception as e:
        logger.error(f"获取项目列表失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="获取项目列表失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.post("/")
async def create_project(request: Request, project_data: Dict[str, Any]):
    """创建新项目"""
    log_request(request, project_data)
    
    try:
        # 生成项目ID
        project_id = str(uuid.uuid4())
        
        # 创建项目数据
        project = Project(
            id=project_id,
            name=project_data.get("name", "未命名项目"),
            genre=project_data.get("genre"),
            requirements=project_data.get("requirements"),
            workflow_id=project_data.get("workflow_id"),
            settings=project_data.get("settings", {}),
            extra_data=project_data.get("metadata", {}),
            is_active=True
        )
        
        # 保存项目到数据库
        db = await get_db()
        async with db.session_factory() as session:
            session.add(project)
            await session.commit()
            
            # 重新查询获取完整数据
            result = await session.execute(select(Project).where(Project.id == project_id))
            saved_project = result.scalar_one()
            
            # 转换为响应格式
            response_project = {
                "id": saved_project.id,
                "name": saved_project.name,
                "genre": saved_project.genre,
                "requirements": saved_project.requirements,
                "workflow_id": saved_project.workflow_id,
                "settings": saved_project.settings or {},
                "metadata": saved_project.metadata or {},
                "is_active": saved_project.is_active,
                "created_at": saved_project.created_at.isoformat() if saved_project.created_at else None,
                "updated_at": saved_project.updated_at.isoformat() if saved_project.updated_at else None
            }
        
        response = success_response(response_project, "创建项目成功", get_request_id(request))
        log_response(request, response)
        return response
        
    except Exception as e:
        logger.error(f"创建项目失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="创建项目失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.get("/{project_id}")
async def get_project(project_id: str, request: Request):
    """获取项目详情"""
    log_request(request)
    
    try:
        db = await get_db()
        async with db.session_factory() as session:
            result = await session.execute(
                select(Project).where(Project.id == project_id, Project.is_active == True)
            )
            project = result.scalar_one_or_none()
            
            if not project:
                raise ApiException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    code=ErrorCode.NOT_FOUND,
                    message=f"项目 {project_id} 不存在",
                    request_id=get_request_id(request)
                )
            
            # 转换为响应格式
            response_project = {
                "id": project.id,
                "name": project.name,
                "genre": project.genre,
                "requirements": project.requirements,
                "workflow_id": project.workflow_id,
                "settings": project.settings or {},
                "metadata": project.metadata or {},
                "is_active": project.is_active,
                "created_at": project.created_at.isoformat() if project.created_at else None,
                "updated_at": project.updated_at.isoformat() if project.updated_at else None
            }
        
        response = success_response(response_project, "获取项目详情成功", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"获取项目详情失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="获取项目详情失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.put("/{project_id}")
async def update_project(project_id: str, request: Request, project_data: Dict[str, Any]):
    """更新项目"""
    log_request(request, project_data)
    
    try:
        db = await get_db()
        async with db.session_factory() as session:
            # 检查项目是否存在
            result = await session.execute(
                select(Project).where(Project.id == project_id, Project.is_active == True)
            )
            project = result.scalar_one_or_none()
            
            if not project:
                raise ApiException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    code=ErrorCode.NOT_FOUND,
                    message=f"项目 {project_id} 不存在",
                    request_id=get_request_id(request)
                )
            
            # 更新项目数据
            update_data = {}
            if "name" in project_data:
                update_data["name"] = project_data["name"]
            if "genre" in project_data:
                update_data["genre"] = project_data["genre"]
            if "requirements" in project_data:
                update_data["requirements"] = project_data["requirements"]
            if "workflow_id" in project_data:
                update_data["workflow_id"] = project_data["workflow_id"]
            if "settings" in project_data:
                update_data["settings"] = project_data["settings"]
            if "metadata" in project_data:
                update_data["extra_data"] = project_data["metadata"]
            
            if update_data:
                await session.execute(
                    update(Project).where(Project.id == project_id).values(**update_data)
                )
                await session.commit()
            
            # 重新查询获取更新后的数据
            result = await session.execute(
                select(Project).where(Project.id == project_id)
            )
            updated_project = result.scalar_one()
            
            # 转换为响应格式
            response_project = {
                "id": updated_project.id,
                "name": updated_project.name,
                "genre": updated_project.genre,
                "requirements": updated_project.requirements,
                "workflow_id": updated_project.workflow_id,
                "settings": updated_project.settings or {},
                "metadata": updated_project.extra_data or {},
                "is_active": updated_project.is_active,
                "created_at": updated_project.created_at.isoformat() if updated_project.created_at else None,
                "updated_at": updated_project.updated_at.isoformat() if updated_project.updated_at else None
            }
        
        response = success_response(response_project, "更新项目成功", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"更新项目失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="更新项目失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.delete("/{project_id}")
async def delete_project(project_id: str, request: Request):
    """删除项目"""
    log_request(request)
    
    try:
        db = await get_db()
        async with db.session_factory() as session:
            # 检查项目是否存在
            result = await session.execute(
                select(Project).where(Project.id == project_id, Project.is_active == True)
            )
            project = result.scalar_one_or_none()
            
            if not project:
                raise ApiException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    code=ErrorCode.NOT_FOUND,
                    message=f"项目 {project_id} 不存在",
                    request_id=get_request_id(request)
                )
            
            # 软删除:将is_active设置为False
            await session.execute(
                update(Project).where(Project.id == project_id).values(is_active=False)
            )
            await session.commit()
        
        response = success_response(
            {"id": project_id}, 
            "删除项目成功", 
            get_request_id(request)
        )
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"删除项目失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="删除项目失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.get("/{project_id}/settings")
async def get_project_settings(project_id: str, request: Request):
    """获取项目设置"""
    log_request(request)
    
    try:
        db = await get_db()
        async with db.session_factory() as session:
            result = await session.execute(
                select(Project).where(Project.id == project_id, Project.is_active == True)
            )
            project = result.scalar_one_or_none()
            
            if not project:
                raise ApiException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    code=ErrorCode.NOT_FOUND,
                    message=f"项目 {project_id} 不存在",
                    request_id=get_request_id(request)
                )
            
            settings = project.settings or {}
        
        response = success_response(settings, "获取项目设置成功", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"获取项目设置失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="获取项目设置失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.put("/{project_id}/settings")
async def update_project_settings(project_id: str, request: Request, settings: Dict[str, Any]):
    """更新项目设置"""
    log_request(request, settings)
    
    try:
        db = await get_db()
        async with db.session_factory() as session:
            result = await session.execute(
                select(Project).where(Project.id == project_id, Project.is_active == True)
            )
            project = result.scalar_one_or_none()
            
            if not project:
                raise ApiException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    code=ErrorCode.NOT_FOUND,
                    message=f"项目 {project_id} 不存在",
                    request_id=get_request_id(request)
                )
            
            # 更新设置
            await session.execute(
                update(Project).where(Project.id == project_id).values(settings=settings)
            )
            await session.commit()
        
        response = success_response(settings, "更新项目设置成功", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"更新项目设置失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="更新项目设置失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.post("/sync/{project_id}")
async def sync_project_from_filesystem(project_id: str, request: Request):
    """
    手动触发项目级文件系统→数据库同步(包含章节内容)
    
    Args:
        project_id: 项目ID
    
    Returns:
        同步统计: {added, updated, skipped} (章节统计)
    """
    log_request(request)
    
    try:
        db = await get_db()
        settings = get_settings()
        
        # 1. 先同步项目元数据
        projects_dir = settings.workspace_dir / "projects"
        sync_service = ProjectSyncService(db, str(projects_dir))
        project_stats = await sync_service.sync_from_filesystem(project_id=project_id)
        logger.info(f"项目元数据同步完成: {project_stats}")
        
        # 2. 同步章节内容
        from services.chapter_service import ChapterService
        chapter_service = ChapterService(workspace_dir=str(settings.workspace_dir / "projects"))
        chapter_result = await chapter_service.sync_files_to_db(project_id)
        
        # 统一返回格式为 {added, updated, skipped}
        stats = {
            "added": chapter_result.get("inserts", 0),
            "updated": chapter_result.get("updates", 0),
            "skipped": chapter_result.get("missing", 0)
        }
        
        response = success_response(
            stats,
            f"项目同步完成: 新增{stats['added']}章, 更新{stats['updated']}章, 跳过{stats['skipped']}章",
            get_request_id(request)
        )
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"项目同步失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="项目同步失败",
            details=str(e),
            request_id=get_request_id(request)
        )