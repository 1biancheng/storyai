import os
import shutil
import subprocess

def clean_repo():
    # 获取当前目录
    repo_path = r"D:\story-ai (3)"
    os.chdir(repo_path)
    
    print("当前目录:", os.getcwd())
    
    # 获取git状态
    try:
        result = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
        print("Git状态:")
        print(result.stdout)
    except Exception as e:
        print(f"无法获取git状态: {e}")
    
    # 删除所有文件但保留目录结构
    for root, dirs, files in os.walk(".", topdown=False):
        # 跳过.git目录
        if ".git" in root:
            continue
            
        for name in files:
            file_path = os.path.join(root, name)
            # 不删除脚本自身和.gitignore
            if name not in ["clean_repo.py", ".gitignore"]:
                try:
                    os.remove(file_path)
                    print(f"已删除: {file_path}")
                except Exception as e:
                    print(f"无法删除 {file_path}: {e}")
    
    # 在空目录中创建.gitkeep文件
    for root, dirs, files in os.walk("."):
        # 跳过.git目录
        if ".git" in root:
            continue
            
        if not files and root != ".":
            gitkeep_path = os.path.join(root, ".gitkeep")
            try:
                with open(gitkeep_path, "w") as f:
                    pass  # 创建空文件
                print(f"已创建: {gitkeep_path}")
            except Exception as e:
                print(f"无法创建 {gitkeep_path}: {e}")
    
    print("清理完成!")

if __name__ == "__main__":
    clean_repo()
