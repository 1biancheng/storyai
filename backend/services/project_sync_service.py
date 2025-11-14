"""
项目同步服务 - 实现文件系统与数据库之间的项目数据同步
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
from sqlalchemy import select, insert, update
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from .db_service import DatabaseService, Project

logger = logging.getLogger(__name__)


class ProjectSyncService:
    """项目同步服务类"""
    
    def __init__(self, db_service: DatabaseService, projects_dir: str):
        """
        初始化项目同步服务
        
        Args:
            db_service: 数据库服务实例
            projects_dir: 项目目录路径
        """
        self.db_service = db_service
        self.projects_dir = Path(projects_dir)
        self._sync_lock = asyncio.Lock()
    
    async def sync_from_filesystem(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        从文件系统同步项目到数据库(单向同步,文件系统为准)
        
        Args:
            project_id: 可选,指定项目ID进行同步.如果为None则同步所有项目
        
        Returns:
            同步结果统计 {added, updated, skipped}
        """
        async with self._sync_lock:
            logger.info(f"开始从文件系统同步项目到数据库 (project_id={project_id})")
            
            stats = {
                "added": 0,
                "updated": 0,
                "skipped": 0
            }
            
            try:
                # 获取文件系统中的项目
                filesystem_projects = self._scan_filesystem_projects()
                
                # 如果指定了project_id,只处理该项目
                if project_id:
                    # 通过ID查找项目
                    async with self.db_service.session_factory() as session:
                        result = await session.execute(
                            select(Project).where(Project.id == project_id)
                        )
                        project = result.scalar_one_or_none()
                        if project and project.name in filesystem_projects:
                            filesystem_projects = {project.name: filesystem_projects[project.name]}
                        else:
                            logger.warning(f"未找到项目 {project_id} 或其文件系统数据")
                            return stats
                
                # 获取数据库中的现有项目(按ID索引)
                async with self.db_service.session_factory() as session:
                    db_projects = await self._get_db_projects_by_id(session)
                    
                    for project_dir_id, project_data in filesystem_projects.items():
                        try:
                            if project_dir_id in db_projects:
                                # 更新现有项目
                                await self._update_project_by_id(session, project_dir_id, project_data)
                                stats["updated"] += 1
                            else:
                                # 创建新项目,使用目录名作为ID
                                await self._create_project(session, project_dir_id, project_data)
                                stats["added"] += 1
                        except Exception as e:
                            logger.error(f"同步项目 '{project_dir_id}' 失败: {str(e)}")
                            stats["skipped"] += 1
                    
                    await session.commit()
                
                logger.info(f"文件系统同步完成: {stats}")
                return stats
                
            except Exception as e:
                logger.error(f"文件系统同步失败: {str(e)}")
                return stats
    

    
    def _scan_filesystem_projects(self) -> Dict[str, Dict[str, Any]]:
        """
        扫描文件系统中的项目
        
        Returns:
            项目字典,键为项目ID(目录名),值为项目数据
        """
        projects = {}
        
        if not self.projects_dir.exists():
            logger.warning(f"项目目录不存在: {self.projects_dir}")
            return projects
        
        for item in self.projects_dir.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                try:
                    project_data = self._load_project_from_directory(item)
                    if project_data:
                        # 从 project_data 中获取 id,并记录目录名
                        project_id = project_data.get('id', item.name)
                        project_data['_dir_name'] = item.name
                        projects[project_id] = project_data
                except Exception as e:
                    logger.error(f"扫描项目目录 '{item.name}' 失败: {str(e)}")
        
        return projects
    
    def _load_project_from_directory(self, project_dir: Path) -> Optional[Dict[str, Any]]:
        """
        从项目目录加载项目数据
        
        Args:
            project_dir: 项目目录路径
            
        Returns:
            项目数据或None
        """
        config_file = project_dir / "project.json"
        
        if config_file.exists():
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    project_config = json.load(f)
                
                # 验证必需字段
                required_fields = ["name", "genre"]
                if all(field in project_config for field in required_fields):
                    # 如果project.json中有id字段,使用它;否则使用目录名
                    if "id" not in project_config:
                        project_config["id"] = project_dir.name
                    return project_config
                else:
                    logger.warning(f"项目配置文件缺少必需字段: {config_file}")
                    
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"读取项目配置文件失败: {config_file} - {str(e)}")
        
        # 如果没有配置文件,尝试从目录名创建基本项目数据
        return {
            "id": project_dir.name,
            "name": project_dir.name,
            "genre": "unknown",
            "requirements": "",
            "settings": {}
        }
    
    async def _get_db_projects(self, session: AsyncSession) -> Dict[str, Project]:
        """
        获取数据库中的所有项目(按名称索引)
        
        Args:
            session: 数据库会话
            
        Returns:
            项目字典,键为项目名称,值为Project对象
        """
        result = await session.execute(
            select(Project).where(Project.is_active == True)
        )
        projects = result.scalars().all()
        return {project.name: project for project in projects}
    
    async def _get_db_projects_by_id(self, session: AsyncSession) -> Dict[str, Project]:
        """
        获取数据库中的所有项目(按ID索引)
        
        Args:
            session: 数据库会话
            
        Returns:
            项目字典,键为项目ID,值为Project对象
        """
        result = await session.execute(
            select(Project).where(Project.is_active == True)
        )
        projects = result.scalars().all()
        return {project.id: project for project in projects}
    
    async def _create_project(self, session: AsyncSession, project_id: str, project_data: Dict[str, Any]):
        """
        在数据库中创建新项目
        
        Args:
            session: 数据库会话
            project_id: 项目ID(使用文件系统目录名)
            project_data: 项目数据
        """
        project = Project(
            id=project_id,  # 使用目录名作为ID
            name=project_data.get("name", project_id),
            genre=project_data.get("genre", "unknown"),
            requirements=project_data.get("requirements", ""),
            settings=project_data.get("settings", {}),
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        session.add(project)
        logger.info(f"创建新项目: {project_id}")
    
    async def _update_project(self, session: AsyncSession, project_name: str, project_data: Dict[str, Any]):
        """
        更新数据库中的现有项目(按名称)
        
        Args:
            session: 数据库会话
            project_name: 项目名称
            project_data: 项目数据
        """
        result = await session.execute(
            select(Project).where(Project.name == project_name, Project.is_active == True)
        )
        project = result.scalar_one_or_none()
        
        if project:
            # 只更新非空字段
            if "genre" in project_data:
                project.genre = project_data["genre"]
            if "requirements" in project_data:
                project.requirements = project_data["requirements"]
            if "settings" in project_data:
                project.settings = project_data["settings"]
            
            project.updated_at = datetime.now(timezone.utc)
            
            logger.info(f"更新项目: {project_name}")
    
    async def _update_project_by_id(self, session: AsyncSession, project_id: str, project_data: Dict[str, Any]):
        """
        更新数据库中的现有项目(按ID)
        
        Args:
            session: 数据库会话
            project_id: 项目ID
            project_data: 项目数据
        """
        result = await session.execute(
            select(Project).where(Project.id == project_id, Project.is_active == True)
        )
        project = result.scalar_one_or_none()
        
        if project:
            # 更新项目信息
            if "name" in project_data:
                project.name = project_data["name"]
            if "genre" in project_data:
                project.genre = project_data["genre"]
            if "requirements" in project_data:
                project.requirements = project_data["requirements"]
            if "settings" in project_data:
                project.settings = project_data["settings"]
            
            project.updated_at = datetime.now(timezone.utc)
            
            logger.info(f"更新项目: {project_id}")
    
