@echo off
title AutoApply Launcher
echo ======================================================================
echo  AutoApply - Desktop Job Application Assistant
echo ======================================================================
echo.

cd /d "%~dp0"

:: Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in your PATH.
    echo Please install Python 3.10+ from python.org and add it to PATH.
    pause
    exit /b 1
)

:: Check if virtual environment exists, create if not
if not exist ".venv" (
    echo [1/3] Creating virtual environment (.venv)...
    python -m venv .venv
)

:: Activate virtual environment
call .venv\Scripts\activate.bat

:: Install / verify dependencies
echo [2/3] Checking and installing required dependencies...
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt

:: Launch AutoApply
echo [3/3] Launching AutoApply GUI...
echo.
python main.py

if %errorlevel% neq 0 (
    echo.
    echo [AutoApply] Application exited with code %errorlevel%.
    pause
)
