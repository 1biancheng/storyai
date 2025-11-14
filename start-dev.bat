@echo off
echo ========================================
echo  StoryAI Development Environment One-Click Startup Script
echo ========================================

:: Set console color
color 0A

:: Check if ports are occupied
echo Checking ports...
netstat -ano | findstr ":8000" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 8000 is already in use, backend may fail to start
)
netstat -ano | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 3000 is already in use, frontend may fail to start
)

:: Check if Redis is enabled and start if needed
echo Checking Redis configuration...
findstr /C:"REDIS__ENABLED=true" "%~dp0backend\.env" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Redis is enabled in configuration
    netstat -ano | findstr ":6379" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Redis port 6379 not detected, attempting to start...
        cd /d "%~dp0backend"
        call setup-redis.bat
        cd /d "%~dp0"
        timeout /t 2 /nobreak >nul
    ) else (
        echo [OK] Redis is already running on port 6379
    )
) else (
    echo [INFO] Redis is disabled in configuration, using memory cache only
)

:: Start backend service
echo.
echo [1/3] Starting backend service...
cd /d "%~dp0backend"
start "StoryAI Backend" cmd /k "C:\Users\Administrator.DESKTOP-M9FE191\.conda\envs\StoryWeaverAI\python.exe main.py || (echo Backend failed to start && pause)"
cd /d "%~dp0"
timeout /t 3 /nobreak >nul

:: Start frontend service
echo [2/3] Starting frontend service...
cd /d "%~dp0"
start "StoryAI Frontend" cmd /k "echo Frontend service starting... && npm run dev"
timeout /t 3 /nobreak >nul

:: Open browser
echo [3/3] Opening browser...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo ========================================
echo  Startup complete!
echo  Frontend URL: http://localhost:3000
echo  Backend URL: http://localhost:8000
echo  API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Press any key to stop all services...
pause >nul

:: Close all windows
taskkill /FI "WindowTitle eq StoryAI Backend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq StoryAI Frontend*" /F >nul 2>&1
echo All services stopped!