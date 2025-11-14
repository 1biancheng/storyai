@echo off
echo ========================================
echo  StoryAI 前端预览脚本
echo ========================================

:: 设置控制台颜色
color 0E

:: 检查Node.js环境
echo 正在检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js环境!       
    echo 请确保Node.js已正确安装并添加到系统PATH中
    pause
    exit /b 1
)

:: 检查是否已构建
echo 正在检查构建文件...
if not exist "dist" (
    echo [提示] 未找到构建文件,正在构建项目...
    npm run build
    if %errorlevel% neq 0 (
        echo [错误] 构建失败!
        pause
        exit /b 1
    )
)

echo.
echo 正在启动预览服务...
echo 预览地址: http://localhost:4173       
echo.
echo 按 Ctrl+C 停止服务...
npm run preview

echo.
echo 预览服务已停止
echo 如需重新构建项目,请运行: npm run build
pause