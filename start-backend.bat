@echo off
echo ========================================
echo  StoryAI Backend Service Startup Script
echo ========================================

:: Set console color
color 0B

:: Check if port is occupied
echo Checking port 8000...
netstat -ano | findstr ":8000" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 8000 is already in use!
    echo Closing the process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do taskkill /PID %%a /F
    timeout /t 2 /nobreak >nul
)

:: Enter backend directory
cd /d "%~dp0backend"

:: Set Python environment (Anaconda StoryWeaverAI)
set PYTHON_PATH=C:\Users\Administrator.DESKTOP-M9FE191\.conda\envs\StoryWeaverAI\python.exe
set PIP_PATH=C:\Users\Administrator.DESKTOP-M9FE191\.conda\envs\StoryWeaverAI\Scripts\pip.exe

:: Check Python environment
echo Checking Python environment...
if not exist "%PYTHON_PATH%" (
    echo [WARNING] Anaconda environment not found, trying system Python...
    set PYTHON_PATH=python
    set PIP_PATH=pip
)

%PYTHON_PATH% --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python environment not detected!
    echo Please ensure Python is properly installed
    pause
    exit /b 1
)

:: Check dependencies
echo Checking dependencies...
%PYTHON_PATH% -c "import fastapi" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Missing dependencies detected, installing...
    %PIP_PATH% install -r requirements.txt
)

echo.
echo Starting backend service...
echo Service URL: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop service...
%PYTHON_PATH% main.py

echo.
echo Backend service stopped
pause