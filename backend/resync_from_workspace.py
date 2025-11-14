#!/usr/bin/env python
"""从workspace重新同步项目数据到数据库"""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import delete

sys.path.insert(0, str(Path(__file__).parent))

from services.db_service import get_db_service, Project
from services.project_sync_service import ProjectSyncService
from config import get_settings

async def main():
    print("=" * 50)
    print("从 workspace 重新同步项目数据")
    print("=" * 50)
    
    # 获取配置
    settings = get_settings()
    print(f"\nWorkspace路径: {settings.workspace_dir.absolute()}")
    
    # 检查projects目录
    projects_dir = settings.workspace_dir / "projects"
    if not projects_dir.exists():
        print(f"错误: 项目目录不存在 - {projects_dir}")
        return
    
    print(f"项目目录: {projects_dir}")
    print("\n现有项目:")
    for item in projects_dir.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            print(f"  - {item.name}")
    
    # 获取数据库服务
    db = await get_db_service()
    
    # 清空projects表
    print("\n清理数据库...")
    async with db.session_factory() as session:
        await session.execute(delete(Project))
        await session.commit()
    print("OK 已清空projects表")
    
    # 重新同步
    print("\n开始同步...")
    sync_service = ProjectSyncService(db, str(projects_dir))
    stats = await sync_service.sync_from_filesystem()
    
    print(f"\n同步完成!")
    print(f"  新增: {stats['added']}")
    print(f"  更新: {stats['updated']}")
    print(f"  跳过: {stats['skipped']}")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(main())
