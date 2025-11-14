@echo off
echo ========================================
echo  StoryAI Frontend Service Startup Script
echo ========================================

:: Set console color
color 0D

:: Check if port is occupied
echo Checking port 3000...
netstat -ano | findstr ":3000" >nul        
if %errorlevel% equ 0 (
    echo [WARNING] Port 3000 is already in use!
    echo Do you want to forcefully close the process? (Y/N)
    choice /C YN /N /M "Please choose:"    
    if %errorlevel% equ 1 (
        echo Closing the process...        
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do taskkill /PID %%a /F
        timeout /t 2 /nobreak >nul
    )
)

:: Check Node.js environment
echo Checking Node.js environment...       
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js environment not detected!
    echo Please ensure Node.js is properly installed and added to system PATH
    pause
    exit /b 1
)

:: Check npm
echo Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not detected!
    echo Please ensure npm is properly installed
    pause
    exit /b 1
)

:: Check dependencies
echo Checking dependencies...
if not exist "node_modules" (
    echo [INFO] Missing dependencies detected, installing...
    npm install
)

echo.
echo Starting frontend service...
echo Service URL: http://localhost:3000    
echo.
echo Press Ctrl+C to stop service...       
npm run dev

echo.
echo Frontend service stopped
pause