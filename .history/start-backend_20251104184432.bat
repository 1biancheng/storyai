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
    echo Do you want to forcefully close the process? (Y/N)
    choice /C YN /N /M "Please choose:"    
    if %errorlevel% equ 1 (
        echo Closing the process...        
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do taskkill /PID %%a /F
        timeout /t 2 /nobreak >nul
    )
)

:: Enter backend directory
cd /d "%~dp0backend"

:: Check Python environment
echo Checking Python environment...        
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python environment not detected!
    echo Please ensure Python is properly installed and added to system PATH
    pause
    exit /b 1
)

:: Check dependencies
echo Checking dependencies...
python -c "import fastapi" >nul 2>&1       
if %errorlevel% neq 0 (
    echo [INFO] Missing dependencies detected, installing...
    pip install -r requirements.txt        
)

echo.
echo Starting backend service...
echo Service URL: http://localhost:8000    
echo API Docs: http://localhost:8000/docs  
echo.
echo Press Ctrl+C to stop service...       
python main.py

echo.
echo Backend service stopped
pause