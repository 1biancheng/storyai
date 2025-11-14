#!/usr/bin/env python
"""
为workspace/projects下的每个项目目录创建project.json元数据文件
"""

import json
from pathlib import Path

# 使用backend下的workspace（与config.py保持一致）
WORKSPACE_ROOT = Path(__file__).parent / "workspace"
projects_dir = WORKSPACE_ROOT / "projects"

# 项目名称映射（根据目录名生成友好名称）
project_names = {
    "da18b512-64e2-40b5-b513-3102403e5487": "主项目 - 长眠症",
    "f5bee2aa-d123-4dae-9bac-fa47c13c61e0": "项目2",
    "39207ae9-9ad3-4972-8e19-fde7cf44d595": "项目3",
    "2f61d12d-9dc6-4b89-b2fe-8237ddcb8a89": "项目4",
    "39385d1f-6553-4928-8259-247b77a33d5f": "项目5",
    "b7c7169d-e537-4dd5-bfd9-42432127167b": "项目6",
    "c176c78d-5810-4517-937e-278552a90837": "项目7",
    "c2145a29-ab82-4f01-a923-d4bb02c5b513": "项目8",
}

# 遍历所有项目目录
for project_dir in projects_dir.iterdir():
    if not project_dir.is_dir() or project_dir.name.startswith('.'):
        continue
    
    # 检查是否已有project.json
    project_json = project_dir / "project.json"
    if project_json.exists():
        print(f"✓ {project_dir.name} 已有project.json")
        continue
    
    # 创建project.json
    project_name = project_names.get(project_dir.name, project_dir.name)
    project_meta = {
        "name": project_name,
        "genre": "奇幻",
        "requirements": "",
        "settings": {}
    }
    
    with open(project_json, 'w', encoding='utf-8') as f:
        json.dump(project_meta, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 创建 {project_dir.name}/project.json")

print("\n所有项目元数据创建完成！")
