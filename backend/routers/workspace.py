"""
Workspace文件系统API
提供workspace目录的文件读写接口
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from pathlib import Path
import json
import shutil
import logging
from typing import List, Optional
from config import get_settings

router = APIRouter(prefix="/api/workspace", tags=["workspace"])

settings = get_settings()
WORKSPACE_DIR = settings.workspace_dir

# 配置日志记录器
logger = logging.getLogger(__name__)


class WriteFileRequest(BaseModel):
    """写入文件请求"""
    path: str
    content: str


class DeleteFileRequest(BaseModel):
    """删除文件请求"""
    path: str


def validate_path(relative_path: str) -> Path:
    """验证并返回安全的文件路径"""
    # 移除前导斜杠
    relative_path = relative_path.lstrip('/')
    
    # 构建完整路径
    full_path = WORKSPACE_DIR / relative_path
    
    # 确保路径在workspace目录内(防止路径遍历攻击)
    try:
        full_path = full_path.resolve()
        WORKSPACE_DIR.resolve()
        if not str(full_path).startswith(str(WORKSPACE_DIR.resolve())):
            raise ValueError("路径必须在workspace目录内")
    except Exception:
        raise HTTPException(status_code=400, detail="无效的路径")
    
    return full_path


@router.post("/write")
async def write_file(request: WriteFileRequest):
    """写入文件到workspace"""
    try:
        file_path = validate_path(request.path)
        
        # 创建父目录
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 写入文件
        file_path.write_text(request.content, encoding='utf-8')
        
        return {
            "code": 200,
            "message": "文件写入成功",
            "data": {
                "path": request.path,
                "size": len(request.content)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"写入文件失败: {str(e)}")


@router.delete("/delete")
async def delete_file(path: str):
    """删除workspace中的文件或目录(幂等操作)"""
    try:
        file_path = validate_path(path)
        
        # 检查文件或目录是否存在
        if not file_path.exists():
            # 幂等删除:目标不存在时也返回成功
            logger.info(f"文件或目录不存在,已跳过删除: {path}")
            return {
                "code": 200,
                "message": "文件或目录已删除或不存在",
                "data": {
                    "path": path,
                    "deleted": False,
                    "existed": False,
                    "recycleId": None
                }
            }
        
        # 记录删除类型
        file_type = "目录" if file_path.is_dir() else "文件"
        
        # 删除文件或目录
        if file_path.is_dir():
            shutil.rmtree(file_path)
        else:
            file_path.unlink()
        
        logger.info(f"成功删除: {path}, 类型: {file_type}")
        
        return {
            "code": 200,
            "message": "删除成功",
            "data": {
                "path": path,
                "deleted": True,
                "existed": True,
                "recycleId": None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除失败: {path}, 原因: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.get("/list")
async def list_directory(path: str = ""):
    """列出workspace目录内容"""
    try:
        dir_path = validate_path(path)
        
        if not dir_path.exists():
            return {
                "code": 200,
                "message": "目录不存在",
                "data": {
                    "files": [],
                    "directories": []
                }
            }
        
        if not dir_path.is_dir():
            raise HTTPException(status_code=400, detail="路径不是目录")
        
        files = []
        directories = []
        
        for item in dir_path.iterdir():
            if item.is_file():
                files.append(item.name)
            elif item.is_dir():
                directories.append(item.name)
        
        return {
            "code": 200,
            "message": "获取目录内容成功",
            "data": {
                "files": sorted(files),
                "directories": sorted(directories)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"列出目录失败: {str(e)}")


@router.get("/read")
async def read_file(path: str):
    """读取workspace中的文件"""
    try:
        file_path = validate_path(path)
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="路径不是文件")
        
        content = file_path.read_text(encoding='utf-8')
        
        return {
            "code": 200,
            "message": "读取文件成功",
            "data": {
                "path": path,
                "content": content,
                "size": len(content)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")
