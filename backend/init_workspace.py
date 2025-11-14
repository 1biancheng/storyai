"""
初始化 backend/workspace 目录结构
创建必要的 projects 和 chapters 子目录
"""

from pathlib import Path

# backend/workspace 目录
WORKSPACE_ROOT = Path(__file__).parent / "workspace"
PROJECTS_DIR = WORKSPACE_ROOT / "projects"
CHAPTERS_DIR = WORKSPACE_ROOT / "chapters"

def init_workspace():
    """初始化workspace目录结构"""
    print("[*] 初始化 workspace 目录结构...")
    
    # 创建主目录
    WORKSPACE_ROOT.mkdir(exist_ok=True)
    print(f"[✓] 创建: {WORKSPACE_ROOT}")
    
    # 创建子目录
    PROJECTS_DIR.mkdir(exist_ok=True)
    print(f"[✓] 创建: {PROJECTS_DIR}")
    
    CHAPTERS_DIR.mkdir(exist_ok=True)
    print(f"[✓] 创建: {CHAPTERS_DIR}")
    
    print("\n[✓] Workspace 目录结构初始化完成！")
    print(f"    根目录: {WORKSPACE_ROOT}")
    print(f"    项目目录: {PROJECTS_DIR}")
    print(f"    章节目录: {CHAPTERS_DIR}")

if __name__ == "__main__":
    init_workspace()
