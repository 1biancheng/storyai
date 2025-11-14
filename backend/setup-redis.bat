@echo off
REM Redis Setup Script for Windows
REM This script installs Redis using Chocolatey or downloads portable version

echo ========================================
echo Redis Setup for Story AI Backend
echo ========================================
echo.

REM Check if Redis is already running
netstat -ano | findstr ":6379" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Redis is already running on port 6379
    goto :end
)

REM Check if Redis is installed via Chocolatey
where redis-server >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Redis found, starting server...
    start "Redis Server" redis-server
    timeout /t 3 >nul
    goto :verify
)

REM Check if Chocolatey is installed
where choco >nul 2>&1
if %errorlevel% == 0 (
    echo [INFO] Installing Redis via Chocolatey...
    choco install redis-64 -y
    if %errorlevel% == 0 (
        echo [OK] Redis installed successfully
        start "Redis Server" redis-server
        timeout /t 3 >nul
        goto :verify
    ) else (
        echo [ERROR] Failed to install Redis via Chocolatey
        goto :manual
    )
) else (
    echo [WARN] Chocolatey not found
    goto :manual
)

:manual
echo.
echo ========================================
echo Manual Redis Installation Required
echo ========================================
echo.
echo Option 1: Install via Chocolatey (Recommended)
echo   1. Install Chocolatey: https://chocolatey.org/install
echo   2. Run: choco install redis-64 -y
echo.
echo Option 2: Download Portable Redis
echo   1. Visit: https://github.com/microsoftarchive/redis/releases
echo   2. Download: Redis-x64-3.0.504.zip
echo   3. Extract to: C:\Redis
echo   4. Run: redis-server.exe
echo.
echo Option 3: Use Docker (If available)
echo   Run: docker run -d -p 6379:6379 redis:alpine
echo.
echo Option 4: Disable Redis (Fallback to memory cache)
echo   Edit backend\.env and set: REDIS__ENABLED=false
echo.
goto :end

:verify
echo.
echo [INFO] Verifying Redis connection...
timeout /t 2 >nul
netstat -ano | findstr ":6379" >nul 2>&1
if %errorlevel% == 0 (
    echo [SUCCESS] Redis is running on port 6379
    echo.
    echo You can now use Redis for caching!
    echo Backend will automatically connect to Redis.
) else (
    echo [WARN] Redis port 6379 not detected
    echo Please check Redis logs or start manually
)

:end
echo.
echo ========================================
echo Setup Complete
echo ========================================
pause
