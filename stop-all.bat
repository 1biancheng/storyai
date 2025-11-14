@echo off
chcp 65001 >nul
echo ========================================
echo  StoryAI 服务停止脚本
echo ========================================

:: 设置控制台颜色
color 0C

echo 正在停止所有相关服务...

:: 安全地停止端口8000(后端)
echo 停止后端服务 (端口8000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: 安全地停止端口3000(前端开发)
echo 停止前端开发服务 (端口3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: 安全地停止端口4173(前端预览)
echo 停止前端预览服务 (端口4173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4173" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: 安全地停止Python进程
echo 停止Python进程...
taskkill /IM python.exe /F >nul 2>&1
taskkill /IM python3.exe /F >nul 2>&1

:: 安全地停止Node.js进程
echo 停止Node.js进程...
taskkill /IM node.exe /F >nul 2>&1

:: 安全地关闭特定标题的窗口
echo 关闭相关窗口...
taskkill /FI "WindowTitle eq StoryAI Backend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq StoryAI Frontend*" /F >nul 2>&1

echo.
echo 所有服务已停止!
timeout /t 2 >nul