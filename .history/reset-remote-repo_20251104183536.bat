@echo off
echo 此脚本将帮助您清理远程仓库中的文件内容，仅保留目录结构，然后重新提交本地代码
echo 请确保您在正确的Git仓库目录中执行此操作
pause

echo 步骤1: 删除所有文件但保留目录结构...
git ls-files -z | xargs -0 rm -f
echo 文件已删除

echo 步骤2: 添加.gitkeep文件到空目录以保留目录结构...
for /f "delims=" %%d in ('dir /ad /b /s') do (
    if not exist "%%d\*" (
        echo. > "%%d\.gitkeep"
        echo 添加了 .gitkeep 到 "%%d"
    )
)
echo .gitkeep 文件已添加到空目录

echo 步骤3: 提交更改到本地仓库...
git add .
git commit -m "清空文件内容，仅保留目录结构"
echo 本地提交完成

echo 步骤4: 推送到远程仓库...
git push origin main
echo 远程推送完成（仅保留目录结构）

echo 步骤5: 重新添加本地项目文件...
git add .

echo 步骤6: 提交所有文件...
git commit -m "重新添加所有本地项目文件"
echo 重新添加文件并提交完成

echo 步骤7: 推送到远程仓库...
git push origin main
echo 所有操作已完成！

pause