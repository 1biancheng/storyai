"""
创建示例项目用于测试
"""
import json
from pathlib import Path
from datetime import datetime

# 使用backend下的workspace
WORKSPACE_ROOT = Path(__file__).parent / "workspace"
PROJECTS_DIR = WORKSPACE_ROOT / "projects"
CHAPTERS_DIR = WORKSPACE_ROOT / "chapters"

def create_sample_project():
    """创建一个示例项目"""
    
    project_id = "天逆珠"
    project_name = "天逆珠"
    
    # 创建项目目录
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建项目元数据
    project_metadata = {
        "id": project_id,
        "name": project_name,
        "genre": "玄幻",
        "requirements": "一部关于天逆珠的玄幻小说",
        "settings": {},
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    project_json_path = project_dir / "project.json"
    with open(project_json_path, 'w', encoding='utf-8') as f:
        json.dump(project_metadata, f, ensure_ascii=False, indent=2)
    
    print(f"[✓] 创建项目: {project_name}")
    print(f"    路径: {project_dir}")
    print(f"    ID: {project_id}")
    
    # 创建章节目录
    chapters_dir = CHAPTERS_DIR / project_id
    chapters_dir.mkdir(parents=True, exist_ok=True)
    print(f"[✓] 创建章节目录: {chapters_dir}")
    
    print(f"\n[✓] 示例项目创建完成！")
    print(f"    现在可以通过前端创建章节了")

if __name__ == "__main__":
    create_sample_project()
