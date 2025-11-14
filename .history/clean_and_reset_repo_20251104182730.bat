@echo off
echo 正在清理Git仓库,仅保留目录结构...

REM 切换到项目根目录
cd /d "D:\story-ai (3)"

REM 取消暂存所有文件
git reset HEAD .

REM 删除所有文件但保留目录结构
echo 正在删除所有文件...
for /r %%i in (*) do (
    if /i not "%%~nxi"=="clean_and_reset_repo.bat" (
        if /i not "%%~nxi"==".gitignore" (
            if /i not "%%~dpi" neq "%cd%\" (
                del "%%i" >nul 2>&1
            )
        )
    )
)

REM 在每个空目录中创建.gitkeep文件以保留目录结构
echo 正在创建.gitkeep文件以保留目录结构...
for /d /r %%i in (*) do (
    pushd "%%i"
    if errorlevel 1 (
        popd
    ) else (
        dir /b | findstr "^" >nul || echo. > .gitkeep
        popd
    )
)

echo.
echo 第一步完成:已删除所有文件,仅保留目录结构
echo 现在请手动检查并提交更改:
echo   1. git add .
echo   2. git commit -m "清空文件内容,仅保留目录结构"
echo   3. git push origin main
echo.
echo 然后运行第二部分脚本以重新添加文件
pause