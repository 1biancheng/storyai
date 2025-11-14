@echo off
echo 正在恢复并提交所有项目文件...

REM 切换到项目根目录
cd /d "D:\story-ai (3)"

REM 检查是否有需要删除的.gitkeep文件
echo 正在清理.gitkeep文件...
for /r %%i in (.gitkeep) do (
    del "%%i" >nul 2>&1
)

REM 添加所有当前文件到Git
echo 正在添加所有当前项目文件...
git add .

REM 提交更改
echo 正在提交更改...
git commit -m "重新添加所有本地项目文件"

echo.
echo 第二步完成：已重新添加并提交所有项目文件
echo 现在可以推送到远程仓库：
echo   git push origin main
echo.
pause