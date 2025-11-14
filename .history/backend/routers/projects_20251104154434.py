"""
@license
SPDX-License-Identifier: Apache-2.0
"""

from fastapi import APIRouter, Request, status
from typing import Dict, Any, List
import logging
import uuid
from datetime import datetime, timezone
import sys
import os

# 添加项目根目录到系统路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.time_utils import getCurrentUTCISOTime

from api_framework import ApiException, ErrorCode, get_request_id, log_request, log_response
from contracts import ApiResponse, success_response, error_response

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)

# 项目数据存储(实际项目中应该使用数据库)
projects_db: Dict[str, Any] = {}

@router.get("/")
async def get_projects(request: Request):
    """获取项目列表"""
    log_request(request)
    
    try:
        # 获取所有项目(实际项目中应该支持分页、过滤等)
        projects = list(projects_db.values())
        
        response = success_response(projects, "获取项目列表成功", get_request_id(request))
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
        project = {
            "id": project_id,
            "name": project_data.get("name", "未命名项目"),
            "description": project_data.get("description", ""),
            "created_at": getCurrentUTCISOTime(),
            "updated_at": getCurrentUTCISOTime(),
            "status": "active",
            "settings": project_data.get("settings", {}),
            "content": project_data.get("content", {})
        }
        
        # 保存项目
        projects_db[project_id] = project
        
        response = success_response(project, "创建项目成功", get_request_id(request))
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
        project = projects_db.get(project_id)
        if not project:
            raise ApiException(
                status_code=status.HTTP_404_NOT_FOUND,
                code=ErrorCode.NOT_FOUND,
                message=f"项目 {project_id} 不存在",
                request_id=get_request_id(request)
            )
        
        response = success_response(project, "获取项目详情成功", get_request_id(request))
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
        project = projects_db.get(project_id)
        if not project:
            raise ApiException(
                status_code=status.HTTP_404_NOT_FOUND,
                code=ErrorCode.NOT_FOUND,
                message=f"项目 {project_id} 不存在",
                request_id=get_request_id(request)
            )
        
        # 更新项目数据
        project.update({
            "name": project_data.get("name", project["name"]),
            "description": project_data.get("description", project["description"]),
            "settings": project_data.get("settings", project["settings"]),
            "content": project_data.get("content", project["content"]),
            "updated_at": getCurrentUTCISOTime()
        })
        
        response = success_response(project, "更新项目成功", get_request_id(request))
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
        if project_id not in projects_db:
            raise ApiException(
                status_code=status.HTTP_404_NOT_FOUND,
                code=ErrorCode.NOT_FOUND,
                message=f"项目 {project_id} 不存在",
                request_id=get_request_id(request)
            )
        
        # 删除项目
        deleted_project = projects_db.pop(project_id)
        
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
        project = projects_db.get(project_id)
        if not project:
            raise ApiException(
                status_code=status.HTTP_404_NOT_FOUND,
                code=ErrorCode.NOT_FOUND,
                message=f"项目 {project_id} 不存在",
                request_id=get_request_id(request)
            )
        
        settings = project.get("settings", {})
        
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
        project = projects_db.get(project_id)
        if not project:
            raise ApiException(
                status_code=status.HTTP_404_NOT_FOUND,
                code=ErrorCode.NOT_FOUND,
                message=f"项目 {project_id} 不存在",
                request_id=get_request_id(request)
            )
        
        # 更新设置
        project["settings"] = settings
        project["updated_at"] = getCurrentUTCISOTime()
        
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