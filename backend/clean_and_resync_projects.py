#!/usr/bin/env python
"""
清理数据库中的旧项目数据并重新同步
"""

import asyncio
import sys
from pathlib import Path

# 添加backend目录到path
sys.path.insert(0, str(Path(__file__).parent))

from services.db_service import get_db_service
from services.project_sync_service import ProjectSyncService
from config import get_settings
from sqlalchemy import delete
from services.db_service import Project

async def main():
    """清理并重新同步项目数据"""
    
    print("开始清理旧的项目数据...")
    
    # 获取数据库服务
    db_service = await get_db_service()
    settings = get_settings()
    
    # 清空projects表
    async with db_service.session_factory() as session:
        await session.execute(delete(Project))
        await session.commit()
        print("✓ 已清空projects表")
    
    # 重新同步
    print("\n开始从文件系统同步项目...")
    projects_dir = settings.workspace_dir / "projects"
    sync_service = ProjectSyncService(db_service, str(projects_dir))
    stats = await sync_service.sync_from_filesystem()
    
    print(f"\n同步完成！")
    print(f"  新增: {stats['added']}")
    print(f"  更新: {stats['updated']}")
    print(f"  跳过: {stats['skipped']}")

if __name__ == "__main__":
    asyncio.run(main())
