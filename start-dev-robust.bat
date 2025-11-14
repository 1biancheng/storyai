@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo  StoryAI Development Environment Robust Startup Script
echo ========================================

:: Set console color and encoding
color 0A
set "PYTHONIOENCODING=utf-8"

:: Check if ports are occupied
echo Checking ports...
netstat -ano | findstr ":8000" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 8000 is already in use, checking if backend is running...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/docs' -TimeoutSec 3; if ($response.StatusCode -eq 200) { echo '[OK] Backend is already running on port 8000' } else { echo '[ERROR] Port 8000 occupied but backend not responding' } } catch { echo '[ERROR] Port 8000 occupied but backend not accessible' }"
) else (
    echo [OK] Port 8000 is available
)

netstat -ano | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 3000 is already in use, frontend may fail to start
) else (
    echo [OK] Port 3000 is available
)

:: Check if Redis is enabled and start if needed
echo.
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
        timeout /t 3 /nobreak >nul
    ) else (
        echo [OK] Redis is already running on port 6379
    )
) else (
    echo [INFO] Redis is disabled in configuration, using memory cache only
)

:: Function to check service health
:check_backend_health
echo.
echo [Health Check] Waiting for backend to start...
set attempts=0
:backend_check_loop
set /a attempts+=1
if %attempts% gtr 30 (
    echo [ERROR] Backend failed to start after 30 attempts
    goto :backend_failed
)
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/docs' -TimeoutSec 3; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel% equ 0 (
    echo [OK] Backend is healthy and responding
    goto :backend_healthy
) else (
    echo [INFO] Waiting for backend... (attempt %attempts%/30)
    timeout /t 2 /nobreak >nul
    goto :backend_check_loop
)

:backend_failed
echo [ERROR] Backend service failed to start properly!
echo [INFO] Checking backend logs...
if exist "%~dp0backend\logs\backend.log" (
    echo [LOG] Last 10 lines of backend log:
    powershell -Command "Get-Content '%~dp0backend\logs\backend.log' -Tail 10"
)
goto :error_exit

:backend_healthy
echo [SUCCESS] Backend service is running successfully!
goto :continue_startup

:: Start backend service with error handling
echo.
echo [1/3] Starting backend service...
cd /d "%~dp0backend"

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Start backend with output redirection
start "StoryAI Backend" cmd /k "echo Backend service starting... && python main.py 2>&1 ^| tee logs\backend.log"
timeout /t 2 /nobreak >nul

:: Check if backend process started
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'python' }" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Backend process failed to start!
    goto :error_exit
)

:: Wait for backend to be healthy
goto :check_backend_health

:continue_startup
cd /d "%~dp0"

:: Start frontend service
echo.
echo [2/3] Starting frontend service...
cd /d "%~dp0"
start "StoryAI Frontend" cmd /k "echo Frontend service starting... && npm run dev"
timeout /t 3 /nobreak >nul

:: Check if frontend process started
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'node' }" >nul
if %errorlevel% neq 0 (
    echo [WARNING] Frontend process may not have started properly, but continuing...
)

:: Open browser
echo.
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
echo Services status:
echo [BACKEND] Running on http://localhost:8000
echo [FRONTEND] Starting on http://localhost:3000
echo.
echo Press any key to stop all services...
pause >nul

:: Graceful shutdown
echo.
echo Stopping services gracefully...
taskkill /FI "WindowTitle eq StoryAI Backend*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq StoryAI Frontend*" /T /F >nul 2>&1

:: Kill any remaining Python processes for this project
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*story-ai*' } | Stop-Process -Force -ErrorAction SilentlyContinue"
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*story-ai*' } | Stop-Process -Force -ErrorAction SilentlyContinue"

echo All services stopped!
goto :end

:error_exit
echo.
echo [ERROR] Startup failed due to backend issues!
echo [INFO] Please check the logs above and try again.
echo [HELP] Common solutions:
echo   1. Check if Python is installed: python --version
echo   2. Check if dependencies are installed: cd backend && pip install -r requirements.txt
echo   3. Check backend configuration: type backend\.env
echo   4. Check port availability: netstat -ano | findstr ":8000"
pause
goto :end

:end
exit /b 1