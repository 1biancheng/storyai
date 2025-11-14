"""
合并重复项目的迁移脚本
将所有重复的"天逆珠"项目合并到统一的 projectId 下
"""

import json
import shutil
from pathlib import Path
from typing import Dict, List

# 使用backend下的workspace（与config.py一致）
WORKSPACE_ROOT = Path(__file__).parent.parent / "workspace"
PROJECTS_DIR = WORKSPACE_ROOT / "projects"
CHAPTERS_DIR = WORKSPACE_ROOT / "chapters"

def get_projects_by_name(name: str) -> List[Path]:
    """获取所有名称为指定值的项目目录"""
    matching = []
    if not PROJECTS_DIR.exists():
        return matching
    
    for project_dir in PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        
        project_json = project_dir / "project.json"
        if not project_json.exists():
            continue
        
        try:
            with open(project_json, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                if metadata.get('name') == name or metadata.get('id') == name:
                    matching.append(project_dir)
        except Exception as e:
            print(f"[!] 读取项目文件失败: {project_dir.name}, 错误: {e}")
    
    return matching

def consolidate_projects(target_name: str, target_id: str):
    """
    合并同名项目到单一 projectId
    
    Args:
        target_name: 项目名称（如"天逆珠"）
        target_id: 统一使用的 projectId
    """
    
    print(f"[*] 开始合并 '{target_name}' 项目...")
    
    # 1. 找到所有同名项目
    matching_projects = get_projects_by_name(target_name)
    
    if len(matching_projects) == 0:
        print(f"[!] 未找到名称为 '{target_name}' 的项目")
        return
    
    if len(matching_projects) == 1:
        # 只有一个项目，仅需要更新 ID
        project_dir = matching_projects[0]
        if project_dir.name == target_id:
            print(f"[✓] 项目 ID 已是 '{target_id}'，无需迁移")
            return
        
        print(f"[*] 重命名项目目录: {project_dir.name} → {target_id}")
        target_project_dir = PROJECTS_DIR / target_id
        if target_project_dir.exists():
            print(f"[!] 目标目录已存在: {target_project_dir}")
            return
        
        project_dir.rename(target_project_dir)
        
        # 更新 project.json 中的 ID
        project_json = target_project_dir / "project.json"
        with open(project_json, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        metadata['id'] = target_id
        with open(project_json, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        print(f"[✓] 项目重命名完成: {target_id}")
        return
    
    print(f"[*] 发现 {len(matching_projects)} 个同名项目，进行合并...")
    
    # 2. 合并到目标目录
    target_project_dir = PROJECTS_DIR / target_id
    
    # 创建或获取目标项目目录
    if not target_project_dir.exists():
        target_project_dir.mkdir(parents=True, exist_ok=True)
        # 从第一个项目复制元数据
        source_json = matching_projects[0] / "project.json"
        target_json = target_project_dir / "project.json"
        with open(source_json, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        metadata['id'] = target_id
        metadata['name'] = target_name
        with open(target_json, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"[✓] 创建目标项目目录: {target_id}")
    
    # 3. 合并所有章节
    target_chapters_dir = CHAPTERS_DIR / target_id
    target_chapters_dir.mkdir(parents=True, exist_ok=True)
    
    merged_chapters = {}  # {chapter_number: chapter_data}
    
    for source_project_dir in matching_projects:
        source_id = source_project_dir.name
        source_chapters_dir = CHAPTERS_DIR / source_id
        
        if not source_chapters_dir.exists():
            print(f"[i] 项目 {source_id} 无章节目录")
            continue
        
        print(f"[*] 合并项目 {source_id} 的章节...")
        
        for chapter_file in source_chapters_dir.glob("chap_*.json"):
            try:
                with open(chapter_file, 'r', encoding='utf-8') as f:
                    chapter_data = json.load(f)
                
                chapter_num = chapter_data.get('chapterNumber', 0)
                
                # 检查目标目录中是否已存在该章节号
                if chapter_num in merged_chapters:
                    print(f"[!] 章节 #{chapter_num} 已存在，跳过重复")
                    continue
                
                # 更新章节的 projectId
                chapter_data['projectId'] = target_id
                merged_chapters[chapter_num] = chapter_data
                
                # 写入到目标目录
                target_chapter_file = target_chapters_dir / chapter_file.name
                with open(target_chapter_file, 'w', encoding='utf-8') as f:
                    json.dump(chapter_data, f, ensure_ascii=False, indent=2)
                
                print(f"  [✓] 合并章节: {chapter_file.name}")
            
            except Exception as e:
                print(f"  [!] 合并章节失败: {chapter_file.name}, 错误: {e}")
    
    # 4. 删除源项目目录（除目标目录外）
    for source_project_dir in matching_projects:
        if source_project_dir.name == target_id:
            continue
        
        print(f"[*] 删除源项目目录: {source_project_dir.name}")
        shutil.rmtree(source_project_dir, ignore_errors=True)
        
        source_chapters_dir = CHAPTERS_DIR / source_project_dir.name
        if source_chapters_dir.exists():
            print(f"[*] 删除源章节目录: {source_project_dir.name}")
            shutil.rmtree(source_chapters_dir, ignore_errors=True)
    
    print(f"\n[✓] 项目合并完成！")
    print(f"    目标项目 ID: {target_id}")
    print(f"    项目名称: {target_name}")
    print(f"    合并章节数: {len(merged_chapters)}")

if __name__ == "__main__":
    # 合并所有"天逆珠"项目到统一的 projectId
    consolidate_projects(target_name="天逆珠", target_id="天逆珠")
    print("\n[*] 迁移完成！")
