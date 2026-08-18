@echo off
title Shubdeep Labs - WhatsApp AI Bot
cd /d "%~dp0"

echo ===================================================
echo       Shubdeep Labs - WhatsApp AI FAQ Bot
echo ===================================================
echo.

:: 1. Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in your PATH!
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check and install dependencies if missing
if not exist "node_modules\" (
    echo [INFO] First time setup: Installing npm dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to install dependencies. Please check your internet connection.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [INFO] Dependencies installed successfully!
    echo.
)

:: 3. Start the bot with auto-restart loop
:loop
echo [INFO] Starting WhatsApp Bot...
node index.js
echo.
echo [WARNING] Bot process ended. Auto-recovering in 3 seconds... (Press Ctrl+C to stop)
timeout /t 3 /nobreak >nul
goto loop